# Scene — Single Scene Generation

## Trigger
User wants to generate/regenerate a single scene.

## Input
- Scene text
- Audio file + duration (or duration in frames)
- Theme (use current theme.ts)
- Optional: specific technique preference

## Steps

### Step 1: Creative Direction
**Read `~/.claude/skills/Remox/skills/guidance/creative-direction.md` first.**

Work through the six questions:
1. **Context**: Where is this scene in the story? What came before, what comes after?
2. **Core idea**: What is the ONE thing this scene communicates? (5 words)
3. **Visual metaphor**: What image/object/arrangement makes this idea visible?
4. **Moves**: How many visual beats? What enters, transforms, exits?
5. **Weight**: Hero, supporting, or connective?
6. **Neighbors**: Does this contrast with the previous/next scene?

Write the Creative Brief before proceeding.

### Step 2: Select Cookbook Skills
Read `~/.claude/skills/Remox/skills/guidance/editorial-design.md`, then select 3-5 skills from:
- `~/.claude/skills/Remox/skills/guidance/`
- `~/.claude/skills/Remox/skills/cinematic/`
- `~/.claude/skills/Remox/skills/utilities/`
- `~/.claude/skills/Remox/skills/examples/`

### Step 2b: Verify Metaphor — No UI Components

Before proceeding, verify your scene concept depicts a visual metaphor through illustrated objects, not UI components. If your scene contains pill badges, card layouts, dashboard grids, progress bars, colored panel backgrounds, or boxShadow treatments, return to Step 1 and find a physical metaphor. Ask: "What physical object or scene embodies this idea?" The answer must be a concrete noun from the physical world — a factory, a battery, a pipeline, a vessel — not a UI pattern.

### Step 3: Compose Scene Brief
Follow the Scene Brief format from Produce workflow. Include the Creative Direction section.

### Step 4: Write Scene Code
Write `<project>/remotion/src/scenes/Scene{NN}.tsx` (LOCAL project directory,
not the skill template). If the project directory has not been scaffolded yet,
run `node ~/.claude/skills/Remox/remotion/scaffold.mjs <project-dir>` first.

The component must:
- Import `{ PALETTE, FONTS, MOTION }` from `../theme`
- Use `useCurrentFrame()` and `useVideoConfig()`
- Return `<AbsoluteFill>` as root
- Fill the exact frame duration
- Use cookbook patterns where appropriate
- Mark new patterns with `// NEW_PATTERN: description`

### Step 5: Run pipeline.mjs

```bash
# Run the full pipeline for this scene
node ~/.claude/skills/Remox/remotion/pipeline.mjs project.json --scene SceneNN
```

Pipeline auto-runs audiosync (frame math correction), mechanical audit,
and visual preview before rendering. See Produce.md for the full stage list
and how to handle the preview gate (exit code 3).

If validation or audit fails:
1. Read the error message from pipeline output
2. Fix the scene code
3. Retry from the failed stage: `--from tsx` or `--from audiosync`
4. If still failing after 3 attempts, report error to user

### Step 6: Render (if requested)
```bash
# Render runs automatically as the final stage of pipeline.mjs.
# Standalone render (after all gates pass):
node ~/.claude/skills/Remox/remotion/render.mjs project.json output.mp4
```
