# Seeded Random

Remotion provides a deterministic `random()` function that replaces `Math.random()` for any values that must be consistent across renders. This is critical for particle fields, scattered layouts, and procedural geometry — if positions were truly random, every frame would look different.

---

## The Core Rule

**Never use `Math.random()` inside a Remotion component.**

`Math.random()` produces a different value every call. Remotion renders each frame independently (sometimes in parallel), so a component that uses `Math.random()` will produce a different layout per frame — flickering chaos.

`random(seed)` from `'remotion'` is a seeded pseudo-random number generator. Same seed → same value, every time, on every frame, on every machine.

---

## API

```ts
import { random } from 'remotion';

const value = random(seed); // returns a number in [0, 1)
```

`seed` can be:
- A string: `random('particle-0')`
- A number: `random(42)`
- A combined string: `random('x-' + i)` for per-element variation

---

## Pattern: Per-Element Properties

For a field of N elements, generate each property with a unique seed string. Combine the property name and index so x-positions and y-positions don't mirror each other.

```ts
const x     = random('x-' + i);      // 0..1
const y     = random('y-' + i);      // 0..1 — different from x
const size  = random('size-' + i);   // 0..1
const delay = random('delay-' + i);  // 0..1
const hue   = random('hue-' + i);    // 0..1
```

---

## Full Example: 50-Particle Field

A deterministic scatter of 50 particles with unique positions, sizes, and staggered appearance delays.

```tsx
import {
  AbsoluteFill,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { PALETTE, MOTION } from '../theme';

const PARTICLE_COUNT = 50;

// Pre-generate all particle data once — stable across frames
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  x:     random('px-' + i),       // normalized 0..1
  y:     random('py-' + i),       // normalized 0..1
  size:  random('ps-' + i) * 6 + 2,   // 2px–8px radius
  delay: Math.floor(random('pd-' + i) * 30), // 0–29 frame delay
  opacity: random('po-' + i) * 0.5 + 0.3,   // 0.3–0.8 base opacity
  colorIndex: Math.floor(random('pc-' + i) * PALETTE.accent.length),
}));

export default function ParticleField() {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: PALETTE.background }}>
      {particles.map((p, i) => {
        // Each particle springs in after its individual delay
        const appear = spring({
          frame: frame - p.delay,
          fps,
          config: MOTION.snappy,
          from: 0,
          to: 1,
        });

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left:   p.x * width,
              top:    p.y * height,
              width:  p.size * 2,
              height: p.size * 2,
              borderRadius: '50%',
              background: PALETTE.accent[p.colorIndex],
              opacity: appear * p.opacity,
              transform: `scale(${appear})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}
```

---

## Extending to 200 Particles

Same pattern, larger array. The key insight: generate the array **outside the component function** (or with `useMemo` if it depends on video config). This avoids recalculating on every frame call.

```tsx
const PARTICLE_COUNT = 200;

// At module level — computed once, never changes
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  x:      random('big-px-' + i),
  y:      random('big-py-' + i),
  radius: random('big-pr-' + i) * 8 + 1,
  speed:  random('big-pspd-' + i) * 0.5 + 0.5, // 0.5x–1x speed multiplier
  phase:  random('big-pph-' + i) * Math.PI * 2,  // random start angle
}));
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `Math.random()` inside component | Use `random(seed)` from `'remotion'` |
| Same seed for x and y | Use `'px-' + i` vs `'py-' + i` |
| Generating array inside render function | Move to module level or `useMemo` |
| Using index alone as seed: `random(i)` | Fine, but add a prefix per property to avoid correlations |

---

## Seed String Conventions

```
'[property]-[index]'        →  random('x-0'), random('y-0')
'[scene]-[property]-[index]' →  random('dust-x-0') when namespacing scenes
'[property]-[group]-[index]' →  random('size-ring-2') for grouped elements
```

Longer seed strings are fine. Remotion hashes the full string.
