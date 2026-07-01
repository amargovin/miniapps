"""Usage metering + grant update/delete."""

from __future__ import annotations

from app.services import tokens as T
from app.services import usage as U


async def test_record_count_and_stats(sm):
    async with sm() as s:
        c = await T.create_client(s, name="Metered", monthly_request_quota=5)
        cid = c.id
        await U.record_event(s, client_id=cid, surface="mcp", endpoint="search_swarajya",
                             status=200, sources=3)
        await U.record_event(s, client_id=cid, surface="rest", endpoint="/api/v1/ask",
                             status=200, input_tokens=100, output_tokens=50)
    async with sm() as s:
        assert await U.count_this_month(s, cid) == 2
        stats = await U.stats_by_client(s)
        assert stats[cid]["requests"] == 2
        assert stats[cid]["input_tokens"] == 100
        assert stats[cid]["output_tokens"] == 50
        assert stats[cid]["last_active"] is not None


async def test_update_group_changes_context(sm):
    async with sm() as s:
        c = await T.create_client(s, name="U")
        cid = c.id
        raw, _ = await T.create_token(s, cid)
        upd = await T.update_client(s, cid, {"monthly_request_quota": 10, "rate_limit_per_minute": 5})
        assert upd.monthly_request_quota == 10 and upd.rate_limit_per_minute == 5
    async with sm() as s:
        ctx = await T.verify_token(s, raw)
        assert ctx.monthly_request_quota == 10 and ctx.rate_limit_per_minute == 5


async def test_delete_client_cascades_tokens(sm):
    async with sm() as s:
        c = await T.create_client(s, name="D")
        cid = c.id
        raw, _ = await T.create_token(s, cid)
    async with sm() as s:
        assert await T.verify_token(s, raw) is not None
        assert await T.delete_client(s, cid) is True
    async with sm() as s:
        assert await T.verify_token(s, raw) is None  # token cascade-deleted
