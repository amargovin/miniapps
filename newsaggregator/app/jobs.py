"""Top-level job entry points: fetch_all, enrich_all, prune_old_data."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app import config, db
from app.fetchers.base import FetchedItem, content_hash
from app.fetchers.homepage import HomepageFetcher
from app.fetchers.html import HTMLScraper
from app.fetchers.rss import RSSFetcher
from app.fetchers.screenshot import ScreenshotFetcher
from app.sources import Source, load_sources

log = logging.getLogger(__name__)

MAX_BACKOFF_MULTIPLIER = 8
FAILURE_BACKOFF_THRESHOLD = 5

# Tracked for /healthz. Reset to None on restart, populated after first run.
last_fetch_at: datetime | None = None
last_enrich_at: datetime | None = None
last_fetch_summary: dict | None = None
last_enrich_summary: dict | None = None

# Manual refresh job state. Single concurrent job — the dashboard
# polls this and renders progress.
refresh_state: dict = {
    "running": False,
    "phase": "idle",       # idle | fetching | embedding | clustering | scoring | swarajya | editorial | brief | done | error
    "message": "",
    "started_at": None,
    "finished_at": None,
    "summary": None,
    "error": None,
}


def _set_phase(phase: str, message: str = "") -> None:
    refresh_state["phase"] = phase
    refresh_state["message"] = message
    log.info("refresh phase=%s %s", phase, message)


async def run_full_cycle() -> dict:
    """Manual full refresh: fetch + enrich, with progress reporting.

    The route flips refresh_state["running"] = True synchronously before
    spawning this task (so the polling response is wired immediately).
    This function does not raise if already marked running — the route
    is responsible for preventing duplicate concurrent invocations.
    """
    refresh_state["running"] = True
    if refresh_state.get("started_at") is None:
        refresh_state["started_at"] = datetime.now(timezone.utc)
    refresh_state["finished_at"] = None
    refresh_state["summary"] = None
    refresh_state["error"] = None
    try:
        _set_phase("fetching", "Pulling RSS + homepage sources...")
        fetch_results = await fetch_all()
        _set_phase(
            "fetching_done",
            f"Fetched {sum(r.fetched for r in fetch_results)} items, "
            f"inserted {sum(r.inserted for r in fetch_results)} new",
        )

        from app import swarajya
        from app.enrich import brief, cluster, dedup, editorial

        summary: dict = {"fetch": last_fetch_summary}

        _set_phase("embedding", "Embedding new items...")
        summary.update(dedup.run())

        _set_phase("clustering", "Clustering items into stories...")
        summary.update(cluster.run())

        _set_phase("swarajya", "Checking Swarajya coverage...")
        summary.update(await swarajya.run())

        _set_phase("editorial", "AI editor reviewing significance...")
        summary.update(await editorial.run())

        _set_phase("brief", "Writing briefs for included stories...")
        summary.update(await brief.run())

        global last_enrich_at, last_enrich_summary
        last_enrich_at = datetime.now(timezone.utc)
        last_enrich_summary = summary

        _set_phase("done", "Refresh complete.")
        refresh_state["summary"] = summary
        return summary
    except Exception as e:
        log.exception("refresh failed")
        refresh_state["error"] = str(e)[:300]
        _set_phase("error", str(e)[:200])
        raise
    finally:
        refresh_state["running"] = False
        refresh_state["finished_at"] = datetime.now(timezone.utc)


@dataclass
class FetchSummary:
    source_id: str
    fetched: int
    inserted: int
    skipped_due_to_throttle: bool
    error: str | None
    filtered: int = 0


def _read_state(source_id: str) -> dict | None:
    with db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM source_state WHERE source_id = ?", (source_id,)
        ).fetchone()
    return dict(row) if row else None


def _interval_minutes(source: Source, state: dict | None) -> int:
    base = source.fetch_interval_min
    if not state:
        return base
    fails = state.get("consecutive_failures") or 0
    if fails < FAILURE_BACKOFF_THRESHOLD:
        return base
    multiplier = min(MAX_BACKOFF_MULTIPLIER, 2 ** (fails - FAILURE_BACKOFF_THRESHOLD + 1))
    return base * multiplier


def _due_for_fetch(source: Source, state: dict | None, now: datetime) -> bool:
    if not state or not state.get("last_fetched_at"):
        return True
    last = state["last_fetched_at"]
    if isinstance(last, str):
        last = datetime.fromisoformat(last)
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return now - last >= timedelta(minutes=_interval_minutes(source, state))


def _record_fetch_result(source_id: str, ok: bool, error: str | None, now: datetime) -> None:
    with db.connect() as conn:
        existing = conn.execute(
            "SELECT consecutive_failures, last_ok_at FROM source_state WHERE source_id = ?",
            (source_id,),
        ).fetchone()
        consecutive = (existing["consecutive_failures"] if existing else 0) or 0
        new_consecutive = 0 if ok else consecutive + 1
        last_ok = now if ok else (existing["last_ok_at"] if existing else None)
        conn.execute(
            """
            INSERT INTO source_state (source_id, last_fetched_at, last_ok_at, last_error, consecutive_failures)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(source_id) DO UPDATE SET
                last_fetched_at = excluded.last_fetched_at,
                last_ok_at = COALESCE(excluded.last_ok_at, source_state.last_ok_at),
                last_error = excluded.last_error,
                consecutive_failures = excluded.consecutive_failures
            """,
            (source_id, now, last_ok, error, new_consecutive),
        )


def _store_items(items: list[FetchedItem], source: Source) -> tuple[int, int]:
    """Insert items, skipping content_hash/url dups and editorial-filter matches.

    Returns (inserted, filtered) — `filtered` is items dropped by
    exclude_title_patterns / exclude_url_patterns from sources.yaml.
    Embeddings are left NULL here; the enrich job populates them.
    """
    if not items:
        return 0, 0
    title_re = source.title_filter()
    url_re = source.url_filter()
    inserted = 0
    filtered = 0
    with db.connect() as conn:
        for it in items:
            if title_re and title_re.search(it.title):
                filtered += 1
                continue
            if url_re and url_re.search(it.canonical_url or it.url):
                filtered += 1
                continue
            ch = content_hash(it.title, it.body)
            existing = conn.execute(
                "SELECT 1 FROM raw_items WHERE content_hash = ? OR url = ? LIMIT 1",
                (ch, it.url),
            ).fetchone()
            if existing:
                continue
            try:
                conn.execute(
                    """
                    INSERT INTO raw_items
                        (source_id, url, canonical_url, title, body, author,
                         published_at, fetched_at, content_hash, embedding,
                         story_id, homepage_tier)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
                    """,
                    (
                        it.source_id, it.url, it.canonical_url, it.title, it.body,
                        it.author, it.published_at, it.fetched_at, ch,
                        it.homepage_tier,
                    ),
                )
                inserted += 1
            except Exception as e:  # unique-constraint races, malformed rows
                log.warning("insert failed for %s (%s): %s", it.source_id, it.url, e)
    return inserted, filtered


async def _fetch_one(fetcher_map: dict[str, object], source: Source, now: datetime) -> FetchSummary:
    state = _read_state(source.id)
    if not _due_for_fetch(source, state, now):
        return FetchSummary(source.id, 0, 0, True, None)

    fetcher = fetcher_map.get(source.type)
    if fetcher is None:
        log.warning("no fetcher for type %s (source %s)", source.type, source.id)
        return FetchSummary(source.id, 0, 0, False, f"no fetcher for {source.type}")

    if source.type in ("html", "screenshot"):
        # Stubs in v1: log warning and mark fetched without error.
        await fetcher.fetch(source)
        _record_fetch_result(source.id, ok=True, error=None, now=now)
        return FetchSummary(source.id, 0, 0, False, None)

    # Homepage fetcher uses a real fetcher path but its errors are non-fatal:
    # vision/Playwright failures shouldn't tank the whole cycle.

    try:
        items = await fetcher.fetch(source)
    except Exception as e:
        log.warning("fetcher %s raised: %s", source.id, e)
        _record_fetch_result(source.id, ok=False, error=str(e)[:500], now=now)
        return FetchSummary(source.id, 0, 0, False, str(e))

    inserted, filtered = _store_items(items, source)
    if filtered:
        log.info("source %s: %d items dropped by editorial filters", source.id, filtered)
    _record_fetch_result(source.id, ok=True, error=None, now=now)

    if state and state.get("last_ok_at"):
        last_ok = state["last_ok_at"]
        if isinstance(last_ok, str):
            last_ok = datetime.fromisoformat(last_ok)
        if last_ok.tzinfo is None:
            last_ok = last_ok.replace(tzinfo=timezone.utc)
        if inserted == 0 and now - last_ok > timedelta(days=14):
            log.warning("source %s has not produced new items in 14+ days", source.id)

    return FetchSummary(source.id, len(items), inserted, False, None, filtered=filtered)


async def fetch_all() -> list[FetchSummary]:
    """Fetch every due source. Errors are logged, never raised."""
    sources = load_sources()
    now = datetime.now(timezone.utc)

    async with RSSFetcher() as rss, HomepageFetcher() as homepage:
        fetcher_map = {
            "rss": rss,
            "homepage": homepage,
            "html": HTMLScraper(),
            "screenshot": ScreenshotFetcher(),
        }
        gathered = await asyncio.gather(
            *(_fetch_one(fetcher_map, s, now) for s in sources),
            return_exceptions=True,
        )

    results: list[FetchSummary] = []
    for s, r in zip(sources, gathered):
        if isinstance(r, Exception):
            log.exception("unhandled in _fetch_one for %s", s.id, exc_info=r)
            results.append(FetchSummary(s.id, 0, 0, False, str(r)[:500]))
        else:
            results.append(r)

    total_fetched = sum(r.fetched for r in results)
    total_inserted = sum(r.inserted for r in results)
    log.info(
        "fetch_all done: %d sources, %d items fetched, %d inserted",
        len(results), total_fetched, total_inserted,
    )
    global last_fetch_at, last_fetch_summary
    last_fetch_at = datetime.now(timezone.utc)
    last_fetch_summary = {
        "sources": len(results),
        "fetched": total_fetched,
        "inserted": total_inserted,
        "errors": sum(1 for r in results if r.error),
    }
    return results


async def enrich_all() -> dict:
    """Run the enrichment pipeline. Step 4 covers embed + dedup.

    Clustering, scoring, briefs come online in subsequent steps.
    """
    from app import swarajya
    from app.enrich import brief, cluster, dedup, editorial

    summary: dict = {}
    summary.update(dedup.run())
    summary.update(cluster.run())
    summary.update(await swarajya.run())
    summary.update(await editorial.run())
    summary.update(await brief.run())
    log.info("enrich_all: %s", summary)
    global last_enrich_at, last_enrich_summary
    last_enrich_at = datetime.now(timezone.utc)
    last_enrich_summary = summary
    return summary


async def prune_old_data() -> dict[str, int]:
    """Drop stale raw_items and stories.

    Brief §9: delete raw_items older than 30 days that aren't attached to a
    story still in the top 1000 by score; delete stories not updated in 30 days.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    with db.connect() as conn:
        keep_ids = {
            r["id"] for r in conn.execute(
                "SELECT id FROM stories ORDER BY score DESC LIMIT 1000"
            ).fetchall()
        }
        if keep_ids:
            placeholders = ",".join("?" * len(keep_ids))
            cur = conn.execute(
                f"""
                DELETE FROM raw_items
                WHERE fetched_at < ?
                  AND (story_id IS NULL OR story_id NOT IN ({placeholders}))
                """,
                (cutoff, *keep_ids),
            )
        else:
            cur = conn.execute(
                "DELETE FROM raw_items WHERE fetched_at < ?", (cutoff,)
            )
        items_deleted = cur.rowcount

        cur2 = conn.execute(
            "DELETE FROM stories WHERE last_updated_at < ?", (cutoff,)
        )
        stories_deleted = cur2.rowcount

    log.info(
        "prune: %d raw_items, %d stories deleted (cutoff=%s)",
        items_deleted, stories_deleted, cutoff.date(),
    )
    return {"items_deleted": items_deleted, "stories_deleted": stories_deleted}
