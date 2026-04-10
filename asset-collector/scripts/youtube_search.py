#!/usr/bin/env python3
"""
YouTube search using yt-dlp's built-in search.
No API key needed. No web search needed.
"""

import os
import sys
import argparse
import json

try:
    import yt_dlp
except ImportError:
    print("Installing yt-dlp...")
    os.system(f"{sys.executable} -m pip install yt-dlp -q")
    import yt_dlp


def search_youtube(query: str, max_results: int = 5) -> list:
    """
    Search YouTube directly using yt-dlp.
    
    Returns list of {title, url, duration, channel} dicts.
    """
    search_query = f"ytsearch{max_results}:{query}"
    
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,  # Don't download, just get info
    }
    
    results = []
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(search_query, download=False)
            
            if "entries" in info:
                for entry in info["entries"]:
                    if entry:
                        results.append({
                            "title": entry.get("title", "Unknown"),
                            "url": f"https://www.youtube.com/watch?v={entry.get('id', '')}",
                            "id": entry.get("id", ""),
                            "duration": entry.get("duration"),
                            "channel": entry.get("channel") or entry.get("uploader", "Unknown"),
                        })
    except Exception as e:
        print(f"Search error: {e}", file=sys.stderr)
    
    return results


def format_duration(seconds):
    """Convert seconds to MM:SS or HH:MM:SS."""
    if not seconds:
        return "?"
    
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def main():
    parser = argparse.ArgumentParser(
        description="Search YouTube directly (no web search needed)"
    )
    parser.add_argument("query", nargs="+", help="Search query")
    parser.add_argument("-n", "--num", type=int, default=10, help="Number of results (default: 10)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--table", action="store_true", help="Output as markdown table (default)")
    
    args = parser.parse_args()
    query = " ".join(args.query)
    
    print(f"Searching YouTube for: {query}\n", file=sys.stderr)
    
    results = search_youtube(query, args.num)
    
    if not results:
        print("No results found.", file=sys.stderr)
        return
    
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        # Default: markdown table format for easy user selection
        print(f"Found {len(results)} videos:\n")
        print("| # | Duration | Channel | Title |")
        print("|---|----------|---------|-------|")
        for i, r in enumerate(results, 1):
            duration = format_duration(r.get("duration"))
            title = r['title'][:50] + "..." if len(r['title']) > 50 else r['title']
            channel = r['channel'][:20] + "..." if len(r['channel']) > 20 else r['channel']
            print(f"| {i} | {duration} | {channel} | {title} |")
        
        print("\n**URLs:**")
        for i, r in enumerate(results, 1):
            print(f"{i}. {r['url']}")
        
        print("\n---")
        print("Which videos should I download? (e.g., '1, 3, 5' or 'all' or 'none')")


if __name__ == "__main__":
    main()
