# Produce — Full Video Pipeline

## Trigger
User wants to produce a cinematic video. They provide:
- Script text (full or per-scene)
- Per-scene audio files (MP3s) OR a single audio file to split
- Optional: theme preferences (colors, fonts, mood)

## Two-Agent Architecture

Production splits into two sequential agents:

1. **Pre-Production Agent** — project setup + creative planning (runs once)
2. **Producer Agent** — scene code + assets + pipeline (runs per scene)

Both agents MUST read the slim `LEARNINGS.md` rule index +
`motion-doctrine.md` before any work, then their ROLE-SCOPED mandatory-read
list: pre-production/creative agents read the list in
`skills/guidance/pre-production.md`; producer/pipeline agents read the list
in `skills/guidance/producer.md` (which includes
`skills/guidance/pipeline-traps.md` — mandatory before invoking
pipeline/render tools). LEARNINGS.md is an index — the canonical rule text
lives in the file each entry points to.

## Phase 1: Pre-Production

Run the pre-production agent. See `skills/guidance/pre-production.md`.

Inputs: user's script + audio files
Outputs: scaffold, ontology.yml, theme.ts, project.json, all briefs/*.yml, organized audio/

The pre-production agent handles:
- Scaffolding the remotion project
- Setting up audio files and calculating durations
- Style selection and ontology conversion
- Theme definition
- Creative direction for ALL scenes (writes brief.yml per scene)

**Gate:** Do NOT proceed to Phase 2 until ALL briefs are written and the pre-production agent reports complete.

## Phase 2: Production

Run the producer agent. See `skills/guidance/producer.md`.

### Parallelization

- **Default: SEQUENTIAL, always** — one scene at a time regardless of scene count. Pipeline preview gate PAUSES and shows keyframe stills before each render. The old ">5 scenes = parallel" auto-selection is retired (user override, July 2026): sequential production lets review feedback land before it compounds across scenes.

- **Parallel producer pattern** (one agent per scene, all concurrent, `--auto-approve` to skip the preview gate) is used ONLY when the user explicitly requests parallel production.

The producer agent handles per scene:
1. Read brief + context + LEARNINGS.md
2. Generate assets (images, videos)
3. Write TSX code
4. Call `pipeline.mjs` (handles whisper, audiosync, registry, audit, preview, validate, render, log)
5. Handle failures (fix + retry)

### Pipeline Stages (handled by pipeline.mjs)

```bash
# Per scene
node ~/.claude/skills/Remox/remotion/pipeline.mjs project.json --scene SceneXX

# All scenes (parallel mode)
node ~/.claude/skills/Remox/remotion/pipeline.mjs project.json --all --auto-approve
```

Pipeline runs 12 stages per scene:

| # | Stage | What it does | Gate |
|---|-------|-------------|------|
| 1 | Audio | Checks audio file exists | Hard |
| 2 | Whisper | Runs whisper_timestamps.py if missing | Hard |
| 3 | Brief | Checks brief.yml exists | Hard |
| 4 | Images | Checks all brief image assets exist | Hard |
| 5 | TSX | Checks scene .tsx exists | Hard |
| 6 | AudioSync | Runs audiosync.mjs --fix | Warn |
| 7 | Registry | Auto-generates SceneRegistry.ts | Auto |
| 8 | Audit | Runs audit.mjs (mechanical checks) | Hard |
| 9 | Preview | Renders keyframe stills | Gate (pauses unless --auto-approve) |
| 10 | Validate | Renders frame 0 | Hard |
| 11 | Render | Full scene render to MP4 | Hard |
| 12 | Log | Writes production_log.json | Always |

### Resuming after preview approval (sequential mode)

When pipeline exits with code 3 (preview ready):

```bash
# User approves stills
node ~/.claude/skills/Remox/remotion/pipeline.mjs project.json --scene SceneXX --from validate

# User requests changes — fix TSX, then:
node ~/.claude/skills/Remox/remotion/pipeline.mjs project.json --scene SceneXX --from audiosync
```

## Phase 3: Concat

After all scenes render:

```bash
node ~/.claude/skills/Remox/remotion/render.mjs project.json output.mp4
```

Or use ffmpeg concat if scenes were rendered individually.

## Phase 4: Report

```
PRODUCTION COMPLETE
  Total scenes: N
  Total duration: X seconds
  Failed scenes: N (list)
  Output: /path/to/output.mp4
```

## Cookbook Skill Selection Guide

Match scene characteristics to skills:

| Scene Characteristic | Primary Skills | Metaphor Approach |
|---------------------|---------------|-------------------|
| Hard statistic reveal | ripple-expand, charts, speed-remap | Battery draining, vessel filling, gauge swinging |
| Emotional narrative | particle-systems, camera-shake | Factory going dark, bridge crumbling |
| Comparison/contrast | split-screen, charts | Lit vs dark factory, full vs empty vessel |
| List/enumeration | typography, sequencing | Objects on shelf, pipeline stages |
| Dramatic transition | arc-wipe, dither-dissolve | Door opening, wall rising |
| Technical explanation | charts, 3d, typography | Cutaway, exploded diagram |
| Impact moment | ripple-expand, posterize-stutter | Crack spreading, valve slamming |
| Headline montage | card-flip-3d, typography | Newspapers piling, ticker scrolling |
| Building tension | tunnel-flythrough, particle-systems | Pipeline filling, cracks spreading |
| Editorial / documentary | editorial-design, typography | Environmental scenes, illustrated landscapes |
| Map / geography | editorial-design | Trade routes, country outlines |
