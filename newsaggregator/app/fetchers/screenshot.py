"""Screenshot fetcher stub. Not implemented in v1 (brief §7)."""
from __future__ import annotations

import logging

from app.fetchers.base import BaseFetcher, FetchedItem
from app.sources import Source

log = logging.getLogger(__name__)


class ScreenshotFetcher(BaseFetcher):
    async def fetch(self, source: Source) -> list[FetchedItem]:
        log.warning("ScreenshotFetcher not implemented; skipping source %s", source.id)
        return []
