"""Usage metering + aggregation (Phase 3 analytics/quotas)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UsageEvent
from app.util import utcnow


def month_start() -> datetime:
    now = utcnow()
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def record_event(
    session: AsyncSession,
    *,
    client_id: str | None,
    surface: str,
    endpoint: str | None = None,
    status: int | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    sources: int | None = None,
    latency_ms: float | None = None,
) -> None:
    session.add(
        UsageEvent(
            id=uuid.uuid4().hex,
            client_id=client_id,
            surface=surface,
            endpoint=endpoint,
            status=status,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            sources=sources,
            latency_ms=latency_ms,
        )
    )
    await session.commit()


async def count_this_month(session: AsyncSession, client_id: str) -> int:
    result = await session.execute(
        select(func.count())
        .select_from(UsageEvent)
        .where(UsageEvent.client_id == client_id, UsageEvent.created_at >= month_start())
    )
    return int(result.scalar_one())


async def stats_by_client(
    session: AsyncSession, since: datetime | None = None
) -> dict[str, dict]:
    """Per-client aggregates {client_id: {requests, input_tokens, output_tokens, last_active}}."""
    query = select(
        UsageEvent.client_id,
        func.count().label("requests"),
        func.coalesce(func.sum(UsageEvent.input_tokens), 0),
        func.coalesce(func.sum(UsageEvent.output_tokens), 0),
        func.max(UsageEvent.created_at),
    )
    if since is not None:
        query = query.where(UsageEvent.created_at >= since)
    query = query.group_by(UsageEvent.client_id)

    result = await session.execute(query)
    return {
        row[0]: {
            "requests": int(row[1]),
            "input_tokens": int(row[2]),
            "output_tokens": int(row[3]),
            "last_active": row[4],
        }
        for row in result.all()
    }
