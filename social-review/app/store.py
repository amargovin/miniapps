"""All SQL. Plain psycopg, no ORM — this is a handful of tables and the queries are the
interesting part (brief §2, §5).

Transaction shape (§5): "all writes for one run happen in one transaction; a failed run
leaves no partial week". The `runs` row is the one deliberate exception — it is inserted
and committed *before* the pull so that a crash mid-run leaves an inspectable record
instead of nothing, and finalised afterwards. Every row of actual data for the week — both
post tables, `weekly_totals`, `reports`, `raw_payloads` and the 180-day retention delete —
goes in a single transaction in `write_week`.
"""
from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any, Iterable

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

from app.aggregate import ChannelRollup, TOP_N, X_URL
from app.meta_client import MetaPost
from app.x_client import XPost

# One constant key, so the api service, the weekly cron and a CLI invocation all contend
# for the same lock. Session-level: released when the connection closes, which means a
# container killed mid-run does not leave the lock held.
ADVISORY_LOCK_KEY = 815_263_041_977
RAW_PAYLOAD_RETENTION_DAYS = 180


# ---------------- advisory lock (§2.1) ----------------

def try_advisory_lock(conn: psycopg.Connection) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT pg_try_advisory_lock(%s)", (ADVISORY_LOCK_KEY,))
        return bool(cur.fetchone()[0])


def release_advisory_lock(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT pg_advisory_unlock(%s)", (ADVISORY_LOCK_KEY,))


def running_run_id(conn: psycopg.Connection) -> int | None:
    """Which run currently holds the lock, for the 409 body. Best effort: a container that
    died without finalising leaves a stale `running` row, so the newest one is reported."""
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM runs WHERE status = 'running' ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
        return int(row[0]) if row else None


# ---------------- runs ----------------

def create_run(conn: psycopg.Connection, *, week_ending: date, week_tz: str,
               window_start: datetime, window_end: datetime) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO runs (week_ending, week_tz, window_start, window_end, status)
               VALUES (%s, %s, %s, %s, 'running') RETURNING id""",
            (week_ending, week_tz, window_start, window_end),
        )
        run_id = int(cur.fetchone()[0])
    conn.commit()
    return run_id


def finish_run(conn: psycopg.Connection, run_id: int, *, status: str,
               channels_ok: Iterable[str], channels_failed: Iterable[str],
               notes: list[dict], x_cost_usd: float | None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE runs SET finished_at = now(), status = %s, channels_ok = %s,
                      channels_failed = %s, notes = %s, x_cost_usd = %s
               WHERE id = %s""",
            (status, list(channels_ok), list(channels_failed), Json(notes), x_cost_usd,
             run_id),
        )
    conn.commit()


def get_run(conn: psycopg.Connection, run_id: int) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """SELECT r.*, (SELECT count(*) FROM reports p WHERE p.run_id = r.id) > 0
                            AS pdf_available,
                      (SELECT jsonb_build_object('slide_count', p.slide_count,
                                                 'link_count', p.link_count)
                         FROM reports p WHERE p.run_id = r.id
                        ORDER BY p.rendered_at DESC LIMIT 1) AS report
               FROM runs r WHERE r.id = %s""",
            (run_id,),
        )
        row = cur.fetchone()
    if row:
        # Lift the verification block out of `notes` so the run record has the shape §2.1
        # describes, rather than making every caller dig through the notes array.
        row["verification"] = next(
            (n for n in (row.get("notes") or []) if n.get("note") == "verification"), None)
    return row


def list_runs(conn: psycopg.Connection, *, limit: int = 20,
              status: str | None = None) -> list[dict]:
    sql = ("SELECT id, week_ending, week_tz, window_start, window_end, started_at, "
           "finished_at, status, channels_ok, channels_failed, x_cost_usd FROM runs")
    params: list[Any] = []
    if status:
        sql += " WHERE status = %s"
        params.append(status)
    sql += " ORDER BY id DESC LIMIT %s"
    params.append(limit)
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


# ---------------- idempotency (§2.1) ----------------
# Beyond brief §5's schema: `Idempotency-Key` needs somewhere to live. Retrying a request
# that timed out client-side must not double-bill, so the mapping has to survive a process
# restart, which rules out an in-process dict.

def idempotent_run_id(conn: psycopg.Connection, key: str, *,
                      ttl_hours: int = 24) -> int | None:
    with conn.cursor() as cur:
        cur.execute(
            """SELECT run_id FROM idempotency_keys
               WHERE key = %s AND created_at > now() - make_interval(hours => %s)""",
            (key, ttl_hours),
        )
        row = cur.fetchone()
        return int(row[0]) if row and row[0] is not None else None


def record_idempotency_key(conn: psycopg.Connection, key: str, run_id: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO idempotency_keys (key, run_id) VALUES (%s, %s)
               ON CONFLICT (key) DO UPDATE SET run_id = EXCLUDED.run_id,
                                               created_at = now()""",
            (key, run_id),
        )
    conn.commit()


# ---------------- the cost guard (§10) ----------------

def has_api_rows(conn: psycopg.Connection, week_ending: date,
                 channels: Iterable[str] | None = None) -> bool:
    """True when this week already has api-sourced rollups. Re-pulling on a later UTC day
    is billed in full, so this is what `force` exists to override."""
    sql = "SELECT 1 FROM weekly_totals WHERE week_ending = %s AND source = 'api'"
    params: list[Any] = [week_ending]
    chans = list(channels or [])
    if chans:
        sql += " AND channel = ANY(%s)"
        params.append(chans)
    with conn.cursor() as cur:
        cur.execute(sql + " LIMIT 1", params)
        return cur.fetchone() is not None


def run_id_for_week(conn: psycopg.Connection, week_ending: date) -> int | None:
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id FROM runs WHERE week_ending = %s AND status IN ('ok', 'partial')
               ORDER BY id DESC LIMIT 1""",
            (week_ending,),
        )
        row = cur.fetchone()
        return int(row[0]) if row else None


# ---------------- the one write transaction (§5) ----------------

def write_week(
    conn: psycopg.Connection,
    *,
    run_id: int,
    week_ending: date,
    x_posts: list[XPost],
    meta_posts: list[MetaPost],
    rollups: list[ChannelRollup],
    payloads: list[tuple[str, dict]],
) -> None:
    """Upserts, not inserts: metrics keep accruing after publication, so a re-run of the
    same week legitimately produces higher numbers and must correct rows rather than
    duplicate them."""
    with conn.transaction(), conn.cursor() as cur:
        if x_posts:
            cur.executemany(
                """INSERT INTO posts_x (post_id, week_ending, created_at, text, title,
                       likes, reposts, replies, quotes, bookmarks, impressions,
                       is_head, thread_root)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (post_id) DO UPDATE SET
                       week_ending = EXCLUDED.week_ending, created_at = EXCLUDED.created_at,
                       text = EXCLUDED.text, title = EXCLUDED.title,
                       likes = EXCLUDED.likes, reposts = EXCLUDED.reposts,
                       replies = EXCLUDED.replies, quotes = EXCLUDED.quotes,
                       bookmarks = EXCLUDED.bookmarks, impressions = EXCLUDED.impressions,
                       is_head = EXCLUDED.is_head, thread_root = EXCLUDED.thread_root,
                       fetched_at = now()""",
                [(p.post_id, week_ending, p.created_at, p.text, p.title, p.likes,
                  p.reposts, p.replies, p.quotes, p.bookmarks, p.impressions,
                  p.is_head, p.thread_root) for p in x_posts],
            )
        if meta_posts:
            cur.executemany(
                """INSERT INTO posts_meta (platform, post_id, week_ending, created_at,
                       message, title, permalink, media_type, likes, comments, shares)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (platform, post_id) DO UPDATE SET
                       week_ending = EXCLUDED.week_ending, created_at = EXCLUDED.created_at,
                       message = EXCLUDED.message, title = EXCLUDED.title,
                       permalink = EXCLUDED.permalink, media_type = EXCLUDED.media_type,
                       likes = EXCLUDED.likes, comments = EXCLUDED.comments,
                       shares = EXCLUDED.shares, fetched_at = now()""",
                [(p.platform, p.post_id, week_ending, p.created_at, p.message, p.title,
                  p.permalink, p.media_type, p.likes, p.comments, p.shares)
                 for p in meta_posts],
            )
        for r in rollups:
            row = r.totals_row()
            cur.execute(
                """INSERT INTO weekly_totals (week_ending, channel, week_tz, followers,
                       posts, ranked_posts, engagement, impressions, engagement_per_post,
                       engagement_per_1k_followers, median_engagement, engagement_rate_pct,
                       source)
                   VALUES (%(week_ending)s,%(channel)s,%(week_tz)s,%(followers)s,%(posts)s,
                           %(ranked_posts)s,%(engagement)s,%(impressions)s,
                           %(engagement_per_post)s,%(engagement_per_1k_followers)s,
                           %(median_engagement)s,%(engagement_rate_pct)s,%(source)s)
                   ON CONFLICT (week_ending, channel) DO UPDATE SET
                       week_tz = EXCLUDED.week_tz, followers = EXCLUDED.followers,
                       posts = EXCLUDED.posts, ranked_posts = EXCLUDED.ranked_posts,
                       engagement = EXCLUDED.engagement,
                       impressions = EXCLUDED.impressions,
                       engagement_per_post = EXCLUDED.engagement_per_post,
                       engagement_per_1k_followers = EXCLUDED.engagement_per_1k_followers,
                       median_engagement = EXCLUDED.median_engagement,
                       engagement_rate_pct = EXCLUDED.engagement_rate_pct,
                       source = EXCLUDED.source""",
                row,
            )
        if payloads:
            cur.executemany(
                "INSERT INTO raw_payloads (run_id, source, payload) VALUES (%s,%s,%s)",
                [(run_id, src, Json(body)) for src, body in payloads],
            )
        # Retention, in the same transaction (§5).
        cur.execute(
            "DELETE FROM raw_payloads WHERE fetched_at < now() - make_interval(days => %s)",
            (RAW_PAYLOAD_RETENTION_DAYS,),
        )


def save_report(conn: psycopg.Connection, *, week_ending: date, run_id: int | None,
                filename: str, pdf: bytes, slide_count: int, link_count: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO reports (week_ending, run_id, filename, pdf, slide_count,
                                    link_count)
               VALUES (%s,%s,%s,%s,%s,%s)
               ON CONFLICT (week_ending) DO UPDATE SET
                   run_id = EXCLUDED.run_id, filename = EXCLUDED.filename,
                   pdf = EXCLUDED.pdf, slide_count = EXCLUDED.slide_count,
                   link_count = EXCLUDED.link_count, rendered_at = now()""",
            (week_ending, run_id, filename, pdf, slide_count, link_count),
        )
    conn.commit()


def get_report(conn: psycopg.Connection, week_ending: date) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT week_ending, run_id, filename, pdf, slide_count, link_count, "
            "rendered_at FROM reports WHERE week_ending = %s", (week_ending,))
        return cur.fetchone()


def get_report_for_run(conn: psycopg.Connection, run_id: int) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT week_ending, run_id, filename, pdf, slide_count, link_count, "
            "rendered_at FROM reports WHERE run_id = %s ORDER BY rendered_at DESC LIMIT 1",
            (run_id,))
        return cur.fetchone()


# ---------------- reads ----------------

def get_weekly_totals(conn: psycopg.Connection, week_ending: date) -> dict[str, dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM weekly_totals WHERE week_ending = %s", (week_ending,))
        return {r["channel"]: r for r in cur.fetchall()}


def list_weeks(conn: psycopg.Connection) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM weekly_totals ORDER BY week_ending DESC, channel")
        return cur.fetchall()


def get_week_posts(conn: psycopg.Connection, week_ending: date, channel: str, *,
                   limit: int = 100, offset: int = 0) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        if channel == "x":
            cur.execute(
                """SELECT post_id, created_at, title, text, likes, reposts, replies,
                          quotes, bookmarks, impressions, engagement, is_head, thread_root
                   FROM posts_x WHERE week_ending = %s
                   ORDER BY engagement DESC, post_id LIMIT %s OFFSET %s""",
                (week_ending, limit, offset))
        else:
            cur.execute(
                """SELECT post_id, created_at, title, message, permalink, media_type,
                          likes, comments, shares, engagement
                   FROM posts_meta WHERE week_ending = %s AND platform = %s
                   ORDER BY engagement DESC, post_id LIMIT %s OFFSET %s""",
                (week_ending, channel, limit, offset))
        return cur.fetchall()


def load_rollups(conn: psycopg.Connection, week_ending: date) -> list[ChannelRollup]:
    """Rebuild the render input from Postgres alone — this is what makes `POST /v1/render`
    cost nothing. Scalars come from `weekly_totals`; the appendix rows and the unreported
    -field labels are derived from the stored per-post rows."""
    totals = get_weekly_totals(conn, week_ending)
    out: list[ChannelRollup] = []
    for channel, row in totals.items():
        top, unreported, breakdown = _appendix(conn, week_ending, channel)
        out.append(ChannelRollup(
            channel=channel,
            week_ending=row["week_ending"],
            week_tz=row["week_tz"],
            followers=row["followers"],
            posts=row["posts"],
            ranked_posts=row["ranked_posts"],
            engagement=row["engagement"],
            impressions=row["impressions"],
            engagement_per_post=float(row["engagement_per_post"]),
            engagement_per_1k_followers=(float(row["engagement_per_1k_followers"])
                                         if row["engagement_per_1k_followers"] is not None
                                         else None),
            median_engagement=row["median_engagement"],
            engagement_rate_pct=(float(row["engagement_rate_pct"])
                                 if row["engagement_rate_pct"] is not None else None),
            source=row["source"],
            breakdown=breakdown,
            unreported=unreported,
            top=top,
        ))
    return out


def _appendix(conn: psycopg.Connection, week_ending: date,
              channel: str) -> tuple[list[dict], list[str], list[tuple[str, int]]]:
    with conn.cursor(row_factory=dict_row) as cur:
        if channel == "x":
            # Rankings are heads and standalone posts only: a thread is one item, credited
            # with its head post's metrics (§6).
            cur.execute(
                """SELECT post_id, created_at, title, likes, reposts, replies, quotes,
                          bookmarks, impressions, engagement
                   FROM posts_x WHERE week_ending = %s AND is_head
                   ORDER BY engagement DESC, post_id LIMIT %s""",
                (week_ending, TOP_N))
            rows = cur.fetchall()
            top = [{
                "rank": i, "date": r["created_at"].date().isoformat(),
                "title": r["title"] or r["post_id"], "url": X_URL.format(r["post_id"]),
                "likes": r["likes"], "reposts": r["reposts"], "replies": r["replies"],
                "quotes": r["quotes"], "bookmarks": r["bookmarks"],
                "impressions": r["impressions"], "engagement": r["engagement"],
            } for i, r in enumerate(rows, 1)]
            cur.execute(
                """SELECT COALESCE(sum(likes),0) l, COALESCE(sum(reposts),0) rp,
                          COALESCE(sum(bookmarks),0) b, COALESCE(sum(replies),0) rl,
                          COALESCE(sum(quotes),0) q
                   FROM posts_x WHERE week_ending = %s""", (week_ending,))
            b = cur.fetchone()
            breakdown = [("Likes", b["l"]), ("Reposts", b["rp"]), ("Bookmarks", b["b"]),
                         ("Replies", b["rl"]), ("Quotes", b["q"])]
            return top, [], breakdown

        cur.execute(
            """SELECT post_id, created_at, title, permalink, likes, comments, shares,
                      engagement
               FROM posts_meta WHERE week_ending = %s AND platform = %s
               ORDER BY engagement DESC, post_id LIMIT %s""",
            (week_ending, channel, TOP_N))
        rows = cur.fetchall()
        top = [{
            "rank": i, "date": r["created_at"].date().isoformat(),
            "title": r["title"] or r["post_id"], "url": r["permalink"] or "",
            "likes": r["likes"], "comments": r["comments"], "shares": r["shares"],
            "engagement": r["engagement"],
        } for i, r in enumerate(rows, 1)]
        cur.execute(
            """SELECT count(*) n,
                      count(likes) nl, count(comments) nc, count(shares) ns,
                      COALESCE(sum(likes),0) l, COALESCE(sum(comments),0) c,
                      COALESCE(sum(shares),0) s
               FROM posts_meta WHERE week_ending = %s AND platform = %s""",
            (week_ending, channel))
        a = cur.fetchone()
        unreported = [name for name, cnt in (("likes", a["nl"]), ("comments", a["nc"]),
                                             ("shares", a["ns"])) if a["n"] and cnt == 0]
        breakdown = [("Likes", a["l"]), ("Comments", a["c"]), ("Shares", a["s"])]
        return top, unreported, breakdown


def prior_week_rows(conn: psycopg.Connection, week_ending: date) -> tuple[dict[str, dict], date | None]:
    """The immediately preceding stored week, per channel. Returns the rows and the
    week_ending they belong to — the renderer labels every column with it."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """SELECT max(week_ending) AS we FROM weekly_totals WHERE week_ending < %s""",
            (week_ending,))
        row = cur.fetchone()
    prior = row["we"] if row else None
    if not prior:
        return {}, None
    return get_weekly_totals(conn, prior), prior


def dump_raw_payloads(conn: psycopg.Connection, run_id: int) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, source, fetched_at, payload FROM raw_payloads WHERE run_id = %s "
            "ORDER BY id", (run_id,))
        return cur.fetchall()


def json_default(o: Any):
    """For serialising run records and payload dumps: dates, decimals and bytes lengths."""
    from decimal import Decimal
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, (bytes, memoryview)):
        return f"<{len(bytes(o))} bytes>"
    raise TypeError(f"{type(o)} is not JSON serialisable")


def dumps(o: Any) -> str:
    return json.dumps(o, default=json_default, ensure_ascii=False)
