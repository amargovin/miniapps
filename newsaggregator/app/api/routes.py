"""JSON API + manual admin triggers. Auth required (same cookie as web)."""
from __future__ import annotations

import logging
from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Query, Request

from app import auth, jobs, queries

log = logging.getLogger(__name__)

router = APIRouter()


def _require_auth(request: Request) -> None:
    if not auth.is_authed(request):
        raise HTTPException(status_code=401, detail="auth required")


@router.post("/admin/fetch")
async def admin_fetch(request: Request):
    """Manually trigger fetch_all. Used during step 3 before scheduler exists."""
    _require_auth(request)
    results = await jobs.fetch_all()
    return {
        "sources": len(results),
        "fetched": sum(r.fetched for r in results),
        "inserted": sum(r.inserted for r in results),
        "details": [asdict(r) for r in results],
    }


@router.post("/admin/enrich")
async def admin_enrich(request: Request):
    _require_auth(request)
    await jobs.enrich_all()
    return {"ok": True}


@router.post("/admin/prune")
async def admin_prune(request: Request):
    _require_auth(request)
    result = await jobs.prune_old_data()
    return result


@router.get("/api/stories")
async def api_list_stories(
    request: Request,
    beat: str | None = Query(default=None),
    since: str = Query(default=queries.DEFAULT_SINCE),
    q: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    show_excluded: bool = Query(default=False),
):
    _require_auth(request)
    return {
        "stories": queries.list_top_with_primary_link(
            beat=beat, since=since, search=q, limit=limit,
            include_editorially_excluded=show_excluded,
        )
    }


@router.get("/api/stories/{story_id}")
async def api_get_story(story_id: int, request: Request):
    _require_auth(request)
    story = queries.get_story(story_id)
    if not story:
        raise HTTPException(status_code=404, detail="story not found")
    return story


@router.get("/api/sources/health")
async def api_sources_health(request: Request):
    _require_auth(request)
    return {"sources": queries.source_health()}
