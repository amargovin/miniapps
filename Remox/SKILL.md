---
name: Remox
description: Cinematic motion graphics video production. Opus writes bespoke Remotion React code per scene guided by a cookbook of 28+ cinematic patterns. USE WHEN user wants cinematic video, motion graphics, animated explainer, visual essay, OR any 'make me a cinematic video about X' request.
---

# Remox — Cinematic Motion Graphics

Remox produces cinematic motion graphics videos by having Opus write bespoke React/TSX code for each scene. No pre-built composition templates — every scene is a unique, hand-crafted animation. (Scenes are registered in `SceneRegistry.tsx` for routing, but the visual code is always written from scratch.)

## Pipeline

```
ANY Input → Style Selection → Ontology Conversion → Setup → Theme
→ Scaffold remotion/ into local project directory (scaffold.mjs)
→ Whisper Timestamps (OpenAI API) ← MANDATORY for phase timing
→ Creative Direction (writes brief.yml per scene) ← ARTIFACT GATE
→ Opus writes .tsx per scene (reads brief.yml + whisper.json)

pipeline.mjs runs per-scene:
  [0] Preflight      (preflight.mjs — env vars, tools, audio files)
  [1] Audio          file check
  [2] Whisper        auto-runs whisper_timestamps.py if missing
  [3] Brief          file check
  [4] Images         file check per brief
  [5] TSX            file check
  [6] AudioSync      audiosync.mjs --fix (auto-corrects frame math)
  [7] Registry       SceneRegistry.ts check (warn only)
  [8] Audit          audit.mjs ← HARD GATE (0 hard failures)
  [9] Preview        validate.mjs --audit → keyframe stills
                     PAUSES here for visual review (exit 3)
                     unless --auto-approve is passed
  [10] Validate      validate.mjs (frame 0 render) ← HARD GATE
  [11] Render        render.mjs ← HARD GATE (output >100KB)
  [12] Log           production_log.json

→ Finishing pass   scripts/finish.sh per scene (unified grade: S-curve,
                   vignette, grain — see LEARNINGS §39)
→ Concat           concat the GRADED scene files
```

### Parallelization

- Default: SEQUENTIAL, always — one scene at a time, pauses for visual review,
  regardless of scene count (user override, July 2026 — the old ">5 scenes =
  parallel" auto-selection is retired)
- Parallel producer-agent pattern (all scenes concurrently, --auto-approve for
  the visual preview gate) ONLY when the user explicitly requests parallel

### Pipeline (stage runner)

`pipeline.mjs` is the deterministic controller that enforces all production
stages in order for each scene. It validates LLM-produced artifacts and calls
external tools mechanically.

```bash
# Run full pipeline for one scene (preflight + audit + audiosync + preview + validate + render)
node pipeline.mjs project.json --scene Scene01

# Run full pipeline for all scenes sequentially
node pipeline.mjs project.json --all

# Autonomous mode — skip the visual preview approval gate (use in produce-all)
node pipeline.mjs project.json --all --auto-approve

# Pre-flight check only (no render)
node pipeline.mjs project.json --scene Scene01 --dry-run

# Start from a specific stage (skip earlier gates)
node pipeline.mjs project.json --scene Scene01 --from audit

# Show status of all scenes at a glance
node pipeline.mjs project.json --status

# Use a local project directory (for project isolation)
node pipeline.mjs project.json --scene Scene01 --project-dir /path/to/project
```

The 12 stages it enforces per scene:

| # | Stage | Tool | Gate type |
|---|-------|------|-----------|
| 0 | PREFLIGHT | `preflight.mjs` | hard — env + tools must be ready |
| 1 | AUDIO | file check | hard — must exist |
| 2 | WHISPER | `whisper_timestamps.py` | hard — must have >0 words |
| 3 | BRIEF | file check | hard — must exist |
| 4 | IMAGES | file check per brief | hard — all must exist |
| 5 | TSX | file check | hard — must exist |
| 6 | AUDIOSYNC | `audiosync.mjs --fix` | warn only — auto-corrects frame math |
| 7 | REGISTRY | SceneRegistry.ts check | warn only |
| 8 | AUDIT | `audit.mjs` | hard — 0 hard failures |
| 9 | PREVIEW | `validate.mjs --audit` | gate — shows stills; exit 3 unless --auto-approve |
| 10 | VALIDATE | `validate.mjs` | hard — frame 0 must render |
| 11 | RENDER | `render.mjs` | hard — output >100KB |
| 12 | LOG | production_log.json | always writes |

Exit codes: `0` = all pass, `1` = gate failure, `2` = usage error, `3` = preview ready.

## Whisper Timestamps (Mandatory)

After audio files exist, run the Whisper timestamp script:

```bash
python3 ~/.claude/skills/Remox/scripts/whisper_timestamps.py \
  --project-dir /path/to/project --all
```

This calls the OpenAI Whisper API (`whisper-1` model) to get accurate
word-level timestamps from the actual audio waveform. Output:
`audio/scene_XX_whisper.json` per scene.

**Why mandatory:** ElevenLabs TTS alignment data has collapsed timestamp
values (many words at the same ms). Whisper analyzes the actual audio
and gives distinct, accurate timing for every word. All phase durations
in briefs and TSX MUST be derived from Whisper timestamps.

**The audit system reads Whisper files** (`*_whisper.json`) as the
authoritative source for AV sync checks. If missing, audit falls back
to `*_word_timestamps.json` but this is unreliable.

## How It Works

0. **Style + Ontology**: Choose a style (`editorial-clean` default, `cinematic-dense` for high-energy). ALL inputs are then normalized into a structured `ontology.yml` — narrative arc, per-scene composition templates, weight classes, palette preset. This happens BEFORE any creative work.
1. **Input**: User provides script text + per-scene audio files (MP3s with known durations)
2. **Scene Split**: Script is divided into scenes matching audio files
3. **Theme**: Palette preset from ontology written to `theme.ts` (5 presets: editorial, dark-cinematic, vibrant, muted, monochrome)
4. **Creative Direction**: For each scene, Opus:
   - Reads the ontology entry (template, weight class, palette emphasis)
   - Reads scene text in context of the full story arc
   - Finds the core idea and visual metaphor that fits the composition template
   - Plans phases and selects cookbook patterns
   - **Writes `briefs/<SceneId>_brief.yml`** — structured YAML file (artifact gate)
5. **Code Generation**: For each scene, Opus:
   - **Reads the brief file** as primary input
   - Selects cookbook patterns from `cinematic/`
   - Writes a complete React component (`Scene_XX.tsx`)
   - Adds phase template tags: `// Phase N | template: <name> | bg: <type>`
6. **Mechanical Audit**: `audit.mjs` checks BRIEF/TMPL/COMP/H1-H8/TYP/TSM/AV
   - Writes `output/audit_result.json` — render.mjs reads this as a gate
7. **Validation**: Render frame 0 — if it fails, auto-fix (up to 3 retries)
8. **Visual Audit**: Render 7 keypoint frames per scene (`--audit`), review for aesthetic coherence
9. **Render**: Full render each scene to MP4 — **BLOCKED without passing audit**
10. **Concat**: FFmpeg concat all scenes into final video (transition SFX at cut points optional)

## Style System

Two named styles control visual density. Set in `ontology.yml`.

- **`editorial-clean`** (default) — clean, restrained, publication-quality. Typography as the star. Generous white space. The video breathes.
- **`cinematic-dense`** — rich, layered, film-quality. Multiple elements in concert. Higher energy, faster pacing.

Style files: `styles/editorial-clean.md`, `styles/cinematic-dense.md`

## Mandatory Reads

STOP: Before writing ANY scene code, read these files in order.
Do not skip. Do not summarize from memory. Actually read them.

1. `~/.claude/skills/Remox/LEARNINGS.md` — **READ FIRST.** Hard-won production rules that override theoretical guidance. Contains phase count formula (§19), AV sync rules (§15), image treatment failures (§2-3), phase necessity (§19), India map requirements (§22), render-tree resolution (§36), and frozen durations (§38).
2. `~/.claude/skills/Remox/skills/guidance/motion-doctrine.md` — **the anti-amateur doctrine.** Three acts per phase (entrance/ambient/exit), easing palette, motion blur, banned tropes, tonal-ramp backgrounds, payoff hierarchy law.
3. `~/.claude/skills/Remox/skills/guidance/ontology.md`
4. `~/.claude/skills/Remox/skills/guidance/restraint.md`
5. `~/.claude/skills/Remox/skills/guidance/composition-templates.md`
6. `~/.claude/skills/Remox/skills/guidance/creative-direction.md`
7. `~/.claude/skills/Remox/skills/guidance/editorial-design.md`
8. `~/.claude/skills/Remox/skills/guidance/sound-design.md`
9. `~/.claude/skills/Remox/skills/guidance/illustration-style.md`
10. `~/.claude/skills/Remox/skills/guidance/typography-animation.md`

These define production learnings, ontology structure, spatial layouts,
aesthetic sensibilities, creative process, visual standards, sound
design, and text animation patterns.

## Workflows

- **`/remox produce`** — Full pipeline: script → final video. Two-agent architecture: pre-production (ontology, briefs) then **producer agent** (assets, code, pipeline). **MANDATORY: Production MUST always invoke the producer agent** (`skills/guidance/producer.md`), never a generic engineer. The producer agent handles per-scene asset verification, skill-template syncing, SceneRegistry management, pipeline execution, failure recovery, and continuity tracking. Spawn it as a background subagent so the main chat remains available for status updates. ALWAYS sequential (one scene at a time through the full pipeline) unless the user explicitly requests parallel production (user override, July 2026); within a scene the producer can still spawn sub-agents for parallel asset+TSX work.
- **`/remox scene`** — Generate + render a single scene
- **`/remox audit`** — Visual frame audit (post-render or source-level)
- **`/remox add-skill`** — Promote a NEW_PATTERN to the cookbook

## Remotion Project

The skill's remotion template lives at `~/.claude/skills/Remox/remotion/` (read-only template).

**Source-tree resolution (LEARNINGS §36):** all pipeline scripts
(audit/audiosync/validate/render/pipeline) prefer the PROJECT's scaffolded
`remotion/` as the source tree and load Remotion tooling from that tree's
node_modules. Edit project files; renders pick them up directly — no
skill-template syncing. `render.mjs`/`validate.mjs` print `Source tree:` —
verify it points at the project. The skill template is only a fallback for
legacy projects without their own `remotion/`.

Each user project gets its own copy of the remotion scaffold via `scaffold.mjs`:

```bash
# Scaffold a new project (copies template, runs npm install)
node ~/.claude/skills/Remox/remotion/scaffold.mjs /path/to/my-video

# This creates /path/to/my-video/remotion/ with all boilerplate.
# Scene code, registry, theme, and project.json are then written
# to the LOCAL remotion/ — not to the skill template.
```

All pipeline scripts accept `--project-dir` to point to the local project:

```bash
# Mechanical audit
node ~/.claude/skills/Remox/remotion/audit.mjs project.json

# Render full project
node ~/.claude/skills/Remox/remotion/render.mjs project.json output.mp4

# Validate all scenes (render frame 0, stills at <project>/output/stills/)
node ~/.claude/skills/Remox/remotion/validate.mjs project.json

# Visual audit (7 keypoint frames per scene)
node ~/.claude/skills/Remox/remotion/validate.mjs project.json --audit

# Run preflight checks
node ~/.claude/skills/Remox/remotion/preflight.mjs /path/to/my-video

# Open Remotion Studio (from the LOCAL remotion/ directory)
cd /path/to/my-video/remotion && npm run studio
```

## Scene Component Contract

Every generated scene must:
- Import `{ PALETTE, FONTS, MOTION }` from `../theme`
- Use `useCurrentFrame()` and `useVideoConfig()` — never hardcode fps/dimensions
- Return `<AbsoluteFill>` as root
- Be a self-contained React component with default export
- Have a template tag comment above every phase: `// Phase N | template: <name> | bg: <type>`
- Be registered in `SceneRegistry.tsx` (missing = black frames on render)

## Visual Treatment Selection

During creative direction, every scene must be assigned a **visual treatment** based on its narrative role and content type. Never default to the same treatment for every scene — monotony kills engagement.

### Scene Role → Treatment Map

| Scene role | Visual treatment | Text density |
|---|---|---|
| **Hook / Reveal** | Full-screen kinetic text on video bg | High — big type, dramatic reveals |
| **Evidence / Stats** | Kinetic text with emphasis (scale slams, color accents) on video bg | Medium — let narration carry, text punctuates |
| **Timeline / Sequence** | Staggered text labels with dot separators on video bg | Medium — labels and dates |
| **Explanation / Structure** | Illustrated plate + camera move (see `cinematic/illustrated-plate.md`), OR left-aligned kinetic text on video bg | Medium — plate provides environment; text layers above as kinetic reveals |
| **Company / Person** | Minimal text on video bg, narration-led | Minimal — maybe a name/title |
| **Comparison** | Split-screen text (vertical divider) on video bg | Medium — labels per side |
| **Thesis / Closing** | Text on solid dark bg (PALETTE.primary), no video | High — the words ARE the visual |
| **Concept Diagram / Engagement Geometry** | Illustrated plate + camera move (see `cinematic/illustrated-plate.md`) | Low to medium — plate IS the visual; minimal text labels above |
| **Transition / Breath** | Video-only or slow visual with no text | None — let the viewer absorb |

### Variety Rules

1. **Never 3+ consecutive scenes with the same treatment.** If scenes 4, 5, 6 are all "text on video," something is wrong.
2. **At least 20% of runtime should be low-text or no-text** — narration-led with visuals doing the work. This gives the viewer breathing room.
3. **Real footage beats AI video** when a specific company, product, or person is named. Use AI video for abstract/atmospheric backdrops only.
4. **Vary text LAYOUT across scenes** — alternate between centered, left-aligned, top-left positioned, and split-screen to avoid monotony.
5. **Use solid-bg phases sparingly** — 1-2 per video for maximum dramatic contrast (thesis statements, finality).

### Runtime Balance Targets

For a 10-15 minute video, aim for roughly:
- ~40% kinetic typography on video (hero moments, reveals, thesis)
- ~25% narration-led video with minimal text (companies, places, breathing room)
- ~20% varied text layouts — split-screen, left-aligned, top-positioned (comparisons, explanations)
- ~15% solid-bg text phases + transitions (thesis, closing, dramatic contrast)

These are guidelines, not rules. A data-heavy script shifts toward more charts; a narrative-heavy script shifts toward more video. The point is: **if every scene looks the same, the creative direction failed.**

### How to Apply During Creative Direction

When planning scenes in the ontology/creative-direction phase:
1. Read the full script first — understand the arc
2. Tag each scene with its narrative role (hook, evidence, thesis, etc.)
3. Assign visual treatments using the map above
4. Check the variety rules — shuffle treatments if too repetitive
5. Only then start writing TSX

## Frame Layout: Reserved Zones

Every frame has three reserved zones. Violating these breaks real productions.

```
┌─────────────────────────────────────┐
│  [TOP-LEFT: safe for text]  [LOGO]  │  ← top-right is LOGO ZONE
│                                     │
│         [CENTER: hero text]         │
│                                     │
│                                     │
├─────────────────────────────────────┤
│        [SUBTITLE STRIP — OFF]       │  ← bottom 20% is SUBTITLE ZONE
└─────────────────────────────────────┘
```

**Text placement rules:**
- NEVER place text in the bottom 20% of the frame — subtitles live there
- NEVER place text in the top-right corner — the channel logo lives there
- Preferred positions: center-middle (hero/impact text), top-left (secondary/supporting text)
- Bottom-left, bottom-right, and top-right are all OFF-LIMITS for text

## Image Aspect Ratios for Split Layouts

When generating images for compositions where the image occupies a
**partial panel** (split layouts, focal-offset, etc.), the image
aspect ratio MUST match the panel, not the full frame.

A 16:9 image placed into a 55% wide panel gets ~45% of its content
cropped via `objectFit: cover`. The subject, even if "centered" in
the original image, will be off-center in the panel — because you're
viewing roughly the middle third of a wide image through a narrow
window.

**Rule: Match image aspect ratio to the panel it will occupy.**

| Panel width | Panel dimensions (1920×1080) | Image aspect ratio |
|---|---|---|
| 55% (split default) | 1056×1080 | ~1:1 (square) |
| 50% | 960×1080 | ~9:10 (near square) |
| 45% | 864×1080 | ~4:5 (portrait-ish) |
| 40% (focal-offset) | 768×1080 | ~5:7 |
| 100% (full-bleed) | 1920×1080 | 16:9 |

When calling ImageGen:
- Full-bleed images → `--aspect-ratio 16:9`
- Split-panel images → `--aspect-ratio 1:1` (for ~50-55% panels)
- Narrow panels → `--aspect-ratio 4:5` or similar

**Center the subject.** Since the image now matches the panel, the
subject should be centered in the frame — no need for "offset to
left/right" prompting tricks that were unreliable anyway.

## Phase Pacing

- **Target average phase duration: 5-7 seconds (150-210 frames at 30fps)**
- Maximum phase duration: 8 seconds (240 frames) — acceptable for slow analytical narration
- **Minimum phase duration: 5 seconds (150 frames) — HARD LIMIT, no exceptions**
- To calculate: `target_phases = ceil(duration_seconds / 6)` — this is the phase count formula
- Example: a 60-second voiceover → ~10 phases, a 120-second voiceover → ~20 phases
- Each phase must cover one COMPLETE sentence or thought
- The viewer needs time to: read the text, absorb the image, connect it to what they're hearing
- Vary durations within the 150-210f range for rhythm
- **NEVER create phases under 150 frames.** If whisper timestamps produce a sub-150f boundary, merge with the adjacent phase.

Applies to both landscape and portrait.

## Audio-Sync Phase Timing

**MANDATORY RULE: Phase durations MUST be derived from Whisper word timestamps (see "Whisper Timestamps" section above for setup).**

### AudioSync Formula

```
dur[i] = whisperStart[i+1] - whisperStart[i] + TRANSITION_FRAMES
dur[last] = totalSceneFrames - whisperStart[last]
```

Where `whisperStart[i]` = the frame when phase i's narrated content begins (from Whisper word timestamps at 30fps).

### Process

1. Run Whisper on the scene audio (see `## Whisper Timestamps` above)
2. Map each phase's text content to its first word in the Whisper output
3. Compute `whisperStart[i] = round(wordStartMs / 1000 * 30)` for each phase
4. Apply the formula above to get `durationInFrames` for each phase
5. Verify TSM: `sum(durations) - (N-1) * 18 = totalSceneFrames`

### Tool

```bash
cd ~/.claude/skills/Remox/remotion
node audiosync.mjs /path/to/project.json --scene SceneXX        # audit mode
node audiosync.mjs /path/to/project.json --scene SceneXX --fix  # rewrite durations
```

### Key Points

- NEVER use uniform phase durations — always derive from actual speech timing
- Save the Whisper timestamps JSON alongside the audio for reference
- Phase start/end times are approximate — the goal is that each visual phase matches the corresponding narration, not frame-perfect lip sync
- For phases covering multiple sentences, the phase duration = `last_sentence_end - first_sentence_start` (including inter-sentence gaps)

---

## Transition Rules

### Never use fade() between mixed-type phases

`fade()` between a text-only phase and an image phase causes text-over-image ghosting during the crossfade window — the outgoing text renders over the incoming image before it has faded. Always use `wipe()` when transitioning between a phase with no background image and one with an image (or vice versa).

**Rule:** If the two adjacent phases have different background types (solid color vs. image/video), use `wipe()`. `fade()` is only safe between phases of the same background type.

### Standardize all transitions to 18 frames

Mixed transition durations (e.g. some at 18f, others at 24f) will break the mechanical audit's TSM check, which assumes a uniform transition budget. Standardize all `TransitionSeries` transition `durationInFrames` to `18` across all phases in a scene.

If a specific phase genuinely needs a longer transition for tonal reasons, document the exception explicitly in the TSX header comment and adjust the TSM math accordingly.

### Phase naming: numeric suffixes only

Phase component names must use numeric-only suffixes: `Phase1`, `Phase2`, `Phase3`... Never use alpha suffixes like `Phase02a`, `Phase8b`, or `Phase1v2`.

The audit script uses the regex `/const Phase(\d+)/` to detect phase components. Alpha suffixes cause the regex to fail silently, phases get merged or miscounted, and the text-density check produces false failures.

---

## Text Contrast on SeamlessCanvas

**MANDATORY RULE: Text color must adapt to the phase background brightness.**

When a SeamlessCanvas phase samples a light color from the image (cream, amber, sage), white text becomes invisible. Use dark text instead.

### Brightness Check

```
brightness = (R * 299 + G * 587 + B * 114) / 1000
```

If `brightness > 128` → dark text. If `brightness <= 128` → white text.

### Color Values

| Background type | Headline | Body |
|---|---|---|
| Dark (navy `#1B3A5F`, charcoal `#0d1520`, dark blue `#1a385a`) | `#FFFFFF` | `rgba(255,255,255,0.72)` |
| Light (cream `#F5F3EE`, amber `#f6e2bf`, sage `#dbe0d9`) | `#2C2C2C` (PALETTE.text) | `rgba(44,44,44,0.72)` |

### Implementation

Add a `darkText` boolean prop to SeamlessCanvas text panel components:

```tsx
const darkText = brightness(bgColor) > 128;
const headlineColor = darkText ? '#2C2C2C' : '#FFFFFF';
const bodyColor = darkText ? 'rgba(44,44,44,0.72)' : 'rgba(255,255,255,0.72)';
```

Never hardcode white text on a SeamlessCanvas phase without checking the sampled background color first.

---

## Typography Specifications

These are **minimum** sizes — components may go larger for emphasis or dramatic effect.
All values are in pixels and apply to the rendered canvas dimensions.

### Landscape (1920×1080 / 16:9)

The active canvas is 1920×1080. Text must be legible on a 16:9 display at typical viewing distance.

| Role | TYPE_SCALE key | Minimum px |
|---|---|---|
| Hero headline | `heroHeadline` | 72px |
| Section title / split headline | `sectionTitle` | 56px |
| Body / detail text | `body` | 28px |
| Subheading | `subheading` | 28px |
| Stat numbers | `statNumber` | 64px (default 96px) |
| Stat labels | `statLabel` | 36px |
| Lower third name | — | 56px |
| Lower third subtitle | — | 32px |
| Labels / eyebrows | `label` | 34px |
| Caption / source credit | `caption` | 28px |

Label-class minimums (stat labels, lower-third names, labels/eyebrows, captions) were raised in July 2026 after user review — 18-20px labels are near-illegible at real viewing sizes (LEARNINGS §43). If `TYPE_SCALE` in a project's `theme.ts` still carries the old 18-20px values, override per component.

### Portrait (1080×1920 / 9:16)

Portrait video is consumed on mobile phones. The frame is narrower, which means lines break earlier and text spans less screen width. Text must be larger to remain legible at arm's length on a small screen.

These minimums come from live production experience documented in `LEARNINGS.md §1`.

| Role | Minimum px | Notes |
|---|---|---|
| Hero / impact text | 80px | From production: 80px+ confirmed readable |
| Section title | 60px | From production: subheadings at 60px+ |
| Body / detail text | 44px | From production: 36px was too small after two feedback rounds |
| Stat numbers | 80px | Proportional to hero scale |
| Stat labels | 36px | Must pair legibly with large stat number |
| Lower third name | 56px | |
| Lower third subtitle | 44px | |
| Labels / eyebrows / mono / data | 44px | From production: 44px minimum confirmed |
| Caption / source credit | 32px | |

**Rule:** If it wouldn't be readable on a phone screen held vertically at arm's length, it is too small.

Portrait does NOT use the `TYPE_SCALE` defaults from `theme.ts` — those are landscape values. When producing a portrait video, override sizes explicitly per component.

## Logo Burn-In

The channel logo is burned into every frame via `RemoxScene.tsx` (the scene wrapper component), not inside individual scenes. This means individual scene files never need to think about the logo.

```tsx
// RemoxScene.tsx — applies to every scene automatically
import { Img, staticFile } from 'remotion';

// Inside the wrapper render:
<Img
  src={staticFile('images/logo.png')}
  style={{
    position: 'absolute',
    top: 90,
    right: 78,
    width: 229,
    opacity: 0.85,
  }}
/>
```

- Logo file: `public/images/logo.png`
- Position: `top: 90, right: 78` (right margin gives breathing room from edge)
- Size: 229px wide, auto height (iterated up from 160px → 208px → 229px across sessions)
- Opacity: 85%

## Subtitle System

Subtitles are a SEPARATE layer rendered beneath (or above) scenes — they are not part of kinetic typography inside a scene.

- Word-timed using Whisper word-level timestamps
- White text on a black background strip at the bottom of the frame
- Occupies the bottom ~15-20% of the frame (which is exactly why text in scenes must avoid that area)
- Implemented as a standalone component wrapping the scene output, not baked into individual `.tsx` files

### Post-Production Subtitle Burn-In

For burning subtitles into a rendered video after the fact, use the subtitle pipeline documented in `LEARNINGS.md` (section 12) and the reusable generator script at `skills/utilities/gen_subs.py`.

Quick reference:
1. Transcribe voiceover with Whisper (`verbose_json` + `timestamp_granularities[]=word`)
2. Run `python3 ~/.claude/skills/Remox/skills/utilities/gen_subs.py whisper.json subs.ass`
3. Burn: `ffmpeg -y -i rendered.mp4 -vf "ass=subs.ass" -c:v libx264 -preset medium -crf 18 -c:a copy output.mp4`

Critical: Use `BorderStyle=3` with `Outline=15` in ASS styles. `Outline=0` makes the background box invisible.

## Video Background Treatment

When using AI-generated or real-world video as a background behind text, the default "darken everything" instinct destroys the video. Use the light-touch approach instead:

**Video filter (on the `<OffthreadVideo>` element):**
```
filter: grayscale(0.3) contrast(1.1) brightness(0.9)
```

**Global tint overlay:** `PALETTE.primary` at multiply blend, opacity `0.15` — not 0.55.

**Vignette:** `rgba(0,0,0,0.3)` — not 0.55.

**No full-screen dark overlays per phase.** Those kill the background video entirely.

## Real-World Video Integration

Real-world clips (downloaded from YouTube, etc.) can replace AI-generated clips for specific scenes where authenticity matters — factory footage, product launch events, brand reveals.

```bash
# Download with yt-dlp
yt-dlp -o "public/video/clip_name.mp4" "https://youtube.com/..."
```

- Place clips in `public/video/`
- Use the same `<OffthreadVideo>` component and crossfade pattern as AI clips
- No special treatment needed — the pipeline is identical
- Real clips are particularly effective for scenes about specific companies or products (factory footage, launch events, vehicle reveals)


## Standpoint End Card (house brand close)

Every Standpoint by Swarajya video ends with the house end card: a bright
7-second two-beat closer — credits (Script by / Creative Direction by /
"Images are for illustration purposes only.") then the STANDPOINT + Swarajya
wordmark sign-off. Colourful ribbons/confetti on a warm white field; fades in
from white and out to white; carries a silent AAC track.

**Default (credits unchanged):** concat the pre-rendered asset directly —
no render needed:

```bash
# append to a finished video
printf "file '%s'\nfile '%s'\n" final.mp4 ~/.claude/skills/Remox/assets/standpoint_endcard.mp4 > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy final_with_endcard.mp4
```

**If credit names change:** the component ships with every scaffold at
`remotion/src/StandpointEndcard.tsx` (see its header for registration steps —
SceneEndcard id, 210f, silent 7s audio, corner-logo skip). Edit the two
CreditLine names, render standalone with `render.mjs --skip-audit-gate`, and
refresh `~/.claude/skills/Remox/assets/standpoint_endcard.mp4` if the new
names are the new default.

The Swarajya white wordmark ships at `public/images/swarajya_logo_white.png`
(official asset; white-on-dark only — the end card honours this by setting it
on a brand-red chip).

## Cookbook

32+ skill files in `skills/`:
- **guidance/** (16): motion-doctrine, ontology, composition-templates, aesthetic-guide (restraint.md), creative-direction, editorial-design, sound-design, spring-physics, sequencing, transitions, typography, charts, 3d, safe-zones, video-gen, producer
- **cinematic/** (18): particle-systems, camera-shake, tunnel-flythrough, font-morphing, arc-wipe, card-flip-3d, ripple-expand, split-screen, dither-dissolve, posterize-stutter, speed-remap, svg-path-draw, clip-path-reveal, depth-blur, parallax-layers, blend-layers, conic-sweep, **illustrated-plate** (new — AI plate + cinematic camera)
- **utilities/** (4): spring-presets, seeded-random, measure-spring-chain, delay-render
- **examples/** (10): Working .tsx scene components demonstrating patterns

## Theme System

`remotion/src/theme.ts` exports:
- `PALETTE` — 6 colors: bg, primary, secondary, accent, text, textMuted
- `FONTS` — heading, body, mono font families. Loaded via
  `@remotion/google-fonts` at module level (display grotesk for headings —
  Archivo validated; Helvetica body per brand; JetBrains Mono). Never rely on
  system fonts for display type.
- `MOTION` — 4 spring presets: springSnappy, springBouncy, springHeavy, springOverdamped
- `EASING` — bezier palette: `out`/`outSoft` (entrances), `inOut` (camera/morphs),
  `in` (exits accelerate away), `drift` (ambient). Springs = impact beats only.
- `RAMP` — tonal ramps (navy, cream) + tinted shadows. Backgrounds are never
  one flat hex (see motion-doctrine.md).

`remotion/src/motion-utils.ts` exports the motion helpers every scene uses:
`ambientScale`, `breathe`, `driftY`, `enterP`, `exitP`, `holdOpacity`,
`velocityBlur`. Also exports **modern vector tokens (v3)**: `strokeGlow()`
(dual-stroke halo+core for SVG diagram paths), `barFill()` (gradient+highlight
for chart bars), `gridline()` (2px/18%-opacity — the only sanctioned thin line).
Do not reimplement these per scene.

`remotion/src/IllustratedPlate.tsx` — cinematic camera over a 4K AI-generated
textless illustration. Accepts a `cam` array of normalised-coordinate keyframes
(`cx`, `cy` ∈ 0..1, `zoom` ≥ 1.0). Interpolates with `EASING.inOut`; adds
ambient `breathe()` + `driftY()` automatically; fires velocity-proportional blur
during fast moves. Use for scene-setting, engagement geometry, concept diagrams.
See `skills/cinematic/illustrated-plate.md` for the full authoring guide.

**Palette presets** (selected in ontology, written to theme.ts):
- **editorial** — cream bg, deep blue/red/bronze (default)
- **dark-cinematic** — near-black, electric blue/amber
- **vibrant** — white bg, indigo/emerald/coral
- **muted** — warm gray, slate/dusty-rose/sage
- **monochrome** — off-white, black/gray

## Project JSON Format

```json
{
  "title": "Video Title",
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "scenes": [
    { "id": "Scene01", "audio": "audio/scene_01.mp3", "durationFrames": 126 }
  ]
}
```
