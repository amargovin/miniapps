# Camera Shake

Organic multi-axis camera shake via SimplexNoise — independent X, Y, rotation channels with intensity envelope.

## Key Patterns

- `simplex-noise` package: one `createNoise2D()` instance per axis
- Noise sampled at `(frame * 0.08, 0)` — frequency controls shake speed
- Intensity envelope: `interpolate()` for ease-in/ease-out amplitude
- Typical ranges: translateX ±15px, translateY ±10px, rotate ±1deg
- Wrap any child content — shake is purely a wrapper transform

## Install

```bash
bun add simplex-noise
```

## Complete Example

```tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { createNoise2D } from 'simplex-noise';
import { PALETTE } from '../theme';

// Create noise instances outside component (stable references)
const noiseX   = createNoise2D(() => 0.1);
const noiseY   = createNoise2D(() => 0.2);
const noiseRot = createNoise2D(() => 0.3);

interface CameraShakeProps {
  children: React.ReactNode;
  /** Frame range where shake is active */
  startFrame: number;
  endFrame: number;
  /** Peak intensity multiplier — default 1.0 */
  intensity?: number;
  /** Noise frequency — higher = jitterier. Default 0.08 */
  frequency?: number;
}

export const CameraShake: React.FC<CameraShakeProps> = ({
  children,
  startFrame,
  endFrame,
  intensity = 1.0,
  frequency = 0.08,
}) => {
  const frame = useCurrentFrame();

  // Envelope: ramp in over 6 frames, ramp out over 10 frames
  const envelope = interpolate(
    frame,
    [startFrame, startFrame + 6, endFrame - 10, endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const t = frame * frequency;
  const tx  = noiseX(t, 0)   * 15 * intensity * envelope;
  const ty  = noiseY(t, 0)   * 10 * intensity * envelope;
  const rot = noiseRot(t, 0) *  1 * intensity * envelope;

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`,
        willChange: 'transform',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// Usage:
export const ShakeDemo: React.FC = () => (
  <AbsoluteFill style={{ background: PALETTE.bg }}>
    <CameraShake startFrame={30} endFrame={70} intensity={1.5}>
      {/* Your scene content here */}
      <div style={{ position: 'absolute', inset: 0, background: PALETTE.surface }} />
    </CameraShake>
  </AbsoluteFill>
);
```

## Intensity Presets

| Scenario         | intensity | frequency |
|------------------|-----------|-----------|
| Subtle handheld  | 0.4       | 0.05      |
| Impact hit       | 1.5       | 0.12      |
| Explosion        | 3.0       | 0.18      |
| Screen glitch    | 2.0       | 0.25      |

## Notes

- Seed values (0.1, 0.2, 0.3) in `createNoise2D(() => N)` keep axes decorrelated
- For looping shake, use `frame % loopLength` as the noise input
