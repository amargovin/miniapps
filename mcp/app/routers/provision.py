"""Machine-to-machine provisioning webhook.

A single call that creates (or extends) a GROUP and returns ready-to-share
connector URL(s) — for a billing system / CRM / sales flow to hit right after a
Swarajya PRO purchase, instead of an admin clicking through the console.

Auth is a bearer token from the env (`PROVISION_API_KEY`), sent as
`Authorization: Bearer <key>`. This is deliberately a DIFFERENT credential from
the client tokens the gateway checks, and from the admin X-Admin-Key.

Path note: mounted OUTSIDE `/api` and `/mcp` on purpose, so the client-facing
GatewayMiddleware (which bearer-auths those paths as *client* tokens) leaves it
alone. It does its own auth here.
"""

from __future__ import annotations

import hmac
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Client
from app.runtime import get_settings
from app.schemas import ProvisionAccessOut, ProvisionAccessReq
from app.services import tokens as tokensvc
from app.util import utcnow

router = APIRouter(prefix="/provision", tags=["provision"])


def require_provision_key(authorization: str | None = Header(default=None)) -> None:
    key = get_settings().provision_api_key
    if not key:
        raise HTTPException(503, "provisioning disabled: set PROVISION_API_KEY")
    prefix = authorization[:7].lower() if authorization else ""
    supplied = authorization[7:].strip() if prefix == "bearer " else ""
    # Constant-time compare; reject when no/blank token was supplied.
    if not supplied or not hmac.compare_digest(supplied, key):
        raise HTTPException(401, "invalid or missing bearer token")


@router.post(
    "/groups",
    response_model=ProvisionAccessOut,
    dependencies=[Depends(require_provision_key)],
)
async def provision_group(
    body: ProvisionAccessReq, db: AsyncSession = Depends(get_db)
) -> ProvisionAccessOut:
    """Create a group (or extend one via `group_id`) and mint access URL(s)."""
    if body.group_id:
        client = await db.get(Client, body.group_id)
        if client is None:
            raise HTTPException(404, "group_id not found")
        created_group = False
    else:
        if not body.group or not body.group.strip():
            raise HTTPException(422, "provide `group` (name) or `group_id`")
        client = await tokensvc.create_client(
            db,
            name=body.group.strip(),
            contact_email=body.contact_email,
            rate_limit_per_minute=body.rate_limit_per_minute,
            monthly_request_quota=body.monthly_request_quota,
            created_by="provision-webhook",
        )
        created_group = True

    expires_at = (
        utcnow() + timedelta(days=body.expires_in_days) if body.expires_in_days else None
    )
    base = get_settings().public_base_url.rstrip("/")

    urls: list[str] = []
    for i in range(body.seats):
        label = body.label
        if label and body.seats > 1:
            label = f"{label} #{i + 1}"
        raw, _token = await tokensvc.create_token(
            db, client.id, label=label, expires_at=expires_at
        )
        urls.append(f"{base}/s/{raw}/mcp")

    return ProvisionAccessOut(
        group_id=client.id,
        group=client.name,
        created_group=created_group,
        seats=body.seats,
        access_url=urls[0],
        access_urls=urls,
        expires_at=expires_at,
    )
