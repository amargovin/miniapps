"""Tests for the shared content-token / hybrid same-event matcher.

This primitive is used by both clustering (cross-publication merge) and the
Swarajya coverage check.
"""
from app.textmatch import content_tokens, is_same_event, token_overlap


def test_content_tokens_strips_short_and_stopwords():
    out = content_tokens("PM Modi urges Indians to cut fuel use, work from home this week")
    assert "modi" in out
    assert "indians" in out
    assert "fuel" in out
    assert "work" in out
    assert "home" in out
    assert "this" not in out  # stopword
    assert "from" not in out  # stopword
    assert "urges" not in out  # reporting verb stopword


def test_content_tokens_handles_empty():
    assert content_tokens("") == set()
    assert content_tokens(None) == set()


def test_token_overlap_identical():
    a = "Cabinet approves new labour codes effective July"
    assert token_overlap(a, a) == 1.0


def test_token_overlap_disjoint():
    assert token_overlap("Karnataka cabinet", "Tamil police arrest") < 0.05


def test_is_same_event_high_cosine_auto_matches():
    assert is_same_event(0.85, "abc def", "xyz uvw") is True


def test_is_same_event_low_cosine_never_matches():
    # Even if tokens overlap perfectly, low cosine blocks the match.
    assert is_same_event(0.30, "same text here", "same text here") is False


def test_is_same_event_mid_cosine_requires_tokens():
    # Real cross-pub variant pair.
    a = "Suvendu Adhikari sworn in as first BJP Chief Minister of West Bengal"
    b = "BJP's Suvendu Adhikari takes oath as Bengal CM in Kolkata"
    # Both share suvendu, adhikari, bengal, plus minister/oath relate
    # but only token check at mid cosine; threshold should pass.
    assert is_same_event(0.55, a, b) is True


def test_is_same_event_mid_cosine_rejects_disjoint_topics():
    # Similar cosine, different events.
    a = "Centre okays Gujarat shipyard, 3 rail projects to ease up congestion"
    b = "Centre Pushes To Accelerate Rs 35,000 Crore Varanasi-Kolkata Expressway"
    # Only 'centre' overlaps — well below 0.20 jaccard floor.
    assert is_same_event(0.49, a, b) is False


def test_is_same_event_tunable_thresholds():
    # With aggressive thresholds, easier to match.
    a = "Modi visits Bihar"
    b = "Bihar elections analysis"
    assert is_same_event(0.45, a, b, cosine_floor=0.40, token_floor=0.10) is True
    # With strict thresholds, doesn't match.
    assert is_same_event(0.45, a, b, cosine_floor=0.60, token_floor=0.10) is False
