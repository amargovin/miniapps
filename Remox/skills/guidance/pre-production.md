# Pre-Production Agent — Project Setup & Creative Planning

The pre-production agent handles everything from raw user input to a complete set of creative briefs. Its output is the contract that the producer agent executes.

## Mandatory Reads (pre-production/creative role)

STOP: Read these files BEFORE any work. Actually read them — do not summarize
from memory. LEARNINGS.md is an INDEX — the canonical rule text lives in the
file each entry points to.

The always-read set is kept LEAN; everything else is in "Read when relevant".

**CORE (always, before any pre-production work):**
1. `~/.claude/skills/Remox/LEARNINGS.md` — the slim rule index (§1-§67).
2. `~/.claude/skills/Remox/skills/guidance/motion-doctrine.md`.
3. `~/.claude/skills/Remox/skills/guidance/composition-templates.md` — incl.
   the Composition Doctrine (§44/§49/§53).
4. `~/.claude/skills/Remox/skills/guidance/typography.md` — THE sizing
   authority (§1, §43, §52).
5. `~/.claude/skills/Remox/skills/guidance/editorial-design.md` — Imagery
   Treatment (§2-4, §25, §27, §29-30) AND the Restraint / sensibilities
   subsection (§11b — "The Only Real Rule", white-space-as-rhythm).

**Pre-production role add-ons (also always, for this role):**
6. `~/.claude/skills/Remox/skills/guidance/ontology.md`.
7. `~/.claude/skills/Remox/skills/guidance/creative-direction.md`.

**Read when relevant (load only when the trigger applies):**
- `~/.claude/skills/Remox/skills/cinematic/illustrated-plate.md` — when using AI
  plates + camera (plate budget / Proportion Policy, camera grammars,
  world-pinned labels).
- `~/.claude/skills/Remox/skills/guidance/sound-design.md` — during the sound pass.
- `~/.claude/skills/Remox/skills/guidance/illustration-style.md` — when the video
  uses hand illustration.
- `~/.claude/skills/Remox/skills/guidance/typography-animation.md` — when the
  video uses heavy kinetic type.

## When to Invoke

The pre-production agent runs ONCE at the start of `/remox produce`. It requires:
- Script text (full or per-scene) from the user
- Per-scene audio files (MP3s) OR a single audio file to split
- Optional: theme preferences (colors, fonts, mood)

## Outputs (the contract)

The pre-production agent must produce ALL of these before handing off to the producer:

| Artifact | Path | Description |
|---|---|---|
| `ontology.yml` | `<project>/ontology.yml` | Full narrative structure with per-phase visual direction |
| `theme.ts` | `<project>/remotion/src/theme.ts` | PALETTE, FONTS, MOTION exports |
| `project.json` | `<project>/project.json` | Scene manifest with IDs, audio paths, frame counts |
| `briefs/*.yml` | `<project>/briefs/<SceneId>_brief.yml` | One creative brief per scene |
| Audio files | `<project>/audio/scene_XX.mp3` | Organized per-scene audio |
| Remotion scaffold | `<project>/remotion/` | Scaffolded via `scaffold.mjs` |

## Pipeline

### Step 1: Scaffold

```bash
node ~/.claude/skills/Remox/remotion/scaffold.mjs /path/to/project
```

Copies remotion boilerplate, runs npm install. Idempotent.

### Step 2: Setup Audio

1. Create `audio/` directory
2. Copy/link per-scene audio files
3. Pad with trailing silence (canonical for LEARNINGS §42 — MANDATORY, do this BEFORE measuring durations or running Whisper):
   ```bash
   ffmpeg -y -i audio/scene_XX.mp3 -af "apad=pad_dur=1.1" audio/scene_XX_padded.mp3 && mv audio/scene_XX_padded.mp3 audio/scene_XX.mp3
   ```
   Why: ElevenLabs TTS ends almost exactly on the final word — scenes
   rendered to that duration cut off abruptly ("the very last few
   microseconds of the words are cut") and concatenated scenes feel
   breathless. Why 1.1s and not 0.9s: the H5 audit rule requires ≥30 frames
   AFTER the last word's END; TTS speech usually ends a hair before the file
   does, so 0.9s of pad yielded exactly 27f in production and failed H5.
   1.1s clears the floor with margin. The LAST phase absorbs the padding
   (audiosync's dur[last] formula handles it automatically).

   Tail-only — NEVER prepend silence (it shifts every Whisper word
   timestamp). Skip only if the audio was already padded at generation time
   (voiceover.md does this).

   If audio was already produced unpadded and scenes are BUILT: pad at a
   clean boundary, add +27f (at 30fps) to every scene in project.json,
   update audioDurationMs in the whisper JSONs, and re-run
   `audiosync.mjs --fix` per built scene — a sanctioned exception to §38
   because the audio itself changed.

   Between phases: true silent gaps are impossible without desyncing
   narration (phase starts pin to Whisper word starts) — breathing comes
   from exit choreography playing through the narrator's pauses (see
   motion-doctrine.md Act 3).
4. Calculate durations (on the PADDED files):
   ```bash
   ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 audio/scene_XX.mp3
   ```
5. Convert to frames: `Math.round(durationSeconds * 30)`

### Step 3: Ontology + Style Selection

**Read `ontology.md` first.**

Choose style before anything else:
- **`editorial-clean`** (default) — typography-led, generous white space
- **`cinematic-dense`** — high density, more patterns per scene

Read the chosen style file from `~/.claude/skills/Remox/styles/`.

Convert input into standardized `ontology.yml`:

1. Set style
2. Build narrative arc (hook/build/climax/resolve)
3. Split into scenes with durations
4. Per scene: `core_idea` (5 words), `emotional_beat`, `information_density`
5. Assign visual plan per scene from style budgets:
   - `composition_template` from composition-templates.md
   - `max_elements`, `pattern_budget`, `weight_class`, `palette_emphasis`
6. Choose palette preset (editorial/dark-cinematic/vibrant/muted/monochrome)
7. Assign sound design per scene (see sound-design.md)
8. Define continuity (transitions, color flow, pacing)
9. Validate against ontology checklist

**Weight distribution:** For 7-10 scenes: 2 hero, 4-6 supporting, 1-2 connective.

**Image density targets (LEARNINGS §21):**
- Hero scenes: 70%+ phases with images
- Supporting: 50%+
- Connective: 30%+

**Phase count (LEARNINGS §19):** `target_phases = ceil(duration_seconds / 6)`. Include in ontology per scene.

**Composition default (LEARNINGS §49):** plan image phases as INTEGRATED
full-bleed — image prompts must specify designed negative space for the text
side; text lives in the image, not beside it. Splits only for true A-vs-B
beats, with a live divider.

**Plate-camera budget (illustrated-plate.md Proportion Policy):** plan 25–35% of
runtime as camera-walk phases (hard cap 40%), organised as 3–5 plate WORLDS per
~10 min. Assign worlds at ontology time; a photo gets a camera walk only with
≥2 focal zones + spatial narration.

**Concrete visual direction (canonical for LEARNINGS §23):** Vague phase
descriptions ("defocused ocean backdrop, kinetic word slam") give creative
INTENT but not concrete DIRECTION — the producer then improvises wildly.
Each phase in the ontology MUST specify, at `target_phases` granularity:
- `narration_text` — the EXACT words the narrator says during this phase
- `whisper_start_ms` / `whisper_end_ms` — from whisper timestamps
- `visual_depiction` — concrete, unambiguous description of what the viewer
  SEES (not creative intent, not on-screen text)
- `image_source` — a real image file (checked for existence) or
  "generate: [prompt]"
- `image_style` — a named style from the project's style set; the image
  style per phase is a CREATIVE DIRECTION decision locked in the ontology,
  not a producer decision
- `template`
The producer should NOT need to "figure out" what to show.

**Real images mapped at ontology level (canonical for LEARNINGS §24):** Real
images ALWAYS take priority over AI-generated when they match the subject.
The ontology writer must read `image_manifest.md` (when the project has real
imagery), list matching real images per scene, assign them to specific
phases, and mark phases "generate" only when no real image matches. Track
recurring entities and note reference-image chains in the briefs (§48,
illustrated-plate.md).

Write `ontology.yml` to the project directory.

### Step 4: Define Theme

Use `palette_preset` from ontology to write `<project>/remotion/src/theme.ts`:

```typescript
export const PALETTE = { bg, primary, secondary, accent, text, textMuted };
export const FONTS = { heading, body, mono };
export const MOTION = { springSnappy, springBouncy, springHeavy, springOverdamped };
```

### Step 5: Write project.json

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

### Step 6: Creative Direction (all scenes)

**Read these in order:**
1. `ontology.md`
2. Chosen style file
3. `editorial-design.md` → §11b "Restraint / sensibilities" (folded from the
   retired restraint.md)
4. `composition-templates.md`
5. `creative-direction.md`

For EACH scene:

1. **Check ontology constraints** — template, budget, weight, max_elements are HARD LIMITS
2. **Read in context** — story position, previous/next scenes
3. **Find core idea** (5 words) — match ontology's `core_idea`
4. **Find visual metaphor** — MUST be concrete physical scene, not UI terms
5. **Plan phases** — group words at sentence boundaries, derive durations from whisper timestamps
   - Target 5-7 seconds per phase (150-210 frames)
   - HARD MINIMUM: 150 frames. Merge sub-150f phases with neighbors.
   - Phase count = `ceil(duration_seconds / 6)`
6. **Assign treatment per phase** — template, background, entrance, drift
7. **Intensity layering** — run 6-question checklist from creative-direction.md
8. **Write brief to file** — `briefs/<SceneId>_brief.yml`

**Gates before proceeding:**
- Metaphor gate: No UI terms (cards, panels, badges, dashboards). Must be physical.
- Restraint gate: Pattern count, element count, velocity, font sizes, word count within limits.
- Text-karaoke check (LEARNINGS §25): Visuals must ADD to audio, not repeat it.
- Mute test: Does each image phase communicate something without audio?

### Creative Brief File Format

```yaml
scene: Scene_XX
core_idea: "five words here"
approach: generated-backdrop
techniques: [clip-path-reveal, speed-remap]
weight: supporting
emotional_beat: tension

phases:
  - id: 1
    duration_frames: 142
    template: focal-offset
    background: image
    asset: s04_factory.png
    text_overlay: "$2.1B — but where?"
    entrance: spring-slam
    drift: zoom-in
  - id: 2
    duration_frames: 158
    template: centered-hero
    background: solid
    text_overlay: null
    entrance: fade
    drift: stillness

template_distribution:
  focal-offset: 3
  centered-hero: 2
  split-compare: 1

assets_needed:
  images:
    - file: s04_factory.png
      prompt: "empty factory floor, cinematic lighting, no text"
      aspect_ratio: "1:1"
  videos:
    - file: s04_reveal.mp4
      prompt: "aerial view of industrial zone"

palette_emphasis: [primary, accent]
contrast_with_previous: "previous was kinetic text only, this opens with image"
contrast_with_next: "next is data-heavy, this is atmospheric"

rejected_alternatives:
  - approach: kinetic-typography
    reason: "no numbers to slam, narrative scene"
```

## Handoff to Producer

Once ALL artifacts exist (ontology, theme, project.json, all briefs, audio files, scaffold), the pre-production agent is done. The producer agent takes over for scene-by-scene production.

Output a summary:
```
PRE-PRODUCTION COMPLETE
  Scenes: N
  Style: editorial-clean
  Palette: editorial
  Briefs: N/N written
  Total duration: Xs
  Ready for producer agent.
```
