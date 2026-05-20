"""HTML scraper stub. Not implemented in v1 (brief §7)."""
from __future__ import annotations

import logging

from app.fetchers.base import BaseFetcher, FetchedItem
from app.sources import Source

log = logging.getLogger(__name__)


class HTMLScraper(BaseFetcher):
    async def fetch(self, source: Source) -> list[FetchedItem]:
        log.warning("HTMLScraper not implemented; skipping source %s", source.id)
        return []
