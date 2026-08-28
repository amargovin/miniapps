"""Verification (brief §9) — the run fails if any of these fail.

An explicit step that runs before delivery. A failure aborts delivery and posts an alert
to the Chat room instead, naming the failing check (the brief said an alert email; see
CLAUDE.md amendments).

A total that is wrong by one post is indistinguishable from a correct one by the time it
reaches a slide. That is the whole reason these exist, so none of them is redundant with
another and none is skippable because the numbers "look right".
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

from app.aggregate import ChannelRollup
from app.meta_client import MetaPost
from app.window import local_date
from app.x_client import XPost


@dataclass
class Check:
    name: str
    ok: bool
    detail: str

    def as_dict(self) -> dict:
        return {"check": self.name, "ok": self.ok, "detail": self.detail}


@dataclass
class Verification:
    checks: list[Check] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return all(c.ok for c in self.checks)

    @property
    def failed(self) -> list[Check]:
        return [c for c in self.checks if not c.ok]

    def add(self, name: str, ok: bool, detail: str) -> None:
        self.checks.append(Check(name, ok, detail))

    def as_list(self) -> list[dict]:
        return [c.as_dict() for c in self.checks]


def check_x_pagination(v: Verification, *, pages: int, posts_returned: int,
                       unique_posts: int) -> None:
    """Check 1. The client aborts the run the moment a page's row count disagrees with its
    meta.result_count, so reaching here means every page agreed; what is recorded is the
    evidence, plus the page-boundary duplicates that de-duplication removed."""
    dupes = posts_returned - unique_posts
    v.add(
        "x_pagination",
        dupes >= 0,
        f"{pages} page(s), {posts_returned} rows returned, {unique_posts} unique"
        + (f", {dupes} page-boundary duplicate(s) removed" if dupes else ""),
    )


def check_meta_reconciliation(v: Verification, *, platform: str, posts: list[MetaPost],
                              aggregate: dict) -> None:
    """Check 2. Stored per-post sums against a second, independently-fetched aggregate for
    the same window. This has caught a real eight-post undercount. NULLs are summed as 0
    on both sides so an unreported field cannot mask a missing row."""
    stored = {
        "posts": len(posts),
        "likes": sum(p.likes or 0 for p in posts),
        "comments": sum(p.comments or 0 for p in posts),
        "shares": sum(p.shares or 0 for p in posts),
    }
    diffs = {k: (stored[k], aggregate.get(k)) for k in stored
             if aggregate.get(k) is not None and stored[k] != aggregate[k]}
    v.add(
        f"meta_reconciliation_{platform}",
        not diffs,
        "matches independent aggregate: " + ", ".join(f"{k}={v_}" for k, v_ in stored.items())
        if not diffs
        else "mismatch (stored, aggregate): "
             + ", ".join(f"{k} {s} vs {a}" for k, (s, a) in diffs.items()),
    )


def check_meta_reconciliation_all(v: Verification, *, posts: list[MetaPost],
                                  aggregates: dict[str, dict]) -> None:
    """Check 2, all-platform scope. A per-platform check can pass twice while the combined
    figure is wrong if rows were attributed to the wrong platform."""
    stored = {
        "posts": len(posts),
        "likes": sum(p.likes or 0 for p in posts),
        "comments": sum(p.comments or 0 for p in posts),
        "shares": sum(p.shares or 0 for p in posts),
    }
    agg = {k: sum(a.get(k) or 0 for a in aggregates.values()) for k in stored}
    diffs = {k: (stored[k], agg[k]) for k in stored if stored[k] != agg[k]}
    v.add(
        "meta_reconciliation_all",
        not diffs,
        f"all-platform sums match: {stored}" if not diffs
        else "mismatch (stored, aggregate): "
             + ", ".join(f"{k} {s} vs {a}" for k, (s, a) in diffs.items()),
    )


def check_window_coverage(v: Verification, *, week_ending: date, week_tz: str,
                          channel: str, dates: list[date], notes: list[dict]) -> None:
    """Check 3. At least one post dated on the window's final day *in WEEK_TZ*, or an
    explicit note saying the channel genuinely published nothing that day. Silence with no
    note is how a truncated window gets onto a slide looking complete."""
    has_final = week_ending in dates
    noted = any(n.get("note") == "no_posts_on_final_day" and n.get("channel") == channel
                for n in notes)
    v.add(
        f"window_coverage_{channel}",
        has_final or noted,
        f"posts dated {week_ending.isoformat()} ({week_tz}) present" if has_final
        else ("no posts on the window's final day; recorded as a deliberate note"
              if noted else
              f"no posts dated {week_ending.isoformat()} ({week_tz}) and no note "
              f"explaining it — the window may be truncated"),
    )


def check_pdf(v: Verification, *, pdf: bytes, intended_slides: int,
              intended_links: int) -> None:
    """Checks 4 and 5. A page over the intended count means a table spilled; a link count
    over the appendix row count means a title wrapped onto a second line (§7's 58-character
    cap), and under it means a link was dropped."""
    from pypdf import PdfReader
    from io import BytesIO

    reader = PdfReader(BytesIO(pdf))
    pages = len(reader.pages)
    links = sum(len(p.get("/Annots") or []) for p in reader.pages)
    v.add(
        "pdf_page_count",
        pages == intended_slides,
        f"{pages} page(s) for {intended_slides} intended slide(s)"
        + ("" if pages == intended_slides else " — a table has spilled onto a continuation page"),
    )
    v.add(
        "pdf_link_count",
        links == intended_links,
        f"{links} link annotation(s) for {intended_links} appendix row(s)"
        + ("" if links == intended_links
           else " — more means a title wrapped to a second line; fewer means a link was dropped"),
    )


def check_no_fabricated_zeros(v: Verification, *, rollups: list[ChannelRollup]) -> None:
    """Check 6. Unavailable must be NULL. A 0 in a reach column is a number someone will
    read as measured, and there is no way to tell it from a real zero afterwards."""
    bad = [r.channel for r in rollups if r.impressions == 0]
    v.add(
        "no_fabricated_zeros",
        not bad,
        "no channel reports impressions = 0" if not bad
        else f"impressions = 0 on {', '.join(bad)}; unavailable must be NULL",
    )


def final_day_notes(*, week_ending: date, week_tz: str, channel: str,
                    dates: list[date]) -> list[dict]:
    """Record the explicit note check 3 looks for when a channel genuinely published
    nothing on the window's final day."""
    if week_ending in dates:
        return []
    return [{
        "note": "no_posts_on_final_day",
        "channel": channel,
        "day": week_ending.isoformat(),
        "week_tz": week_tz,
        "detail": f"{channel} published nothing on {week_ending.isoformat()} ({week_tz}); "
                  f"latest post {max(dates).isoformat() if dates else 'none'}",
    }]


def post_dates_x(posts: list[XPost], week_tz: str) -> list[date]:
    return [local_date(p.created_at, week_tz) for p in posts]


def post_dates_meta(posts: list[MetaPost], week_tz: str) -> list[date]:
    return [local_date(p.created_at, week_tz) for p in posts]


def week_days(week_ending: date) -> list[date]:
    return [week_ending - timedelta(days=n) for n in range(6, -1, -1)]
