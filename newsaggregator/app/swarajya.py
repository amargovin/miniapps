"""Compare suggested stories against what Swarajya has already published.

Pulls recent items from the News Brief section (id=10991) via the Quintype
advanced-search API, embeds them, and flags any story that looks like the
same news event as a Swarajya item. Flagged stories are hidden from the
dashboard by default.

Matching: MiniLM cosine alone is too noisy for headline-level "same event"
detection (real same-event pairs land around 0.45-0.55, well below the
"semantic duplicate" threshold). So we use a hybrid: auto-match when cosine
is very high; for the mid range, require non-trivial shared content tokens
(content nouns of 4+ chars, stopwords removed).
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
import numpy as np

from app import config, db
from app.enrich.embed import get_service, pack, unpack
from app.textmatch import content_tokens, is_same_event, token_overlap  # noqa: F401

log = logging.getLogger(__name__)

API_URL = "https://swarajyamag.com/api/v1/advanced-search"
NEWS_BRIEF_SECTION_ID = 10991
COSINE_AUTO_MATCH = float(os.environ.get("SWARAJYA_COSINE_AUTO", "0.60"))
COSINE_FLOOR = float(os.environ.get("SWARAJYA_COSINE_FLOOR", "0.40"))
TOKEN_OVERLAP_FLOOR = float(os.environ.get("SWARAJYA_TOKEN_FLOOR", "0.20"))
SWARAJYA_LOOKBACK_HOURS = int(os.environ.get("SWARAJYA_LOOKBACK_HOURS", "24"))
STORY_RECHECK_HOURS = int(os.environ.get("SWARAJYA_STORY_RECHECK_HOURS", "72"))
PAGE_SIZE = 100
MAX_PAGES = 5  # cap at 500 items per cycle


def _same_event(cosine: float, story_title: str | None, sw_title: str | None) -> bool:
    """Swarajya-tuned same-event check using the shared primitive."""
    return is_same_event(
        cosine, story_title, sw_title,
        cosine_auto=COSINE_AUTO_MATCH,
        cosine_floor=COSINE_FLOOR,
        token_floor=TOKEN_OVERLAP_FLOOR,
    )


async def fetch_recent(hours: int = SWARAJYA_LOOKBACK_HOURS, section_id: int = NEWS_BRIEF_SECTION_ID) -> list[dict]:
    """Fetch recent items via Quintype advanced-search, paginated."""
    cutoff_ms = int((datetime.now(timezone.utc) - timedelta(hours=hours)).timestamp() * 1000)
    items: list[dict] = []
    async with httpx.AsyncClient(
        headers={"User-Agent": config.USER_AGENT, "Accept": "application/json"},
        timeout=30,
    ) as client:
        for page in range(MAX_PAGES):
            offset = page * PAGE_SIZE
            resp = await client.get(API_URL, params={
                "section-id": section_id,
                "published-after": cutoff_ms,
                "limit": PAGE_SIZE,
                "offset": offset,
                "sort": "latest-published",
            })
            resp.raise_for_status()
            data = resp.json()
            batch = data.get("items") or []
            items.extend(batch)
            total = data.get("total")
            if len(batch) < PAGE_SIZE:
                break
            if total is not None and len(items) >= total:
                break
    return items


def store_items(items: list[dict]) -> int:
    """Insert items we haven't seen before. Returns newly inserted count."""
    if not items:
        return 0
    ids = [i["id"] for i in items if i.get("id")]
    if not ids:
        return 0
    placeholders = ",".join("?" * len(ids))
    with db.connect() as conn:
        existing = {
            r["id"] for r in conn.execute(
                f"SELECT id FROM swarajya_items WHERE id IN ({placeholders})",
                ids,
            ).fetchall()
        }
    new_items = [i for i in items if i["id"] not in existing]
    if not new_items:
        return 0

    svc = get_service()
    texts = [
        ((i.get("headline") or "").strip() + " " + (i.get("subheadline") or "").strip()).strip()
        for i in new_items
    ]
    vectors = svc.encode_batch(texts)

    now = datetime.now(timezone.utc)
    with db.connect() as conn:
        for item, v in zip(new_items, vectors):
            published_ms = item.get("published-at") or item.get("last-published-at") or 0
            published_at = datetime.fromtimestamp(published_ms / 1000, tz=timezone.utc) if published_ms else now
            conn.execute(
                """
                INSERT INTO swarajya_items
                    (id, title, subheadline, url, section_id, published_at, embedding, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["id"],
                    (item.get("headline") or "").strip(),
                    (item.get("subheadline") or "").strip() or None,
                    item.get("url"),
                    NEWS_BRIEF_SECTION_ID,
                    published_at,
                    pack(v),
                    now,
                ),
            )
    return len(new_items)


def apply_coverage() -> dict[str, int]:
    """For each recently-updated story, flag if a Swarajya item looks like the same event.

    Also un-flags stories whose previous match no longer holds (rare but
    possible if the matching Swarajya item ages out of the window).
    """
    story_cutoff = datetime.now(timezone.utc) - timedelta(hours=STORY_RECHECK_HOURS)
    sw_cutoff = datetime.now(timezone.utc) - timedelta(hours=SWARAJYA_LOOKBACK_HOURS)

    with db.connect() as conn:
        sw_rows = conn.execute(
            """
            SELECT id, title, url, embedding FROM swarajya_items
            WHERE published_at > ? AND embedding IS NOT NULL
            """,
            (sw_cutoff,),
        ).fetchall()
        if not sw_rows:
            return {"sw_corpus": 0, "checked": 0, "matched": 0}

        sw_matrix = np.stack([unpack(r["embedding"]) for r in sw_rows])
        sw_titles = [r["title"] for r in sw_rows]
        sw_urls = [r["url"] for r in sw_rows]

        stories = conn.execute(
            """
            SELECT id, canonical_title, centroid, swarajya_covered FROM stories
            WHERE last_updated_at > ? AND centroid IS NOT NULL
            """,
            (story_cutoff,),
        ).fetchall()

        matched = 0
        cleared = 0
        for s in stories:
            v = unpack(s["centroid"])
            sims = sw_matrix @ v
            best_idx = int(np.argmax(sims))
            best = float(sims[best_idx])
            if _same_event(best, s["canonical_title"], sw_titles[best_idx]):
                conn.execute(
                    """
                    UPDATE stories
                       SET swarajya_covered = 1,
                           swarajya_match_url = ?,
                           swarajya_match_title = ?,
                           swarajya_match_similarity = ?
                     WHERE id = ?
                    """,
                    (sw_urls[best_idx], sw_titles[best_idx], best, s["id"]),
                )
                matched += 1
            elif s["swarajya_covered"]:
                conn.execute(
                    """
                    UPDATE stories
                       SET swarajya_covered = 0,
                           swarajya_match_url = NULL,
                           swarajya_match_title = NULL,
                           swarajya_match_similarity = NULL
                     WHERE id = ?
                    """,
                    (s["id"],),
                )
                cleared += 1
    return {"sw_corpus": len(sw_rows), "checked": len(stories), "matched": matched, "cleared": cleared}


async def run() -> dict:
    """Fetch fresh Swarajya items, then re-evaluate coverage flags.

    Errors are caught and returned in the result — don't crash the enrich cycle.
    """
    try:
        items = await fetch_recent()
    except Exception as e:
        log.warning("swarajya fetch failed: %s", e)
        # Still apply coverage with whatever's already cached.
        return {"sw_fetch_error": str(e)[:200], **{f"sw_{k}": v for k, v in apply_coverage().items()}}

    stored = store_items(items)
    cov = apply_coverage()
    log.info("swarajya: fetched=%d stored=%d %s", len(items), stored, cov)
    return {
        "sw_fetched": len(items),
        "sw_stored": stored,
        **{f"sw_{k}": v for k, v in cov.items()},
    }
