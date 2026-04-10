#!/usr/bin/env python3
"""
Video clip downloader using yt-dlp.
Downloads clips from YouTube, Twitter, government sites, etc.
Use video_scout.py first to find relevant timestamps in long videos.

REQUIREMENT: Deno must be installed for YouTube downloads.
Install: curl -fsSL https://deno.land/install.sh | sh
"""

import os
import sys
import argparse
import subprocess
import json
import shutil
from pathlib import Path

try:
    import yt_dlp
except ImportError:
    print("Installing yt-dlp...")
    os.system(f"{sys.executable} -m pip install yt-dlp -q")
    import yt_dlp


def check_deno():
    """Check if Deno is installed (required for YouTube)."""
    # Check common paths
    deno_paths = [
        shutil.which("deno"),
        os.path.expanduser("~/.deno/bin/deno"),
        "/usr/local/bin/deno",
    ]
    
    for path in deno_paths:
        if path and os.path.exists(path):
            return True
    
    return False


def ensure_deno():
    """Ensure Deno is available, install if needed."""
    if check_deno():
        return True
    
    print("Deno not found. Installing (required for YouTube downloads)...")
    try:
        # Install deno
        result = subprocess.run(
            'curl -fsSL https://deno.land/install.sh | sh',
            shell=True,
            capture_output=True,
            text=True
        )
        
        # Add to PATH for this session
        deno_bin = os.path.expanduser("~/.deno/bin")
        if deno_bin not in os.environ.get("PATH", ""):
            os.environ["PATH"] = f"{deno_bin}:{os.environ.get('PATH', '')}"
        
        if check_deno():
            print("Deno installed successfully.")
            return True
        else:
            print("Deno installation may have failed. Try manually:")
            print("  curl -fsSL https://deno.land/install.sh | sh")
            print("  export PATH=\"$HOME/.deno/bin:$PATH\"")
            return False
            
    except Exception as e:
        print(f"Failed to install Deno: {e}")
        return False


def get_video_info(url: str) -> dict:
    """Get video metadata without downloading."""
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
                "description": info.get("description", "")[:500],
                "chapters": info.get("chapters", []),
            }
    except Exception as e:
        print(f"Info extraction error: {e}")
        return None


def download_clip(
    url: str,
    output_path: str,
    start_time: str = None,
    end_time: str = None,
    quality: str = None  # Changed: None means auto-select best
):
    """
    Download video clip with optional time range.
    
    When start/end are specified, downloads only that segment (much faster for long videos).
    """
    # Check for Deno if this is a YouTube URL
    if "youtube.com" in url or "youtu.be" in url:
        if not ensure_deno():
            print("ERROR: Deno is required for YouTube downloads.")
            return None
    
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    output_template = str(output_path.with_suffix(''))
    
    # More robust format selection
    # Don't filter by height for Shorts (they may only have one format)
    format_spec = quality if quality else "best"
    
    ydl_opts = {
        "format": format_spec,
        "outtmpl": output_template + ".%(ext)s",
        "quiet": False,  # Show progress for debugging
        "no_warnings": False,
        "extract_flat": False,
        "ignoreerrors": False,
    }
    
    # Add time range using yt-dlp's download_ranges (efficient - downloads only segment)
    if start_time or end_time:
        def time_to_seconds(t):
            if not t:
                return None
            parts = t.split(':')
            if len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
            elif len(parts) == 2:
                return int(parts[0]) * 60 + float(parts[1])
            return float(t)
        
        start_sec = time_to_seconds(start_time) or 0
        end_sec = time_to_seconds(end_time)
        
        if end_sec:
            # Use download_ranges for efficient segment download
            ydl_opts["download_ranges"] = lambda info, ydl: [(start_sec, end_sec)]
        
        # Fallback: post-processor args
        postprocessor_args = []
        if start_time:
            postprocessor_args.extend(["-ss", start_time])
        if end_time:
            postprocessor_args.extend(["-to", end_time])
        
        if postprocessor_args:
            ydl_opts["postprocessor_args"] = {"ffmpeg": postprocessor_args}
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            downloaded_file = None
            for ext in ['.mp4', '.webm', '.mkv', '.mp4.part']:
                candidate = Path(output_template + ext)
                if candidate.exists() and candidate.stat().st_size > 0:
                    downloaded_file = candidate
                    break
            
            # Also check with video ID in filename (yt-dlp sometimes adds it)
            if not downloaded_file:
                import glob
                matches = glob.glob(f"{output_template}*")
                for m in matches:
                    p = Path(m)
                    if p.suffix in ['.mp4', '.webm', '.mkv'] and p.stat().st_size > 0:
                        downloaded_file = p
                        break
            
            if downloaded_file and downloaded_file.stat().st_size > 0:
                final_path = output_path.with_suffix(downloaded_file.suffix)
                if downloaded_file != final_path:
                    downloaded_file.rename(final_path)
                
                print(f"Downloaded: {final_path}")
                
                return {
                    "path": str(final_path),
                    "title": info.get("title", ""),
                    "duration": info.get("duration", 0),
                    "source": url
                }
            else:
                raise FileNotFoundError("Download completed but file not found")
                
    except Exception as e:
        print(f"Download error: {e}")
        return None


def extract_frame(
    video_path: str,
    output_path: str,
    timestamp: str = "00:00:01"
):
    """Extract a single frame from video as image."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    cmd = [
        "ffmpeg", "-y",
        "-ss", timestamp,
        "-i", video_path,
        "-vframes", "1",
        "-q:v", "2",
        str(output_path)
    ]
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"Frame extracted: {output_path}")
        return str(output_path)
    except subprocess.CalledProcessError as e:
        print(f"Frame extraction error: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(
        description="Download video clips. Use video_scout.py first to find timestamps in long videos."
    )
    parser.add_argument("--url", required=True, help="Video URL")
    parser.add_argument("--output", help="Output path")
    parser.add_argument("--start", help="Start time (HH:MM:SS or MM:SS)")
    parser.add_argument("--end", help="End time (HH:MM:SS or MM:SS)")
    parser.add_argument("--info-only", action="store_true", help="Get metadata without downloading")
    parser.add_argument("--extract-frame", help="Extract frame at timestamp (requires --output)")
    parser.add_argument("--test", action="store_true", help="Test mode: just check if URL is downloadable")
    
    args = parser.parse_args()
    
    if args.test:
        # Test mode: check if video is accessible
        print(f"Testing URL: {args.url}")
        info = get_video_info(args.url)
        if info:
            print(f"✓ Video accessible: {info['title']}")
            print(f"  Duration: {info.get('duration_string', 'unknown')}")
            print(f"  Uploader: {info.get('uploader', 'unknown')}")
        else:
            print("✗ Video not accessible or URL invalid")
        return
    
    if args.info_only:
        info = get_video_info(args.url)
        if info:
            print(json.dumps(info, indent=2))
            if info.get("chapters"):
                print("\nChapters:")
                for ch in info["chapters"]:
                    print(f"  {ch.get('start_time', 0):.0f}s - {ch.get('title', '')}")
    
    elif args.extract_frame:
        if not args.output:
            parser.error("--output required for frame extraction")
        # Download a tiny segment around the frame timestamp
        result = download_clip(
            args.url, 
            args.output,
            start_time=args.extract_frame,
            end_time=None  # Just a few seconds
        )
        if result:
            frame_path = Path(args.output).with_suffix('.png')
            extract_frame(result["path"], str(frame_path), "00:00:00")
    
    else:
        if not args.output:
            parser.error("--output required for download")
        download_clip(
            url=args.url,
            output_path=args.output,
            start_time=args.start,
            end_time=args.end
        )


if __name__ == "__main__":
    main()
