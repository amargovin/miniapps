#!/usr/bin/env python3
"""
Search and download free media from Wikimedia Commons and Pexels.
Returns vertical-friendly images/videos.
"""

import os
import sys
import argparse
import json
import urllib.parse
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system(f"{sys.executable} -m pip install requests -q")
    import requests


def search_wikimedia(query: str, count: int = 5) -> list:
    """Search Wikimedia Commons for images."""
    
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrnamespace": 6,  # File namespace
        "gsrsearch": f"filetype:bitmap {query}",
        "gsrlimit": count,
        "prop": "imageinfo",
        "iiprop": "url|size|mime",
        "iiurlwidth": 1080
    }
    
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    
    try:
        response = requests.get(url, timeout=30)
        data = response.json()
        
        results = []
        pages = data.get("query", {}).get("pages", {})
        
        for page in pages.values():
            imageinfo = page.get("imageinfo", [{}])[0]
            if imageinfo:
                results.append({
                    "source": "wikimedia",
                    "title": page.get("title", ""),
                    "url": imageinfo.get("thumburl") or imageinfo.get("url"),
                    "width": imageinfo.get("thumbwidth") or imageinfo.get("width"),
                    "height": imageinfo.get("thumbheight") or imageinfo.get("height"),
                    "mime": imageinfo.get("mime")
                })
        
        return results
    except Exception as e:
        print(f"Wikimedia search error: {e}")
        return []


def search_pexels(query: str, count: int = 5) -> list:
    """Search Pexels for images (requires API key)."""
    
    api_key = os.environ.get("PEXELS_API_KEY")
    if not api_key:
        print("PEXELS_API_KEY not set, skipping Pexels search")
        return []
    
    headers = {"Authorization": api_key}
    params = {
        "query": query,
        "per_page": count,
        "orientation": "portrait"  # Prefer vertical
    }
    
    url = "https://api.pexels.com/v1/search?" + urllib.parse.urlencode(params)
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        data = response.json()
        
        results = []
        for photo in data.get("photos", []):
            results.append({
                "source": "pexels",
                "title": photo.get("alt", ""),
                "url": photo.get("src", {}).get("large2x"),
                "width": photo.get("width"),
                "height": photo.get("height"),
                "photographer": photo.get("photographer")
            })
        
        return results
    except Exception as e:
        print(f"Pexels search error: {e}")
        return []


def download_asset(url: str, output_path: str) -> str:
    """Download asset to local path."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        response = requests.get(url, timeout=60, stream=True)
        response.raise_for_status()
        
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print(f"Downloaded: {output_path}")
        return str(output_path)
    except Exception as e:
        print(f"Download error: {e}")
        return None


def search_and_download(
    query: str,
    output_dir: str,
    count: int = 5,
    sources: list = None
):
    """Search both sources and download results."""
    
    if sources is None:
        sources = ["wikimedia", "pexels"]
    
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    all_results = []
    
    if "wikimedia" in sources:
        all_results.extend(search_wikimedia(query, count))
    
    if "pexels" in sources:
        all_results.extend(search_pexels(query, count))
    
    downloaded = []
    for i, result in enumerate(all_results[:count]):
        if result.get("url"):
            ext = ".jpg"
            if result.get("mime") == "image/png":
                ext = ".png"
            
            filename = f"{result['source']}_{i+1:02d}{ext}"
            output_path = output_dir / filename
            
            path = download_asset(result["url"], str(output_path))
            if path:
                downloaded.append({
                    "path": path,
                    "source": result["source"],
                    "title": result.get("title", ""),
                    "original_url": result["url"]
                })
    
    # Save metadata
    metadata_path = output_dir / "asset_metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(downloaded, f, indent=2)
    
    return downloaded


def main():
    parser = argparse.ArgumentParser(description="Search and download free media assets")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument("--output", required=True, help="Output directory")
    parser.add_argument("--count", type=int, default=5, help="Number of results to download")
    parser.add_argument("--sources", nargs="+", default=["wikimedia", "pexels"],
                        help="Sources to search (wikimedia, pexels)")
    
    args = parser.parse_args()
    
    results = search_and_download(
        query=args.query,
        output_dir=args.output,
        count=args.count,
        sources=args.sources
    )
    
    print(f"\nDownloaded {len(results)} assets to {args.output}")


if __name__ == "__main__":
    main()
