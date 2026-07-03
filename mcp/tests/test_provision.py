"""Provisioning webhook (POST /provision/groups) — auth + create/extend.

Builds a minimal app with only the provision router, an overridden get_db, and a
patched settings, so it exercises routing + bearer auth + the handler without the
MCP mount or the global DB engine.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI

from app.config import Settings
from app.db import get_db
from app.routers import provision

# `sm` fixture is provided by tests/conftest.py

PROVISION_KEY = "prov-secret"
BASE = "https://mcp.swarajyamag.com"


@pytest.fixture
def client(sm, monkeypatch):
    settings = Settings(provision_api_key=PROVISION_KEY, public_base_url=BASE)
    monkeypatch.setattr(provision, "get_settings", lambda: settings)

    app = FastAPI()
    app.include_router(provision.router)

    async def _db():
        async with sm() as s:
            yield s

    app.dependency_overrides[get_db] = _db
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://t")


async def test_requires_bearer(client):
    async with client as c:
        assert (await c.post("/provision/groups", json={"group": "X"})).status_code == 401
        r = await c.post(
            "/provision/groups", json={"group": "X"},
            headers={"Authorization": "Bearer wrong"},
        )
        assert r.status_code == 401


async def test_create_group_and_seats(client):
    H = {"Authorization": f"Bearer {PROVISION_KEY}"}
    async with client as c:
        r = await c.post(
            "/provision/groups",
            json={"group": "Varahe Analytics", "seats": 3, "label": "Varahe"},
            headers=H,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["created_group"] is True and d["seats"] == 3
        assert len(d["access_urls"]) == 3
        assert d["access_url"] == d["access_urls"][0]
        assert all(u.startswith(f"{BASE}/s/swj_") and u.endswith("/mcp") for u in d["access_urls"])


async def test_extend_existing_group(client):
    H = {"Authorization": f"Bearer {PROVISION_KEY}"}
    async with client as c:
        gid = (await c.post("/provision/groups", json={"group": "G"}, headers=H)).json()["group_id"]
        r = await c.post("/provision/groups", json={"group_id": gid, "seats": 2}, headers=H)
        assert r.status_code == 200
        d = r.json()
        assert d["created_group"] is False and d["group_id"] == gid and len(d["access_urls"]) == 2

        assert (await c.post("/provision/groups", json={"group_id": "nope"}, headers=H)).status_code == 404
        assert (await c.post("/provision/groups", json={"seats": 1}, headers=H)).status_code == 422


async def test_disabled_when_key_unset(sm, monkeypatch):
    monkeypatch.setattr(provision, "get_settings", lambda: Settings(provision_api_key=""))
    app = FastAPI()
    app.include_router(provision.router)

    async def _db():
        async with sm() as s:
            yield s

    app.dependency_overrides[get_db] = _db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
        r = await c.post(
            "/provision/groups", json={"group": "X"},
            headers={"Authorization": "Bearer anything"},
        )
        assert r.status_code == 503
