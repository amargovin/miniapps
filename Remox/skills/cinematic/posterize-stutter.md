# Posterize Stutter

Frame quantization for stop-motion / stutter feel — smooth background, stuttered foreground element.

## Key Patterns

- `quantizedFrame = Math.round(frame / N) * N` — snaps frame to nearest multiple of N
- N=2: double-frame (15fps feel), N=3: triple-frame (10fps), N=4: quarter-frame (7.5fps)
- Pass `quantizedFrame` to `spring()` / `interpolate()` for the stuttered element only
- Smooth elements use `frame` as normal
- Scale pop on stutter: add `scale: 1 + bounce * 0.05` for emphasis

## Complete Example

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  spring, interpolate,
} from 'remotion';
import { PALETTE, FONTS } from '../theme';

interface PosterizedProps {
  /** Quantization interval — 2=15fps feel, 3=10fps, 4=7.5fps */
  stutterN?: number;
  /** Frame to start the counter animation */
  startFrame?: number;
  targetValue?: number;
}

export const PosterizedCounter: React.FC<PosterizedProps> = ({
  stutterN = 3,
  startFrame = 0,
  targetValue = 94,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Quantized frame for the stutter element ---
  const quantizedFrame = Math.round(frame / stutterN) * stutterN;

  // Counter value: uses quantized frame → stuttery number flip
  const counterProgress = spring({
    frame: quantizedFrame - startFrame,
    fps,
    config: { stiffness: 80, damping: 30, mass: 1 },
  });
  const displayValue = Math.round(counterProgress * targetValue);

  // Scale pop: snaps up each stutter tick then decays smoothly
  // Compare current quantized vs previous quantized tick
  const prevQuantized = Math.round((frame - 1) / stutterN) * stutterN;
  const isNewTick = quantizedFrame !== prevQuantized;

  // Accumulate tick count for a simple bounce
  const tickBounce = spring({
    frame: frame - quantizedFrame, // frames since last tick
    fps,
    config: { stiffness: 400, damping: 20, mass: 0.5 },
  });
  const scale = 1 + tickBounce * 0.04;

  // --- Smooth background progress bar ---
  const smoothProgress = spring({
    frame: frame - startFrame,
    fps,
    config: { stiffness: 60, damping: 20 },
  });
  const barWidth = smoothProgress * 1920 * (targetValue / 100);

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      {/* Smooth background bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: barWidth,
          height: 8,
          background: PALETTE.accent,
          opacity: 0.4,
        }}
      />

      {/* Posterized counter */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: FONTS.headline,
            fontSize: 240,
            fontWeight: 900,
            color: PALETTE.text,
            transform: `scale(${scale})`,
            willChange: 'transform',
            // Tabular nums prevents layout shift on number change
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {displayValue}
          <span style={{ fontSize: 100, color: PALETTE.accent }}>%</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// --- Variable stutter intensity over time ---
export const VariableStutter: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Stutter intensity: heavy at start (N=4), smooth at end (N=1)
  const stutterN = frame < 30 ? 4 : frame < 60 ? 3 : frame < 90 ? 2 : 1;
  const qf = Math.round(frame / stutterN) * stutterN;

  const progress = spring({
    frame: qf,
    fps,
    config: { stiffness: 100, damping: 20 },
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      <div style={{
        position: 'absolute',
        left: progress * (1920 - 200),
        top: 440,
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: PALETTE.accent,
      }} />
    </AbsoluteFill>
  );
};
```

## Stutter Presets

| N | Effective FPS | Feel                    |
|---|---------------|-------------------------|
| 1 | 30            | Smooth (no stutter)     |
| 2 | 15            | Subtle double-frame     |
| 3 | 10            | Classic stop-motion     |
| 4 | 7.5           | Heavy mechanical chop   |
| 6 | 5             | Extreme freeze-frame    |

## Notes

- Only apply quantization to the element you want stuttered — never to smooth BG elements
- `fontVariantNumeric: 'tabular-nums'` is essential for counters to prevent layout jitter
- Pair with `CameraShake` on a hit frame for kinetic emphasis
