"""New retrieval tools: slug parsing, collection extraction, access control."""

from __future__ import annotations

from app.config import Settings
from app.services.orchestrator import Orchestrator, collection_stories, slug_from

FREE = {"id": "f", "headline": "F", "url": "https://s/x",
        "cards": [{"story-elements": [{"type": "text", "text": "body"}]}]}
PREM = {"id": "p", "headline": "P", "url": "https://s/y", "access": "subscription",
        "cards": [{"story-elements": [{"type": "text", "text": "secret"}]}]}


class FakeQ:
    def __init__(self, story=None, items=None, tags=None):
        self._story = story
        self._items = items or []
        self._tags = tags or []

    async def get_story_by_slug(self, slug):
        return self._story

    async def latest(self, limit):
        return self._items[:limit]

    async def breaking(self, limit):
        return self._items[:limit]

    async def trending_tags(self):
        return self._tags

    async def collection(self, slug, limit=12):
        return {"name": "N", "summary": "S",
                "items": [{"type": "story", "story": s} for s in self._items]}

    async def aclose(self):
        pass


def _orch(fake):
    return Orchestrator(fake, llm=None, settings=Settings())


def test_slug_from():
    assert slug_from("https://swarajyamag.com/tech/foo-bar") == "tech/foo-bar"
    assert slug_from("http://swarajyamag.com/a/b/") == "a/b"
    assert slug_from("tech/foo-bar") == "tech/foo-bar"
    assert slug_from("/tech/foo-bar/") == "tech/foo-bar"


def test_collection_stories_flattens_and_limits():
    col = {"items": [
        {"type": "story", "story": {"id": "1", "headline": "A"}},
        {"type": "collection", "items": []},           # skipped (no story/headline)
        {"id": "2", "headline": "B"},                    # bare story
        {"type": "story", "story": {"id": "3", "headline": "C"}},
    ]}
    assert [s["id"] for s in collection_stories(col, 10)] == ["1", "2", "3"]
    assert len(collection_stories(col, 2)) == 2


async def test_get_article_serves_full_body():
    # No tiering — premium article body is served to any authenticated caller.
    src = await _orch(FakeQ(story=PREM)).get_article("https://swarajyamag.com/x/y")
    assert src.is_premium and src.body == "secret"


async def test_latest_and_collection_map_sources():
    o = _orch(FakeQ(items=[FREE, PREM]))
    assert len(await o.latest(10)) == 2
    col = await o.collection("infrastructure", 10)
    assert col["name"] == "N" and len(col["sources"]) == 2
