"""IndiaBUILD federation: result unwrapping + re-exported tool wrappers."""

from __future__ import annotations

import pytest
from mcp import types

from app.clients.indiabuild import IndiaBuildError, unwrap
from app.mcp import indiabuild_tools


def _result(text: str = "", structured: dict | None = None, is_error: bool = False):
    content = [types.TextContent(type="text", text=text)] if text else []
    return types.CallToolResult(
        content=content, structuredContent=structured, isError=is_error
    )


def test_unwrap_prefers_structured_and_strips_result_envelope():
    assert unwrap(_result(structured={"result": [1, 2]})) == [1, 2]
    assert unwrap(_result(structured={"id": "x", "result": "y"})) == {"id": "x", "result": "y"}


def test_unwrap_falls_back_to_text_json():
    assert unwrap(_result(text='[{"id": "a"}]')) == [{"id": "a"}]
    assert unwrap(_result(text="plain text")) == "plain text"


def test_unwrap_raises_on_error_result():
    with pytest.raises(IndiaBuildError, match="404"):
        unwrap(_result(text="GET /builders/x -> HTTP 404: not found", is_error=True))


class FakeIB:
    """Records the upstream tool call and returns a canned payload."""

    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    async def call_tool(self, name, arguments=None):
        self.calls.append((name, arguments or {}))
        return self.payload


async def test_search_wrapper_drops_none_args_and_wraps_results(monkeypatch):
    fake = FakeIB([{"id": "agnikul-cosmos"}])
    monkeypatch.setattr(indiabuild_tools, "get_indiabuild", lambda: fake)
    out = await indiabuild_tools.indiabuild_search_builders(q="agni")
    assert fake.calls == [("search_builders", {"q": "agni", "limit": 50})]
    assert out == {"results": [{"id": "agnikul-cosmos"}]}


async def test_get_wrapper_passes_slug_and_returns_record(monkeypatch):
    fake = FakeIB({"id": "pli-scheme", "targets": []})
    monkeypatch.setattr(indiabuild_tools, "get_indiabuild", lambda: fake)
    out = await indiabuild_tools.indiabuild_get_policy("pli-scheme")
    assert fake.calls == [("get_policy", {"policy_id": "pli-scheme"})]
    assert out["id"] == "pli-scheme"


def test_only_read_tools_are_re_exported():
    names = {fn.__name__ for fn in indiabuild_tools.READ_TOOLS}
    assert len(names) == 11
    assert not any("propose" in n or "suggest" in n for n in names)
