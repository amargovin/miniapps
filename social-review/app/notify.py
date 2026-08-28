"""Delivery (CLAUDE.md amendment to brief §4, §8, §9, §11).

Delivery is a Google Chat room, not email. Kept behind the same protocol the brief calls
`Mailer` — named `Notifier` here, with one implementation — so email can be added back
later without touching the pipeline.

Incoming webhooks cannot attach files, so the weekly message is:

    Swarajya social review — week ending Sunday 16 August 2026   <- the §4 subject line
    <the three-to-four sentence findings summary from §8>
    <a signed link to the PDF served by the api service>

Verification failures (§9) and unhandled exceptions (§11) post to the same webhook with
the failing check or the final traceback frame. Silence on a Monday morning must never be
the failure mode, so a delivery failure is logged loudly and re-raised by the caller's
choice — never swallowed here.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Protocol, runtime_checkable

import httpx

from app.signing import deck_url
from app.window import sunday_label, window_sentence

log = logging.getLogger(__name__)


class NotifyError(Exception):
    pass


@runtime_checkable
class Notifier(Protocol):
    def post(self, text: str) -> None:
        """Deliver one message. Raises NotifyError on failure."""


class GoogleChatNotifier:
    """One incoming webhook on the target room. Chat renders a small subset of Markdown:
    *bold*, _italic_, `code`, and <url|label> links."""

    def __init__(self, webhook: str, *, client: httpx.Client | None = None):
        if not webhook:
            raise NotifyError("GOOGLE_CHAT_WEBHOOK is empty")
        self._webhook = webhook
        self._http = client or httpx.Client(timeout=20.0)

    def post(self, text: str) -> None:
        try:
            r = self._http.post(self._webhook, json={"text": text})
        except httpx.HTTPError as exc:
            raise NotifyError(f"Google Chat webhook unreachable: {exc}") from exc
        if r.status_code >= 400:
            raise NotifyError(f"Google Chat webhook {r.status_code}: {r.text[:300]}")


class NullNotifier:
    """Used by dry runs and by `notify=false`. Records what it would have sent so a run
    record can show it, rather than pretending a message went out."""

    def __init__(self) -> None:
        self.sent: list[str] = []

    def post(self, text: str) -> None:
        self.sent.append(text)
        log.info("notifier suppressed: %s", text.splitlines()[0] if text else "")


def subject_line(week_ending: date) -> str:
    """§4: the real date, spelled out."""
    return f"Swarajya social review — week ending Sunday {sunday_label(week_ending)}"


def weekly_message(
    *,
    week_ending: date,
    week_tz: str,
    summary: str,
    public_base_url: str,
    api_token: str,
    deck_available: bool = True,
) -> str:
    lines = [f"*{subject_line(week_ending)}*", ""]
    if summary:
        lines += [summary, ""]
    if deck_available and public_base_url:
        url = deck_url(public_base_url, week_ending, api_token)
        lines.append(f"<{url}|Open the four-slide deck (PDF)>")
    elif deck_available:
        lines.append("_Deck rendered and stored, but PUBLIC_BASE_URL is unset so there is "
                     "no link to give. Fetch it with POST /v1/render._")
    else:
        lines.append("_No deck was rendered for this run._")
    lines.append(f"_Window: {window_sentence(week_ending, week_tz)}._")
    return "\n".join(lines)


def verification_failure_message(*, week_ending: date, failed: list[dict],
                                 run_id: int | None) -> str:
    """§9: a failure aborts delivery and posts an alert naming the failing check."""
    head = (f"*Swarajya social review — verification FAILED for week ending Sunday "
            f"{sunday_label(week_ending)}*")
    body = "\n".join(f"• `{c['check']}` — {c['detail']}" for c in failed)
    tail = (f"\nRun {run_id}. The deck was not delivered. Nothing was sent to the room "
            f"beyond this notice." if run_id else "\nThe deck was not delivered.")
    return f"{head}\n\n{body}{tail}"


def failure_message(*, week_ending: date | None, run_id: int | None, final_frame: str,
                    error: str) -> str:
    """§11: on any unhandled exception, post a short failure notice with the traceback's
    final frame. Never the whole traceback — it reaches a chat room."""
    when = (f" for week ending Sunday {sunday_label(week_ending)}" if week_ending
            else "")
    return (f"*Swarajya social review — run FAILED{when}*\n\n"
            f"`{error}`\n"
            f"at `{final_frame}`\n"
            + (f"\nRun {run_id}. Inspect with `GET /v1/runs/{run_id}`." if run_id else ""))


def balance_alert_message(*, balance_usd: float, threshold_usd: float) -> str:
    """§10: alert if the remaining X credit balance falls below X_BALANCE_ALERT_USD."""
    return (f"*Swarajya social review — X credit balance low*\n\n"
            f"Balance ${balance_usd:,.2f} is below the ${threshold_usd:,.2f} alert "
            f"threshold. Top up in the X Developer Console; auto-recharge is paused at a "
            f"zero or negative balance and needs a manual top-up from there.")


def final_frame(exc: BaseException) -> str:
    import traceback
    tb = traceback.extract_tb(exc.__traceback__)
    if not tb:
        return "unknown"
    f = tb[-1]
    return f"{f.filename.rsplit('/', 1)[-1]}:{f.lineno} in {f.name}"
