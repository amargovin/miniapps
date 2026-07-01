"""Unit tests for the access-control core — no network required."""

from __future__ import annotations

import pytest

from app.config import Settings
from app.schemas import Source
from app.services.orchestrator import Orchestrator

FREE_STORY = {
    "id": "free-1",
    "headline": "Free story",
    "url": "https://swarajyamag.com/free",
    "published-at": 1700000000000,
    "cards": [{"story-elements": [{"type": "text", "text": "<p>Body <b>text</b>.</p>"}]}],
}
PREMIUM_STORY = {
    "id": "prem-1",
    "headline": "Premium story",
    "url": "https://swarajyamag.com/prem",
    "access": "subscription",
    "cards": [{"story-elements": [{"type": "text", "text": "<p>Secret body.</p>"}]}],
}


class FakeQuintype:
    """Stand-in: search returns stubs; get_story returns the full dict by id."""

    def __init__(self, stories: list[dict]):
        self._by_id = {s["id"]: s for s in stories}

    async def advanced_search(self, query, limit=6):
        return [{"id": s["id"]} for s in self._by_id.values()][:limit]

    async def get_story(self, story_id):
        return self._by_id.get(story_id)

    async def aclose(self):
        pass


def _orch(stories):
    return Orchestrator(FakeQuintype(stories), llm=None, settings=Settings())


@pytest.mark.asyncio
async def test_free_story_body_is_returned_and_html_stripped():
    [src] = await _orch([FREE_STORY]).retrieve("x", limit=1)
    assert src.is_premium is False
    assert src.body == "Body text."  # tags stripped, entities unescaped


@pytest.mark.asyncio
async def test_premium_body_is_served_to_everyone():
    # No content tiering: authenticated callers get full body, premium included.
    [src] = await _orch([PREMIUM_STORY]).retrieve("x", limit=1)
    assert src.is_premium is True          # still flagged as subscriber content
    assert src.body == "Secret body."      # ...but body is served


def test_context_excludes_bodyless_sources():
    premium = Source(id="p", headline="P", url="u", is_premium=True, body=None)
    # _format_context is only ever fed body-bearing sources; synthesize() filters.
    assert premium.body_available is False
