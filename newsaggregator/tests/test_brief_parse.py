"""Brief response parsing + fallback tests (brief §20 priority test)."""
from app.enrich.brief import _fallback_brief, _parse_response
from app.sources import Source


def _src(id_, tier):
    return Source(id=id_, name=f"src-{id_}", type="rss", url="x",
                  beats=("politics",), tier=tier, fetch_interval_min=15)


def test_parses_clean_json():
    raw = '{"brief": "X happened.", "angle": "Y matters.", "key_facts": ["A", "B"]}'
    out = _parse_response(raw)
    assert out is not None
    assert out["brief"] == "X happened."
    assert out["angle"] == "Y matters."
    assert out["key_facts"] == ["A", "B"]


def test_strips_code_fence():
    raw = '```json\n{"brief": "X.", "angle": "Y.", "key_facts": []}\n```'
    out = _parse_response(raw)
    assert out is not None
    assert out["brief"] == "X."


def test_returns_none_on_garbage():
    assert _parse_response("nonsense not even json") is None
    assert _parse_response("") is None


def test_returns_none_on_non_dict():
    assert _parse_response('["not", "a", "dict"]') is None


def test_caps_key_facts_at_five():
    raw = '{"brief": "X.", "angle": "Y.", "key_facts": ["1","2","3","4","5","6","7"]}'
    out = _parse_response(raw)
    assert out["key_facts"] == ["1", "2", "3", "4", "5"]


def test_strips_empty_key_facts():
    raw = '{"brief": "X.", "angle": "Y.", "key_facts": ["1", "", "  ", "2"]}'
    out = _parse_response(raw)
    assert out["key_facts"] == ["1", "2"]


def test_fallback_uses_highest_tier_body():
    srcmap = {"a": _src("a", 3), "b": _src("b", 1), "c": _src("c", 2)}
    members = [
        {"source_id": "a", "title": "low", "body": "T3 body content."},
        {"source_id": "b", "title": "official", "body": "Tier 1 official body that should win."},
        {"source_id": "c", "title": "mid", "body": "T2 body."},
    ]
    out = _fallback_brief(members, srcmap)
    assert "Tier 1" in out["brief"]
    assert out["angle"] is None
    assert out["key_facts"] == []


def test_fallback_truncates_to_60_words():
    srcmap = {"a": _src("a", 1)}
    long_body = " ".join([f"word{i}" for i in range(120)])
    members = [{"source_id": "a", "title": "t", "body": long_body}]
    out = _fallback_brief(members, srcmap)
    word_count = len(out["brief"].rstrip(".").rstrip(".").rstrip(".").split())
    assert word_count == 60
    assert out["brief"].endswith("...")


def test_fallback_falls_through_to_title_when_no_body():
    srcmap = {"a": _src("a", 1)}
    members = [{"source_id": "a", "title": "Headline only", "body": None}]
    out = _fallback_brief(members, srcmap)
    assert out["brief"].startswith("Headline only")
