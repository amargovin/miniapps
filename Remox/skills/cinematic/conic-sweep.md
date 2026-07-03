# Conic Sweep

Animated CSS `conic-gradient` for pie chart fills, radar
sweeps, clock-face animations, and circular progress
reveals. Pure CSS — no SVG required.

## Key Patterns

- `background: conic-gradient(from Adeg, color1 Xdeg,
  color2 Xdeg)` creates a sharp-edged pie sector
- Animate the sector angle (`Xdeg`) to fill/empty the pie
- `from Adeg` rotates the starting point — `-90deg`
  starts from 12 o'clock
- `border-radius: 50%` on a square div = circular pie
- Mask with `conic-gradient` on a rectangular element for
  non-circular sweeps
- Spring-driven for organic fill, linear for clock/timer

## When to Use

- **Pie / donut charts** — percentage fills that grow
  (market share, composition breakdowns)
- **Timer / countdown** — clock face filling or emptying
- **Radar sweep** — rotating scan line effect
- **Circular progress** — loading or completion indicator
  (if used as a physical gauge, not a UI widget)
- **Sector reveal** — content revealed in a wedge shape

## Complete Example

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  spring, interpolate,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// --- Animated Pie Chart ---
interface PieSlice {
  label: string;
  value: number; // percentage (0-100)
  color: string;
}

interface AnimatedPieProps {
  slices: PieSlice[];
  size?: number;
  startFrame?: number;
  staggerFrames?: number;
}

export const AnimatedPie: React.FC<AnimatedPieProps> = ({
  slices,
  size = 400,
  startFrame = 10,
  staggerFrames = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Build cumulative angles
  let cumulative = 0;
  const segments = slices.map((s, i) => {
    const segStart = cumulative;
    cumulative += (s.value / 100) * 360;
    return { ...s, startAngle: segStart, endAngle: cumulative };
  });

  // Overall fill progress (staggered per slice)
  const gradientStops: string[] = [];
  segments.forEach((seg, i) => {
    const sliceProgress = spring({
      frame: frame - startFrame - i * staggerFrames,
      fps,
      config: { stiffness: 100, damping: 20, mass: 1.2 },
    });

    const currentEnd = seg.startAngle +
      (seg.endAngle - seg.startAngle) * sliceProgress;

    gradientStops.push(
      `${seg.color} ${seg.startAngle}deg`,
      `${seg.color} ${currentEnd}deg`,
      `transparent ${currentEnd}deg`,
    );
  });

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `conic-gradient(from -90deg, ${gradientStops.join(', ')})`,
        willChange: 'background',
      }}
    />
  );
};

// --- Donut Variant (hollow center) ---
export const AnimatedDonut: React.FC<AnimatedPieProps> = (
  props,
) => {
  const { size = 400 } = props;
  const innerSize = size * 0.55;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <AnimatedPie {...props} />
      {/* Hollow center */}
      <div
        style={{
          position: 'absolute',
          top: (size - innerSize) / 2,
          left: (size - innerSize) / 2,
          width: innerSize,
          height: innerSize,
          borderRadius: '50%',
          background: PALETTE.bg,
        }}
      />
    </div>
  );
};

// --- Radar Sweep ---
export const RadarSweep: React.FC = () => {
  const frame = useCurrentFrame();
  const size = 500;

  // Continuous rotation — one full sweep every 90 frames
  const angle = (frame / 90) * 360;
  const sweepWidth = 60; // degrees

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${PALETTE.primary}44`,
        background: `conic-gradient(
          from ${angle - 90}deg,
          ${PALETTE.primary}66 0deg,
          transparent ${sweepWidth}deg,
          transparent 360deg
        )`,
        willChange: 'background',
      }}
    >
      {/* Cross hairs */}
      <div style={{
        position: 'absolute',
        top: '50%', left: 0, right: 0,
        height: 1, background: `${PALETTE.primary}33`,
      }} />
      <div style={{
        position: 'absolute',
        left: '50%', top: 0, bottom: 0,
        width: 1, background: `${PALETTE.primary}33`,
      }} />
    </div>
  );
};

// --- Demo scene ---
export const ConicSweepDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const titleOp = interpolate(
    frame, [0, 15], [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const slices: PieSlice[] = [
    { label: 'China', value: 77, color: PALETTE.secondary },
    { label: 'Japan', value: 12, color: PALETTE.primary },
    { label: 'Others', value: 11, color: PALETTE.accent },
  ];

  return (
    <AbsoluteFill style={{
      background: PALETTE.bg,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Title */}
      <div style={{
        position: 'absolute',
        top: 140,
        fontFamily: FONTS.heading,
        fontSize: 42,
        color: PALETTE.text,
        opacity: titleOp,
      }}>
        Battery Cell Import Sources
      </div>

      {/* Donut chart */}
      <AnimatedDonut
        slices={slices}
        size={420}
        startFrame={15}
        staggerFrames={10}
      />

      {/* Labels — appear after their slice fills */}
      {slices.map((s, i) => {
        const labelOp = interpolate(
          frame,
          [35 + i * 10, 45 + i * 10],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              right: 280,
              top: 420 + i * 55,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              opacity: labelOp,
            }}
          >
            <div style={{
              width: 20, height: 20,
              borderRadius: 4,
              background: s.color,
            }} />
            <span style={{
              fontFamily: FONTS.body,
              fontSize: 30,
              color: PALETTE.text,
            }}>
              {s.label} — {s.value}%
            </span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
```

## Clock Timer Variant

```tsx
// Countdown: sector shrinks from 360° to 0°
const remaining = interpolate(
  frame, [0, totalFrames], [360, 0],
  { extrapolateRight: 'clamp' },
);

background: `conic-gradient(
  from -90deg,
  ${PALETTE.accent} ${remaining}deg,
  ${PALETTE.bg} ${remaining}deg
)`
```

## Notes

- `from -90deg` starts the gradient at 12 o'clock — the
  natural starting point for clocks and gauges
- For donut charts, the inner circle must use `PALETTE.bg`
  to match the scene background
- Keep to max 5 slices — more becomes unreadable in video
- Stagger slice fills for a "building up" effect rather
  than everything appearing at once
- For editorial style: use this for composition/share data
  where the circular shape itself carries meaning (share
  of a whole). For sequential data use bar/vessel patterns
  instead.
- `willChange: 'background'` hints the GPU but
  conic-gradient repaints are still relatively expensive —
  avoid on more than 2 pie elements per scene
