"""Async SQLAlchemy engine/session plumbing for the client + token store."""

from __future__ import annotations

from contextlib import asynccontextmanager
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def _normalize_url(url: str) -> str:
    """Force the async driver. Railway/Heroku hand out `postgres://` or
    `postgresql://`, but SQLAlchemy async needs the `+asyncpg` suffix — so the
    platform-provided DATABASE_URL works unchanged."""
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://"):]
    return url


@lru_cache
def get_engine() -> AsyncEngine:
    from app.runtime import get_settings

    return create_async_engine(_normalize_url(get_settings().database_url))


@lru_cache
def get_sessionmaker() -> async_sessionmaker:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


@asynccontextmanager
async def get_session():
    """Context-manager session — used by middleware and services."""
    async with get_sessionmaker()() as session:
        yield session


async def get_db():
    """FastAPI dependency — yields a session per request."""
    async with get_sessionmaker()() as session:
        yield session


async def init_db() -> None:
    from app import models  # noqa: F401 — registers tables on Base.metadata

    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Idempotent, no-Alembic-yet migrations: add columns introduced after a
    # table's first create. Each runs in its own transaction so an
    # already-exists error is isolated and ignored. Works on SQLite + Postgres.
    for stmt in (
        "ALTER TABLE client_tokens ADD COLUMN raw_token VARCHAR",
        "ALTER TABLE clients ADD COLUMN monthly_request_quota INTEGER",
        "ALTER TABLE client_tokens ADD COLUMN label VARCHAR",
    ):
        try:
            async with get_engine().begin() as conn:
                await conn.exec_driver_sql(stmt)
        except Exception:  # noqa: BLE001 — column already exists
            pass


async def dispose_engine() -> None:
    await get_engine().dispose()
