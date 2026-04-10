#!/usr/bin/env python3
"""
Video scout - analyze videos before downloading.
Fetches metadata, transcripts, and identifies relevant segments.

Note: For YouTube, Deno may be required for metadata extraction.
The transcript API uses a different method and doesn't need Deno.
"""

import os
import sys
import argparse
import json
import re
import shutil
from pathlib import Path

try:
    import yt_dlp
except ImportError:
    print("Installing yt-dlp...")
    os.system(f"{sys.executable} -m pip install yt-dlp -q")
    import yt_dlp

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:
    print("Installing youtube-transcript-api...")
    os.system(f"{sys.executable} -m pip install youtube-transcript-api -q")
    from youtube_transcript_api import YouTubeTranscriptApi


def check_deno():
    """Check if Deno is installed."""
    deno_paths = [
        shutil.which("deno"),
        os.path.expanduser("~/.deno/bin/deno"),
    ]
    for path in deno_paths:
        if path and os.path.exists(path):
            return True
    return False


def extract_video_id(url: str) -> str:
    """Extract YouTube video ID from URL."""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([^&\n?]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def get_video_info(url: str) -> dict:
    """Get video metadata without downloading."""
    
    # Check for Deno if YouTube URL
    if ("youtube.com" in url or "youtu.be" in url) and not check_deno():
        print("Warning: Deno not found. Metadata extraction may fail.")
        print("Install: curl -fsSL https://deno.land/install.sh | sh")
    
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                "title": info.get("title", ""),
                "duration": info.get("duration", 0),
                "duration_string": info.get("duration_string", ""),
                "uploader": info.get("uploader", ""),
                "upload_date": info.get("upload_date", ""),
                "description": info.get("description", "")[:1000],
                "chapters": info.get("chapters", []),
                "view_count": info.get("view_count", 0),
            }
    except Exception as e:
        print(f"Error getting video info: {e}")
        return None


def get_transcript(url: str, languages: list = None) -> list:
    """Get video transcript/captions."""
    video_id = extract_video_id(url)
    if not video_id:
        print("Could not extract video ID")
        return None
    
    if languages is None:
        languages = ['en', 'en-US', 'en-GB']
    
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=languages)
        return transcript
    except Exception as e:
        # Try auto-generated captions
        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            for transcript in transcript_list:
                if transcript.is_generated:
                    return transcript.fetch()
        except:
            pass
        print(f"Could not get transcript: {e}")
        return None


def search_transcript(transcript: list, keywords: list, context_seconds: int = 30) -> list:
    """
    Search transcript for keywords, return matching segments with timestamps.
    
    Returns list of:
    {
        "keyword": "tariff",
        "timestamp": 125.5,
        "timestamp_str": "2:05",
        "text": "...the tariff announcement was...",
        "suggested_start": 110,
        "suggested_end": 155
    }
    """
    if not transcript:
        return []
    
    results = []
    keywords_lower = [k.lower() for k in keywords]
    
    for i, entry in enumerate(transcript):
        text_lower = entry['text'].lower()
        
        for keyword in keywords_lower:
            if keyword in text_lower:
                timestamp = entry['start']
                
                # Build context (surrounding text)
                context_entries = []
                for j in range(max(0, i-3), min(len(transcript), i+4)):
                    context_entries.append(transcript[j]['text'])
                context_text = ' '.join(context_entries)
                
                results.append({
                    "keyword": keyword,
                    "timestamp": timestamp,
                    "timestamp_str": format_timestamp(timestamp),
                    "text": context_text[:300],
                    "suggested_start": format_timestamp(max(0, timestamp - context_seconds)),
                    "suggested_end": format_timestamp(timestamp + context_seconds),
                    "suggested_start_sec": max(0, timestamp - context_seconds),
                    "suggested_end_sec": timestamp + context_seconds,
                })
                break  # One match per entry
    
    return results


def format_timestamp(seconds: float) -> str:
    """Convert seconds to HH:MM:SS format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes}:{secs:02d}"


def scout_video(url: str, keywords: list = None, context_seconds: int = 30) -> dict:
    """
    Full scout: get info, transcript, and search for keywords.
    
    Returns:
    {
        "info": {...},
        "has_transcript": True,
        "matches": [...],
        "chapters": [...],
        "recommended_segments": [...]
    }
    """
    result = {
        "url": url,
        "info": None,
        "has_transcript": False,
        "transcript_preview": None,
        "matches": [],
        "chapters": [],
        "recommended_segments": []
    }
    
    # Get video info
    info = get_video_info(url)
    if info:
        result["info"] = info
        result["chapters"] = info.get("chapters", [])
    
    # Get transcript
    transcript = get_transcript(url)
    if transcript:
        result["has_transcript"] = True
        # Preview: first 500 chars
        preview_text = ' '.join([e['text'] for e in transcript[:20]])
        result["transcript_preview"] = preview_text[:500]
        
        # Search if keywords provided
        if keywords:
            matches = search_transcript(transcript, keywords, context_seconds)
            result["matches"] = matches
            
            # Build recommended segments (deduplicated)
            seen_starts = set()
            for match in matches:
                start = int(match["suggested_start_sec"] // 30) * 30  # Round to 30s
                if start not in seen_starts:
                    seen_starts.add(start)
                    result["recommended_segments"].append({
                        "start": format_timestamp(start),
                        "end": format_timestamp(start + 60),
                        "reason": f"Contains '{match['keyword']}'"
                    })
    
    return result


def print_scout_report(report: dict):
    """Print human-readable scout report with tables for user selection."""
    print("\n" + "="*60)
    print("VIDEO SCOUT REPORT")
    print("="*60)
    
    if report["info"]:
        info = report["info"]
        print(f"\n**Title:** {info['title']}")
        print(f"**Duration:** {info['duration_string']} ({info['duration']} seconds)")
        print(f"**Channel:** {info['uploader']}")
    
    print(f"\n**Transcript available:** {'Yes' if report['has_transcript'] else 'No'}")
    
    if report["chapters"]:
        print(f"\n### Chapters ({len(report['chapters'])})")
        print("| # | Timestamp | Title |")
        print("|---|-----------|-------|")
        for i, ch in enumerate(report["chapters"][:10], 1):
            title = ch['title'][:40] if len(ch['title']) <= 40 else ch['title'][:37] + "..."
            print(f"| {i} | {format_timestamp(ch['start_time'])} | {title} |")
    
    if report["matches"]:
        print(f"\n### Keyword Matches ({len(report['matches'])})")
        print("| # | Timestamp | Context | Suggested Clip |")
        print("|---|-----------|---------|----------------|")
        for i, match in enumerate(report["matches"][:10], 1):
            context = match['text'][:25].replace('\n', ' ') + "..."
            suggested = f"{match['suggested_start']} - {match['suggested_end']}"
            print(f"| {i} | {match['timestamp_str']} | \"{context}\" | {suggested} |")
        
        print("\n---")
        print("Which segments should I download? (e.g., '1, 3' or 'all' or 'none')")
    
    if not report["matches"] and not report["chapters"]:
        print("\n⚠️ No keyword matches found and no chapters available.")
        print("Options: Download full video, or skip this one.")
    
    print("\n" + "="*60)


def main():
    parser = argparse.ArgumentParser(description="Scout video before downloading")
    parser.add_argument("--url", required=True, help="Video URL")
    parser.add_argument("--keywords", nargs="+", help="Keywords to search in transcript")
    parser.add_argument("--context", type=int, default=30, help="Seconds of context around matches")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    
    args = parser.parse_args()
    
    report = scout_video(
        url=args.url,
        keywords=args.keywords,
        context_seconds=args.context
    )
    
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print_scout_report(report)


if __name__ == "__main__":
    main()
