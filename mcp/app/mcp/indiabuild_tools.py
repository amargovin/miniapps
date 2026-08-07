"""Re-exported IndiaBUILD read tools (MCP federation).

When INDIABUILD_MCP_URL is set, the Swarajya connector also serves the
read-only surface of the IndiaBUILD MCP server (indiabuild.wiki): published
capability / builder / policy / investor / collection pages. Each tool below
proxies one upstream tool through app/clients/indiabuild.py.

IndiaBUILD's suggestion tools (propose_topic / suggest_page_edit) are
deliberately NOT re-exported: Swarajya subscribers are readers of the map, not
IndiaBUILD contributors — an org that should file suggestions gets the
IndiaBUILD connector URL directly. Keep this surface read-only.

The functions are module-level (not decorator closures) so tests can call them
directly; register_indiabuild_tools() attaches them to the FastMCP instance.
"""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

from app.context import record_usage
from app.runtime import get_indiabuild


def _args(**kwargs: Any) -> dict[str, Any]:
    return {k: v for k, v in kwargs.items() if v is not None}


def _count(result: Any) -> int | None:
    return len(result) if isinstance(result, list) else None


async def indiabuild_list_sectors() -> dict:
    """List IndiaBUILD's sectors (the ~22 front doors of India's industrial
    capability map) with per-sector counts of tracked capabilities."""
    result = await get_indiabuild().call_tool("list_sectors")
    record_usage(endpoint="indiabuild_list_sectors", sources=_count(result))
    return {"sectors": result}


async def indiabuild_search_capabilities(
    sector: str | None = None, q: str | None = None, limit: int = 50
) -> dict:
    """Search IndiaBUILD's published capability pages — the technologies /
    industrial gaps India is building (e.g. turbofans, lithography).

    Filter by sector = <slug from indiabuild_list_sectors> and/or q = <name
    substring>. Returns tile-level fields; use indiabuild_get_capability for
    the full record.
    """
    result = await get_indiabuild().call_tool(
        "search_capabilities", _args(sector=sector, q=q, limit=limit)
    )
    record_usage(endpoint="indiabuild_search_capabilities", sources=_count(result))
    return {"results": result}


async def indiabuild_get_capability(cap_id: str) -> dict:
    """Full IndiaBUILD capability record by slug (e.g. "high-bypass-turbofan"):
    article body, citations with verification verdicts, dependency stack,
    reverse links, the builders attempting it, targeting policies, and backing
    investors (relationship-only — who funds it, never how much)."""
    result = await get_indiabuild().call_tool("get_capability", {"cap_id": cap_id})
    record_usage(endpoint="indiabuild_get_capability", sources=1)
    return result


async def indiabuild_search_builders(q: str | None = None, limit: int = 50) -> dict:
    """Search IndiaBUILD's builder records — the companies / startups / labs /
    programmes attempting the mapped capabilities. Filter by q = <name
    substring>; use indiabuild_get_builder for the full record."""
    result = await get_indiabuild().call_tool("search_builders", _args(q=q, limit=limit))
    record_usage(endpoint="indiabuild_search_builders", sources=_count(result))
    return {"results": result}


async def indiabuild_get_builder(builder_id: str) -> dict:
    """Full IndiaBUILD builder record by slug (e.g. "agnikul-cosmos"): assessed
    and claimed stage (shown distinctly), capabilities attempted, policies it
    benefits from, and backing investors (relationship-only)."""
    result = await get_indiabuild().call_tool("get_builder", {"builder_id": builder_id})
    record_usage(endpoint="indiabuild_get_builder", sources=1)
    return result


async def indiabuild_search_policies(
    q: str | None = None, kind: str | None = None,
    sector: str | None = None, limit: int = 50,
) -> dict:
    """Search IndiaBUILD's policy records — government schemes, missions,
    tariffs and other instruments acting on the capability map.

    Filter by q = <name substring>, kind = <scheme|mission|tariff_measure|...>,
    or sector = <slug from indiabuild_list_sectors>. Use indiabuild_get_policy
    for the full record.
    """
    result = await get_indiabuild().call_tool(
        "search_policies", _args(q=q, kind=kind, sector=sector, limit=limit)
    )
    record_usage(endpoint="indiabuild_search_policies", sources=_count(result))
    return {"results": result}


async def indiabuild_get_policy(policy_id: str) -> dict:
    """Full IndiaBUILD policy record by slug: declared targets (with lever),
    beneficiary builders (assessed and claimed stage), and funded_capabilities —
    the derived set of capabilities its beneficiaries are attempting."""
    result = await get_indiabuild().call_tool("get_policy", {"policy_id": policy_id})
    record_usage(endpoint="indiabuild_get_policy", sources=1)
    return result


async def indiabuild_search_investors(
    q: str | None = None, kind: str | None = None,
    country: str | None = None, limit: int = 50,
) -> dict:
    """Search IndiaBUILD's investor records — the VCs / PE / angels / government
    funds / DFIs backing the builders (relationship-only: who funds what, never
    how much).

    Filter by q = <name substring>, kind = <vc|growth_pe|buyout_pe|angel|
    government_fund|dfi|corporate_vc|sovereign|family_office|
    accelerator_incubator>, or country = <HQ country, e.g. India>. Use
    indiabuild_get_investor for the full record.
    """
    result = await get_indiabuild().call_tool(
        "search_investors", _args(q=q, kind=kind, country=country, limit=limit)
    )
    record_usage(endpoint="indiabuild_search_investors", sources=_count(result))
    return {"results": result}


async def indiabuild_get_investor(investor_id: str) -> dict:
    """Full IndiaBUILD investor record by slug (e.g. "peak-xv-partners"):
    identity, portfolio of backed builders (with is_lead), and
    backed_capabilities — the derived footprint on the map. Relationship-only,
    no amounts."""
    result = await get_indiabuild().call_tool("get_investor", {"investor_id": investor_id})
    record_usage(endpoint="indiabuild_get_investor", sources=1)
    return result


async def indiabuild_list_collections() -> dict:
    """List IndiaBUILD's collections — curated cross-sector lenses over the map
    (e.g. "textile-industry", "mining"). Use indiabuild_get_collection for one
    collection's full contents."""
    result = await get_indiabuild().call_tool("list_collections")
    record_usage(endpoint="indiabuild_list_collections", sources=_count(result))
    return {"collections": result}


async def indiabuild_get_collection(collection_id: str) -> dict:
    """Full contents of one IndiaBUILD collection by slug: member capabilities
    plus the builders, policies and investors derived through their graph
    links."""
    result = await get_indiabuild().call_tool(
        "get_collection", {"collection_id": collection_id}
    )
    record_usage(endpoint="indiabuild_get_collection", sources=1)
    return result


READ_TOOLS = [
    indiabuild_list_sectors,
    indiabuild_search_capabilities,
    indiabuild_get_capability,
    indiabuild_search_builders,
    indiabuild_get_builder,
    indiabuild_search_policies,
    indiabuild_get_policy,
    indiabuild_search_investors,
    indiabuild_get_investor,
    indiabuild_list_collections,
    indiabuild_get_collection,
]


def register_indiabuild_tools(mcp: FastMCP) -> None:
    for fn in READ_TOOLS:
        mcp.tool()(fn)
