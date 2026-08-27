"""FastAPI operator control surface (brief §2.1).

Status: SCAFFOLD. Auth, health checks and schema-on-boot work; every /v1 route is a 501
stub. No CORS headers anywhere — there is no browser client. Docs are disabled unless
ENV=dev.
"""
import secrets

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app import db
from app.config import get_settings

settings = get_settings()

_docs = {"docs_url": None, "redoc_url": None, "openapi_url": None}
if settings.env == "dev":
    _docs = {}

app = FastAPI(title="swarajya-social-review", **_docs)


@app.on_event("startup")
def _startup() -> None:
    with db.connect() as conn:
        db.apply_schema(conn)


def require_token(request: Request) -> None:
    auth = request.headers.get("authorization", "")
    scheme, _, token = auth.partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(token, settings.api_token):
        # 401 with no detail on mismatch (§2.1)
        raise HTTPException(status_code=401)


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}  # liveness only, no DB call


@app.get("/readyz")
def readyz() -> JSONResponse:
    # presence-only env check happens implicitly: Settings() already refused to boot
    # without required vars. Never call a vendor API from a health check.
    try:
        with db.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return JSONResponse(content={"status": "ok"})


def _not_implemented() -> None:
    raise HTTPException(
        status_code=501,
        detail={"error": {"code": "not_implemented", "message": "scaffold — see CLAUDE.md build order"}},
    )


@app.post("/v1/runs", dependencies=[Depends(require_token)], status_code=202)
def create_run() -> None:
    _not_implemented()


@app.get("/v1/runs", dependencies=[Depends(require_token)])
def list_runs() -> None:
    _not_implemented()


@app.get("/v1/runs/{run_id}", dependencies=[Depends(require_token)])
def get_run(run_id: int) -> None:
    _not_implemented()


@app.get("/v1/runs/{run_id}/pdf", dependencies=[Depends(require_token)])
def get_run_pdf(run_id: int) -> None:
    _not_implemented()


@app.post("/v1/runs/{run_id}/notify", dependencies=[Depends(require_token)])
def renotify(run_id: int) -> None:
    """Re-post an existing run's summary + deck link to the Chat room. No vendor calls.
    (Was POST /runs/{id}/email in the brief — delivery is Google Chat now.)"""
    _not_implemented()


@app.get("/v1/decks/{week_ending}.pdf")
def get_deck_signed(week_ending: str, sig: str = "") -> None:
    """Signed PDF download for Chat links: sig = HMAC-SHA256(API_TOKEN, week_ending),
    compared with hmac.compare_digest. No bearer header needed, so the link opens
    straight from Chat. 404 on bad signature (do not confirm the week exists)."""
    _not_implemented()


@app.post("/v1/render", dependencies=[Depends(require_token)])
def render_week() -> None:
    _not_implemented()


@app.get("/v1/weeks", dependencies=[Depends(require_token)])
def list_weeks() -> None:
    _not_implemented()


@app.get("/v1/weeks/{week_ending}", dependencies=[Depends(require_token)])
def get_week(week_ending: str) -> None:
    _not_implemented()


@app.get("/v1/weeks/{week_ending}/posts", dependencies=[Depends(require_token)])
def get_week_posts(week_ending: str) -> None:
    _not_implemented()


@app.post("/v1/backfill", dependencies=[Depends(require_token)])
def backfill() -> None:
    _not_implemented()


@app.get("/v1/usage", dependencies=[Depends(require_token)])
def usage() -> None:
    _not_implemented()
