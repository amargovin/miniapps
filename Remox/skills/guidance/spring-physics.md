# Spring Physics — Remotion 4 Reference

## `spring()` Signature

```ts
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

const value = spring({
  frame,           // current frame (offset by delay for sequencing)
  fps,             // from useVideoConfig()
  config: {
    damping: 10,       // resistance — higher = less oscillation
    stiffness: 100,    // tension — higher = faster/snappier
    mass: 1,           // inertia — higher = slower, heavier feel
    overshootClamping: false, // true = no bounce past target
  },
  durationInFrames: 30, // optional hard cap on animation duration
  reverse: false,       // true = play spring in reverse (exit)
  delay: 0,             // frame offset before spring starts
});
// returns 0→1 float
```

## Named Presets

```ts
const SPRINGS = {
  snappy:      { damping: 20,  stiffness: 200, mass: 1 },
  bouncy:      { damping: 8,   stiffness: 100, mass: 1 },
  heavy:       { damping: 15,  stiffness: 80,  mass: 2 },
  overdamped:  { damping: 200, stiffness: 100, mass: 1 }, // no bounce, eases in
};
```

## Spring as Input to `interpolate()`

Map the 0→1 spring output to any range:

```ts
import { spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const { fps } = useVideoConfig();
const frame = useCurrentFrame();

const progress = spring({ frame, fps, config: SPRINGS.snappy });

const y     = interpolate(progress, [0, 1], [60, 0]);    // slide up
const scale = interpolate(progress, [0, 1], [0.8, 1]);   // scale in
const opacity = interpolate(progress, [0, 1], [0, 1]);   // fade in
```

## Staggered Entrance — 5 Elements

```tsx
import { spring, interpolate, useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";

const STAGGER = 6; // frames between each element

const Item: React.FC<{ label: string; index: number }> = ({ label, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delayed = Math.max(0, frame - index * STAGGER);
  const progress = spring({ frame: delayed, fps, config: { damping: 18, stiffness: 180 } });

  const y = interpolate(progress, [0, 1], [40, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div style={{ transform: `translateY(${y}px)`, opacity, marginBottom: 16, fontSize: 48 }}>
      {label}
    </div>
  );
};

export const StaggeredEntrance: React.FC = () => {
  const items = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      {items.map((label, i) => (
        <Item key={label} label={label} index={i} />
      ))}
    </AbsoluteFill>
  );
};
```

## Sequential Choreography with `measureSpring()`

```ts
import { measureSpring } from "remotion";

// How many frames does this spring take to settle (within threshold)?
const duration = measureSpring({
  fps: 30,
  config: SPRINGS.snappy,
  threshold: 0.001, // default; lower = waits longer
});
// Use `duration` as the `from` offset for the next animation
```

## Exit Animations (Reverse Spring)

```ts
const exitStart = durationInFrames - 20;
const exitFrame = Math.max(0, frame - exitStart);
const exitProgress = spring({ frame: exitFrame, fps, config: SPRINGS.snappy, reverse: true });
// exitProgress goes 1→0 over the last 20 frames
```

## Gotchas

- `spring()` always starts from 0 and moves toward 1. Use `interpolate()` to map to your actual values.
- `delay` param shifts the start frame — equivalent to `Math.max(0, frame - delay)` manually.
- High `stiffness` with low `damping` = lots of oscillation. Keep `damping >= stiffness / 10` for readable motion.
- `overshootClamping: true` is required for opacity and scale animations where values above 1 look wrong.
- `mass` only meaningfully changes feel when `stiffness` is below 150. At high stiffness it barely matters.

---

## Remox Entrance Hierarchy

### Stagger to Show Visual Priority
Animate elements sequentially within a phase — never simultaneously.
When all elements enter at frame 0, the viewer has no hierarchy signal
and the composition feels flat.

**Standard entrance order and delay ranges:**

| Layer | Enters at | Examples |
|---|---|---|
| Badge / stamp / classification label | frame 0 | "MID-2024", "TRACKING ALERT" |
| Headline / hero number | frame 18–45 | "7.5 km/s", dominant stat |
| Context / supporting label | frame 50–100 | source attribution, units, explanatory text |

Adjust delays based on phase duration — a 90f text-only slam needs
tighter stagger (0 / 12 / 28) than a 150f editorial phase (0 / 30 / 60).

### Two-Beat Internal Structure
When two related ideas must share a phase (after a merge), use internal
beats rather than showing both simultaneously:

1. Beat 1 enters and holds (frames 0–100)
2. Beat 1 dims to `opacity: 0.5` as Beat 2 springs in (frames 100–130)
3. Beat 2 holds for the remainder

```tsx
// Beat 1 dims
const beat1Fade = interpolate(frame, [100, 130], [1, 0.5], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});

// Beat 2 enters
const beat2Enter = spring({
  frame: Math.max(0, frame - 100),
  fps,
  config: SPRINGS.snappy,
});
```

Never stack both beats at full opacity simultaneously — it reads as
two phases accidentally collapsed into one.
