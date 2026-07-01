"""Small pure helpers — no app or transport imports."""

from __future__ import annotations

import html
import re
from datetime import datetime, timezone

_TAG_RE = re.compile(r"<[^>]+>")


def utcnow() -> datetime:
    """Naive UTC 'now' — stored timestamps stay naive so DB comparisons match."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def strip_html(text: str) -> str:
    """Quintype text elements are simple HTML. Reduce to plain text."""
    return html.unescape(_TAG_RE.sub("", text or "")).strip()


def ms_to_date(ms: int | float | None) -> str | None:
    """Quintype timestamps are epoch milliseconds. Return an ISO date (UTC)."""
    if not ms:
        return None
    try:
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).date().isoformat()
    except (ValueError, OSError, OverflowError):
        return None
