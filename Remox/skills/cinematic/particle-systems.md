# Particle Systems

Deterministic 200-particle Lissajous orbit system with 3-layer parallax depth.

## Key Patterns

- `random(seed)` from Remotion for frame-independent deterministic positions
- Lissajous formula: `x = A*sin(a*t + delta)`, `y = B*sin(b*t)`
- 3 depth layers (0.3, 0.6, 1.0 speed multipliers) for parallax
- Opacity and size scaled by depth — farther = smaller + dimmer
- CSS transforms only, no SVG (perf)

## Complete Example

```tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, random } from 'remotion';
import { PALETTE, MOTION } from '../theme';

const PARTICLE_COUNT = 200;
const DEPTH_LAYERS = [
  { speed: 0.3, sizeRange: [1, 1.5], opacityRange: [0.15, 0.3] },
  { speed: 0.6, sizeRange: [1.5, 2.5], opacityRange: [0.3, 0.5] },
  { speed: 1.0, sizeRange: [2.5, 4],   opacityRange: [0.5, 0.85] },
];

interface Particle {
  A: number; B: number; a: number; b: number; delta: number;
  cx: number; cy: number; layer: number;
}

function buildParticles(sceneId: string): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const seed = `${sceneId}-p${i}`;
    const layer = Math.floor(random(`${seed}-layer`) * 3);
    return {
      A:     40 + random(`${seed}-A`)  * 120,
      B:     30 + random(`${seed}-B`)  * 90,
      a:     1  + random(`${seed}-a`)  * 3,
      b:     1  + random(`${seed}-b`)  * 3,
      delta: random(`${seed}-delta`)   * Math.PI * 2,
      cx:    random(`${seed}-cx`)      * 1920,
      cy:    random(`${seed}-cy`)      * 1080,
      layer,
    };
  });
}

// Memoize outside component — particles are static per scene
const PARTICLES = buildParticles('battery-intro');

export const ParticleField: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, overflow: 'hidden' }}>
      {PARTICLES.map((p, i) => {
        const layer = DEPTH_LAYERS[p.layer];
        const st = t * layer.speed;
        const x = p.cx + p.A * Math.sin(p.a * st + p.delta);
        const y = p.cy + p.B * Math.sin(p.b * st);

        const seed2 = `battery-intro-p${i}`;
        const size = layer.sizeRange[0] +
          random(`${seed2}-size`) * (layer.sizeRange[1] - layer.sizeRange[0]);
        const opacity = layer.opacityRange[0] +
          random(`${seed2}-op`) * (layer.opacityRange[1] - layer.opacityRange[0]);

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: '50%',
              background: PALETTE.accent,
              opacity,
              transform: `translate(${x}px, ${y}px)`,
              willChange: 'transform',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
```

## Notes

- Change `'battery-intro'` seed per scene for unique layouts
- Tune `a`/`b` ratios (integer ratios = closed Lissajous loops)
- Wrap in `<Sequence>` to fade in with `interpolate(frame, [0,20], [0,1])`
