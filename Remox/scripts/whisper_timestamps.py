#!/usr/bin/env python3
"""
Generate word-level timestamps for Remox scene audio using OpenAI Whisper API.

Usage:
  # Single scene
  python3 whisper_timestamps.py --audio audio/scene_01.mp3 --output audio/scene_01_whisper.json

  # All scenes in a project directory
  python3 whisper_timestamps.py --project-dir /path/to/project --all

  # Specific scene number
  python3 whisper_timestamps.py --project-dir /path/to/project --scene 1

Requires: OPENAI_API_KEY environment variable
Output: JSON with word-level startMs/endMs timestamps from actual audio analysis.

These timestamps are the AUTHORITATIVE source for phase timing in Remox.
ElevenLabs TTS alignment data has collapsed values and must NOT be used.
"""
import os
import sys
import json
import argparse
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("Installing openai...")
    os.system(f"{sys.executable} -m pip install openai -q")
    from openai import OpenAI


def transcribe_scene(audio_path: str, output_path: str, language: str = "en") -> dict:
    """Transcribe a single audio file using OpenAI Whisper API."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")

    client = OpenAI(api_key=api_key)

    with open(audio_path, "rb") as f:
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="verbose_json",
            timestamp_granularities=["word"],
            language=language,
        )

    words = []
    for w in result.words:
        words.append({
            "word": w.word.strip(),
            "startMs": round(w.start * 1000),
            "endMs": round(w.end * 1000),
        })

    data = {
        "totalWords": len(words),
        "audioDurationMs": round(result.duration * 1000),
        "words": words,
        "source": "openai-whisper-api",
    }

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w") as f:
        json.dump(data, f, indent=2)

    return data


def main():
    parser = argparse.ArgumentParser(description="Generate Whisper timestamps for Remox scenes")
    parser.add_argument("--audio", help="Path to a single MP3 file")
    parser.add_argument("--output", help="Output JSON path (for single file mode)")
    parser.add_argument("--project-dir", help="Project directory containing audio/ folder")
    parser.add_argument("--scene", type=int, help="Scene number to transcribe")
    parser.add_argument("--all", action="store_true", help="Transcribe all scenes in project")
    parser.add_argument("--language", default="en", help="Language code (default: en)")
    parser.add_argument("--force", action="store_true", help="Overwrite existing whisper files")
    args = parser.parse_args()

    if args.audio and args.output:
        # Single file mode
        data = transcribe_scene(args.audio, args.output, args.language)
        print(f"Done: {data['totalWords']} words, {data['audioDurationMs']}ms → {args.output}")
        return

    if not args.project_dir:
        parser.error("Either --audio/--output or --project-dir is required")

    audio_dir = Path(args.project_dir) / "audio"
    if not audio_dir.exists():
        parser.error(f"Audio directory not found: {audio_dir}")

    # Find all scene audio files
    scene_files = sorted(audio_dir.glob("scene_*.mp3"))
    if not scene_files:
        parser.error(f"No scene_*.mp3 files found in {audio_dir}")

    if args.scene:
        scene_files = [f for f in scene_files if f.name == f"scene_{args.scene:02d}.mp3"]
        if not scene_files:
            parser.error(f"Scene {args.scene:02d} not found")

    for mp3 in scene_files:
        out = mp3.with_name(mp3.stem + "_whisper.json")

        if out.exists() and not args.force:
            print(f"  {mp3.name}: already exists, skipping (use --force to overwrite)")
            continue

        print(f"  {mp3.name}: transcribing...", end=" ", flush=True)
        data = transcribe_scene(str(mp3), str(out), args.language)
        print(f"{data['totalWords']} words, {data['audioDurationMs']}ms")

    print("Done.")


if __name__ == "__main__":
    main()
