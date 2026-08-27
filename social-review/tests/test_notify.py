"""Delivery — the Google Chat amendment to §4, §8, §9 and §11, plus the signed deck link."""
from datetime import date

import httpx
import pytest

from app.notify import (GoogleChatNotifier, NotifyError, NullNotifier,
                        balance_alert_message, failure_message, final_frame, subject_line,
                        verification_failure_message, weekly_message)
from app.signing import deck_url, sign_week, verify_week

WE = date(2026, 8, 16)
IST = "Asia/Kolkata"
TOKEN = "s" * 64


def test_the_subject_line_names_the_sunday_spelled_out():
    assert subject_line(WE) == "Swarajya social review — week ending Sunday 16 August 2026"


def test_the_weekly_message_carries_subject_summary_and_a_signed_link():
    text = weekly_message(week_ending=WE, week_tz=IST, summary="X engagement fell 27.1%.",
                          public_base_url="https://sr.example.com", api_token=TOKEN)
    lines = text.splitlines()
    assert lines[0] == f"*{subject_line(WE)}*"
    assert "X engagement fell 27.1%." in text
    assert f"/v1/decks/2026-08-16.pdf?sig={sign_week(WE, TOKEN)}" in text
    assert "the seven full days Monday 10 August to Sunday 16 August 2026" in text


def test_a_missing_public_base_url_says_so_rather_than_linking_nowhere():
    text = weekly_message(week_ending=WE, week_tz=IST, summary="s", public_base_url="",
                          api_token=TOKEN)
    assert "PUBLIC_BASE_URL is unset" in text
    assert "http" not in text


def test_the_signature_round_trips_and_a_wrong_one_fails():
    sig = sign_week(WE, TOKEN)
    assert verify_week(WE, sig, TOKEN)
    assert verify_week("2026-08-16", sig, TOKEN)
    assert not verify_week(WE, "deadbeef", TOKEN)
    assert not verify_week(WE, "", TOKEN)
    assert not verify_week(WE, sig, "another-token")


def test_one_weeks_link_does_not_open_another_week():
    assert not verify_week(date(2026, 8, 23), sign_week(WE, TOKEN), TOKEN)


def test_the_deck_url_tolerates_a_trailing_slash_on_the_base():
    a = deck_url("https://sr.example.com/", WE, TOKEN)
    b = deck_url("https://sr.example.com", WE, TOKEN)
    assert a == b
    assert "//v1" not in a.replace("https://", "")


def test_the_webhook_posts_the_text_and_raises_on_failure():
    sent = {}

    def ok(request):
        sent["body"] = request.read().decode()
        return httpx.Response(200, json={})

    GoogleChatNotifier("https://chat.example/hook",
                       client=httpx.Client(transport=httpx.MockTransport(ok))).post("hello")
    assert '"text": "hello"' in sent["body"] or '"text":"hello"' in sent["body"]

    def bad(request):
        return httpx.Response(403, text="forbidden")

    with pytest.raises(NotifyError, match="403"):
        GoogleChatNotifier("https://chat.example/hook",
                           client=httpx.Client(transport=httpx.MockTransport(bad))).post("x")


def test_an_empty_webhook_is_refused_at_construction():
    with pytest.raises(NotifyError, match="GOOGLE_CHAT_WEBHOOK"):
        GoogleChatNotifier("")


def test_the_null_notifier_records_rather_than_pretending_to_send():
    n = NullNotifier()
    n.post("suppressed")
    assert n.sent == ["suppressed"]


def test_a_verification_failure_names_the_failing_check_and_says_delivery_stopped():
    text = verification_failure_message(
        week_ending=WE, run_id=42,
        failed=[{"check": "meta_reconciliation_facebook", "ok": False,
                 "detail": "mismatch (stored, aggregate): posts 35 vs 43"}])
    assert "verification FAILED" in text
    assert "meta_reconciliation_facebook" in text
    assert "posts 35 vs 43" in text
    assert "was not delivered" in text


def test_a_failure_notice_carries_the_final_frame_and_not_a_whole_traceback():
    try:
        raise ValueError("boom")
    except ValueError as exc:
        frame = final_frame(exc)
        text = failure_message(week_ending=WE, run_id=7, final_frame=frame,
                               error="ValueError: boom")
    assert "run FAILED" in text
    assert "ValueError: boom" in text
    assert "test_notify.py" in frame
    assert text.count("\n") < 8            # a notice, not a dump


def test_the_balance_alert_states_the_manual_top_up_caveat():
    text = balance_alert_message(balance_usd=12.5, threshold_usd=20.0)
    assert "$12.50" in text and "$20.00" in text
    assert "manual top-up" in text
