# Producer Agent — Scene-by-Scene Production

The producer agent takes the pre-production artifacts (briefs, ontology, theme, project.json) and creates the actual scene code and assets. It then hands each scene to `pipeline.mjs` which handles validation, audit, and rendering.

## Mandatory Reads (producer/pipeline role)

STOP: Read the CORE files BEFORE writing ANY scene code. Actually read them — do
not summarize from memory. LEARNINGS.md is an INDEX — the canonical rule text
lives in the file each entry points to. The always-read set is kept LEAN;
everything else is in "Read when relevant" below.

**CORE (always, before any scene code):**
1. `~/.claude/skills/Remox/LEARNINGS.md` — the slim rule index (§1-§67).
2. `~/.claude/skills/Remox/skills/guidance/motion-doctrine.md` — three acts
   per phase, easing palette, banned tropes.
3. `~/.claude/skills/Remox/skills/guidance/pipeline-traps.md` — **read before
   running the pipeline.** Source-tree resolution, stale audio/registry/
   renders, audit regex quirks, disk hygiene.
4. `~/.claude/skills/Remox/skills/guidance/composition-templates.md` — incl.
   the Composition Doctrine (§44/§49/§53).
5. `~/.claude/skills/Remox/skills/guidance/typography.md` — THE sizing
   authority (§43 floors, §52 role sizing).
6. `~/.claude/skills/Remox/skills/guidance/editorial-design.md` — Imagery
   Treatment (§2-4, §25, §27, §29-30) AND the Restraint / sensibilities
   subsection (§11b — "The Only Real Rule", white-space-as-rhythm).
7. The scene's creative brief: `briefs/<SceneId>_brief.yml`.

**Read when relevant (load only when the scene triggers it):**
- `~/.claude/skills/Remox/skills/cinematic/illustrated-plate.md` — when the
  scene uses plates or camera moves over imagery.
- `~/.claude/skills/Remox/skills/guidance/transitions.md` — when authoring
  transitions (18f default; non-18f needs the documented TSM exception).
- `~/.claude/skills/Remox/skills/guidance/charts.md` — when the scene has
  charts (incl. data-viz restraint §62, alive-from-f0 §61).
- `~/.claude/skills/Remox/skills/guidance/maps.md` — when the scene has a
  boundary-bearing map (§63, India non-negotiable).

Read the relevant cookbook patterns from `~/.claude/skills/Remox/skills/cinematic/` as specified in the brief's `techniques` field.

## When to Invoke

After pre-production is complete. Requires:
- `ontology.yml` in project directory
- `project.json` with scene IDs and frame counts
- `theme.ts` in project's remotion/src/
- `briefs/<SceneId>_brief.yml` for all scenes
- Audio files in `audio/`

## Architecture

The producer runs as a **supervisor agent** that can spawn up to **2 sub-agents per scene**:
- **Sub-agent 1** (engineer): Asset generation (images via ImageGen, videos via Grok) — runs in parallel with TSX writing
- **Sub-agent 2** (engineer): TSX code generation from the creative brief

## Per-Scene Pipeline

For each scene, the producer does exactly 3 things: generate assets, write TSX, call pipeline.

### Step 1: Read Context

Read these for the current scene:
1. `briefs/<SceneId>_brief.yml` — the creative brief (primary input)
2. `ontology.yml` — the scene entry
3. `LEARNINGS.md` — production rules
4. The previous scene's TSX — to understand what the viewer just saw
5. The next scene's ontology entry — to understand what comes next

### Step 2: Generate Assets

Based on the brief's `assets_needed` section:

#### Images (via ImageGen skill)
- Use prompts from the brief
- Match aspect ratio to panel: 16:9 full-bleed, 1:1 split panels, 4:5 narrow panels
- Save to `<project>/remotion/public/images/sXX_description.png`
- Always include "no text no words no letters" in prompts
- **Recurring subjects (LEARNINGS §48):** if this entity appeared in an earlier
  scene, pass that image via `--reference-image` so it looks like the SAME
  person/aircraft/place across the film

#### Videos (via Grok, max 2 per scene)
```bash
python3 ~/.claude/skills/varnam/scripts/video_gen.py \
  --prompt "..." --duration 6 \
  --output <project>/remotion/public/video/sXX_description.mp4
```
- Only for hero/dramatic phases where motion matters
- 6 seconds, 16:9, 720p
- **CRITICAL**: Strip embedded audio immediately:
  ```bash
  ffmpeg -y -i input.mp4 -an -c:v copy output.mp4
  ```

### Step 3: Write TSX

Write `<project>/remotion/src/scenes/Scene_XX.tsx`.

The brief is the contract. Follow it exactly:
- Phase count, durations, templates, backgrounds — all from the brief
- Use cookbook patterns specified in brief's `techniques`
- Import `{ PALETTE, FONTS, MOTION }` from `../theme`
- Use `useCurrentFrame()` and `useVideoConfig()`
- Return `<AbsoluteFill>` as root with `<TransitionSeries>`

### Step 4: Visual Phase Review (MANDATORY — before pipeline; canonical for LEARNINGS §34)

A video that passes all mechanical audits but looks like a slideshow of text
karaoke is worse than useless. The mechanical audit checks structure (phase
count, TSM math, font sizes, template tags) but CANNOT check visual quality,
text placement in the actual rendered frame, or show-don't-tell compliance.
This review is the quality gate that catches what algorithms cannot.

After writing TSX and before calling the pipeline, the producer MUST visually
review every phase by rendering its last frame and inspecting it. This catches
text placement errors, show-don't-tell violations, and aesthetic issues that
the mechanical audit cannot detect.

#### Process

1. **Render last frame of each phase** using validate.mjs or ffmpeg frame extraction:
   ```bash
   # First do a quick validate render (frame 0) to ensure it compiles
   node ~/.claude/skills/Remox/remotion/validate.mjs project.json --scene SceneXX

   # Then render keypoint stills (7 frames per scene including phase boundaries)
   node ~/.claude/skills/Remox/remotion/validate.mjs project.json --scene SceneXX --audit
   # Stills output to: output/stills/SceneXX/
   ```

2. **Read each still image** using the Read tool (which can view images).

3. **Check each phase against these criteria:**

   **Text Placement (hard fail):**
   - Is any text in the bottom 20% of the frame? → FIX
   - Is any text in the top-right corner (logo zone)? → FIX
   - Is text vertically centered in the safe zone? (not pushed to top/bottom)
   - Is text readable against its background? (contrast check)

   **Show Don't Tell (hard fail — per LEARNINGS §25):**
   - Does the phase just display TEXT of what the narrator is saying? → FAIL
   - Image phases: Does the image SHOW what the narrator TELLS? The image
     should depict the subject (a satellite, a lab, a clock, a person) while
     the narrator describes it. Text overlay should be MINIMAL — a name,
     date, or 3-word label. NOT a transcript.
   - Text-only phases: Is this a DRAMATIC moment where the words themselves
     ARE the visual? (thesis statement, emotional peak, key stat) If not,
     it should have an image instead.
   - The mute test: if you mute the audio, does the image alone tell you
     something? If the screen just shows text that means nothing without
     audio, it FAILS.

   **Image Specificity & Likeness (hard fail — LEARNINGS §56, §57):**
   - **Specificity (§56):** does the image depict the SPECIFIC subject the
     narration names right now (this country's flag/landmark, X's flagged
     infrastructure, this event)? Swap test: could this exact image sit under
     a different sentence about a different subject unnoticed? If yes → FAIL,
     it's generic filler. Fix with the specific depiction.
   - **No real-person likeness (§57):** is any AI-generated identifiable real
     public figure on screen? → FAIL. Replace with place/hardware/flag or an
     anonymous role figure (official from behind at a lectern).

   **Text Contrast on Images (hard fail — LEARNINGS §59, §60):**
   - Text over an image/busy/bright bg sits on a SOLID opaque chip (deep-navy
     ~0.86-0.90 + white, or solid cream + ink) — NOT a feathered
     gradient-to-transparent scrim. Read the still and confirm every character
     is legible over the busiest/brightest patch it overlaps.
   - No bronze TEXT in bright `PALETTE.accent` on cream (~2.75:1) — bronze text
     uses `accentInk`.

   **Feedback Gate (hard fail — user-flagged, PL-15 July 2026; LEARNINGS §42-44):**
   Run this checklist explicitly for EVERY phase and fix failures BEFORE rendering:
   - **Label size floors (§43):** labels/eyebrows/mono ≥34px, stat sub-labels
     ≥36px, captions/source credits ≥28px, lower-third names ≥56px. A 20px
     label over a photographic background is a FAIL.
   - **Rich composition (§44):** no "small label in one corner + image in
     another corner" with dead space between. Every image phase is either a
     composed multi-level text block (eyebrow + headline + support + animated
     accent) or a luminous narration-led full-bleed. Never crush the image
     with dark overlays.
   - **Rich text treatment (§44 extension):** no plain static two-line labels
     on an image. Every text moment needs scale hierarchy, staggered kinetic
     entrance, an animated accent (rule draw / underline / highlight wash /
     indicator), and ambient life through the hold — tied diegetically to the
     image where it offers a hook.
   - **Phase breathing (§42):** exits play through the narrator's natural
     pauses — never a static hold that slams into the next phase.

   **Aesthetic Quality (soft fail):**
   - Does the composition look professional or like a slideshow?
   - Is there visual variety from the previous phase?
   - Are font sizes large enough to read comfortably?
   - Is there appropriate white space / breathing room?
   - Does Ken Burns drift feel natural on image phases?

4. **Fix any failures** before proceeding to the pipeline. If show-don't-tell
   fails, rethink the phase's visual approach — replace text with an image,
   or reduce text to a minimal label.

5. **Log the review:**
   ```
   VISUAL REVIEW — SceneXX
     Phase 1: PASS — navy slam opener, dramatic text appropriate for hook
     Phase 2: FAIL (show-don't-tell) — displays narrator's words as text
       → FIX: replace with focal-offset image of SAC cleanroom, minimal label
     Phase 3: PASS — image of scientist, narration-led, good
     ...
   ```

### Step 5: Verify the Source Tree (per pipeline-traps.md, §36)

For scaffolded projects the pipeline renders directly from
`<project>/remotion/` — no skill-template syncing. But VERIFY it: every
render/validate log prints `Source tree: <path>` — confirm it points at the
PROJECT tree, and keep `"projectDir": "/abs/path"` in project.json.

Only legacy projects without their own `remotion/` still need the old
skill-template sync ritual — see pipeline-traps.md § "Legacy projects only"
(§35) for the copy + MD5-verify steps.

### Step 5b: Studio Review Gate (default when the user is present)

Run the pipeline WITHOUT `--auto-approve`: it saves files, passes audit, and
PAUSES at the preview gate. The user then reviews the scene in Studio (each
scene is its own sidebar composition via scenesManifest.json). Iterate:
edit TSX → hot reload → user re-scrubs. No renders during iteration. On the
user's approval: `pipeline.mjs --scene SceneXX --from validate` to render.
Claude's own gate checks still run on stills (Step 4). Use `--auto-approve`
only for explicitly autonomous runs.

### Step 6: Call Pipeline

```bash
node ~/.claude/skills/Remox/remotion/pipeline.mjs project.json --scene SceneXX
```

Pipeline handles everything from here: whisper timestamps, audiosync, registry auto-generation, mechanical audit, preview stills, validation, and rendering. See SKILL.md for the full stage list.

### Step 7: Handle Failures

If pipeline exits with code 1 (gate failure):
1. Read the error output
2. Fix the TSX
3. Re-run: `node pipeline.mjs project.json --scene SceneXX --from <failed-stage>`
4. Max 3 retries per scene

If pipeline exits with code 3 (preview ready, sequential mode):
1. Show stills from `output/stills/SceneXX/` to user
2. If approved: `node pipeline.mjs project.json --scene SceneXX --from validate`
3. If changes needed: fix TSX, then `--from audiosync`

### Step 8: Log & Continue

After each completed scene:
```
SCENE XX COMPLETE
  Phases: N
  Assets: X images, Y videos
  Budget: spent $X.XX / $LIMIT (remaining: $X.XX)
  Render: output/scenes/scene_XX.mp4 (X.X MB)
```

Move to next scene.

## Hard Limits

- **Max 2 AI-generated video clips per scene** (~$0.60 each)
- **No limit on AI images** (~$0.04 each) but use judiciously
- **Budget tracking**: Log before every asset generation:
  ```
  BUDGET: Spent $X.XX / $LIMIT | This asset: ~$0.XX | Remaining: $X.XX
  ```

## Hard Rules for TSX Sub-Agents

Copy these into every sub-agent prompt:

### H1: Video Duration vs Phase Duration
Grok clips are ~6s (180f). Phase with video bg MUST be ≤180f. Set `playbackRate = 180 / phaseDurationFrames`. playbackRate MUST be ≤ 1.0. Every OffthreadVideo needs a derivation comment.

### H2: Audio-Sync Phase Timing
Phase durations from word timestamps, NOT estimated. Math MUST balance: `sum(phases) - sum(transitions) = scene_total_frames`

### H3: Reserved Zones
- Bottom 20% (216px): NO TEXT (subtitles)
- Top-right corner: NO TEXT (logo)

### H4: Required TSX Structure
`AbsoluteFill > TransitionSeries` with `PALETTE, FONTS, MOTION` imports. Default export.

### H5: Scene End Breathing Room
Last phase must extend ≥30 frames beyond last audio word.

### H6: Strip Audio from AI Videos
`ffmpeg -y -i input.mp4 -an -c:v copy output.mp4` — EVERY video asset.

### H7: Phase Transitions Track Narration
Phase start must align with narration start (±15 frames).

### H8: Scene Header Comment
```tsx
// Scene_XX | templates: focal-offset(3), centered-hero(2), split-compare(1)
```

### H9: Phase Template Tags
```tsx
// Phase 1 | template: focal-offset | bg: image | asset: s04_factory.png
```

### H10: Creative Brief Required
`briefs/<SceneId>_brief.yml` must exist. Audit checks for it.

## Parallelization Strategy (canonical for LEARNINGS §45)

**Default: SEQUENTIAL — always.** One scene at a time, preview gate pauses for
review, regardless of scene count. The old ">5 scenes = parallel" rule is
retired (user override, July 2026): sequential production lets visual-review
feedback land before it compounds across every scene.

Spawn concurrent per-scene sub-agents (passing `--auto-approve` to
pipeline.mjs) ONLY when the user explicitly asks for parallel production.

## Continuity Tracking

After each scene, log visual approach. Track across full video:
```
Scene01: generated backdrop + kinetic typography
Scene02: ???
```
If 3+ consecutive scenes use same approach, redesign one. Target: 4+ different approaches.
