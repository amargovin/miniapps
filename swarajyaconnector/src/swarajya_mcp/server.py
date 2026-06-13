"""Swarajya MCP server.

Read-only access to the public Quintype Story API on swarajyamag.com.

Tools:
    swarajya_search_stories       — faceted search by query/section/author/tag/date
    swarajya_get_story            — full article by slug or ID, body as markdown
    swarajya_list_recent_stories  — recent stories with optional section filter
    swarajya_get_collection       — editorial collection (homepage rails, sections, magazine issues)
    swarajya_list_sections        — canonical section taxonomy
    swarajya_list_authors         — authors directory (paginated)
    swarajya_get_author           — author profile

Two transports are supported from the same code:
    stdio (default)               — for local Claude Desktop / Cowork install via .mcpb
    streamable-http               — for hosted org deployment behind a shared API key

Run modes:
    python -m swarajya_mcp.server              # stdio
    SWARAJYA_MCP_TRANSPORT=http \\
    SWARAJYA_MCP_API_KEY=... \\
    python -m swarajya_mcp.server              # HTTP on :8000
"""

from __future__ import annotations

import json
import logging
import os
import sys
from enum import Enum
from typing import Annotated, Any

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, ConfigDict, Field, field_validator

from . import __version__
from .client import SwarajyaAPIError, SwarajyaClient
from .cleaners import (
    trim_author,
    trim_collection,
    trim_section,
    trim_story_full,
    trim_story_summary,
)

logger = logging.getLogger("swarajya_mcp")

# ---------------------------------------------------------------------------
# Server & shared client
# ---------------------------------------------------------------------------

mcp = FastMCP("swarajya_mcp")

# A single AsyncClient is reused across tool calls — connection pooling matters
# on the HTTP transport where one server process handles many requests.
_client: SwarajyaClient | None = None


def _get_client() -> SwarajyaClient:
    global _client
    if _client is None:
        _client = SwarajyaClient()
    return _client


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


class ResponseFormat(str, Enum):
    JSON = "json"
    MARKDOWN = "markdown"


def _err(exc: Exception) -> str:
    """Render any exception as an actionable single-line error string."""
    if isinstance(exc, SwarajyaAPIError):
        if exc.status_code == 404:
            return f"Error: not found ({exc.url}). Check the slug / ID is correct and live on swarajyamag.com."
        if exc.status_code == 429:
            return "Error: rate limited by swarajyamag.com. Wait a few seconds and retry."
        if exc.status_code >= 500:
            return f"Error: upstream server error ({exc.status_code}). The site may be having trouble."
        return f"Error: {exc}"
    return f"Error: {type(exc).__name__}: {exc}"


def _dump(payload: Any) -> str:
    return json.dumps(payload, indent=2, ensure_ascii=False, default=str)


async def _resolve_section_id(section_slug: str | None) -> int | None:
    """Map a section slug like 'politics' to its numeric section-id."""
    if not section_slug:
        return None
    config = await _get_client().config()
    for s in config.get("sections") or []:
        if s.get("slug") == section_slug:
            return s.get("id")
    return None


# ---------------------------------------------------------------------------
# Input models
# ---------------------------------------------------------------------------


class SearchInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    query: str | None = Field(
        default=None,
        description="Free-text search query. Leave empty to filter by section/author/tag only.",
        max_length=300,
    )
    section: str | None = Field(
        default=None,
        description=(
            "Section slug to scope the search to, e.g. 'politics', 'economy', 'defence', "
            "'world', 'culture', 'books'. Call swarajya_list_sections to see all options."
        ),
        max_length=80,
    )
    author_id: int | None = Field(
        default=None,
        description="Numeric author ID. Resolve names via swarajya_list_authors.",
        ge=1,
    )
    tag: str | None = Field(
        default=None,
        description="Tag name to filter by, e.g. 'Narendra Modi', 'Pakistan', 'RBI'.",
        max_length=120,
    )
    story_template: str | None = Field(
        default=None,
        description=(
            "Quintype story template, e.g. 'news-elsewhere', 'video', 'photo', 'text', "
            "'live-blog'. Leave empty for all."
        ),
        max_length=40,
    )
    published_after: int | None = Field(
        default=None,
        description="Unix epoch milliseconds — only stories published at or after this instant.",
        ge=0,
    )
    published_before: int | None = Field(
        default=None,
        description="Unix epoch milliseconds — only stories published at or before this instant.",
        ge=0,
    )
    sort: str = Field(
        default="latest-published",
        description="'latest-published' (default) or 'oldest-published' or 'relevance'.",
    )
    limit: int = Field(default=20, description="Max results to return.", ge=1, le=50)
    offset: int = Field(default=0, description="Skip this many results for pagination.", ge=0)
    response_format: ResponseFormat = Field(
        default=ResponseFormat.JSON,
        description="'json' for structured data, 'markdown' for a human-readable summary.",
    )

    @field_validator("sort")
    @classmethod
    def _sort_choices(cls, v: str) -> str:
        allowed = {"latest-published", "oldest-published", "relevance"}
        if v not in allowed:
            raise ValueError(f"sort must be one of {sorted(allowed)}")
        return v


class GetStoryInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    slug: str | None = Field(
        default=None,
        description=(
            "Article slug, including the section prefix as shown in the URL — e.g. "
            "'defence/1971-war-how-a-photograph-and-a-bbc-report-hastened-pakistans-surrender'. "
            "Either slug or story_id must be provided."
        ),
        max_length=400,
    )
    story_id: str | None = Field(
        default=None,
        description="Quintype content ID (UUID). Use if you have the ID instead of a slug.",
        max_length=64,
    )
    include_body: bool = Field(
        default=True,
        description="Set false to skip the rendered markdown body and return only metadata.",
    )
    response_format: ResponseFormat = Field(default=ResponseFormat.JSON)


class ListRecentInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    section: str | None = Field(
        default=None,
        description="Section slug, e.g. 'politics'. Leave empty for site-wide latest.",
        max_length=80,
    )
    story_template: str | None = Field(
        default=None,
        description="Filter by Quintype story template (news-elsewhere, photo, video, etc.).",
        max_length=40,
    )
    limit: int = Field(default=20, ge=1, le=50)
    offset: int = Field(default=0, ge=0)
    response_format: ResponseFormat = Field(default=ResponseFormat.JSON)


class GetCollectionInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    slug: str = Field(
        ...,
        description=(
            "Collection slug. Examples: 'politics', 'economy', 'home' for the homepage rail, "
            "magazine issue slugs like 'delimitation'."
        ),
        min_length=1,
        max_length=120,
    )
    limit: int = Field(default=20, ge=1, le=50)
    item_type: str | None = Field(
        default=None,
        description="Optional filter — 'story' or 'collection'.",
    )
    response_format: ResponseFormat = Field(default=ResponseFormat.JSON)


class ListAuthorsInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    query: str | None = Field(
        default=None,
        description=(
            "Optional case-insensitive substring filter on author name. "
            "Applied client-side after fetching the page."
        ),
        max_length=120,
    )
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    response_format: ResponseFormat = Field(default=ResponseFormat.JSON)


class GetAuthorInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    author_id: int = Field(..., description="Numeric author ID.", ge=1)
    include_recent_stories: bool = Field(
        default=True,
        description="If true, also fetch up to 10 of the author's most recent stories.",
    )
    response_format: ResponseFormat = Field(default=ResponseFormat.JSON)


class ListSectionsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    response_format: ResponseFormat = Field(default=ResponseFormat.JSON)


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


@mcp.tool(
    name="swarajya_search_stories",
    annotations={
        "title": "Search Swarajya articles",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def swarajya_search_stories(params: SearchInput) -> str:
    """Search published Swarajya articles by free-text query and/or filters.

    Use this as the default discovery tool. Combine `query` with `section`,
    `author_id`, `tag`, or date bounds to narrow results. Returns a paginated
    list of compact story summaries; pass an interesting slug into
    `swarajya_get_story` to read the full piece.

    Returns JSON:
        {
            "total": int,
            "count": int,
            "offset": int,
            "has_more": bool,
            "next_offset": int | null,
            "items": [
                {id, headline, subheadline, slug, url, author, author_id,
                 sections: [{name, slug, id}], published_at, last_published_at,
                 story_template, read_time, word_count}
            ]
        }
    """
    try:
        data = await _get_client().advanced_search(
            q=params.query,
            section=params.section,
            author_id=params.author_id,
            tag=params.tag,
            story_template=params.story_template,
            published_after=params.published_after,
            published_before=params.published_before,
            limit=params.limit,
            offset=params.offset,
            sort=params.sort,
        )
    except Exception as exc:
        return _err(exc)

    items_raw = data.get("items") or []
    items = [trim_story_summary(s) for s in items_raw]
    total = int(data.get("total") or 0)
    next_offset = params.offset + len(items) if total > params.offset + len(items) else None

    payload = {
        "total": total,
        "count": len(items),
        "offset": params.offset,
        "has_more": next_offset is not None,
        "next_offset": next_offset,
        "items": items,
    }

    if params.response_format is ResponseFormat.MARKDOWN:
        return _stories_markdown(f"Search results", payload)
    return _dump(payload)


@mcp.tool(
    name="swarajya_get_story",
    annotations={
        "title": "Fetch a Swarajya article",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def swarajya_get_story(params: GetStoryInput) -> str:
    """Fetch a single Swarajya article in full.

    Provide either `slug` (preferred — what appears in the article URL after
    swarajyamag.com/) or `story_id` (Quintype UUID). The response includes
    metadata, hero image, tags, and the article body rendered as clean
    markdown ready to quote or summarize.

    Returns JSON:
        {
            id, headline, subheadline, slug, url,
            author, author_id,
            sections: [{name, slug, id}],
            tags: [str],
            published_at, last_published_at,
            story_template, read_time, word_count,
            seo: {title, description},
            hero_image: {url, caption, attribution, width, height} | null,
            body_markdown: str
        }
    """
    if not params.slug and not params.story_id:
        return "Error: provide either `slug` or `story_id`."

    try:
        if params.slug:
            data = await _get_client().story_by_slug(params.slug)
        else:
            data = await _get_client().story_by_id(params.story_id)  # type: ignore[arg-type]
    except Exception as exc:
        return _err(exc)

    story = data.get("story") or {}
    if not story:
        return "Error: story not found."

    trimmed = trim_story_full(story)
    if not params.include_body:
        trimmed.pop("body_markdown", None)

    if params.response_format is ResponseFormat.MARKDOWN:
        return _story_markdown(trimmed)
    return _dump(trimmed)


@mcp.tool(
    name="swarajya_list_recent_stories",
    annotations={
        "title": "List recent Swarajya stories",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def swarajya_list_recent_stories(params: ListRecentInput) -> str:
    """List the most recently published stories, optionally scoped to a section.

    Cheaper and simpler than swarajya_search_stories — use this when you just
    want "what has Swarajya published lately?" without a search query. Same
    response shape as search.
    """
    try:
        section_id = await _resolve_section_id(params.section) if params.section else None
        if params.section and section_id is None:
            return f"Error: section '{params.section}' not found. Call swarajya_list_sections."
        data = await _get_client().stories(
            limit=params.limit,
            offset=params.offset,
            section_id=section_id,
            story_template=params.story_template,
        )
    except Exception as exc:
        return _err(exc)

    items_raw = data.get("stories") or []
    items = [trim_story_summary(s) for s in items_raw]
    payload = {
        "count": len(items),
        "offset": params.offset,
        "section": params.section,
        "items": items,
    }
    if params.response_format is ResponseFormat.MARKDOWN:
        return _stories_markdown(f"Recent stories — {params.section or 'all sections'}", payload)
    return _dump(payload)


@mcp.tool(
    name="swarajya_get_collection",
    annotations={
        "title": "Fetch a Swarajya editorial collection",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def swarajya_get_collection(params: GetCollectionInput) -> str:
    """Fetch an editorial collection by slug.

    Collections power section landing pages, the homepage rail, magazine issues,
    and curated bundles. Items can be stories or nested sub-collections.
    """
    try:
        data = await _get_client().collection(
            params.slug, limit=params.limit, item_type=params.item_type
        )
    except Exception as exc:
        return _err(exc)

    payload = trim_collection(data)
    if params.response_format is ResponseFormat.MARKDOWN:
        return _collection_markdown(payload)
    return _dump(payload)


@mcp.tool(
    name="swarajya_list_sections",
    annotations={
        "title": "List Swarajya sections",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def swarajya_list_sections(params: ListSectionsInput) -> str:
    """Return the canonical list of sections on swarajyamag.com.

    Use this to discover valid `section` slugs for swarajya_search_stories
    and swarajya_list_recent_stories, and to map section names ↔ IDs.
    """
    try:
        cfg = await _get_client().config()
    except Exception as exc:
        return _err(exc)

    sections = [trim_section(s) for s in (cfg.get("sections") or [])]
    payload = {"count": len(sections), "sections": sections}
    if params.response_format is ResponseFormat.MARKDOWN:
        lines = ["# Swarajya sections", ""]
        for s in sections:
            parent = f" (parent: {s['parent_id']})" if s.get("parent_id") else ""
            lines.append(f"- **{s['name']}** — `{s['slug']}` (id {s['id']}){parent}")
        return "\n".join(lines)
    return _dump(payload)


@mcp.tool(
    name="swarajya_list_authors",
    annotations={
        "title": "List Swarajya authors",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def swarajya_list_authors(params: ListAuthorsInput) -> str:
    """List authors with optional name substring filtering and pagination.

    Quintype's `/authors` endpoint doesn't expose server-side name search, so
    `query` filters the fetched page client-side. For uncommon names you may
    need to paginate.
    """
    try:
        data = await _get_client().authors(limit=params.limit, offset=params.offset)
    except Exception as exc:
        return _err(exc)

    authors = [trim_author(a) for a in (data.get("authors") or [])]
    if params.query:
        q = params.query.lower()
        authors = [a for a in authors if a.get("name") and q in a["name"].lower()]

    page = data.get("page") or {}
    total = int(page.get("total") or 0)
    next_offset = params.offset + (page.get("limit") or params.limit)
    if next_offset >= total:
        next_offset = None

    payload = {
        "total": total,
        "count": len(authors),
        "offset": params.offset,
        "has_more": next_offset is not None,
        "next_offset": next_offset,
        "authors": authors,
    }
    if params.response_format is ResponseFormat.MARKDOWN:
        lines = [f"# Authors ({total} total, showing {len(authors)})", ""]
        for a in authors:
            lines.append(f"- **{a['name']}** — `{a['slug']}` (id {a['id']})")
        return "\n".join(lines)
    return _dump(payload)


@mcp.tool(
    name="swarajya_get_author",
    annotations={
        "title": "Fetch a Swarajya author profile",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def swarajya_get_author(params: GetAuthorInput) -> str:
    """Fetch an author profile by numeric ID, optionally with recent stories.

    Recent stories are pulled via advanced-search filtered to this author_id.
    """
    try:
        author_data = await _get_client().author(params.author_id)
    except Exception as exc:
        return _err(exc)

    author = author_data.get("author") or author_data
    payload: dict[str, Any] = {"author": trim_author(author)}

    if params.include_recent_stories:
        try:
            search = await _get_client().advanced_search(
                author_id=params.author_id, limit=10, sort="latest-published"
            )
            payload["recent_stories"] = [
                trim_story_summary(s) for s in (search.get("items") or [])
            ]
        except Exception as exc:
            payload["recent_stories_error"] = _err(exc)

    if params.response_format is ResponseFormat.MARKDOWN:
        a = payload["author"]
        lines = [f"# {a['name']}", "", f"- Slug: `{a['slug']}`", f"- ID: {a['id']}"]
        if a.get("twitter_handle"):
            lines.append(f"- Twitter: @{a['twitter_handle']}")
        if a.get("bio"):
            lines.extend(["", a["bio"]])
        if payload.get("recent_stories"):
            lines.extend(["", "## Recent stories", ""])
            for s in payload["recent_stories"]:
                lines.append(f"- [{s['headline']}]({s['url']}) — {s.get('published_at')}")
        return "\n".join(lines)
    return _dump(payload)


# ---------------------------------------------------------------------------
# Markdown formatters (shared)
# ---------------------------------------------------------------------------


def _stories_markdown(title: str, payload: dict[str, Any]) -> str:
    lines = [f"# {title}", ""]
    total = payload.get("total")
    if total is not None:
        lines.append(f"_{total} total · showing {payload.get('count', 0)} from offset {payload.get('offset', 0)}_")
        lines.append("")
    for s in payload.get("items") or []:
        sections = ", ".join(x["name"] for x in s.get("sections") or [] if x.get("name"))
        lines.append(f"## [{s['headline']}]({s['url']})")
        if s.get("subheadline"):
            lines.append(f"_{s['subheadline']}_")
        lines.append(
            f"- By **{s.get('author') or 'Unknown'}** · {sections or 'no section'} · {s.get('published_at') or ''}"
        )
        lines.append(f"- Slug: `{s['slug']}`")
        lines.append("")
    if payload.get("has_more"):
        lines.append(f"_More results available — re-call with offset={payload.get('next_offset')}_")
    return "\n".join(lines)


def _story_markdown(story: dict[str, Any]) -> str:
    lines = [f"# {story['headline']}"]
    if story.get("subheadline"):
        lines.append(f"_{story['subheadline']}_")
    lines.append("")
    sections = ", ".join(x["name"] for x in story.get("sections") or [] if x.get("name"))
    lines.append(
        f"By **{story.get('author') or 'Unknown'}** · {sections} · {story.get('published_at') or ''}"
    )
    if story.get("tags"):
        lines.append(f"Tags: {', '.join(story['tags'])}")
    lines.append(f"Source: {story.get('url')}")
    lines.append("")
    hero = story.get("hero_image")
    if hero and hero.get("url"):
        lines.append(f"![hero]({hero['url']})")
        if hero.get("caption"):
            lines.append(f"*{hero['caption']}*")
        lines.append("")
    if story.get("body_markdown"):
        lines.append(story["body_markdown"])
    return "\n".join(lines)


def _collection_markdown(coll: dict[str, Any]) -> str:
    lines = [f"# {coll.get('name') or coll.get('slug')}", ""]
    if coll.get("summary"):
        lines.append(coll["summary"])
        lines.append("")
    for item in coll.get("items") or []:
        if item["type"] == "story":
            s = item["story"]
            lines.append(f"- [{s['headline']}]({s['url']}) — {s.get('author')}")
        else:
            lines.append(f"- _Collection_: **{item.get('name')}** (`{item.get('slug')}`)")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Entrypoint with dual transport
# ---------------------------------------------------------------------------


def _build_http_app() -> Any:
    """Wrap FastMCP's streamable-http app with a shared-key auth middleware
    and a `/health` endpoint for platform healthchecks (Railway, etc.).

    Set SWARAJYA_MCP_API_KEY to require `Authorization: Bearer <key>` (or
    `X-API-Key: <key>`) on the /mcp endpoint. If unset, the server runs open
    — fine for localhost / private networks, not for the public internet.
    """
    from starlette.applications import Starlette
    from starlette.middleware import Middleware
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.responses import JSONResponse
    from starlette.routing import Route

    expected_key = os.environ.get("SWARAJYA_MCP_API_KEY")
    unauth_paths = {"/", "/health"}

    class APIKeyMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            if expected_key is None or request.url.path in unauth_paths:
                return await call_next(request)
            auth = request.headers.get("authorization", "")
            x_key = request.headers.get("x-api-key", "")
            token = auth.removeprefix("Bearer ").strip() if auth.lower().startswith("bearer ") else ""
            if token != expected_key and x_key != expected_key:
                return JSONResponse({"error": "unauthorized"}, status_code=401)
            return await call_next(request)

    async def health(_request):
        return JSONResponse({"status": "ok", "service": "swarajya_mcp", "version": __version__})

    async def root(_request):
        return JSONResponse(
            {
                "service": "swarajya_mcp",
                "version": __version__,
                "mcp_endpoint": "/mcp",
                "auth": "required" if expected_key else "open",
            }
        )

    mcp_app = mcp.streamable_http_app()
    routes = [Route("/", root), Route("/health", health), *list(mcp_app.routes)]
    return Starlette(
        routes=routes,
        middleware=[Middleware(APIKeyMiddleware)],
        lifespan=mcp_app.router.lifespan_context,
    )


def main() -> None:
    """CLI entrypoint — selects transport from SWARAJYA_MCP_TRANSPORT env."""
    transport = os.environ.get("SWARAJYA_MCP_TRANSPORT", "stdio").lower()
    log_level = os.environ.get("SWARAJYA_MCP_LOG_LEVEL", "INFO").upper()
    logging.basicConfig(level=log_level, stream=sys.stderr, format="%(levelname)s %(name)s: %(message)s")

    if transport in {"stdio", "stdin"}:
        logger.info("Starting swarajya_mcp v%s on stdio", __version__)
        mcp.run()
        return

    if transport in {"http", "streamable-http", "streamable_http"}:
        import uvicorn

        host = os.environ.get("SWARAJYA_MCP_HOST", "127.0.0.1")
        # Most container hosts (Railway, Cloud Run, Render) inject $PORT.
        # SWARAJYA_MCP_PORT overrides it for local runs.
        port = int(
            os.environ.get("SWARAJYA_MCP_PORT")
            or os.environ.get("PORT")
            or "8000"
        )
        logger.info("Starting swarajya_mcp v%s on http://%s:%s/mcp", __version__, host, port)
        if not os.environ.get("SWARAJYA_MCP_API_KEY"):
            logger.warning(
                "SWARAJYA_MCP_API_KEY is unset — the HTTP endpoint is unauthenticated. "
                "Set it before exposing this server beyond localhost."
            )
        uvicorn.run(_build_http_app(), host=host, port=port, log_level=log_level.lower())
        return

    raise SystemExit(
        f"Unknown SWARAJYA_MCP_TRANSPORT={transport!r}. Use 'stdio' or 'http'."
    )


if __name__ == "__main__":
    main()
