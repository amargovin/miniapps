"""Single shared password, signed-cookie session.

The dashboard is for a 3-5 person editorial team. The brief
mandates a single password and signed cookie, no per-user accounts.
"""
from __future__ import annotations

import hmac
import logging
import os

from fastapi import Request
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, URLSafeSerializer

log = logging.getLogger(__name__)

COOKIE_NAME = "session"
COOKIE_MAX_AGE_SECONDS = 30 * 24 * 3600  # 30 days
SALT = "news-suggestor-auth"


def _serializer() -> URLSafeSerializer:
    secret = os.environ.get("SESSION_SECRET")
    if not secret:
        raise RuntimeError("SESSION_SECRET is not set")
    return URLSafeSerializer(secret, salt=SALT)


def check_password(pw: str) -> bool:
    expected = os.environ.get("DASHBOARD_PASSWORD", "")
    if not expected:
        return False
    return hmac.compare_digest(pw, expected)


def make_session_value() -> str:
    return _serializer().dumps({"authed": True})


def is_authed(request: Request) -> bool:
    cookie = request.cookies.get(COOKIE_NAME)
    if not cookie:
        return False
    try:
        data = _serializer().loads(cookie)
    except BadSignature:
        return False
    return bool(data.get("authed"))


def require_auth(request: Request) -> RedirectResponse | None:
    """FastAPI dependency: returns a redirect response if not authed.

    Routes that depend on this should pattern-match the return:
        guard = require_auth(request)
        if guard is not None:
            return guard
    """
    if is_authed(request):
        return None
    return RedirectResponse(url="/login", status_code=303)


def set_session_cookie(response, value: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=value,
        max_age=COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=False,  # Railway terminates TLS; cookies still flow over HTTPS to the browser
    )


def clear_session_cookie(response) -> None:
    response.delete_cookie(COOKIE_NAME)
