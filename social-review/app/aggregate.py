"""Metric arithmetic (brief §6) — implement exactly, do not re-derive.

  Engagement, X     = likes + reposts + replies + quotes + bookmarks
  Engagement, Meta  = likes + comments + shares  (NULLs summed as 0, reported unavailable)
  per_post          = engagement / posts, over EVERY post, continuations included
  per_1k_followers  = engagement / (followers / 1000)
  engagement_rate   = 100 * engagement / impressions, X only (Meta exposes no reach)
  median            = across all posts in the channel, not just heads
  ranked posts      = thread heads and standalone posts; a thread is one item, credited
                      with its head post's metrics

Medians are truncated with int(), not rounded: that is what produced the stored historical
figures and the §9 regression targets, and the two disagree by 1 on even post counts.
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from datetime import date

from app.meta_client import MetaPost
from app.titles import display_title
from app.x_client import XPost, heads_with_continuations

CHANNELS = ("x", "instagram", "facebook")
DISPLAY_NAME = {
    "x": "X / @SwarajyaMag",
    "instagram": "Instagram / @swarajya_mag",
    "facebook": "Facebook / Swarajya",
}
TOP_N = 25
X_URL = "https://x.com/SwarajyaMag/status/{}"


@dataclass
class ChannelRollup:
    """One weekly_totals row, plus the render-only extras that are not stored."""
    channel: str
    week_ending: date
    week_tz: str
    followers: int | None
    posts: int
    ranked_posts: int | None
    engagement: int
    impressions: int | None
    engagement_per_post: float
    engagement_per_1k_followers: float | None
    median_engagement: int | None
    engagement_rate_pct: float | None
    source: str = "api"
    # not stored in weekly_totals:
    breakdown: list[tuple[str, int]] = field(default_factory=list)
    unreported: list[str] = field(default_factory=list)
    top: list[dict] = field(default_factory=list)

    @property
    def name(self) -> str:
        return DISPLAY_NAME.get(self.channel, self.channel)

    @property
    def has_reach(self) -> bool:
        return bool(self.impressions)

    def totals_row(self) -> dict:
        return {
            "week_ending": self.week_ending,
            "channel": self.channel,
            "week_tz": self.week_tz,
            "followers": self.followers,
            "posts": self.posts,
            "ranked_posts": self.ranked_posts,
            "engagement": self.engagement,
            "impressions": self.impressions,
            "engagement_per_post": self.engagement_per_post,
            "engagement_per_1k_followers": self.engagement_per_1k_followers,
            "median_engagement": self.median_engagement,
            "engagement_rate_pct": self.engagement_rate_pct,
            "source": self.source,
        }


def _per_post(engagement: int, posts: int) -> float:
    return round(engagement / posts, 1) if posts else 0.0


def _per_1k(engagement: int, followers: int | None) -> float | None:
    return round(engagement / (followers / 1000.0), 1) if followers else None


def _median(values: list[int]) -> int | None:
    return int(statistics.median(values)) if values else None


def title_x(posts: list[XPost]) -> None:
    """Stamp display titles in place. Threads get the ' (thread)' suffix (§7)."""
    threaded = heads_with_continuations(posts)
    for p in posts:
        p.title = display_title(p.text, is_thread=p.is_head and p.post_id in threaded)


def title_meta(posts: list[MetaPost]) -> None:
    for p in posts:
        p.title = display_title(p.message or "")


def rollup_x(posts: list[XPost], *, week_ending: date, week_tz: str,
             followers: int | None) -> ChannelRollup:
    engagements = [p.engagement for p in posts]
    engagement = sum(engagements)
    impressions = sum(p.impressions for p in posts)
    heads = sorted((p for p in posts if p.is_head), key=lambda p: -p.engagement)
    top = [
        {
            "rank": i,
            "date": p.created_at.date().isoformat(),
            "title": p.title or p.post_id,
            "url": X_URL.format(p.post_id),
            "likes": p.likes, "reposts": p.reposts, "replies": p.replies,
            "quotes": p.quotes, "bookmarks": p.bookmarks,
            "impressions": p.impressions, "engagement": p.engagement,
        }
        for i, p in enumerate(heads[:TOP_N], 1)
    ]
    return ChannelRollup(
        channel="x",
        week_ending=week_ending,
        week_tz=week_tz,
        followers=followers,
        posts=len(posts),
        ranked_posts=len(heads),
        engagement=engagement,
        # Reach is real on X. It is NULL only when the channel could not be pulled at all,
        # which is handled by omitting the rollup entirely, never by writing a 0 (§9.6).
        impressions=impressions if posts else None,
        engagement_per_post=_per_post(engagement, len(posts)),
        engagement_per_1k_followers=_per_1k(engagement, followers),
        median_engagement=_median(engagements),
        engagement_rate_pct=(round(100.0 * engagement / impressions, 2)
                             if impressions else None),
        breakdown=[
            ("Likes", sum(p.likes for p in posts)),
            ("Reposts", sum(p.reposts for p in posts)),
            ("Bookmarks", sum(p.bookmarks for p in posts)),
            ("Replies", sum(p.replies for p in posts)),
            ("Quotes", sum(p.quotes for p in posts)),
        ],
        top=top,
    )


def rollup_meta(channel: str, posts: list[MetaPost], *, week_ending: date, week_tz: str,
                followers: int | None) -> ChannelRollup:
    engagements = [p.engagement for p in posts]
    engagement = sum(engagements)
    ranked = sorted(posts, key=lambda p: -p.engagement)
    top = [
        {
            "rank": i,
            "date": p.created_at.date().isoformat(),
            "title": p.title or p.post_id,
            "url": p.permalink or "",
            "likes": p.likes, "comments": p.comments, "shares": p.shares,
            "engagement": p.engagement,
        }
        for i, p in enumerate(ranked[:TOP_N], 1)
    ]
    unreported = [f for f in ("likes", "comments", "shares")
                  if posts and all(getattr(p, f) is None for p in posts)]
    return ChannelRollup(
        channel=channel,
        week_ending=week_ending,
        week_tz=week_tz,
        followers=followers,
        posts=len(posts),
        # Meta has no thread concept, so every post is rankable.
        ranked_posts=len(posts),
        engagement=engagement,
        impressions=None,          # Meta returns none. NULL, never 0, never estimated.
        engagement_per_post=_per_post(engagement, len(posts)),
        engagement_per_1k_followers=_per_1k(engagement, followers),
        median_engagement=_median(engagements),
        engagement_rate_pct=None,
        breakdown=[
            ("Likes", sum(p.likes or 0 for p in posts)),
            ("Comments", sum(p.comments or 0 for p in posts)),
            ("Shares", sum(p.shares or 0 for p in posts)),
        ],
        unreported=unreported,
        top=top,
    )


def combined(rollups: list[ChannelRollup]) -> dict:
    posts = sum(r.posts for r in rollups)
    engagement = sum(r.engagement for r in rollups)
    reach = [r.impressions for r in rollups if r.impressions]
    return {
        "posts": posts,
        "engagement": engagement,
        "engagement_per_post": _per_post(engagement, posts),
        "impressions": sum(reach) if reach else None,
        "reach_channels": [r.channel for r in rollups if r.has_reach],
        "followers": sum(r.followers or 0 for r in rollups) or None,
    }


def order_rollups(rollups: list[ChannelRollup]) -> list[ChannelRollup]:
    """Always X, Instagram, Facebook — the appendix order in §8."""
    return sorted(rollups, key=lambda r: CHANNELS.index(r.channel)
                  if r.channel in CHANNELS else 99)
