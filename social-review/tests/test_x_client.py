"""Brief §4 X behaviours and the §10 cost guardrails, against recorded-shape fixtures."""
from datetime import date, datetime, timezone

import httpx
import pytest

from app.window import window_for
from app.x_client import (POST_READ_USD, USER_READ_USD, XClient, XCreditsDepleted, XError,
                          XTooManyPosts, heads_with_continuations)
from tests.conftest import utc, x_page, x_row

USER_ID = "2451476942"
START, END = window_for(date(2026, 8, 16), "Asia/Kolkata")


def client(handler, **kw) -> XClient:
    kw.setdefault("retry_budget_s", 0.6)
    kw.setdefault("retry_max_wait_s", 0.05)
    return XClient("bearer-test", USER_ID,
                   client=httpx.Client(transport=httpx.MockTransport(handler)), **kw)


# ---------------- §10: the endpoint that costs four hundred times as much ----------------

def test_the_client_refuses_to_build_a_followers_url():
    """GET /2/users/{id}/followers is an Owned Read at $0.001 *per follower* — $342 a run
    on 342,772 followers, against $0.010 for the public_metrics lookup."""
    calls = []

    def handler(request):
        calls.append(str(request.url))
        return httpx.Response(200, json={"data": []})

    c = client(handler)
    with pytest.raises(XError, match="refusing to call a /followers endpoint"):
        c._request(f"/users/{USER_ID}/followers", {"max_results": "1000"})
    assert calls == []


def test_follower_count_uses_one_user_read():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        return httpx.Response(200, json={"data": {"id": USER_ID, "public_metrics": {
            "followers_count": 342772, "following_count": 10, "tweet_count": 5}}})

    c = client(handler)
    assert c.fetch_followers() == 342772
    assert "/followers" not in seen["url"]
    assert "user.fields=public_metrics" in seen["url"]
    assert c.user_reads == 1
    assert c.estimated_cost_usd() == USER_READ_USD


def test_the_user_id_is_never_looked_up_by_username():
    urls = []
    c = client(lambda r: (urls.append(str(r.url)),
                          httpx.Response(200, json=x_page([])))[1])
    c.fetch_timeline(START, END)
    assert all("by/username" not in u for u in urls)
    assert all(f"/users/{USER_ID}" in u for u in urls)


def test_cost_is_posts_times_a_tenth_of_a_cent_plus_user_reads():
    def handler(request):
        if "/tweets" in request.url.path:
            return httpx.Response(200, json=x_page(
                [x_row(str(9_000 - i), utc(2026, 8, 12, 9)) for i in range(97)]))
        return httpx.Response(200, json={"data": {"public_metrics": {
            "followers_count": 1}}})

    c = client(handler)
    c.fetch_followers()
    c.fetch_timeline(START, END)
    # §10: a call returning 97 posts drew exactly $0.10 on the live account, i.e. $0.001
    # per post. The follower lookup adds one $0.010 user read on top.
    assert c.posts_returned == 97
    assert c.estimated_cost_usd() == pytest.approx(0.097 + 0.010)
    assert c.estimated_cost_usd() == pytest.approx(97 * POST_READ_USD + USER_READ_USD)
    # Not the $0.005 non-owned rate, which would be five times as much.
    assert c.estimated_cost_usd() < 97 * 0.005


# ---------------- pagination ----------------

def test_pagination_follows_next_token_and_dedupes_across_the_boundary():
    pages = [
        x_page([x_row("300", utc(2026, 8, 16, 9)), x_row("299", utc(2026, 8, 15, 9))],
               next_token="tok2"),
        # "299" repeats across the boundary: de-duplicated, and the overlap is noted.
        x_page([x_row("299", utc(2026, 8, 15, 9)), x_row("298", utc(2026, 8, 14, 9))]),
    ]
    seen = []

    def handler(request):
        seen.append(dict(request.url.params))
        return httpx.Response(200, json=pages[len(seen) - 1])

    tl = client(handler).fetch_timeline(START, END)
    assert [p.post_id for p in tl.posts] == ["298", "299", "300"]
    assert tl.pages == 2
    assert tl.posts_returned == 4            # billed resources, before de-duplication
    assert seen[1]["pagination_token"] == "tok2"
    assert any(n["note"] == "x_page_overlap" for n in tl.notes)


def test_request_parameters_are_exactly_the_specified_set():
    seen = {}

    def handler(request):
        seen.update(dict(request.url.params))
        return httpx.Response(200, json=x_page([]))

    client(handler).fetch_timeline(START, END)
    assert seen["exclude"] == "retweets,replies"
    assert seen["max_results"] == "100"
    assert seen["start_time"] == "2026-08-09T18:30:00Z"
    assert seen["end_time"] == "2026-08-16T18:30:00Z"
    assert seen["expansions"] == "referenced_tweets.id"
    for field in ("id", "text", "created_at", "public_metrics", "referenced_tweets"):
        assert field in seen["tweet.fields"]


def test_a_row_count_disagreeing_with_result_count_aborts_the_run():
    """§9 check 1. Never repaired silently."""
    def handler(request):
        return httpx.Response(200, json=x_page(
            [x_row("1", utc(2026, 8, 12, 9))], result_count=2))

    with pytest.raises(XError, match="meta.result_count=2"):
        client(handler).fetch_timeline(START, END)


def test_an_empty_week_is_not_an_error():
    tl = client(lambda r: httpx.Response(200, json=x_page([]))).fetch_timeline(START, END)
    assert tl.posts == [] and tl.pages == 1 and tl.posts_returned == 0


def test_max_posts_per_run_aborts_rather_than_crawling_on():
    def handler(request):
        return httpx.Response(200, json=x_page(
            [x_row(str(5_000 + i), utc(2026, 8, 12, 9)) for i in range(60)],
            next_token="more"))

    with pytest.raises(XTooManyPosts, match="X_MAX_POSTS_PER_RUN=50"):
        client(handler, max_posts_per_run=50).fetch_timeline(START, END)


# ---------------- threads (§4) ----------------

def test_self_thread_continuations_arrive_as_ordinary_posts_and_are_not_heads():
    """exclude=replies does not drop them."""
    rows = [
        x_row("100", utc(2026, 8, 12, 9), text="Thread head on capital formation"),
        x_row("101", utc(2026, 8, 12, 9, 2), replied_to="100"),
        x_row("102", utc(2026, 8, 12, 9, 4), replied_to="101"),
        x_row("103", utc(2026, 8, 13, 9), text="A standalone post"),
    ]
    tl = client(lambda r: httpx.Response(200, json=x_page(rows))).fetch_timeline(START, END)
    by = {p.post_id: p for p in tl.posts}
    assert by["100"].is_head and by["103"].is_head
    assert not by["101"].is_head and not by["102"].is_head
    # walked back through the middle post to the head
    assert by["102"].thread_root == "100"
    assert heads_with_continuations(tl.posts) == {"100"}


def test_a_reply_to_someone_else_is_still_a_head():
    """The rule needs in_reply_to_user_id == X_USER_ID, not merely a replied_to reference:
    a quote-adjacent reply to another account is Swarajya's own post, not a continuation."""
    rows = [x_row("200", utc(2026, 8, 12, 9), replied_to="999",
                  in_reply_to_user_id="123456")]
    tl = client(lambda r: httpx.Response(200, json=x_page(rows))).fetch_timeline(START, END)
    assert tl.posts[0].is_head
    assert tl.posts[0].thread_root == "200"


def test_a_deleted_head_with_surviving_continuations_is_a_data_note_not_a_failure():
    """§4: in the week ending 2026-08-16, 11 continuations survive a head that 404s. Their
    engagement belongs in the totals; they can never be ranked."""
    rows = [x_row(str(400 + i), utc(2026, 8, 12, 9, i),
                  replied_to="2087867158684664227") for i in range(11)]
    tl = client(lambda r: httpx.Response(200, json=x_page(rows))).fetch_timeline(START, END)
    assert all(not p.is_head for p in tl.posts)
    note = next(n for n in tl.notes if n["note"] == "x_thread_head_missing")
    assert note["thread_root"] == "2087867158684664227"
    assert note["continuations"] == 11


def test_engagement_is_the_five_x_interaction_types():
    rows = [x_row("500", utc(2026, 8, 12, 9), likes=100, reposts=20, replies=5, quotes=2,
                  bookmarks=13)]
    tl = client(lambda r: httpx.Response(200, json=x_page(rows))).fetch_timeline(START, END)
    assert tl.posts[0].engagement == 140


# ---------------- retries (§4) ----------------

def test_402_is_retried_and_then_surfaces_as_credits_depleted():
    attempts = []

    def handler(request):
        attempts.append(1)
        return httpx.Response(402, json={"title": "credits depleted"})

    with pytest.raises(XCreditsDepleted):
        client(handler).fetch_timeline(START, END)
    assert len(attempts) > 1          # it backed off and tried again rather than giving up


def test_a_402_that_clears_on_retry_completes_the_pull():
    state = {"n": 0}

    def handler(request):
        state["n"] += 1
        if state["n"] == 1:
            return httpx.Response(402, json={"title": "credits depleted"})
        return httpx.Response(200, json=x_page([x_row("600", utc(2026, 8, 12, 9))]))

    tl = client(handler).fetch_timeline(START, END)
    assert [p.post_id for p in tl.posts] == ["600"]


def test_429_honours_x_rate_limit_reset():
    waits = []
    state = {"n": 0}
    reset = datetime.now(timezone.utc).timestamp() + 0.02

    def handler(request):
        state["n"] += 1
        if state["n"] == 1:
            return httpx.Response(429, headers={"x-rate-limit-reset": str(int(reset))})
        return httpx.Response(200, json=x_page([]))

    c = client(handler, retry_budget_s=5.0, retry_max_wait_s=0.05)
    real_wait = c._wait

    def spy(retry_state):
        w = real_wait(retry_state)
        waits.append(w)
        return w

    c._wait = spy
    c.fetch_timeline(START, END)
    assert waits and waits[0] <= 0.05      # the header value, clamped to the max wait


def test_a_4xx_that_is_not_402_or_429_fails_immediately():
    attempts = []

    def handler(request):
        attempts.append(1)
        return httpx.Response(401, text="Unauthorized")

    with pytest.raises(XError, match="401"):
        client(handler).fetch_timeline(START, END)
    assert len(attempts) == 1


# ---------------- usage (§10) ----------------

def test_credit_balance_is_read_from_usage_credits():
    def handler(request):
        assert request.url.path.endswith("/usage/credits")
        return httpx.Response(200, json={"data": {"free_balance": 0.0,
                                                  "prepaid_balance": 95.25,
                                                  "total_balance": 95.25}})

    assert client(handler).fetch_credit_balance() == 95.25


def test_a_missing_balance_endpoint_does_not_fail_the_run():
    assert client(lambda r: httpx.Response(404, text="not found")).fetch_credit_balance() is None
