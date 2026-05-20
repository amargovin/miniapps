from app.sources import load_sources, ALLOWED_BEATS


def test_sources_yaml_loads():
    sources = load_sources()
    assert len(sources) >= 1
    ids = {s.id for s in sources}
    assert "hindu_national" in ids


def test_excluded_sources_not_present():
    """RBI and SEBI feeds were removed at editor request — guard against accidental re-add."""
    excluded = {"rbi_press", "rbi_notifications", "sebi_master", "gnews_supreme_court"}
    ids = {s.id for s in load_sources()}
    assert ids.isdisjoint(excluded), f"unexpected: {ids & excluded}"


def test_all_sources_have_valid_beats():
    for s in load_sources():
        assert set(s.beats).issubset(ALLOWED_BEATS), s.id


def test_all_sources_have_valid_tier():
    for s in load_sources():
        assert s.tier in (1, 2, 3), s.id


def test_no_duplicate_source_ids():
    sources = load_sources()
    ids = [s.id for s in sources]
    assert len(ids) == len(set(ids))
