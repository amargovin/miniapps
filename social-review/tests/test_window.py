"""Brief §3 — the reporting week. The IST boundary is unit-tested directly because §9
check 3 names both edges explicitly."""
from datetime import date, datetime, timezone

import pytest

from app.window import (WeekEndingError, contains, last_completed_week_ending, local_date,
                        nearest_sunday, previous_week_ending, sunday_label,
                        validate_week_ending, window_for, window_sentence)

IST = "Asia/Kolkata"


def test_window_is_monday_to_sunday_ist():
    start, end = window_for(date(2026, 8, 16), IST)
    assert start.isoformat() == "2026-08-10T00:00:00+05:30"
    assert end.isoformat() == "2026-08-17T00:00:00+05:30"          # exclusive
    assert (end - start).days == 7


def test_ist_edges_exactly_as_specified():
    """§9 check 3: 2026-08-16T18:29:59Z is inside the week ending 2026-08-16 and
    2026-08-16T18:30:00Z is outside it."""
    inside = datetime(2026, 8, 16, 18, 29, 59, tzinfo=timezone.utc)
    outside = datetime(2026, 8, 16, 18, 30, 0, tzinfo=timezone.utc)
    assert contains(inside, date(2026, 8, 16), IST)
    assert not contains(outside, date(2026, 8, 16), IST)
    # and the one that falls out is the first instant of the *next* week
    assert contains(outside, date(2026, 8, 23), IST)


def test_window_opens_at_the_start_of_monday_ist():
    assert contains(datetime(2026, 8, 9, 18, 30, 0, tzinfo=timezone.utc),
                    date(2026, 8, 16), IST)
    assert not contains(datetime(2026, 8, 9, 18, 29, 59, tzinfo=timezone.utc),
                        date(2026, 8, 16), IST)


def test_window_is_not_a_fixed_offset():
    """The same week_ending in a DST-observing zone must not produce the IST instants —
    proof the computation goes through zoneinfo rather than a hardcoded +05:30."""
    ist_start, _ = window_for(date(2026, 8, 16), IST)
    ny_start, _ = window_for(date(2026, 8, 16), "America/New_York")
    assert ist_start.utcoffset() != ny_start.utcoffset()


def test_cron_firing_resolves_to_the_week_that_just_closed():
    """23:30 UTC Sunday == 05:00 IST Monday; the week that closed is the Sunday before."""
    fired = datetime(2026, 8, 16, 23, 30, tzinfo=timezone.utc)
    assert last_completed_week_ending(IST, fired) == date(2026, 8, 16)


def test_a_sunday_before_its_own_week_closes_resolves_to_the_previous_sunday():
    midday_sunday = datetime(2026, 8, 16, 6, 0, tzinfo=timezone.utc)   # 11:30 IST Sunday
    assert last_completed_week_ending(IST, midday_sunday) == date(2026, 8, 9)


def test_non_sunday_is_rejected_naming_the_nearest_sunday():
    with pytest.raises(WeekEndingError) as e:
        validate_week_ending(date(2026, 8, 18), IST,
                             datetime(2026, 9, 1, tzinfo=timezone.utc))
    assert e.value.code == "week_ending_not_sunday"
    assert e.value.nearest_sunday == date(2026, 8, 16)
    assert "2026-08-16" in e.value.message


def test_an_unclosed_week_is_rejected_naming_the_latest_complete_one():
    with pytest.raises(WeekEndingError) as e:
        validate_week_ending(date(2026, 8, 23), IST,
                             datetime(2026, 8, 20, tzinfo=timezone.utc))
    assert e.value.code == "week_not_closed"
    assert e.value.nearest_sunday == date(2026, 8, 16)


def test_a_closed_sunday_passes():
    assert validate_week_ending(date(2026, 8, 16), IST,
                                datetime(2026, 8, 17, 6, 0, tzinfo=timezone.utc)) \
        == date(2026, 8, 16)


@pytest.mark.parametrize("d,expected", [
    (date(2026, 8, 18), date(2026, 8, 16)),   # Tuesday -> back
    (date(2026, 8, 20), date(2026, 8, 23)),   # Thursday -> forward
    (date(2026, 8, 16), date(2026, 8, 16)),   # already Sunday
])
def test_nearest_sunday(d, expected):
    assert nearest_sunday(d) == expected


def test_previous_week_ending_is_seven_days():
    assert previous_week_ending(date(2026, 8, 16)) == date(2026, 8, 9)


def test_date_wording_never_leaves_a_bare_range():
    """§8's date rule: name the Sunday, state both ends in full, name the timezone."""
    s = window_sentence(date(2026, 8, 16), IST)
    assert s == ("the seven full days Monday 10 August to Sunday 16 August 2026, "
                 "India Standard Time")
    assert sunday_label(date(2026, 8, 16)) == "16 August 2026"


def test_local_date_uses_week_tz():
    ts = datetime(2026, 8, 16, 19, 0, tzinfo=timezone.utc)   # 00:30 IST on the 17th
    assert local_date(ts, IST) == date(2026, 8, 17)
    assert local_date(ts, "UTC") == date(2026, 8, 16)
