# Pre-Production Agent — Project Setup & Creative Planning

The pre-production agent handles everything from raw user input to a complete set of creative briefs. Its output is the contract that the producer agent executes.

## Mandatory Reads

STOP: Read these files BEFORE any work. Actually read them — do not summarize from memory.

1. `~/.claude/skills/Remox/LEARNINGS.md` — **READ FIRST.** Hard-won production rules that override theoretical guidance. Contains phase count formula (§19), AV sync rules (§15), image treatment failures (§2-3), India map requirements (§22), visual-must-add-to-audio (§25).
2. `~/.claude/skills/Remox/skills/guidance/ontology.md`
3. `~/.claude/skills/Remox/skills/guidance/restraint.md`
4. `~/.claude/skills/Remox/skills/guidance/composition-templates.md`
5. `~/.claude/skills/Remox/skills/guidance/creative-direction.md`
6. `~/.claude/skills/Remox/skills/guidance/editorial-design.md`
7. `~/.claude/skills/Remox/skills/guidance/sound-design.md`
8. `~/.claude/skills/Remox/skills/guidance/illustration-style.md`
9. `~/.claude/skills/Remox/skills/guidance/typography-animation.md`

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
3. Pad with trailing silence (LEARNINGS §42 — MANDATORY, do this BEFORE measuring durations or running Whisper):
   ```bash
   ffmpeg -y -i audio/scene_XX.mp3 -af "apad=pad_dur=1.1" audio/scene_XX_padded.mp3 && mv audio/scene_XX_padded.mp3 audio/scene_XX.mp3
   ```
   Tail-only — NEVER prepend silence (it shifts every Whisper word timestamp). Skip only if the audio was already padded at generation time (voiceover.md does this).
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

**Plate-camera budget (illustrated-plate.md Proportion Policy):** plan 25–35% of
runtime as camera-walk phases (hard cap 40%), organised as 3–5 plate WORLDS per
~10 min. Assign worlds at ontology time; a photo gets a camera walk only with
≥2 focal zones + spatial narration.

**Concrete visual direction (LEARNINGS §23):** Each phase in ontology MUST specify `narration_text`, `visual_depiction`, `image_source`, `image_style`, `template`.

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
3. `restraint.md`
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
