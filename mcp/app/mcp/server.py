"""MCP server (the primary surface). Clients add the /mcp URL as a connector.

Tools return access-controlled, citation-ready SOURCE MATERIAL — the connecting
client's own model writes the answer. `ask_swarajya` additionally offers
server-side synthesis for connectors that want a finished answer.

Built on the stable FastMCP API (`mcp.server.fastmcp`). `stateless_http=True`
suits a horizontally-scaled HTTP deployment. The endpoint is served at the
absolute path "/mcp"; app/main.py mounts this sub-app at root so the connector
URL is exactly /mcp with no trailing-slash redirect.
"""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from app.context import record_usage
from app.runtime import get_orchestrator, get_settings

_hosts = [h.strip() for h in get_settings().mcp_allowed_hosts.split(",") if h.strip()]
_security = (
    TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=_hosts + ["localhost", "127.0.0.1"],
        allowed_origins=["*"],
    )
    if _hosts
    # Public token-authenticated server behind a proxy: the Host header is the
    # proxy's, not localhost, so DNS-rebinding protection only causes 421s.
    else TransportSecuritySettings(enable_dns_rebinding_protection=False)
)

mcp = FastMCP(
    "Swarajya",
    stateless_http=True,
    streamable_http_path="/mcp",
    transport_security=_security,
)


@mcp.tool()
async def search_swarajya(query: str, limit: int = 6) -> dict:
    """Search Swarajya's published archive and return cited source material.

    Use this to ground answers about what Swarajya has published. Returns a list
    of sources (headline, date, URL, summary, and body text for free articles).
    Premium/subscriber-only articles are returned as metadata + citation only,
    with no body text — cite them but do not infer their contents.
    """
    sources = await get_orchestrator().retrieve(query, limit=limit)
    record_usage(endpoint="search_swarajya", sources=len(sources))
    return {"sources": [s.model_dump() for s in sources]}


@mcp.tool()
async def ask_swarajya(query: str, limit: int = 6) -> dict:
    """Answer a question grounded strictly in Swarajya's published coverage.

    Returns a synthesized, cited answer plus the sources it used. Prefer
    `search_swarajya` if you want to reason over the raw sources yourself.
    Requires server-side synthesis to be configured (ANTHROPIC_API_KEY).
    """
    orch = get_orchestrator()
    sources = await orch.retrieve(query, limit=limit)
    if not orch.llm_enabled:
        record_usage(endpoint="ask_swarajya", sources=len(sources))
        return {
            "synthesis": None,
            "error": "server-side synthesis is not configured; use search_swarajya",
            "sources": [s.model_dump() for s in sources],
        }
    synthesis, usage = await orch.synthesize(query, sources)
    record_usage(
        endpoint="ask_swarajya",
        sources=len(sources),
        input_tokens=(usage or {}).get("input_tokens"),
        output_tokens=(usage or {}).get("output_tokens"),
    )
    return {"synthesis": synthesis, "sources": [s.model_dump() for s in sources]}


@mcp.tool()
async def get_swarajya_article(url_or_slug: str) -> dict:
    """Fetch one specific Swarajya article by its URL or slug.

    Use when the user references a particular Swarajya link/story. Returns the
    article with full body text (subject to access control — premium articles
    come back as metadata + citation only for non-entitled callers).
    """
    src = await get_orchestrator().get_article(url_or_slug)
    record_usage(endpoint="get_swarajya_article", sources=1 if src else 0)
    return {"article": src.model_dump() if src else None}


@mcp.tool()
async def latest_swarajya(limit: int = 8) -> dict:
    """The most recently published Swarajya articles (newest first)."""
    sources = await get_orchestrator().latest(limit)
    record_usage(endpoint="latest_swarajya", sources=len(sources))
    return {"sources": [s.model_dump() for s in sources]}


@mcp.tool()
async def breaking_swarajya(limit: int = 8) -> dict:
    """Swarajya's current breaking-news stories."""
    sources = await get_orchestrator().breaking(limit)
    record_usage(endpoint="breaking_swarajya", sources=len(sources))
    return {"sources": [s.model_dump() for s in sources]}


@mcp.tool()
async def trending_swarajya() -> dict:
    """Trending topics/tags on Swarajya right now (use a slug with swarajya_collection)."""
    tags = await get_orchestrator().trending()
    record_usage(endpoint="trending_swarajya")
    return {"tags": tags}


@mcp.tool()
async def swarajya_collection(slug: str, limit: int = 12) -> dict:
    """Articles in a Swarajya collection or section, by slug (e.g. "infrastructure").

    Section slugs work here too — Quintype exposes each section as a collection.
    Returns the collection's name/summary plus its articles (access-controlled).
    """
    result = await get_orchestrator().collection(slug, limit)
    if result is None:
        record_usage(endpoint="swarajya_collection", sources=0)
        return {"error": f"collection '{slug}' not found"}
    record_usage(endpoint="swarajya_collection", sources=len(result["sources"]))
    return {
        "name": result["name"],
        "summary": result["summary"],
        "sources": [s.model_dump() for s in result["sources"]],
    }


# --- IndiaBUILD federation (read-only re-export) ----------------------------
# When INDIABUILD_MCP_URL is set, the connector additionally serves the
# IndiaBUILD map's read tools: this server acts as an MCP *client* of that URL
# (app/clients/indiabuild.py), inheriting its suggest-only boundary by
# construction. Unset (the default) = pure Swarajya surface, nothing registered.
if get_settings().indiabuild_mcp_url:
    from app.mcp.indiabuild_tools import register_indiabuild_tools

    register_indiabuild_tools(mcp)
