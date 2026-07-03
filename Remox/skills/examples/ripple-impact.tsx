import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// Ripple Impact: hero statistic appears, triggers 5 concentric ripple waves.
// Small floating data labels orbit around the stat.

const RIPPLE_COUNT = 5;
const LABEL_COUNT  = 5;

// Orbit labels: fixed data points arranged around the center stat
const orbitLabels = [
  { text: 'China',    value: '62%', angleDeg:  72 },
  { text: 'India',    value: '9%',  angleDeg: 144 },
  { text: 'USA',      value: '8%',  angleDeg: 216 },
  { text: 'EU',       value: '12%', angleDeg: 288 },
  { text: 'Others',   value: '9%',  angleDeg:  0  },
];

// Ripple config: each wave starts RIPPLE_GAP frames after the previous
const RIPPLE_GAP    = 8;  // frames between each ripple launch
const RIPPLE_APPEAR = 5;  // frame when hero stat appears

export default function RippleImpact() {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  const cx = width  / 2;
  const cy = height / 2;

  // Max ripple radius reaches almost to the screen edge
  const maxRadius = Math.min(width, height) * 0.48;
  // Orbit radius for labels
  const orbitRadius = Math.min(width, height) * 0.3;

  // --- Hero stat entrance ---
  const statScale = spring({
    frame: frame - RIPPLE_APPEAR,
    fps,
    config: MOTION.bouncy,
    from: 0,
    to: 1,
  });
  const statOpacity = interpolate(
    frame,
    [RIPPLE_APPEAR, RIPPLE_APPEAR + 10],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Global orbit rotation — slow continuous spin
  const orbitAngle = (frame / durationInFrames) * Math.PI * 0.5;

  return (
    <AbsoluteFill style={{ background: PALETTE.background ?? '#0d0d1a', overflow: 'hidden' }}>
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Ripple waves */}
        {Array.from({ length: RIPPLE_COUNT }, (_, ri) => {
          const startFrame = RIPPLE_APPEAR + ri * RIPPLE_GAP;
          const rippleFrame = Math.max(0, frame - startFrame);

          // Ripple expands via spring — high-mass for heavy wave feel
          const rippleRadius = spring({
            frame: rippleFrame,
            fps,
            config: { damping: 18 + ri * 3, stiffness: 60, mass: 1.5 + ri * 0.4 },
            from: 0,
            to: maxRadius * (1 - ri * 0.04), // each wave slightly smaller
          });

          // Opacity: fades out as wave expands
          const rippleOpacity = interpolate(
            rippleRadius,
            [0, maxRadius * 0.2, maxRadius * 0.8, maxRadius],
            [0.8, 0.6, 0.15, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          // Color cycles through accent palette
          const accentBase = PALETTE.accent?.[ri % 3] ?? '#4fc3f7';

          return (
            <circle
              key={ri}
              cx={cx}
              cy={cy}
              r={Math.max(rippleRadius, 0)}
              fill="none"
              stroke={accentBase}
              strokeWidth={3 - ri * 0.4}
              opacity={rippleOpacity}
            />
          );
        })}

        {/* Orbit label connectors */}
        {orbitLabels.map((label, li) => {
          const baseAngle = (label.angleDeg * Math.PI) / 180;
          const angle     = baseAngle + orbitAngle;
          const lx        = cx + Math.cos(angle) * orbitRadius;
          const ly        = cy + Math.sin(angle) * orbitRadius;

          const labelAppear = spring({
            frame: frame - (RIPPLE_APPEAR + li * RIPPLE_GAP + 10),
            fps,
            config: MOTION.snappy,
            from: 0,
            to: 1,
          });

          return (
            <line
              key={`line-${li}`}
              x1={cx}
              y1={cy}
              x2={lx}
              y2={ly}
              stroke={PALETTE.accent?.[li % 3] ?? '#4fc3f7'}
              strokeWidth={1}
              opacity={labelAppear * 0.25}
              strokeDasharray="4 4"
            />
          );
        })}
      </svg>

      {/* Floating orbit labels */}
      {orbitLabels.map((label, li) => {
        const baseAngle = (label.angleDeg * Math.PI) / 180;
        const angle     = baseAngle + orbitAngle;
        const lx        = cx + Math.cos(angle) * orbitRadius;
        const ly        = cy + Math.sin(angle) * orbitRadius;

        const labelAppear = spring({
          frame: frame - (RIPPLE_APPEAR + li * RIPPLE_GAP + 10),
          fps,
          config: MOTION.snappy,
          from: 0,
          to: 1,
        });

        return (
          <div
            key={li}
            style={{
              position:  'absolute',
              left:      lx,
              top:       ly,
              transform: `translate(-50%, -50%) scale(${labelAppear})`,
              opacity:   labelAppear,
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <div style={{
              fontFamily: FONTS?.mono ?? 'monospace',
              fontSize:   28,
              fontWeight: 700,
              color:      PALETTE.accent?.[li % 3] ?? '#4fc3f7',
              lineHeight: 1,
            }}>
              {label.value}
            </div>
            <div style={{
              fontFamily: FONTS?.body ?? 'sans-serif',
              fontSize:   14,
              color:      PALETTE.secondary ?? '#aaaacc',
              marginTop:  4,
            }}>
              {label.text}
            </div>
          </div>
        );
      })}

      {/* Hero stat */}
      <div
        style={{
          position: 'absolute',
          inset:    0,
          display:  'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            transform:  `scale(${statScale})`,
            opacity:    statOpacity,
            textAlign:  'center',
          }}
        >
          <div
            style={{
              fontFamily:  FONTS?.display ?? 'Impact, sans-serif',
              fontSize:    240,
              fontWeight:  900,
              color:       PALETTE.primary ?? '#ffffff',
              lineHeight:  0.85,
              letterSpacing: '-6px',
              textShadow:  `
                0 0 40px ${PALETTE.accent?.[0] ?? '#4fc3f7'}80,
                0 0 80px ${PALETTE.accent?.[0] ?? '#4fc3f7'}40
              `,
            }}
          >
            77%
          </div>
          <div
            style={{
              fontFamily: FONTS?.body ?? 'sans-serif',
              fontSize:   28,
              fontWeight: 400,
              color:      PALETTE.secondary ?? '#aaaacc',
              marginTop:  12,
              letterSpacing: '3px',
              textTransform: 'uppercase',
            }}
          >
            Battery cell imports from China
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
