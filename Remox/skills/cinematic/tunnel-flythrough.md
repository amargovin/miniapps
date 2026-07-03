# Tunnel Flythrough

500-circle depth illusion with noise drift and color gradient across depth layers.

## Key Patterns

- Each circle has a `depth` value (0–1); depth decreases by `frame * speed`
- Scale formula: `scale = 1 / (1 + depth * 8)` — small far, large near
- Opacity: full at mid-depth, fades at extremes (too close = transparent)
- Noise drift on x/y center for organic tube wobble
- Color interpolated from deep (cool) to near (warm)

## Complete Example

```tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolateColors } from 'remotion';
import { createNoise2D } from 'simplex-noise';
import { PALETTE } from '../theme';

const CIRCLE_COUNT = 500;
const TUNNEL_SPEED = 0.004; // depth units per frame
const CX = 960;
const CY = 540;

const driftX = createNoise2D(() => 0.11);
const driftY = createNoise2D(() => 0.22);

// Pre-build static circle data (base depths evenly distributed)
const CIRCLES = Array.from({ length: CIRCLE_COUNT }, (_, i) => ({
  baseDepth: i / CIRCLE_COUNT,
  baseRadius: 20 + (i / CIRCLE_COUNT) * 600,
}));

export const TunnelFlythrough: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {CIRCLES.map((circle, i) => {
        // Wrap depth so circles cycle continuously
        let depth = (circle.baseDepth - frame * TUNNEL_SPEED) % 1;
        if (depth < 0) depth += 1;

        const scale = 1 / (1 + depth * 8);
        const radius = circle.baseRadius * scale;

        // Fade: invisible when too close (< 0.05) or too far (> 0.95)
        const opacity =
          depth < 0.05 ? depth / 0.05 :
          depth > 0.85 ? (1 - depth) / 0.15 : 1;

        // Noise drift — deeper circles drift more slowly
        const t = frame * 0.015 * (1 - depth);
        const nx = driftX(i * 0.07, t) * 80 * (1 - depth);
        const ny = driftY(i * 0.07, t) * 50 * (1 - depth);

        const color = interpolateColors(
          depth,
          [0, 0.4, 1],
          [PALETTE.accent, PALETTE.highlight ?? '#fff', PALETTE.secondary ?? '#0af'],
        );

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: CX + nx - radius,
              top:  CY + ny - radius,
              width:  radius * 2,
              height: radius * 2,
              borderRadius: '50%',
              border: `${Math.max(0.5, 2 * scale)}px solid ${color}`,
              opacity: opacity * 0.7,
              willChange: 'transform',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
```

## Variants

- **Filled circles**: swap `border` for `background` — more opaque, heavier feel
- **Square tunnel**: use `borderRadius: 0`, rotate by `depth * 45deg` for spiral
- **Color bands**: use `Math.floor(depth * 6)` to pick from a palette array

## Notes

- `TUNNEL_SPEED` controls flythrough pace — 0.004 = ~250 frames per full cycle
- Increase `CIRCLE_COUNT` for denser tunnels; 300 is comfortable for 60fps
- `baseRadius` range determines tunnel diameter — scale up for wider tunnels
