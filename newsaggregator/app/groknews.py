"""GrokNews CMS / publish integration.

Single endpoint, Bearer auth, autoPublish flag controls which feed:

  - autoPublish=true  -> /stories-auto.json (Publish button)
  - autoPublish=false -> /stories.json      (To CMS button = draft)

We send the story's canonical title as `topic` and a briefing built from
the brief + key facts + member URLs as `context`.
"""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from app import queries

log = logging.getLogger(__name__)

DEFAULT_WORD_LENGTH = 600
HTTP_TIMEOUT_S = 120  # generate-and-publish includes a Claude call; can be slow
ENDPOINT = "/api/generate-and-publish"


def _base_url() -> str:
    base = os.environ.get("GROKNEWS_API_BASE")
    if not base:
        raise RuntimeError("GROKNEWS_API_BASE env var is not set")
    return base.rstrip("/")


def _api_key() -> str:
    key = os.environ.get("ARTICLE_API_KEY")
    if not key:
        raise RuntimeError("ARTICLE_API_KEY env var is not set")
    return key


def _briefing(story: dict) -> tuple[str, str]:
    """Returns (topic, context) drawn from the story."""
    topic = (story.get("canonical_title") or "").strip()[:1000]

    parts: list[str] = []
    if story.get("brief"):
        parts.append(story["brief"].strip())
    facts = story.get("key_facts") or []
    if facts:
        parts.append("Key facts:")
        parts.extend(f"- {f}" for f in facts[:6])
    sources = story.get("source_names") or []
    if sources:
        parts.append("\nSources already covering: " + ", ".join(sources))
    member_urls = [m.get("url") for m in story.get("members") or [] if m.get("url")]
    if member_urls:
        parts.append("\nReference article URLs:")
        parts.extend(f"- {u}" for u in member_urls[:6])
    context = "\n".join(parts)[:50000]
    return topic, context


class GroknewsError(RuntimeError):
    """GrokNews API returned a non-2xx. Includes status code and response body."""
    def __init__(self, status: int, body: str, path: str):
        self.status = status
        self.body = body
        self.path = path
        super().__init__(f"groknews {path} -> {status}: {body[:400]}")


async def _post(path: str, *, json: dict) -> dict[str, Any]:
    """POST a JSON body to GrokNews; returns the JSON response.

    Raises GroknewsError on 4xx/5xx with the response body included so the
    caller can show GrokNews's own error message to the user.
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {_api_key()}",
    }
    url = f"{_base_url()}{path}"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_S) as client:
        resp = await client.post(url, json=json, headers=headers)
        if resp.status_code >= 400:
            body = resp.text[:1000]
            log.warning(
                "groknews %s -> %d body=%s payload_keys=%s",
                path, resp.status_code, body[:300], list(json.keys()),
            )
            raise GroknewsError(resp.status_code, body, path)
        try:
            return resp.json()
        except ValueError:
            return {"raw": resp.text}


async def generate_and_publish(story_id: int, *, auto: bool) -> dict:
    """Generate + publish the story. `auto=True` lands in /stories-auto.json;
    `auto=False` lands in /stories.json (draft)."""
    story = queries.get_story(story_id)
    if not story:
        raise ValueError(f"story {story_id} not found")
    topic, context = _briefing(story)
    body = {
        "topic": topic,
        "context": context,
        "wordLength": DEFAULT_WORD_LENGTH,
        "autoPublish": bool(auto),
    }
    log.info(
        "groknews generate_and_publish: story=%d autoPublish=%s topic=%r",
        story_id, auto, topic[:80],
    )
    result = await _post(ENDPOINT, json=body)
    return {"ok": True, "mode": "publish" if auto else "to_cms", **result}


# Back-compat aliases — the web routes still import these names.
async def publish_auto(story_id: int) -> dict:
    return await generate_and_publish(story_id, auto=True)


async def publish_to_cms(story_id: int) -> dict:
    return await generate_and_publish(story_id, auto=False)
