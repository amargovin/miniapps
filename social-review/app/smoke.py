"""Deploy smoke test (brief §10) — prove Owned Read pricing, do not assume it.

`GET /2/users/{id}/tweets` costs $0.001 per post instead of $0.005, but only when `{id}`
matches the authenticated user AND that user owns the developer app the token came from.
Get that wrong and the annual bill goes from roughly $20 to roughly $105, with nothing in
any response to say so.

So the first deployment fetches the credit balance, pulls one page, fetches the balance
again, and asserts the delta is within 10% of `posts_returned * 0.001`. It fails loudly if
the delta lands near `posts_returned * 0.005`.

    python -m app.smoke

Run it against production once, after deploying and before enabling the cron. It pulls one
page of the most recent week, so it costs about $0.10 and writes nothing.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import datetime, timezone

from app.config import get_settings
from app.logging_setup import get_logger
from app.window import last_completed_week_ending, window_for
from app.x_client import BALANCE_PATH, POST_READ_USD, XClient, rfc3339

NON_OWNED_RATE = 0.005
TOLERANCE = 0.10          # §10: within 10% of the expected delta
# Below this the balance endpoint's own rounding swamps the signal, so a verdict would be
# noise rather than evidence.
MIN_MEASURABLE_USD = 0.02


@dataclass
class Verdict:
    ok: bool
    conclusive: bool
    posts_returned: int
    balance_before: float | None
    balance_after: float | None
    delta_usd: float | None
    expected_owned_usd: float
    expected_non_owned_usd: float
    message: str

    def as_dict(self) -> dict:
        return dict(self.__dict__)


def assess(posts_returned: int, balance_before: float | None,
           balance_after: float | None) -> Verdict:
    """Pure so it can be tested without spending anything."""
    owned = round(posts_returned * POST_READ_USD, 4)
    non_owned = round(posts_returned * NON_OWNED_RATE, 4)
    base = dict(posts_returned=posts_returned, balance_before=balance_before,
                balance_after=balance_after, expected_owned_usd=owned,
                expected_non_owned_usd=non_owned)

    if balance_before is None or balance_after is None:
        return Verdict(ok=True, conclusive=False, delta_usd=None, **base,
                       message=f"the credit balance is not readable with an app-only bearer "
                               f"token (GET {BALANCE_PATH} answers 404), so the rate could "
                               f"not be verified here. Verify it by hand once, before "
                               f"enabling the cron: note the balance in the X Developer "
                               f"Console, run a pull of a week not already fetched today, "
                               f"and check the drop — ${owned:.4f} means Owned Read pricing "
                               f"applies, ${non_owned:.4f} means it does not. Dedup makes a "
                               f"same-day re-pull free, so it must be a fresh week or the "
                               f"balance will not move at all.")
    delta = round(balance_before - balance_after, 4)
    base_with_delta = dict(base, delta_usd=delta)

    if posts_returned == 0:
        return Verdict(ok=False, conclusive=False, **base_with_delta,
                       message="the pull returned no posts, so there is nothing to price; "
                               "re-run against a week that has posts")
    if owned < MIN_MEASURABLE_USD:
        return Verdict(ok=True, conclusive=False, **base_with_delta,
                       message=f"only {posts_returned} post(s) returned (${owned:.4f} "
                               f"expected); too small to tell ${owned:.4f} from "
                               f"${non_owned:.4f} against balance rounding")

    near_non_owned = abs(delta - non_owned) <= TOLERANCE * non_owned
    within_owned = abs(delta - owned) <= TOLERANCE * owned

    if near_non_owned and not within_owned:
        return Verdict(ok=False, conclusive=True, **base_with_delta,
                       message=f"FAIL: ${delta:.4f} drawn for {posts_returned} posts is "
                               f"the ${non_owned:.4f} NON-OWNED rate, not the "
                               f"${owned:.4f} Owned Read rate. The bearer token is not "
                               f"from a developer app owned by @SwarajyaMag; at this rate "
                               f"the service costs roughly $105/year instead of $20. Do "
                               f"not enable the cron — replace the token first.")
    if within_owned:
        return Verdict(ok=True, conclusive=True, **base_with_delta,
                       message=f"OK: ${delta:.4f} drawn for {posts_returned} posts, within "
                               f"10% of the ${owned:.4f} Owned Read rate.")
    return Verdict(ok=False, conclusive=True, **base_with_delta,
                   message=f"FAIL: ${delta:.4f} drawn for {posts_returned} posts matches "
                           f"neither the ${owned:.4f} Owned Read rate nor the "
                           f"${non_owned:.4f} non-owned rate. Something else is being "
                           f"billed — investigate before enabling the cron.")


def run_smoke(*, client: XClient | None = None) -> Verdict:
    settings = get_settings()
    log = get_logger("smoke")
    xc = client or XClient(settings.x_bearer_token, settings.x_user_id,
                           max_posts_per_run=settings.x_max_posts_per_run)

    week_ending = last_completed_week_ending(settings.week_tz)
    start, end = window_for(week_ending, settings.week_tz)

    before = xc.fetch_credit_balance()
    payload = xc._request(f"/users/{xc.user_id}/tweets", {
        "exclude": "retweets,replies",
        "max_results": "100",
        "start_time": rfc3339(start),
        "end_time": rfc3339(end),
        "tweet.fields": "id,created_at,public_metrics",
    })
    posts = len(payload.get("data") or [])
    after = xc.fetch_credit_balance()

    verdict = assess(posts, before, after)
    log.info("smoke.owned_read_pricing", week_ending=week_ending.isoformat(),
             checked_at=datetime.now(timezone.utc).isoformat(), **verdict.as_dict())
    return verdict


def main() -> int:
    verdict = run_smoke()
    print(verdict.message)
    if not verdict.ok:
        return 1
    if not verdict.conclusive:
        print("warning: the check was inconclusive; it is not a pass.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
