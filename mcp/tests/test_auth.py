"""Client/token store + rate limiter — no network, isolated temp DB per test."""

from __future__ import annotations

from datetime import timedelta

from app.ratelimit import RateLimiter
from app.security import generate_token, hash_secret, parse_token, verify_secret
from app.services import tokens as T
from app.util import utcnow

# `sm` fixture is provided by tests/conftest.py


async def test_token_roundtrip_and_tamper(sm):
    async with sm() as s:
        client = await T.create_client(s, name="Acme", rate_limit_per_minute=120)
        raw, _ = await T.create_token(s, client.id)
    async with sm() as s:
        ctx = await T.verify_token(s, raw)
        assert ctx is not None and ctx.name == "Acme" and ctx.rate_limit_per_minute == 120
        assert await T.verify_token(s, raw[:-3] + "zzz") is None  # tampered secret
        assert await T.verify_token(s, "swj_deadbeef.nope") is None  # unknown id
        assert await T.verify_token(s, "garbage") is None  # malformed


async def test_revoke(sm):
    async with sm() as s:
        client = await T.create_client(s, name="C")
        raw, token = await T.create_token(s, client.id)
    async with sm() as s:
        assert await T.verify_token(s, raw) is not None
        assert await T.revoke_token(s, token.id) is True
    async with sm() as s:
        assert await T.verify_token(s, raw) is None


async def test_expiry(sm):
    async with sm() as s:
        client = await T.create_client(s, name="C")
        raw, _ = await T.create_token(
            s, client.id, expires_at=utcnow() - timedelta(seconds=1)
        )
    async with sm() as s:
        assert await T.verify_token(s, raw) is None


async def test_deactivated_client_blocks_token(sm):
    async with sm() as s:
        client = await T.create_client(s, name="C")
        raw, _ = await T.create_token(s, client.id)
        await T.deactivate_client(s, client.id)
    async with sm() as s:
        assert await T.verify_token(s, raw) is None


async def test_group_members_share_group_id(sm):
    # A group with two members: both tokens resolve to the same group id,
    # so quota/rate (keyed by group id) is shared across members.
    async with sm() as s:
        g = await T.create_client(s, name="Varahe Analytics", monthly_request_quota=500)
        raw_a, _ = await T.create_token(s, g.id, label="ravi@x.com")
        raw_b, _ = await T.create_token(s, g.id, label="asha@x.com")
    async with sm() as s:
        a = await T.verify_token(s, raw_a)
        b = await T.verify_token(s, raw_b)
        assert a.client_id == b.client_id == g.id
        assert a.monthly_request_quota == 500 and b.monthly_request_quota == 500


def test_rate_limiter():
    rl = RateLimiter()
    assert rl.allow("c1", 2) is True
    assert rl.allow("c1", 2) is True
    assert rl.allow("c1", 2) is False  # third in same minute is blocked
    assert rl.allow("c2", 2) is True  # other client unaffected


def test_security_helpers():
    raw, token_id, secret = generate_token()
    assert raw == f"swj_{token_id}.{secret}"
    assert parse_token(raw) == (token_id, secret)
    assert parse_token("nope") is None
    h = hash_secret(secret)
    assert verify_secret(secret, h) is True
    assert verify_secret("wrong", h) is False
