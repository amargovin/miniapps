"""The pipeline end to end against a real Postgres, with faked vendor transports.

Build order step 7 names the two tests worth having above all others: 409 on a concurrent
run and 409-without-force on an already-stored week. Those are the cost guards.
"""
from datetime import date, timedelta

import httpx
import pytest

from app import store
from app.config import get_settings
from app.notify import NullNotifier
from app.meta_client import MetaClient
from app.pipeline import (AlreadyStored, ConcurrentRun, NoDataStored, RunRequest,
                          project_cost_usd, render_stored_week, renotify_run, run_pipeline,
                          week_range)
from app.window import window_for
from app.x_client import XClient
from tests.conftest import fb_row, ig_row, utc, x_page, x_row

WE = date(2026, 8, 16)
IST = "Asia/Kolkata"
START, END = window_for(WE, IST)
NOW = utc(2026, 8, 17, 6)          # Monday 11:30 IST, the week has closed


# ---------------- fake vendors ----------------

def x_client(*, posts=None, fail_402=False, followers=342_772):
    rows = posts if posts is not None else [
        x_row(str(2_000 - i), START + timedelta(days=i % 7, hours=9 + (i % 5)),
              text=f"Headline {i} about industrial policy and the state",
              likes=50 - (i % 40), impressions=5_000 + i)
        for i in range(12)
    ]

    def handler(request):
        path = request.url.path
        if fail_402 and "/tweets" in path:
            return httpx.Response(402, json={"title": "credits depleted"})
        if "/tweets" in path:
            return httpx.Response(200, json=x_page(rows))
        if "/usage/credits" in path:
            return httpx.Response(200, json={"data": {"total_balance": 95.25}})
        if "/usage/tweets" in path:
            return httpx.Response(200, json={"data": {"project_usage": 1700}})
        return httpx.Response(200, json={"data": {
            "id": "2451476942", "public_metrics": {"followers_count": followers}}})

    return XClient("bearer", "2451476942",
                   client=httpx.Client(transport=httpx.MockTransport(handler)),
                   retry_budget_s=0.4, retry_max_wait_s=0.05)


def meta_client(*, ig=4, fb=6, fb_drop_one_from_aggregate=False):
    ig_rows = [ig_row(f"i{i}", START + timedelta(days=i, hours=10), likes=400 - i * 20)
               for i in range(ig)]
    # a post on the window's final day, so §9 check 3 passes without a note
    fb_rows = [fb_row(f"f{i}", START + timedelta(days=min(i, 6), hours=11),
                      likes=20 - i, comments=0, shares=1) for i in range(fb)]

    def handler(request):
        path = request.url.path
        fields = request.url.params.get("fields", "")
        if path.endswith("/media"):
            return httpx.Response(200, json={"data": ig_rows})
        if path.endswith("/posts"):
            rows = fb_rows
            if fb_drop_one_from_aggregate and "message" not in fields:
                rows = fb_rows[:-1]          # the aggregate pass disagrees with the pull
            return httpx.Response(200, json={"data": rows})
        if "followers_count" in fields and "media_count" in fields:
            return httpx.Response(200, json={"followers_count": 59_742, "media_count": 900})
        return httpx.Response(200, json={"followers_count": 633_871})

    return MetaClient("token", fb_page_id="670321879700525",
                      ig_user_id="17841400214702908",
                      client=httpx.Client(transport=httpx.MockTransport(handler)),
                      retry_budget_s=0.4, retry_max_wait_s=0.05)


def run(conn, **kw):
    req = RunRequest(week_ending=kw.pop("week_ending", WE), **{
        k: kw.pop(k) for k in ("force", "channels", "notify", "dry_run") if k in kw})
    return run_pipeline(req, settings=get_settings(), x_client=kw.pop("x", None) or x_client(),
                        meta_client=kw.pop("meta", None) or meta_client(),
                        notifier=kw.pop("notifier", None) or NullNotifier(),
                        conn=conn, now=NOW, **kw)


# ---------------- the two cost guards (step 7) ----------------

def test_a_second_run_is_refused_while_one_holds_the_advisory_lock(conn, _schema):
    """§2.1: only one run at a time across all three services."""
    import psycopg
    holder = psycopg.connect(_schema)
    try:
        assert store.try_advisory_lock(holder)
        holder.execute(
            "INSERT INTO runs (week_ending, week_tz, window_start, window_end, status) "
            "VALUES (%s,%s,%s,%s,'running')", (WE, IST, START, END))
        holder.commit()
        with pytest.raises(ConcurrentRun) as e:
            run(conn)
        assert e.value.code == "run_in_progress"
        assert e.value.holder_run_id is not None
    finally:
        store.release_advisory_lock(holder)
        holder.close()


def test_the_lock_is_released_so_the_next_run_can_take_it(conn):
    run(conn, force=True, notify=False)
    out = run(conn, force=True, notify=False)
    assert out.status == "ok"


def test_a_week_already_pulled_is_refused_without_force(conn):
    """§10: re-running the same week on a later UTC day is billed in full."""
    first = run(conn, force=True, notify=False)
    assert first.status == "ok"
    with pytest.raises(AlreadyStored) as e:
        run(conn)
    assert e.value.code == "week_already_stored"
    assert e.value.run_id == first.run_id
    assert "force=true" in str(e.value)


def test_force_re_pulls_and_corrects_rows_rather_than_duplicating_them(conn):
    run(conn, force=True, notify=False)
    before = store.get_weekly_totals(conn, WE)["x"]["engagement"]
    # metrics keep accruing after publication, so a re-run legitimately reads higher
    hotter = [x_row(str(2_000 - i), START + timedelta(days=i % 7, hours=9),
                    likes=500, impressions=9_000) for i in range(12)]
    out = run(conn, force=True, notify=False, x=x_client(posts=hotter))
    after = store.get_weekly_totals(conn, WE)["x"]
    assert out.status == "ok"
    assert after["engagement"] > before
    assert after["posts"] == 12                    # corrected, not doubled
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM posts_x WHERE week_ending = %s", (WE,))
        assert cur.fetchone()[0] == 12


def test_the_seeded_imported_rows_do_not_trip_the_api_guard(conn):
    """The guard is about paying twice for the same pull; imported history never was."""
    assert store.get_weekly_totals(conn, date(2026, 8, 9))["x"]["source"] == "imported"
    assert not store.has_api_rows(conn, date(2026, 8, 9))


# ---------------- a full run ----------------

def test_a_full_run_stores_posts_rollups_a_deck_and_the_raw_payloads(conn):
    out = run(conn, force=True, notify=False)
    assert out.status == "ok"
    assert sorted(out.channels_ok) == ["facebook", "instagram", "x"]
    assert out.post_counts == {"x": 12, "instagram": 4, "facebook": 6}

    totals = store.get_weekly_totals(conn, WE)
    assert set(totals) == {"x", "instagram", "facebook"}
    assert totals["x"]["week_tz"] == IST
    assert totals["x"]["source"] == "api"
    assert totals["instagram"]["impressions"] is None       # NULL, never 0
    assert totals["x"]["impressions"] > 0

    report = store.get_report(conn, WE)
    assert report["filename"] == "swarajya_social_review_2026-08-16.pdf"
    assert report["slide_count"] == 4
    assert bytes(report["pdf"])[:4] == b"%PDF"

    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM raw_payloads WHERE run_id = %s", (out.run_id,))
        assert cur.fetchone()[0] >= 3

    run_row = store.get_run(conn, out.run_id)
    assert run_row["status"] == "ok"
    assert run_row["window_start"] == START      # same instant, UTC-normalised by pg
    assert run_row["window_end"] == END
    assert run_row["pdf_available"]
    assert float(run_row["x_cost_usd"]) == pytest.approx(12 * 0.001 + 0.010)


def test_all_six_verification_checks_run_and_pass(conn):
    out = run(conn, force=True, notify=False)
    names = {c["check"] for c in out.verification}
    assert "x_pagination" in names
    assert "meta_reconciliation_facebook" in names
    assert "meta_reconciliation_instagram" in names
    assert "meta_reconciliation_all" in names
    assert {"window_coverage_x", "window_coverage_instagram",
            "window_coverage_facebook"} <= names
    assert "pdf_page_count" in names and "pdf_link_count" in names
    assert "no_fabricated_zeros" in names
    assert all(c["ok"] for c in out.verification), [c for c in out.verification
                                                    if not c["ok"]]


def test_a_reconciliation_mismatch_aborts_delivery_and_alerts_instead(conn):
    """§9: a failure aborts delivery and posts an alert naming the failing check."""
    n = NullNotifier()
    out = run(conn, force=True, notify=True, notifier=n,
              meta=meta_client(fb_drop_one_from_aggregate=True))
    assert not all(c["ok"] for c in out.verification)
    assert not out.delivered
    assert len(n.sent) == 1
    assert "verification FAILED" in n.sent[0]
    assert "meta_reconciliation_facebook" in n.sent[0]
    assert store.get_run(conn, out.run_id)["status"] == "partial"


def test_a_successful_run_posts_the_summary_and_the_deck_link(conn):
    n = NullNotifier()
    out = run(conn, force=True, notify=True, notifier=n)
    assert out.delivered
    assert len(n.sent) == 1
    assert "Swarajya social review — week ending Sunday 16 August 2026" in n.sent[0]
    assert "/v1/decks/2026-08-16.pdf?sig=" in n.sent[0]


def test_x_credit_depletion_completes_the_meta_channels_and_marks_x_unavailable(empty_conn):
    """§4: never a zero, never last week's number carried forward."""
    conn = empty_conn
    out = run(conn, force=True, notify=False, x=x_client(fail_402=True))
    assert out.status == "partial"
    assert out.channels_failed == ["x"]
    assert sorted(out.channels_ok) == ["facebook", "instagram"]
    totals = store.get_weekly_totals(conn, WE)
    assert "x" not in totals                         # no row at all, rather than zeros
    assert out.slide_count == 3                      # and no X appendix either
    note = next(n for n in out.notes if n["note"] == "channel_unavailable")
    assert note["channel"] == "x"


def test_an_unavailable_channel_is_not_filled_in_from_a_stored_row(conn):
    """The seeded rows include this very week, so a substitution would be invisible: a
    deck saying "X unavailable" must not also show an X row."""
    assert store.get_weekly_totals(conn, WE)["x"]["source"] == "imported"
    out = run(conn, force=True, notify=False, x=x_client(fail_402=True))
    assert out.slide_count == 3
    assert not any(n.get("note") == "channel_from_stored_rows" and n["channel"] == "x"
                   for n in out.notes)
    # the imported row is left exactly as it was, not overwritten with zeros
    after = store.get_weekly_totals(conn, WE)["x"]
    assert after["source"] == "imported" and after["engagement"] == 21217


def test_a_dry_run_writes_nothing_and_sends_nothing_but_still_reports_cost(empty_conn):
    conn = empty_conn
    n = NullNotifier()
    out = run(conn, dry_run=True, notifier=n)
    assert out.run_id is None
    assert out.x_cost_usd == pytest.approx(12 * 0.001 + 0.010)
    assert store.get_weekly_totals(conn, WE) == {}
    assert store.get_report(conn, WE) is None
    assert n.sent == []
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM runs")
        assert cur.fetchone()[0] == 0


def test_a_channel_subset_re_pull_keeps_the_other_channels_stored_rows(conn):
    """The §11 recipe: X came back after a 402, pull just that channel and re-render."""
    run(conn, force=True, notify=False, x=x_client(fail_402=True))
    out = run(conn, force=True, notify=False, channels=("x",))
    assert out.channels_ok == ["x"]
    assert out.slide_count == 4                      # still a three-channel deck
    assert any(n["note"] == "channel_from_stored_rows" for n in out.notes)
    assert set(store.get_weekly_totals(conn, WE)) == {"x", "instagram", "facebook"}


def test_an_unhandled_failure_marks_the_run_failed_and_posts_a_notice(conn):
    class Boom(XClient):
        def fetch_followers(self):
            raise RuntimeError("kaboom")

    broken = Boom("b", "2451476942",
                  client=httpx.Client(transport=httpx.MockTransport(
                      lambda r: httpx.Response(200, json={"data": {"total_balance": 1.0}}))))
    n = NullNotifier()
    with pytest.raises(RuntimeError, match="kaboom"):
        run(conn, force=True, notify=True, notifier=n, x=broken)
    row = store.list_runs(conn, limit=1)[0]
    assert row["status"] == "failed"
    assert n.sent and "run FAILED" in n.sent[0]


def test_the_run_row_survives_a_failure_but_the_week_is_not_half_written(empty_conn):
    conn = empty_conn

    class HalfWay(MetaClient):
        def fetch_facebook(self, start, end):
            raise RuntimeError("died after instagram")

    broken = HalfWay("t", fb_page_id="1", ig_user_id="2",
                     client=httpx.Client(transport=httpx.MockTransport(
                         lambda r: httpx.Response(200, json={"data": []}))))
    with pytest.raises(RuntimeError):
        run(conn, force=True, notify=False, meta=broken)
    assert store.get_weekly_totals(conn, WE) == {}
    assert store.list_runs(conn, limit=1)[0]["status"] == "failed"


# ---------------- zero-cost paths ----------------

def test_render_from_stored_rows_makes_no_vendor_calls(conn):
    run(conn, force=True, notify=False)

    def forbidden(request):                     # any vendor call here is a bug
        raise AssertionError(f"vendor call during re-render: {request.url}")

    deck = render_stored_week(WE, conn=conn)
    assert deck.slide_count == 4
    assert deck.link_count == 12 + 4 + 6
    assert deck.pdf[:4] == b"%PDF"


def test_render_of_an_unstored_week_is_a_clean_error(conn):
    with pytest.raises(NoDataStored):
        render_stored_week(date(2026, 7, 12), conn=conn)


def test_renotify_reposts_without_pulling_anything(conn):
    out = run(conn, force=True, notify=False)
    n = NullNotifier()
    text = renotify_run(out.run_id, notifier=n, conn=conn)
    assert "week ending Sunday 16 August 2026" in text
    assert n.sent == [text]


def test_the_stored_appendix_reproduces_the_rendered_one(conn):
    """load_rollups is the re-render path; it must rebuild what the live run rendered."""
    live = run(conn, force=True, notify=False)
    rolls = {r.channel: r for r in store.load_rollups(conn, WE)}
    assert rolls["x"].ranked_posts == 12
    assert rolls["x"].top[0]["engagement"] >= rolls["x"].top[-1]["engagement"]
    assert rolls["instagram"].unreported == ["shares"]   # the media edge has no such field
    assert rolls["facebook"].unreported == ["comments"]
    assert live.slide_count == 4


# ---------------- cost projection and backfill ----------------

def test_cost_is_projected_from_the_most_recent_stored_week(conn):
    # the seeded 2026-08-09 X row holds 312 posts
    assert project_cost_usd(conn, WE, ("x", "instagram", "facebook")) == \
        pytest.approx(312 * 0.001 + 0.010)


def test_a_meta_only_run_projects_no_x_cost(conn):
    assert project_cost_usd(conn, WE, ("instagram", "facebook")) == 0.0


def test_week_range_walks_forward_so_each_week_has_its_predecessor(settings):
    assert week_range(date(2026, 8, 2), date(2026, 8, 16), settings) == [
        date(2026, 8, 2), date(2026, 8, 9), date(2026, 8, 16)]


# ---------------- idempotency ----------------

def test_an_idempotency_key_maps_to_the_original_run_for_a_day(conn):
    out = run(conn, force=True, notify=False)
    store.record_idempotency_key(conn, "key-1", out.run_id)
    assert store.idempotent_run_id(conn, "key-1") == out.run_id
    assert store.idempotent_run_id(conn, "key-2") is None
    assert store.idempotent_run_id(conn, "key-1", ttl_hours=0) is None


def test_verification_outcomes_are_persisted_on_the_run(conn):
    """§2.1: GET /v1/runs/{id} reports verification outcomes. Without persistence they
    live only in the caller's stdout, which answers nothing a week later."""
    out = run(conn, force=True, notify=False)
    row = store.get_run(conn, out.run_id)
    assert row["verification"] is not None
    assert row["verification"]["ok"] is True
    names = {c["check"] for c in row["verification"]["checks"]}
    assert "no_fabricated_zeros" in names and "meta_reconciliation_all" in names
    assert len(row["verification"]["checks"]) == len(out.verification)
    assert row["report"] == {"slide_count": 4, "link_count": out.link_count}


def test_a_failed_verification_is_persisted_too(conn):
    out = run(conn, force=True, notify=False,
              meta=meta_client(fb_drop_one_from_aggregate=True))
    row = store.get_run(conn, out.run_id)
    assert row["verification"]["ok"] is False
    failed = [c for c in row["verification"]["checks"] if not c["ok"]]
    assert any(c["check"] == "meta_reconciliation_facebook" for c in failed)


def test_the_cli_treats_an_already_stored_week_as_a_no_op_success(conn, monkeypatch):
    """A correct refusal must not present as a crash: a scheduler retrying a non-zero exit
    would page someone about a healthy system. The refusal still stands — nothing is
    re-pulled — but the process exits 0."""
    from app import cli

    run(conn, force=True, notify=False)          # week is now stored with source='api'
    calls = []
    monkeypatch.setattr(cli, "run_pipeline",
                        lambda req, **kw: calls.append(req) or (_ for _ in ()).throw(
                            AlreadyStored(WE, 1)))
    rc = cli.main(["run", "--week-ending", "2026-08-16", "--no-notify"])
    assert rc == 0
    assert len(calls) == 1                        # it tried, and was refused


def test_the_cli_still_fails_on_a_concurrent_run(conn, monkeypatch):
    """A lock conflict is genuinely retryable-later, so it keeps EX_TEMPFAIL."""
    from app import cli

    monkeypatch.setattr(cli, "run_pipeline",
                        lambda req, **kw: (_ for _ in ()).throw(ConcurrentRun(7)))
    assert cli.main(["run", "--week-ending", "2026-08-16"]) == 75
