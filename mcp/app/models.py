"""Client + token tables (spec §8 data model)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.util import utcnow


class Client(Base):
    """A GROUP: the unit that carries quota + rate limits. Members (tokens) live
    under it and share its limits — usage is counted by this row's id."""

    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String, nullable=True)
    # Retained (dead) columns from the earlier grant/tier model — kept so
    # inserts on the existing NOT NULL columns still succeed. Unused.
    kind: Mapped[str] = mapped_column(String, default="generic", nullable=False)
    subject: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    allow_premium: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    rate_limit_per_minute: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Hard cap on requests per calendar month (null = unlimited). Enforced in
    # the gateway; blocks with 429 monthly_quota_exceeded when reached.
    monthly_request_quota: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)

    tokens: Mapped[list["ClientToken"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )


class ClientToken(Base):
    __tablename__ = "client_tokens"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("clients.id"), index=True, nullable=False
    )
    # Public, indexable lookup id (the token's prefix). The secret is never
    # stored — only its bcrypt hash. See app/security.py.
    token_id: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String, nullable=False)
    # A member = one token under a group (Client). `label` names the person/seat
    # (e.g. "ravi@x.com") so members are distinguishable in the console.
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    # Full raw token, stored so the admin can re-copy the subscriber URL anytime.
    # Deliberate trade-off (recoverable at rest vs. hash-only) — see CLAUDE.md.
    # Verification still uses token_hash; this field is display-only.
    raw_token: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    client: Mapped["Client"] = relationship(back_populates="tokens")


class UsageEvent(Base):
    """One row per authenticated request — the metering + analytics source."""

    __tablename__ = "usage_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    client_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, index=True, nullable=False
    )
    surface: Mapped[str] = mapped_column(String, nullable=False)  # "mcp" | "rest"
    endpoint: Mapped[str | None] = mapped_column(String, nullable=True)  # tool or path
    status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Server-side LLM tokens (only on synthesis paths; null for raw-source MCP).
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sources: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
