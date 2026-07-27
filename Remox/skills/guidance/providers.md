# Provider Routing via OpenRouter (optional)

Remox's three external AI services — **Whisper transcription**, **ImageGen (Nano
Banana Pro)**, and **TTS voiceover (ElevenLabs)** — can optionally be routed
through **OpenRouter** with a single `OPENROUTER_API_KEY` instead of three
separate provider keys. OpenRouter is OpenAI-SDK compatible: base URL
`https://openrouter.ai/api/v1`, `Authorization: Bearer $OPENROUTER_API_KEY`.
Existing OpenAI-SDK code points at it by changing only `base_url` + `api_key`.

**Status: documented from OpenRouter's official docs; NOT yet smoke-tested from
this repo (no OPENROUTER_API_KEY was present when written). Run one live call
per endpoint before relying on it in production.**

## Capability summary

| Service | Via OpenRouter | Verdict |
|---|---|---|
| Whisper transcription + **word timestamps** | ✅ yes, if provider pinned | **Good substitute** |
| Image gen — Nano Banana Pro | ✅ yes, full (2K/4K, aspect ratio) | **Good substitute** |
| TTS voiceover | ⚠️ speech yes, but **no ElevenLabs voice, no alignment** | **Keep ElevenLabs native** for the branded voice |

---

## 1. Whisper transcription (word timestamps) — GOOD substitute

The skill's phase timing depends on **word-level** timestamps
(`verbose_json` + `timestamp_granularities[]=word`). These work through
OpenRouter **only when the request is routed to an OpenAI-compatible provider**
(OpenAI, Groq, Together). You MUST pin such a model — do not let OpenRouter
auto-route (Google Chirp etc. reject `verbose_json` with HTTP 400).

- Endpoint: `POST https://openrouter.ai/api/v1/audio/transcriptions`
- Pin model: `openai/whisper-1` or `openai/whisper-large-v3` (or `groq/whisper-large-v3`).

```bash
curl https://openrouter.ai/api/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -F file="@scene_01.mp3" \
  -F model="openai/whisper-1" \
  -F response_format="verbose_json" \
  -F "timestamp_granularities[]=word"
```

To switch `whisper_timestamps.py` (and the subtitle burn-in transcription in
SKILL.md §12) to OpenRouter: change the base URL to
`https://openrouter.ai/api/v1/audio/transcriptions`, the auth to
`OPENROUTER_API_KEY`, and the model to `openai/whisper-1` (native uses
`whisper-1` at `api.openai.com`). Response shape (`words[]` with start/end) is
identical. **Verify the `words` array is populated on the pinned model before
trusting it** — feature availability is provider-dependent on OpenRouter.

## 2. Image generation — Nano Banana Pro — GOOD substitute

- Endpoint: `POST https://openrouter.ai/api/v1/images`
- Model: `google/gemini-3-pro-image-preview` (Nano Banana Pro; also
  `google/gemini-3.1-flash-image-preview` = Nano Banana 2,
  `google/gemini-2.5-flash-image-preview` = original Nano Banana).

```bash
curl https://openrouter.ai/api/v1/images \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"google/gemini-3-pro-image-preview",
       "prompt":"...","resolution":"2K","aspect_ratio":"16:9"}'
```

Response: `data[0].b64_json` + `usage.cost`. `resolution` ∈ `512|1K|2K|4K`;
`aspect_ratio` ∈ `1:1|16:9|9:16|4:3|...`; `size` shorthand accepts explicit
pixels (`"2048x2048"`). This maps cleanly onto the ImageGen skill's per-panel
aspect-ratio rules (see SKILL.md "Image Aspect Ratios for Split Layouts").
Pricing is token-based passthrough (scales with resolution), not flat per image.
The ImageGen skill is the canonical image path — point ITS base URL/key at
OpenRouter to consolidate.

## 3. TTS voiceover — KEEP ElevenLabs native

OpenRouter has a TTS endpoint (`POST /api/v1/audio/speech`, e.g.
`openai/gpt-4o-mini-tts`, Google/Mistral/Microsoft voices) but:
- It does **not** proxy ElevenLabs, so the skill's chosen voice
  (`mCQMfsqGDT6IDkEKR20a`, see [voiceover.md](voiceover.md)) is unavailable.
- It returns **no** word/character alignment data.

Timing is not the blocker (the skill re-derives all timing from Whisper, not
from TTS alignment — see §42/the Whisper step), so the only real cost of
switching is **voice identity**. Recommendation: **keep ElevenLabs native** for
the branded voice. Only move TTS to OpenRouter if you deliberately accept an
OpenAI/Google voice instead.

---

## Bottom line

A single `OPENROUTER_API_KEY` can replace `OPENAI_API_KEY` (Whisper) and the
ImageGen/Google key (Nano Banana Pro) — a genuine 2-of-3 consolidation. Keep
`ELEVENLABS_API_KEY` for the branded voiceover. Smoke-test each endpoint once
with a live key before shipping, especially the Whisper word-timestamp path.
