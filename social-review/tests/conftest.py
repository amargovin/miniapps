"""Shared fixtures.

Env vars are set before any app module is imported: app/config.py refuses to construct
Settings without them, and app/api.py builds its settings at import time.

Database tests run against `TEST_DATABASE_URL` (falling back to `DATABASE_URL`) and skip
with a message when neither points at a reachable Postgres — they are not optional in CI,
where the service has a database, but they must not block a laptop with no server running.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

TEST_TOKEN = "t" * 64

os.environ.setdefault("ENV", "dev")
os.environ.setdefault("API_TOKEN", TEST_TOKEN)
os.environ.setdefault("X_BEARER_TOKEN", "x-bearer-test")
os.environ.setdefault("META_ACCESS_TOKEN", "meta-token-test")
os.environ.setdefault("GOOGLE_CHAT_WEBHOOK", "https://chat.googleapis.com/test")
os.environ.setdefault("PUBLIC_BASE_URL", "https://social-review.test")
os.environ.setdefault("WEEK_TZ", "Asia/Kolkata")
os.environ.setdefault("DATABASE_URL",
                      os.environ.get("TEST_DATABASE_URL",
                                     "postgresql://postgres@127.0.0.1:55432/social_review_test"))
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or os.environ["DATABASE_URL"]

import pytest  # noqa: E402

from app.config import get_settings  # noqa: E402

TABLES = ("idempotency_keys", "raw_payloads", "reports", "weekly_totals", "posts_x",
          "posts_meta", "runs")


@pytest.fixture
def settings():
    return get_settings()


@pytest.fixture(scope="session")
def db_url() -> str:
    return os.environ["DATABASE_URL"]


@pytest.fixture(scope="session")
def _schema(db_url):
    import psycopg
    from app import db as dbmod
    try:
        conn = psycopg.connect(db_url, connect_timeout=5)
    except Exception as exc:                                   # pragma: no cover
        pytest.skip(f"no Postgres at DATABASE_URL ({exc.__class__.__name__}); "
                    f"set TEST_DATABASE_URL to run the database tests")
    with conn:
        dbmod.apply_schema(conn)
    return db_url


@pytest.fixture
def conn(_schema):
    """A clean database per test, with the §5 seed rows re-applied."""
    import psycopg
    from app import db as dbmod
    c = psycopg.connect(_schema)
    with c.cursor() as cur:
        cur.execute("TRUNCATE " + ", ".join(TABLES) + " RESTART IDENTITY CASCADE")
    c.commit()
    dbmod.apply_schema(c)          # re-inserts seeds.sql
    yield c
    c.rollback()
    c.close()


@pytest.fixture
def empty_conn(_schema):
    """A clean database with no seeded history — for first-run behaviour."""
    import psycopg
    c = psycopg.connect(_schema)
    with c.cursor() as cur:
        cur.execute("TRUNCATE " + ", ".join(TABLES) + " RESTART IDENTITY CASCADE")
    c.commit()
    yield c
    c.rollback()
    c.close()


# ---- fixture builders shared across tests ----

def utc(y, m, d, h=0, mi=0, s=0) -> datetime:
    return datetime(y, m, d, h, mi, s, tzinfo=timezone.utc)


def x_row(post_id: str, created: datetime, *, text: str = "A headline about something",
          likes=10, reposts=2, replies=1, quotes=0, bookmarks=3, impressions=1000,
          replied_to: str | None = None, in_reply_to_user_id: str | None = None) -> dict:
    row = {
        "id": post_id,
        "text": text,
        "created_at": created.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "public_metrics": {"like_count": likes, "retweet_count": reposts,
                           "reply_count": replies, "quote_count": quotes,
                           "bookmark_count": bookmarks, "impression_count": impressions},
    }
    if replied_to:
        row["referenced_tweets"] = [{"type": "replied_to", "id": replied_to}]
        row["in_reply_to_user_id"] = in_reply_to_user_id or "2451476942"
    return row


def x_page(rows: list[dict], *, next_token: str | None = None,
           result_count: int | None = None) -> dict:
    meta = {"result_count": result_count if result_count is not None else len(rows)}
    if rows:
        meta["newest_id"] = rows[0]["id"]
        meta["oldest_id"] = rows[-1]["id"]
    if next_token:
        meta["next_token"] = next_token
    payload = {"meta": meta}
    if rows:
        payload["data"] = rows
    return payload


def fb_row(post_id: str, created: datetime, *, likes=5, comments=0, shares=1,
           message="A Facebook post about the week") -> dict:
    return {
        "id": post_id,
        "message": message,
        "created_time": created.strftime("%Y-%m-%dT%H:%M:%S+0000"),
        "permalink_url": f"https://facebook.com/{post_id}",
        "likes": {"summary": {"total_count": likes}},
        "comments": {"summary": {"total_count": comments}},
        "shares": {"count": shares} if shares else None,
    }


def ig_row(post_id: str, created: datetime, *, likes=100, comments=4,
           caption="An Instagram carousel about the week",
           media_type="CAROUSEL_ALBUM") -> dict:
    return {
        "id": post_id,
        "caption": caption,
        "media_type": media_type,
        "permalink": f"https://instagram.com/p/{post_id}/",
        "timestamp": created.strftime("%Y-%m-%dT%H:%M:%S+0000"),
        "like_count": likes,
        "comments_count": comments,
    }


def days(n: int) -> timedelta:
    return timedelta(days=n)
