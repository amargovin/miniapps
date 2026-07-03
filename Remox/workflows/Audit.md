# Audit Agent — Scene Quality Gate

The audit agent reads a scene's TSX source code and checks it against
hard rules (producer.md H1-H8) and creative guidance files. It outputs
a structured pass/fail report with specific fix instructions. The
producer spawns this agent after TSX is written (Step 4) and optionally
again after rendering (visual frame review).

## When to Spawn

The producer spawns the audit agent optionally for creative quality checks
that audit.mjs cannot do — H7 narration mapping and creative variety. Mechanical
audit (BRIEF/TMPL/COMP/H1/H3/H5/H8/TYP/TSM/AV), validate, and render are all
handled automatically by pipeline.mjs.

1. **Pre-render (source audit, optional)** — after TSX is written, before
   calling pipeline.mjs. Use when you want LLM review of H7 narration alignment
   or creative guidance (transition tonal matching, entrance sequencing, etc.).
2. **Post-render (visual audit, optional)** — after pipeline.mjs completes,
   using extracted frames. Catches issues only visible in the rendered output.

## Spawn Prompt Template

```
You are the Remox audit agent. Your job is to read the scene TSX and
check it against every rule and guideline, then output a structured
report. You do NOT fix anything — you report what's wrong and what
the producer should tell the engineer to fix.

SCENE: Scene_XX
PROJECT: /path/to/project.json
TSX: ~/.claude/skills/Remox/remotion/src/scenes/Scene_XX.tsx
AUDIO TIMESTAMPS: /path/to/audio/scene_XX_timestamps.json

Read these files:
1. The scene TSX
2. The audio timestamps JSON
3. project.json (for durationFrames)
4. ~/.claude/skills/Remox/skills/guidance/producer.md (Hard Rules H1-H8)
5. ~/.claude/skills/Remox/skills/guidance/composition-templates.md
6. ~/.claude/skills/Remox/skills/guidance/transitions.md
7. ~/.claude/skills/Remox/skills/guidance/creative-direction.md
8. ~/.claude/skills/Remox/skills/guidance/typography.md
9. ~/.claude/skills/Remox/skills/guidance/safe-zones.md
10. ~/.claude/skills/Remox/skills/guidance/spring-physics.md

Then run every check in the audit checklist below. Output the report
in the exact format specified.
```

## Audit Checklist

### HARD RULE CHECKS (any fail = must fix before render)

**H1 — Video Duration / playbackRate:**
- [ ] Every `OffthreadVideo` has a `playbackRate` prop
- [ ] Every `playbackRate` value is ≤ 1.0
- [ ] Every `OffthreadVideo` has a comment with the rate derivation
- [ ] No video phase exceeds 180f without playbackRate set

**H2 — TransitionSeries Math:**
- [ ] Extract all `durationInFrames` values from `TransitionSeries.Sequence`
- [ ] Extract all transition `durationInFrames` values
- [ ] Verify: `sum(phases) - sum(transitions) = durationFrames` from project.json
- [ ] If math doesn't balance, report the delta

**H3 — Reserved Zones:**
- [ ] Search for any element positioned in bottom 20% (bottom/top values that place content below 864px)
- [ ] Search for any element positioned in top-right corner
- [ ] Check `justifyContent: "flex-end"` without adequate bottom padding (needs ≥216px)

**H4 — TSX Structure:**
- [ ] Imports `TransitionSeries` from `@remotion/transitions`
- [ ] Imports `PALETTE, FONTS, MOTION` from `../theme`
- [ ] Top-level component wraps in `AbsoluteFill > TransitionSeries`
- [ ] Has `export default Scene_XX`

**H5 — Scene End Breathing Room:**
- [ ] Get last audio word end time from timestamps JSON
- [ ] Get last phase end frame from TSX
- [ ] Verify: last phase extends ≥30 frames beyond last audio word
- [ ] Report gap in frames and seconds

**H6 — Audio Strip:**
- [ ] Check if any `OffthreadVideo` src points to a file in `/video/`
- [ ] Flag as INFO: "Verify audio was stripped from: [filename]" (can't check from TSX alone)

**H7 — Narration Beat Alignment:**
- [ ] For each phase, identify which narration segment it covers
- [ ] Calculate phase start frame from cumulative durations
- [ ] Compare to narration start time from timestamps
- [ ] Flag any phase where visual starts >15 frames before its narration
- [ ] Report the delta for each flagged phase

**H8 — Scene Header Comment:**
- [ ] First line of file (after imports) contains template distribution comment
- [ ] Comment lists template names with counts
- [ ] No template exceeds 50% of total phases

### CREATIVE GUIDANCE CHECKS (any fail = should fix, producer decides)

**Composition (from composition-templates.md):**
- [ ] Each phase uses a named template (check component structure against known patterns)
- [ ] At least 2 different non-centered-hero templates appear
- [ ] At least 2 phases have editorial layouts (focal-offset or split-compare)
- [ ] No 3+ consecutive phases with same background type (solid/solid/solid)
- [ ] Asset map: no consecutive phases reuse the same image/video asset

**Typography (from typography.md):**
- [ ] Max 2 text elements per phase
- [ ] Heading text uses `FONTS.heading` (Georgia/serif)
- [ ] Body text uses `FONTS.body` (Inter/sans-serif)
- [ ] No font size below 28px; labels/eyebrows/mono ≥34px, stat sub-labels
      ≥36px, lower-third names ≥56px (LEARNINGS §43)
- [ ] Hero text ≥72px, body ≥36px

**Transitions (from transitions.md):**
- [ ] Transitions vary (not all fade or all wipe)
- [ ] Wipe directions alternate (not all from-left)
- [ ] Duration matches tonal shift (12f same-tone, 18f contrast, 24f medium, 30f major)

**Creative Direction (from creative-direction.md):**
- [ ] Visual variety: no 3+ consecutive same-treatment phases
- [ ] Camera drift varies between phases (not all zoom-in or all static)
- [ ] Style invariants: uses PALETTE colors, no UI patterns (dashboards, progress bars)

**Safe Zones (from safe-zones.md):**
- [ ] Text elements use title-safe margins (192px from edges) or SafeArea wrapper
- [ ] No text closer than 80px from any edge

**Entrance Animations (from spring-physics.md):**
- [ ] Elements enter sequentially, not simultaneously
- [ ] Spring configs use MOTION presets or reasonable custom values

**Phase Structure:**
- [ ] Total phases: 6-8 (flag if outside range)
- [ ] Per-type minimums: text ≥90f, image ≥100f, video ≥120f
- [ ] No phase exceeds 180f (6s) unless justified

## Report Format

```
AUDIT REPORT — Scene_XX
Generated: [timestamp]

═══════════════════════════════════════
HARD RULES                    [PASS/FAIL]
═══════════════════════════════════════

H1 Video/playbackRate:        [PASS/FAIL]
   [If FAIL: specific issue + fix instruction]

H2 TransitionSeries Math:     [PASS/FAIL]
   sum(phases)=Xf  sum(transitions)=Xf  net=Xf  expected=Xf  delta=Xf
   [If FAIL: which phases/transitions to adjust]

H3 Reserved Zones:            [PASS/FAIL]
   [If FAIL: which phase, which element, current position, where to move it]

H4 TSX Structure:             [PASS/FAIL]
   [If FAIL: what's missing]

H5 Breathing Room:            [PASS/FAIL]
   Last audio word ends: Xf (X.Xs)  Last phase ends: Xf  Gap: Xf
   [If FAIL: extend last phase by Xf]

H6 Audio Strip:               [INFO]
   Video assets found: [list]
   Reminder: verify audio stripped from each

H7 Narration Alignment:       [PASS/FAIL]
   Phase → Visual Start → Narration Start → Delta
   P1: frame X → narration at frame X → Xf early [OK/FLAG]
   P2: frame X → narration at frame X → Xf early [OK/FLAG]
   ...
   [If FAIL: which phases to delay or shorten preceding phase]

H8 Header Comment:            [PASS/FAIL]
   [If FAIL: what to add]

═══════════════════════════════════════
CREATIVE GUIDANCE             [PASS/WARN]
═══════════════════════════════════════

Composition:                  [PASS/WARN]
   Templates used: [list with counts]
   Distribution: [breakdown]
   [If WARN: specific suggestion]

Typography:                   [PASS/WARN]
   [If WARN: which phase, which element, current size → recommended size]

Transitions:                  [PASS/WARN]
   Types used: [list]
   [If WARN: which transitions to change]

Creative Direction:            [PASS/WARN]
   [If WARN: specific issue]

Safe Zones:                   [PASS/WARN]
   [If WARN: which element to reposition]

Entrance Animations:          [PASS/WARN]
   [If WARN: which phase has simultaneous entrances]

Phase Structure:              [PASS/WARN]
   Phase count: N  [OK/FLAG]
   Below-minimum phases: [list]

═══════════════════════════════════════
SUMMARY
═══════════════════════════════════════

Hard rule failures:    N
Creative warnings:     N
Verdict:               [PASS / FIX REQUIRED / REVIEW RECOMMENDED]

FIX LIST (ordered by priority):
1. [H-rule fix — must do]
2. [H-rule fix — must do]
3. [Creative fix — recommended]
...
```

## Post-Render Visual Audit

After rendering, the producer can also run a visual frame audit.
This extracts frames and checks what's actually on screen.

### Extract Frames

```bash
VIDEO="/path/to/scene_XX.mp4"
AUDIT_DIR="output/audit/Scene_XX"
mkdir -p "$AUDIT_DIR"

# Get duration
DURATION=$(ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 "$VIDEO")

# Extract 12 evenly-spaced frames
INTERVAL=$(echo "$DURATION / 12" | bc -l)
for i in $(seq 0 11); do
  TIMESTAMP=$(echo "$i * $INTERVAL" | bc -l)
  ffmpeg -y -ss "$TIMESTAMP" -i "$VIDEO" -frames:v 1 \
    "${AUDIT_DIR}/frame_$(printf '%02d' $i)_${TIMESTAMP%.*}s.jpeg" \
    2>/dev/null
done
```

### Visual Checks (review extracted frames)

- [ ] Text readable at 1080p (no text below 28px equivalent; label-class floors per LEARNINGS §43)
- [ ] No text in subtitle zone (bottom 20%) or logo zone (top-right)
- [ ] Clear focal point in each frame
- [ ] Content density within budget (≤45% editorial-clean, ≤60% cinematic-dense)
- [ ] Sufficient whitespace between elements (48px+ gaps)
- [ ] No planning metadata visible (scene numbers, act labels)
- [ ] Max 20 words on screen per frame (editorial-clean)
- [ ] Visual variety across frames (not all same layout)

## Mechanical Audit Script (MANDATORY — run FIRST)

Before any LLM-based audit, run the mechanical checker:

```bash
cd ~/.claude/skills/Remox/remotion && \
  node audit.mjs /path/to/project.json --scene SceneXX
```

This script catches hard rule violations with zero false negatives AND
writes `output/audit_result.json` which render.mjs uses as a gate:

**Artifact Gate Checks (new):**
- **BRIEF**: Creative brief file exists at `briefs/<SceneId>_brief.yml`
  — catches skipped creative direction
- **TMPL**: Every phase component has a template tag comment
  (`// Phase N | template: <name> | bg: <type>`)
- **COMP**: Composition variety — ≥2 unique templates, centered-hero ≤50%,
  no 3+ consecutive same template

**Hard Rule Checks (existing):**
- **H1**: Every `playbackRate` value ≤ 1.0
- **H3**: No text in bottom 216px (checks `flex-end` padding, `bottom:` values)
- **H5**: ≥30f breathing room after last audio word
- **H8**: Template distribution header comment present
- **TYP**: Every `fontSize` ≥ 24px
- **TSM**: TransitionSeries math balances exactly
- **AV**: Audio/video sync — phase boundaries track audio timeline

**The script exits non-zero if any hard rule fails.** All failures must
be fixed before proceeding to render.

**render.mjs reads `output/audit_result.json` and BLOCKS if verdict is FAIL.**
This is the enforcement mechanism — even if the producer agent tries to
skip audit, render will refuse. Emergency bypass: `--skip-audit-gate`.

The LLM audit agent handles checks the script cannot:
- H7 (narration-to-phase sentence mapping — requires content understanding)
- Creative guidance (transition tonal matching, entrance sequencing, etc.)

## Integration with Producer Pipeline

```
Pre-production:  Write creative brief → briefs/<SceneId>_brief.yml
Producer:        Write TSX (reads brief as primary input)
Producer:        Call pipeline.mjs --scene SceneXX
Pipeline:        Auto-runs: registry → audiosync → audit.mjs → preview → validate → render → log
```

The producer should update Step 4 sub-agent prompts to include:
"Your code will be audited by audit.mjs against BRIEF/TMPL/COMP/H1/H3/H5/H8/TYP/TSM/AV.
Read the brief file at briefs/<SceneId>_brief.yml as your primary input.
Every phase component needs a template tag: // Phase N | template: <name> | bg: <type>.
Use at least 2 different templates with centered-hero ≤50%.
Every OffthreadVideo needs playbackRate ≤ 1.0 with a derivation comment.
TransitionSeries math must balance exactly. No text in bottom 216px.
No fontSize below 28px (labels/eyebrows/mono ≥34px per LEARNINGS §43; the mechanical audit hard-blocks below 24px as a legacy backstop). render.mjs WILL BLOCK without a passing audit."
