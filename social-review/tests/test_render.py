"""Brief §8 — the four-slide deck, and the date rule that applies everywhere."""
from datetime import date
from io import BytesIO

from pypdf import PdfReader

from app.aggregate import rollup_meta, rollup_x
from app.meta_client import MetaPost
from app.render import build_deck, deck_filename
from app.x_client import XPost
from tests.conftest import utc

WE = date(2026, 8, 16)
PREV = date(2026, 8, 9)
IST = "Asia/Kolkata"


def xp(pid, *, likes=10, impressions=1000, is_head=True, day=12):
    return XPost(pid, utc(2026, 8, day, 9), f"Headline number {pid} about policy", likes,
                 2, 1, 0, 3, impressions, is_head, pid)


def mp(pid, *, platform="instagram", likes=100, day=12):
    return MetaPost(platform, pid, utc(2026, 8, day, 9), f"Caption {pid}",
                    f"https://example.com/{pid}", "IMAGE", likes, None, None)


def three_channels(x_posts=30, ig_posts=4, fb_posts=30):
    return [
        rollup_x([xp(str(i), likes=100 - i) for i in range(1, x_posts + 1)],
                 week_ending=WE, week_tz=IST, followers=342_772),
        rollup_meta("instagram", [mp(f"i{i}", likes=400 - i) for i in range(ig_posts)],
                    week_ending=WE, week_tz=IST, followers=59_742),
        rollup_meta("facebook", [mp(f"f{i}", platform="facebook", likes=20 - i % 20)
                                 for i in range(fb_posts)],
                    week_ending=WE, week_tz=IST, followers=633_871),
    ]


def prior(week_tz="Asia/Kolkata"):
    return {
        "x": {"week_ending": PREV, "channel": "x", "week_tz": week_tz, "posts": 312,
              "engagement": 29123, "engagement_per_post": 93.3, "median_engagement": 36,
              "impressions": 1706991, "engagement_rate_pct": 1.71, "source": "imported"},
        "instagram": {"week_ending": PREV, "channel": "instagram", "week_tz": week_tz,
                      "posts": 7, "engagement": 1399, "engagement_per_post": 199.9,
                      "median_engagement": 166, "impressions": None,
                      "engagement_rate_pct": None, "source": "imported"},
        "facebook": {"week_ending": PREV, "channel": "facebook", "week_tz": week_tz,
                     "posts": 55, "engagement": 843, "engagement_per_post": 15.3,
                     "median_engagement": None, "impressions": None,
                     "engagement_rate_pct": None, "source": "imported"},
    }


def text_of(pdf: bytes) -> str:
    return "\n".join(p.extract_text() for p in PdfReader(BytesIO(pdf)).pages)


# ---- shape ----

def test_a_full_three_channel_week_is_four_slides_and_fifty_four_links():
    """§9's worked example: 25 + 25 + 4 = 54 links across four pages."""
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=three_channels(),
                      prior_rows=prior(), prior_week_ending=PREV)
    assert deck.slide_count == 4
    assert deck.link_count == 54
    reader = PdfReader(BytesIO(deck.pdf))
    assert len(reader.pages) == 4
    assert sum(len(p.get("/Annots") or []) for p in reader.pages) == 54


def test_a_channel_that_published_fewer_than_twenty_five_lists_all_of_them():
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=three_channels(x_posts=3,
                                                                          ig_posts=2,
                                                                          fb_posts=1))
    assert deck.link_count == 6
    assert "all 3 posts in the week" in text_of(deck.pdf)


def test_a_missing_channel_drops_its_appendix_rather_than_rendering_an_empty_one():
    rolls = three_channels()[:2]
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=rolls)
    assert deck.slide_count == 3


def test_there_is_no_title_slide_and_no_extra_panels():
    """§8: nothing but the comparison table and the post lists."""
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=three_channels(),
                      prior_rows=prior(), prior_week_ending=PREV)
    body = text_of(deck.pdf)
    assert body.count("WEEK ON WEEK") == 1
    for banned in ("SOCIAL PERFORMANCE REVIEW", "WHAT IS WORKING", "WHERE TO ACT",
                   "THE MISMATCH", "WHAT WE CANNOT SEE", "AUDIENCE BEHAVIOUR"):
        assert banned not in body


def test_filename_carries_the_week_ending_date():
    assert deck_filename(WE) == "swarajya_social_review_2026-08-16.pdf"


# ---- the date rule (§8) ----

def test_the_window_is_stated_in_full_with_its_timezone():
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=three_channels(),
                      prior_rows=prior(), prior_week_ending=PREV)
    body = text_of(deck.pdf)
    assert ("the seven full days Monday 10 August to Sunday 16 August 2026, "
            "India Standard Time") in body
    assert "week ending Sunday 16 August 2026" in body.replace("\n", " ")


def test_every_comparison_column_is_labelled_by_its_week_ending_sunday():
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=three_channels(),
                      prior_rows=prior(), prior_week_ending=PREV)
    body = text_of(deck.pdf).replace("\n", " ")
    assert "w/e 9 Aug" in body and "w/e 16 Aug" in body


def test_no_bare_range_appears_anywhere_except_the_quoted_ambiguity_footnote():
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=three_channels(),
                      prior_rows=prior("UTC"), prior_week_ending=PREV)
    body = text_of(deck.pdf)
    # The one place a bare range is allowed is inside the quotation of the source deck's
    # own label, which the footnote exists to flag as ambiguous.
    assert body.count("2–9 August 2026") == 1
    assert "either eight days" in body


# ---- week_tz guard (§3) ----

def test_a_delta_across_a_week_tz_boundary_is_refused_not_computed():
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=three_channels(),
                      prior_rows=prior("UTC"), prior_week_ending=PREV)
    body = text_of(deck.pdf)
    assert "n/c" in body
    assert any(n["note"] == "week_tz_mismatch" for n in deck.notes)
    assert "not the same seven days" in body


def test_a_like_for_like_comparison_does_compute_deltas():
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=three_channels(),
                      prior_rows=prior(), prior_week_ending=PREV)
    body = text_of(deck.pdf)
    assert "n/c" not in body
    assert "%" in body
    assert not any(n["note"] == "week_tz_mismatch" for n in deck.notes)


def test_the_ambiguous_prior_window_carries_its_footnote():
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=three_channels(),
                      prior_rows=prior(), prior_week_ending=PREV)
    assert any(n["note"] == "ambiguous_prior_window" for n in deck.notes)


def test_no_prior_week_renders_without_deltas_and_says_so():
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=three_channels())
    assert "no prior week stored" in text_of(deck.pdf)
    assert deck.slide_count == 4


# ---- honesty lines ----

def test_reach_is_labelled_x_only_and_meta_is_never_given_a_zero():
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=three_channels(),
                      prior_rows=prior(), prior_week_ending=PREV)
    body = text_of(deck.pdf)
    assert "Reach is X-only" in body
    assert "unreported, not zero" in body


def test_the_volume_swing_caveat_closes_the_first_slide():
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=three_channels(),
                      prior_rows=prior(), prior_week_ending=PREV)
    assert "engagement per post is the honest comparison" in text_of(deck.pdf)


def test_an_unavailable_channel_is_named_as_unavailable_not_zero():
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=three_channels()[1:],
                      prior_rows=prior(), prior_week_ending=PREV, unavailable=["X"])
    body = text_of(deck.pdf)
    assert "X unavailable this week" in body
    assert "rather than zero" in body


def test_a_row_without_a_permalink_is_counted_and_noted_rather_than_silently_unlinked():
    rolls = three_channels(ig_posts=3)
    for t in rolls[1].top:
        t["url"] = ""
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=rolls)
    assert deck.link_count == 25 + 0 + 25
    note = next(n for n in deck.notes if n["note"] == "appendix_row_without_link")
    assert note["channel"] == "instagram" and note["linked"] == 0


def test_thread_counting_is_stated_on_the_x_appendix():
    posts = [xp("1", likes=50)] + [xp(str(i), likes=5, is_head=False) for i in range(2, 6)]
    x = rollup_x(posts, week_ending=WE, week_tz=IST, followers=1)
    deck = build_deck(week_ending=WE, week_tz=IST, rollups=[x])
    body = text_of(deck.pdf)
    assert "Threads are counted once, credited to the head post" in body
    assert "1 ranked items from 5 posts" in body
