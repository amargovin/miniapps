"""Fetcher base contract and helpers."""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from app.sources import Source

_TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "amp", "_ga",
}

_WHITESPACE_RE = re.compile(r"\s+")


@dataclass
class FetchedItem:
    source_id: str
    url: str
    canonical_url: str
    title: str
    body: str | None
    author: str | None
    published_at: datetime | None
    fetched_at: datetime
    # Only populated by homepage scrapes — 'hero' / 'secondary' / 'tertiary'
    # based on the anchor's position + font-size on the page.
    homepage_tier: str | None = None


class BaseFetcher:
    """Subclasses implement async fetch(source) -> list[FetchedItem]."""

    async def fetch(self, source: Source) -> list[FetchedItem]:
        raise NotImplementedError


def canonicalize_url(url: str) -> str:
    """Strip tracking params, lowercase host, drop fragment."""
    if not url:
        return url
    parsed = urlparse(url.strip())
    host = (parsed.hostname or "").lower()
    netloc = host
    if parsed.port:
        netloc = f"{host}:{parsed.port}"
    if parsed.username or parsed.password:
        creds = parsed.username or ""
        if parsed.password:
            creds += f":{parsed.password}"
        netloc = f"{creds}@{netloc}"
    query_pairs = [
        (k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in _TRACKING_PARAMS
    ]
    return urlunparse((
        parsed.scheme.lower(),
        netloc,
        parsed.path,
        parsed.params,
        urlencode(query_pairs),
        "",  # drop fragment
    ))


def normalize_text(s: str | None) -> str:
    if not s:
        return ""
    return _WHITESPACE_RE.sub(" ", s).strip().lower()


def content_hash(title: str, body: str | None) -> str:
    payload = f"{normalize_text(title)}\n{normalize_text(body)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
