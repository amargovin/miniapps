# Measure Spring Chain

When multiple elements need to animate in sequence, the naive approach is to hardcode frame offsets: element 2 starts at frame 20, element 3 at frame 45. This breaks the moment you adjust any spring config — the chain falls out of sync.

`measureSpring()` solves this by computing the exact frame count a spring needs to settle, so you can derive delays programmatically.

---

## API

```ts
import { measureSpring } from 'remotion';

const frames = measureSpring({
  fps: 30,
  config: { damping: 20, stiffness: 200 },
  from: 0,
  to: 1,
  threshold: 0.005, // optional — default is 0.005 (0.5% of range)
});
// returns a number: the frame at which the spring is considered settled
```

`threshold` controls what "settled" means. The default `0.005` means within 0.5% of the target value. Lower threshold = more precise but more frames. For visual animation, the default is almost always correct.

---

## The Pattern

```
element1 starts at frame 0
element2 starts at frame: measureSpring(spring1Config)
element3 starts at frame: measureSpring(spring1Config) + measureSpring(spring2Config)
```

Each element's delay is the cumulative sum of all preceding spring settle times.

---

## Full Example: 3-Element Choreographed Entrance

A title, a subtitle, and a call-to-action enter in sequence. Each waits for the previous spring to fully settle before starting.

```tsx
import {
  AbsoluteFill,
  measureSpring,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// --- Compute delays at module level (never inside the component) ---

const DELAY_TITLE    = 0;

const DELAY_SUBTITLE = measureSpring({
  fps: 30,
  config: MOTION.heavy,       // title uses heavy spring
  from: 0,
  to: 1,
});

const DELAY_CTA = DELAY_SUBTITLE + measureSpring({
  fps: 30,
  config: MOTION.snappy,      // subtitle uses snappy spring
  from: 0,
  to: 1,
});

// At 30fps with these configs:
//   DELAY_TITLE    → 0
//   DELAY_SUBTITLE → ~55 frames (~1.8s)
//   DELAY_CTA      → ~55 + 18 = ~73 frames (~2.4s)

export default function ChoreographedEntrance() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Element 1: Title — heavy entrance from below
  const titleY = spring({
    frame: frame - DELAY_TITLE,
    fps,
    config: MOTION.heavy,
    from: 80,
    to: 0,
  });
  const titleOpacity = spring({
    frame: frame - DELAY_TITLE,
    fps,
    config: MOTION.heavy,
    from: 0,
    to: 1,
  });

  // Element 2: Subtitle — snappy entrance from below, starts after title settles
  const subtitleY = spring({
    frame: frame - DELAY_SUBTITLE,
    fps,
    config: MOTION.snappy,
    from: 40,
    to: 0,
  });
  const subtitleOpacity = spring({
    frame: frame - DELAY_SUBTITLE,
    fps,
    config: MOTION.snappy,
    from: 0,
    to: 1,
  });

  // Element 3: CTA — bouncy scale-in, starts after subtitle settles
  const ctaScale = spring({
    frame: frame - DELAY_CTA,
    fps,
    config: MOTION.bouncy,
    from: 0,
    to: 1,
  });
  const ctaOpacity = spring({
    frame: frame - DELAY_CTA,
    fps,
    config: MOTION.bouncy,
    from: 0,
    to: 1,
  });

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}
    >
      {/* Element 1: Title */}
      <h1
        style={{
          fontFamily: FONTS.display,
          fontSize: 72,
          color: PALETTE.primary,
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
          margin: 0,
        }}
      >
        The Big Claim
      </h1>

      {/* Element 2: Subtitle */}
      <p
        style={{
          fontFamily: FONTS.body,
          fontSize: 32,
          color: PALETTE.secondary,
          transform: `translateY(${subtitleY}px)`,
          opacity: subtitleOpacity,
          margin: 0,
        }}
      >
        Supporting context that elaborates
      </p>

      {/* Element 3: CTA */}
      <div
        style={{
          background: PALETTE.accent[0],
          color: '#fff',
          fontFamily: FONTS.body,
          fontSize: 24,
          padding: '16px 40px',
          borderRadius: 8,
          transform: `scale(${ctaScale})`,
          opacity: ctaOpacity,
        }}
      >
        Learn More
      </div>
    </AbsoluteFill>
  );
}
```

---

## Why Not Just Add Frames?

```ts
// Fragile — breaks if you change MOTION.heavy
const DELAY_SUBTITLE = 55;

// Robust — always correct regardless of config changes
const DELAY_SUBTITLE = measureSpring({ fps: 30, config: MOTION.heavy, from: 0, to: 1 });
```

If you change `MOTION.heavy.stiffness` from 80 to 120, the first version leaves a gap or overlap. The second version recomputes automatically.

---

## Tips

- Always compute delays at **module level**, not inside the component. `measureSpring` is pure and cheap, but calling it inside a render function adds unnecessary work per frame.
- For overlapping animations (element 2 starts slightly before element 1 finishes), subtract a small buffer: `DELAY_SUBTITLE - 5`.
- `measureSpring` respects `fps` — pass `useVideoConfig().fps` if you're computing inside a hook rather than at module level.
- The returned value is a frame count (integer at `fps: 30`). It is the frame at which `spring()` first returns a value within `threshold` of the target.
