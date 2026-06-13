"""Smoke test — exercises every tool against the real swarajyamag.com API.

Run with: PYTHONPATH=src python tests/smoke_test.py
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from swarajya_mcp.server import (  # noqa: E402
    GetAuthorInput,
    GetCollectionInput,
    GetStoryInput,
    ListAuthorsInput,
    ListRecentInput,
    ListSectionsInput,
    SearchInput,
    swarajya_get_author,
    swarajya_get_collection,
    swarajya_get_story,
    swarajya_list_authors,
    swarajya_list_recent_stories,
    swarajya_list_sections,
    swarajya_search_stories,
)


def _peek(label: str, payload: str, n: int = 400) -> None:
    print(f"\n=== {label} ===")
    print(payload[:n])
    if len(payload) > n:
        print(f"... (+{len(payload) - n} more chars)")


async def main() -> None:
    sections_json = await swarajya_list_sections(ListSectionsInput())
    _peek("list_sections", sections_json)
    sections = json.loads(sections_json)["sections"]
    assert sections, "no sections returned"
    politics_slug = next((s["slug"] for s in sections if s["slug"] == "politics"), sections[0]["slug"])

    recent_json = await swarajya_list_recent_stories(ListRecentInput(section=politics_slug, limit=3))
    _peek(f"list_recent_stories[{politics_slug}]", recent_json)
    recent = json.loads(recent_json)
    assert recent["items"], "no stories returned"
    slug = recent["items"][0]["slug"]
    author_id = recent["items"][0]["author_id"]

    story_json = await swarajya_get_story(GetStoryInput(slug=slug))
    _peek(f"get_story[{slug}]", story_json, n=700)
    story = json.loads(story_json)
    assert story.get("body_markdown"), "story body is empty"

    search_json = await swarajya_search_stories(SearchInput(query="modi", limit=3))
    _peek("search_stories[modi]", search_json)
    search = json.loads(search_json)
    assert search["items"], "search returned no items"

    coll_json = await swarajya_get_collection(GetCollectionInput(slug=politics_slug, limit=3))
    _peek(f"get_collection[{politics_slug}]", coll_json)

    authors_json = await swarajya_list_authors(ListAuthorsInput(limit=3))
    _peek("list_authors", authors_json)

    if author_id:
        author_profile = await swarajya_get_author(
            GetAuthorInput(author_id=author_id, include_recent_stories=True)
        )
        _peek(f"get_author[{author_id}]", author_profile, n=600)

    print("\nAll smoke tests passed.")


if __name__ == "__main__":
    asyncio.run(main())
