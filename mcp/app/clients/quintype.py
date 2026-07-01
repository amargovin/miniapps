"""Quintype API client. Knows how to talk to ONE external service.

Authoritative reference for endpoints/params/shapes:
    https://quintype-demo.quintype.io/swagger.json
"""

from __future__ import annotations

import logging

import httpx

from app.config import Settings

log = logging.getLogger(__name__)

# Fields we need from advanced-search; keeps the payload small. Quintype ignores
# unknown field names rather than erroring, so this is safe to tune.
_SEARCH_FIELDS = (
    "id,headline,slug,url,summary,access,access-level-value,"
    "published-at,author-name,sections"
)


class QuintypeClient:
    def __init__(self, settings: Settings):
        self._base = settings.quintype_base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base,
            timeout=settings.request_timeout,
            headers={"Accept": "application/json"},
            follow_redirects=True,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def advanced_search(
        self, query: str | None = None, limit: int = 6, sort: str | None = None
    ) -> list[dict]:
        """Primary retrieval. Returns the `items` array (story dicts).

        `sort="latest-published"` returns newest-first; `query=None` browses
        without a keyword (used by the `latest` helper)."""
        params: dict = {"limit": limit, "fields": _SEARCH_FIELDS}
        if query:
            params["q"] = query
        if sort:
            params["sort"] = sort
        resp = await self._client.get("/api/v1/advanced-search", params=params)
        resp.raise_for_status()
        return resp.json().get("items", [])

    async def get_story(self, story_id: str) -> dict | None:
        """Full story with cards + authoritative access level. None on failure."""
        try:
            resp = await self._client.get(f"/api/v1/stories/{story_id}")
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            log.warning("get_story(%s) failed: %s", story_id, exc)
            return None
        data = resp.json()
        # Endpoint returns {"story": {...}}; tolerate a bare story too.
        return data.get("story", data)

    async def get_story_by_slug(self, slug: str) -> dict | None:
        """Full story (with cards) by slug. None on failure."""
        try:
            resp = await self._client.get("/api/v1/stories-by-slug", params={"slug": slug})
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            log.warning("get_story_by_slug(%s) failed: %s", slug, exc)
            return None
        return resp.json().get("story")

    async def latest(self, limit: int = 8) -> list[dict]:
        return await self.advanced_search(limit=limit, sort="latest-published")

    async def breaking(self, limit: int = 8) -> list[dict]:
        try:
            resp = await self._client.get("/api/v1/breaking-news")
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            log.warning("breaking failed: %s", exc)
            return []
        return (resp.json().get("stories") or [])[:limit]

    async def trending_tags(self) -> list[dict]:
        try:
            resp = await self._client.get("/api/v1/trending/tags")
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            log.warning("trending_tags failed: %s", exc)
            return []
        return resp.json().get("tags") or []

    async def collection(self, slug: str, limit: int = 12) -> dict | None:
        """A curated/automated collection (also a section, by section slug)."""
        try:
            resp = await self._client.get(
                f"/api/v1/collections/{slug}", params={"item-limit": limit}
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            log.warning("collection(%s) failed: %s", slug, exc)
            return None
        return resp.json()
