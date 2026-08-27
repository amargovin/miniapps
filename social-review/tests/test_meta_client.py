"""Brief §4 Meta behaviours. The exclusive-`until` test exists because the connector this
replaces documented it as inclusive and silently dropped a Sunday's eight posts."""
from datetime import date, datetime, timezone

import httpx
import pytest

from app.meta_client import MetaClient, MetaError, unix_bounds
from app.window import window_for
from tests.conftest import fb_row, ig_row, utc

FB_PAGE = "670321879700525"
IG_USER = "17841400214702908"
START, END = window_for(date(2026, 8, 16), "Asia/Kolkata")


def client(handler) -> MetaClient:
    return MetaClient("meta-token", fb_page_id=FB_PAGE, ig_user_id=IG_USER,
                      api_version="v21.0",
                      client=httpx.Client(transport=httpx.MockTransport(handler)),
                      retry_budget_s=0.4, retry_max_wait_s=0.05)


# ---------------- the exclusive-until bug ----------------

def test_until_is_exclusive_and_is_the_first_instant_after_the_window():
    since, until = unix_bounds(START, END)
    assert since == int(datetime(2026, 8, 9, 18, 30, tzinfo=timezone.utc).timestamp())
    assert until == int(datetime(2026, 8, 16, 18, 30, tzinfo=timezone.utc).timestamp())
    # the final second of the window is strictly less than `until`
    final_second = int(datetime(2026, 8, 16, 18, 29, 59, tzinfo=timezone.utc).timestamp())
    assert final_second < until
    # and the first instant outside it is not
    assert until == int(datetime(2026, 8, 16, 18, 30, 0, tzinfo=timezone.utc).timestamp())


def test_a_post_in_the_final_second_of_the_window_is_included():
    """The regression the whole check exists for: an inclusive `until` would have asked for
    a window ending one second early and dropped this post."""
    last = datetime(2026, 8, 16, 18, 29, 59, tzinfo=timezone.utc)   # 23:59:59 IST Sunday
    sent = {}

    def handler(request):
        sent.update(dict(request.url.params))
        return httpx.Response(200, json={"data": [fb_row("p_last", last)]})

    pull = client(handler).fetch_facebook(START, END)
    assert [p.post_id for p in pull.posts] == ["p_last"]
    assert int(sent["until"]) > int(last.timestamp())
    assert int(sent["since"]) <= int(last.timestamp())


def test_sundays_posts_are_requested_at_all():
    """The historical failure dropped all eight of one Sunday's Facebook posts."""
    sunday = [fb_row(f"sun{i}", utc(2026, 8, 16, 6, i)) for i in range(8)]
    pull = client(lambda r: httpx.Response(200, json={"data": sunday})).fetch_facebook(
        START, END)
    assert len(pull.posts) == 8


# ---------------- pagination ----------------

def test_cursor_pagination_follows_paging_next_until_exhausted():
    pages = [
        {"data": [fb_row("a", utc(2026, 8, 11, 9))],
         "paging": {"next": "https://graph.facebook.com/v21.0/next?cursor=2"}},
        {"data": [fb_row("b", utc(2026, 8, 12, 9))],
         "paging": {"next": "https://graph.facebook.com/v21.0/next?cursor=3"}},
        {"data": [fb_row("c", utc(2026, 8, 13, 9))]},
    ]
    calls = []

    def handler(request):
        calls.append(str(request.url))
        return httpx.Response(200, json=pages[len(calls) - 1])

    pull = client(handler).fetch_facebook(START, END)
    assert [p.post_id for p in pull.posts] == ["a", "b", "c"]
    assert pull.pages == 3
    assert "cursor=3" in calls[-1]


def test_cursor_overlap_is_deduplicated():
    pages = [
        {"data": [fb_row("a", utc(2026, 8, 11, 9)), fb_row("b", utc(2026, 8, 12, 9))],
         "paging": {"next": "https://graph.facebook.com/v21.0/next?cursor=2"}},
        {"data": [fb_row("b", utc(2026, 8, 12, 9)), fb_row("c", utc(2026, 8, 13, 9))]},
    ]
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(200, json=pages[len(calls) - 1])

    pull = client(handler).fetch_facebook(START, END)
    assert [p.post_id for p in pull.posts] == ["a", "b", "c"]


# ---------------- NULL is not 0 ----------------

def test_instagram_shares_is_null_because_the_media_edge_has_no_such_field():
    rows = [ig_row("i1", utc(2026, 8, 12, 9), likes=500, comments=12)]
    pull = client(lambda r: httpx.Response(200, json={"data": rows})).fetch_instagram(
        START, END)
    p = pull.posts[0]
    assert p.shares is None            # not 0
    assert p.likes == 500 and p.comments == 12
    assert p.engagement == 512
    assert any(n["note"] == "meta_field_unreported" and n["field"] == "shares"
               for n in pull.notes)


def test_a_field_that_is_zero_on_every_post_is_stored_null_and_noted():
    """Facebook comments come back 0 on every post under this token scope: unreported, not
    zero (§4)."""
    rows = [fb_row(f"f{i}", utc(2026, 8, 12, 9, i), likes=5 + i, comments=0, shares=1)
            for i in range(5)]
    pull = client(lambda r: httpx.Response(200, json={"data": rows})).fetch_facebook(
        START, END)
    assert all(p.comments is None for p in pull.posts)
    assert all(p.shares == 1 for p in pull.posts)
    note = next(n for n in pull.notes if n["field"] == "comments")
    assert note == {"note": "meta_field_unreported", "platform": "facebook",
                    "field": "comments", "posts": 5}


def test_a_scope_that_starts_returning_comments_stops_nulling_them():
    """The rule is written against the data, not hardcoded to the two known fields."""
    rows = [fb_row("f1", utc(2026, 8, 12, 9), comments=0),
            fb_row("f2", utc(2026, 8, 12, 10), comments=3)]
    pull = client(lambda r: httpx.Response(200, json={"data": rows})).fetch_facebook(
        START, END)
    assert [p.comments for p in pull.posts] == [0, 3]
    assert not any(n["field"] == "comments" for n in pull.notes)


def test_no_impressions_field_is_ever_requested_or_invented():
    sent = {}

    def handler(request):
        sent.update(dict(request.url.params))
        return httpx.Response(200, json={"data": [ig_row("i1", utc(2026, 8, 12, 9))]})

    pull = client(handler).fetch_instagram(START, END)
    assert "impression" not in sent["fields"]
    assert not hasattr(pull.posts[0], "impressions")


# ---------------- the independent aggregate for §9 check 2 ----------------

def test_aggregate_is_a_second_independent_request():
    urls = []

    def handler(request):
        urls.append(str(request.url))
        return httpx.Response(200, json={"data": [
            fb_row("a", utc(2026, 8, 11, 9), likes=5, comments=1, shares=2),
            fb_row("b", utc(2026, 8, 12, 9), likes=7, comments=0, shares=0),
        ]})

    c = client(handler)
    c.fetch_facebook(START, END)
    agg = c.fetch_aggregate("facebook", START, END)
    assert agg == {"posts": 2, "likes": 12, "comments": 1, "shares": 2}
    assert len(urls) == 2                     # not derived from the first pull's payloads


def test_instagram_aggregate_reports_zero_shares_because_the_field_does_not_exist():
    c = client(lambda r: httpx.Response(200, json={"data": [
        ig_row("i1", utc(2026, 8, 12, 9), likes=100, comments=5)]}))
    assert c.fetch_aggregate("instagram", START, END) == {
        "posts": 1, "likes": 100, "comments": 5, "shares": 0}


# ---------------- transport ----------------

def test_the_access_token_is_never_echoed_in_an_error():
    def handler(request):
        return httpx.Response(400, text='GET /v21.0/x?access_token=EAAsecretvalue failed')

    with pytest.raises(MetaError) as e:
        client(handler).fetch_facebook(START, END)
    assert "EAAsecretvalue" not in str(e.value)
    assert "<redacted>" in str(e.value)


def test_5xx_is_retried_then_surfaces_as_a_meta_error():
    attempts = []

    def handler(request):
        attempts.append(1)
        return httpx.Response(503, text="unavailable")

    with pytest.raises(MetaError, match="retries exhausted"):
        client(handler).fetch_facebook(START, END)
    assert len(attempts) > 1


def test_the_api_version_is_configurable():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        return httpx.Response(200, json={"data": []})

    c = MetaClient("t", fb_page_id=FB_PAGE, ig_user_id=IG_USER, api_version="v23.0",
                   client=httpx.Client(transport=httpx.MockTransport(handler)))
    c.fetch_facebook(START, END)
    assert seen["path"].startswith("/v23.0/")
