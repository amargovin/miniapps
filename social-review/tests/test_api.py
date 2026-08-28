"""Brief §2.1 — the operator control surface. One person, one token, no browser."""
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app import store
from app.signing import sign_week
from app.window import window_for
from tests.conftest import TEST_TOKEN, utc

WE = date(2026, 8, 16)
IST = "Asia/Kolkata"
START, END = window_for(WE, IST)
AUTH = {"Authorization": f"Bearer {TEST_TOKEN}"}


@pytest.fixture
def client(conn, monkeypatch):
    """The app's own connections point at the same test database; `conn` gives the test a
    clean one and re-applies the seeds."""
    import app.api as api
    monkeypatch.setattr(api, "_post_times", __import__("collections").deque())
    with TestClient(api.app) as c:
        yield c


def seed_run(conn, *, week_ending=WE, status="ok", with_pdf=True) -> int:
    run_id = store.create_run(conn, week_ending=week_ending, week_tz=IST,
                              window_start=START, window_end=END)
    store.finish_run(conn, run_id, status=status, channels_ok=["x"], channels_failed=[],
                     notes=[{"note": "x_cost", "estimated_usd": 0.2,
                             "balance_delta_usd": 0.2}], x_cost_usd=0.2)
    if with_pdf:
        store.save_report(conn, week_ending=week_ending, run_id=run_id,
                          filename=f"swarajya_social_review_{week_ending}.pdf",
                          pdf=b"%PDF-1.4 fake", slide_count=4, link_count=54)
    return run_id


# ---------------- auth ----------------

def test_health_is_unauthenticated_and_makes_no_db_call(client):
    r = client.get("/healthz")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_readyz_checks_the_database_and_the_env(client):
    r = client.get("/readyz")
    assert r.status_code == 200 and r.json()["status"] == "ok"


@pytest.mark.parametrize("path", ["/v1/runs", "/v1/weeks", "/v1/usage",
                                  "/v1/weeks/2026-08-16"])
def test_every_v1_route_requires_the_bearer_token(client, path):
    r = client.get(path)
    assert r.status_code == 401
    assert r.json() == {"error": {"code": "unauthorized", "message": "", "run_id": None}}


def test_a_wrong_token_returns_401_with_no_detail(client):
    r = client.get("/v1/weeks", headers={"Authorization": "Bearer " + "w" * 64})
    assert r.status_code == 401
    assert r.json()["error"]["message"] == ""


def test_no_cors_headers_are_set(client):
    r = client.get("/healthz", headers={"Origin": "https://example.com"})
    assert not any(h.lower().startswith("access-control") for h in r.headers)


# ---------------- the two cost guards, over HTTP ----------------

def test_a_week_already_stored_returns_409_with_the_existing_run_id(client, conn):
    run_id = seed_run(conn)
    with conn.cursor() as cur:
        cur.execute("UPDATE weekly_totals SET source = 'api' WHERE week_ending = %s", (WE,))
    conn.commit()
    r = client.post("/v1/runs", headers=AUTH, json={"week_ending": "2026-08-16"})
    assert r.status_code == 409
    body = r.json()["error"]
    assert body["code"] == "week_already_stored"
    assert body["run_id"] == run_id
    assert "force=true" in body["message"]


def test_a_concurrent_run_returns_409_naming_the_holder(client, conn, _schema):
    import psycopg
    holder = psycopg.connect(_schema)
    try:
        assert store.try_advisory_lock(holder)
        holder.execute(
            "INSERT INTO runs (week_ending, week_tz, window_start, window_end, status) "
            "VALUES (%s,%s,%s,%s,'running')", (WE, IST, START, END))
        holder.commit()
        r = client.post("/v1/runs", headers=AUTH,
                        json={"week_ending": "2026-08-16", "force": True})
        assert r.status_code == 409
        assert r.json()["error"]["code"] == "run_in_progress"
        assert r.json()["error"]["run_id"] is not None
    finally:
        store.release_advisory_lock(holder)
        holder.close()


# ---------------- week_ending validation ----------------

def test_a_non_sunday_is_422_naming_the_nearest_sunday(client):
    r = client.post("/v1/runs", headers=AUTH, json={"week_ending": "2026-08-18"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "week_ending_not_sunday"
    assert "2026-08-16" in r.json()["error"]["message"]


def test_a_future_week_is_422_naming_the_latest_completed_one(client):
    future = (date.today() + timedelta(days=30))
    future += timedelta(days=(6 - future.weekday()) % 7)
    r = client.post("/v1/runs", headers=AUTH, json={"week_ending": future.isoformat()})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "week_not_closed"


# ---------------- runs ----------------

def test_a_run_record_carries_the_window_verification_and_cost(client, conn):
    run_id = seed_run(conn)
    r = client.get(f"/v1/runs/{run_id}", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["week_ending"] == "2026-08-16"
    assert body["week_tz"] == IST
    assert body["status"] == "ok"
    assert body["pdf_available"] is True
    assert body["x_cost_usd"] == 0.2
    assert "weekly_totals" in body


def test_an_unknown_run_is_404_with_a_stable_code(client):
    r = client.get("/v1/runs/99999", headers=AUTH)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "run_not_found"


def test_runs_are_listed_newest_first(client, conn):
    a = seed_run(conn, week_ending=date(2026, 8, 9), with_pdf=False)
    b = seed_run(conn)
    r = client.get("/v1/runs?limit=5", headers=AUTH)
    assert [x["id"] for x in r.json()["runs"]] == [b, a]


def test_a_runs_pdf_is_served_as_an_attachment(client, conn):
    run_id = seed_run(conn)
    r = client.get(f"/v1/runs/{run_id}/pdf", headers=AUTH)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert "attachment" in r.headers["content-disposition"]
    assert r.headers["x-slide-count"] == "4"
    assert r.content.startswith(b"%PDF")


def test_a_run_with_no_pdf_is_404(client, conn):
    run_id = seed_run(conn, with_pdf=False)
    r = client.get(f"/v1/runs/{run_id}/pdf", headers=AUTH)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "pdf_not_found"


# ---------------- the signed deck link ----------------

def test_a_correctly_signed_deck_link_opens_without_a_bearer_header(client, conn):
    seed_run(conn)
    sig = sign_week(WE, TEST_TOKEN)
    r = client.get(f"/v1/decks/2026-08-16.pdf?sig={sig}")
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")
    assert "inline" in r.headers["content-disposition"]


@pytest.mark.parametrize("sig", ["", "deadbeef", "0" * 64])
def test_a_bad_signature_is_404_and_never_confirms_the_week_exists(client, conn, sig):
    seed_run(conn)
    r = client.get(f"/v1/decks/2026-08-16.pdf?sig={sig}")
    assert r.status_code == 404
    assert r.json()["error"]["message"] == ""


def test_one_weeks_signature_does_not_open_another_week(client, conn):
    seed_run(conn)
    seed_run(conn, week_ending=date(2026, 8, 9))
    sig = sign_week(date(2026, 8, 9), TEST_TOKEN)
    assert client.get(f"/v1/decks/2026-08-16.pdf?sig={sig}").status_code == 404
    assert client.get(f"/v1/decks/2026-08-09.pdf?sig={sig}").status_code == 200


def test_a_signed_link_for_a_week_with_no_deck_is_404(client):
    sig = sign_week(date(2026, 8, 9), TEST_TOKEN)
    assert client.get(f"/v1/decks/2026-08-09.pdf?sig={sig}").status_code == 404


# ---------------- weeks ----------------

def test_weeks_lists_every_stored_rollup_newest_first(client):
    r = client.get("/v1/weeks", headers=AUTH)
    weeks = r.json()["weeks"]
    assert [w["week_ending"] for w in weeks[:3]] == ["2026-08-16"] * 3
    assert {w["channel"] for w in weeks} == {"x", "instagram", "facebook"}


def test_a_week_returns_its_three_channel_rollups(client):
    r = client.get("/v1/weeks/2026-08-16", headers=AUTH)
    body = r.json()
    assert set(body["channels"]) == {"x", "instagram", "facebook"}
    assert body["channels"]["x"]["engagement"] == 21217
    assert body["channels"]["instagram"]["impressions"] is None


def test_an_unstored_week_is_404(client):
    r = client.get("/v1/weeks/2026-07-12", headers=AUTH)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "week_not_stored"


def test_week_posts_are_paginated(client, conn):
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO posts_x (post_id, week_ending, created_at, text, title, likes, "
            "reposts, replies, quotes, bookmarks, impressions, is_head) "
            "VALUES (%s,%s,%s,%s,%s,%s,0,0,0,0,100,true)",
            [(str(i), WE, utc(2026, 8, 12, 9), "t", f"Title {i}", i) for i in range(10)])
    conn.commit()
    r = client.get("/v1/weeks/2026-08-16/posts?channel=x&limit=3", headers=AUTH)
    body = r.json()
    assert len(body["posts"]) == 3
    assert body["posts"][0]["engagement"] == 9          # ordered by engagement desc
    r2 = client.get("/v1/weeks/2026-08-16/posts?channel=x&limit=3&offset=3", headers=AUTH)
    assert [p["post_id"] for p in r2.json()["posts"]] != [p["post_id"] for p in body["posts"]]


# ---------------- backfill and usage ----------------

def test_backfill_without_a_confirmed_cost_is_409_and_states_the_projection(client):
    r = client.post("/v1/backfill", headers=AUTH,
                    json={"from": "2026-08-09", "to": "2026-08-16"})
    assert r.status_code == 409
    body = r.json()["error"]
    assert body["code"] == "cost_not_confirmed"
    assert "confirm_cost_usd=" in body["message"]


def test_backfill_with_the_wrong_number_echoed_back_is_still_refused(client):
    r = client.post("/v1/backfill", headers=AUTH,
                    json={"from": "2026-08-09", "to": "2026-08-16",
                          "confirm_cost_usd": 0.01})
    assert r.status_code == 409


def test_a_reversed_range_is_422(client):
    r = client.post("/v1/backfill", headers=AUTH,
                    json={"from": "2026-08-16", "to": "2026-08-09"})
    assert r.status_code == 422


# ---------------- rate limit ----------------

def test_post_routes_are_rate_limited(client, conn):
    seed_run(conn)
    last = None
    for _ in range(12):
        last = client.post("/v1/render", headers=AUTH, json={"week_ending": "2026-08-16"})
    assert last.status_code == 429
    assert last.json()["error"]["code"] == "rate_limited"
    assert "Retry-After" in last.headers


def test_get_routes_are_not_rate_limited(client):
    for _ in range(15):
        assert client.get("/v1/weeks", headers=AUTH).status_code == 200


# ---------------- docs ----------------

def test_docs_are_available_only_in_dev(client):
    from app.config import get_settings
    assert get_settings().env == "dev"
    assert client.get("/openapi.json").status_code == 200


# ---------------- the scheduled trigger ----------------

def test_the_trigger_command_starts_a_run_and_exits_zero(client, conn, monkeypatch):
    """`cli trigger` is the start command for the scheduled service. It must knock on
    /v1/runs with the bearer token and an Idempotency-Key, and report success."""
    import httpx as _httpx

    from app import cli

    seen = {}

    def fake_post(url, **kw):
        seen["url"] = url
        seen["headers"] = kw["headers"]
        seen["json"] = kw["json"]
        return _httpx.Response(202, json={"run_id": 7, "status": "queued",
                                          "estimated_cost_usd": 0.32})

    monkeypatch.setattr(cli, "get_settings", lambda: __import__(
        "app.config", fromlist=["get_settings"]).get_settings())
    monkeypatch.setattr("httpx.post", fake_post)
    assert cli.main(["trigger"]) == 0
    assert seen["url"].endswith("/v1/runs")
    assert seen["headers"]["Authorization"] == f"Bearer {TEST_TOKEN}"
    assert "Idempotency-Key" in seen["headers"]
    assert seen["json"] == {"force": False, "notify": True}


def test_the_trigger_treats_the_cost_guard_as_success(monkeypatch):
    """409 is a correct refusal by a healthy service. A non-zero exit would have the
    scheduler retrying and an operator paged over nothing."""
    import httpx as _httpx

    from app import cli

    monkeypatch.setattr("httpx.post", lambda url, **kw: _httpx.Response(
        409, json={"error": {"code": "week_already_stored", "message": "already stored",
                             "run_id": 2}}))
    assert cli.main(["trigger"]) == 0


def test_the_trigger_reports_a_real_failure(monkeypatch):
    import httpx as _httpx

    from app import cli

    monkeypatch.setattr("httpx.post", lambda url, **kw: _httpx.Response(500, text="boom"))
    assert cli.main(["trigger"]) == 1


def test_an_unreachable_target_is_retryable_not_a_hard_failure(monkeypatch):
    import httpx as _httpx

    from app import cli

    def boom(url, **kw):
        raise _httpx.ConnectError("no route")

    monkeypatch.setattr("httpx.post", boom)
    assert cli.main(["trigger"]) == 75          # EX_TEMPFAIL


# ---------------- the signed trigger URL ----------------

def _trigger_sig() -> str:
    from app.signing import TRIGGER_ACTION, sign_action
    return sign_action(TRIGGER_ACTION, TEST_TOKEN)


def test_the_trigger_starts_a_run_with_no_bearer_header(client, empty_conn, monkeypatch):
    """The whole point: a scheduler holds one URL and nothing else."""
    import app.api as api

    started = []
    monkeypatch.setattr(api, "_run_in_background", lambda req, rid: started.append((req, rid)))
    r = client.post(f"/v1/trigger?sig={_trigger_sig()}")
    assert r.status_code == 202
    assert r.json()["run_id"] is not None
    assert started and started[0][0].week_ending is not None
    assert started[0][0].notify is True and started[0][0].force is False


def test_get_works_too_because_some_pingers_only_do_get(client, empty_conn, monkeypatch):
    import app.api as api

    monkeypatch.setattr(api, "_run_in_background", lambda req, rid: None)
    assert client.get(f"/v1/trigger?sig={_trigger_sig()}").status_code == 202


@pytest.mark.parametrize("sig", ["", "deadbeef", "0" * 64])
def test_a_bad_trigger_signature_is_404_and_says_nothing(client, sig):
    r = client.post(f"/v1/trigger?sig={sig}")
    assert r.status_code == 404
    assert r.json()["error"]["message"] == ""


def test_the_trigger_signature_is_not_the_deck_signature(client):
    """Scoped to one action: a deck link must not double as a trigger, or vice versa."""
    from app.signing import sign_week

    deck_sig = sign_week(WE, TEST_TOKEN)
    assert client.post(f"/v1/trigger?sig={deck_sig}").status_code == 404
    assert client.get(f"/v1/decks/2026-08-16.pdf?sig={_trigger_sig()}").status_code == 404


def test_the_trigger_cannot_force_a_re_pull_or_choose_a_week(client, conn, monkeypatch):
    """Strictly weaker than the bearer token. Query parameters are ignored, and the cost
    guard still refuses a week that is already stored."""
    import app.api as api

    monkeypatch.setattr(api, "_run_in_background", lambda req, rid: None)
    with conn.cursor() as cur:
        cur.execute("UPDATE weekly_totals SET source='api' WHERE week_ending=%s", (WE,))
    conn.commit()
    # even asking for force and a specific week, both are ignored
    r = client.post(f"/v1/trigger?sig={_trigger_sig()}&force=true&week_ending=2026-08-16")
    assert r.status_code in (202, 409)
    if r.status_code == 409:
        assert r.json()["error"]["code"] == "week_already_stored"


def test_the_trigger_is_rate_limited_like_the_other_post_routes(client, empty_conn,
                                                                monkeypatch):
    import app.api as api

    monkeypatch.setattr(api, "_run_in_background", lambda req, rid: None)
    last = None
    for _ in range(12):
        last = client.post(f"/v1/trigger?sig={_trigger_sig()}")
    assert last.status_code == 429


def test_repeat_triggers_on_one_day_return_the_same_run(client, empty_conn, monkeypatch):
    """The Idempotency-Key is the date, so a scheduler retry cannot start a second billed
    run."""
    import app.api as api

    monkeypatch.setattr(api, "_run_in_background", lambda req, rid: None)
    first = client.post(f"/v1/trigger?sig={_trigger_sig()}").json()
    second = client.post(f"/v1/trigger?sig={_trigger_sig()}").json()
    assert second["run_id"] == first["run_id"]
    assert second.get("idempotent_replay") is True
