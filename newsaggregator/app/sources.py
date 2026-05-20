"""Load and validate the source registry from sources.yaml."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

import yaml

from app import config

ALLOWED_BEATS = {"national", "politics", "economy", "tech", "infra"}
ALLOWED_TYPES = {"rss", "html", "screenshot", "homepage"}


@dataclass(frozen=True)
class Source:
    id: str
    name: str
    type: str
    url: str
    beats: tuple[str, ...]
    tier: int
    fetch_interval_min: int
    notes: str | None = None
    # Editorial noise filters (optional). Items whose title/URL matches any
    # pattern are dropped at fetch time before insertion. Patterns are Python
    # regex, case-insensitive, evaluated with re.search.
    exclude_title_patterns: tuple[str, ...] = ()
    exclude_url_patterns: tuple[str, ...] = ()
    # Used by the homepage fetcher: how many pixels to crop, with an
    # optional y-offset to skip ad banners + navigation chrome.
    crop_height: int = 600
    crop_y_offset: int = 0
    extra: dict[str, Any] = field(default_factory=dict)

    def title_filter(self) -> re.Pattern | None:
        if not self.exclude_title_patterns:
            return None
        return re.compile("|".join(f"(?:{p})" for p in self.exclude_title_patterns), re.IGNORECASE)

    def url_filter(self) -> re.Pattern | None:
        if not self.exclude_url_patterns:
            return None
        return re.compile("|".join(f"(?:{p})" for p in self.exclude_url_patterns), re.IGNORECASE)


def _coerce(raw: dict) -> Source:
    sid = raw["id"]
    stype = raw["type"]
    if stype not in ALLOWED_TYPES:
        raise ValueError(f"source {sid}: unknown type {stype!r}")
    beats = tuple(raw.get("beats") or ())
    bad = set(beats) - ALLOWED_BEATS
    if bad:
        raise ValueError(f"source {sid}: unknown beats {bad}")
    tier = int(raw["tier"])
    if tier not in (1, 2, 3):
        raise ValueError(f"source {sid}: tier must be 1/2/3, got {tier}")
    return Source(
        id=sid,
        name=raw["name"],
        type=stype,
        url=raw["url"],
        beats=beats,
        tier=tier,
        fetch_interval_min=int(raw["fetch_interval_min"]),
        notes=raw.get("notes"),
        exclude_title_patterns=tuple(raw.get("exclude_title_patterns") or ()),
        exclude_url_patterns=tuple(raw.get("exclude_url_patterns") or ()),
        crop_height=int(raw.get("crop_height") or 600),
        crop_y_offset=int(raw.get("crop_y_offset") or 0),
    )


def load_sources() -> list[Source]:
    raw = yaml.safe_load(config.SOURCES_YAML.read_text())
    if not isinstance(raw, list):
        raise ValueError("sources.yaml must be a top-level list")
    sources = [_coerce(item) for item in raw]
    seen: set[str] = set()
    for s in sources:
        if s.id in seen:
            raise ValueError(f"duplicate source id: {s.id}")
        seen.add(s.id)
    return sources


def by_id(sources: list[Source]) -> dict[str, Source]:
    return {s.id: s for s in sources}
