"""APScheduler wiring. Started in main.py lifespan."""
from __future__ import annotations

import asyncio
import logging
import os

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app import jobs

log = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None
_initial_cycle_task: asyncio.Task | None = None


def is_disabled() -> bool:
    """Allow disabling the scheduler via env (handy for tests / one-off scripts)."""
    return os.environ.get("DISABLE_SCHEDULER", "").lower() in ("1", "true", "yes")


async def _initial_cycle() -> None:
    try:
        log.info("running initial fetch+enrich cycle")
        await jobs.fetch_all()
        await jobs.enrich_all()
        log.info("initial cycle done")
    except Exception:
        log.exception("initial cycle failed")


def start() -> AsyncIOScheduler | None:
    global _scheduler, _initial_cycle_task
    if is_disabled():
        log.info("scheduler disabled by DISABLE_SCHEDULER env")
        return None
    if _scheduler is not None:
        return _scheduler
    s = AsyncIOScheduler()
    # NB: fetch + enrich are MANUAL only (via POST /refresh). The editor
    # triggers a full cycle on demand, with progress visible in the UI.
    # Background polling burned API spend without anyone watching.
    s.add_job(jobs.prune_old_data, "cron", hour=3, id="prune", max_instances=1)
    s.start()
    log.info("scheduler started: prune=daily@03:00 (fetch/enrich are manual via /refresh)")
    _scheduler = s
    return s


def shutdown() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        log.info("scheduler stopped")
