# Motion Doctrine — Three Acts Per Phase

Validated in production (PL-15 v2 pilot, 2026-07). This doctrine is what
separates "clean slideshow" from broadcast-quality motion. It applies to
EVERY phase in every scene.

## The rule that matters most: nothing is ever fully static

The #1 amateur tell in rendered output is the static hold: elements spring in
during the first ~30 frames of a phase, then NOTHING moves for 5–8 seconds.
With the phase-duration floor (LEARNINGS §19), most of a video's runtime IS
the hold — so the hold must live.

Every phase has three acts:

### Act 1 — Entrance (first ~18–30 frames)

- Staggered by hierarchy: label → rule → headline → body (or the scene's
  equivalent reading path).
- Editorial/elegant beats use long-tail bezier ease-outs (`EASING.out`,
  `EASING.outSoft` from theme.ts) — the keynote settle.
- **Springs are reserved for impact beats only** (stat slams, payoff
  reveals). Springs-for-everything produces a samey bouncy feel; choose
  overshoot deliberately, not by default.

### Act 2 — Ambient idle (the hold)

- The phase canvas gets a slow continuous push: `ambientScale(frame,
  {from: 1, to: 1.03–1.04, over: phaseDuration})` — or a slow Ken Burns on
  imagery (`scale 1.02 → 1.08` over the phase, `EASING.drift`,
  transformOrigin on the subject).
- Key elements may add `breathe()` (±0.4% scale, ~120f period) or `driftY()`
  (±4–8px, ~240–260f period) — give each element a different `phase` offset
  so motion never syncs up.
- Diagrams get continuous life: ring rotation via dash-offset, radar sweeps,
  breathing radii, counter ticks. A held diagram with zero internal motion is
  a static hold with extra steps.

### Act 3 — Exit (last ~12–16 frames BEFORE the transition window)

- Exits ACCELERATE away: `EASING.in`, never ease-out.
- Exit duration ≈ 60% of entrance duration.
- Reverse hierarchy order: body leaves first, headline last.
- Exits must COMPLETE before the 18f transition begins — schedule
  `exitStart = phaseDuration - 32` so `exitStart + exitDur` lands before the
  transition window opens.
- Use `exitP()`/`holdOpacity()` from motion-utils.
- **Breathe through narration pauses (LEARNINGS §42):** true silent gaps
  between phases are impossible (phase starts pin to Whisper word starts), so
  the breathing comes from the exit itself — let the exit choreography play
  through the narrator's natural sentence pause at the phase boundary. A
  static hold that slams into the next phase is a hard fail; the last thing
  the viewer sees before a transition is motion, never a freeze.

## Text state changes: never crossfade in place

If a text block changes content at the same screen position, the old block
must FULLY exit (opacity 0) before the new one enters — or the two must
occupy clearly different positions. In-place crossfades ghost the outgoing
text under the incoming text mid-transition. This caused two visible
collisions in the v1 PL-15 render.

For changing numbers, prefer ONE element that counts (interpolate the value,
`fontVariantNumeric: 'tabular-nums'`, `EASING.inOut`, ~40f) over swapping two
static labels.

## Motion blur on fast moves

Any translate faster than ~15px/frame strobes at 30fps. Apply
velocity-proportional blur via `velocityBlur()` from motion-utils:

```tsx
const y = (f: number) => interpolate(f, [0, 18], [640, 0], {easing: EASING.out});
const blur = velocityBlur(y, frame);
<div style={{ transform: `translateY(${y(frame)}px)`,
              filter: blur > 0.5 ? `blur(${blur}px)` : undefined }}>
```

## Banned tropes (hard bans — no exceptions)

- **Typewriter reveals with a visible caret.** Frames get sampled — viewers
  see half-typed nonsense. Use masked/clip-path word reveals or staggered
  word entrances instead.
- **`textShadow` glow on text.** Reads as amateur instantly.
- **In-place text crossfades** (see above).
- **Spring bounce on elegant editorial beats** (springs = impact only).
- **CSS `transition:` properties** — meaningless in Remotion renders; all
  motion must be frame-driven.

## Backgrounds are never one flat hex

Flat single-hex fills are the "digital flat" look. Every solid background
gets:
1. Base fill from a tonal ramp (`RAMP.navy[*]` / `RAMP.cream[*]` in theme.ts)
2. A subtle radial or linear ramp — 2–5% luminance difference (e.g.
   `RAMP.navy[2]` center → `RAMP.navy[0]` edges)
3. Film grain (FILM_GRAIN_SVG) at 3–4% opacity
4. Shadows tinted with the background hue (`RAMP.shadowOnCream` /
   `RAMP.shadowOnDark`) — never pure black.

## Dead-void activation

Content should command the frame (~40–60% of frame area for hero beats,
tightly grouped). Where a large region must stay empty, activate it quietly:
hairline rules, grid ticks, or a ghosted oversized numeral/word at 3–6%
opacity. Keep the bottom 20% (subtitle zone) and top-right (logo) clear.

## Hierarchy law: the payoff is never smaller than the setup

If a phase sets up ("THE RESULT?") and a later phase pays off ("A HANDFUL OF
KILLS."), the payoff must be AT LEAST as large as the setup — usually the
biggest type moment in the scene (display weight 800–900, ≥110px). The v1
PL-15 render inverted this and the climax evaporated.

## Modern vector language (v3 — validated PL-15)

Hairlines and flat SVG are the second great amateur tell after the static
hold. Every diagram stroke and chart element must use the v3 token system
from `motion-utils.ts`.

### Primary strokes — core + halo via `strokeGlow()`

Never hairlines. Every path or stroke the viewer is meant to READ gets the
dual-stroke treatment: a broad, blurred halo under a crisp core:

```tsx
import { strokeGlow } from '../motion-utils';
const sg = strokeGlow(PALETTE.electric);
// Render the path TWICE — halo first, then core on top:
<path d={pathD} {...sg.halo} fill="none" />
<path d={pathD} {...sg.core} fill="none" />
```

This produces a 22px halo at 22% opacity + blur, with a 6px core at 95%
opacity — readable on dark AND light backgrounds.

**Glow is REQUIRED on diagram strokes over dark backgrounds.**
The text-glow ban (textShadow) remains in force — glow is for SVG/vector
geometry, never for rendered type.

### Sizing — diagrams command the frame

A focal diagram is not a thumbnail. It should command ≥ 50% of frame height.
A ring system, kill-chain network, or engagement geometry that occupies a
postage-stamp footprint in a 1920×1080 frame communicates nothing.
Scale to fill. Viewers are watching on large screens.

### Chart bars — `barFill()`

```tsx
import { barFill } from '../motion-utils';
<div style={{ ...barFill(data.color), width: BAR_WIDTH, height: barHeight }} />
```

Gradient fill (top → darkened bottom) + inner top highlight + shadow glow.
A bar without this treatment looks like a colour swatch, not data.

### Gridlines — `gridline()`

```tsx
import { gridline } from '../motion-utils';
<div style={{ ...gridline(PALETTE.primary), position: 'absolute', left: 0, right: 0 }} />
```

The ONLY sanctioned thin element — 2px at 18% opacity. Use nowhere else.

### What is banned

- `strokeWidth` < 3px on any primary diagram element
- `height: 1` or `height: 1px` on anything other than gridlines
- Flat single-colour fills on bars (`background: color` without gradient)
- Manual per-element blur on strokes instead of `strokeGlow()`

## Required infrastructure

Scenes implementing this doctrine need `theme.ts` to export `EASING` and
`RAMP`, and `src/motion-utils.ts` (ambientScale, breathe, driftY, enterP,
exitP, holdOpacity, velocityBlur, strokeGlow, barFill, gridline). All ship
in the remotion template. Do not reimplement these per scene.
