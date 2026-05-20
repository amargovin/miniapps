"""Homepage screenshot + Claude vision fetcher.

For each configured `homepage` source we:
  1. Load the page in headless Chromium at a fixed viewport.
  2. Crop the top `crop_height` pixels to a screenshot.
  3. Extract all `<a>` elements in that region (text, href, position, font-size).
  4. Send screenshot + candidate-anchor list to Claude vision.
  5. Claude returns the indices of anchors that are actual news headlines
     (skipping nav, ads, sections, login buttons, etc.).

Why screenshot AND DOM? The image gives Claude the visual hierarchy (which
headlines are big / above the fold). The DOM gives us the actual URLs and
clean text strings — vision OCR alone isn't reliable enough.

Fails gracefully:
  - If chromium isn't installed → log warning, return [].
  - If ANTHROPIC_API_KEY isn't set → log info, return [].
  - If Claude parse fails → log warning, return [].
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from datetime import datetime, timezone

from app import config
from app.fetchers.base import BaseFetcher, FetchedItem, canonicalize_url
from app.sources import Source

log = logging.getLogger(__name__)

VIEWPORT_WIDTH = 1280
NAV_SAFE_AREA_BUFFER = 200  # extra page height beyond crop so layout settles
MIN_HEADLINE_CHARS = 20
MAX_ITEMS_PER_SOURCE = 8
PAGE_LOAD_TIMEOUT_MS = 25000
POST_LOAD_SETTLE_MS = 3000

# Real desktop Chrome UA — some sites (Indian Express, NDTV) block our
# bot-y `news-suggestor/0.1` UA in their homepage path.
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)


ANCHOR_SCRAPE_JS = """
({y_top, y_bottom}) => {
    const out = [];
    document.querySelectorAll('a').forEach(a => {
        const rect = a.getBoundingClientRect();
        const text = (a.innerText || '').trim();
        if (rect.top >= y_top && rect.top < y_bottom && text.length >= %d && a.href) {
            out.push({
                text: text.slice(0, 240),
                href: a.href,
                top: Math.round(rect.top),
                fontSize: parseFloat(getComputedStyle(a).fontSize) || 0,
            });
        }
    });
    return out;
}
""" % MIN_HEADLINE_CHARS


def _classify_prominence(anchor: dict, y_offset: int) -> str:
    """Tier a homepage anchor by its on-page layout.

    Newsroom front pages put the lead story big and high; lesser items get
    smaller fonts and lower positions. We map (relative-top, font-size) to
    three coarse buckets the editor / AI editor can read.
    """
    # Position relative to the start of the crop (0 = top of editorial area)
    top = max(0, int(anchor.get("top", 0)) - y_offset)
    font = float(anchor.get("fontSize", 0))
    if top < 500 and font >= 22:
        return "hero"
    if top < 900 and font >= 16:
        return "secondary"
    return "tertiary"


class HomepageFetcher(BaseFetcher):
    """Long-lived browser; one context per fetch."""

    def __init__(self):
        self._playwright = None
        self._browser = None

    async def __aenter__(self) -> "HomepageFetcher":
        try:
            from playwright.async_api import async_playwright
            from playwright_stealth import Stealth

            # Stealth patches headless-Chrome fingerprint signals (webdriver
            # flag, plugins, canvas, etc) so sites like Business Standard
            # that block bare headless Chrome will serve real content.
            self._stealth_cm = Stealth().use_async(async_playwright())
            self._playwright = await self._stealth_cm.__aenter__()
            self._browser = await self._playwright.chromium.launch(headless=True)
        except Exception as e:
            log.warning("homepage fetcher: chromium unavailable, will skip homepage sources: %s", e)
            self._stealth_cm = None
            self._playwright = None
            self._browser = None
        return self

    async def __aexit__(self, *args) -> None:
        if self._browser is not None:
            try:
                await self._browser.close()
            except Exception:
                pass
        if getattr(self, "_stealth_cm", None) is not None:
            try:
                await self._stealth_cm.__aexit__(*args)
            except Exception:
                pass

    async def fetch(self, source: Source) -> list[FetchedItem]:
        if self._browser is None:
            log.warning("homepage %s: chromium not started, skipping", source.id)
            return []
        if not os.environ.get("ANTHROPIC_API_KEY"):
            log.info("homepage %s: ANTHROPIC_API_KEY unset, skipping", source.id)
            return []

        crop_h = source.crop_height
        y_offset = source.crop_y_offset
        viewport_h = y_offset + crop_h + NAV_SAFE_AREA_BUFFER
        context = await self._browser.new_context(
            viewport={"width": VIEWPORT_WIDTH, "height": viewport_h},
            user_agent=BROWSER_USER_AGENT,
            extra_http_headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        page = await context.new_page()
        try:
            resp = await page.goto(source.url, wait_until="load", timeout=PAGE_LOAD_TIMEOUT_MS)
            await page.wait_for_timeout(POST_LOAD_SETTLE_MS)
            status = resp.status if resp else None
            screenshot_bytes = await page.screenshot(
                clip={"x": 0, "y": y_offset, "width": VIEWPORT_WIDTH, "height": crop_h},
                full_page=False,
            )
            anchors = await page.evaluate(
                ANCHOR_SCRAPE_JS,
                {"y_top": y_offset, "y_bottom": y_offset + crop_h},
            )
            body_chars = await page.evaluate("() => document.body.innerText.length")
        except Exception as e:
            log.warning("homepage %s: page load / screenshot failed: %s", source.id, e)
            return []
        finally:
            await context.close()

        if not anchors:
            log.warning(
                "homepage %s: no anchors in y=%d..%d (status=%s, body_chars=%s)",
                source.id, y_offset, y_offset + crop_h, status, body_chars,
            )
            return []

        candidates = self._dedupe_anchors(anchors)
        # Map text -> anchor record so we can recover prominence after Claude picks.
        by_text = {a["text"]: a for a in candidates}

        top_stories = await self._pick_top_stories(screenshot_bytes, candidates, source)
        if not top_stories:
            return []

        now = datetime.now(timezone.utc)
        items: list[FetchedItem] = []
        for headline, href in top_stories:
            anchor = by_text.get(headline)
            tier = _classify_prominence(anchor, y_offset) if anchor else None
            items.append(FetchedItem(
                source_id=source.id,
                url=href,
                canonical_url=canonicalize_url(href),
                title=headline,
                body=None,
                author=None,
                published_at=now,
                fetched_at=now,
                homepage_tier=tier,
            ))
        return items

    @staticmethod
    def _dedupe_anchors(anchors: list[dict]) -> list[dict]:
        """Remove exact-text duplicates and cap to a manageable count."""
        seen: set[str] = set()
        out: list[dict] = []
        anchors_sorted = sorted(anchors, key=lambda a: (a.get("top", 0), -a.get("fontSize", 0)))
        for a in anchors_sorted:
            text = a.get("text", "").strip()
            if not text or text in seen:
                continue
            seen.add(text)
            out.append(a)
        return out[:50]

    async def _pick_top_stories(self, screenshot: bytes, anchors: list[dict], source: Source) -> list[tuple[str, str]]:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic()
        b64 = base64.b64encode(screenshot).decode("ascii")
        anchor_list = "\n".join(
            f"  [{i}] \"{a['text']}\" -> {a['href']}"
            for i, a in enumerate(anchors)
        )
        prompt = (
            f"You are looking at the top of {source.name}'s homepage (about the top "
            f"{source.crop_height} pixels — the hero / lead-story region).\n\n"
            "I extracted every clickable link from this region. Some are real news "
            "headlines; many are nav, section links, login buttons, ads, or footers. "
            "Identify which are actual NEWS HEADLINES that the newsroom has chosen to "
            "feature here — the lead story and any prominent secondary stories.\n\n"
            f"Return STRICT JSON: a list of integer indices into the candidates "
            f"below, in the order they appear visually (lead first). Pick AT MOST "
            f"{MAX_ITEMS_PER_SOURCE}. Skip duplicates / re-frames of the same story.\n\n"
            f"Candidates:\n{anchor_list}\n\n"
            "Return JSON only, no preamble. Example: [3, 7, 12]"
        )
        try:
            resp = await client.messages.create(
                model=config.CLAUDE_MODEL,
                max_tokens=200,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": "image/png", "data": b64},
                        },
                        {"type": "text", "text": prompt},
                    ],
                }],
            )
            text = resp.content[0].text.strip()
        except Exception as e:
            log.warning("homepage %s: claude vision call failed: %s", source.id, e)
            return []

        if text.startswith("```"):
            text = text.strip("`")
            first_nl = text.find("\n")
            if first_nl != -1:
                text = text[first_nl + 1:]
            text = text.rstrip("`").strip()
        try:
            indices = json.loads(text)
        except json.JSONDecodeError:
            log.warning("homepage %s: claude returned non-JSON: %s", source.id, text[:200])
            return []
        if not isinstance(indices, list):
            return []
        results: list[tuple[str, str]] = []
        for idx in indices:
            if isinstance(idx, int) and 0 <= idx < len(anchors):
                a = anchors[idx]
                results.append((a["text"], a["href"]))
        return results
