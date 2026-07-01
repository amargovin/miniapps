"""Core orchestration — transport-agnostic. No FastAPI / MCP imports here.

Both adapters (REST router, MCP server) call into this. It composes Quintype
calls, enforces story-level access control, curates citation-ready context, and
(for the REST path) drives LLM synthesis.
"""

from __future__ import annotations

import asyncio
from urllib.parse import urlparse

from app.clients.llm import LLMClient
from app.clients.quintype import QuintypeClient
from app.config import Settings
from app.schemas import Source
from app.util import ms_to_date, strip_html


def slug_from(url_or_slug: str) -> str:
    """Accept a full Swarajya URL or a bare slug; return the slug path."""
    value = (url_or_slug or "").strip()
    if value.startswith(("http://", "https://")):
        return urlparse(value).path.strip("/")
    return value.strip("/")


def collection_stories(collection: dict, limit: int) -> list[dict]:
    """Pull story dicts out of a Quintype collection's `items` (which may nest)."""
    out: list[dict] = []
    for item in collection.get("items") or []:
        if not isinstance(item, dict):
            continue
        story = item.get("story") or (item if item.get("headline") else None)
        if story:
            out.append(story)
        if len(out) >= limit:
            break
    return out


def _is_premium(story: dict) -> bool:
    # Quintype marks gated content via `access` ("subscription") and/or an
    # access-level-value. Treat either as premium.
    return story.get("access") == "subscription" or story.get("access-level-value") is not None


def _extract_body(story: dict) -> str:
    parts: list[str] = []
    for card in story.get("cards") or []:
        for el in card.get("story-elements") or []:
            if el.get("type") == "text" and el.get("text"):
                parts.append(strip_html(el["text"]))
    return "\n\n".join(p for p in parts if p).strip()


class Orchestrator:
    def __init__(self, quintype: QuintypeClient, llm: LLMClient, settings: Settings):
        self._q = quintype
        self._llm = llm
        self._settings = settings

    async def aclose(self) -> None:
        await self._q.aclose()

    # --- retrieval -------------------------------------------------------

    async def retrieve(self, query: str, limit: int = 6) -> list[Source]:
        """Search, enrich the top results, and return sources with full body."""
        items = await self._q.advanced_search(query, limit=limit)
        items = items[: min(limit, self._settings.max_context_stories)]

        # Enrich each top hit with the full story (authoritative access + cards).
        stories = await asyncio.gather(
            *(self._q.get_story(item["id"]) for item in items)
        )

        sources: list[Source] = []
        for item, story in zip(items, stories):
            merged = {**item, **(story or {})}  # story (with cards) wins
            sources.append(self._build_source(merged))
        return sources

    def _build_source(self, story: dict) -> Source:
        body = _extract_body(story)
        return Source(
            id=str(story.get("id", "")),
            headline=story.get("headline") or "(untitled)",
            url=story.get("url") or "",
            slug=story.get("slug"),
            published_date=ms_to_date(story.get("published-at")),
            author=story.get("author-name"),
            summary=story.get("summary"),
            is_premium=_is_premium(story),  # informational only — body always served
            body=body or None,
        )

    # --- targeted retrieval ---------------------------------------------

    async def get_article(self, url_or_slug: str) -> Source | None:
        """Fetch one article by Swarajya URL or slug (full body)."""
        story = await self._q.get_story_by_slug(slug_from(url_or_slug))
        if story is None:
            return None
        return self._build_source(story)

    async def latest(self, limit: int = 8) -> list[Source]:
        items = await self._q.latest(limit)
        return [self._build_source(i) for i in items]

    async def breaking(self, limit: int = 8) -> list[Source]:
        items = await self._q.breaking(limit)
        return [self._build_source(i) for i in items]

    async def trending(self) -> list[dict]:
        tags = await self._q.trending_tags()
        return [
            {"name": t.get("name"), "slug": t.get("slug")}
            for t in tags
            if isinstance(t, dict) and t.get("name")
        ]

    async def collection(self, slug: str, limit: int = 12) -> dict | None:
        col = await self._q.collection(slug, limit)
        if col is None:
            return None
        stories = collection_stories(col, limit)
        return {
            "name": col.get("name"),
            "summary": col.get("summary"),
            "sources": [self._build_source(s) for s in stories],
        }

    # --- synthesis (REST path only) -------------------------------------

    @property
    def llm_enabled(self) -> bool:
        return self._llm.enabled

    async def synthesize(self, query: str, sources: list[Source]) -> tuple[str, dict | None]:
        """Return (answer, llm_usage). usage is None when no LLM call was made."""
        usable = [s for s in sources if s.body_available]
        if not usable:
            return (
                "Swarajya's published coverage in these sources does not contain "
                "enough material to answer this question.",
                None,
            )
        return await self._llm.synthesize(query, self._format_context(usable))

    @staticmethod
    def _format_context(sources: list[Source]) -> str:
        blocks = []
        for i, s in enumerate(sources, 1):
            blocks.append(
                f"[{i}] Headline: {s.headline}\n"
                f"Date: {s.published_date or 'unknown'}\n"
                f"URL: {s.url}\n"
                f"Body:\n{s.body}"
            )
        return "\n\n---\n\n".join(blocks)
