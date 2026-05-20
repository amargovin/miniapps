"""HTML routes: login, logout, dashboard placeholder."""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from urllib.parse import urlencode

from app import auth, queries

log = logging.getLogger(__name__)

TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

router = APIRouter()


def _ctx(request: Request, **extra) -> dict:
    base = {"authed": auth.is_authed(request)}
    base.update(extra)
    return base


def _filters_from_query(request: Request) -> dict:
    q = request.query_params
    beat = q.get("beat") or "all"
    since = q.get("since") or queries.DEFAULT_SINCE
    if since not in queries.SINCE_PRESETS:
        since = queries.DEFAULT_SINCE
    search = (q.get("q") or "").strip() or None
    show_excluded = (q.get("show_excluded") or "").lower() in ("1", "true", "on", "yes")
    return {
        "beat": beat, "since": since, "q": search,
        "show_excluded": show_excluded,
    }


def _beat_tabs(filters: dict) -> list[dict]:
    options = [("all", "All")] + [
        (b, queries.BEAT_LABELS.get(b, b.capitalize()))
        for b in ("national", "politics", "economy", "tech", "infra")
    ]
    out = []
    for value, label in options:
        params = {k: v for k, v in {
            "beat": value if value != "all" else None,
            "since": filters["since"],
            "q": filters["q"],
        }.items() if v not in (None, "")}
        out.append({
            "value": value,
            "label": label,
            "active": filters["beat"] == value,
            "qs": urlencode(params),
        })
    return out


SINCE_OPTS = [
    {"value": "24h", "label": "Last 24h"},
    {"value": "48h", "label": "Last 48h"},
]


PER_BEAT_LIMIT = 25


def _sections_for(filters: dict) -> list[dict]:
    """Return list of {beat, label, stories} sections to render."""
    if filters["beat"] and filters["beat"] != "all":
        stories = queries.list_top_with_primary_link(
            beat=filters["beat"],
            since=filters["since"],
            search=filters["q"],
            limit=PER_BEAT_LIMIT,
            include_editorially_excluded=filters["show_excluded"],
        )
        if not stories:
            return []
        return [{
            "beat": filters["beat"],
            "label": queries.BEAT_LABELS.get(filters["beat"], filters["beat"].capitalize()),
            "stories": stories,
        }]
    return queries.list_by_beat(
        since=filters["since"],
        search=filters["q"],
        limit_per_beat=PER_BEAT_LIMIT,
        include_editorially_excluded=filters["show_excluded"],
    )


@router.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    from app import jobs

    if not auth.is_authed(request):
        return RedirectResponse(url="/login", status_code=303)
    filters = _filters_from_query(request)
    sections = _sections_for(filters)
    state = jobs.refresh_state
    last_refresh = queries.last_refresh_at()
    return templates.TemplateResponse(
        request,
        "dashboard.html",
        _ctx(
            request,
            sections=sections,
            filters=filters,
            beat_tabs=_beat_tabs(filters),
            since_opts=SINCE_OPTS,
            refresh=state,
            phase_label=PHASE_LABELS.get(state["phase"], state["phase"]),
            phase_order=PHASE_ORDER,
            phase_index=PHASE_ORDER.index(state["phase"]) if state["phase"] in PHASE_ORDER else -1,
            last_refresh_at=last_refresh,
            last_refresh_label=queries.humanize_age(last_refresh),
        ),
    )


@router.get("/partials/stories", response_class=HTMLResponse)
async def stories_partial(request: Request):
    """HTMX endpoint: re-renders the beat sections for filter changes."""
    if not auth.is_authed(request):
        return RedirectResponse(url="/login", status_code=303)
    filters = _filters_from_query(request)
    sections = _sections_for(filters)
    return templates.TemplateResponse(
        request,
        "partials/sections.html",
        _ctx(request, sections=sections, filters=filters),
    )


@router.get("/login", response_class=HTMLResponse)
async def login_form(request: Request):
    if auth.is_authed(request):
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse(request, "login.html", _ctx(request))


@router.post("/login", response_class=HTMLResponse)
async def login_submit(request: Request, password: str = Form(...)):
    if not auth.check_password(password):
        return templates.TemplateResponse(
            request,
            "login.html",
            _ctx(request, error="Wrong password."),
            status_code=401,
        )
    response = RedirectResponse(url="/", status_code=303)
    auth.set_session_cookie(response, auth.make_session_value())
    return response


@router.post("/logout")
async def logout():
    response = RedirectResponse(url="/login", status_code=303)
    auth.clear_session_cookie(response)
    return response


PHASE_LABELS = {
    "idle":           "Ready",
    "fetching":       "Pulling sources",
    "fetching_done":  "Sources fetched",
    "embedding":      "Embedding",
    "clustering":     "Clustering stories",
    "swarajya":       "Checking Swarajya coverage",
    "editorial":      "AI editor reviewing",
    "brief":          "Generating briefs",
    "done":           "Done",
    "error":          "Error",
}
PHASE_ORDER = [
    "fetching", "embedding", "clustering",
    "swarajya", "editorial", "brief", "done",
]


def _refresh_context(request: Request) -> dict:
    from app import jobs
    state = jobs.refresh_state
    return _ctx(
        request,
        refresh=state,
        phase_label=PHASE_LABELS.get(state["phase"], state["phase"]),
        phase_order=PHASE_ORDER,
        phase_index=PHASE_ORDER.index(state["phase"]) if state["phase"] in PHASE_ORDER else -1,
    )


@router.post("/refresh", response_class=HTMLResponse)
async def refresh_start(request: Request):
    """Kick a full fetch+enrich cycle in the background. Returns the status partial.

    Flips refresh_state to running synchronously so the response immediately
    contains the polling hx-trigger; without this, the response would race
    the asyncio task and ship before the task flips phase off "idle".
    """
    import asyncio
    from datetime import datetime, timezone
    from app import jobs

    if not auth.is_authed(request):
        return HTMLResponse("auth required", status_code=401)
    if not jobs.refresh_state["running"]:
        jobs.refresh_state.update({
            "running": True,
            "phase": "fetching",
            "message": "Pulling RSS + homepage sources...",
            "started_at": datetime.now(timezone.utc),
            "finished_at": None,
            "summary": None,
            "error": None,
        })
        asyncio.create_task(jobs.run_full_cycle())
    return templates.TemplateResponse(
        request, "partials/refresh_status.html", _refresh_context(request)
    )


@router.get("/refresh/status", response_class=HTMLResponse)
async def refresh_status(request: Request):
    """Polled by the dashboard while a refresh is running."""
    if not auth.is_authed(request):
        return HTMLResponse("auth required", status_code=401)
    return templates.TemplateResponse(
        request, "partials/refresh_status.html", _refresh_context(request)
    )


@router.get("/partials/last-refresh", response_class=HTMLResponse)
async def last_refresh_partial(request: Request):
    """Auto-polled by the dashboard so the 'Last refreshed' label stays current."""
    if not auth.is_authed(request):
        return HTMLResponse("", status_code=401)
    last = queries.last_refresh_at()
    return templates.TemplateResponse(
        request,
        "partials/last_refresh.html",
        _ctx(request, last_refresh_at=last, last_refresh_label=queries.humanize_age(last)),
    )


def _story_for_modal(story_id: int) -> dict | None:
    """Load a story + members and shape it for the detail template."""
    story = queries.get_story(story_id)
    if story is None:
        return None
    story["source_chips"] = sorted(
        [
            {
                "source_id": m["source_id"],
                "source_name": m["source_name"],
                "source_tier": m["source_tier"],
                "url": m["url"],
            }
            for m in story.get("members", [])
        ],
        key=lambda c: c["source_tier"],
    )
    return story


@router.get("/stories/{story_id}/detail", response_class=HTMLResponse)
async def story_detail(story_id: int, request: Request):
    """Render the full story modal contents."""
    if not auth.is_authed(request):
        return HTMLResponse("auth required", status_code=401)
    story = _story_for_modal(story_id)
    if story is None:
        return HTMLResponse("not found", status_code=404)
    rank = request.query_params.get("rank")
    rank = int(rank) if rank and rank.isdigit() else None
    return templates.TemplateResponse(
        request,
        "partials/story_detail.html",
        _ctx(request, s=story, rank=rank, gn_result=None),
    )


async def _groknews_background(story_id: int, mode: str) -> None:
    """Run the GrokNews call without blocking the HTTP response. Errors are
    logged server-side; the editor has already moved on by the time they happen.
    """
    from app import groknews

    try:
        if mode == "publish":
            await groknews.publish_auto(story_id)
        else:
            await groknews.publish_to_cms(story_id)
        log.info("groknews %s ok for story %d", mode, story_id)
    except groknews.GroknewsError as e:
        log.warning("groknews %s -> %d for story %d body=%s", mode, e.status, story_id, e.body[:300])
    except Exception:
        log.exception("groknews %s failed for story %d", mode, story_id)


# Per-story per-mode lockout. A second push of the same (story, mode) within
# this window is treated as a duplicate click and refused. Reset by waiting
# the window out — easier than a "force resend" button, and rare in practice.
GROKNEWS_DEDUP_WINDOW_SEC = 60 * 60  # 1 hour


async def _groknews_action(story_id: int, request: Request, mode: str) -> HTMLResponse:
    """Fire-and-forget with server-side dedup. We atomically claim the slot
    (timestamp the column) before spawning the task; a second click in the
    same window finds the timestamp already set and gets the "already sent"
    message instead of triggering another API call.
    """
    import asyncio
    from datetime import datetime, timedelta, timezone

    from app import db

    if not auth.is_authed(request):
        return HTMLResponse("auth required", status_code=401)
    story = _story_for_modal(story_id)
    if story is None:
        return HTMLResponse("not found", status_code=404)
    rank_raw = request.query_params.get("rank")
    rank = int(rank_raw) if rank_raw and rank_raw.isdigit() else None

    col = "auto_pushed_at" if mode == "publish" else "cms_pushed_at"
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=GROKNEWS_DEDUP_WINDOW_SEC)

    with db.connect() as conn:
        row = conn.execute(
            f"SELECT {col} AS pushed FROM stories WHERE id = ?", (story_id,)
        ).fetchone()
        existing = row["pushed"] if row else None
        if isinstance(existing, str):
            try:
                existing = datetime.fromisoformat(existing)
            except ValueError:
                existing = None
        if existing and existing.tzinfo is None:
            existing = existing.replace(tzinfo=timezone.utc)

        if existing and existing > cutoff:
            ago = queries.humanize_age(existing, now)
            label = "Published" if mode == "publish" else "Sent to CMS"
            return templates.TemplateResponse(
                request, "partials/story_detail.html",
                _ctx(request, s=story, rank=rank, gn_result={
                    "ok": True,
                    "mode": mode,
                    "message": f"Already {label.lower()} {ago} — duplicate skipped",
                    "duplicate": True,
                }),
            )

        # Atomically claim the slot. A racing second request will read the
        # just-written timestamp on its own SELECT and bail out above.
        conn.execute(f"UPDATE stories SET {col} = ? WHERE id = ?", (now, story_id))

    asyncio.create_task(_groknews_background(story_id, mode))
    message = (
        "Queued → auto-feed (/stories-auto.json). Check feed in ~30s."
        if mode == "publish"
        else "Queued → draft RSS (/stories.json). Check feed in ~30s."
    )
    return templates.TemplateResponse(
        request,
        "partials/story_detail.html",
        _ctx(request, s=story, rank=rank, gn_result={"ok": True, "mode": mode, "message": message}),
    )


@router.post("/stories/{story_id}/to-cms", response_class=HTMLResponse)
async def story_to_cms(story_id: int, request: Request):
    """Send to the draft RSS feed (Option A two-step, autoPublish=false)."""
    return await _groknews_action(story_id, request, mode="to_cms")


@router.post("/stories/{story_id}/publish", response_class=HTMLResponse)
async def story_publish(story_id: int, request: Request):
    """One-shot auto-publish (Option B)."""
    return await _groknews_action(story_id, request, mode="publish")


