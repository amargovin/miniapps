# Arc Wipe

Expanding circle wipe reveal using CSS `clip-path: circle()`, spring-driven for snap.

## Key Patterns

- `clip-path: circle(R at X Y)` reveals content within radius R
- Animate R from 0 to a value large enough to cover 1920x1080 (max diagonal ~1100px)
- Origin point (X Y) can be any screen position — center, corner, or dynamic
- Spring config: stiffness:200, damping:26 for a fast snappy wipe
- Stack two layers: outgoing scene clips out, incoming clips in

## Complete Example

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  spring, interpolate,
} from 'remotion';
import { PALETTE } from '../theme';

const FULL_RADIUS = 1400; // covers full 1920x1080 diagonal

interface ArcWipeProps {
  /** Pixel coordinates of the wipe origin */
  originX?: number;
  originY?: number;
  /** Frame when wipe begins */
  startFrame?: number;
  children: React.ReactNode;
  /** true = expanding reveal, false = contracting exit */
  direction?: 'in' | 'out';
}

export const ArcWipe: React.FC<ArcWipeProps> = ({
  originX = 960,
  originY = 540,
  startFrame = 0,
  children,
  direction = 'in',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { stiffness: 200, damping: 26, mass: 1 },
  });

  const radius = direction === 'in'
    ? progress * FULL_RADIUS
    : (1 - progress) * FULL_RADIUS;

  return (
    <AbsoluteFill
      style={{
        clipPath: `circle(${radius}px at ${originX}px ${originY}px)`,
        willChange: 'clip-path',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// --- Clock wipe variant using conic-gradient mask ---
interface ClockWipeProps {
  startFrame?: number;
  durationFrames?: number;
  children: React.ReactNode;
}

export const ClockWipe: React.FC<ClockWipeProps> = ({
  startFrame = 0,
  durationFrames = 30,
  children,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 360],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        // Mask: revealed sector grows clockwise from top
        WebkitMaskImage: `conic-gradient(from -90deg, black ${progress}deg, transparent ${progress}deg)`,
        maskImage: `conic-gradient(from -90deg, black ${progress}deg, transparent ${progress}deg)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// --- Demo: scene transition ---
export const ArcWipeDemo: React.FC = () => (
  <AbsoluteFill style={{ background: PALETTE.bg }}>
    {/* Outgoing scene */}
    <AbsoluteFill style={{ background: '#1a1a2e' }} />
    {/* Incoming scene revealed by wipe from bottom-left corner */}
    <ArcWipe originX={0} originY={1080} startFrame={20}>
      <AbsoluteFill style={{ background: PALETTE.surface }} />
    </ArcWipe>
  </AbsoluteFill>
);
```

## Origin Presets

| Position     | originX | originY |
|--------------|---------|---------|
| Center       | 960     | 540     |
| Top-left     | 0       | 0       |
| Bottom-right | 1920    | 1080    |
| Impact point | dynamic | dynamic |

## Notes

- `FULL_RADIUS = 1400` guarantees coverage — use `Math.hypot(1920, 1080) / 2 + 50` for exact
- For edge-origin wipes the radius needs to be larger (up to 2200px from a corner)
- Combine with `CameraShake` on the incoming layer for impact feel
