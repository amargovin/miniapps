# Voiceover Generation — ElevenLabs

Generates per-scene MP3s with word-level timestamps for audio-sync
phase timing. Split scripts by scene before generating — 5000 char
max per API call.

## Credentials

| Parameter | Value |
|---|---|
| Voice ID | `mCQMfsqGDT6IDkEKR20a` |
| Model ID | `eleven_v3` (was `eleven_multilingual_v3` — updated) |
| Output format | `mp3_44100_128` |

> Provider note: this voice is ElevenLabs-only. OpenRouter's TTS cannot serve
> it (different voices, no alignment), so keep `ELEVENLABS_API_KEY` for the
> branded voice. See `skills/guidance/providers.md`.

## Working Pattern

```python
from elevenlabs import ElevenLabs
import os, base64, json

client = ElevenLabs(api_key=os.environ['ELEVENLABS_API_KEY'])

result = client.text_to_speech.convert_with_timestamps(
    voice_id='mCQMfsqGDT6IDkEKR20a',
    text=text,
    model_id='eleven_v3',
    output_format='mp3_44100_128',
)

audio_bytes = b''
alignment = None

# v3 API returns tuples: (key, value) — NOT objects with attributes
for chunk in result:
    if isinstance(chunk, tuple) and len(chunk) == 2:
        key, value = chunk
        if key == 'audio_base_64' and value:          # underscores, not camelCase
            audio_bytes = base64.b64decode(value)
        elif key == 'alignment' and value:
            alignment = value

# Save audio
with open(output_path, 'wb') as f:
    f.write(audio_bytes)

# Parse word-level timestamps from character-level alignment
chars = alignment.characters
starts = alignment.character_start_times_seconds
ends = alignment.character_end_times_seconds

words = []
current_word = ''
word_start = None
for i, c in enumerate(chars):
    if c in ' \n\t':
        if current_word.strip():
            words.append({
                'word': current_word.strip(),
                'startMs': round(word_start * 1000),
                'endMs': round(ends[i] * 1000)
            })
        current_word = ''
        word_start = None
    else:
        if word_start is None:
            word_start = starts[i]
        current_word += c
```

## Key Facts

- **5000 char limit per call.** Split long scripts into per-scene chunks before calling.
- **Response is tuples `(key, value)`.** Not objects. Iterate and match by key string.
- **Audio key is `audio_base_64`** — underscores, not `audio_base64`.
- **Alignment is character-level.** Aggregate to words at whitespace boundaries (see loop above).
- **Text normalization:** pass `apply_text_normalization="on"` for natural pacing on numbers and abbreviations.
- **Reference implementation:** `~/.claude/skills/varnam/scripts/voiceover.py` — full script, but uses the old model name `eleven_multilingual_v3`. Use `eleven_v3` instead.

## Trailing Silence Buffer (MANDATORY — LEARNINGS §42)

ElevenLabs audio ends on the final word, which makes scenes cut abruptly.
Immediately after generating each scene MP3, append ~1.1s of trailing
silence using the ffmpeg `apad` tail-pad command in
`pre-production.md` → Step 2 (the canonical §42 rule, with the full
rationale and the retrofit procedure for already-built scenes).

Do this BEFORE Whisper transcription and duration measurement so frame counts
include the buffer. Tail-only — never prepend silence (it shifts every
Whisper timestamp).

## Output

Feed the resulting `words` list (with `startMs` / `endMs`) into the
audio-sync phase timing step. See SKILL.md → Audio-Sync Phase Timing
for how to map word timestamps onto phase `durationInFrames`.
