#!/usr/bin/env python3
"""Generate ASS subtitles from Whisper word-level JSON.
Style: solid black background, full white text, word-level sync."""

import json
import sys

WHISPER_JSON = sys.argv[1] if len(sys.argv) > 1 else "whisper.json"
OUTPUT_ASS = sys.argv[2] if len(sys.argv) > 2 else "subs.ass"

# ASS BGR format colors
WHITE = "&H00FFFFFF"
GOLD = "&H00FFFFFF"  # all white, no highlight color
BLACK = "&H00000000"

# Subtitle config
FONT = "Helvetica"
FONT_SIZE = 58
MARGIN_V = 420
MAX_WORDS_PER_LINE = 7
PAUSE_THRESHOLD = 0.4  # seconds — break line on pauses longer than this

def fmt_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:05.2f}"

def generate_ass(words):
    header = f"""[Script Info]
Title: Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{FONT},{FONT_SIZE},{WHITE},{GOLD},{BLACK},{BLACK},-1,0,0,0,100,100,0,0,3,15,0,2,40,40,{MARGIN_V},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    # BorderStyle=3 means opaque box (solid black background behind text)
    # CRITICAL: Outline=0 makes the black box invisible — always use Outline >= 12
    # Outline=15 gives comfortable padding around the text

    # Group words into lines
    lines = []
    current_line = []

    for i, w in enumerate(words):
        current_line.append(w)

        # Break conditions
        at_max = len(current_line) >= MAX_WORDS_PER_LINE
        has_pause = (i + 1 < len(words) and
                     words[i + 1]['start'] - w['end'] > PAUSE_THRESHOLD)
        is_last = i == len(words) - 1

        if at_max or has_pause or is_last:
            lines.append(current_line)
            current_line = []

    # Generate dialogue events with word-level karaoke
    events = []
    for line_words in lines:
        line_start = line_words[0]['start']
        line_end = line_words[-1]['end'] + 0.1  # small buffer

        # Build karaoke tags with proper spacing
        parts = []
        for j, w in enumerate(line_words):
            word_dur_cs = int((w['end'] - w['start']) * 100)
            if word_dur_cs < 1:
                word_dur_cs = 1

            # Pre-gap between words
            if j > 0:
                gap = max(0, w['start'] - line_words[j - 1]['end'])
                gap_cs = int(gap * 100)
                if gap_cs > 0:
                    parts.append(f"{{\\kf{gap_cs}}} ")
                else:
                    parts.append(" ")

            parts.append(f"{{\\kf{word_dur_cs}}}{w['word']}")

        text = "".join(parts)

        start_str = fmt_time(line_start)
        end_str = fmt_time(line_end)
        events.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{text}")

    return header + "\n".join(events) + "\n"


with open(WHISPER_JSON) as f:
    data = json.load(f)

words = data['words']
ass_content = generate_ass(words)

with open(OUTPUT_ASS, 'w') as f:
    f.write(ass_content)

print(f"Generated {OUTPUT_ASS} with {len(words)} words")
