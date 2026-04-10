#!/usr/bin/env python3
"""
Web screenshot capture using Playwright.
Captures tweets, news articles, websites in vertical-friendly format.
"""

import os
import sys
import argparse
import asyncio
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Installing playwright...")
    os.system(f"{sys.executable} -m pip install playwright -q")
    os.system(f"{sys.executable} -m playwright install chromium")
    from playwright.async_api import async_playwright


async def capture_screenshot(
    url: str,
    output_path: str,
    width: int = 1080,
    height: int = 1920,
    full_page: bool = False,
    selector: str = None,
    wait_for: str = None,
    delay: int = 2000
):
    """Capture screenshot of URL or specific element."""
    
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        
        context = await browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=2  # Retina quality
        )
        
        page = await context.new_page()
        
        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            
            # Additional wait for dynamic content
            if wait_for:
                await page.wait_for_selector(wait_for, timeout=10000)
            else:
                await page.wait_for_timeout(delay)
            
            # Capture specific element or full viewport
            if selector:
                element = await page.query_selector(selector)
                if element:
                    await element.screenshot(path=str(output_path))
                else:
                    print(f"Selector not found: {selector}, capturing viewport")
                    await page.screenshot(path=str(output_path), full_page=full_page)
            else:
                await page.screenshot(path=str(output_path), full_page=full_page)
            
            print(f"Screenshot saved: {output_path}")
            
        finally:
            await browser.close()
    
    return str(output_path)


async def capture_tweet(url: str, output_path: str):
    """Optimized capture for Twitter/X posts."""
    
    # Twitter-specific settings
    return await capture_screenshot(
        url=url,
        output_path=output_path,
        width=600,
        height=800,
        selector='article[data-testid="tweet"]',
        wait_for='article[data-testid="tweet"]',
        delay=3000
    )


async def capture_news_headline(url: str, output_path: str):
    """Capture news article headline area."""
    
    return await capture_screenshot(
        url=url,
        output_path=output_path,
        width=1080,
        height=1200,
        full_page=False,
        delay=2000
    )


def screenshot(url: str, output_path: str, **kwargs):
    """Synchronous wrapper for screenshot capture."""
    return asyncio.run(capture_screenshot(url, output_path, **kwargs))


def tweet(url: str, output_path: str):
    """Synchronous wrapper for tweet capture."""
    return asyncio.run(capture_tweet(url, output_path))


def headline(url: str, output_path: str):
    """Synchronous wrapper for headline capture."""
    return asyncio.run(capture_news_headline(url, output_path))


def main():
    parser = argparse.ArgumentParser(description="Capture web screenshots")
    parser.add_argument("--url", required=True, help="URL to capture")
    parser.add_argument("--output", required=True, help="Output image path")
    parser.add_argument("--type", choices=["page", "tweet", "headline"], default="page",
                        help="Type of capture")
    parser.add_argument("--width", type=int, default=1080, help="Viewport width")
    parser.add_argument("--height", type=int, default=1920, help="Viewport height")
    parser.add_argument("--selector", help="CSS selector to capture specific element")
    parser.add_argument("--full-page", action="store_true", help="Capture full scrollable page")
    parser.add_argument("--delay", type=int, default=2000, help="Wait time in ms after page load")
    
    args = parser.parse_args()
    
    if args.type == "tweet":
        asyncio.run(capture_tweet(args.url, args.output))
    elif args.type == "headline":
        asyncio.run(capture_news_headline(args.url, args.output))
    else:
        asyncio.run(capture_screenshot(
            url=args.url,
            output_path=args.output,
            width=args.width,
            height=args.height,
            selector=args.selector,
            full_page=args.full_page,
            delay=args.delay
        ))


if __name__ == "__main__":
    main()
