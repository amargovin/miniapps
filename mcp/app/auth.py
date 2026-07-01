"""Edge gateway: bearer auth + per-client rate limiting + structured access log.

Two credential locations are accepted, because the consumer connector UIs
(Claude.ai, ChatGPT) won't let a user paste an Authorization header:

  • Header:  `Authorization: Bearer swj_…`  — programmatic / SDK / Claude Code.
  • Path:    `/s/<token>/mcp` (or `/s/<token>/api/v1/ask`) — the per-subscriber
             URL. The gateway extracts the token, verifies it, then rewrites the
             scope path (strips `/s/<token>`) so normal routing continues.

Implemented as PURE ASGI middleware (not BaseHTTPMiddleware) so it never buffers
the MCP endpoint's streaming (text/event-stream) responses. Protected: /api/**,
/mcp/**, and any /s/** subscriber URL. Open: /health, /admin/** (admin-key gated
in its own router), /docs, OPTIONS preflight.
"""

from __future__ import annotations

import json
import logging
import time

from starlette.datastructures import Headers
from starlette.responses import JSONResponse

from app.config import Settings
from app.context import current_grant, usage_sink
from app.db import get_session
from app.ratelimit import RateLimiter
from app.services import usage
from app.services.tokens import verify_token

_access_log = logging.getLogger("swarajya.access")

_SUB_PREFIX = "/s/"


def _is_protected(path: str, method: str) -> bool:
    if method == "OPTIONS":
        return False
    return path == "/mcp" or path.startswith("/mcp/") or path.startswith("/api")


class GatewayMiddleware:
    def __init__(self, app, settings: Settings, limiter: RateLimiter):
        self.app = app
        self.settings = settings
        self.limiter = limiter

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        raw_path = scope.get("path", "")
        method = scope.get("method", "")
        start = time.perf_counter()

        # Per-subscriber URL: pull the token out of the path and rewrite the
        # scope so downstream routing sees the real endpoint.
        token: str | None = None
        via_path = False
        app_scope = scope
        if method != "OPTIONS" and raw_path.startswith(_SUB_PREFIX):
            token, sep, tail = raw_path[len(_SUB_PREFIX):].partition("/")
            new_path = "/" + tail if sep else "/"
            app_scope = {**scope, "path": new_path, "raw_path": new_path.encode("utf-8")}
            via_path = True

        eff_path = app_scope["path"]
        protected = via_path or _is_protected(eff_path, method)
        surface = "mcp" if (eff_path == "/mcp" or eff_path.startswith("/mcp/")) else "rest"
        client_id: str | None = None
        grant_token = None
        sink_token = None

        if protected and not self.settings.disable_auth:
            if not via_path:
                authz = Headers(scope=scope).get("authorization", "")
                token = authz[7:].strip() if authz[:7].lower() == "bearer " else ""

            ctx = None
            over_quota = False
            if token:
                async with get_session() as session:
                    ctx = await verify_token(session, token)
                    if ctx is not None:
                        quota = (
                            ctx.monthly_request_quota
                            if ctx.monthly_request_quota is not None
                            else self.settings.monthly_request_quota_default
                        )
                        if quota is not None:
                            used = await usage.count_this_month(session, ctx.client_id)
                            over_quota = used >= quota

            if ctx is None:
                return await self._reply(
                    scope, receive, send, 401, {"error": "unauthorized"},
                    start, method, eff_path, None,
                )
            if over_quota:
                return await self._reply(
                    scope, receive, send, 429, {"error": "monthly_quota_exceeded"},
                    start, method, eff_path, ctx.client_id,
                )

            limit = ctx.rate_limit_per_minute or self.settings.rate_limit_per_minute_default
            if not self.limiter.allow(ctx.client_id, limit):
                return await self._reply(
                    scope, receive, send, 429, {"error": "rate_limited"},
                    start, method, eff_path, ctx.client_id, {"Retry-After": "60"},
                )

            client_id = ctx.client_id
            grant_token = current_grant.set(ctx)
            sink_token = usage_sink.set({})

        status = {"code": None}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
            await send(message)

        try:
            await self.app(app_scope, receive, send_wrapper)
        finally:
            sink = usage_sink.get() if sink_token is not None else None
            if grant_token is not None:
                current_grant.reset(grant_token)
            if sink_token is not None:
                usage_sink.reset(sink_token)
            latency = round((time.perf_counter() - start) * 1000, 1)
            self._log(method, eff_path, status["code"], start, client_id)
            if client_id is not None:
                await self._meter(client_id, surface, eff_path, status["code"], latency, sink or {})

    async def _meter(self, client_id, surface, eff_path, status, latency, sink):
        try:
            async with get_session() as session:
                await usage.record_event(
                    session,
                    client_id=client_id,
                    surface=surface,
                    endpoint=sink.get("endpoint") or eff_path,
                    status=status,
                    input_tokens=sink.get("input_tokens"),
                    output_tokens=sink.get("output_tokens"),
                    sources=sink.get("sources"),
                    latency_ms=latency,
                )
        except Exception:  # noqa: BLE001 — metering must never break a request
            pass

    async def _reply(self, scope, receive, send, code, body, start, method, path, client_id, headers=None):
        response = JSONResponse(body, status_code=code, headers=headers or {})
        await response(scope, receive, send)
        self._log(method, path, code, start, client_id)

    @staticmethod
    def _log(method, path, status, start, client_id):
        _access_log.info(
            json.dumps(
                {
                    "method": method,
                    "path": path,
                    "status": status,
                    "latency_ms": round((time.perf_counter() - start) * 1000, 1),
                    "client_id": client_id,
                }
            )
        )
