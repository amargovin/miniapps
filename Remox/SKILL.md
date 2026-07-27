---
name: Remox
version: 1.0.0
updated: 2026-07-09
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
                   vignette, grain — see "Finishing Pass & Concat" below)
→ Concat           crossfade-concat the GRADED scene files (concat_xfade.py)
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

> Provider note: this can run against OpenAI directly OR via OpenRouter (pin an
> OpenAI-compatible model for word timestamps) — see `skills/guidance/providers.md`.

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

**Palette/mood default (user preference, July 2026):** bright and colourful —
cream-editorial palettes and DAYLIGHT imagery ("bright colours and happy
vibes"). Dark/night-thriller moods only when the user explicitly asks. The
PL-15 film was fully re-skinned from dark to cream at user request; keep red
alarm beats for menace, carried on cream by red typography.

## Mandatory Reads (role-scoped)

**LEARNINGS.md is an index — the canonical rule text lives in the file each
entry points to.** Read the index to know which rules exist and where they
live; read the pointed-to files for the operative detail. Do not summarize
from memory — actually read them.

The always-read set is kept LEAN — a small CORE loaded every session, with
everything else moved to a labelled "Read when relevant" list so context isn't
loaded until it applies.

**CORE — everyone reads these, every session, before any Remox work:**
1. `~/.claude/skills/Remox/LEARNINGS.md` — the slim rule index (§1-§67) +
   incident log. Skim it fully; follow pointers for anything you'll touch.
   (Always read.)
2. `~/.claude/skills/Remox/skills/guidance/motion-doctrine.md` — **the
   anti-amateur doctrine.** Three acts per phase (entrance/ambient/exit),
   easing palette, banned tropes, tonal-ramp backgrounds, payoff hierarchy.
3. `~/.claude/skills/Remox/skills/guidance/pipeline-traps.md` — source-tree
   resolution, stale audio/registry/renders, audit regex quirks, disk hygiene.
4. `~/.claude/skills/Remox/skills/guidance/composition-templates.md` — incl.
   the Composition Doctrine (§44/§49/§53).
5. `~/.claude/skills/Remox/skills/guidance/typography.md` — THE sizing
   authority (§1, §43, §52).
6. `~/.claude/skills/Remox/skills/guidance/editorial-design.md` — Imagery
   Treatment (§2-4, §25, §27, §29-30) AND the Restraint / sensibilities
   subsection (§11b — "The Only Real Rule", white-space-as-rhythm).

**Role add-ons to the CORE (still short):**
- **Pre-production / creative** (ontology, briefs, creative direction) also
  ALWAYS read: `ontology.md`, `creative-direction.md`.
- **Producer / pipeline** (scene code, assets, rendering): start with
  `~/.claude/skills/Remox/skills/guidance/producer.md` for the operative
  per-scene workflow incl. the mandatory visual still review (§34). Everything
  in producer.md's own CORE overlaps this list; its "Read when relevant" list
  matches the one below.

**Read when relevant (load only when the trigger applies):**
- `charts.md` — when the video has charts / data-viz (incl. data-viz restraint
  §62, alive-from-f0 §61).
- `maps.md` — when the video has an official-boundary map (§63; India
  non-negotiable).
- `illustrated-plate.md` — when using AI plates + cinematic camera (plates,
  camera grammar, Proportion Policy, world-pinned labels).
- `transitions.md` — when authoring transitions (18f default, motivated
  vocabulary, tonal-shift exceptions).
- `sound-design.md` — during the sound pass.
- `creative-direction.md` — pre-production / briefs (also in the pre-production
  ALWAYS add-on above).
- `ontology.md` — pre-production (also in the pre-production ALWAYS add-on).
- `illustration-style.md` — when the video uses hand illustration.
- `typography-animation.md` — when the video uses heavy kinetic type.
- `spring-physics.md` — when tuning spring configs.
- `sequencing.md` — when structuring multi-phase sequences.
- `safe-zones.md` — when placing text near frame edges (portrait especially).
- `3d.md` — when a scene uses 3D/perspective transforms.
- `video-gen.md` — when generating AI video clips.
- `voiceover.md` — when generating or padding TTS voiceover.
- `pre-production.md` — when running the pre-production setup step.

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

## Phase Pacing (canonical for LEARNINGS §19)

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

**Image montages inside a phase** (a beat that steps through several images)
have their OWN pacing floor — do not slideshow them: each image holds ~3s
(≥90f), floor 2.5s; joins are SLOW 30-40f eased directional slides with the
outgoing image held fullscreen underneath; FEWER images beats faster cuts; and
NEVER white cut-flashes between images. Full rule: motion-doctrine.md →
"Montage & multi-image beats" (§58).

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
- **The phase TEXT content must also match what is being narrated at that
  time (§15)** — boundary alignment alone is not enough. A phase that starts
  at the right frame but displays the wrong sentence is still an AV sync
  failure.
- **No callback/recall phases (§16):** short post-audio phases (30-50f) that
  flash an image or text after narration ends read as a flicker with no
  audio context. Let the last content phase hold to the end of the scene.

### Frozen durations — never change TransitionSeries timing when re-skinning (canonical for §38)

Visual upgrades re-skin the INTERIOR of phases. Phase count, order, and every
`durationInFrames` (sequences AND transitions) are Whisper-derived and
frozen. Changing one (262 → 248 in production) breaks the TSM audit and
drifts phase timing off the narration. If exit choreography needs timing,
derive it from the existing `DUR` constant (`exitStart = DUR - 32`), never by
changing `DUR`. Sole sanctioned exception: when the AUDIO itself changed
(e.g. retro-padding tails per §42) — then update project.json, whisper JSONs,
and re-run `audiosync.mjs --fix`.

### Text arrival & minimum hold (canonical for §51)

Text that is already on screen when the viewer's eye lands is wallpaper — no
entrance, no attention, no read (user-flagged: an early stat chip "just never
registers at all").

1. **The image establishes ALONE first** — minimum ~1s (30f) of pure imagery
   at every scene open and every new-world phase before any text enters.
2. **Text lands ON its whisper beat** — the frame the narrator says the
   number or name is the frame the text's kinetic entrance fires. The motion
   onset at the spoken moment is what captures the eye. Entering early
   pre-empts the beat; entering late orphans it.
3. **If on-beat entry leaves the text <2s of hold**, skip its exit fade and
   let the phase cross-fade take it out.
4. Applies doubly to Phase 1 of Scene 1: the film's first seconds carry the
   scene entrance AND the viewer's arrival; nothing textual should compete.
5. **MINIMUM HOLD: 3 seconds (90f) on screen for any text element** (user
   rule, July 2026). If landing exactly on the whisper beat would leave less
   than 90f before the phase ends, enter EARLIER:
   `enterAt = min(beat, phaseDur − 90)`. The minimum hold outranks perfect
   beat alignment — text that arrives on beat but vanishes in 2s registers
   no better than wallpaper. (Persistent UI like the corner bug is exempt.)

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

### Over images / busy / bright backgrounds: SOLID chips, not soft scrims (canonical for §59)

The brightness rule above chooses the TEXT color. Over a photographic, busy,
or bright background, color alone is not enough — the text needs a **solid
opaque backing chip**, not a feathered scrim.

- **Feathered / gradient-to-transparent scrims FAIL.** A gradient that fades
  to transparent lets the busy background bleed through exactly where the text
  sits, and legibility collapses in the bright patches. Do not use
  gradient-to-transparent overlays as a legibility device.
- **Use a SOLID chip sized to the text**, chosen by the background-brightness
  rule:
  - Over a dark/mid image → deep-navy chip `rgba(11,22,34,0.86)`–`0.90` with
    WHITE text.
  - Over a bright/light image → a SOLID cream chip (`#F5F3EE`, opaque) with
    INK text (`PALETTE.text`), and bronze text only in the darker
    `accentInk` (see typography.md → "Bronze on cream fails" — the bright
    brand bronze is unreadable as text on cream).
- The AnimatedTextBox pattern (editorial-design.md §11.2) satisfies this — its
  fill is a solid translucent panel that draws on, not a soft gradient.
- **Verify on the actual rendered still, not in theory.** Read the phase's
  keypoint still and confirm every character is legible against the busiest
  and brightest patch it overlaps (producer.md Step 4).

---

## Typography

**`skills/guidance/typography.md` is THE sizing authority** — do not restate its
tables here. It carries the canonical landscape floors (§43), the portrait
floors (§1), and the role-sizing rule (§52: minimums are for supporting
classes; the phase's payoff element is sized by its role, not the floor). Read
it before setting any text size. Quick orientation: landscape body/label floor
≥28-34px, hero 72-120px; portrait body/label floor ≥44px, hero 80px+; portrait
overrides the landscape `TYPE_SCALE` defaults from `theme.ts` per component.

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

**Endcard scenes skip the corner logo (§7):** when a scene is a dedicated
endcard (large centered logo + tagline), the small corner logo clashes with
the centered hero logo. In `RemoxScene.tsx`, wrap the corner `<Img>` (and the
corner bug) with a scene-ID check, e.g.
`{sceneId !== 'SceneEndcard' && (<Img ... />)}` — substitute the actual last
scene ID.

## Corner Bug — Alternating Show/Channel Brand (canonical for LEARNINGS §54)

User spec, July 2026: the static #SWARAJYA badge in the top-right is replaced
by an alternating broadcast bug (standard channel-DOG practice): a red
**STANDPOINT** chip and the **by #SWARAJYA** badge swap every **10 seconds**.

Rules (component lives in `RemoxScene.tsx` — `CornerBug`, ships with scaffold):
- **Quiet swap**: 12f slide-fade. The bug swaps ~56×/9-min video; any louder
  and it pulls eyes off content. Persistent UI is exempt from §51 hold rules.
- **10s cadence** — 2s would strobe; longer under-serves the show brand.
- **One brand object, two states**: the STANDPOINT chip uses the badge's red
  so the corner reads as a single element changing state, not two logos.
- **3D lighting (user: "looks flat" without it)**: beveled vertical gradient
  (lit top-edge → brand red → deep base), inner top highlight + bottom shade,
  navy-tinted drop shadow, tight 1px emboss on the type, and a quiet diagonal
  gloss sweep once per cycle. The badge state gets a matching drop-shadow so
  both faces carry equal depth.
- Endcard/intro scenes still skip the bug (RemoxScene skip-list).

## Show-Brand Opener — suppress the bug for its full duration (canonical for §64)

A show-brand opener can be layered OVER the cold open (it doesn't need its own
dead-air scene): the show name enters as the hero title, the episode title
lands on a key beat, then both DOCK (shrink/settle to a corner or strap) as
the cold open continues underneath. This is standard broadcast grammar.

- **Suppress the corner bug/DOG for the FULL duration of the opener.** Running
  the opener AND the corner bug at once is a double-brand — two show marks on
  screen fighting each other. The bug returns AFTER the opener docks/clears.
  Add the opener's scene/frame range to the RemoxScene bug skip-list, same
  mechanism as the endcard/intro skip.
- **Openers bookend the endcard.** The opener and the Standpoint end card are
  a matched pair — same brand voice, same authority. If you build/modify one,
  keep it consistent with the other.
- **Brand furniture must read AUTHORITATIVE** — bugs, straps, openers,
  endcards are studio-grade (glass, light, precise type), never celebratory or
  toy-like (§55). An opener that looks like a lower-third template undercuts
  the whole film.

## Subtitle System

Subtitles are a SEPARATE layer rendered beneath (or above) scenes — they are not part of kinetic typography inside a scene.

- Word-timed using Whisper word-level timestamps
- White text on a black background strip at the bottom of the frame
- Occupies the bottom ~15-20% of the frame (which is exactly why text in scenes must avoid that area)
- Implemented as a standalone component wrapping the scene output, not baked into individual `.tsx` files

### Post-Production Subtitle Burn-In (canonical for LEARNINGS §12)

Pipeline order — render first, then subtitle:
1. **Render video** from Remotion (full render, not preview)
2. **Transcribe the SOURCE voiceover** with Whisper — not the rendered video.
   If the video was sped up, transcribe AFTER speed-up so timestamps align.
   ```bash
   source ~/.claude/.env   # loads OPENAI_API_KEY
   curl https://api.openai.com/v1/audio/transcriptions \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     -F file=@voiceover.mp3 -F model=whisper-1 \
     -F response_format=verbose_json -F timestamp_granularities[]=word \
     > whisper.json
   ```
   `verbose_json` + word granularity are required — sentence-level
   timestamps are not sufficient for burn-in.
3. **Generate the ASS file:**
   `python3 ~/.claude/skills/Remox/skills/utilities/gen_subs.py whisper.json subs.ass`
4. **Burn:**
   `ffmpeg -y -i rendered.mp4 -vf "ass=subs.ass" -c:v libx264 -preset medium -crf 18 -c:a copy output.mp4`

ASS style rules:
- **BorderStyle=3** (opaque box) with **Outline ≥ 12** (15 for comfortable
  padding). CRITICAL: `Outline=0` makes the black box invisible.
- **Full white text** (`PrimaryColour=&H00FFFFFF`, same Secondary). No
  karaoke color highlighting unless the user explicitly requests it.
- **Vertical (9:16):** Helvetica Bold 58px, `MarginV=420` — Instagram's
  bottom UI covers ~400-440px of a 1920px frame; MarginV=180 hides
  subtitles behind it. (Older settings — 64px, MarginV=320, gold word
  highlight — are archived as §13, superseded.)
- **Line grouping:** max 7 words per line, break on pauses > 0.4s.

Audio splitting (per-scene files from one long voiceover): detect paragraph
boundaries with
`ffmpeg -i voiceover.mp3 -af silencedetect=noise=-30dB:d=0.5 -f null -` and
split at silence gaps > 1s.

## Thumbnail Generation (LEARNINGS §14)

- Use the **ImageGen skill** (Nano Banana Pro) for Instagram thumbnails, not
  HTML screenshots. 9:16, 2K size.
- Reuse the video's first backdrop image with duotone treatment for visual
  consistency. Include headline, subtitle, #SWARAJYA badge, play indicator.
- Keep the bottom 15% clear (Instagram UI overlaps there).

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


## Finishing Pass & Concat (canonical for LEARNINGS §39; scene joins per §50)

Rendered scenes get ONE shared grade so photo scenes and vector scenes read
as a single film: gentle S-curve with lifted blacks, +5% saturation, subtle
vignette, temporal grain.

```bash
~/.claude/skills/Remox/scripts/finish.sh output/scenes/SceneXX.mp4 output/graded/SceneXX.mp4
```

Run per scene after RENDER, then concat the GRADED files. Calibration note:
the first version (vignette PI/5, noise 5) grayed the cream scenes — current
settings (vignette PI/7, noise 4, saturation 1.05) preserve warmth. If cream
scenes look dirty-gray after grading, the vignette is too strong.

Concat with soft crossfades, never butt joints (transitions.md, §50):

```bash
python3 ~/.claude/skills/Remox/scripts/concat_xfade.py out.mp4 <graded scenes...>
```

## Text-Only Productions (LEARNINGS §11)

When the user requests "text only" visuals, skip ALL ImageGen and backdrop
generation. Pure kinetic typography on cream backgrounds with color wash
phases — faster and often more visually effective; the typography IS the
visual, and there is nothing to generate, approve, or re-generate.


## Studio Review Loop (user workflow, July 2026)

The production gate the user chose: **audit pass → files saved → the user
reviews each scene in Remotion Studio → the user chooses to render.** No
renders for review iterations.

Per-scene flow:
1. Write/edit the scene TSX. Claude's deterministic checks run on stills
   (audit + feedback gate).
2. Run `pipeline.mjs --scene SceneXX` WITHOUT `--auto-approve` — it stops at
   the PREVIEW gate (exit 3) with the TSX saved and audit passed.
3. The user reviews in Studio: every scene is its OWN composition in the
   sidebar (per-scene compositions are generated from `src/scenesManifest.json`,
   which the pipeline's REGISTRY stage regenerates from project.json). Scrub,
   play with audio, judge beats and holds live.
4. Feedback → Claude edits TSX → Studio hot-reloads (~2s) → user re-scrubs.
   Re-run audit after edits. Still no renders.
5. User approves → `pipeline.mjs --scene SceneXX --from validate` renders.

Start Studio: `cd remotion && npm run studio` (background,
http://localhost:3000). Keep it running through the whole production.
`--auto-approve` remains for explicitly autonomous runs only.

Notes: the props panel is NOT part of the workflow (user preference — Studio
is a viewer; edits go through Claude). Studio preview is not render ground
truth for edge cases — the §36 verify-from-output rule still applies after
rendering. Heavy scenes: set preview scale to 50%.

## Standpoint End Card (house brand close — canonical for LEARNINGS §55)

Every Standpoint by Swarajya video ends with the house end card: a 7-second
BROADCAST NEWS closer (v2, July 2026 — the earlier confetti sting was retired
as "a little amateur"). Deep navy studio field with sweeping diagonal light
bands; Beat 1: credit STRAPS (red kicker block + frosted-glass name bar)
slide in — Script / Creative Direction / the italics disclaimer; Beat 2:
STANDPOINT slams in white 900, red rule sweep, "by [Swarajya wordmark on red
chip]", specular shine pass, fade to BLACK (sign-off, not white). Silent AAC
track for concat.

**The lesson (§55):** brand furniture — bugs, straps, end cards — must read
AUTHORITATIVE: studio light and glass, not celebration graphics.

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

Skill files in `skills/`:
- **guidance/** (22): motion-doctrine, ontology, composition-templates, creative-direction, editorial-design, illustration-style, sound-design, spring-physics, sequencing, transitions, typography, typography-animation, charts, maps, 3d, safe-zones, video-gen, voiceover, providers, pre-production, pipeline-traps, producer
- **cinematic/** (23): particle-systems, camera-shake, tunnel-flythrough, font-morphing, arc-wipe, card-flip-3d, ripple-expand, split-screen, dither-dissolve, posterize-stutter, speed-remap, svg-path-draw, clip-path-reveal, depth-blur, parallax-layers, blend-layers, conic-sweep, animated-counters, annotated-overlay, duotone-photo, generated-backdrop, kinetic-typography, **illustrated-plate** (AI plate + cinematic camera)
- **utilities/** (4 + gen_subs.py): spring-presets, seeded-random, measure-spring-chain, delay-render
- **examples/** (12): working .tsx scene components demonstrating patterns

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
