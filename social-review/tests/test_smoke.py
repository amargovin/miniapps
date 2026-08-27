"""Brief §10 — the deploy check that Owned Read pricing actually applies.

Tested with faked balances: the point of the check is that it fires, and finding that out
by spending $105 a year is the failure it exists to prevent."""
import httpx

from app.smoke import assess, run_smoke
from app.x_client import POST_READ_USD, XClient
from tests.conftest import utc, x_page, x_row


def test_the_owned_read_rate_passes():
    v = assess(97, 95.25, 95.25 - 0.097)
    assert v.ok and v.conclusive
    assert "within 10%" in v.message


def test_the_non_owned_rate_fails_loudly_and_names_the_cause():
    """97 posts at $0.005 is $0.485 rather than $0.097."""
    v = assess(97, 95.25, 95.25 - 0.485)
    assert not v.ok and v.conclusive
    assert "NON-OWNED rate" in v.message
    assert "owned by @SwarajyaMag" in v.message
    assert "Do not enable the cron" in v.message


def test_a_delta_inside_the_ten_percent_tolerance_still_passes():
    expected = 200 * POST_READ_USD
    v = assess(200, 50.0, 50.0 - expected * 1.09)
    assert v.ok and v.conclusive


def test_a_delta_just_outside_the_tolerance_fails():
    expected = 200 * POST_READ_USD
    v = assess(200, 50.0, 50.0 - expected * 1.4)
    assert not v.ok


def test_a_delta_matching_neither_rate_fails_rather_than_being_waved_through():
    v = assess(200, 50.0, 50.0 - 7.5)
    assert not v.ok and v.conclusive
    assert "neither" in v.message


def test_a_pull_too_small_to_price_is_inconclusive_not_a_pass_or_a_fail():
    v = assess(5, 50.0, 50.0 - 0.005)
    assert v.ok and not v.conclusive
    assert "too small to tell" in v.message


def test_an_unavailable_balance_endpoint_is_inconclusive_and_says_what_to_do():
    v = assess(97, None, None)
    assert v.ok and not v.conclusive
    assert "by hand before enabling the cron" in v.message


def test_an_empty_pull_is_not_a_pass():
    v = assess(0, 50.0, 50.0)
    assert not v.ok and not v.conclusive


def test_the_smoke_run_pulls_exactly_one_page_and_never_touches_followers():
    calls = []
    balances = iter([95.25, 95.25 - 0.097])

    def handler(request):
        calls.append(str(request.url))
        if "/usage/credits" in request.url.path:
            return httpx.Response(200, json={"data": {"total_balance": next(balances)}})
        return httpx.Response(200, json=x_page(
            [x_row(str(9_000 - i), utc(2026, 8, 12, 9)) for i in range(97)],
            next_token="there-is-more"))

    xc = XClient("bearer", "2451476942",
                 client=httpx.Client(transport=httpx.MockTransport(handler)))
    v = run_smoke(client=xc)
    assert v.ok and v.conclusive
    assert v.posts_returned == 97
    assert sum(1 for u in calls if "/tweets" in u) == 1      # one page, not the whole week
    assert not any("/followers" in u for u in calls)
