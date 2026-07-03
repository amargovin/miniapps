# Parallax Layers

Multi-plane depth scene using CSS 3D transforms.
Layers at different `translateZ` depths move at different
rates during a virtual camera pan, creating depth illusion.

## Key Patterns

- Parent container sets `perspective: 800px` and
  `transformStyle: preserve-3d`
- Child layers use `translateZ(Npx)` — negative = farther,
  positive = closer
- Animate parent `translateX` or `translateY` — children
  move at different speeds automatically via perspective
- Alternatively, manually scale layer speeds:
  far=0.3x, mid=0.6x, near=1.0x
- Scale compensation: elements at `translateZ(-200px)`
  appear smaller — scale up to compensate if needed

## When to Use

- **Establishing shots** — camera pans across a layered
  environment (city skyline, factory, landscape)
- **Journey / process** — viewer moves through a space
  as voiceover narrates stages
- **Depth in static scenes** — subtle parallax on
  background vs. foreground elements adds life to
  otherwise flat compositions
- **Text over environment** — text in foreground moves
  faster than illustrated background

## Complete Example

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  spring, interpolate,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

const CANVAS_W = 1920;
const CANVAS_H = 1080;

interface LayerProps {
  /** Depth: 0 = mid, negative = far, positive = near */
  z: number;
  /** Manual speed multiplier (0-1). If set, overrides
   *  CSS 3D and uses translateX directly */
  speed?: number;
  children: React.ReactNode;
}

// --- CSS 3D Approach (true perspective) ---
export const ParallaxScene3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Camera pan: slow drift left to right
  const panProgress = interpolate(
    frame, [0, 180], [0, 1],
    { extrapolateRight: 'clamp' },
  );
  const panX = interpolate(panProgress, [0, 1], [0, -200]);

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      <div
        style={{
          position: 'absolute',
          width: CANVAS_W,
          height: CANVAS_H,
          perspective: 800,
          transformStyle: 'preserve-3d' as const,
          // Camera pan — children respond based on Z depth
          transform: `translateX(${panX}px)`,
          willChange: 'transform',
        }}
      >
        {/* Far background — moves slowest */}
        <AbsoluteFill
          style={{
            transform: 'translateZ(-300px) scale(1.4)',
            opacity: 0.4,
          }}
        >
          {/* Distant elements: mountains, horizon, clouds */}
          <div style={{
            position: 'absolute', bottom: 300,
            left: 200, width: 1600, height: 200,
            background: `linear-gradient(to top, ${PALETTE.textMuted}22, transparent)`,
            borderRadius: '50% 50% 0 0',
          }} />
        </AbsoluteFill>

        {/* Mid layer — moderate speed */}
        <AbsoluteFill
          style={{
            transform: 'translateZ(-100px) scale(1.12)',
            opacity: 0.7,
          }}
        >
          {/* Middle elements: buildings, trees, structures */}
          <svg
            width={CANVAS_W} height={CANVAS_H}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          >
            <rect x={500} y={400} width={120} height={280}
              fill={PALETTE.primary} opacity={0.6} rx={4} />
            <rect x={700} y={350} width={100} height={330}
              fill={PALETTE.primary} opacity={0.5} rx={4} />
            <rect x={1100} y={420} width={140} height={260}
              fill={PALETTE.secondary} opacity={0.5} rx={4} />
          </svg>
        </AbsoluteFill>

        {/* Near foreground — moves fastest */}
        <AbsoluteFill
          style={{ transform: 'translateZ(100px) scale(0.88)' }}
        >
          {/* Foreground: main subject, text */}
          <div style={{
            position: 'absolute',
            top: 380, left: 600,
            fontFamily: FONTS.heading,
            fontSize: 72,
            fontWeight: 700,
            color: PALETTE.text,
          }}>
            Foreground Title
          </div>
        </AbsoluteFill>
      </div>
    </AbsoluteFill>
  );
};

// --- Manual Speed Approach (simpler, more control) ---
export const ParallaxManual: React.FC = () => {
  const frame = useCurrentFrame();

  // Base pan distance
  const basePan = interpolate(
    frame, [0, 150], [0, -300],
    { extrapolateRight: 'clamp' },
  );

  const layers = [
    { speed: 0.2, content: 'Far background', opacity: 0.3 },
    { speed: 0.5, content: 'Mid ground', opacity: 0.6 },
    { speed: 0.8, content: 'Near elements', opacity: 0.85 },
    { speed: 1.0, content: 'Foreground', opacity: 1 },
  ];

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      {layers.map((layer, i) => (
        <AbsoluteFill
          key={i}
          style={{
            transform: `translateX(${basePan * layer.speed}px)`,
            opacity: layer.opacity,
            willChange: 'transform',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 300 + i * 120,
            left: 400,
            fontFamily: FONTS.body,
            fontSize: 36,
            color: PALETTE.text,
          }}>
            {layer.content}
          </div>
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};
```

## Combining with Other Patterns

```tsx
// Parallax + depth blur (far layers blurred)
<AbsoluteFill style={{
  transform: 'translateZ(-300px) scale(1.4)',
  filter: 'blur(3px)',
}}>
  {/* Far background — both distant and soft */}
</AbsoluteFill>
```

## Vertical Parallax

Same technique, different axis — useful for scroll-like
reveals or "rising through layers":

```tsx
const panY = interpolate(frame, [0, 180], [200, -200]);
// Apply to container, children respond via Z depth
transform: `translateY(${panY}px)`
```

## Notes

- CSS 3D approach: `scale()` compensation is needed because
  `translateZ` changes apparent size. Farther = smaller,
  so scale up. `scale(1 + Math.abs(z) / 800)` is a
  reasonable starting formula.
- Manual approach is simpler and more predictable — use
  it unless you need true perspective distortion
- 3-4 layers is the sweet spot. More than 5 layers is
  visual noise with no added depth perception.
- Pan speed should be slow — 100-300px over 150+ frames.
  Fast parallax looks like a glitch, not depth.
- Combine with `depth-blur` pattern for cinematic focus:
  far layers blurred, near layers sharp.
- Works exceptionally well for map-based scenes: country
  outline in mid layer, supply route in near layer,
  geographic texture in far layer
