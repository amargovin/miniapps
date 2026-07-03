"""Pydantic models shared by both transport adapters."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Source(BaseModel):
    """A single Swarajya article, access-controlled and citation-ready."""

    id: str
    headline: str
    url: str
    slug: str | None = None
    published_date: str | None = None
    author: str | None = None
    summary: str | None = None
    is_premium: bool = False
    # Body is present only when the article is free OR the caller is entitled.
    # For premium articles served to non-entitled callers this is None, and the
    # caller gets metadata + citation only (never the text).
    body: str | None = None

    @property
    def body_available(self) -> bool:
        return bool(self.body)


class AskRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    limit: int = Field(6, ge=1, le=20)
    include_related: bool = False


class AskResponse(BaseModel):
    synthesis: str
    sources: list[Source]


# --- admin DTOs (spec §8) ---


class GroupCreate(BaseModel):
    """Create a group: a name + shared limits. Members are added separately."""

    name: str = Field(..., min_length=1, max_length=256)
    description: str | None = None
    contact_email: str | None = None
    rate_limit_per_minute: int | None = Field(None, ge=1)
    monthly_request_quota: int | None = Field(None, ge=1)


class GroupUpdate(BaseModel):
    """Partial update — only fields that are sent are changed."""

    name: str | None = None
    rate_limit_per_minute: int | None = None
    monthly_request_quota: int | None = None
    is_active: bool | None = None


class MemberOut(BaseModel):
    """A member = one token (subscriber URL) under a group."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    token_id: str
    label: str | None = None
    is_active: bool
    created_at: datetime
    expires_at: datetime | None = None
    last_used_at: datetime | None = None
    subscriber_url: str | None = None  # set by the list endpoint for active members


class GroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None = None
    contact_email: str | None = None
    is_active: bool
    rate_limit_per_minute: int | None = None
    monthly_request_quota: int | None = None
    created_at: datetime
    members: list[MemberOut] = []
    # Group-level usage stats populated by the admin list endpoint.
    requests_this_month: int = 0
    requests_total: int = 0
    input_tokens_total: int = 0
    output_tokens_total: int = 0
    last_active: datetime | None = None


class AddMemberReq(BaseModel):
    label: str | None = Field(None, max_length=256)  # e.g. the person's email/name
    expires_in_days: int | None = Field(None, ge=1)


class MemberCreated(BaseModel):
    """The only time the raw token is ever returned — surface it once."""

    token: str
    token_id: str
    group_id: str
    label: str | None = None
    expires_at: datetime | None = None
    # Ready-to-share connector URL (token embedded in the path).
    subscriber_url: str


# --- provisioning webhook DTOs ---


class ProvisionAccessReq(BaseModel):
    """Create (or extend) a group and mint access URL(s) in one call.

    Supply `group` to create a new group, OR `group_id` to add seats to an
    existing one. `seats` controls how many connector URLs are minted.
    """

    group: str | None = Field(None, min_length=1, max_length=256)
    group_id: str | None = None
    contact_email: str | None = None
    seats: int = Field(1, ge=1, le=500)
    label: str | None = Field(None, max_length=256)
    rate_limit_per_minute: int | None = Field(None, ge=1)
    monthly_request_quota: int | None = Field(None, ge=1)
    expires_in_days: int | None = Field(None, ge=1)


class ProvisionAccessOut(BaseModel):
    group_id: str
    group: str
    created_group: bool
    seats: int
    # Convenience: the first URL. `access_urls` holds one per seat.
    access_url: str
    access_urls: list[str]
    expires_at: datetime | None = None
