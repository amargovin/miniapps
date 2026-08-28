"""FastAPI operator control surface (brief §2.1).

One person, one bearer token, no browser client: no CORS headers anywhere, docs disabled
unless ENV=dev, and every error is `{"error": {"code", "message", "run_id"}}` with a stable
machine-readable code. This is a control surface, not a product.

A run takes minutes, so no endpoint blocks on one: `POST /v1/runs` records the run, starts
it in a background task and returns 202 with a run_id to poll. Only one run may be in
flight across all three services — the pipeline takes a Postgres advisory lock and this
layer turns a failure to acquire it into 409 naming the holder.

The one unauthenticated /v1 route is `GET /v1/decks/{week}.pdf?sig=...`: a Google Chat
incoming webhook cannot attach files or send an Authorization header, so the deck link
carries an HMAC signature instead (CLAUDE.md amendment to §4).
"""
from __future__ import annotations

import secrets
import time
from contextlib import asynccontextmanager
from collections import deque
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app import db, store
from app.aggregate import CHANNELS
from app.config import get_settings
from app.logging_setup import get_logger
from app.pipeline import (AlreadyStored, ConcurrentRun, NoDataStored, PipelineError,
                          RunRequest, backfill, open_run, project_cost_usd,
                          render_stored_week, renotify_run, resolve_week_ending,
                          run_pipeline, usage_snapshot, week_range)
from app.signing import TRIGGER_ACTION, verify_action, verify_week
from app.window import WeekEndingError

settings = get_settings()
log = get_logger("api")

_docs = {"docs_url": None, "redoc_url": None, "openapi_url": None}
if settings.env == "dev":
    _docs = {}

@asynccontextmanager
async def _lifespan(_app: FastAPI):
    # schema.sql is CREATE TABLE IF NOT EXISTS throughout and seeds.sql is ON CONFLICT DO
    # NOTHING, so applying both on every boot is the whole migration story (§2).
    with db.connect() as conn:
        db.apply_schema(conn)
    yield


app = FastAPI(title="swarajya-social-review", lifespan=_lifespan, **_docs)


# ---------------- auth, errors, rate limit ----------------

def require_token(request: Request) -> None:
    auth = request.headers.get("authorization", "")
    scheme, _, token = auth.partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(token, settings.api_token):
        # 401 with no detail on mismatch (§2.1)
        raise HTTPException(status_code=401)


def _err(status: int, code: str, message: str, run_id: int | None = None) -> HTTPException:
    return HTTPException(status_code=status,
                         detail={"error": {"code": code, "message": message,
                                           "run_id": run_id}})


@app.exception_handler(HTTPException)
def _http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Every error is shaped `{"error": {...}}`; nothing here ever carries a token or a
    traceback."""
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail,
                            headers=exc.headers)
    code = {401: "unauthorized", 404: "not_found", 422: "unprocessable",
            429: "rate_limited"}.get(exc.status_code, "error")
    message = "" if exc.status_code == 401 else str(exc.detail or "")
    return JSONResponse(status_code=exc.status_code,
                        content={"error": {"code": code, "message": message,
                                           "run_id": None}},
                        headers=exc.headers)


# In-process token bucket. There is one caller; 10 POSTs an hour is generous (§2.1).
_POST_LIMIT = 10
_POST_WINDOW_S = 3600.0
_post_times: deque[float] = deque()


def rate_limit_post() -> None:
    now = time.monotonic()
    while _post_times and now - _post_times[0] > _POST_WINDOW_S:
        _post_times.popleft()
    if len(_post_times) >= _POST_LIMIT:
        retry = int(_POST_WINDOW_S - (now - _post_times[0])) + 1
        raise HTTPException(status_code=429,
                            detail={"error": {"code": "rate_limited",
                                              "message": f"{_POST_LIMIT} POSTs per hour; "
                                                         f"retry in {retry}s",
                                              "run_id": None}},
                            headers={"Retry-After": str(retry)})
    _post_times.append(now)


# ---------------- health ----------------

@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}  # liveness only, no DB call


@app.get("/readyz")
def readyz() -> JSONResponse:
    # Presence of the required env vars is already guaranteed: Settings() refuses to boot
    # without them. Never call a vendor API from a health check.
    missing = [n for n in ("database_url", "api_token", "x_bearer_token",
                           "meta_access_token", "google_chat_webhook")
               if not getattr(settings, n, None)]
    try:
        with db.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    except Exception:
        return JSONResponse(status_code=503,
                            content={"status": "unavailable", "database": False,
                                     "missing_env": missing})
    if missing:
        return JSONResponse(status_code=503,
                            content={"status": "unavailable", "database": True,
                                     "missing_env": missing})
    return JSONResponse(content={"status": "ok"})


# ---------------- bodies ----------------

Channel = Literal["x", "instagram", "facebook"]


class RunBody(BaseModel):
    week_ending: date | None = None
    force: bool = False
    channels: list[Channel] | None = None
    notify: bool = True                # was send_email in §2.1; delivery is Chat now
    dry_run: bool = False


class RenderBody(BaseModel):
    week_ending: date


class BackfillBody(BaseModel):
    from_: date = Field(alias="from")
    to: date
    confirm_cost_usd: float | None = None
    notify: bool = False

    model_config = {"populate_by_name": True}


# ---------------- runs ----------------

def _parse_week(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise _err(422, "bad_week_ending", f"{value!r} is not a YYYY-MM-DD date") from None


def _validated_week(week: date | None) -> date:
    try:
        return resolve_week_ending(week, settings)
    except WeekEndingError as exc:
        raise _err(422, exc.code, exc.message) from None


@app.post("/v1/runs", dependencies=[Depends(require_token), Depends(rate_limit_post)],
          status_code=202)
def create_run(body: RunBody, background: BackgroundTasks,
               idempotency_key: str | None = Header(default=None,
                                                    alias="Idempotency-Key")) -> dict:
    return _start_run(body, background, idempotency_key)


@app.api_route("/v1/trigger", methods=["GET", "POST"], status_code=202)
def trigger(request: Request, background: BackgroundTasks, sig: str = "") -> dict:
    """The scheduled trigger. Signed rather than bearer-authenticated, so a scheduler holds
    one URL and nothing else — no token, no base URL, no header, no env vars to keep in
    sync with this service.

    The signature is over a fixed action string, which makes this URL strictly weaker than
    API_TOKEN rather than an alias for it: it cannot read a deck, list runs, force a
    re-pull, or choose a week. All it can do is start the run the schedule would have
    started anyway — and the §10 cost guard refuses that if the week is already stored, so
    replaying it costs nothing.

    GET is accepted as well as POST because plenty of schedulers and uptime pingers only
    do GET. That does mean a link unfurler or a prefetch could fire it; the blast radius is
    one run of the week that was due, which the guard then no-ops on any repeat. Keep the
    URL out of anywhere that unfurls links all the same.

    404, not 401, on a bad signature — the route must not confirm it exists.
    """
    if not verify_action(TRIGGER_ACTION, sig, settings.api_token):
        raise _err(404, "not_found", "")
    rate_limit_post()
    # One run per UTC day at most, whichever scheduler fires and however often it retries.
    key = f"trigger-{datetime.now(timezone.utc):%Y-%m-%d}"
    log.info("api.trigger", method=request.method)
    return _start_run(RunBody(), background, key)


def _start_run(body: RunBody, background: BackgroundTasks,
               idempotency_key: str | None) -> dict:
    week_ending = _validated_week(body.week_ending)
    channels = tuple(body.channels) if body.channels else CHANNELS

    with db.connect() as conn:
        if idempotency_key:
            # A repeat within 24 hours returns the original run rather than starting a
            # second, billed run (§2.1).
            existing = store.idempotent_run_id(conn, idempotency_key)
            if existing is not None:
                run = store.get_run(conn, existing)
                return {"run_id": existing, "status": (run or {}).get("status", "unknown"),
                        "estimated_cost_usd": 0.0, "idempotent_replay": True}
        if not body.force and store.has_api_rows(conn, week_ending, channels):
            raise _err(409, "week_already_stored",
                       f"week ending {week_ending.isoformat()} is already stored with "
                       f"source='api'; re-send with force=true to pay for another pull",
                       store.run_id_for_week(conn, week_ending))
        if store.running_run_id(conn) is not None and not _lock_free(conn):
            raise _err(409, "run_in_progress", "another run is in progress",
                       store.running_run_id(conn))
        estimate = project_cost_usd(conn, week_ending, channels)
        # The row is created here, synchronously, so the 202 can carry a real id to poll.
        # A dry run writes nothing, so it has no row and no id.
        run_id = None if body.dry_run else open_run(conn, week_ending, settings)
        if run_id is not None and idempotency_key:
            store.record_idempotency_key(conn, idempotency_key, run_id)

    req = RunRequest(week_ending=week_ending, force=body.force, channels=channels,
                     notify=body.notify, dry_run=body.dry_run)
    background.add_task(_run_in_background, req, run_id)
    return {"run_id": run_id, "status": "queued", "estimated_cost_usd": estimate,
            "week_ending": week_ending.isoformat()}


def _lock_free(conn) -> bool:
    """Probe the advisory lock without holding it: if it can be taken, the `running` row
    is stale (a container died mid-run) and a new run may start."""
    if store.try_advisory_lock(conn):
        store.release_advisory_lock(conn)
        return True
    return False


def _run_in_background(req: RunRequest, run_id: int | None) -> None:
    try:
        run_pipeline(req, run_id=run_id)
    except (ConcurrentRun, AlreadyStored) as exc:
        # run_pipeline has already marked the pre-created row failed with the reason.
        log.error("api.run_rejected", code=exc.code, message=str(exc), run_id=run_id)
    except Exception as exc:                                   # noqa: BLE001
        # run_pipeline has already marked the run failed and posted the §11 notice.
        log.error("api.run_failed", error=f"{type(exc).__name__}: {exc}", run_id=run_id)


@app.get("/v1/runs", dependencies=[Depends(require_token)])
def list_runs(limit: int = 20, status: str | None = None) -> Response:
    with db.connect() as conn:
        rows = store.list_runs(conn, limit=max(1, min(limit, 200)), status=status)
    return _json({"runs": rows})


@app.get("/v1/runs/{run_id}", dependencies=[Depends(require_token)])
def get_run(run_id: int) -> Response:
    with db.connect() as conn:
        run = store.get_run(conn, run_id)
        if not run:
            raise _err(404, "run_not_found", f"no run {run_id}")
        totals = store.get_weekly_totals(conn, run["week_ending"])
    run["post_counts"] = {c: r["posts"] for c, r in totals.items()}
    run["weekly_totals"] = totals
    return _json(run)


@app.get("/v1/runs/{run_id}/pdf", dependencies=[Depends(require_token)])
def get_run_pdf(run_id: int) -> Response:
    with db.connect() as conn:
        report = store.get_report_for_run(conn, run_id)
    if not report:
        raise _err(404, "pdf_not_found", f"run {run_id} produced no PDF")
    return _pdf(report)


@app.post("/v1/runs/{run_id}/notify",
          dependencies=[Depends(require_token), Depends(rate_limit_post)])
def renotify(run_id: int) -> dict:
    """Re-post an existing run's summary + deck link to the Chat room. No vendor calls, so
    this costs nothing. (Was POST /runs/{id}/email in §2.1 — delivery is Google Chat now.)"""
    try:
        text = renotify_run(run_id)
    except NoDataStored as exc:
        raise _err(404, "run_not_found", str(exc)) from None
    return {"run_id": run_id, "delivered": True, "text": text}


# ---------------- decks ----------------

@app.get("/v1/decks/{week_ending}.pdf")
def get_deck_signed(week_ending: str, sig: str = "") -> Response:
    """Signed PDF download for Chat links: sig = HMAC-SHA256(API_TOKEN, week_ending),
    compared with hmac.compare_digest. No bearer header needed, so the link opens straight
    from Chat. 404 on a bad signature — never a 403, which would confirm the week exists."""
    if not verify_week(week_ending, sig, settings.api_token):
        raise _err(404, "not_found", "")
    week = _parse_week(week_ending)
    with db.connect() as conn:
        report = store.get_report(conn, week)
    if not report:
        raise _err(404, "not_found", "")
    return _pdf(report, inline=True)


@app.post("/v1/render", dependencies=[Depends(require_token), Depends(rate_limit_post)])
def render_week(body: RenderBody) -> Response:
    """Re-render from Postgres only, with zero vendor API calls. This is the normal way to
    iterate on layout (§10) — never re-run a pull for a layout change."""
    try:
        deck = render_stored_week(body.week_ending)
    except NoDataStored as exc:
        raise _err(404, "week_not_stored", str(exc)) from None
    return Response(content=deck.pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{deck.filename}"',
                             "X-Slide-Count": str(deck.slide_count),
                             "X-Link-Count": str(deck.link_count)})


# ---------------- weeks ----------------

@app.get("/v1/weeks", dependencies=[Depends(require_token)])
def list_weeks() -> Response:
    with db.connect() as conn:
        return _json({"weeks": store.list_weeks(conn)})


@app.get("/v1/weeks/{week_ending}", dependencies=[Depends(require_token)])
def get_week(week_ending: str) -> Response:
    week = _parse_week(week_ending)
    with db.connect() as conn:
        totals = store.get_weekly_totals(conn, week)
        if not totals:
            raise _err(404, "week_not_stored",
                       f"no rows for week ending {week.isoformat()}")
        run_id = store.run_id_for_week(conn, week)
        run = store.get_run(conn, run_id) if run_id else None
    return _json({"week_ending": week.isoformat(), "channels": totals, "run": run})


@app.get("/v1/weeks/{week_ending}/posts", dependencies=[Depends(require_token)])
def get_week_posts(week_ending: str, channel: Channel = "x", limit: int = 100,
                   offset: int = 0) -> Response:
    week = _parse_week(week_ending)
    with db.connect() as conn:
        rows = store.get_week_posts(conn, week, channel, limit=max(1, min(limit, 500)),
                                   offset=max(0, offset))
    return _json({"week_ending": week.isoformat(), "channel": channel, "limit": limit,
                  "offset": offset, "posts": rows})


# ---------------- backfill, usage ----------------

@app.post("/v1/backfill", dependencies=[Depends(require_token), Depends(rate_limit_post)])
def run_backfill(body: BackfillBody, background: BackgroundTasks) -> dict:
    """Without `confirm_cost_usd` this returns 409 and the projected cost; the caller must
    echo that number back to proceed (§2.1)."""
    try:
        weeks = week_range(body.from_, body.to, settings)
    except WeekEndingError as exc:
        raise _err(422, exc.code, exc.message) from None
    except PipelineError as exc:
        raise _err(422, exc.code, str(exc)) from None

    with db.connect() as conn:
        projected = round(sum(project_cost_usd(conn, w, CHANNELS) for w in weeks), 4)
    if body.confirm_cost_usd is None or abs(body.confirm_cost_usd - projected) > 0.005:
        raise _err(409, "cost_not_confirmed",
                   f"{len(weeks)} week(s) would cost about ${projected:.4f} in X post "
                   f"reads; re-send with confirm_cost_usd={projected}")

    background.add_task(backfill, body.from_, body.to,
                        confirm_cost_usd=projected, notify=body.notify)
    return {"status": "queued", "from": body.from_.isoformat(), "to": body.to.isoformat(),
            "weeks": [w.isoformat() for w in weeks], "confirmed_cost_usd": projected}


@app.get("/v1/usage", dependencies=[Depends(require_token)])
def usage() -> Response:
    return _json(usage_snapshot())


# ---------------- responses ----------------

def _json(payload) -> Response:
    """dates, Decimals and bytes are not JSON-serialisable by default and appear all over
    these rows, so every response goes through store.dumps."""
    return Response(content=store.dumps(payload), media_type="application/json")


def _pdf(report: dict, *, inline: bool = False) -> Response:
    disposition = "inline" if inline else "attachment"
    return Response(
        content=bytes(report["pdf"]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{report["filename"]}"',
                 "X-Slide-Count": str(report["slide_count"]),
                 "X-Link-Count": str(report["link_count"])},
    )
