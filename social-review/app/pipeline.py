"""The pipeline, written once as a library function (brief §2).

`run_pipeline` is the whole job: resolve the window, take the advisory lock, pull each
channel, aggregate, verify, render, write one transaction, deliver. `app/cli.py` calls it
for the Railway `weekly` cron service; `app/api.py` calls the same function in a background
task for `POST /v1/runs`. There is no second code path, so the Monday morning run and a
manual run cannot drift apart.
"""
from __future__ import annotations

import traceback
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

import psycopg

from app import db, store
from app.aggregate import (CHANNELS, ChannelRollup, combined, order_rollups, rollup_meta,
                           rollup_x, title_meta, title_x)
from app.config import Settings, get_settings
from app.findings import Duplicates, build_summary, duplicate_stories
from app.logging_setup import get_logger
from app.meta_client import MetaClient, MetaError, MetaPost
from app.notify import (GoogleChatNotifier, NullNotifier, balance_alert_message,
                        failure_message, final_frame, verification_failure_message,
                        weekly_message)
from app.render import build_deck
from app.verify import (Verification, check_meta_reconciliation,
                        check_meta_reconciliation_all, check_no_fabricated_zeros,
                        check_pdf, check_window_coverage, check_x_pagination,
                        final_day_notes, post_dates_meta, post_dates_x)
from app.window import (last_completed_week_ending, validate_week_ending, window_for)
from app.x_client import XClient, XCreditsDepleted, XError, XTooManyPosts

log = get_logger(__name__)


class PipelineError(Exception):
    code = "pipeline_error"


class ConcurrentRun(PipelineError):
    """§2.1: only one run at a time across all three services."""
    code = "run_in_progress"

    def __init__(self, holder_run_id: int | None):
        super().__init__(
            "another run is in progress"
            + (f" (run {holder_run_id})" if holder_run_id else "")
        )
        self.holder_run_id = holder_run_id


class AlreadyStored(PipelineError):
    """§10 cost guard: this week already has api-sourced rows and `force` was not set.
    Re-pulling on a later UTC day is billed in full."""
    code = "week_already_stored"

    def __init__(self, week_ending: date, run_id: int | None):
        super().__init__(
            f"week ending {week_ending.isoformat()} is already stored with source='api'; "
            f"pass force=true to re-pull it (this is billed again)"
        )
        self.week_ending = week_ending
        self.run_id = run_id


class NoDataStored(PipelineError):
    code = "week_not_stored"


@dataclass
class RunRequest:
    week_ending: date | None = None
    force: bool = False
    channels: tuple[str, ...] = CHANNELS
    notify: bool = True
    dry_run: bool = False


@dataclass
class RunOutcome:
    run_id: int | None
    status: str                      # ok | partial | failed
    week_ending: date
    window_start: datetime
    window_end: datetime
    week_tz: str
    channels_ok: list[str] = field(default_factory=list)
    channels_failed: list[str] = field(default_factory=list)
    post_counts: dict[str, int] = field(default_factory=dict)
    verification: list[dict] = field(default_factory=list)
    notes: list[dict] = field(default_factory=list)
    x_cost_usd: float | None = None
    balance_before: float | None = None
    balance_after: float | None = None
    summary: str = ""
    deck_filename: str | None = None
    slide_count: int | None = None
    link_count: int | None = None
    pdf: bytes | None = None
    delivered: bool = False
    error: str | None = None

    def as_dict(self) -> dict:
        d = dict(self.__dict__)
        d.pop("pdf", None)
        d["pdf_available"] = self.slide_count is not None
        d["week_ending"] = self.week_ending.isoformat()
        d["window_start"] = self.window_start.isoformat()
        d["window_end"] = self.window_end.isoformat()
        return d


def resolve_week_ending(req_week: date | None, settings: Settings,
                        now: datetime | None = None) -> date:
    if req_week is None:
        return last_completed_week_ending(settings.week_tz, now)
    return validate_week_ending(req_week, settings.week_tz, now)


def open_run(conn: psycopg.Connection, week_ending: date, settings: Settings) -> int:
    """Insert the `running` row up front so a caller has an id to poll immediately."""
    start, end = window_for(week_ending, settings.week_tz)
    return store.create_run(conn, week_ending=week_ending, week_tz=settings.week_tz,
                            window_start=start, window_end=end)


def project_cost_usd(conn: psycopg.Connection, week_ending: date,
                     channels: tuple[str, ...]) -> float:
    """What POST /v1/runs reports at 202 time, before anything is pulled. Projected from
    the most recent stored X post count, or 400 posts if there is no history."""
    if "x" not in channels:
        return 0.0
    prior, _ = store.prior_week_rows(conn, week_ending)
    posts = int((prior.get("x") or {}).get("posts") or 400)
    return XClient.project_cost_usd(posts, user_reads=1)


def run_pipeline(
    req: RunRequest,
    *,
    settings: Settings | None = None,
    x_client: XClient | None = None,
    meta_client: MetaClient | None = None,
    notifier=None,
    conn: psycopg.Connection | None = None,
    now: datetime | None = None,
    run_id: int | None = None,
) -> RunOutcome:
    """`run_id`: an already-created `runs` row to finish, rather than inserting one. The
    API creates the row synchronously so `POST /v1/runs` can return a real id to poll
    before the background task starts; the CLI lets the pipeline insert its own."""
    settings = settings or get_settings()
    owns_conn = conn is None
    conn = conn or db.connect()
    week_ending = resolve_week_ending(req.week_ending, settings, now)
    week_tz = settings.week_tz
    window_start, window_end = window_for(week_ending, week_tz)
    channels = tuple(c for c in CHANNELS if c in req.channels)

    logger = log.bind(week_ending=week_ending.isoformat(), week_tz=week_tz,
                      window=f"{window_start.isoformat()}/{window_end.isoformat()}",
                      channels=list(channels), dry_run=req.dry_run, force=req.force)
    logger.info("run.window_resolved")

    if not store.try_advisory_lock(conn):
        holder = store.running_run_id(conn)
        if run_id is not None and holder != run_id:
            # A row was pre-created for this run and it will never execute; do not leave it
            # sitting in `running` for the next lock probe to mistake for live work.
            store.finish_run(conn, run_id, status="failed", channels_ok=[],
                             channels_failed=list(channels),
                             notes=[{"note": "run_rejected", "reason": "run_in_progress",
                                     "holder_run_id": holder}], x_cost_usd=None)
        raise ConcurrentRun(holder)

    outcome = RunOutcome(run_id=None, status="failed", week_ending=week_ending,
                         window_start=window_start, window_end=window_end, week_tz=week_tz)
    notifier_obj = notifier
    try:
        if not req.force and store.has_api_rows(conn, week_ending, channels):
            if run_id is not None:
                store.finish_run(conn, run_id, status="failed", channels_ok=[],
                                 channels_failed=list(channels),
                                 notes=[{"note": "run_rejected",
                                         "reason": "week_already_stored"}],
                                 x_cost_usd=None)
            raise AlreadyStored(week_ending, store.run_id_for_week(conn, week_ending))

        if notifier_obj is None:
            notifier_obj = (GoogleChatNotifier(settings.google_chat_webhook)
                            if (req.notify and not req.dry_run) else NullNotifier())

        if not req.dry_run and run_id is None:
            run_id = store.create_run(conn, week_ending=week_ending, week_tz=week_tz,
                                      window_start=window_start, window_end=window_end)
        if req.dry_run:
            run_id = None            # a dry run writes nothing, the run row included
        outcome.run_id = run_id
        if run_id is not None:
            logger = logger.bind(run_id=run_id)

        xc = x_client or XClient(settings.x_bearer_token, settings.x_user_id,
                                 max_posts_per_run=settings.x_max_posts_per_run)
        mc = meta_client or MetaClient(settings.meta_access_token,
                                       fb_page_id=settings.fb_page_id,
                                       ig_user_id=settings.ig_user_id,
                                       api_version=settings.meta_api_version)

        _execute(outcome, req, settings, conn, logger, xc, mc, notifier_obj,
                 week_ending, week_tz, window_start, window_end, channels, run_id)
        return outcome

    except (ConcurrentRun, AlreadyStored):
        raise
    except BaseException as exc:                      # §11: never fail silently
        outcome.status = "failed"
        outcome.error = f"{type(exc).__name__}: {exc}"
        frame = final_frame(exc) if isinstance(exc, Exception) else "n/a"
        logger.error("run.failed", error=outcome.error, frame=frame,
                     traceback=traceback.format_exc(limit=3))
        if run_id is not None:
            outcome.notes.append({"note": "run_failed", "error": outcome.error,
                                  "frame": frame})
            store.finish_run(conn, run_id, status="failed", channels_ok=outcome.channels_ok,
                             channels_failed=list(channels), notes=outcome.notes,
                             x_cost_usd=outcome.x_cost_usd)
        if notifier_obj is not None and not req.dry_run:
            _try_post(notifier_obj, failure_message(
                week_ending=week_ending, run_id=run_id, final_frame=frame,
                error=outcome.error), logger)
        raise
    finally:
        store.release_advisory_lock(conn)
        if owns_conn:
            conn.close()


def _execute(outcome, req, settings, conn, logger, xc, mc, notifier, week_ending, week_tz,
             window_start, window_end, channels, run_id) -> None:
    notes: list[dict] = []
    payloads: list[tuple[str, dict]] = []
    rollups: list[ChannelRollup] = []
    x_posts: list = []
    meta_posts: list[MetaPost] = []
    unavailable: list[str] = []
    v = Verification()
    duplicates: Duplicates | None = None

    outcome.balance_before = xc.fetch_credit_balance() if "x" in channels else None

    # ---------------- X ----------------
    if "x" in channels:
        try:
            followers = xc.fetch_followers()
            timeline = xc.fetch_timeline(window_start, window_end)
            x_posts = timeline.posts
            payloads += timeline.payloads
            notes += timeline.notes
            title_x(x_posts)
            duplicates = duplicate_stories(x_posts)
            rollups.append(rollup_x(x_posts, week_ending=week_ending, week_tz=week_tz,
                                    followers=followers))
            check_x_pagination(v, pages=timeline.pages,
                              posts_returned=timeline.posts_returned,
                              unique_posts=len(x_posts))
            dates = post_dates_x(x_posts, week_tz)
            notes += final_day_notes(week_ending=week_ending, week_tz=week_tz, channel="x",
                                     dates=dates)
            check_window_coverage(v, week_ending=week_ending, week_tz=week_tz, channel="x",
                                  dates=dates, notes=notes)
            outcome.channels_ok.append("x")
            outcome.post_counts["x"] = len(x_posts)
            logger.info("phase.x", posts=len(x_posts), pages=timeline.pages,
                        heads=sum(1 for p in x_posts if p.is_head),
                        engagement=sum(p.engagement for p in x_posts),
                        returned=timeline.posts_returned,
                        duplicates=duplicates.stories if duplicates else 0)
        except (XCreditsDepleted, XTooManyPosts, XError) as exc:
            # Complete the run for the Meta channels and mark X unavailable — never a
            # zero, never last week's number carried forward (§4).
            outcome.channels_failed.append("x")
            unavailable.append("X")
            notes.append({"note": "channel_unavailable", "channel": "x",
                          "error": f"{type(exc).__name__}: {exc}"})
            logger.error("phase.x_unavailable", error=str(exc))

    # ---------------- Meta ----------------
    aggregates: dict[str, dict] = {}
    for channel, fetch, followers_fn in (
        ("instagram", mc.fetch_instagram, lambda: mc.fetch_instagram_followers()[0]),
        ("facebook", mc.fetch_facebook, mc.fetch_facebook_followers),
    ):
        if channel not in channels:
            continue
        try:
            pull = fetch(window_start, window_end)
            followers = followers_fn()
            payloads += pull.payloads
            notes += pull.notes
            title_meta(pull.posts)
            meta_posts += pull.posts
            rollups.append(rollup_meta(channel, pull.posts, week_ending=week_ending,
                                       week_tz=week_tz, followers=followers))
            aggregates[channel] = mc.fetch_aggregate(channel, window_start, window_end)
            check_meta_reconciliation(v, platform=channel, posts=pull.posts,
                                      aggregate=aggregates[channel])
            dates = post_dates_meta(pull.posts, week_tz)
            notes += final_day_notes(week_ending=week_ending, week_tz=week_tz,
                                     channel=channel, dates=dates)
            check_window_coverage(v, week_ending=week_ending, week_tz=week_tz,
                                  channel=channel, dates=dates, notes=notes)
            outcome.channels_ok.append(channel)
            outcome.post_counts[channel] = len(pull.posts)
            logger.info(f"phase.{channel}", posts=len(pull.posts), pages=pull.pages,
                        engagement=sum(p.engagement for p in pull.posts),
                        reconciliation=aggregates[channel])
        except MetaError as exc:
            outcome.channels_failed.append(channel)
            unavailable.append(channel.capitalize())
            notes.append({"note": "channel_unavailable", "channel": channel,
                          "error": f"{type(exc).__name__}: {exc}"})
            logger.error(f"phase.{channel}_unavailable", error=str(exc))

    if aggregates:
        check_meta_reconciliation_all(v, posts=meta_posts, aggregates=aggregates)
    if not outcome.channels_ok:
        raise PipelineError("every requested channel failed; nothing to store")

    # A channel subset re-pull still renders a three-channel deck: the channels this run
    # did not ask for keep the rollups already stored for the week. A channel that WAS
    # asked for and failed is deliberately not filled in from storage — §4 is explicit
    # that an unavailable channel is reported unavailable, never carried forward, and a
    # deck that says "X unavailable" while showing an X row is worse than one that shows
    # nothing.
    if len(channels) < len(CHANNELS):
        stored = store.get_weekly_totals(conn, week_ending)
        for existing in store.load_rollups(conn, week_ending):
            if existing.channel not in channels and existing.channel in stored:
                rollups.append(existing)
                notes.append({"note": "channel_from_stored_rows",
                              "channel": existing.channel,
                              "source": stored[existing.channel]["source"]})
    rollups = order_rollups(rollups)
    check_no_fabricated_zeros(v, rollups=rollups)

    # ---------------- cost accounting (§10) ----------------
    outcome.x_cost_usd = xc.estimated_cost_usd() if "x" in channels else None
    outcome.balance_after = xc.fetch_credit_balance() if "x" in channels else None
    delta = None
    if outcome.balance_before is not None and outcome.balance_after is not None:
        delta = round(outcome.balance_before - outcome.balance_after, 4)
        notes.append({"note": "x_cost", "estimated_usd": outcome.x_cost_usd,
                      "balance_delta_usd": delta})
        logger.info("phase.cost", estimated_usd=outcome.x_cost_usd,
                    balance_delta_usd=delta, balance_after=outcome.balance_after)
        # A widening gap between the two is the earliest signal that Owned Read pricing
        # has stopped applying (§10).
        if outcome.x_cost_usd and delta > outcome.x_cost_usd * 2:
            notes.append({"note": "x_owned_read_pricing_suspect",
                          "estimated_usd": outcome.x_cost_usd,
                          "balance_delta_usd": delta})

    # ---------------- render (§8) ----------------
    prior_rows, prior_week = store.prior_week_rows(conn, week_ending)
    deck = build_deck(week_ending=week_ending, week_tz=week_tz, rollups=rollups,
                      prior_rows=prior_rows, prior_week_ending=prior_week,
                      unavailable=unavailable)
    notes += deck.notes
    outcome.deck_filename = deck.filename
    outcome.slide_count = deck.slide_count
    outcome.link_count = deck.link_count
    outcome.pdf = deck.pdf
    check_pdf(v, pdf=deck.pdf, intended_slides=deck.slide_count,
              intended_links=deck.link_count)
    logger.info("phase.render", slides=deck.slide_count, links=deck.link_count,
                bytes=len(deck.pdf))

    outcome.summary = build_summary(
        week_ending=week_ending, week_tz=week_tz, rollups=rollups, prior=prior_rows,
        prior_week_ending=prior_week, duplicates=duplicates, unavailable=unavailable,
        notes=notes)
    outcome.verification = v.as_list()
    # Persist the checks alongside the run. §2.1 requires GET /v1/runs/{id} to report
    # verification outcomes, and `notes` is the only column that can carry them — without
    # this they exist solely in the caller's stdout, which is no use a week later when
    # someone asks whether that Monday's reconciliation actually passed.
    notes.append({"note": "verification", "ok": v.ok, "checks": v.as_list()})
    outcome.notes = notes
    outcome.status = "ok" if not outcome.channels_failed else "partial"
    logger.info("phase.verify", ok=v.ok,
                failed=[c.name for c in v.failed], checks=len(v.checks))

    # ---------------- write, then deliver ----------------
    if req.dry_run:
        logger.info("run.dry_run_complete", combined=combined(rollups))
        return

    fresh = [r for r in rollups if r.channel in outcome.channels_ok]
    store.write_week(conn, run_id=run_id, week_ending=week_ending, x_posts=x_posts,
                     meta_posts=meta_posts, rollups=fresh, payloads=payloads)
    store.save_report(conn, week_ending=week_ending, run_id=run_id,
                      filename=deck.filename, pdf=deck.pdf,
                      slide_count=deck.slide_count, link_count=deck.link_count)
    store.finish_run(conn, run_id, status=outcome.status, channels_ok=outcome.channels_ok,
                     channels_failed=outcome.channels_failed, notes=notes,
                     x_cost_usd=outcome.x_cost_usd)

    if not v.ok:
        # §9: a verification failure aborts delivery and posts an alert naming the check.
        _try_post(notifier, verification_failure_message(
            week_ending=week_ending, failed=[c.as_dict() for c in v.failed],
            run_id=run_id), logger)
        outcome.status = "partial"
        store.finish_run(conn, run_id, status="partial", channels_ok=outcome.channels_ok,
                         channels_failed=outcome.channels_failed, notes=notes,
                         x_cost_usd=outcome.x_cost_usd)
        return

    if req.notify:
        notifier.post(weekly_message(
            week_ending=week_ending, week_tz=week_tz, summary=outcome.summary,
            public_base_url=settings.public_base_url, api_token=settings.api_token))
        outcome.delivered = True
        logger.info("phase.notify", delivered=True)

    if outcome.balance_after is not None and \
            outcome.balance_after < settings.x_balance_alert_usd:
        _try_post(notifier, balance_alert_message(
            balance_usd=outcome.balance_after,
            threshold_usd=settings.x_balance_alert_usd), logger)


def _try_post(notifier, text: str, logger) -> None:
    """Alerts must never mask the failure they are reporting."""
    try:
        notifier.post(text)
    except Exception as exc:                                # noqa: BLE001
        logger.error("notify.failed", error=str(exc))


# ---------------- re-render and re-notify: zero vendor calls, zero cost ----------------

def render_stored_week(week_ending: date, *, settings: Settings | None = None,
                       conn: psycopg.Connection | None = None,
                       save: bool = True):
    """POST /v1/render — the normal way to iterate on layout (§10)."""
    settings = settings or get_settings()
    owns = conn is None
    conn = conn or db.connect()
    try:
        rollups = store.load_rollups(conn, week_ending)
        if not rollups:
            raise NoDataStored(f"no stored rows for week ending {week_ending.isoformat()}")
        prior_rows, prior_week = store.prior_week_rows(conn, week_ending)
        deck = build_deck(week_ending=week_ending, week_tz=settings.week_tz,
                          rollups=rollups, prior_rows=prior_rows,
                          prior_week_ending=prior_week)
        if save:
            existing = store.get_report(conn, week_ending)
            store.save_report(conn, week_ending=week_ending,
                              run_id=(existing or {}).get("run_id"),
                              filename=deck.filename, pdf=deck.pdf,
                              slide_count=deck.slide_count, link_count=deck.link_count)
        get_logger(__name__).info("render.stored_week",
                                  week_ending=week_ending.isoformat(),
                                  slides=deck.slide_count, links=deck.link_count)
        return deck
    finally:
        if owns:
            conn.close()


def renotify_run(run_id: int, *, settings: Settings | None = None, notifier=None,
                 conn: psycopg.Connection | None = None) -> str:
    """POST /v1/runs/{id}/notify — re-posts the summary and deck link. No vendor calls."""
    settings = settings or get_settings()
    owns = conn is None
    conn = conn or db.connect()
    try:
        run = store.get_run(conn, run_id)
        if not run:
            raise NoDataStored(f"no run {run_id}")
        week_ending = run["week_ending"]
        rollups = store.load_rollups(conn, week_ending)
        prior_rows, prior_week = store.prior_week_rows(conn, week_ending)
        summary = build_summary(
            week_ending=week_ending, week_tz=run["week_tz"], rollups=rollups,
            prior=prior_rows, prior_week_ending=prior_week, duplicates=None,
            unavailable=[c.capitalize() for c in (run["channels_failed"] or [])],
            notes=run["notes"] or [])
        text = weekly_message(week_ending=week_ending, week_tz=run["week_tz"],
                              summary=summary,
                              public_base_url=settings.public_base_url,
                              api_token=settings.api_token,
                              deck_available=bool(store.get_report(conn, week_ending)))
        (notifier or GoogleChatNotifier(settings.google_chat_webhook)).post(text)
        return text
    finally:
        if owns:
            conn.close()


def backfill(from_week: date, to_week: date, *, settings: Settings | None = None,
             confirm_cost_usd: float | None = None, notify: bool = False,
             conn: psycopg.Connection | None = None) -> list[RunOutcome]:
    """Sequential runs over a range. Without `confirm_cost_usd` matching the projection,
    nothing is pulled — the caller must echo the number back (§2.1)."""
    settings = settings or get_settings()
    owns = conn is None
    conn = conn or db.connect()
    try:
        weeks = week_range(from_week, to_week, settings)
        projected = round(sum(project_cost_usd(conn, w, CHANNELS) for w in weeks), 4)
        if confirm_cost_usd is None or abs(confirm_cost_usd - projected) > 0.005:
            raise BackfillNotConfirmed(weeks, projected)
        out = []
        for w in weeks:
            out.append(run_pipeline(RunRequest(week_ending=w, force=True, notify=notify),
                                    settings=settings))
        return out
    finally:
        if owns:
            conn.close()


class BackfillNotConfirmed(PipelineError):
    code = "cost_not_confirmed"

    def __init__(self, weeks: list[date], projected_usd: float):
        super().__init__(
            f"{len(weeks)} week(s) would cost about ${projected_usd:.4f} in X post reads; "
            f"re-send with confirm_cost_usd={projected_usd}"
        )
        self.weeks = weeks
        self.projected_usd = projected_usd


def week_range(from_week: date, to_week: date, settings: Settings) -> list[date]:
    """Every week-ending Sunday from `from_week` to `to_week` inclusive, oldest first, so
    each week's deck has the preceding week already stored to compare against."""
    if to_week < from_week:
        raise PipelineError("`to` precedes `from`")
    cur = validate_week_ending(from_week, settings.week_tz)
    last = validate_week_ending(to_week, settings.week_tz)
    weeks = []
    while cur <= last:
        weeks.append(cur)
        cur = cur + timedelta(days=7)
    return weeks


def usage_snapshot(*, settings: Settings | None = None,
                   x_client: XClient | None = None,
                   conn: psycopg.Connection | None = None) -> dict:
    """GET /v1/usage — X credit balance, month-to-date consumption, and the balance delta
    recorded by the last run."""
    settings = settings or get_settings()
    owns = conn is None
    conn = conn or db.connect()
    try:
        xc = x_client or XClient(settings.x_bearer_token, settings.x_user_id)
        last = store.list_runs(conn, limit=1)
        last_delta = None
        if last:
            run = store.get_run(conn, int(last[0]["id"]))
            for n in (run or {}).get("notes") or []:
                if n.get("note") == "x_cost":
                    last_delta = n.get("balance_delta_usd")
        return {
            "credit_balance_usd": xc.fetch_credit_balance(),
            "balance_alert_usd": settings.x_balance_alert_usd,
            "usage": xc.fetch_usage(),
            "last_run": ({"run_id": int(last[0]["id"]),
                          "x_cost_usd": (float(last[0]["x_cost_usd"])
                                         if last[0]["x_cost_usd"] is not None else None),
                          "balance_delta_usd": last_delta} if last else None),
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        if owns:
            conn.close()
