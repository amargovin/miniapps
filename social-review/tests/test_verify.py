"""Brief §9 — the six checks. Each is tested in both directions: a check that cannot fail
is not a check."""
from datetime import date

from app.aggregate import rollup_meta, rollup_x
from app.meta_client import MetaPost
from app.render import build_deck
from app.verify import (Verification, check_meta_reconciliation,
                        check_meta_reconciliation_all, check_no_fabricated_zeros, check_pdf,
                        check_window_coverage, check_x_pagination, final_day_notes,
                        post_dates_meta, post_dates_x)
from app.x_client import XPost
from tests.conftest import utc

WE = date(2026, 8, 16)
IST = "Asia/Kolkata"


def mp(pid, *, likes=5, comments=1, shares=2, platform="facebook", day=12, hour=9):
    return MetaPost(platform, pid, utc(2026, 8, day, hour), "m", "u", None, likes,
                    comments, shares)


def xp(pid, *, likes=1, day=12, hour=9, is_head=True):
    return XPost(pid, utc(2026, 8, day, hour), "t", likes, 0, 0, 0, 0, 10, is_head, pid)


# ---- check 1 ----

def test_pagination_check_records_the_evidence_including_removed_duplicates():
    v = Verification()
    check_x_pagination(v, pages=3, posts_returned=215, unique_posts=213)
    c = v.checks[0]
    assert c.ok and "3 page(s)" in c.detail and "2 page-boundary duplicate" in c.detail


# ---- check 2 ----

def test_meta_reconciliation_passes_when_the_independent_aggregate_agrees():
    posts = [mp("a"), mp("b")]
    v = Verification()
    check_meta_reconciliation(v, platform="facebook", posts=posts,
                              aggregate={"posts": 2, "likes": 10, "comments": 2, "shares": 4})
    assert v.ok


def test_meta_reconciliation_catches_an_eight_post_undercount():
    """The real failure this exists for: eight of a Sunday's Facebook posts silently
    dropped."""
    posts = [mp(str(i)) for i in range(35)]
    v = Verification()
    check_meta_reconciliation(v, platform="facebook", posts=posts,
                              aggregate={"posts": 43, "likes": 215, "comments": 43,
                                         "shares": 86})
    assert not v.ok
    assert "posts 35 vs 43" in v.failed[0].detail


def test_meta_reconciliation_treats_nulls_as_zero_on_both_sides():
    posts = [MetaPost("instagram", "i1", utc(2026, 8, 12, 9), "c", "u", "IMAGE", 100,
                      None, None)]
    v = Verification()
    check_meta_reconciliation(v, platform="instagram", posts=posts,
                              aggregate={"posts": 1, "likes": 100, "comments": 0,
                                         "shares": 0})
    assert v.ok


def test_all_platform_scope_catches_rows_attributed_to_the_wrong_platform():
    """Two per-platform checks can both pass while the combined figure is wrong."""
    posts = [mp("a", platform="facebook"), mp("b", platform="facebook")]
    v = Verification()
    check_meta_reconciliation_all(
        v, posts=posts,
        aggregates={"facebook": {"posts": 2, "likes": 10, "comments": 2, "shares": 4},
                    "instagram": {"posts": 1, "likes": 100, "comments": 0, "shares": 0}})
    assert not v.ok
    assert "posts 2 vs 3" in v.failed[0].detail


# ---- check 3 ----

def test_window_coverage_passes_when_the_final_day_has_a_post():
    posts = [xp("1", day=16, hour=6)]                 # 11:30 IST Sunday
    dates = post_dates_x(posts, IST)
    v = Verification()
    check_window_coverage(v, week_ending=WE, week_tz=IST, channel="x", dates=dates,
                          notes=[])
    assert v.ok


def test_window_coverage_fails_when_the_final_day_is_empty_and_unexplained():
    dates = post_dates_x([xp("1", day=14)], IST)
    v = Verification()
    check_window_coverage(v, week_ending=WE, week_tz=IST, channel="x", dates=dates,
                          notes=[])
    assert not v.ok
    assert "may be truncated" in v.failed[0].detail


def test_window_coverage_passes_with_an_explicit_note_that_nothing_was_published():
    dates = post_dates_meta([mp("1", day=14)], IST)
    notes = final_day_notes(week_ending=WE, week_tz=IST, channel="facebook", dates=dates)
    assert notes and notes[0]["note"] == "no_posts_on_final_day"
    v = Verification()
    check_window_coverage(v, week_ending=WE, week_tz=IST, channel="facebook", dates=dates,
                          notes=notes)
    assert v.ok


def test_the_final_day_is_judged_in_week_tz_not_utc():
    """A post at 19:00 UTC on Sunday is 00:30 IST on Monday — the next week."""
    late = post_dates_x([xp("1", day=16, hour=19)], IST)
    assert WE not in late
    assert post_dates_x([xp("1", day=16, hour=19)], "UTC") == [date(2026, 8, 16)]


# ---- checks 4 and 5 ----

def _deck(top_rows: int, *, urls: bool = True):
    x = rollup_x([xp(str(i), likes=i) for i in range(1, top_rows + 1)], week_ending=WE,
                 week_tz=IST, followers=1000)
    if not urls:
        for t in x.top:
            t["url"] = ""
    return build_deck(week_ending=WE, week_tz=IST, rollups=[x])


def test_page_and_link_counts_pass_on_a_well_formed_deck():
    deck = _deck(25)
    v = Verification()
    check_pdf(v, pdf=deck.pdf, intended_slides=deck.slide_count,
              intended_links=deck.link_count)
    assert v.ok
    assert deck.slide_count == 2 and deck.link_count == 25


def test_a_wrong_intended_page_count_fails_loudly():
    deck = _deck(25)
    v = Verification()
    check_pdf(v, pdf=deck.pdf, intended_slides=4, intended_links=deck.link_count)
    assert not v.ok
    assert "spilled onto a continuation page" in v.failed[0].detail


def test_a_wrong_intended_link_count_fails_loudly():
    deck = _deck(25)
    v = Verification()
    check_pdf(v, pdf=deck.pdf, intended_slides=deck.slide_count, intended_links=54)
    assert not v.ok
    assert "a title wrapped" in v.failed[0].detail


# ---- check 6 ----

def test_no_fabricated_zeros_rejects_an_impressions_zero():
    r = rollup_x([xp("1", likes=5)], week_ending=WE, week_tz=IST, followers=1)
    r.impressions = 0                      # what a "safe default" would have written
    v = Verification()
    check_no_fabricated_zeros(v, rollups=[r])
    assert not v.ok
    assert "unavailable must be NULL" in v.failed[0].detail


def test_no_fabricated_zeros_accepts_null_impressions():
    ig = rollup_meta("instagram", [mp("1", platform="instagram")], week_ending=WE,
                     week_tz=IST, followers=1)
    v = Verification()
    check_no_fabricated_zeros(v, rollups=[ig])
    assert v.ok
    assert ig.impressions is None


def test_verification_reports_every_failure_not_just_the_first():
    v = Verification()
    v.add("a", False, "one")
    v.add("b", True, "two")
    v.add("c", False, "three")
    assert not v.ok
    assert [c.name for c in v.failed] == ["a", "c"]
    assert len(v.as_list()) == 3
