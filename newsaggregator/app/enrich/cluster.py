"""Cluster pending raw_items into stories.

Brief §8.3:
- candidates = stories with last_updated_at > now-72h and centroid cosine >= 0.80
- on match: join story, recompute centroid (mean of member embeddings, L2-normalized),
  bump member_count, append source_id to sources_covered, update last_updated_at.
  Tier-1 source titles override Tier-2/3 canonical_title.
- on no match: create new story with this item as its first member.
"""
from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Iterable

import numpy as np

from app import config, db
from app.enrich.embed import pack, unpack
from app.sources import Source, by_id, load_sources
from app.textmatch import is_same_event

log = logging.getLogger(__name__)


def _normalize(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    return v if n == 0.0 else (v / n).astype(np.float32)


def _decide_beat(member_source_ids: Iterable[str], srcmap: dict[str, Source]) -> str:
    counts: Counter = Counter()
    tier1_beats: list[str] = []
    seen_beats: set[str] = set()
    for sid in member_source_ids:
        s = srcmap.get(sid)
        if not s:
            continue
        for b in s.beats:
            counts[b] += 1
            seen_beats.add(b)
            if s.tier == 1:
                tier1_beats.append(b)
    if not counts:
        return "other"
    if len(seen_beats) == 1:
        return next(iter(seen_beats))
    top_count = max(counts.values())
    leaders = [b for b, c in counts.items() if c == top_count]
    if len(leaders) == 1:
        return leaders[0]
    # tie-break by tier-1 beats
    for b in tier1_beats:
        if b in leaders:
            return b
    return leaders[0]


def _new_story(
    conn,
    *,
    title: str,
    embedding: np.ndarray,
    source_id: str,
    beat: str,
    now: datetime,
) -> int:
    cur = conn.execute(
        """
        INSERT INTO stories
            (canonical_title, beat, centroid, member_count, sources_covered,
             first_seen_at, last_updated_at, status)
        VALUES (?, ?, ?, 1, ?, ?, ?, 'new')
        """,
        (
            title,
            beat,
            pack(_normalize(embedding)),
            json.dumps([source_id]),
            now,
            now,
        ),
    )
    return int(cur.lastrowid)


def _attach_to_story(
    conn,
    *,
    story_id: int,
    item_embedding: np.ndarray,
    item_source_id: str,
    item_title: str,
    item_tier: int,
    item_published_at: datetime | None,
    now: datetime,
) -> None:
    """Add this item to story_id, recompute centroid + sources_covered + member_count."""
    row = conn.execute(
        "SELECT canonical_title, sources_covered FROM stories WHERE id = ?",
        (story_id,),
    ).fetchone()
    sources_covered = json.loads(row["sources_covered"] or "[]")
    if item_source_id not in sources_covered:
        sources_covered.append(item_source_id)

    # Title-promotion rule: a story that gets a *fresh* update should show the
    # newer framing on the card. Two events on the same topic (e.g. successive
    # petrol-price hikes) would otherwise keep the old title forever.
    #
    # Rule: swap to the incoming item's title if it represents a more recent
    # publication than ANY existing member of the story. Falls back to tier-
    # promotion when published_at info isn't comparable.
    new_title = row["canonical_title"]
    if item_published_at is not None:
        latest_existing = conn.execute(
            """
            SELECT MAX(published_at) AS latest FROM raw_items
            WHERE story_id = ? AND published_at IS NOT NULL
            """,
            (story_id,),
        ).fetchone()
        latest_raw = latest_existing["latest"] if latest_existing else None
        if isinstance(latest_raw, str):
            try:
                latest_raw = datetime.fromisoformat(latest_raw)
            except ValueError:
                latest_raw = None
        if latest_raw and latest_raw.tzinfo is None:
            latest_raw = latest_raw.replace(tzinfo=timezone.utc)
        if latest_raw is None or item_published_at >= latest_raw:
            new_title = item_title
    else:
        current_tier = _title_source_tier(conn, story_id, row["canonical_title"])
        if current_tier is not None and item_tier < current_tier:
            new_title = item_title

    # Recompute centroid as L2-normalized mean of all member embeddings.
    members = conn.execute(
        "SELECT embedding FROM raw_items WHERE story_id = ? AND embedding IS NOT NULL",
        (story_id,),
    ).fetchall()
    member_vecs = [unpack(r["embedding"]) for r in members]
    member_vecs.append(item_embedding)
    centroid = _normalize(np.mean(np.stack(member_vecs), axis=0))

    conn.execute(
        """
        UPDATE stories
           SET canonical_title  = ?,
               sources_covered  = ?,
               centroid         = ?,
               member_count     = member_count + 1,
               last_updated_at  = ?
         WHERE id = ?
        """,
        (new_title, json.dumps(sources_covered), pack(centroid), now, story_id),
    )


def _title_source_tier(conn, story_id: int, title: str) -> int | None:
    """Return the tier of whichever source contributed the current canonical_title.

    We resolve by finding any member item with matching title; first-write wins
    when titles tie (acceptable approximation for tier-1 promotion logic).
    """
    row = conn.execute(
        """
        SELECT source_id FROM raw_items
        WHERE story_id = ? AND title = ?
        ORDER BY id ASC LIMIT 1
        """,
        (story_id, title),
    ).fetchone()
    if not row:
        return None
    srcmap = by_id(load_sources())
    s = srcmap.get(row["source_id"])
    return s.tier if s else None


def _candidate_stories(conn, lookback_hours: int) -> list[tuple[int, np.ndarray]]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
    rows = conn.execute(
        """
        SELECT id, centroid
        FROM stories
        WHERE last_updated_at > ? AND centroid IS NOT NULL
        """,
        (cutoff,),
    ).fetchall()
    return [(r["id"], unpack(r["centroid"])) for r in rows]


def run() -> dict[str, int]:
    """Cluster all unassigned raw_items embedded in the last 72h.

    Hybrid match: cosine alone too noisy at headline level for cross-pub
    variants (real same-event pairs land 0.45-0.60). We use the same
    primitive as Swarajya matching: high cosine auto-merges; mid cosine
    requires content-word overlap. See app.textmatch.is_same_event.

    Returns stats: {assigned_to_existing, new_stories, processed}
    """
    lookback_hours = config.ENRICH_LOOKBACK_HOURS
    cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
    srcmap = by_id(load_sources())

    with db.connect() as conn:
        pending_rows = conn.execute(
            """
            SELECT id, source_id, title, embedding, published_at
            FROM raw_items
            WHERE story_id IS NULL
              AND embedding IS NOT NULL
              AND fetched_at > ?
            ORDER BY fetched_at ASC
            """,
            (cutoff,),
        ).fetchall()

        if not pending_rows:
            return {"processed": 0, "assigned_to_existing": 0, "new_stories": 0}

        candidates = _candidate_stories(conn, lookback_hours)
        cand_ids = [c[0] for c in candidates]
        cand_matrix = (
            np.stack([c[1] for c in candidates]) if candidates else None
        )
        # Maintain candidate titles in step with cand_ids / cand_matrix for
        # the hybrid same-event check.
        cand_titles: list[str] = []
        for sid in cand_ids:
            row = conn.execute(
                "SELECT canonical_title FROM stories WHERE id = ?", (sid,)
            ).fetchone()
            cand_titles.append(row["canonical_title"] if row else "")

        now = datetime.now(timezone.utc)
        assigned = 0
        new_stories = 0

        for r in pending_rows:
            v = unpack(r["embedding"])
            src = srcmap.get(r["source_id"])
            tier = src.tier if src else 3

            chosen_story_id: int | None = None
            if cand_matrix is not None and len(cand_ids) > 0:
                sims = cand_matrix @ v
                best_idx = int(np.argmax(sims))
                best_cos = float(sims[best_idx])
                if is_same_event(
                    best_cos,
                    r["title"],
                    cand_titles[best_idx],
                    # Slightly stricter than Swarajya defaults — we're
                    # merging into the canonical story, false positives
                    # are more visible here.
                    cosine_auto=0.70,
                    cosine_floor=0.50,
                    token_floor=0.25,
                ):
                    chosen_story_id = cand_ids[best_idx]

            if chosen_story_id is not None:
                item_pub = r["published_at"]
                if isinstance(item_pub, str):
                    try:
                        item_pub = datetime.fromisoformat(item_pub)
                    except ValueError:
                        item_pub = None
                if item_pub and item_pub.tzinfo is None:
                    item_pub = item_pub.replace(tzinfo=timezone.utc)
                _attach_to_story(
                    conn,
                    story_id=chosen_story_id,
                    item_embedding=v,
                    item_source_id=r["source_id"],
                    item_title=r["title"],
                    item_tier=tier,
                    item_published_at=item_pub,
                    now=now,
                )
                conn.execute(
                    "UPDATE raw_items SET story_id = ? WHERE id = ?",
                    (chosen_story_id, r["id"]),
                )
                # Update candidate matrix in place: refresh centroid for this story.
                row = conn.execute(
                    "SELECT centroid FROM stories WHERE id = ?", (chosen_story_id,)
                ).fetchone()
                if cand_matrix is not None:
                    idx = cand_ids.index(chosen_story_id)
                    cand_matrix[idx] = unpack(row["centroid"])
                assigned += 1
            else:
                # Pick beat now using just this item's source.
                beat = _decide_beat([r["source_id"]], srcmap)
                sid = _new_story(
                    conn,
                    title=r["title"],
                    embedding=v,
                    source_id=r["source_id"],
                    beat=beat,
                    now=now,
                )
                conn.execute(
                    "UPDATE raw_items SET story_id = ? WHERE id = ?",
                    (sid, r["id"]),
                )
                # Add this new story to the candidate pool so subsequent items can join it.
                cand_ids.append(sid)
                cand_titles.append(r["title"])
                if cand_matrix is None:
                    cand_matrix = _normalize(v).reshape(1, -1)
                else:
                    cand_matrix = np.vstack([cand_matrix, _normalize(v)])
                new_stories += 1

        # Refresh beats for any stories that gained members in this pass.
        touched = conn.execute(
            """
            SELECT DISTINCT story_id FROM raw_items
            WHERE story_id IS NOT NULL AND fetched_at > ?
            """,
            (cutoff,),
        ).fetchall()
        for t in touched:
            members = conn.execute(
                "SELECT source_id FROM raw_items WHERE story_id = ?",
                (t["story_id"],),
            ).fetchall()
            new_beat = _decide_beat([m["source_id"] for m in members], srcmap)
            conn.execute(
                "UPDATE stories SET beat = ? WHERE id = ?",
                (new_beat, t["story_id"]),
            )

        # Title-freshness sweep: for every multi-member story updated in the
        # window, swap canonical_title to its most-recently-published member's
        # title. Catches drift on stories that pre-date the new attach-time
        # logic and re-syncs ones that merged across multi-day update spans
        # (e.g. petrol-price hike #1 followed by hike #2).
        conn.execute(
            """
            UPDATE stories
               SET canonical_title = COALESCE(
                   (SELECT title FROM raw_items r
                     WHERE r.story_id = stories.id
                       AND r.title IS NOT NULL
                       AND r.published_at IS NOT NULL
                     ORDER BY r.published_at DESC
                     LIMIT 1),
                   canonical_title
               )
             WHERE last_updated_at > ?
               AND member_count > 1
            """,
            (cutoff,),
        )

    log.info(
        "cluster: processed=%d assigned=%d new=%d",
        len(pending_rows), assigned, new_stories,
    )
    return {
        "processed": len(pending_rows),
        "assigned_to_existing": assigned,
        "new_stories": new_stories,
    }
