"""Pre-cluster dedup pass.

For each pending item (no story_id yet) compute embedding, then check
against any item from the last 24h whose cosine ≥ DEDUP_SIMILARITY_THRESHOLD.
If the matched item already belongs to a story, the pending item joins that
story directly (skipping clustering). Otherwise both items remain pending and
will be clustered together in step 5.

This catches syndicated wire copy with minor edits (PTI re-runs etc).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import numpy as np

from app import config, db
from app.enrich.embed import get_service, pack, unpack

log = logging.getLogger(__name__)


def _embed_pending(emb_dim: int) -> int:
    """Encode and persist embeddings for raw_items with embedding=NULL.

    Returns the count of items embedded in this pass.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=config.ENRICH_LOOKBACK_HOURS)
    with db.connect() as conn:
        rows = conn.execute(
            """
            SELECT id, title, body
            FROM raw_items
            WHERE embedding IS NULL AND fetched_at > ?
            ORDER BY fetched_at ASC
            """,
            (cutoff,),
        ).fetchall()

    if not rows:
        return 0

    svc = get_service()
    texts = [(r["title"] + " " + (r["body"] or "")).strip() for r in rows]
    vectors = svc.encode_batch(texts)

    with db.connect() as conn:
        for r, v in zip(rows, vectors):
            conn.execute(
                "UPDATE raw_items SET embedding = ? WHERE id = ?",
                (pack(v), r["id"]),
            )
    log.info("embedded %d pending items", len(rows))
    return len(rows)


def _load_recent_with_embeddings(hours: int) -> list[tuple[int, int | None, np.ndarray]]:
    """Return (id, story_id, embedding) for all items embedded in the last `hours` hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    with db.connect() as conn:
        rows = conn.execute(
            """
            SELECT id, story_id, embedding
            FROM raw_items
            WHERE embedding IS NOT NULL AND fetched_at > ?
            """,
            (cutoff,),
        ).fetchall()
    return [(r["id"], r["story_id"], unpack(r["embedding"])) for r in rows]


def assign_near_duplicates() -> int:
    """For unassigned pending items, attach to story_id of any near-dup neighbor.

    Returns the count of items reassigned.
    """
    threshold = config.DEDUP_SIMILARITY_THRESHOLD
    recent = _load_recent_with_embeddings(hours=24)
    if not recent:
        return 0

    pending = [(rid, sid, vec) for rid, sid, vec in recent if sid is None]
    assigned_to_story = [(rid, sid, vec) for rid, sid, vec in recent if sid is not None]
    if not pending or not assigned_to_story:
        return 0

    matrix = np.stack([v for _, _, v in assigned_to_story]) if assigned_to_story else None
    sids = [sid for _, sid, _ in assigned_to_story]
    reassigned = 0

    with db.connect() as conn:
        for pid, _, pvec in pending:
            sims = matrix @ pvec  # cosine since both L2-normalized
            best_idx = int(np.argmax(sims))
            best = float(sims[best_idx])
            if best >= threshold:
                conn.execute(
                    "UPDATE raw_items SET story_id = ? WHERE id = ?",
                    (sids[best_idx], pid),
                )
                reassigned += 1
    if reassigned:
        log.info("dedup: assigned %d items to existing stories via near-dup", reassigned)
    return reassigned


def run() -> dict[str, int]:
    """Run the dedup phase: backfill embeddings, attach near-dups."""
    embedded = _embed_pending(emb_dim=384)
    reassigned = assign_near_duplicates()
    return {"embedded": embedded, "near_dup_reassigned": reassigned}
