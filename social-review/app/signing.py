"""HMAC signatures for the deck links posted into Google Chat (CLAUDE.md amendment to §4).

A Chat incoming webhook cannot attach a file, so the weekly message carries a link to
`GET /v1/decks/{week_ending}.pdf?sig=...` instead. That route takes no bearer header — it
has to open straight from Chat in a browser — so the signature is the only thing standing
between the room and the deck.

The signature covers the week_ending date only. Anyone holding a link can fetch that one
week's deck; they cannot derive another week's link, and there is no route that mutates
anything.
"""
from __future__ import annotations

import hmac
from datetime import date
from hashlib import sha256


def sign_week(week_ending: date | str, secret: str) -> str:
    msg = week_ending.isoformat() if isinstance(week_ending, date) else str(week_ending)
    return hmac.new(secret.encode(), msg.encode(), sha256).hexdigest()


def verify_week(week_ending: date | str, signature: str, secret: str) -> bool:
    """Constant-time comparison. A bad signature is answered with 404, not 403: the route
    must not confirm whether a week exists."""
    return hmac.compare_digest(sign_week(week_ending, secret), (signature or "").strip())


def deck_url(base_url: str, week_ending: date, secret: str) -> str:
    base = (base_url or "").rstrip("/")
    return f"{base}/v1/decks/{week_ending.isoformat()}.pdf?sig={sign_week(week_ending, secret)}"


# ---- action signatures, for the scheduled trigger ----
#
# A scheduler should not have to hold API_TOKEN. A signature over a fixed action string
# gives it a single URL that needs no header and carries no reusable credential: unlike the
# bearer token it cannot read a deck, list runs, force a re-pull or choose a week. All it
# can do is start the run the schedule would have started anyway, which the §10 cost guard
# then refuses if that week is already stored.

TRIGGER_ACTION = "trigger:weekly-run"


def sign_action(action: str, secret: str) -> str:
    return hmac.new(secret.encode(), action.encode(), sha256).hexdigest()


def verify_action(action: str, signature: str, secret: str) -> bool:
    return hmac.compare_digest(sign_action(action, secret), (signature or "").strip())


def trigger_url(base_url: str, secret: str) -> str:
    base = (base_url or "").rstrip("/")
    return f"{base}/v1/trigger?sig={sign_action(TRIGGER_ACTION, secret)}"
