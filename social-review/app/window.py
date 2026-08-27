"""The reporting week (brief §3) — Monday 00:00:00 to Sunday 23:59:59 in WEEK_TZ.

Settled: WEEK_TZ=Asia/Kolkata, so the week closes at 18:30 UTC on Sunday and the cron is
`30 23 * * 0` (23:30 UTC Sunday == 05:00 IST Monday). Windows are computed with zoneinfo,
never a fixed +05:30 offset: India does not observe DST today, but hardcoding the offset
makes that bug silent if it ever changes, and makes the code untestable on other zones.

`window_end` is EXCLUSIVE throughout the service, in the DB and at both API edges.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

SUNDAY = 6  # date.weekday()


class WeekEndingError(ValueError):
    """Raised for a week_ending that is not a usable Sunday. Carries a machine-readable
    code and the nearest valid Sunday so the API can answer 422 with a real suggestion
    instead of silently rounding."""

    def __init__(self, code: str, message: str, nearest_sunday: date):
        super().__init__(message)
        self.code = code
        self.message = message
        self.nearest_sunday = nearest_sunday


def window_for(week_ending: date, week_tz: str) -> tuple[datetime, datetime]:
    """The seven full days ending on `week_ending` in `week_tz`. End is exclusive."""
    tz = ZoneInfo(week_tz)
    end = datetime.combine(week_ending + timedelta(days=1), time.min, tz)
    start = end - timedelta(days=7)
    return start, end


def contains(ts: datetime, week_ending: date, week_tz: str) -> bool:
    """Window membership. A post at 2026-08-16T18:29:59Z is inside the week ending
    2026-08-16 (IST); one at 18:30:00Z is outside it."""
    start, end = window_for(week_ending, week_tz)
    return start <= ts < end


def local_date(ts: datetime, week_tz: str) -> date:
    return ts.astimezone(ZoneInfo(week_tz)).date()


def last_completed_week_ending(week_tz: str, now: datetime | None = None) -> date:
    """The most recent Sunday whose week has fully closed in `week_tz`.

    Strictly before today's local date: on a Sunday the week ending that day is still
    open (it closes at 23:59:59 local), so the answer is the Sunday before.
    """
    now = now or datetime.now(timezone.utc)
    today = local_date(now, week_tz)
    back = (today.weekday() + 1) % 7 or 7
    return today - timedelta(days=back)


def nearest_sunday(d: date) -> date:
    """The Sunday nearest to `d`, ties going back (the completed week)."""
    ahead = (SUNDAY - d.weekday()) % 7
    behind = (d.weekday() + 1) % 7
    return d + timedelta(days=ahead) if ahead < behind else d - timedelta(days=behind)


def validate_week_ending(week_ending: date, week_tz: str, now: datetime | None = None) -> date:
    """Reject a week_ending that is not a Sunday, or whose window has not closed yet.

    "Not in the future" is implemented as "the week has closed": a Sunday's own week is
    still accruing until 23:59:59 local, and pulling it would produce a short week that
    looks like a real one on a slide.
    """
    latest = last_completed_week_ending(week_tz, now)
    if week_ending.weekday() != SUNDAY:
        raise WeekEndingError(
            "week_ending_not_sunday",
            f"week_ending {week_ending.isoformat()} is a "
            f"{week_ending.strftime('%A')} in {week_tz}; the nearest Sunday is "
            f"{nearest_sunday(week_ending).isoformat()}",
            nearest_sunday(week_ending),
        )
    if week_ending > latest:
        raise WeekEndingError(
            "week_not_closed",
            f"the week ending {week_ending.isoformat()} has not closed yet in {week_tz}; "
            f"the latest completed week ends {latest.isoformat()}",
            latest,
        )
    return week_ending


def previous_week_ending(week_ending: date) -> date:
    return week_ending - timedelta(days=7)


# ---- date wording (brief §8: never a bare range; always name the Sunday) ----
# strftime("%-d") is glibc-only, so day-of-month is formatted by hand.

def sunday_label(d: date) -> str:
    """'16 August 2026'"""
    return f"{d.day} {d:%B %Y}"


def short_label(d: date) -> str:
    """'16 Aug' — column headers only, where the full date is stated elsewhere."""
    return f"{d.day} {d:%b}"


def window_sentence(week_ending: date, week_tz: str) -> str:
    """'the seven full days Monday 10 August to Sunday 16 August 2026, India Standard Time'"""
    start = week_ending - timedelta(days=6)
    return (
        f"the seven full days {start:%A} {start.day} {start:%B} to "
        f"{week_ending:%A} {week_ending.day} {week_ending:%B %Y}, {tz_name(week_tz)}"
    )


def tz_name(week_tz: str) -> str:
    return {"Asia/Kolkata": "India Standard Time", "UTC": "UTC"}.get(week_tz, week_tz)
