"""Hybrid same-event detection used by app.swarajya.

Cosine-only matching is too noisy at the headline level (real cross-source
variants land around 0.45-0.55). We combine cosine with content-token
overlap (Jaccard on words >=4 chars with stopwords removed).
"""
from app.swarajya import content_tokens, is_same_event, token_overlap


def test_content_tokens_drops_short_and_stopwords():
    tokens = content_tokens("PM Modi urges Indians to cut fuel use, work from home this week")
    # Short + stopwords ("pm", "to", "use", "from", "this") gone
    assert "modi" in tokens
    assert "indians" in tokens
    assert "fuel" in tokens
    assert "work" in tokens
    assert "home" in tokens
    assert "this" not in tokens
    assert "from" not in tokens
    # "urges" is in our stopword list
    assert "urges" not in tokens


def test_content_tokens_empty_input():
    assert content_tokens("") == set()
    assert content_tokens(None) == set()


def test_token_overlap_identical_headlines():
    a = "PM Modi appeals to cut fuel and gold imports"
    assert token_overlap(a, a) == 1.0


def test_token_overlap_no_shared_content():
    a = "Karnataka cabinet expands by four ministers"
    b = "Tamil Nadu police arrest two in robbery"
    assert token_overlap(a, b) < 0.05


def test_token_overlap_partial():
    a = "PM Modi urges Indians to revive Work From Home"
    b = "PM Modi calls on Indians to use petrol with restraint"
    # Both share: modi, indians. Some token overlap, not very high.
    assert 0.05 < token_overlap(a, b) < 0.4


def test_is_same_event_high_cosine_auto_matches():
    """Above the auto-match threshold, no token check needed."""
    # Even unrelated titles auto-match if cosine is ridiculously high (would never happen IRL)
    assert is_same_event(0.80, "abc def ghi", "xyz uvw rst") is True


def test_is_same_event_low_cosine_never_matches():
    """Below the cosine floor, never match even if tokens overlap."""
    a = "PM Modi cuts fuel use"
    b = "PM Modi cuts fuel use"  # token overlap = 1.0
    assert is_same_event(0.30, a, b) is False


def test_is_same_event_mid_cosine_needs_token_overlap():
    """Real-world same-event pair we saw in production data."""
    a = "India Inc backs PM Modi's call to curb fuel, gold use amid shock from West Asia"
    sw = ("PM Modi Urges Indians To Revive Work From Home, Avoid Foreign Weddings "
          "And Cut Fuel Use Amid West Asia Oil Crisis")
    # Real-data cos 0.561, real-data jaccard 0.22 — hybrid path should match.
    assert is_same_event(0.561, a, sw) is True


def test_is_same_event_mid_cosine_rejects_when_tokens_diverge():
    """LPG theft vs Indian Oil losses — related theme, different event."""
    a = "War in West Asia, summer heat, 6 gas tankers: Behind theft of LPG worth Rs 1.5 crore"
    sw = "Indian Oil, BPCL And HPCL Absorb Rs 30,000 Crore Monthly Losses As Petrol, Diesel Prices Stay Capped"
    # cos around 0.49 in real data, but token overlap is just {crore} -> well below 0.20
    assert is_same_event(0.49, a, sw) is False


def test_is_same_event_centre_govt_actions_dont_match():
    """Two unrelated Centre/Govt headlines shouldn't false-match."""
    a = "Centre okays Gujarat shipyard, 3 rail projects to ease up congestion"
    sw = "Centre Pushes To Accelerate Rs 35,000 Crore Varanasi-Kolkata Expressway As West Bengal Push Continues"
    # cos 0.49 in real data, content tokens share only "centre"
    assert is_same_event(0.49, a, sw) is False
