"""AI editorial gate.

Claude (Haiku by default) decides per-story whether a story belongs in a
top-25 national news feed — like a desk editor deciding what to surface.
Stories that fail this gate are hidden from the dashboard by default.

Fails open: if ANTHROPIC_API_KEY is unset or the API errors, we leave
editorial_pass=NULL so the story stays visible. Only an explicit 0 from
Claude hides a story.

Cost: ~92 stories × ~600 token Haiku call ≈ $0.05–0.08 per cycle.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
from datetime import datetime, timezone

from app import config, db
from app.sources import by_id, load_sources

log = logging.getLogger(__name__)

PROMPT_TEMPLATE = """You are the desk editor at an Indian national daily. For this story, return TWO judgments:

1. **include** — does it belong in today's top 25 national news feed?
2. **significance** — if it were on the feed, how prominent should it be? Score 1-5 where:
   - 5 = lead story (front-page, top-of-feed national event — major Cabinet decision, PM major announcement, war, Supreme Court constitutional ruling, election result)
   - 4 = strong page-one (key policy / political / economic decision with national consequence)
   - 3 = solid mid-feed (notable national development, important state news with national resonance)
   - 2 = below-the-fold (worth carrying but not prominent — minor governance, niche policy)
   - 1 = barely qualifies (would only run on a slow news day)

INCLUDE when the story is:
- A major political, policy, judicial, security, economic, or infrastructure development with national significance
- Government / Cabinet / Parliament / Supreme Court / Election Commission action with national impact
- Significant state-level political development that matters beyond the state (CM swearing-ins, key portfolio decisions, major Centre-State tensions)
- Macroeconomic or sectoral news affecting markets, industries, or policy direction
- Defence / national security / foreign policy developments with India angle

EXCLUDE when the story is:
- Lifestyle, entertainment, celebrity, religious-festival, fashion, food, or travel content
- "Quote of the day" / horoscope / advice columns / Q&A teasers
- Cricket / sports match previews, predictions, fantasy XIs
- Local crime blotter (single arrests, accidents, hyperlocal violence) unless nationally newsworthy
- Listicles, "How to check X", "What is Y", routine weather updates
- Pure PR / press release coverage of routine corporate moves
- Opinion columns, editorials (those belong on the opinion page)
- Foreign news without a strong India angle
- Items already covered today by the same outlet (rephrasings of earlier news)

STORY:
Title: {title}
Beat: {beat}
Outlet count: {member_count} ({sources})
Summary / lead: {lead}

Return STRICT JSON with exactly these keys:
{{
  "include": true,
  "significance": 3,
  "reason": "1-line rationale, <=15 words"
}}

Be decisive — err on the side of EXCLUDE for filler, entertainment, sports, lifestyle, columns, and 'how-to' content. For included stories, calibrate significance honestly — most belong at 2-3; reserve 5 for the genuine lead story of the day. If the story appears as a HERO placement on one or more publications' homepages, weight that as strong evidence of news-desk prominence and bias significance UP. Output JSON only, no preamble.
"""

CONCURRENCY = 6
MAX_RETRIES = 3
RETRY_BASE_DELAY_SEC = 2.0
BODY_CHAR_CAP = 600


def _candidates() -> list[dict]:
    """Stories whose editorial check is missing or stale (older than last_updated_at)."""
    with db.connect() as conn:
        rows = conn.execute(
            """
            SELECT id FROM stories
            WHERE swarajya_covered = 0
              AND (editorial_checked_at IS NULL
                   OR editorial_checked_at < last_updated_at)
            ORDER BY last_updated_at DESC
            """,
        ).fetchall()
    return [dict(r) for r in rows]


def _build_prompt(story_id: int, srcmap: dict) -> str | None:
    with db.connect() as conn:
        s = conn.execute(
            "SELECT canonical_title, beat, member_count, sources_covered FROM stories WHERE id = ?",
            (story_id,),
        ).fetchone()
        if not s:
            return None
        lead_row = conn.execute(
            """
            SELECT body, title FROM raw_items
            WHERE story_id = ?
            ORDER BY (published_at IS NULL), published_at DESC, fetched_at DESC
            LIMIT 1
            """,
            (story_id,),
        ).fetchone()
        # Front-page signal: what tier did each homepage source give this story?
        tier_rows = conn.execute(
            """
            SELECT source_id, homepage_tier FROM raw_items
            WHERE story_id = ? AND homepage_tier IS NOT NULL
            """,
            (story_id,),
        ).fetchall()
    sources_covered = json.loads(s["sources_covered"] or "[]")
    source_names = [
        (srcmap[sid].name if sid in srcmap else sid) for sid in sources_covered
    ]
    lead = ""
    if lead_row:
        lead = (lead_row["body"] or lead_row["title"] or "")[:BODY_CHAR_CAP]
    # Build a layout-prominence line for the prompt. Empty if no homepage sources
    # picked this up.
    tier_line = ""
    if tier_rows:
        parts = []
        for r in tier_rows:
            src = srcmap.get(r["source_id"])
            name = src.name if src else r["source_id"]
            parts.append(f"{name}: {r['homepage_tier']}")
        tier_line = (
            "\nFront-page layout signal (where THIS story landed on each "
            "publication's homepage — 'hero' = big top-of-page lead, "
            "'secondary' = mid-card, 'tertiary' = small link):\n  "
            + "; ".join(parts)
        )
    return PROMPT_TEMPLATE.format(
        title=s["canonical_title"],
        beat=s["beat"] or "other",
        member_count=s["member_count"],
        sources=", ".join(source_names),
        lead=lead or "(no body)",
    ) + tier_line


async def _call_claude(client, prompt: str, model: str) -> str:
    from anthropic import APIError, APIStatusError, RateLimitError

    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = await client.messages.create(
                model=model,
                max_tokens=150,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text
        except (RateLimitError, APIStatusError, APIError) as e:
            last_exc = e
            if attempt == MAX_RETRIES - 1:
                raise
            delay = RETRY_BASE_DELAY_SEC * (2 ** attempt) + random.uniform(0, 0.5)
            await asyncio.sleep(delay)
    if last_exc:
        raise last_exc
    return ""


def _parse(text: str) -> tuple[bool | None, int | None, str | None]:
    """Return (include, significance, reason). include=None means parse failure."""
    s = text.strip()
    if s.startswith("```"):
        s = s.strip("`")
        first_nl = s.find("\n")
        if first_nl != -1:
            s = s[first_nl + 1:]
        if s.endswith("```"):
            s = s[:-3]
        s = s.strip()
    try:
        data = json.loads(s)
    except json.JSONDecodeError:
        return None, None, None
    if not isinstance(data, dict) or "include" not in data:
        return None, None, None
    inc = data.get("include")
    if not isinstance(inc, bool):
        return None, None, None
    reason = str(data.get("reason") or "").strip()[:200] or None
    sig_raw = data.get("significance")
    sig: int | None
    if isinstance(sig_raw, (int, float)):
        sig = max(1, min(5, int(round(sig_raw))))
    else:
        sig = None
    return inc, sig, reason


def _persist(story_id: int, include: bool | None, significance: int | None, reason: str | None) -> None:
    if include is None:
        # Parse error — leave NULL (fails open)
        return
    now = datetime.now(timezone.utc)
    with db.connect() as conn:
        conn.execute(
            """
            UPDATE stories
               SET editorial_pass = ?,
                   editorial_significance = ?,
                   editorial_reason = ?,
                   editorial_checked_at = ?
             WHERE id = ?
            """,
            (1 if include else 0, significance, reason, now, story_id),
        )


async def _process(client, model: str, story_id: int, srcmap: dict, sem: asyncio.Semaphore) -> str:
    async with sem:
        prompt = _build_prompt(story_id, srcmap)
        if prompt is None:
            return "missing"
        try:
            text = await _call_claude(client, prompt, model)
        except Exception as e:
            log.warning("editorial claude call failed for %d: %s", story_id, e)
            return "api_error"
        include, significance, reason = _parse(text)
        if include is None:
            log.warning(
                "editorial JSON parse failed for %d; raw: %s",
                story_id, text[:200],
            )
            return "parse_error"
        _persist(story_id, include, significance, reason)
        return "included" if include else "excluded"


async def run() -> dict[str, int]:
    """Run editorial gate over stories that need it. Fails open if no API key."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return {"editorial_skipped_no_key": 1}

    from anthropic import AsyncAnthropic

    candidates = _candidates()
    if not candidates:
        return {"editorial_attempted": 0, "editorial_included": 0, "editorial_excluded": 0}

    srcmap = by_id(load_sources())
    client = AsyncAnthropic()
    sem = asyncio.Semaphore(CONCURRENCY)

    results = await asyncio.gather(
        *(_process(client, config.CLAUDE_MODEL, c["id"], srcmap, sem) for c in candidates),
        return_exceptions=True,
    )

    counts = {
        "editorial_attempted": len(candidates),
        "editorial_included": 0,
        "editorial_excluded": 0,
        "editorial_errors": 0,
    }
    for r in results:
        if r == "included":
            counts["editorial_included"] += 1
        elif r == "excluded":
            counts["editorial_excluded"] += 1
        elif isinstance(r, Exception):
            counts["editorial_errors"] += 1
            log.exception("editorial unhandled exception", exc_info=r)
        else:
            counts["editorial_errors"] += 1
    log.info("editorial: %s", counts)
    return counts
