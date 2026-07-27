# Pipeline Traps — Engineering Rules for Render/Audit Runs

**Read this BEFORE running the pipeline.** Mandatory for the producer agent and
any agent invoking `pipeline.mjs`, `render.mjs`, `validate.mjs`, `audit.mjs`,
or `audiosync.mjs`. Every rule here was learned from a production failure —
section numbers (§) refer to the LEARNINGS.md index.

---

## Project start — clear previous artifacts (§35a)

Starting a new project without clearing the previous one's artifacts causes
silent failures: wrong audio playing, "Scene not found" renders, stale images.
MANDATORY before any preproduction steps for a new project:

```bash
# 1. Clear skill template scenes
rm -f ~/.claude/skills/Remox/remotion/src/scenes/Scene_*.tsx

# 2. Clear skill template audio
rm -f ~/.claude/skills/Remox/remotion/public/audio/scene_*

# 3. Clear skill template images (keep logo.png)
find ~/.claude/skills/Remox/remotion/public/images/ -name "s[0-9]*" -delete 2>/dev/null

# 4. Clear webpack cache
rm -rf /var/folders/bv/*/T/remotion-*

# 5. Clear old renders
rm -rf ~/.claude/skills/Remox/remotion/output/scenes/

# 6. Reset SceneRegistry
echo "const registry: Record<string, React.FC> = {}; export default registry;" > ~/.claude/skills/Remox/remotion/src/SceneRegistry.ts
```

(With §36 project-tree resolution, the skill template only matters for legacy
projects — but stale template artifacts have caused enough silent failures
that the cleanup remains mandatory.)

## Source-tree resolution + version mixing (§36 — root fix for §35)

In the PL-15 v2 pilot, three agents edited project-tree scene files while all
audits and renders silently used the skill-template copies (old code). Stills
showed NEW code while rendered MP4s showed OLD code — both "passed". Two full
render cycles were wasted.

The fix, now in the tooling:

1. All pipeline scripts prefer `<projectDir>/remotion/` as the source tree.
   `render.mjs`/`validate.mjs` print `Source tree: <path>` — **CHECK THIS
   LINE in every render log.**
2. `render.mjs`/`validate.mjs` load `@remotion/bundler` + `@remotion/renderer`
   via `createRequire` FROM THE TREE BEING BUNDLED. Mixing the skill's bundler
   with a project's modules throws webpack "export not found" errors (e.g.
   `HtmlInCanvas`) whenever versions drift.

Rules:
- New npm deps used by scenes (e.g. `@remotion/google-fonts`) must be
  installed in the PROJECT's `remotion/node_modules` (scaffold's npm install
  handles this for new projects).
- Never verify visual changes from stills alone: after rendering, extract
  frames from the OUTPUT MP4 (`ffmpeg -ss <t> -i out.mp4 -frames:v 1 f.png`)
  at the moments you changed, and LOOK at them.

### Legacy projects only — skill-template sync ritual (§35)

For legacy projects WITHOUT their own scaffolded `remotion/`, the render
pipeline bundles from `~/.claude/skills/Remox/remotion/`, so every TSX/theme/
image change must be copied there and verified before rendering:

```bash
cp <project>/remotion/src/scenes/Scene_XX.tsx ~/.claude/skills/Remox/remotion/src/scenes/
cp <project>/remotion/src/theme.ts ~/.claude/skills/Remox/remotion/src/
rsync -av <project>/remotion/public/images/ ~/.claude/skills/Remox/remotion/public/images/
# VERIFY — hashes MUST match or the render uses wrong code:
md5 <project>/remotion/src/scenes/Scene_XX.tsx ~/.claude/skills/Remox/remotion/src/scenes/Scene_XX.tsx
```

For scaffolded projects this ritual is OBSOLETE — edit the project tree and
render.

## Stale audio in the render tree (§31)

The render bundles `public/audio/` from the source tree. If a previous
project left a `scene_02.mp3` with the same filename, the new project renders
with the OLD audio silently — same filename, different content. A video with
wrong audio is worse than no video: nothing in the pipeline flags it.

1. Sync ALL project audio into the render tree's `public/audio/` and delete
   stale scene audio beyond the current scene count.
2. Clean Remotion temp cache before re-rendering after ANY audio swap —
   the asset preprocessor caches audio even when the source file changes:
   ```bash
   rm -rf /var/folders/bv/*/T/remotion-*
   ```
3. **Post-render verification:** extract 5 seconds of audio from the output
   and transcribe (Whisper) to confirm it matches the expected narration:
   ```bash
   ffmpeg -y -i output/scenes/SceneXX.mp4 -t 5 -q:a 0 /tmp/check.mp3
   ```

## SceneRegistry — only .ts, never .tsx (§33)

TypeScript resolves `.tsx` before `.ts`. A stale hand-written
`SceneRegistry.tsx` from an old project silently shadows the pipeline's
auto-generated `SceneRegistry.ts` → `registry['Scene02']` returns undefined →
black "Scene not found" frames and a tiny output file.

1. Only `SceneRegistry.ts` may exist. Delete any `.tsx` variant.
2. The pipeline auto-generates it — never hand-edit.
3. Before rendering, verify: `grep "'Scene02'" <tree>/src/SceneRegistry.ts`
4. Delete stale scene files from previous projects.

**Post-render size check:** a healthy 1920×1080 scene with images renders at
roughly **0.8–1.0 MB per second**. A 120s scene at 5MB means blank frames —
check images exist, registry maps the ID, and `useCurrentFrame()` usage (§32).

## Series frame bug — useCurrentFrame() inside phase components (§32)

Passing the scene root's `frame` into Phase components gives the GLOBAL scene
frame, not the local phase frame. Inside `<Series.Sequence>`/
`<TransitionSeries.Sequence>`, Phase 3+ receive frame values far past their
local duration and render invisible (exit opacity already 0).

```tsx
// WRONG — Phase gets global frame, goes invisible after Phase 2
<Series.Sequence durationInFrames={200}>
  <Phase2 frame={frame} duration={200} />
</Series.Sequence>

// RIGHT — each Phase reads its own local frame
const Phase2: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame(); // local: 0..duration
  // ...
};
```

Never pass `frame` from the root to Phase components. The audit should flag
this pattern.

## Audit TSM regex needs INLINE transition timing (§46a)

`audit.mjs` parses transitions with
`/Transition[^>]*durationInFrames:\s*(\d+)/`. A shared
`const TRANSITION = linearTiming({...})` + `timing={TRANSITION}` parses as
ZERO transitions → TSM hard-fails "off by (N-1)×18". Write
`timing={linearTiming({ durationInFrames: 18 })}` inline on EVERY
`<TransitionSeries.Transition>`.

## AudioSync v2 fuzzy anchors can mis-map phases (§46b, §65)

audiosync v2 anchors phases by fuzzy-matching brief text to whisper words +
gap detection. It can mis-anchor (common words like "and more" match early)
and propose sub-150f phases that violate the §19 floor. When phase durations
are derived directly from whisper starts via the §15 formula and the TSM sum
checks out, TRUST THE FORMULA: skip stage 6 with `pipeline.mjs --from audit`
instead of accepting `--fix`'s rewrite.

**The fuzzy gap-anchor produces FALSE FAILURES when there are no large gaps
(§65).** Its "misaligned" report leans on detecting sizeable silence gaps
between phases; on tightly-narrated audio with no big gaps, it reports drift
that isn't there. Before accepting ANY `--fix` rewrite, verify against the
ACTUAL whisper word starts: pull the first word of each phase's narration from
the whisper JSON, compute its frame (`round(startMs/1000*30)`), and compare to
the phase's computed visible start (see below). If those line up, the tool is
crying wolf — do NOT apply `--fix`.

## Phase-duration math must compensate for transition overlap (§65)

With TransitionSeries, each Nf transition consumes Nf of OVERLAP: the incoming
phase becomes visible Nf frames BEFORE the outgoing sequence's nominal end. So
a phase's visible start is NOT `Σ(prior sequence durations)` — every prior
transition pulls it earlier:

```
phase[i] visible start = Σ(prior sequence durations) − Σ(prior transition durations)
```

Naive `Σ(durations)` accounting IGNORES the transition pull, and the error
**COMPOUNDS**: with 18f transitions, phase 2 is 18f early, phase 3 is 36f
early, … by the end of a many-phase scene the drift can reach several seconds,
silently desyncing every later visual from its narration. (The §15 formula
`dur[i] = whisperStart[i+1] − whisperStart[i] + TRANSITION_FRAMES` bakes the
per-phase compensation IN — the `+ TRANSITION_FRAMES` is exactly this overlap
correction, and the TSM check `Σ(dur) − (N−1)×18 = total` is its balance. The
trap is hand-computing a phase's on-screen moment while forgetting the
subtraction.) When you verify narration sync by hand (per §65 above), use the
visible-start formula, not `Σ(durations)`.

## H3 false positive: `bottom: 0` on image panels near text styles (§46c)

H3 flags any `bottom: <216` that has fontFamily/fontSize within ±10 lines —
including full-height image panel containers that contain no text. Use
`top: 0, height: 1080` instead of `top: 0, bottom: 0` for image panels, and
keep text style objects ≥10 lines away from panel style blocks.

## Pipeline temp-project path bug — fixed at root (§46d)

Pipeline stages 9/10 write a single-scene temp JSON to `<project>/output/`;
validate used to derive projectDir from that JSON's dirname and silently fall
back to the SKILL TEMPLATE tree (stale registry → "Scene not found").
`validate.mjs`/`render.mjs` now prefer the `projectDir` FIELD inside the
project JSON. **Keep `"projectDir": "/abs/path"` in every project.json.**

## Stale stills across runs (§46e)

`validate.mjs --audit` writes stills next to prior runs' files; after a
duration change the frame numbers differ and OLD stills linger (e.g. a
"Scene not found" still from before the scene was registered). ALWAYS check
still mtimes (`ls -t`) and only review the newest set.

## Stale-render trap — RENDER "success" can be an old file (§46g)

`pipeline.mjs` treats RENDER as passed if the output MP4 exists and is
>100KB — but if a hard audit failure blocked the render, the PREVIOUS run's
MP4 at the same path survives and reads as success. After every render,
verify the output file's MTIME is newer than the TSX that was supposed to
produce it. (Hit in the bright re-skin: an H5 failure blocked re-render and
old files silently persisted for three scenes.)

## Image verification — never Read multi-MB originals (§66)

Reading a multi-megabyte original image (a 4K plate, a full-res photo, a big
generated PNG) into context risks a stream stall or crash. ALWAYS downscale to
a ~1600px preview first, then Read the preview:

```bash
# make a lightweight preview next to the original
sips -Z 1600 -s format jpeg original.png --out /tmp/preview.jpg
# then Read /tmp/preview.jpg
```

For boundary/detail checks (map borders per maps.md §63, a face crop per
editorial-design.md §11.5, a small label's legibility per §59), **cut a TIGHT
CROP of the region and Read that** rather than squinting at a downscaled whole:

```bash
# crop a region (WxH+X+Y) from the original, then Read the crop
sips -c <H> <W> --cropOffset <Y> <X> original.png --out /tmp/crop.jpg
# or: ffmpeg -i original.png -vf "crop=W:H:X:Y" /tmp/crop.jpg
```

This applies to originals AND to render stills you need to inspect closely.
Preview-then-Read is the default; never point Read at a large original.

## Disk hygiene — webpack bundles and ENOSPC (§18, §40)

Remotion creates a ~500MB webpack bundle per render in the system temp
directory; 50+ renders accumulate 25GB+ of orphans. Every `bundle()` call
also copies the full `public/` assets into a temp dir — a 25-run production
day once filled the disk completely (ENOSPC; even shell commands failed).
`render.mjs`/`validate.mjs` now delete their own bundle temp dirs on exit,
but clean periodically during long sessions and before final render batches:

```bash
rm -rf /var/folders/bv/*/T/remotion-webpack-bundle-*
# if disk still fills: clear $TMPDIR/remotion* and stale $TMPDIR/react-* bundles
```
