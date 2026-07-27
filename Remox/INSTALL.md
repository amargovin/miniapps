# Remox — Installation & Setup

Remox is a Claude Code **skill** for producing cinematic motion-graphics videos. It's driven by Claude (which writes bespoke Remotion/React code per scene) plus a set of Node + Python tools for rendering, audio timing, grading, and concatenation.

---

## 1. Prerequisites

Install these first (macOS shown; Linux equivalents work):

| Tool | Why | Install |
|---|---|---|
| **Claude Code** | Runs the skill | https://claude.ai/code |
| **Node.js 18+** (LTS 20 recommended) | Remotion render pipeline (`*.mjs`, `remotion/`) | `brew install node` or nodejs.org |
| **Python 3.9+** | Timing/subtitle/concat scripts (standard library only — no pip packages needed) | `brew install python` |
| **ffmpeg + ffprobe** | Grading, concat, subtitle burn-in | `brew install ffmpeg` |

Optional: `yt-dlp` (only if you pull real-world video clips), ImageMagick (ad-hoc image ops; macOS `sips` covers most).

---

## 2. Install the skill

Unzip and place the `Remox/` folder in your Claude Code skills directory:

```bash
# user-level (available in every project):
unzip Remox.zip -d ~/.claude/skills/
# → ~/.claude/skills/Remox/

# OR project-level (this project only):
unzip Remox.zip -d /path/to/project/.claude/skills/
```

Restart Claude Code (or start a new session) so it picks up the skill. It should then appear as the `Remox` skill / `/remox` commands.

---

## 3. Install Node dependencies

The zip ships **without `node_modules`** (they're large and machine-specific). Install them once:

```bash
cd ~/.claude/skills/Remox/remotion
npm install
```

This pulls Remotion and its ecosystem (`remotion`, `@remotion/cli`, `@remotion/renderer`, `@remotion/bundler`, `@remotion/google-fonts`, `@remotion/transitions`, `@remotion/three`, `three`, `react`, etc.).

Optional — only if you want the standalone review Studio UI:

```bash
cd ~/.claude/skills/Remox/studio
npm install
```

> Note: each **video project** you scaffold gets its own `remotion/` copy (via `scaffold.mjs`) and runs its own `npm install` — see the SKILL.md "Remotion Project" section.

---

## 4. API keys

Create `~/.claude/.env` (the skill reads keys from here). Only add the ones you'll use:

```bash
# Required for audio-synced timing + subtitle transcription (Whisper):
OPENAI_API_KEY=sk-...

# Required only if you generate voiceover with TTS (ElevenLabs):
ELEVENLABS_API_KEY=...

# Optional: sound-effect sourcing / misc:
# FREESOUND_API_KEY=...
# XAI_API_KEY=...
```

---

## 5. Image generation (separate skill dependency)

Remox generates AI imagery by calling the **ImageGen** skill (Google Nano Banana Pro / Gemini) — it is NOT bundled here. To use image-based productions:

1. Install the **ImageGen** skill the same way (into `~/.claude/skills/ImageGen/`).
2. Add its API key to `~/.claude/.env` (per ImageGen's own setup — a Google/Gemini API key).

Without ImageGen you can still produce **text-only** videos (pure kinetic typography on cream) — see SKILL.md "Text-Only Productions".

---

## 6. Fonts

Display/body fonts (Archivo, JetBrains Mono) load automatically at render time via `@remotion/google-fonts` — no manual install. Helvetica (body) is a system font on macOS; on Linux install a Helvetica/Arial-equivalent if you want an exact match.

---

## 7. Verify

From a scaffolded project directory:

```bash
node ~/.claude/skills/Remox/remotion/preflight.mjs /path/to/your/project
```

Preflight checks env vars, required tools, and audio files. Green preflight = you're ready.

---

## 8. Quick start

In Claude Code, from a working directory:

- `/remox produce` — full pipeline: script + per-scene audio → final video.
- `/remox scene` — generate + render a single scene.
- Read **`SKILL.md`** (top level) for the full pipeline, and **`LEARNINGS.md`** for the accumulated production rules.

---

## What's in this package

```
Remox/
├── SKILL.md              # the skill spec / pipeline (read first)
├── LEARNINGS.md          # accumulated production rules (index → guidance files)
├── skills/
│   ├── guidance/         # doctrine: motion, typography, editorial, charts, maps, ...
│   ├── cinematic/        # cookbook of cinematic patterns
│   ├── utilities/        # helpers (gen_subs.py, spring presets, ...)
│   └── examples/         # working example scene components (.tsx)
├── scripts/              # finish.sh (grade), concat_xfade.py, whisper_timestamps.py
├── remotion/             # the Remotion template (pipeline.mjs, audit/render/validate, src/)
├── studio/               # optional review UI
├── styles/               # editorial-clean / cinematic-dense style defs
├── assets/               # house end-card asset
└── workflows/            # /remox command definitions
```

Ships without `node_modules` and without any past-production media — run `npm install` (step 3) and you're set.
