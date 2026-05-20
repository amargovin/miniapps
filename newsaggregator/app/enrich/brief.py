"""Sync brief generation via the Anthropic SDK.

Brief §8.6: for the top-N stories by score, call Claude with the prompt
template, parse strict JSON ({brief, angle, key_facts}), persist. On parse
failure, log the raw response and store a fallback brief built from the
highest-tier source's body. Concurrency cap 5; 3x exponential backoff on
APIError/RateLimitError. Skip stories whose `brief_generated_at` is newer
than `last_updated_at`.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
from datetime import datetime, timezone
from typing import Any

from app import config, db
from app.sources import by_id, load_sources

log = logging.getLogger(__name__)

PROMPT_TEMPLATE = """You are a wire-desk editor at an Indian national daily. Generate a brief for one news story below. The brief will be used by editors to decide whether to publish. Be factual, neutral, and dense.

STORY TITLE: {title}
BEAT: {beat}
SOURCES COVERING IT ({n}): {sources}

ARTICLES (most recent first):
---
{articles}

Return STRICT JSON with exactly these keys:
{{
  "brief": "2-3 sentence summary, ~60 words. Lead with the news.",
  "angle": "One-sentence editorial angle a national daily would emphasize.",
  "key_facts": [
    "Fact 1 with date/time/number where possible.",
    "Fact 2.",
    "Fact 3."
  ]
}}

Rules:
- 3 to 5 key facts, each <=25 words.
- Include specific timestamps wherever the source provides them (e.g., "Cabinet approved on 8 May 2026").
- Do not editorialize in `brief` or `key_facts`. The `angle` field is the only place for editorial framing.
- Do not invent facts not present in the source articles.
- Output JSON only. No code fences, no preamble.
"""

MAX_MEMBERS_IN_PROMPT = 5
BODY_CHAR_CAP = 2000  # per-article body truncation; saves tokens
CONCURRENCY = 5
MAX_RETRIES = 3
RETRY_BASE_DELAY_SEC = 2.0


def _format_members(members: list[dict], srcmap: dict) -> str:
    """Format up to MAX_MEMBERS_IN_PROMPT articles for the prompt."""
    chunks: list[str] = []
    for m in members[:MAX_MEMBERS_IN_PROMPT]:
        src = srcmap.get(m["source_id"])
        src_name = src.name if src else m["source_id"]
        published = m.get("published_at") or "(unknown)"
        if isinstance(published, datetime):
            published = published.isoformat()
        body = (m.get("body") or "(no body)")[:BODY_CHAR_CAP]
        chunks.append(
            f"SOURCE: {src_name} | PUBLISHED: {published}\n"
            f"TITLE: {m['title']}\n"
            f"BODY: {body}\n---"
        )
    return "\n".join(chunks)


def _build_prompt(story: dict, members: list[dict], srcmap: dict) -> str:
    sources_covered = story.get("sources_covered") or []
    source_names = []
    for s in sources_covered:
        src = srcmap.get(s)
        source_names.append(src.name if src else s)
    return PROMPT_TEMPLATE.format(
        title=story["canonical_title"],
        beat=story.get("beat") or "other",
        n=len(sources_covered),
        sources=", ".join(source_names),
        articles=_format_members(members, srcmap),
    )


def _fallback_brief(members: list[dict], srcmap: dict) -> dict:
    """First 60 words of the highest-tier source's body."""
    sorted_members = sorted(
        members,
        key=lambda m: (srcmap[m["source_id"]].tier if m["source_id"] in srcmap else 3, -1),
    )
    body = next((m.get("body") for m in sorted_members if m.get("body")), None)
    if not body:
        body = next((m.get("title") for m in sorted_members), "")
    words = body.split()[:60]
    return {
        "brief": " ".join(words) + ("..." if len(words) == 60 else ""),
        "angle": None,
        "key_facts": [],
    }


def _parse_response(text: str) -> dict | None:
    """Strict JSON parse; tolerate code-fenced output as a small concession."""
    s = text.strip()
    if s.startswith("```"):
        # strip ```json ... ``` if present
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
        return None
    if not isinstance(data, dict):
        return None
    return {
        "brief": str(data.get("brief") or "").strip() or None,
        "angle": str(data.get("angle") or "").strip() or None,
        "key_facts": [
            str(k).strip() for k in (data.get("key_facts") or []) if str(k).strip()
        ][:5],
    }


async def _call_claude(client, prompt: str, model: str) -> str:
    """Single Claude call with exponential-backoff retry on transient errors."""
    from anthropic import APIError, APIStatusError, RateLimitError

    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = await client.messages.create(
                model=model,
                max_tokens=600,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text
        except (RateLimitError, APIStatusError, APIError) as e:
            last_exc = e
            if attempt == MAX_RETRIES - 1:
                raise
            delay = RETRY_BASE_DELAY_SEC * (2 ** attempt) + random.uniform(0, 0.5)
            log.warning(
                "claude call retry %d/%d after %.1fs: %s",
                attempt + 1, MAX_RETRIES, delay, e,
            )
            await asyncio.sleep(delay)
    if last_exc:
        raise last_exc
    return ""  # unreachable


def _candidate_story_rows(limit: int) -> list[dict]:
    """Return top-N stories whose brief is missing or stale.

    Stale: brief_generated_at IS NULL OR brief_generated_at < last_updated_at.
    """
    with db.connect() as conn:
        rows = conn.execute(
            """
            SELECT id FROM stories
            WHERE (brief_generated_at IS NULL
                   OR brief_generated_at < last_updated_at)
              AND swarajya_covered = 0
              AND (editorial_pass IS NULL OR editorial_pass = 1)
            ORDER BY COALESCE(editorial_significance, 0) DESC, last_updated_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def _load_story_with_members(story_id: int) -> tuple[dict, list[dict]] | None:
    with db.connect() as conn:
        s = conn.execute("SELECT * FROM stories WHERE id = ?", (story_id,)).fetchone()
        if not s:
            return None
        members = conn.execute(
            """
            SELECT source_id, title, body, published_at
            FROM raw_items
            WHERE story_id = ?
            ORDER BY (published_at IS NULL), published_at DESC, fetched_at DESC
            """,
            (story_id,),
        ).fetchall()
    story = dict(s)
    if isinstance(story.get("sources_covered"), str):
        try:
            story["sources_covered"] = json.loads(story["sources_covered"])
        except json.JSONDecodeError:
            story["sources_covered"] = []
    return story, [dict(m) for m in members]


def _persist(story_id: int, parsed: dict, used_fallback: bool) -> None:
    now = datetime.now(timezone.utc)
    with db.connect() as conn:
        conn.execute(
            """
            UPDATE stories
               SET brief             = ?,
                   angle             = ?,
                   key_facts         = ?,
                   brief_generated_at = ?
             WHERE id = ?
            """,
            (
                parsed.get("brief"),
                parsed.get("angle"),
                json.dumps(parsed.get("key_facts") or []),
                now,
                story_id,
            ),
        )
    log.info(
        "brief: story=%d %s",
        story_id, "(fallback)" if used_fallback else "ok",
    )


async def _process_story(client, model: str, story_id: int, srcmap: dict, sem: asyncio.Semaphore) -> str:
    async with sem:
        loaded = _load_story_with_members(story_id)
        if not loaded:
            return "missing"
        story, members = loaded
        if not members:
            return "no_members"

        prompt = _build_prompt(story, members, srcmap)
        try:
            text = await _call_claude(client, prompt, model)
        except Exception as e:
            log.warning("claude failed for story %d: %s — using fallback", story_id, e)
            _persist(story_id, _fallback_brief(members, srcmap), used_fallback=True)
            return "api_error_fallback"

        parsed = _parse_response(text)
        if parsed is None or not parsed.get("brief"):
            log.warning(
                "story %d: brief JSON parse failed; raw response (first 300 chars): %s",
                story_id, text[:300],
            )
            _persist(story_id, _fallback_brief(members, srcmap), used_fallback=True)
            return "parse_error_fallback"

        _persist(story_id, parsed, used_fallback=False)
        return "ok"


async def run(top_n: int | None = None) -> dict[str, int]:
    """Generate briefs for stories whose briefs are missing or stale.

    Skips silently with a log warning if ANTHROPIC_API_KEY is unset — that's
    the documented behavior (cards show "Brief pending" until a key is set).
    """
    if not os.environ.get("ANTHROPIC_API_KEY"):
        log.info("brief: ANTHROPIC_API_KEY not set, skipping")
        return {"brief_skipped_no_key": 1}

    from anthropic import AsyncAnthropic

    limit = top_n or config.TOP_N_FOR_BRIEFS
    candidates = _candidate_story_rows(limit)
    if not candidates:
        return {"brief_attempted": 0, "brief_ok": 0, "brief_fallback": 0}

    srcmap = by_id(load_sources())
    client = AsyncAnthropic()
    sem = asyncio.Semaphore(CONCURRENCY)

    results = await asyncio.gather(
        *(_process_story(client, config.CLAUDE_MODEL, c["id"], srcmap, sem) for c in candidates),
        return_exceptions=True,
    )

    counts = {"brief_attempted": len(candidates), "brief_ok": 0, "brief_fallback": 0, "brief_failed": 0}
    for r in results:
        if r == "ok":
            counts["brief_ok"] += 1
        elif r in ("api_error_fallback", "parse_error_fallback"):
            counts["brief_fallback"] += 1
        elif isinstance(r, Exception):
            counts["brief_failed"] += 1
            log.exception("brief: unhandled task exception", exc_info=r)
    log.info("brief: %s", counts)
    return counts
