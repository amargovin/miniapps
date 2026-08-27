"""Brief §8 — the findings summary. Each candidate is computed every week and mentioned
only when it fires, so a quiet week produces a short message rather than padded prose."""
from datetime import date, timedelta

from app.aggregate import rollup_meta, rollup_x, title_meta, title_x
from app.findings import (build_summary, duplicate_stories, normalise,
                          single_channel_leaders)
from app.meta_client import MetaPost
from app.x_client import XPost
from tests.conftest import utc

WE = date(2026, 8, 16)
PREV = date(2026, 8, 9)
IST = "Asia/Kolkata"
T0 = utc(2026, 8, 12, 9)


def xp(pid, text, *, likes=10, minutes=0, is_head=True, impressions=1000, replies=0,
       quotes=0):
    return XPost(pid, T0 + timedelta(minutes=minutes), text, likes, 0, replies, quotes, 0,
                 impressions, is_head, pid)


def test_normalisation_strips_urls_punctuation_and_case():
    assert normalise("  🚨 BREAKING: Court, strikes DOWN! https://t.co/x  ") == \
        "breaking court strikes down"


def test_the_same_story_posted_twice_within_hours_is_detected():
    """§8: 36 stories were double-posted in the week ending 2026-08-16 — detected by
    normalising the first 60 characters, heads only."""
    text = "Why India needs a new industrial policy for scale and capital"
    posts = [xp("1", text + " https://a", likes=300),
             xp("2", text + " https://b", likes=40, minutes=95),
             xp("3", "Something else entirely about monsoon rainfall in Kerala")]
    d = duplicate_stories(posts)
    assert d.stories == 1
    assert d.posts == 2
    assert d.second_copy_engagement == 40         # the engagement in the smaller copy
    assert d.examples[0]["post_ids"] == ["1", "2"]


def test_copies_further_apart_than_the_window_are_not_counted():
    text = "Why India needs a new industrial policy for scale and capital"
    posts = [xp("1", text, likes=300), xp("2", text, likes=40, minutes=60 * 20)]
    assert duplicate_stories(posts).stories == 0


def test_thread_continuations_are_not_mistaken_for_duplicates():
    """A continuation shares its head's opening words by construction."""
    text = "A long thread about the procurement framework and what it changes"
    posts = [xp("1", text, likes=300),
             xp("2", text, likes=40, minutes=2, is_head=False)]
    assert duplicate_stories(posts).stories == 0


def test_very_short_posts_are_not_guessed_at():
    posts = [xp("1", "Yes."), xp("2", "Yes.", minutes=5)]
    assert duplicate_stories(posts).stories == 0


def _rollups(x_text: str, ig_text: str):
    """Titles are what the matcher compares, so stamp them the way the pipeline does."""
    xs = [xp("1", x_text, likes=900)]
    igs = [MetaPost("instagram", "i1", T0, ig_text, "u", "IMAGE", 100, None, None)]
    title_x(xs)
    title_meta(igs)
    return (rollup_x(xs, week_ending=WE, week_tz=IST, followers=1),
            rollup_meta("instagram", igs, week_ending=WE, week_tz=IST, followers=1))


def test_a_leader_with_no_counterpart_elsewhere_is_surfaced():
    x, ig = _rollups("Supreme Court verdict reshapes state procurement rules",
                     "Monsoon reservoirs filled to capacity across the peninsula")
    leaders = single_channel_leaders([x, ig])
    assert any(l["channel"] == "x" and "instagram" in l["absent_from"] for l in leaders)


def test_the_same_story_on_both_channels_is_not_flagged_as_a_gap():
    """Matched on content-word overlap, not identical text: a story is captioned
    differently on Instagram than it is headlined on X."""
    x, ig = _rollups("Supreme Court verdict reshapes state procurement rules",
                     "Supreme Court verdict reshapes procurement rules for states")
    assert single_channel_leaders([x, ig]) == []


def test_the_summary_leads_with_what_moved_and_names_a_volume_swing():
    x = rollup_x([xp(str(i), f"Headline {i}", likes=10) for i in range(20)],
                 week_ending=WE, week_tz=IST, followers=342_772)
    prior = {"x": {"week_ending": PREV, "week_tz": IST, "posts": 40, "engagement": 5000,
                   "engagement_per_post": 125.0, "median_engagement": 100}}
    s = build_summary(week_ending=WE, week_tz=IST, rollups=[x], prior=prior,
                      prior_week_ending=PREV, duplicates=None, unavailable=[], notes=[])
    assert "X engagement moved" in s
    assert "week ending Sunday 9 August 2026" in s
    assert "volume swing rather than performance" in s


def test_the_summary_omits_candidates_that_do_not_fire():
    x = rollup_x([xp(str(i), f"Headline {i}", likes=10, replies=2) for i in range(10)],
                 week_ending=WE, week_tz=IST, followers=1000)
    s = build_summary(week_ending=WE, week_tz=IST, rollups=[x], prior={},
                      prior_week_ending=None, duplicates=None, unavailable=[], notes=[])
    assert "posted twice" not in s
    assert "engagement moved" not in s
    assert s.count(".") <= 4


def test_concentration_fires_when_the_mean_runs_well_ahead_of_the_median():
    posts = [xp("big", "One post carrying the week", likes=5000)] + \
            [xp(str(i), f"Headline {i}", likes=10) for i in range(30)]
    x = rollup_x(posts, week_ending=WE, week_tz=IST, followers=1000)
    s = build_summary(week_ending=WE, week_tz=IST, rollups=[x], prior={},
                      prior_week_ending=None, duplicates=None, unavailable=[], notes=[])
    assert "concentrated" in s
    assert "carried the week" in s


def test_duplicates_are_reported_with_the_engagement_in_the_smaller_copy():
    text = "Why India needs a new industrial policy for scale and capital"
    posts = [xp("1", text, likes=300), xp("2", text, likes=40, minutes=95)]
    x = rollup_x(posts, week_ending=WE, week_tz=IST, followers=1000)
    d = duplicate_stories(posts)
    s = build_summary(week_ending=WE, week_tz=IST, rollups=[x], prior={},
                      prior_week_ending=None, duplicates=d, unavailable=[], notes=[])
    assert "1 stories were posted twice on X" in s
    assert "40 engagement sitting in the smaller copy" in s


def test_an_unavailable_channel_is_stated_as_unavailable_rather_than_zero():
    x = rollup_x([xp("1", "A headline", likes=10)], week_ending=WE, week_tz=IST,
                 followers=1000)
    s = build_summary(week_ending=WE, week_tz=IST, rollups=[x], prior={},
                      prior_week_ending=None, duplicates=None, unavailable=["Instagram"],
                      notes=[])
    assert "Instagram could not be pulled" in s
    assert "unavailable rather than zero" in s


def test_the_message_refuses_a_cross_week_tz_delta_the_same_way_the_deck_does():
    """§3: the deck prints n/c for these rows, so the message must not quietly compute a
    percentage from them."""
    x = rollup_x([xp(str(i), f"Headline {i}", likes=10) for i in range(20)],
                 week_ending=WE, week_tz=IST, followers=342_772)
    utc_prior = {"x": {"week_ending": PREV, "week_tz": "UTC", "posts": 312,
                       "engagement": 29123, "engagement_per_post": 93.3,
                       "median_engagement": 36}}
    s = build_summary(week_ending=WE, week_tz=IST, rollups=[x], prior=utc_prior,
                      prior_week_ending=PREV, duplicates=None, unavailable=[], notes=[])
    assert "engagement moved" not in s
    assert "No week-on-week change is reported" in s
    assert "not the same seven days" in s


def test_channels_are_named_as_people_read_them_not_as_dict_keys():
    x, ig = _rollups("Supreme Court verdict reshapes state procurement rules",
                     "Monsoon reservoirs filled to capacity across the peninsula")
    s = build_summary(week_ending=WE, week_tz=IST, rollups=[x, ig], prior={},
                      prior_week_ending=None, duplicates=None, unavailable=[], notes=[])
    assert "best X post" in s
    assert "on Instagram" in s
    assert "best x post" not in s and " instagram" not in s
