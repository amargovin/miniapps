# Illustrated Plate + Camera Move

**Validated in production: PL-15 v3 session (2026-07). User-approved.**

The canonical replacement for bespoke vector diagrams in scene-setting and
concept phases. A 4K textless AI illustration becomes the environment; a
cinematic camera visits focal zones in sync with narration. Text overlays
remain Remotion kinetic typography layered above.

---

## When to use

**USE for:**
- Engagement geometry (range rings, zones, kill radii)
- Tactical networks and kill chains
- Conceptual "world" phases where you want a living environment
- Any phase where a vector diagram was planned but the result would be
  thin SVG lines on a plain background

**DO NOT use for:**
- Data charts — use `charts.md` patterns (axis, bars, gridlines)
- Pure typography beats — kinetic text phases don't need a plate
- Phases where a real photo exists and matches the subject

---

## Plate generation workflow

1. **Use the ImageGen skill** (Nano Banana Pro / Gemini 3 Pro) to generate
   the plate at **4K resolution, 16:9 aspect ratio**.

2. **Prompt requirements (non-negotiable):**
   - Specify the exact colour palette with hex codes (e.g. `deep navy
     #0B1622, electric blue #5AA9FF, amber #C4873B, dark charcoal #151E2B`)
   - Describe 2–4 distinct **focal zones** that the camera will visit —
     name them in the prompt so the composition puts them where you expect
     (e.g. "outer engagement ring at the perimeter, mid-range ring at
     60% radius, close-in no-escape zone at centre")
   - Always append: **"Absolutely no text, no words, no labels, no
     numbers, no UI elements"** — this is the textless mandate; any label
     that bleeds into the plate will appear under the Remotion overlays
     and double-read

3. **Save the plate** to `public/images/plates/plate_<sceneId>_<name>.png`.

4. **Review the generated image** — check that the 2–4 focal zones are
   visually distinct and positioned roughly where you specified. Re-generate
   if all the visual interest is clustered in one region.

5. **Verify VECTORS, not just presence (user-flagged, PL-15 bright cut).**
   For any plate with directional action (a missile in flight, a sensor fan,
   a chase), the prompt must state each actor's FACING/DIRECTION explicitly
   ("nose pointed up-left toward the target jet", "exhaust trailing back
   down-right toward the shooter", "sensor fan sweeping left toward the
   target"). At review, check every vector: a regenerated kill-web plate once
   had the missile flying TOWARD the friendly early-warning aircraft —
   present-and-beautiful but narratively backwards. Wrong vectors invert the
   story; regenerate until every nose, plume, and beam points the right way.

---

## Coordinate estimation

After the plate is generated, **read/view the image** and estimate normalised
coordinates for each focal subject:

- `cx` = horizontal position of the subject as a fraction of image width
  (0 = left edge, 1 = right edge, 0.5 = centre)
- `cy` = vertical position of the subject as a fraction of image height
  (0 = top edge, 1 = bottom edge, 0.5 = centre)

Example: for `plate_s05_rings.png` the concentric rings sit at the visual
centre, so all phases use `cx: 0.5, cy: 0.47` (slightly above centre — the
rings have more space below than above in the composition).

For a plate with spatially separated focal zones, estimate independently:
- Zone A at top-left → `cx: 0.25, cy: 0.30`
- Zone B at centre-right → `cx: 0.68, cy: 0.55`

---

## Camera authoring — keyframe rules

```tsx
<IllustratedPlate
  src="images/plates/plate_s05_rings.png"
  cam={[
    { frame: 0,   cx: 0.5, cy: 0.47, zoom: 1.0  },
    { frame: 150, cx: 0.5, cy: 0.47, zoom: 1.45 },
    { frame: 300, cx: 0.5, cy: 0.47, zoom: 2.0  },
  ]}
/>
```

**Zoom cap:** keep zoom ≤ 2.0 on a 4K plate displayed at 1080p. 2.0× zoom
still gives 2K per-pixel resolution — plenty sharp. Above 2.0 the plate
starts to look soft.

**Easing:** the component interpolates between keyframes using `EASING.inOut`
automatically. You do not need to specify easing per keyframe.

**Ambient motion:** the component adds `breathe()` (±0.3% scale, 200f period)
and `driftY()` (±0.2%, 280f period) automatically when `ambient={1}` (the
default). Every hold is alive — you do not need to add ambient scale on top.

**Velocity blur:** fires automatically during fast camera moves. Keeps the
move from strobing at 30fps.

### Continuity across phases — one world, many beats

When multiple consecutive phases share the same plate, the end zoom of phase N
must equal the start zoom of phase N+1. This creates the illusion that the
camera never cuts — it just keeps moving:

```tsx
// Phase 4: 1.0 → 1.12
cam={[{ frame: 0, cx: 0.5, cy: 0.47, zoom: 1.0 }, { frame: 183, cx: 0.5, cy: 0.47, zoom: 1.12 }]}

// Phase 5: picks up at 1.12 → pushes to 1.55
cam={[{ frame: 0, cx: 0.5, cy: 0.47, zoom: 1.12 }, { frame: 120, cx: 0.5, cy: 0.47, zoom: 1.55 }]}

// Phase 6: picks up at 1.55 → pushes to 2.0
cam={[{ frame: 0, cx: 0.5, cy: 0.47, zoom: 1.55 }, { frame: 100, cx: 0.5, cy: 0.47, zoom: 2.0 }]}

// Phase 7 (hold): stays at 2.0, barely breathes
cam={[{ frame: 0, cx: 0.5, cy: 0.47, zoom: 2.0 }, { frame: DUR, cx: 0.5, cy: 0.47, zoom: 2.2 }]}
```

Reference: Scene_05 Phases 4–7, `plate_s05_rings.png`.

---

## Validated camera grammars

### Grammar 1 — Push-in per narration beat ("one world, many beats")

Each phase nudges the camera deeper into the same plate, matching a new
narration reveal. The viewer stays oriented in a familiar world but gets
progressively more intimate with each beat.

Use when: the scene has 3–5 consecutive phases revealing facts about
different sub-zones of the same diagram (e.g. range rings: outer → mid →
inner; network nodes: hub → subnet → endpoint).

### Grammar 2 — Tight-then-pull-wide reveal

Start the first phase zoomed in tight on the subject of interest (zoom 1.5–2.0,
cx/cy centred on the focal subject). Then pull wide in the same phase or the
next — revealing the full composition and the subject's place within it.

Use when: the opening narration names a specific element ("the no-escape zone")
and later narration zooms out to context ("...inside a much larger engagement
geometry"). The wide reveal IS the payoff.

Reference: Scene_04 Phase 3, `plate_s04_run.png` — starts tight on the right
quadrant (`cx: 0.75, cy: 0.42, zoom: 1.7`), holds, then pulls to wide
(`cx: 0.5, cy: 0.5, zoom: 1.0`).

---

## Text overlays

Text belongs in the phase component, **above** `<IllustratedPlate>` in the
JSX tree (higher stacking order). The plate is always the bottom layer.
Use absolute positioning, respect safe zones (no bottom 20%, no top-right).

The plate provides the environmental mood. Text provides the narration anchor.
They are independent layers — do not bake text into the plate prompt.

---

## Proportion Policy (adopted July 2026, from PL-15 production research)

Camera-walk phases stay special through contrast. Target **25–35% of video
runtime** as plate/photo camera-walk phases; **hard cap 40%**. Above that the
walk becomes the default look and the pull-wide payoff stops paying off.

Rules (count WORLDS, not phases):
1. **3–5 plate worlds per ~10-minute video.** Long consecutive runs on ONE
   world (up to ~8 phases) are fine only with camera continuity (end zoom =
   next start). Max 2 distinct plate worlds per scene.
2. **One pull-wide payoff per world** — it is the climax grammar; spend it once.
3. **A photo earns a camera walk (vs plain gentle KB)** only when it has ≥2
   distinct focal zones AND the narration references spatial structure.
   Single-subject photos keep ambient Ken Burns (1.02→1.08).
   Zoom caps: ≤1.4 on 2K photos, ≤2.0 on 4K — generate at 4K when the move
   needs more zoom.
4. **Data never gets a camera** — dense stat narration wants a stable frame
   (charts.md treatment). The final thesis beat stays solid typography.
5. **A solid/chart phase must interrupt every ~90s** of continuous imagery.
6. **Never two consecutive scenes both >50% plate** unless they form one
   narrative unit buffered by photo/solid phases at the joint.
7. Hero scenes: at most one full plate-journey scene per video; other hero
   scenes get a DIFFERENT signature (chart environment, split-compare).

---

## World-Pinned Labels (v2 — adopted July 2026)

Screen-fixed text blocks over moving imagery are the boring version of
image+text: two disconnected layers. DEFAULT to pinning labels to the
imagery's world instead — the label drifts and scales with the camera, so
text and image read as ONE world (AR-annotation feel).

`IllustratedPlate.tsx` exports the math:

```tsx
import { plateCameraState, plateToScreen } from '../IllustratedPlate';

const st = plateCameraState(frame, cam, 1);        // same cam array as the plate
const jet = plateToScreen(0.62, 0.55, st);         // subject at 62%/55% of image
<div style={{ position: 'absolute', left: jet.x, top: jet.y }}>…callout…</div>
```

Rules:
- Applies to ANY moving imagery — plates, full-bleed photos on camera walks,
  even gentle Ken Burns (drive the photo with the same `cam` keyframes and the
  pin follows). Not plate-exclusive.
- Screen-fixed text is reserved for genuine UI: eyebrow headers, condition
  stamps, source lines, counters. Everything that names a THING in the image
  should pin to that thing.
- Add a small connector rule (strokeGlow) from the pinned label to its subject
  when the label must sit offset for legibility.
- Clamp pinned labels to safe zones: if the camera pushes a pin into the
  bottom 216px or the top-right logo zone, offset the label and keep the
  connector pointing at the subject.
