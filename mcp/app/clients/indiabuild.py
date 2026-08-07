"""MCP client for the IndiaBUILD connector — this server consumes another MCP
server here (MCP federation), not a REST API.

Why the connector URL and not IndiaBUILD's operator API: the connector is
IndiaBUILD's deliberately narrowed, suggest-only surface (published-map reads
only — no spending/enqueue routes; see its mcp/server.py header). Consuming it
means this server inherits that boundary by construction and never holds the
IndiaBUILD API token; the URL (with its secret path) is the only credential.

Each call opens a fresh session (connect → initialize → call_tool → close).
That costs a couple of extra HTTP round-trips per call, but the SDK's
streamablehttp_client is an anyio-scoped context manager that must enter and
exit in the same asyncio task — which rules out one long-lived session shared
across request tasks — and a per-call session is self-healing by definition.
Both ends are stateless-HTTP, so the handshake is cheap.
"""

from __future__ import annotations

import json
from typing import Any

from mcp import ClientSession, types
from mcp.client.streamable_http import streamablehttp_client

from app.config import Settings


class IndiaBuildError(RuntimeError):
    """An upstream tool call failed (isError result or transport failure)."""


class IndiaBuildClient:
    def __init__(self, settings: Settings) -> None:
        self._url = settings.indiabuild_mcp_url
        self._timeout = settings.request_timeout

    @property
    def enabled(self) -> bool:
        return bool(self._url)

    async def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        """Call one IndiaBUILD tool and return its decoded JSON payload."""
        if not self._url:
            raise IndiaBuildError("INDIABUILD_MCP_URL is not configured")
        async with streamablehttp_client(self._url, timeout=self._timeout) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool(name, arguments or {})
        return unwrap(result)


def unwrap(result: types.CallToolResult) -> Any:
    """Extract the JSON value from a CallToolResult.

    Prefers structuredContent — unwrapping FastMCP's {"result": ...} envelope
    around non-object returns — and falls back to parsing the text content.
    """
    texts = [b.text for b in result.content if isinstance(b, types.TextContent)]
    if result.isError:
        raise IndiaBuildError("; ".join(texts) or "IndiaBUILD tool call failed")
    sc = result.structuredContent
    if sc is not None:
        if isinstance(sc, dict) and set(sc) == {"result"}:
            return sc["result"]
        return sc
    joined = "\n".join(texts)
    try:
        return json.loads(joined)
    except ValueError:
        return joined
