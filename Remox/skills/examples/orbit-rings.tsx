import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// Orbit Rings: 3 concentric SVG rings rotating at different speeds.
// Small dot orbits each ring. Central text label. Rings use solid/dashed/dotted styles.

const rings = [
  {
    radiusFactor:  0.18,  // fraction of min(w,h)
    strokeStyle:   'solid' as const,
    strokeWidth:   2,
    dotCount:      1,
    speedDeg:      0.6,   // degrees per frame
    colorIdx:      0,
    dotSize:       8,
  },
  {
    radiusFactor:  0.30,
    strokeStyle:   'dashed' as const,
    strokeWidth:   1.5,
    dotCount:      2,
    speedDeg:      -0.4,  // counter-clockwise
    colorIdx:      1,
    dotSize:       6,
  },
  {
    radiusFactor:  0.42,
    strokeStyle:   'dotted' as const,
    strokeWidth:   1,
    dotCount:      3,
    speedDeg:      0.25,
    colorIdx:      2,
    dotSize:       5,
  },
];

function strokeDashArray(style: 'solid' | 'dashed' | 'dotted', radius: number): string | undefined {
  const circumference = 2 * Math.PI * radius;
  if (style === 'dashed') return `${circumference / 20} ${circumference / 40}`;
  if (style === 'dotted') return `1 ${circumference / 60}`;
  return undefined;
}

export default function OrbitRings() {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  const cx = width  / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);

  // Scene entrance: rings spring in from scale 0
  const sceneEnter = spring({
    frame,
    fps,
    config: MOTION.heavy,
    from: 0,
    to: 1,
  });

  // Central label fade in (slightly delayed)
  const labelOpacity = spring({
    frame: frame - 20,
    fps,
    config: MOTION.snappy,
    from: 0,
    to: 1,
  });

  const defaultAccents = ['#4fc3f7', '#ce93d8', '#a5d6a7'];

  return (
    <AbsoluteFill style={{ background: PALETTE.background ?? '#0a0a14', overflow: 'hidden' }}>
      <svg
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: `${cx}px ${cy}px`,
          transform: `scale(${sceneEnter})`,
        }}
      >
        {rings.map((ring, ri) => {
          const radius = ring.radiusFactor * minDim;
          const color  = PALETTE.accent?.[ring.colorIdx] ?? defaultAccents[ring.colorIdx];

          // Current rotation angle for this ring
          const angleDeg = frame * ring.speedDeg;
          const angleRad = (angleDeg * Math.PI) / 180;

          const dashArray = strokeDashArray(ring.strokeStyle, radius);

          return (
            <g key={ri}>
              {/* Ring itself */}
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={ring.strokeWidth}
                strokeDasharray={dashArray}
                strokeLinecap={ring.strokeStyle === 'dotted' ? 'round' : 'square'}
                opacity={0.6}
              />

              {/* Orbiting dots — evenly spaced, rotated by angleDeg */}
              {Array.from({ length: ring.dotCount }, (_, di) => {
                const dotAngle = angleRad + (di * Math.PI * 2) / ring.dotCount;
                const dx = cx + Math.cos(dotAngle) * radius;
                const dy = cy + Math.sin(dotAngle) * radius;

                // Subtle size pulse so each dot feels alive
                const pulse = 1 + 0.25 * Math.sin(frame * 0.12 + di * 1.5 + ri * 0.7);

                return (
                  <circle
                    key={di}
                    cx={dx}
                    cy={dy}
                    r={ring.dotSize * pulse}
                    fill={color}
                    opacity={0.95}
                    style={{ filter: `drop-shadow(0 0 ${ring.dotSize * 1.5}px ${color}80)` }}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Subtle center glow */}
        <radialGradient id="center-glow" cx="50%" cy="50%" r="10%">
          <stop offset="0%"   stopColor={PALETTE.accent?.[0] ?? '#4fc3f7'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={PALETTE.accent?.[0] ?? '#4fc3f7'} stopOpacity="0"   />
        </radialGradient>
        <circle cx={cx} cy={cy} r={minDim * 0.08} fill="url(#center-glow)" />
      </svg>

      {/* Central label */}
      <div
        style={{
          position:   'absolute',
          inset:      0,
          display:    'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          opacity:    labelOpacity,
          transform:  `scale(${sceneEnter})`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS?.display ?? 'sans-serif',
            fontSize:   52,
            fontWeight: 900,
            color:      PALETTE.primary ?? '#ffffff',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            textShadow: `0 0 30px ${PALETTE.accent?.[0] ?? '#4fc3f7'}60`,
            lineHeight: 1,
            textAlign:  'center',
          }}
        >
          ORBIT
        </div>
        <div
          style={{
            fontFamily: FONTS?.mono ?? 'monospace',
            fontSize:   16,
            color:      PALETTE.secondary ?? '#8888aa',
            letterSpacing: '5px',
            marginTop:  8,
            textTransform: 'uppercase',
          }}
        >
          3 rings
        </div>
      </div>
    </AbsoluteFill>
  );
}
