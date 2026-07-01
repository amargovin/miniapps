"""Client + token store operations (spec §8). All functions take a session."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from app.util import utcnow

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Client, ClientToken
from app.security import generate_token, hash_secret, parse_token, verify_secret


@dataclass
class ClientContext:
    """Attached to a request once its bearer token is verified."""

    client_id: str
    name: str
    rate_limit_per_minute: int | None
    monthly_request_quota: int | None = None


async def create_client(
    session: AsyncSession,
    *,
    name: str,
    description: str | None = None,
    contact_email: str | None = None,
    rate_limit_per_minute: int | None = None,
    monthly_request_quota: int | None = None,
    created_by: str | None = None,
) -> Client:
    """Create a GROUP (name + limits). Members are added via create_token."""
    client = Client(
        id=uuid.uuid4().hex,
        name=name,
        description=description,
        contact_email=contact_email,
        rate_limit_per_minute=rate_limit_per_minute,
        monthly_request_quota=monthly_request_quota,
        created_by=created_by,
    )
    session.add(client)
    await session.commit()
    await session.refresh(client)
    return client


async def list_clients(session: AsyncSession) -> list[Client]:
    result = await session.execute(
        select(Client).options(selectinload(Client.tokens)).order_by(Client.created_at)
    )
    return list(result.scalars().all())


async def create_token(
    session: AsyncSession,
    client_id: str,
    *,
    label: str | None = None,
    expires_at: datetime | None = None,
) -> tuple[str, ClientToken]:
    """Add a MEMBER (token) to a group. Returns (raw_token, row); raw shown ONCE."""
    raw, token_id, secret = generate_token()
    token = ClientToken(
        id=uuid.uuid4().hex,
        client_id=client_id,
        token_id=token_id,
        token_hash=hash_secret(secret),
        raw_token=raw,
        label=label.strip() if label else None,
        expires_at=expires_at,
    )
    session.add(token)
    await session.commit()
    await session.refresh(token)
    return raw, token


async def verify_token(session: AsyncSession, raw: str) -> ClientContext | None:
    parsed = parse_token(raw)
    if not parsed:
        return None
    token_id, secret = parsed

    result = await session.execute(
        select(ClientToken).where(
            ClientToken.token_id == token_id, ClientToken.is_active.is_(True)
        )
    )
    token = result.scalar_one_or_none()
    if token is None or not verify_secret(secret, token.token_hash):
        return None

    now = utcnow()
    if token.expires_at is not None and token.expires_at < now:
        return None

    client = await session.get(Client, token.client_id)
    if client is None or not client.is_active:
        return None

    token.last_used_at = now
    await session.commit()
    return ClientContext(
        client.id,
        client.name,
        client.rate_limit_per_minute,
        client.monthly_request_quota,
    )


async def revoke_token(session: AsyncSession, token_db_id: str) -> bool:
    token = await session.get(ClientToken, token_db_id)
    if token is None:
        return False
    token.is_active = False
    await session.commit()
    return True


async def deactivate_client(session: AsyncSession, client_id: str) -> bool:
    """Soft-disable a client; all its tokens stop working immediately."""
    client = await session.get(Client, client_id)
    if client is None:
        return False
    client.is_active = False
    await session.commit()
    return True


_UPDATABLE = {
    "name",
    "rate_limit_per_minute",
    "monthly_request_quota",
    "is_active",
}


async def update_client(session: AsyncSession, client_id: str, fields: dict) -> Client | None:
    client = await session.get(Client, client_id)
    if client is None:
        return None
    for key, value in fields.items():
        if key in _UPDATABLE:
            setattr(client, key, value)
    await session.commit()
    await session.refresh(client)
    return client


async def delete_client(session: AsyncSession, client_id: str) -> bool:
    """Hard-delete a client and its tokens (cascade). Usage rows are retained."""
    client = await session.get(Client, client_id)
    if client is None:
        return False
    await session.delete(client)
    await session.commit()
    return True
