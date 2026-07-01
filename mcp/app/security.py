"""Token generation, parsing, and hashing.

Token format presented to clients (shown once):  swj_<token_id>.<secret>

`token_id` is a public, indexed lookup key stored in plaintext; `secret` is the
high-entropy part, stored only as a bcrypt hash. This reconciles spec §8's
"strong hashing" with O(1) lookup — bcrypt's per-row salt makes the hash itself
non-indexable, so we index the id and bcrypt-verify the secret.

bcrypt rounds=10 is deliberately modest: the secret is 256-bit random, so it is
not brute-forceable offline regardless, and one verify per request stays cheap
enough that revocation can be immediate (no token cache). Raise rounds, or add a
short-TTL verification cache / Redis, only if request volume demands it.
"""

from __future__ import annotations

import secrets

import bcrypt

_PREFIX = "swj_"
_ROUNDS = 10


def generate_token() -> tuple[str, str, str]:
    """Return (raw_token, token_id, secret)."""
    token_id = secrets.token_hex(8)
    secret = secrets.token_urlsafe(32)
    return f"{_PREFIX}{token_id}.{secret}", token_id, secret


def parse_token(raw: str | None) -> tuple[str, str] | None:
    """Split a raw token into (token_id, secret), or None if malformed."""
    if not raw or not raw.startswith(_PREFIX):
        return None
    body = raw[len(_PREFIX):]
    token_id, sep, secret = body.partition(".")
    if not sep or not token_id or not secret:
        return None
    return token_id, secret


def hash_secret(secret: str) -> str:
    return bcrypt.hashpw(secret.encode(), bcrypt.gensalt(rounds=_ROUNDS)).decode()


def verify_secret(secret: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(secret.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False
