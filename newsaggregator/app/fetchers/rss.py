"""RSS / Atom fetcher with Google News redirect resolution."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from time import struct_time

import feedparser
import httpx
from selectolax.parser import HTMLParser

from app import config, db
from app.fetchers.base import BaseFetcher, FetchedItem, canonicalize_url
from app.sources import Source

log = logging.getLogger(__name__)

GNEWS_HOSTS = {"news.google.com"}


def _to_dt(t: struct_time | None) -> datetime | None:
    if not t:
        return None
    try:
        return datetime(*t[:6], tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _strip_html(html: str | None) -> str | None:
    if not html:
        return None
    try:
        return HTMLParser(html).text(separator=" ").strip() or None
    except Exception:
        return html


def _entry_body(entry) -> str | None:
    contents = entry.get("content")
    if contents:
        first = contents[0]
        val = first.get("value") if isinstance(first, dict) else getattr(first, "value", None)
        if val:
            return _strip_html(val)
    summary = entry.get("summary") or entry.get("description")
    return _strip_html(summary)


class _GNewsResolver:
    """Resolve a Google News redirect URL to its publisher destination.

    Cached in `gnews_url_cache`. Uses HEAD with redirects, falls back to GET
    for the few endpoints that 4xx HEAD requests.
    """

    def __init__(self, client: httpx.AsyncClient):
        self._client = client
        self._mem: dict[str, str] = {}

    def _from_db(self, url: str) -> str | None:
        with db.connect() as conn:
            row = conn.execute(
                "SELECT canonical_url FROM gnews_url_cache WHERE google_url = ?",
                (url,),
            ).fetchone()
        return row["canonical_url"] if row else None

    def _persist(self, google_url: str, canonical_url: str) -> None:
        with db.connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO gnews_url_cache "
                "(google_url, canonical_url, resolved_at) VALUES (?, ?, ?)",
                (google_url, canonical_url, datetime.now(timezone.utc)),
            )

    async def resolve(self, url: str) -> str:
        if url in self._mem:
            return self._mem[url]
        cached = self._from_db(url)
        if cached:
            self._mem[url] = cached
            return cached
        try:
            resp = await self._client.head(
                url, follow_redirects=True, timeout=config.FETCH_TIMEOUT_SECONDS
            )
            if resp.status_code >= 400:
                resp = await self._client.get(
                    url, follow_redirects=True, timeout=config.FETCH_TIMEOUT_SECONDS
                )
            final = str(resp.url)
        except httpx.HTTPError as e:
            log.warning("gnews resolve failed for %s: %s", url, e)
            final = url
        self._mem[url] = final
        self._persist(url, final)
        return final


class RSSFetcher(BaseFetcher):
    def __init__(self, client: httpx.AsyncClient | None = None):
        self._client = client or httpx.AsyncClient(
            headers={"User-Agent": config.USER_AGENT},
            timeout=config.FETCH_TIMEOUT_SECONDS,
            follow_redirects=True,
        )
        self._owns_client = client is None
        self._resolver = _GNewsResolver(self._client)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def __aenter__(self) -> "RSSFetcher":
        return self

    async def __aexit__(self, *args) -> None:
        await self.aclose()

    def _is_gnews(self, source_url: str) -> bool:
        host = (httpx.URL(source_url).host or "").lower()
        return host in GNEWS_HOSTS

    async def fetch(self, source: Source) -> list[FetchedItem]:
        try:
            resp = await self._client.get(source.url)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            log.warning("fetch failed for %s: %s", source.id, e)
            raise

        parsed = feedparser.parse(resp.content)
        if parsed.bozo and not parsed.entries:
            raise RuntimeError(f"feed parse error for {source.id}: {parsed.bozo_exception}")

        is_gnews = self._is_gnews(source.url)
        now = datetime.now(timezone.utc)
        items: list[FetchedItem] = []

        # Resolve gnews links concurrently, capped to 8.
        if is_gnews:
            sem = asyncio.Semaphore(8)

            async def _resolve(link: str) -> str:
                async with sem:
                    return await self._resolver.resolve(link)

            raw_links = [e.get("link") for e in parsed.entries]
            resolved = await asyncio.gather(
                *(_resolve(link) if link else asyncio.sleep(0, result=link) for link in raw_links),
                return_exceptions=False,
            )
        else:
            resolved = [e.get("link") for e in parsed.entries]

        for entry, link in zip(parsed.entries, resolved):
            if not link:
                continue
            title = (entry.get("title") or "").strip()
            if not title:
                continue
            body = _entry_body(entry)
            author = entry.get("author") or None
            published_at = (
                _to_dt(entry.get("published_parsed"))
                or _to_dt(entry.get("updated_parsed"))
                or now
            )
            canonical = canonicalize_url(link)
            items.append(FetchedItem(
                source_id=source.id,
                url=link,
                canonical_url=canonical,
                title=title,
                body=body,
                author=author,
                published_at=published_at,
                fetched_at=now,
            ))
        return items
