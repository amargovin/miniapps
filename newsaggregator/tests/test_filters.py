"""Editorial noise-filter tests.

The filter is per-source (regex lists in sources.yaml). Items are dropped
at fetch-time before insertion into raw_items.
"""
from app.sources import Source, by_id, load_sources


def _src_with(**patterns) -> Source:
    return Source(
        id="t", name="t", type="rss", url="x",
        beats=("politics",), tier=2, fetch_interval_min=15,
        exclude_title_patterns=tuple(patterns.get("title", ())),
        exclude_url_patterns=tuple(patterns.get("url", ())),
    )


def test_no_patterns_compiles_to_none():
    s = _src_with()
    assert s.title_filter() is None
    assert s.url_filter() is None


def test_title_filter_drops_match():
    s = _src_with(title=["EducationPlus", "Career Counselling"])
    rx = s.title_filter()
    assert rx.search("Massive response to The Hindu EducationPlus Career Counselling Fair-2026")
    assert not rx.search("TVK's Vijay to take oath as Tamil Nadu Chief Minister")


def test_title_filter_is_case_insensitive():
    s = _src_with(title=["educationplus"])
    assert s.title_filter().search("The Hindu EDUCATIONPLUS event")


def test_title_filter_anchors_work():
    s = _src_with(title=[r"^(Couple|Three (?:persons|men)) (?:arrested|booked)"])
    rx = s.title_filter()
    assert rx.search("Couple arrested for possession of gutka near Katpadi")
    assert rx.search("Three persons arrested for killing man near Ambur")
    assert not rx.search("Police chase escaped convict — couple arrested as accomplices")
    assert not rx.search("Couple invited as chief guests")


def test_url_filter_drops_paths():
    s = _src_with(url=[r"thehindu\.com/news/cities/"])
    rx = s.url_filter()
    assert rx.search("https://www.thehindu.com/news/cities/Vellore/something/")
    assert not rx.search("https://www.thehindu.com/news/national/something/")


def test_url_filter_law_firms():
    s = _src_with(url=[r"(?:kpmg|mondaq|lexology)\.com"])
    rx = s.url_filter()
    assert rx.search("https://kpmg.com/in/en/insights/dpdp.html")
    assert rx.search("https://www.lexology.com/library/dpdp")
    assert not rx.search("https://www.thehindu.com/news/national/dpdp")


def test_real_sources_yaml_filters_compile():
    """Ensure all production filters compile without regex errors."""
    for s in load_sources():
        if s.exclude_title_patterns:
            s.title_filter()  # raises re.error if invalid
        if s.exclude_url_patterns:
            s.url_filter()


def test_hindu_national_has_filters_now():
    sources = by_id(load_sources())
    s = sources["hindu_national"]
    assert s.exclude_title_patterns, "hindu_national should have title filters"
    assert s.exclude_url_patterns, "hindu_national should have url filters"
    # Spot-check: filter actually drops the noise we saw on the dashboard
    rx_t = s.title_filter()
    assert rx_t.search("Massive response to The Hindu EducationPlus Career Counselling Fair")
    assert rx_t.search("Couple arrested for possession of gutka")
    assert rx_t.search("1.65 lakh Olive Ridley turtle hatchlings released into the sea")
    rx_u = s.url_filter()
    assert rx_u.search("https://www.thehindu.com/news/cities/Bangalore/something")
