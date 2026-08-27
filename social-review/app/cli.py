"""CLI entrypoints (brief §2, §11).

`python -m app.cli run` is the entrypoint for the Railway `weekly` cron service: the
container starts, runs to completion, and exits. No web server, no scheduler loop.

Status: SCAFFOLD. `init-db` works; the pipeline commands are stubs — see CLAUDE.md for
the build order. The pipeline must be written once as a library function (app/pipeline.py)
that both this CLI and app/api.py call.
"""
import argparse
import sys


def cmd_init_db(args: argparse.Namespace) -> int:
    from app import db

    with db.connect() as conn:
        db.apply_schema(conn)
    print("schema applied, seeds inserted")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    sys.exit("not implemented — build order step 1-4 first (see CLAUDE.md)")


def cmd_render(args: argparse.Namespace) -> int:
    sys.exit("not implemented — build order step 5 (see CLAUDE.md)")


def cmd_backfill(args: argparse.Namespace) -> int:
    sys.exit("not implemented — build order step 7 (see CLAUDE.md)")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m app.cli")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("init-db", help="apply schema.sql + seeds.sql (idempotent)")

    run = sub.add_parser("run", help="full pull-and-render for a week")
    run.add_argument("--week-ending", help="Sunday YYYY-MM-DD in WEEK_TZ; default = last completed week")
    run.add_argument("--force", action="store_true", help="re-pull a week already stored with source='api' (costs money)")
    run.add_argument("--channels", nargs="+", choices=["x", "instagram", "facebook"])
    run.add_argument("--no-email", action="store_true")
    run.add_argument("--dry-run", action="store_true")

    render = sub.add_parser("render", help="re-render PDF from Postgres only, zero vendor calls")
    render.add_argument("--week-ending", required=True)

    backfill = sub.add_parser("backfill", help="sequential runs over a date range; confirms projected X cost")
    backfill.add_argument("--from", dest="from_", required=True)
    backfill.add_argument("--to", required=True)

    args = p.parse_args(argv)
    handler = {
        "init-db": cmd_init_db,
        "run": cmd_run,
        "render": cmd_render,
        "backfill": cmd_backfill,
    }[args.command]
    return handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
