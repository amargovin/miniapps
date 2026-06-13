"""Thin async client for the Quintype public Story API on swarajyamag.com.

Only read-only endpoints are wrapped here. All calls go through a single shared
httpx.AsyncClient with sensible timeouts and a friendly User-Agent so the
Quintype edge can identify and rate-limit us cleanly.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

DEFAULT_BASE_URL = os.environ.get("SWARAJYA_BASE_URL", "https://swarajyamag.com")
DEFAULT_TIMEOUT = float(os.environ.get("SWARAJYA_TIMEOUT", "20"))
DEFAULT_USER_AGENT = os.environ.get(
    "SWARAJYA_USER_AGENT",
    "swarajya-mcp/0.1 (+https://swarajyamag.com)",
)


class SwarajyaAPIError(RuntimeError):
    """Raised for non-2xx responses from the Quintype API."""

    def __init__(self, status_code: int, message: str, url: str):
        super().__init__(f"[{status_code}] {message} ({url})")
        self.status_code = status_code
        self.url = url


class SwarajyaClient:
    """Async wrapper around the Quintype public read API.

    Endpoints used (all GET):
        /api/v1/config
        /api/v1/stories
        /api/v1/stories-by-slug
        /api/v1/stories/{id}
        /api/v1/advanced-search
        /api/v1/search
        /api/v1/authors
        /api/v1/authors/{id}
        /api/v1/collections/{slug}
    """

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        user_agent: str = DEFAULT_USER_AGENT,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=timeout,
            headers={"User-Agent": user_agent, "Accept": "application/json"},
            follow_redirects=True,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "SwarajyaClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.aclose()

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        try:
            response = await self._client.get(path, params=params or {})
        except httpx.TimeoutException as exc:
            raise SwarajyaAPIError(0, f"Request timed out: {exc}", path) from exc
        except httpx.HTTPError as exc:
            raise SwarajyaAPIError(0, f"Network error: {exc}", path) from exc

        if response.status_code >= 400:
            snippet = response.text[:200].replace("\n", " ")
            raise SwarajyaAPIError(response.status_code, snippet, str(response.request.url))

        try:
            return response.json()
        except ValueError as exc:
            raise SwarajyaAPIError(
                response.status_code,
                f"Non-JSON response: {response.text[:200]!r}",
                str(response.request.url),
            ) from exc

    # ---- High-level endpoints --------------------------------------------------

    async def config(self) -> dict[str, Any]:
        """Site config — includes the canonical list of sections."""
        return await self._get("/api/v1/config")

    async def stories(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        section_id: int | None = None,
        story_template: str | None = None,
        fields: str | None = None,
    ) -> dict[str, Any]:
        """List recent published stories with optional section/template filters."""
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if section_id is not None:
            params["section-id"] = section_id
        if story_template:
            params["story-template"] = story_template
        if fields:
            params["fields"] = fields
        return await self._get("/api/v1/stories", params)

    async def story_by_slug(self, slug: str) -> dict[str, Any]:
        """Full story including body cards/story-elements."""
        return await self._get("/api/v1/stories-by-slug", {"slug": slug})

    async def story_by_id(self, story_id: str) -> dict[str, Any]:
        """Full story by content ID."""
        return await self._get(f"/api/v1/stories/{story_id}")

    async def advanced_search(
        self,
        *,
        q: str | None = None,
        section: str | None = None,
        author_id: int | None = None,
        tag: str | None = None,
        story_template: str | None = None,
        published_after: int | None = None,
        published_before: int | None = None,
        limit: int = 20,
        offset: int = 0,
        sort: str = "latest-published",
        fields: str | None = None,
    ) -> dict[str, Any]:
        """Faceted search across all stories.

        Returns {total, items, aggregations}. Quintype supports a rich filter
        surface; the few we expose here cover ~all real query patterns.
        """
        params: dict[str, Any] = {"limit": limit, "offset": offset, "sort": sort}
        if q:
            params["q"] = q
        if section:
            params["section"] = section
        if author_id is not None:
            params["author-id"] = author_id
        if tag:
            params["tag"] = tag
        if story_template:
            params["story-template"] = story_template
        if published_after is not None:
            params["published-after"] = published_after
        if published_before is not None:
            params["published-before"] = published_before
        if fields:
            params["fields"] = fields
        return await self._get("/api/v1/advanced-search", params)

    async def authors(self, *, limit: int = 20, offset: int = 0) -> dict[str, Any]:
        """Paginated list of authors."""
        return await self._get("/api/v1/authors", {"limit": limit, "offset": offset})

    async def author(self, author_id: int) -> dict[str, Any]:
        """Author profile by numeric ID."""
        return await self._get(f"/api/v1/authors/{author_id}")

    async def collection(
        self,
        slug: str,
        *,
        limit: int = 20,
        item_type: str | None = None,
    ) -> dict[str, Any]:
        """Editorial collection by slug (homepage rails, magazine issues, sections)."""
        params: dict[str, Any] = {"limit": limit}
        if item_type:
            params["item-type"] = item_type
        return await self._get(f"/api/v1/collections/{slug}", params)
