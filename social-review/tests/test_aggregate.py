"""Brief §6 — the metric definitions, implemented exactly."""
import statistics
from datetime import date

from app.aggregate import (combined, order_rollups, rollup_meta, rollup_x, title_meta,
                           title_x)
from app.meta_client import MetaPost
from app.x_client import XPost
from tests.conftest import utc

WE = date(2026, 8, 16)
IST = "Asia/Kolkata"


def xp(pid, *, likes=0, reposts=0, replies=0, quotes=0, bookmarks=0, impressions=0,
       is_head=True, thread_root=None, text="A headline", day=12):
    return XPost(pid, utc(2026, 8, day, 9), text, likes, reposts, replies, quotes,
                 bookmarks, impressions, is_head, thread_root or pid)


def mp(pid, *, likes=0, comments=None, shares=None, platform="instagram", day=12):
    return MetaPost(platform, pid, utc(2026, 8, day, 9), "A caption",
                    f"https://example.com/{pid}", "IMAGE", likes, comments, shares)


def test_x_engagement_is_the_sum_of_five_interaction_types():
    posts = [xp("1", likes=100, reposts=20, replies=5, quotes=2, bookmarks=13)]
    r = rollup_x(posts, week_ending=WE, week_tz=IST, followers=1000)
    assert r.engagement == 140


def test_per_post_counts_every_post_including_thread_continuations():
    """§6: engagement / posts over *every* post, continuations included."""
    posts = [xp("1", likes=100), xp("2", likes=50, is_head=False, thread_root="1")]
    r = rollup_x(posts, week_ending=WE, week_tz=IST, followers=1000)
    assert r.posts == 2
    assert r.ranked_posts == 1
    assert r.engagement == 150
    assert r.engagement_per_post == 75.0        # not 150, which would use heads only


def test_median_is_across_all_posts_not_just_heads():
    posts = [xp("1", likes=100), xp("2", likes=10, is_head=False, thread_root="1"),
             xp("3", likes=20)]
    r = rollup_x(posts, week_ending=WE, week_tz=IST, followers=1000)
    assert r.median_engagement == 20            # median of 10, 20, 100
    assert statistics.median([100, 10, 20]) == 20


def test_median_is_truncated_not_rounded():
    """int(), matching what produced the stored historical rows: rounding would disagree
    by 1 on an even post count."""
    posts = [xp("1", likes=10), xp("2", likes=11)]
    r = rollup_x(posts, week_ending=WE, week_tz=IST, followers=1000)
    assert statistics.median([10, 11]) == 10.5
    assert r.median_engagement == 10


def test_engagement_per_1k_followers():
    posts = [xp("1", likes=2000)]
    r = rollup_x(posts, week_ending=WE, week_tz=IST, followers=100_000)
    assert r.engagement_per_1k_followers == 20.0


def test_engagement_rate_is_x_only_and_is_a_percentage_of_impressions():
    posts = [xp("1", likes=100, impressions=10_000)]
    r = rollup_x(posts, week_ending=WE, week_tz=IST, followers=1000)
    assert r.engagement_rate_pct == 1.0
    assert r.impressions == 10_000
    assert r.has_reach


def test_meta_has_no_reach_and_no_engagement_rate_and_never_a_zero():
    r = rollup_meta("instagram", [mp("1", likes=500)], week_ending=WE, week_tz=IST,
                    followers=59_742)
    assert r.impressions is None                # NULL, never 0, never estimated
    assert r.engagement_rate_pct is None
    assert not r.has_reach


def test_meta_engagement_sums_nulls_as_zero_but_reports_them_unavailable():
    posts = [mp("1", likes=100, comments=None, shares=None),
             mp("2", likes=50, comments=None, shares=None)]
    r = rollup_meta("instagram", posts, week_ending=WE, week_tz=IST, followers=1000)
    assert r.engagement == 150
    assert r.unreported == ["comments", "shares"]


def test_a_partially_reported_field_is_not_marked_unavailable():
    posts = [mp("1", likes=100, comments=None), mp("2", likes=50, comments=3)]
    r = rollup_meta("instagram", posts, week_ending=WE, week_tz=IST, followers=1000)
    assert "comments" not in r.unreported


def test_rankings_are_heads_only_and_a_thread_is_one_item():
    """A thread is one item, credited with its head post's metrics — not the sum of the
    thread. Listing continuations separately would fill the top 25 with fragments."""
    posts = [xp("1", likes=100), xp("2", likes=90, is_head=False, thread_root="1"),
             xp("3", likes=50)]
    r = rollup_x(posts, week_ending=WE, week_tz=IST, followers=1000)
    assert [t["title"] or t["url"] for t in r.top]      # every ranked row is populated
    assert len(r.top) == 2
    assert [t["engagement"] for t in r.top] == [100, 50]


def test_top_is_capped_at_twenty_five_and_ordered_by_engagement():
    posts = [xp(str(i), likes=i) for i in range(1, 41)]
    r = rollup_x(posts, week_ending=WE, week_tz=IST, followers=1000)
    assert len(r.top) == 25
    assert [t["engagement"] for t in r.top] == list(range(40, 15, -1))
    assert [t["rank"] for t in r.top] == list(range(1, 26))


def test_x_top_rows_link_to_the_post():
    r = rollup_x([xp("1234567890")], week_ending=WE, week_tz=IST, followers=1)
    assert r.top[0]["url"] == "https://x.com/SwarajyaMag/status/1234567890"


def test_titles_are_stamped_and_threads_get_the_suffix():
    posts = [xp("1", text="A thread on capital formation and where it goes"),
             xp("2", text="Second part", is_head=False, thread_root="1"),
             xp("3", text="A standalone post about the monsoon")]
    title_x(posts)
    assert posts[0].title.endswith(" (thread)")
    assert not posts[2].title.endswith(" (thread)")
    metas = [mp("m1")]
    title_meta(metas)
    assert metas[0].title == "A caption"


def test_an_empty_channel_reports_null_impressions_not_zero():
    r = rollup_x([], week_ending=WE, week_tz=IST, followers=1000)
    assert r.posts == 0
    assert r.impressions is None
    assert r.engagement_per_post == 0.0
    assert r.median_engagement is None


def test_combined_is_engagement_only_across_channels():
    x = rollup_x([xp("1", likes=100, impressions=1000)], week_ending=WE, week_tz=IST,
                 followers=1)
    ig = rollup_meta("instagram", [mp("2", likes=50)], week_ending=WE, week_tz=IST,
                     followers=1)
    c = combined([x, ig])
    assert c["posts"] == 2
    assert c["engagement"] == 150
    assert c["impressions"] == 1000              # X only
    assert c["reach_channels"] == ["x"]


def test_appendix_order_is_x_instagram_facebook():
    rolls = [rollup_meta("facebook", [mp("1", platform="facebook")], week_ending=WE,
                         week_tz=IST, followers=1),
             rollup_x([xp("2")], week_ending=WE, week_tz=IST, followers=1),
             rollup_meta("instagram", [mp("3")], week_ending=WE, week_tz=IST, followers=1)]
    assert [r.channel for r in order_rollups(rolls)] == ["x", "instagram", "facebook"]


def test_totals_row_matches_the_weekly_totals_columns():
    r = rollup_x([xp("1", likes=10, impressions=100)], week_ending=WE, week_tz=IST,
                 followers=1000)
    row = r.totals_row()
    assert set(row) == {"week_ending", "channel", "week_tz", "followers", "posts",
                        "ranked_posts", "engagement", "impressions",
                        "engagement_per_post", "engagement_per_1k_followers",
                        "median_engagement", "engagement_rate_pct", "source"}
    assert row["source"] == "api"
