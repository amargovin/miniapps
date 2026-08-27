"""Postgres connection + idempotent schema application (no ORM, no Alembic — brief §2)."""
from pathlib import Path

import psycopg

from app.config import get_settings

_HERE = Path(__file__).parent


def connect() -> psycopg.Connection:
    return psycopg.connect(get_settings().database_url)


def apply_schema(conn: psycopg.Connection) -> None:
    """Run on every boot. schema.sql is CREATE TABLE IF NOT EXISTS throughout;
    seeds.sql is ON CONFLICT DO NOTHING, so both are safe to re-run."""
    with conn.cursor() as cur:
        cur.execute((_HERE / "schema.sql").read_text())
        cur.execute((_HERE / "seeds.sql").read_text())
    conn.commit()
