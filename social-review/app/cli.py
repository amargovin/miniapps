"""CLI entrypoints (brief §2, §11).

Everything the HTTP API does is available here too, over the same `app.pipeline`
functions — this is the fallback for when the api service is unreachable, and the way to
drive the service from a shell inside the container.

The weekly schedule does NOT run through here. There is no Railway cron service (see
CLAUDE.md amendments): the schedule lives outside and triggers `POST /v1/runs`, which
starts the same `run_pipeline` function in the background. One invocation path in
production, so nothing can drift.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from app import db, store
from app.config import get_settings
from app.logging_setup import get_logger
from app.pipeline import (AlreadyStored, BackfillNotConfirmed, ConcurrentRun, NoDataStored,
                          RunRequest, backfill, render_stored_week, renotify_run,
                          run_pipeline, usage_snapshot)


def _week(value: str) -> date:
    return date.fromisoformat(value)


def cmd_init_db(args: argparse.Namespace) -> int:
    with db.connect() as conn:
        db.apply_schema(conn)
    print("schema applied, seeds inserted")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    log = get_logger("cli")
    req = RunRequest(
        week_ending=_week(args.week_ending) if args.week_ending else None,
        force=args.force,
        channels=tuple(args.channels) if args.channels else ("x", "instagram", "facebook"),
        notify=not args.no_notify,
        dry_run=args.dry_run,
    )
    try:
        outcome = run_pipeline(req)
    except ConcurrentRun as exc:
        log.error("cli.run_in_progress", holder_run_id=exc.holder_run_id)
        return 75            # EX_TEMPFAIL: another run holds the lock, try later
    except AlreadyStored as exc:
        # Not a failure: the cost guard did its job and the week's data is already stored.
        # This exits 0 on purpose — a scheduler that retries a non-zero exit would page
        # someone about a healthy system. The refusal itself is unchanged: nothing is
        # re-pulled without --force.
        log.info("cli.week_already_stored_noop",
                 week_ending=exc.week_ending.isoformat(), run_id=exc.run_id,
                 outcome="nothing to do; the week is already stored and was not re-pulled",
                 hint="pass --force to re-pull it (this is billed again)")
        return 0
    print(store.dumps(outcome.as_dict()))
    return 0 if outcome.status in ("ok", "partial") else 1


def cmd_render(args: argparse.Namespace) -> int:
    week_ending = _week(args.week_ending)
    try:
        deck = render_stored_week(week_ending)
    except NoDataStored as exc:
        sys.exit(str(exc))
    out = Path(args.out) if args.out else Path(deck.filename)
    out.write_bytes(deck.pdf)
    print(f"wrote {out} — {deck.slide_count} slide(s), {deck.link_count} link(s)")
    return 0


def cmd_notify(args: argparse.Namespace) -> int:
    try:
        text = renotify_run(args.run_id)
    except NoDataStored as exc:
        sys.exit(str(exc))
    print(text)
    return 0


def cmd_backfill(args: argparse.Namespace) -> int:
    try:
        outcomes = backfill(_week(args.from_), _week(args.to),
                            confirm_cost_usd=args.confirm_cost_usd,
                            notify=args.notify)
    except BackfillNotConfirmed as exc:
        print(str(exc), file=sys.stderr)
        print(f"weeks: {', '.join(w.isoformat() for w in exc.weeks)}", file=sys.stderr)
        print(f"re-run with --confirm-cost-usd {exc.projected_usd}", file=sys.stderr)
        return 1
    for o in outcomes:
        print(store.dumps(o.as_dict()))
    return 0


def cmd_trigger_url(args: argparse.Namespace) -> int:
    """Print the signed trigger URL for a scheduler to hit.

    This is what a scheduler needs, and all it needs: no bearer token, no header, no other
    variables. Regenerate it after rotating API_TOKEN — the old URL stops working, which
    the trigger function reports rather than failing silently.
    """
    from app.signing import trigger_url

    settings = get_settings()
    base = args.base_url or settings.public_base_url
    if not base:
        sys.exit("no base URL: set PUBLIC_BASE_URL or pass --base-url")
    print(trigger_url(base, settings.api_token))
    return 0


def cmd_trigger(args: argparse.Namespace) -> int:
    """POST /v1/runs against this deployment, for a scheduler to invoke.

    This is the start command for a Railway cron service. It exists because the runtime
    image has no curl, and because a scheduler wants sensible exit codes: 0 when a run
    started AND when the cost guard correctly refused one, non-zero only when something is
    actually wrong. It carries an Idempotency-Key so a retry cannot start a second billed
    run.

    It needs only PUBLIC_BASE_URL and API_TOKEN — not the vendor credentials. The pipeline
    runs inside the api service; this only knocks on the door.
    """
    import json as _json
    from datetime import datetime, timezone

    import httpx

    settings = get_settings()
    base = (args.base_url or settings.public_base_url or "").rstrip("/")
    if not base:
        sys.exit("no target: set PUBLIC_BASE_URL or pass --base-url")

    body: dict = {"force": args.force, "notify": not args.no_notify}
    if args.week_ending:
        body["week_ending"] = args.week_ending
    key = args.idempotency_key or (
        f"trigger-{datetime.now(timezone.utc):%Y-%m-%d}-{args.week_ending or 'auto'}")

    log = get_logger("cli")
    try:
        r = httpx.post(f"{base}/v1/runs", json=body, timeout=60.0, headers={
            "Authorization": f"Bearer {settings.api_token}",
            "Idempotency-Key": key,
        })
    except httpx.HTTPError as exc:
        log.error("trigger.unreachable", target=base, error=str(exc))
        return 75                       # EX_TEMPFAIL: the scheduler may retry
    try:
        payload = r.json()
    except ValueError:
        payload = {"body": r.text[:300]}

    if r.status_code == 202:
        log.info("trigger.started", **payload)
        print(_json.dumps(payload))
        return 0
    if r.status_code == 409:
        # The cost guard, or a run already in flight. Both are correct refusals of a
        # healthy service, so this is not a failure — exiting non-zero here would have a
        # scheduler retrying and an operator paged over nothing.
        log.info("trigger.refused", status=409, **payload)
        print(_json.dumps(payload))
        return 0
    log.error("trigger.failed", status=r.status_code, **payload)
    return 1


def cmd_smoke(args: argparse.Namespace) -> int:
    """§10: prove Owned Read pricing on the first deployment, before the cron is enabled."""
    from app.smoke import main as smoke_main

    return smoke_main()


def cmd_usage(args: argparse.Namespace) -> int:
    print(store.dumps(usage_snapshot()))
    return 0


def cmd_dump_fixture(args: argparse.Namespace) -> int:
    """Write a run's stored raw payloads to disk as regression fixtures.

    §9 asks for a regression test against a recorded fixture of the real payloads. The
    payloads are kept in `raw_payloads` for 180 days precisely so they can be extracted
    here rather than hand-written: run the pull once, then freeze what the APIs actually
    returned.
    """
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    with db.connect() as conn:
        run = store.get_run(conn, args.run_id)
        if not run:
            sys.exit(f"no run {args.run_id}")
        rows = store.dump_raw_payloads(conn, args.run_id)
    if not rows:
        sys.exit(f"run {args.run_id} has no stored raw payloads (retention is 180 days)")
    meta = {"run_id": args.run_id, "week_ending": run["week_ending"].isoformat(),
            "week_tz": run["week_tz"],
            "window_start": run["window_start"].isoformat(),
            "window_end": run["window_end"].isoformat(),
            "sources": [r["source"] for r in rows]}
    (out / "manifest.json").write_text(json.dumps(meta, indent=2))
    for r in rows:
        (out / f"{r['source']}.json").write_text(
            json.dumps(r["payload"], indent=2, ensure_ascii=False))
    print(f"wrote {len(rows)} payload(s) + manifest.json to {out}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m app.cli")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("init-db", help="apply schema.sql + seeds.sql (idempotent)")

    run = sub.add_parser("run", help="full pull-and-render for a week")
    run.add_argument("--week-ending",
                     help="Sunday YYYY-MM-DD in WEEK_TZ; default = last completed week")
    run.add_argument("--force", action="store_true",
                     help="re-pull a week already stored with source='api' (costs money)")
    run.add_argument("--channels", nargs="+", choices=["x", "instagram", "facebook"])
    run.add_argument("--no-notify", action="store_true",
                     help="do not post to the Google Chat room")
    run.add_argument("--dry-run", action="store_true",
                     help="fetch and reconcile, write nothing, send nothing, report cost")

    render = sub.add_parser("render", help="re-render PDF from Postgres only, zero vendor calls")
    render.add_argument("--week-ending", required=True)
    render.add_argument("--out", help="output path; default is the deck's own filename")

    notify = sub.add_parser("notify", help="re-post a run's summary + deck link to the room")
    notify.add_argument("run_id", type=int)

    bf = sub.add_parser("backfill", help="sequential runs over a range; confirms projected X cost")
    bf.add_argument("--from", dest="from_", required=True)
    bf.add_argument("--to", required=True)
    bf.add_argument("--confirm-cost-usd", type=float,
                    help="echo back the projected cost to proceed")
    bf.add_argument("--notify", action="store_true")

    sub.add_parser("usage", help="X credit balance, consumption and last run's cost")

    sub.add_parser("smoke", help="prove Owned Read pricing against the live API (§10); "
                                 "run once after deploying, before enabling the schedule")

    tu = sub.add_parser("trigger-url", help="print the signed URL a scheduler should hit")
    tu.add_argument("--base-url", help="default: PUBLIC_BASE_URL")

    tr = sub.add_parser("trigger", help="POST /v1/runs against this deployment; the "
                                        "in-container fallback for a scheduler")
    tr.add_argument("--base-url", help="default: PUBLIC_BASE_URL")
    tr.add_argument("--week-ending", help="default: the last completed week")
    tr.add_argument("--force", action="store_true", help="re-pull a stored week (billed again)")
    tr.add_argument("--no-notify", action="store_true")
    tr.add_argument("--idempotency-key", help="default: derived from today's date")

    df = sub.add_parser("dump-fixture",
                        help="write a run's raw payloads to disk as regression fixtures")
    df.add_argument("run_id", type=int)
    df.add_argument("--out", default="tests/fixtures/week", help="output directory")

    args = p.parse_args(argv)
    get_settings()          # fail fast and loudly if a required env var is missing
    handler = {
        "init-db": cmd_init_db,
        "run": cmd_run,
        "render": cmd_render,
        "notify": cmd_notify,
        "backfill": cmd_backfill,
        "usage": cmd_usage,
        "smoke": cmd_smoke,
        "trigger": cmd_trigger,
        "trigger-url": cmd_trigger_url,
        "dump-fixture": cmd_dump_fixture,
    }[args.command]
    return handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
