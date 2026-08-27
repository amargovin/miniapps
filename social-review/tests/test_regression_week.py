"""Brief §9's regression test: the measured week ending 2026-08-16, reproduced exactly.

    | | X | Instagram | Facebook |
    | posts | 215 | 4 | 43 |
    | ranked posts | 163 | 4 | 43 |
    | engagement | 21,217 | 1,927 | 641 |
    | impressions | 1,156,638 | NULL | NULL |
    | per post | 98.7 | 481.8 | 14.9 |
    | median | 55 | 345 | 13 |
    | engagement rate | 1.83% | NULL | NULL |
    | followers | 342,772 | 59,742 | 633,871 |
    Combined: 262 posts, 23,785 engagement. Thread continuations: 52. Duplicate stories on
    X: 36, covering 72 posts, with 2,037 engagement in the smaller copy. X engagement
    components: likes 16,597, reposts 3,009, bookmarks 1,275, replies 213, quotes 123.

The brief asks for this to run "against a recorded fixture of the real payloads". Those
payloads cannot be invented — the whole point of the check is that the arithmetic is
verified against what the APIs actually returned — so the fixture is recorded from a real
run rather than written by hand:

    python -m app.cli run --week-ending 2026-08-16 --force --no-notify
    python -m app.cli dump-fixture <run_id> --out tests/fixtures/week_2026-08-16

That is build-order step 8. `raw_payloads` keeps the bytes for 180 days precisely so this
is possible after the fact. Until the fixture exists these tests skip with the command to
create them; once it does, they are the check that the numbers on a slide are the numbers
the APIs gave.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest

from app.aggregate import rollup_meta, rollup_x, title_meta, title_x
from app.findings import duplicate_stories
from app.meta_client import MetaPost, _null_unreported
from app.window import window_for
from app.x_client import XClient

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "week_2026-08-16"
WE = date(2026, 8, 16)
IST = "Asia/Kolkata"

EXPECTED = {
    "x": {"posts": 215, "ranked_posts": 163, "engagement": 21_217,
          "impressions": 1_156_638, "engagement_per_post": 98.7, "median_engagement": 55,
          "engagement_rate_pct": 1.83, "followers": 342_772},
    "instagram": {"posts": 4, "ranked_posts": 4, "engagement": 1_927, "impressions": None,
                  "engagement_per_post": 481.8, "median_engagement": 345,
                  "engagement_rate_pct": None, "followers": 59_742},
    "facebook": {"posts": 43, "ranked_posts": 43, "engagement": 641, "impressions": None,
                 "engagement_per_post": 14.9, "median_engagement": 13,
                 "engagement_rate_pct": None, "followers": 633_871},
}
EXPECTED_COMBINED = {"posts": 262, "engagement": 23_785}
EXPECTED_CONTINUATIONS = 52
EXPECTED_DUPLICATES = {"stories": 36, "posts": 72, "second_copy_engagement": 2_037}
EXPECTED_X_COMPONENTS = {"Likes": 16_597, "Reposts": 3_009, "Bookmarks": 1_275,
                         "Replies": 213, "Quotes": 123}

RECORD_HINT = (
    f"no recorded payloads at {FIXTURE_DIR}. Record them from a real run (build-order "
    f"step 8):\n"
    f"  python -m app.cli run --week-ending 2026-08-16 --force --no-notify\n"
    f"  python -m app.cli dump-fixture <run_id> --out {FIXTURE_DIR}\n"
    f"The §9 regression table cannot be checked against hand-written payloads — that would "
    f"test the fixture, not the pull."
)


def _manifest() -> dict:
    manifest = FIXTURE_DIR / "manifest.json"
    if not manifest.exists():
        pytest.skip(RECORD_HINT)
    return json.loads(manifest.read_text())


def _payloads(prefix: str) -> list[dict]:
    return [json.loads(p.read_text())
            for p in sorted(FIXTURE_DIR.glob(f"{prefix}_p*.json"),
                            key=lambda p: int(p.stem.rsplit("_p", 1)[1]))]


@pytest.fixture(scope="module")
def recorded():
    """Replay the recorded payloads through the real clients, so the parsing, thread
    reconstruction and NULL handling under test are the production code paths."""
    manifest = _manifest()
    followers = manifest.get("followers") or {}
    if not followers:
        pytest.skip(f"{FIXTURE_DIR / 'manifest.json'} has no `followers` block; add the "
                    f"three follower counts recorded with the payloads")

    x = XClient("replay", "2451476942")
    raw = {row["id"]: row for page in _payloads("x_timeline")
           for row in (page.get("data") or [])}
    x_posts = x._build_posts(raw, [])
    title_x(x_posts)

    def meta_posts(prefix: str, platform: str) -> list[MetaPost]:
        rows = {}
        for page in _payloads(prefix):
            for row in page.get("data") or []:
                rows[row["id"]] = row
        posts = _decode(platform, list(rows.values()))
        _null_unreported(platform, posts)
        title_meta(posts)
        return posts

    ig = meta_posts("ig_media", "instagram")
    fb = meta_posts("fb_posts", "facebook")
    return {
        "x": rollup_x(x_posts, week_ending=WE, week_tz=IST, followers=followers["x"]),
        "instagram": rollup_meta("instagram", ig, week_ending=WE, week_tz=IST,
                                 followers=followers["instagram"]),
        "facebook": rollup_meta("facebook", fb, week_ending=WE, week_tz=IST,
                                followers=followers["facebook"]),
        "x_posts": x_posts,
    }


def _decode(platform: str, rows: list[dict]) -> list[MetaPost]:
    from app.meta_client import _int_or_none, _parse_ts, _shares_count, _summary_count
    if platform == "facebook":
        return [MetaPost("facebook", r["id"], _parse_ts(r["created_time"]),
                         r.get("message"), r.get("permalink_url"), None,
                         _summary_count(r.get("likes")), _summary_count(r.get("comments")),
                         _shares_count(r.get("shares"))) for r in rows]
    return [MetaPost("instagram", r["id"], _parse_ts(r["timestamp"]), r.get("caption"),
                     r.get("permalink"), r.get("media_type"),
                     _int_or_none(r.get("like_count")),
                     _int_or_none(r.get("comments_count")), None) for r in rows]


@pytest.mark.parametrize("channel", ["x", "instagram", "facebook"])
@pytest.mark.parametrize("metric", ["posts", "ranked_posts", "engagement", "impressions",
                                    "engagement_per_post", "median_engagement",
                                    "engagement_rate_pct", "followers"])
def test_the_regression_table_is_reproduced_exactly(recorded, channel, metric):
    assert getattr(recorded[channel], metric) == EXPECTED[channel][metric]


def test_the_combined_totals_match(recorded):
    rolls = [recorded[c] for c in ("x", "instagram", "facebook")]
    assert sum(r.posts for r in rolls) == EXPECTED_COMBINED["posts"]
    assert sum(r.engagement for r in rolls) == EXPECTED_COMBINED["engagement"]


def test_the_thread_continuation_count_matches(recorded):
    assert sum(1 for p in recorded["x_posts"] if not p.is_head) == EXPECTED_CONTINUATIONS


def test_the_x_engagement_components_match(recorded):
    assert dict(recorded["x"].breakdown) == EXPECTED_X_COMPONENTS


def test_the_duplicate_story_count_matches(recorded):
    d = duplicate_stories(recorded["x_posts"])
    assert d.stories == EXPECTED_DUPLICATES["stories"]
    assert d.posts == EXPECTED_DUPLICATES["posts"]
    assert d.second_copy_engagement == EXPECTED_DUPLICATES["second_copy_engagement"]


def test_the_window_the_payloads_were_pulled_for_is_the_ist_week():
    manifest = _manifest()
    start, end = window_for(WE, IST)
    assert manifest["week_ending"] == "2026-08-16"
    assert manifest["week_tz"] == IST
    assert manifest["window_start"] == start.isoformat()
    assert manifest["window_end"] == end.isoformat()
