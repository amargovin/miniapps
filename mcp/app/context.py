"""Per-request context, propagated into the (stateless) MCP tool functions.

The gateway sets `current_grant` (the verified group) and `usage_sink` per
request; handlers call `record_usage(...)` to attach detail the gateway writes
to usage_events. Context vars are isolated per asyncio task.
"""

from __future__ import annotations

from contextvars import ContextVar

from app.services.tokens import ClientContext

current_grant: ContextVar[ClientContext | None] = ContextVar("current_grant", default=None)

# A per-request scratch dict the handlers fill (tool name, token counts, source
# count); the gateway reads it afterwards and writes the usage_events row.
usage_sink: ContextVar[dict | None] = ContextVar("usage_sink", default=None)


def record_usage(**fields) -> None:
    """Called by handlers to attach detail to the current request's usage row."""
    sink = usage_sink.get()
    if sink is not None:
        sink.update({k: v for k, v in fields.items() if v is not None})
