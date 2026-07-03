# Spring Presets

Remotion's `spring()` function wraps a spring physics simulation. These four named configs cover the most common motion needs. Import them from the shared theme rather than hardcoding values per component.

---

## The Four Presets

### snappy
```ts
{ damping: 20, stiffness: 200 }
```
**When to use:** UI elements entering the screen, button pops, label reveals, icon entrances. Fast settle time (~18 frames). No overshoot. Feels responsive and intentional.

---

### bouncy
```ts
{ damping: 8, stiffness: 100 }
```
**When to use:** Playful card reveals, character introductions, emoji drops, product callouts. Pronounced overshoot creates personality. Settle time ~40 frames. Use sparingly — every element being bouncy reads as noise.

---

### heavy
```ts
{ damping: 15, stiffness: 80, mass: 2 }
```
**When to use:** Large objects moving into frame, infographic panels, hero images, full-screen transitions. The extra mass slows acceleration and gives a sense of physical weight. Settle time ~55 frames.

---

### overdamped
```ts
{ damping: 200, stiffness: 100 }
```
**When to use:** Smooth slides with no overshoot, progress bars, camera moves, scene fades. Critically damped — arrives at target and stops cleanly. Use when bounciness would feel wrong (data, financial charts, serious tone).

---

## Importing from theme.ts

`theme.ts` exports a `MOTION` object that contains all four presets. Always import from there — never inline raw numbers.

```ts
// theme.ts (reference — already defined for you)
export const MOTION = {
  snappy:      { damping: 20,  stiffness: 200 },
  bouncy:      { damping: 8,   stiffness: 100 },
  heavy:       { damping: 15,  stiffness: 80,  mass: 2 },
  overdamped:  { damping: 200, stiffness: 100 },
} as const;
```

```tsx
// Your component
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { MOTION } from '../theme';

export default function MyScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Snappy entrance for a UI label
  const labelScale = spring({
    frame,
    fps,
    config: MOTION.snappy,
    from: 0,
    to: 1,
  });

  // Heavy slide-in for a large panel
  const panelX = spring({
    frame,
    fps,
    config: MOTION.heavy,
    from: -1920,
    to: 0,
  });

  // Bouncy card pop
  const cardScale = spring({
    frame,
    fps,
    config: MOTION.bouncy,
    from: 0.8,
    to: 1,
  });

  // Overdamped progress bar fill
  const barWidth = spring({
    frame,
    fps,
    config: MOTION.overdamped,
    from: 0,
    to: 640,
  });

  return (
    // ... layout using labelScale, panelX, cardScale, barWidth
    <div />
  );
}
```

---

## Quick Reference Table

| Preset      | Damping | Stiffness | Mass | Overshoot | Settle (approx) | Best For                          |
|-------------|---------|-----------|------|-----------|-----------------|-----------------------------------|
| snappy      | 20      | 200       | 1    | None      | ~18 frames      | UI elements, quick entrances      |
| bouncy      | 8       | 100       | 1    | High      | ~40 frames      | Playful reveals, character moments|
| heavy       | 15      | 80        | 2    | Moderate  | ~55 frames      | Large objects, gravity feel       |
| overdamped  | 200     | 100       | 1    | None      | ~25 frames      | Smooth slides, serious content    |

---

## Notes

- All presets assume `fps: 30`. At 60fps, springs settle in roughly half the frame count — but the `fps` parameter in `spring()` handles this automatically.
- `from` and `to` defaults are `0` and `1` if omitted, giving a normalized 0→1 driver you can multiply by any pixel or opacity value.
- Chain springs by offsetting `frame` with `delay` (see `measure-spring-chain.md` for computed delays).
