"""FastAPI app entry point. Skeleton step: /healthz only."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app import config, db, scheduler
from app.api.routes import router as api_router
from app.web.routes import router as web_router


def _configure_logging() -> None:
    logging.basicConfig(
        level=getattr(logging, config.LOG_LEVEL, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _configure_logging()
    db.init_schema()
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown()


app = FastAPI(title="news-suggestor", lifespan=lifespan)

_STATIC_DIR = config.REPO_ROOT / "app" / "web" / "static"
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")
app.include_router(web_router)
app.include_router(api_router)


@app.get("/healthz")
async def healthz() -> JSONResponse:
    from app import jobs

    with db.connect() as conn:
        n_stories = conn.execute("SELECT COUNT(*) c FROM stories").fetchone()["c"]
        n_items = conn.execute("SELECT COUNT(*) c FROM raw_items").fetchone()["c"]
    return JSONResponse({
        "ok": True,
        "last_fetch": jobs.last_fetch_at.isoformat() if jobs.last_fetch_at else None,
        "last_enrich": jobs.last_enrich_at.isoformat() if jobs.last_enrich_at else None,
        "last_fetch_summary": jobs.last_fetch_summary,
        "last_enrich_summary": jobs.last_enrich_summary,
        "stories_count": n_stories,
        "raw_items_count": n_items,
    })


def main() -> None:
    """Entry point for `python -m app.main` local dev."""
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
