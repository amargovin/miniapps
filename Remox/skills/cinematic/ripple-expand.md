# Ripple Expand

5-wave expanding concentric circle ripple from a center point — high-mass spring for heavy physical feel.

## Key Patterns

- High-mass spring: `{ stiffness: 50, damping: 200, mass: 20 }` — slow, weighty expansion
- Each wave staggered by 6–8 frames
- Opacity inversely proportional to radius (larger = more transparent)
- Border-only circles (not filled) for layered ripple look
- Use at stat reveals, impact cuts, or data "hit" moments

## Complete Example

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, spring,
} from 'remotion';
import { PALETTE } from '../theme';

const WAVE_COUNT = 5;
const MAX_RADIUS = 500;
const STAGGER_FRAMES = 7;
const ORIGIN_X = 960;
const ORIGIN_Y = 540;

interface RippleWaveProps {
  waveIndex: number;
  triggerFrame: number;
  color?: string;
}

const RippleWave: React.FC<RippleWaveProps> = ({
  waveIndex,
  triggerFrame,
  color = PALETTE.accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - triggerFrame - waveIndex * STAGGER_FRAMES,
    fps,
    config: { stiffness: 50, damping: 200, mass: 20 },
  });

  const radius = progress * MAX_RADIUS;
  // Outer waves slightly thinner border
  const borderWidth = Math.max(1, 3 - waveIndex * 0.4);
  // Fade out as radius grows
  const opacity = (1 - progress) * (1 - waveIndex * 0.15);

  if (radius <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: ORIGIN_X - radius,
        top:  ORIGIN_Y - radius,
        width:  radius * 2,
        height: radius * 2,
        borderRadius: '50%',
        border: `${borderWidth}px solid ${color}`,
        opacity: Math.max(0, opacity),
        willChange: 'transform, opacity',
      }}
    />
  );
};

export const RippleExpand: React.FC<{ triggerFrame?: number }> = ({
  triggerFrame = 0,
}) => (
  <AbsoluteFill style={{ background: PALETTE.bg }}>
    {Array.from({ length: WAVE_COUNT }, (_, i) => (
      <RippleWave
        key={i}
        waveIndex={i}
        triggerFrame={triggerFrame}
        color={PALETTE.accent}
      />
    ))}
  </AbsoluteFill>
);

// Combine with a stat reveal:
export const StatWithRipple: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const REVEAL = 10;
  const statScale = spring({
    frame: frame - REVEAL,
    fps,
    config: { stiffness: 300, damping: 30 },
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      <RippleExpand triggerFrame={REVEAL} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            fontSize: 180,
            fontWeight: 900,
            color: PALETTE.text,
            transform: `scale(${statScale})`,
            willChange: 'transform',
          }}
        >
          94%
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

## Variants

| Use Case          | stiffness | damping | mass | MAX_RADIUS |
|-------------------|-----------|---------|------|------------|
| Heavy impact      | 50        | 200     | 20   | 500        |
| Quick snap        | 200       | 40      | 1    | 300        |
| Slow sonar pulse  | 20        | 300     | 30   | 800        |
| Tight button tap  | 300       | 80      | 2    | 150        |

## Notes

- Move `ORIGIN_X/Y` to match the element being "impacted"
- Add a filled circle at origin (radius ~20px, spring to 0) for punch-in center dot
- Layer multiple `RippleExpand` instances at different trigger frames for compound impacts
