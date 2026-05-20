"""SQLite connection helpers. Raw sqlite3 stdlib, no ORM."""
from __future__ import annotations

import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from app import config

log = logging.getLogger(__name__)


def _encode_datetime(dt: datetime) -> str:
    """Always store as tz-aware ISO 8601 UTC."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


sqlite3.register_adapter(datetime, _encode_datetime)


def parse_ts(value) -> datetime | None:
    """Parse a TIMESTAMP column value into a tz-aware datetime, or None."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, bytes):
        value = value.decode("ascii")
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value)
        except ValueError:
            dt = datetime.fromisoformat(value.replace(" ", "T"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    raise TypeError(f"cannot parse timestamp from {type(value)}: {value!r}")


def _connect(path: str = config.DATABASE_PATH) -> sqlite3.Connection:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    # No PARSE_DECLTYPES — Python 3.12's default TIMESTAMP converter crashes on
    # tz-aware ISO 8601 (e.g. '+00:00' suffix). We read timestamps as strings
    # and parse via parse_ts() at the boundary. Insert-side is fine via the
    # datetime adapter registered above.
    conn = sqlite3.connect(path, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """Yield a connection that commits on success, rolls back on exception."""
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _migrate_add_columns_if_missing(conn) -> None:
    """ALTER TABLE ADD COLUMN for columns added after the initial schema.

    SQLite has no `IF NOT EXISTS` on ADD COLUMN, so we try-and-ignore the
    duplicate-column error. Safe to re-run.
    """
    migrations = [
        ("raw_items",   "homepage_tier",            "TEXT"),
        ("stories",     "cms_pushed_at",            "TIMESTAMP"),
        ("stories",     "auto_pushed_at",           "TIMESTAMP"),
    ]
    for table, col, type_ in migrations:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {type_}")
            log.info("migrated: added %s.%s", table, col)
        except sqlite3.OperationalError as e:
            if "duplicate column" not in str(e).lower():
                raise


def init_schema() -> None:
    """Apply schema.sql idempotently on startup."""
    sql = config.SCHEMA_SQL.read_text()
    with connect() as conn:
        conn.executescript(sql)
        _migrate_add_columns_if_missing(conn)
    log.info("schema initialized at %s", config.DATABASE_PATH)
