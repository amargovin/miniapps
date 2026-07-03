# Speed Remap

Variable playback speed via frame accumulator — text slam that decelerates from 3x to 0.5x on impact.

## Key Patterns

- `remapSpeed(frame, speedCurve)`: accumulate fractional animation time by integrating speed
- Speed curve is sampled per frame — values > 1 fast-forward, < 1 slow-mo, 0 = freeze
- Implementation: precompute a lookup table of accumulated time per frame
- Drive `spring()` or `interpolate()` with `animTime` instead of `frame`
- Use for: text slam (fast approach, slow settle), data bar (slow fill, fast snap to value)

## Core Utility

```tsx
/**
 * Precompute remapped animation time for each frame.
 * speedFn(frame) returns the playback speed at that frame.
 * Returns array where remappedTime[frame] = accumulated animation units.
 */
function buildRemapTable(
  totalFrames: number,
  speedFn: (frame: number) => number,
): Float32Array {
  const table = new Float32Array(totalFrames + 1);
  table[0] = 0;
  for (let f = 1; f <= totalFrames; f++) {
    table[f] = table[f - 1] + speedFn(f - 1);
  }
  return table;
}

/** Get remapped time for the current frame (clamped). */
function remapTime(table: Float32Array, frame: number): number {
  const clamped = Math.max(0, Math.min(frame, table.length - 1));
  return table[Math.floor(clamped)];
}
```

## Complete Example: Text Slam with Deceleration

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  spring, interpolate,
} from 'remotion';
import { PALETTE, FONTS } from '../theme';
import { useMemo } from 'react';

const TOTAL_FRAMES = 90;

// Speed curve: 3x speed for first 20 animation units, decelerate to 0.5x by unit 40
function slamSpeedCurve(frame: number): number {
  // frames 0–15: fast approach (3x)
  if (frame < 15) return 3.0;
  // frames 15–40: decelerate to 0.5x
  if (frame < 40) return interpolate(frame, [15, 40], [3.0, 0.5]);
  // frames 40+: slow drift (0.5x)
  return 0.5;
}

export const TextSlam: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Build remap table once per composition
  const remapTable = useMemo(
    () => buildRemapTable(TOTAL_FRAMES, slamSpeedCurve),
    [],
  );

  const animTime = remapTime(remapTable, frame);

  // Drive Y position with remapped time
  // animTime ≈ 0 at start, grows fast then slows
  const yProgress = spring({
    frame: animTime,
    fps,
    config: { stiffness: 200, damping: 28, mass: 1 },
  });

  // Text enters from above (-300px) and settles at 0
  const translateY = (1 - yProgress) * -300;

  // Scale: large far away, normal on impact
  const scale = 1.4 - yProgress * 0.4;

  // Impact flash: brief opacity spike when yProgress crosses 0.9
  const impactFlash = interpolate(
    animTime,
    [28, 30, 32, 36],
    [0, 0.6, 0.6, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      {/* Impact flash overlay */}
      <AbsoluteFill
        style={{ background: '#fff', opacity: impactFlash, pointerEvents: 'none' }}
      />

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: FONTS.headline,
            fontSize: 180,
            fontWeight: 900,
            color: PALETTE.text,
            letterSpacing: '-0.02em',
            transform: `translateY(${translateY}px) scale(${scale})`,
            willChange: 'transform',
          }}
        >
          DEPENDENCY
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// --- Simpler inline version for a data bar slow-fill ---
export const RemappedBar: React.FC = () => {
  const frame = useCurrentFrame();

  // Compute remap inline for short compositions
  // Fast fill for first 30 frames (2x), slow settle (0.3x) after
  let animTime = 0;
  for (let f = 0; f < Math.min(frame, 60); f++) {
    animTime += f < 30 ? 2.0 : 0.3;
  }

  const barProgress = interpolate(animTime, [0, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1400, height: 40, background: PALETTE.surface, borderRadius: 8 }}>
        <div
          style={{
            width: `${barProgress * 100}%`,
            height: '100%',
            background: PALETTE.accent,
            borderRadius: 8,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
```

## Speed Curve Recipes

| Effect               | Curve Shape                         |
|----------------------|-------------------------------------|
| Slam decelerate      | 3x → 0.5x over 25 frames            |
| Bounce approach      | 2x → 0.2x → 2x (ping-pong)          |
| Freeze frame         | 1x → 0 (hold) → 1x                  |
| Dramatic slow-mo     | 0.15x for 60 frames, then 1x        |
| Bullet time          | 1x → 0.05x → 1x (gaussian dip)      |

## Notes

- `useMemo` for `buildRemapTable` is critical — recomputing 90 iterations per frame adds up
- `animTime` grows faster than `frame` at high speed — ensure spring/interpolate ranges account for this
- Combine with `CameraShake` timed to `animTime` reaching the impact point
