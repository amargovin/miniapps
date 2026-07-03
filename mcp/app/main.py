"""FastAPI application: website REST surface + mounted MCP server + admin.

Lifespan gotcha: Starlette does NOT run a mounted sub-app's lifespan, and the
FastMCP streamable-HTTP app needs its session manager running. So we drive
`mcp.session_manager.run()` from the parent lifespan here, alongside DB init.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.auth import GatewayMiddleware
from app.db import dispose_engine, init_db
from app.mcp.server import mcp
from app.ratelimit import RateLimiter
from app.routers import admin, ask, provision
from app.runtime import get_orchestrator, get_settings

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper())

_limiter = RateLimiter()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()           # create client/token tables if absent
    get_orchestrator()        # warm singleton (httpx pool + LLM client)
    async with mcp.session_manager.run():
        yield
    await get_orchestrator().aclose()
    await dispose_engine()


app = FastAPI(title="Swarajya MCP", version="0.1.0", lifespan=lifespan)

# Edge gateway: bearer auth + per-client rate limiting + structured access log.
app.add_middleware(GatewayMiddleware, settings=settings, limiter=_limiter)

app.include_router(ask.router)
app.include_router(admin.router)
app.include_router(provision.router)

# Mount the MCP server at root. The FastMCP app serves its endpoint at the
# absolute path "/mcp"; /health, /api/*, /admin/* are registered above and match
# first; the mount is the final, catch-all route.
app.mount("/", mcp.streamable_http_app())
