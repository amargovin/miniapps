"""Convert Quintype's verbose JSON shapes into trim, agent-friendly payloads.

The Quintype Story API returns a lot of noise — internal IDs, image-sizing
metadata, share permission flags, comment configs — that bloats context and
isn't useful for content tasks. These helpers strip responses down to the
fields an LLM actually needs to reason about the article.

Story bodies live in `story.cards[].story-elements[]` as a structured JSON
representation of rich content. We render them to clean markdown so Claude
can quote, summarize, or restyle the piece without parsing HTML.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from markdownify import markdownify as html_to_md


# ---- Timestamps ------------------------------------------------------------------

def _epoch_ms_to_iso(value: int | None) -> str | None:
    if value is None:
        return None
    try:
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc).isoformat()
    except (OverflowError, OSError, ValueError):
        return None


# ---- Story body rendering --------------------------------------------------------

_TEXT_LIKE_TYPES = {"text", "blurb", "summary", "blockquote", "quote", "answer", "question"}


def _render_element(elem: dict[str, Any]) -> str:
    """Render one story-element to markdown."""
    etype = elem.get("type")
    subtype = elem.get("subtype")
    text = elem.get("text") or ""

    if etype == "title":
        return f"\n## {text.strip()}\n"

    if etype in _TEXT_LIKE_TYPES:
        md = html_to_md(text, heading_style="ATX", strip=["script", "style"]).strip()
        if subtype == "summary" and md:
            return f"> {md}\n"
        if subtype in {"q", "question"} and md:
            return f"**Q.** {md}\n"
        if subtype in {"a", "answer"} and md:
            return f"**A.** {md}\n"
        if etype in {"blockquote", "quote"} and md:
            return "\n".join(f"> {line}" for line in md.splitlines()) + "\n"
        return md + "\n"

    if etype == "image":
        caption = (elem.get("title") or "").strip()
        attribution = (elem.get("image-attribution") or "").strip()
        meta = elem.get("metadata") or {}
        alt = caption or (elem.get("alt-text") or "").strip() or "image"
        s3_key = elem.get("image-s3-key") or meta.get("image-s3-key")
        url = f"https://images.assettype.com/{s3_key}" if s3_key else ""
        line = f"![{alt}]({url})" if url else f"_[image: {alt}]_"
        if caption:
            line += f"\n*{caption}*"
        if attribution:
            line += f" — {attribution}"
        return line + "\n"

    if etype == "youtube-video":
        url = elem.get("url") or elem.get("embed-url") or ""
        return f"[YouTube video]({url})\n" if url else ""

    if etype == "twitter":
        url = elem.get("url") or ""
        return f"[Tweet]({url})\n" if url else ""

    if etype == "jsembed" or etype == "external-link":
        url = elem.get("url") or ""
        title = (elem.get("title") or url).strip()
        return f"[{title}]({url})\n" if url else ""

    # Unknown / unhandled elements — keep but flag rather than silently drop.
    if text:
        md = html_to_md(text, heading_style="ATX").strip()
        if md:
            return md + "\n"
    return ""


def render_story_body(story: dict[str, Any]) -> str:
    """Walk cards → story-elements and produce a single markdown string."""
    parts: list[str] = []
    for card in story.get("cards") or []:
        for elem in card.get("story-elements") or []:
            chunk = _render_element(elem)
            if chunk:
                parts.append(chunk.rstrip())
    return "\n\n".join(parts).strip()


# ---- Story summaries -------------------------------------------------------------

def _sections_summary(sections: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for s in sections or []:
        if not s:
            continue
        out.append({"name": s.get("name"), "slug": s.get("slug"), "id": s.get("id")})
    return out


def _tags_summary(tags: list[dict[str, Any]] | None) -> list[str]:
    return [t.get("name") for t in (tags or []) if t and t.get("name")]


def trim_story_summary(story: dict[str, Any]) -> dict[str, Any]:
    """Compact representation suitable for lists & search results."""
    return {
        "id": story.get("id"),
        "headline": story.get("headline"),
        "subheadline": story.get("subheadline"),
        "slug": story.get("slug"),
        "url": story.get("url"),
        "author": story.get("author-name"),
        "author_id": story.get("author-id"),
        "sections": _sections_summary(story.get("sections")),
        "published_at": _epoch_ms_to_iso(story.get("published-at")),
        "last_published_at": _epoch_ms_to_iso(story.get("last-published-at")),
        "story_template": story.get("story-template"),
        "read_time": story.get("read-time"),
        "word_count": story.get("word-count"),
    }


def trim_story_full(story: dict[str, Any]) -> dict[str, Any]:
    """Full story shape with rendered markdown body."""
    base = trim_story_summary(story)
    base.update(
        {
            "tags": _tags_summary(story.get("tags")),
            "seo": {
                "title": (story.get("seo") or {}).get("meta-title"),
                "description": (story.get("seo") or {}).get("meta-description"),
            },
            "hero_image": _hero_image(story),
            "body_markdown": render_story_body(story),
        }
    )
    return base


def _hero_image(story: dict[str, Any]) -> dict[str, Any] | None:
    key = story.get("hero-image-s3-key")
    if not key:
        return None
    meta = story.get("hero-image-metadata") or {}
    return {
        "url": f"https://images.assettype.com/{key}",
        "caption": story.get("hero-image-caption"),
        "attribution": story.get("hero-image-attribution"),
        "width": meta.get("width"),
        "height": meta.get("height"),
    }


# ---- Authors ---------------------------------------------------------------------

def trim_author(author: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": author.get("id"),
        "name": author.get("name"),
        "slug": author.get("slug"),
        "bio": author.get("bio"),
        "avatar_url": author.get("avatar-url"),
        "twitter_handle": author.get("twitter-handle"),
    }


# ---- Sections --------------------------------------------------------------------

def trim_section(section: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": section.get("id"),
        "name": section.get("name"),
        "slug": section.get("slug"),
        "display_name": section.get("display-name"),
        "parent_id": section.get("parent-id"),
        "url": section.get("section-url"),
        "collection_slug": (section.get("collection") or {}).get("slug"),
    }


# ---- Collections -----------------------------------------------------------------

def trim_collection(collection: dict[str, Any]) -> dict[str, Any]:
    items_out: list[dict[str, Any]] = []
    for item in collection.get("items") or []:
        if item.get("type") == "story" and item.get("story"):
            items_out.append({"type": "story", "story": trim_story_summary(item["story"])})
        elif item.get("type") == "collection":
            nested = item.get("item") or {}
            items_out.append(
                {
                    "type": "collection",
                    "name": nested.get("name"),
                    "slug": nested.get("slug"),
                    "id": nested.get("id"),
                    "summary": nested.get("summary"),
                }
            )
    return {
        "id": collection.get("id"),
        "name": collection.get("name"),
        "slug": collection.get("slug"),
        "summary": collection.get("summary"),
        "template": collection.get("template"),
        "total_count": collection.get("total-count"),
        "items": items_out,
    }
