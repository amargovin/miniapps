"""The findings summary (brief §8) — three or four sentences, generated from the data.

This is the Chat message body (the brief said email; see CLAUDE.md amendments). Compute
every candidate each week and mention whichever fire:

  - a story that led one channel and never ran on another;
  - the same story posted twice on X inside a few hours, splitting its own engagement;
  - median against mean, as a concentration signal;
  - replies and comments as a share of engagement.

Nothing here is templated prose with numbers dropped in: each sentence exists only when
its candidate fires, so a quiet week produces a short message rather than a padded one.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, timedelta

from app.aggregate import DISPLAY_NAME, ChannelRollup
from app.window import sunday_label, tz_name
from app.x_client import XPost

DUP_PREFIX = 60          # §8: normalise the first 60 characters
DUP_WINDOW_H = 6         # "inside a few hours"
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)
_URL = re.compile(r"(?:https?://|www\.)\S+", re.I)
_STOP = {"the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "was",
         "were", "be", "as", "at", "by", "with", "that", "this", "it", "its", "from",
         "has", "have", "had", "not", "but", "will", "can", "new", "how", "why", "what"}


def normalise(text: str, *, prefix: int = DUP_PREFIX) -> str:
    """Lowercased, URL- and punctuation-stripped, whitespace-collapsed first N chars."""
    s = _URL.sub(" ", text or "").lower()
    s = _PUNCT.sub(" ", s)
    return " ".join(s.split())[:prefix]


def _tokens(text: str) -> set[str]:
    return {w for w in normalise(text, prefix=400).split() if len(w) > 3 and w not in _STOP}


@dataclass
class Duplicates:
    stories: int = 0                 # distinct stories posted more than once
    posts: int = 0                   # posts involved across those stories
    second_copy_engagement: int = 0  # engagement sitting in the smaller copies
    examples: list[dict] = field(default_factory=list)


def duplicate_stories(posts: list[XPost], *, window_hours: int = DUP_WINDOW_H) -> Duplicates:
    """The same story posted twice on X inside a few hours, splitting its own engagement.

    Heads only — thread continuations share a head's opening words by construction and
    would otherwise register as duplicates of it.
    """
    groups: dict[str, list[XPost]] = {}
    for p in sorted((p for p in posts if p.is_head), key=lambda p: p.created_at):
        key = normalise(p.text)
        if len(key) < 20:            # too short to identify a story; do not guess
            continue
        groups.setdefault(key, []).append(p)

    out = Duplicates()
    span = timedelta(hours=window_hours)
    for key, group in groups.items():
        if len(group) < 2:
            continue
        if group[-1].created_at - group[0].created_at > span:
            continue
        ranked = sorted(group, key=lambda p: -p.engagement)
        smaller = sum(p.engagement for p in ranked[1:])
        out.stories += 1
        out.posts += len(group)
        out.second_copy_engagement += smaller
        out.examples.append({
            "key": key,
            "post_ids": [p.post_id for p in group],
            "engagement": [p.engagement for p in group],
            "smaller_copy_engagement": smaller,
            "title": ranked[0].title or key,
        })
    out.examples.sort(key=lambda e: -e["smaller_copy_engagement"])
    return out


def short_name(channel: str) -> str:
    """'X', 'Instagram', 'Facebook' — the handle belongs on the deck, not mid-sentence."""
    return DISPLAY_NAME.get(channel, channel).split("/")[0].strip()


def single_channel_leaders(rollups: list[ChannelRollup]) -> list[dict]:
    """A story that led one channel and never ran on another.

    Matched on content-word overlap (Jaccard >= 0.5) against every post that channel's
    peers published, not on identical text: the same story is captioned differently on
    Instagram than it is headlined on X.
    """
    by_channel = {r.channel: r for r in rollups}
    out = []
    for channel, r in by_channel.items():
        if not r.top:
            continue
        lead = r.top[0]
        lead_tokens = _tokens(lead["title"])
        if len(lead_tokens) < 3:
            continue
        missing = []
        for other, o in by_channel.items():
            if other == channel or not o.top:
                continue
            best = max((_jaccard(lead_tokens, _tokens(t["title"])) for t in o.top),
                       default=0.0)
            if best < 0.5:
                missing.append(other)
        if missing:
            out.append({"channel": channel, "title": lead["title"],
                        "engagement": lead["engagement"], "absent_from": missing})
    return out


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _pct_change(prev, cur) -> float | None:
    try:
        p, c = float(prev), float(cur)
    except (TypeError, ValueError):
        return None
    return round(100.0 * (c - p) / p, 1) if p else None


def _fmt_pct(v: float | None) -> str:
    return "—" if v is None else f"{v:+.1f}%"


def build_summary(
    *,
    week_ending: date,
    week_tz: str,
    rollups: list[ChannelRollup],
    prior: dict[str, dict],          # channel -> prior weekly_totals row (may be empty)
    prior_week_ending: date | None,
    duplicates: Duplicates | None,
    unavailable: list[str],
    notes: list[dict],
) -> str:
    """Three or four sentences. Sentences that have nothing to say are omitted."""
    sentences: list[str] = []
    by = {r.channel: r for r in rollups}

    # 1. What moved, and whether volume rather than performance explains it.
    #
    # §3 forbids a week-on-week delta across rows whose week_tz differs, and the deck
    # prints n/c for exactly these rows — so the message must not quietly compute one
    # either. It says why instead.
    movers = []
    incomparable: list[str] = []
    for r in rollups:
        p = prior.get(r.channel)
        if not p:
            continue
        if p.get("week_tz") != week_tz:
            incomparable.append(p.get("week_tz") or "an unknown timezone")
            continue
        d_eng = _pct_change(p.get("engagement"), r.engagement)
        d_posts = _pct_change(p.get("posts"), r.posts)
        d_pp = _pct_change(p.get("engagement_per_post"), r.engagement_per_post)
        if d_eng is None:
            continue
        movers.append((abs(d_eng), r, d_eng, d_posts, d_pp))
    if movers:
        movers.sort(key=lambda t: -t[0])
        _, r, d_eng, d_posts, d_pp = movers[0]
        prev_lab = f" against week ending Sunday {sunday_label(prior_week_ending)}" \
            if prior_week_ending else ""
        s = (f"{short_name(r.channel)} engagement moved {_fmt_pct(d_eng)}"
             f"{prev_lab}, on {_fmt_pct(d_posts)} posting volume")
        if d_posts is not None and abs(d_posts) >= 20 and d_pp is not None:
            s += (f", so the volume swing rather than performance explains most of it — "
                  f"engagement per post moved {_fmt_pct(d_pp)}")
        sentences.append(s + ".")
    elif incomparable:
        prior_lab = (f" (week ending Sunday {sunday_label(prior_week_ending)})"
                     if prior_week_ending else "")
        sentences.append(
            f"No week-on-week change is reported: the only stored prior week{prior_lab} "
            f"was computed on {tz_name(incomparable[0])} weeks against "
            f"{tz_name(week_tz)} here, so the two windows are not the same seven days."
        )

    # 2. Concentration: median against mean.
    x = by.get("x")
    if x and x.median_engagement and x.engagement_per_post:
        ratio = x.engagement_per_post / x.median_engagement
        if ratio >= 1.5:
            sentences.append(
                f"X engagement stayed concentrated: a mean of {x.engagement_per_post:,.1f} "
                f"per post against a median of {x.median_engagement:,}, so a small number "
                f"of posts carried the week."
            )

    # 3. Duplicate stories splitting their own engagement.
    if duplicates and duplicates.stories:
        sentences.append(
            f"{duplicates.stories} stories were posted twice on X within "
            f"{DUP_WINDOW_H} hours, across {duplicates.posts} posts, with "
            f"{duplicates.second_copy_engagement:,} engagement sitting in the smaller copy."
        )

    # 4. Distribution failure — a story that led one channel and never ran elsewhere.
    for lead in single_channel_leaders(rollups)[:1]:
        where = " or ".join(short_name(c) for c in lead["absent_from"])
        sentences.append(
            f"The week's best {short_name(lead['channel'])} post (“{lead['title']}”, "
            f"{lead['engagement']:,} engagement) has no counterpart on {where}."
        )

    # 5. Replies and comments as a share of engagement.
    if x and x.engagement:
        conv = dict(x.breakdown).get("Replies", 0) + dict(x.breakdown).get("Quotes", 0)
        share = 100.0 * conv / x.engagement
        if share < 3.0:
            sentences.append(
                f"Conversation stayed thin on X: replies and quotes were {share:.1f}% of "
                f"engagement, so the audience is amplifying rather than arguing."
            )

    if unavailable:
        sentences.append(
            f"{', '.join(unavailable)} could not be pulled this week and is reported as "
            f"unavailable rather than zero."
        )
    for n in notes:
        if n.get("note") == "x_thread_head_missing":
            sentences.append(
                f"{n['continuations']} thread continuations survive a deleted head "
                f"({n['thread_root']}); their engagement is in the totals but they cannot "
                f"be ranked."
            )
            break

    return " ".join(sentences[:5])
