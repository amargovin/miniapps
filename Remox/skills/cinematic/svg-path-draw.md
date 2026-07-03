# SVG Path Draw

Progressive line drawing using `stroke-dasharray` and
`stroke-dashoffset`, spring-driven or interpolated.

## Key Patterns

- Measure total path length with `getTotalLength()` or hardcode
  a known value
- Set `strokeDasharray={totalLength}` to create one dash = full
  path
- Animate `strokeDashoffset` from `totalLength` (hidden) to `0`
  (fully drawn)
- Spring config: stiffness:80, damping:20 for smooth organic draw;
  stiffness:200, damping:26 for snappy technical draw
- Multiple paths with stagger = sequential construction effect
- `fill: 'none'` during draw, then fade in fill after stroke
  completes

## When to Use

- **Supply routes on maps** — trade lines drawing between
  countries
- **Diagram construction** — flow chart edges appearing one by
  one
- **Circuit / pipeline traces** — technical paths lighting up
- **Connecting elements** — string/wire between pinned items
- **Signature / handwriting** — single-stroke letterforms
- **Border / frame reveals** — decorative borders drawing
  themselves around content

## Complete Example

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  spring, interpolate,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

const PATH_LENGTH = 800; // known or measured
const STAGGER = 12; // frames between paths

interface DrawPathProps {
  d: string;
  pathLength?: number;
  startFrame?: number;
  color?: string;
  strokeWidth?: number;
  /** 'spring' for organic, 'linear' for mechanical */
  timing?: 'spring' | 'linear';
  durationFrames?: number;
}

export const DrawPath: React.FC<DrawPathProps> = ({
  d,
  pathLength = PATH_LENGTH,
  startFrame = 0,
  color = PALETTE.primary,
  strokeWidth = 4,
  timing = 'spring',
  durationFrames = 45,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const elapsed = frame - startFrame;

  const progress = timing === 'spring'
    ? spring({
        frame: elapsed,
        fps,
        config: { stiffness: 80, damping: 20, mass: 1 },
      })
    : interpolate(
        elapsed,
        [0, durationFrames],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );

  const offset = pathLength * (1 - progress);

  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={pathLength}
      strokeDashoffset={offset}
      style={{ willChange: 'stroke-dashoffset' }}
    />
  );
};

// --- Demo: supply route drawing between two points ---
export const SupplyRouteDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // Route: curved path from left to right
  const routePath = `M 300 600 C 500 300, 900 800, 1200 400 S 1500 200, 1650 500`;
  const routeLength = 1400; // approximate

  // Node opacity — appear after route draws
  const nodeDelay = 50;
  const nodeOp = interpolate(
    frame, [nodeDelay, nodeDelay + 15], [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Arrowhead progress
  const arrowProgress = spring({
    frame: frame - 40,
    fps,
    config: MOTION.springSnappy,
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* Route line */}
        <DrawPath
          d={routePath}
          pathLength={routeLength}
          startFrame={10}
          color={PALETTE.primary}
          strokeWidth={5}
          timing="spring"
        />

        {/* Origin node */}
        <circle
          cx={300} cy={600} r={24}
          fill={PALETTE.primary}
          opacity={interpolate(frame, [5, 15], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}
        />

        {/* Destination node */}
        <circle
          cx={1650} cy={500} r={24}
          fill={PALETTE.secondary}
          opacity={nodeOp}
        />

        {/* Origin label */}
        <text
          x={300} y={660}
          textAnchor="middle"
          fontFamily={FONTS.heading}
          fontSize={32}
          fill={PALETTE.text}
          opacity={interpolate(frame, [5, 15], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}
        >
          CHINA
        </text>

        {/* Destination label */}
        <text
          x={1650} y={560}
          textAnchor="middle"
          fontFamily={FONTS.heading}
          fontSize={32}
          fill={PALETTE.text}
          opacity={nodeOp}
        >
          INDIA
        </text>
      </svg>
    </AbsoluteFill>
  );
};
```

## Measuring Path Length

If path is complex, render once and measure:

```tsx
// In a useEffect or ref callback:
const ref = useRef<SVGPathElement>(null);
const len = ref.current?.getTotalLength() ?? 0;
```

Or hardcode a generous estimate — slightly over is fine,
slightly under clips the end of the draw.

## Staggered Multi-Path

```tsx
const paths = [route1, route2, route3];
{paths.map((d, i) => (
  <DrawPath
    key={i}
    d={d}
    startFrame={10 + i * STAGGER}
    color={i === 0 ? PALETTE.primary : PALETTE.secondary}
  />
))}
```

## Draw Then Fill

```tsx
// After stroke completes, fade in the fill
const drawDone = spring({ frame: frame - 60, fps, config: ... });
const fillOp = interpolate(drawDone, [0.9, 1], [0, 0.3], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});
<path d={d} fill={color} fillOpacity={fillOp} stroke={color}
  strokeDasharray={len} strokeDashoffset={offset} />
```

## Notes

- Keep `strokeLinecap="round"` for natural endpoints
- For map routes, combine with country outline SVGs
- Stagger + spring creates a "building the diagram" feel
  that is far more engaging than fade-in
- Performance: SVG path draw is lightweight — safe for 10+
  simultaneous paths
- Combine with `speed-remap` for a fast-draw → settle effect
