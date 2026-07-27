# Video Production Ontology

Standardized intermediate representation. ALL inputs — scripts,
topics, bullet points, single sentences — MUST be converted to
this structure BEFORE creative direction begins.

STOP: Do not proceed to creative direction without a complete
ontology document. Every field must be filled.

## Mandatory Inputs for Ontology Creation

Before writing the ontology, you MUST read:

1. The 7 guidance files (composition-templates, creative-direction, editorial-design — incl. §11b "Restraint / sensibilities", sound-design, illustration-style, typography-animation, this file)
2. **`LEARNINGS.md`** — the slim rule index; production rules OVERRIDE theoretical guidance. Follow its pointers, especially:
   - §15: AudioSync phase duration formula — derive from Whisper, never estimate (SKILL.md → Audio-Sync Phase Timing)
   - §19: Phase count target `ceil(duration_seconds / 6)`, 150f hard floor (SKILL.md → Phase Pacing)
   - §20: This requirement itself
   - §21: Image density targets per scene weight class (pre-production.md)
   - §22: India map border requirements (illustrated-plate.md)
3. The full script text
4. Audio files (for duration via ffprobe)
5. Style and palette choices from the user

## Why This Exists

Without a normalized structure, the creative pipeline receives
raw text and improvises layout, pacing, and palette per-scene
with no global coherence. The ontology forces global decisions
first, then constrains per-scene creativity within those bounds.

## The Ontology Document

Write this as a fenced YAML block in the project directory
as `ontology.yml` before any scene work begins.

```yaml
project:
  title: "Video Title"
  duration_seconds: 120        # total estimated
  aspect_ratio: "16:9"         # 16:9 | 9:16 | 1:1
  fps: 30
  style: editorial-clean       # editorial-clean (default) | cinematic-dense
  palette_preset: editorial    # editorial | dark-cinematic | vibrant | muted | monochrome

narrative_arc:
  - act: 1
    purpose: hook              # hook | build | climax | resolve
    scenes: [1, 2]
  - act: 2
    purpose: build
    scenes: [3, 4, 5]
  - act: 3
    purpose: climax
    scenes: [6, 7]
  - act: 4
    purpose: resolve
    scenes: [8]

scenes:
  - id: Scene01
    act: 1
    voiceover_text: "..."
    duration_frames: 126
    duration_seconds: 4.2
    target_phases: 1            # REQUIRED: ceil(duration_seconds / 6)
    core_idea: "five words max here"
    emotional_beat: tension     # tension | release | neutral
    visual_plan:
      composition_template: centered-hero  # see composition-templates.md (8 templates)
      weight_class: supporting # hero | supporting | connective — creative vocabulary, not a budget
      image_density: medium    # REQUIRED: high (70%+) | medium (50%+) | low (30%+)
                               # hero → high, supporting → medium, connective → low
      palette_emphasis:
        - primary
        - accent
    available_real_images:     # REQUIRED: list from image_manifest.md
      - real/real_example.jpg
    phases:                    # REQUIRED: one entry per target_phase, at full granularity
      - id: 1
        narration_text: "exact words narrator says"
        whisper_start_ms: 0
        whisper_end_ms: 4500
        duration_frames: 135
        visual_depiction: "concrete description of what the viewer sees"
        image_source: "real/real_example.jpg"  # or "generate: [prompt]" or "none" for text-only
        image_style: cinematic-photorealistic  # see LEARNINGS.md §23 for valid styles
        template: focal-offset  # from composition-templates.md
        background: image       # image | solid-cream | solid-navy | solid-dark
    sound_design:              # optional — omit for silent scenes
      - sfx: whoosh            # whoosh | impact | rise | reveal | ambient | transition | click
        trigger: entrance      # entrance | impact | transition | ambient
        volume: 0.4

continuity:
  transitions:
    - from: Scene01
      to: Scene02
      type: cut                # cut | crossfade | wipe | match-cut
  color_flow: "warm → cool → warm"
  pacing_rhythm: "slow-build → accelerate → breathe → peak → resolve"
```

## Conversion Rules

### From a Full Script + Audio Files

1. Run `ffprobe` on each audio file for duration
2. Match script sections to audio files
3. Identify narrative arc from content analysis
4. For each scene, extract core idea (5 words)
5. Assign emotional beats based on story position
6. Select composition templates based on content type
7. Assign weight classes for creative rhythm: 1-2 hero, most supporting, 1-2 connective
8. Choose palette preset from content tone

### From a Topic or Bullet Points

1. Generate narrative arc first (hook/build/climax/resolve)
2. Estimate scene count and durations
3. Write placeholder voiceover text per scene
4. Follow steps 4-8 above

### From a Single Sentence

1. Expand into 4-act narrative arc
2. Generate 6-10 scenes with estimated durations
3. Follow full conversion above

## Visual Approach Selection (Before Template)

Before choosing a composition template, choose the visual
approach. The hierarchy (in order of preference):

1. **Kinetic typography** — for arguments, claims, stats,
   emotional peaks, any scene with a strong verbal hook
2. **Data visualization** — for numbers, trends, comparisons
3. **Photo collage / duotone** — for real-world subjects
3b. **Generated backdrop** — AI-generated atmospheric images
   as phase backgrounds (hero scenes, establishing shots).
   Generate via ImageGen instant mode, up to 5 in parallel.
   Alternate with clean typography phases. See `generated-backdrop.md`.
4. **Annotated overlay** — for explaining parts of a system
5. **Editorial cards** — for news events, announcements
6. **Map-based** — for geopolitics, trade, geography
7. **Flat simplified SVG** — LAST RESORT when nothing above
   works. Keep it minimal (under 10 paths per object).

See `editorial-design.md` Section 4 for full hierarchy and
`creative-direction.md` Step 2b for approach details.

## Composition Template Assignment

| Content Type | Default Template | Alternatives |
|-------------|-----------------|--------------|
| Single stat or reveal | centered-hero | focal-offset |
| Asymmetric emphasis, editorial feel | focal-offset | centered-hero |
| Comparison (A vs B) | split-compare | stacked-reveal |
| Multi-item comparison (4+) | grid | stacked-reveal |
| Process or sequence | panoramic-flow | stacked-reveal |
| Emotional moment | centered-hero | lower-third, focal-offset |
| List or enumeration (2-3 items) | stacked-reveal | orbit |
| Feature grid or category breakdown | grid | stacked-reveal |
| Transition or setup | lower-third | centered-hero |
| Geography or map | focal-offset | centered-hero, split-compare |

## Weight Classes as Creative Vocabulary

Weight classes describe the **creative intent** of a scene —
how much visual attention it deserves — not a numeric budget.

- **Hero**: The moments the viewer remembers. Climax beats,
  emotional peaks, central revelations. Go big.
- **Supporting**: The workhorses. Professional, clear, well-
  animated. Carries the narrative.
- **Connective**: Breathing room. Simple, quiet, minimal.
  Lets the viewer rest between bigger moments.

Hero scenes naturally land on act 3 (climax) beats.
Connective scenes naturally land on act transitions.
Use your judgment on how many of each — the video should
have rhythm, not uniformity.

## Sound Design Assignment

During ontology conversion, assign SFX per scene based on
content. See `sound-design.md` for full category reference.

| Scene Type | Default SFX | Notes |
|-----------|-------------|-------|
| Hero + stat reveal | impact (0.5-0.8) | Sync to landing frame |
| Element entrance | whoosh (0.3-0.5) | Sync to spring start |
| Phase transition | transition (0.4-0.6) | At Series boundary |
| Tension build | rise (0.2-0.4) | Gradual under voiceover |
| Environmental | ambient (0.1-0.2) | Loop, barely perceptible |
| Connective / text-only | none | Silence creates contrast |

**Default is no SFX.** Only add when sound reinforces the
visual beat.

## Validation Checklist

Before proceeding to creative direction, verify:

- [ ] Every scene has all fields populated
- [ ] Act structure covers hook → build → climax → resolve
- [ ] Palette preset is explicitly chosen (not defaulted)
- [ ] Continuity section specifies transition types
- [ ] Color flow and pacing rhythm are documented
- [ ] Sound design assigned where appropriate (not every scene)
- [ ] `target_phases` computed for every scene: `ceil(duration_seconds / 6)`
- [ ] `image_density` set for every scene (hero=high, supporting=medium, connective=low)
- [ ] Phase concepts in ontology match `target_phases` count (not 2-3 coarse concepts for a 20-phase scene)
- [ ] LEARNINGS.md was read before writing the ontology
- [ ] **No text-karaoke**: Every image phase's `visual_depiction` describes what the viewer SEES (a photo, diagram, map), not what text appears on screen. Text overlay is minimal (name, date, stat) — not a transcript of narration.
- [ ] **Text-only phases are rare**: Max 2-3 per scene, reserved for maximum dramatic emphasis only
- [ ] **The mute test**: If you mute the audio, does each image phase's visual alone tell you something?
