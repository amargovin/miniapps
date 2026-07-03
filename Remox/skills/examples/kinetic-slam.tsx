import {
  AbsoluteFill,
  random,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// Kinetic Slam: bold text decelerates from off-screen into center with spring physics.
// On landing: scale pulse + camera shake. Background particles scatter on impact.

const PARTICLE_COUNT = 60;

// Scatter particles — all at center pre-impact, fly outward post-impact
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  angle:    random('kspa-' + i) * Math.PI * 2,
  distance: random('kspd-' + i) * 400 + 100,
  speed:    random('ksps-' + i) * 0.6 + 0.8,
  size:     random('kspsz-' + i) * 8 + 3,
  opacity:  random('kspo-' + i) * 0.6 + 0.3,
  colorIdx: Math.floor(random('kspc-' + i) * 3),
}));

// --- Animation timing constants ---
const SLAM_FRAME    = 18;  // frame when text arrives at center
const SHAKE_DURATION = 12;  // frames of camera shake after slam
const SHAKE_DECAY    = 8;   // frames for shake to die down

export default function KineticSlam() {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const cx = width  / 2;
  const cy = height / 2;

  // --- Text approach: ultra-fast spring from top, stops hard at center ---
  // The trick: very low damping so it overshoots, then snaps back
  const textY = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 320, mass: 1.2 },
    from: -height * 0.6,
    to: 0,
  });

  // Landing scale pulse: at SLAM_FRAME, briefly scales to 1.08, then back to 1.0
  const scalePulse = spring({
    frame: frame - SLAM_FRAME,
    fps,
    config: { damping: 6, stiffness: 300 },
    from: 1.08,
    to: 1.0,
  });
  // Only apply pulse after slam frame
  const textScale = frame < SLAM_FRAME ? 1 : scalePulse;

  // --- Camera shake: sine-wave noise decaying after SLAM_FRAME ---
  const shakeFrame = Math.max(0, frame - SLAM_FRAME);
  const shakeDecay = interpolate(
    shakeFrame,
    [0, SHAKE_DURATION + SHAKE_DECAY],
    [1, 0],
    { extrapolateRight: 'clamp' }
  );
  const shakeX = shakeFrame < SHAKE_DURATION + SHAKE_DECAY
    ? Math.sin(shakeFrame * 1.7) * 12 * shakeDecay
    + Math.sin(shakeFrame * 3.1) *  6 * shakeDecay
    : 0;
  const shakeY = shakeFrame < SHAKE_DURATION + SHAKE_DECAY
    ? Math.cos(shakeFrame * 2.3) * 8 * shakeDecay
    + Math.cos(shakeFrame * 4.0) * 4 * shakeDecay
    : 0;

  // --- Particle scatter: burst outward starting at SLAM_FRAME ---
  const accentColors = [
    PALETTE.accent?.[0] ?? '#ff6b35',
    PALETTE.accent?.[1] ?? '#ffd23f',
    PALETTE.accent?.[2] ?? '#ee4266',
  ];

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.background ?? '#111118',
        overflow: 'hidden',
        // Whole scene gets camera shake transform
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      {/* Background particles — scatter on impact */}
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {particles.map((p, i) => {
          const scatterProgress = spring({
            frame: frame - SLAM_FRAME,
            fps,
            config: { damping: 20 + p.speed * 10, stiffness: 80 },
            from: 0,
            to: 1,
          });

          const px = cx + Math.cos(p.angle) * p.distance * scatterProgress * p.speed;
          const py = cy + Math.sin(p.angle) * p.distance * scatterProgress * p.speed;
          const pOpacity = interpolate(
            frame - SLAM_FRAME,
            [-5, 0, 10, 40],
            [0, p.opacity, p.opacity, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          return (
            <circle
              key={i}
              cx={px}
              cy={py}
              r={p.size * (1 - scatterProgress * 0.6)}
              fill={accentColors[p.colorIdx]}
              opacity={pOpacity}
            />
          );
        })}
      </svg>

      {/* The slam text */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            transform: `translateY(${textY}px) scale(${textScale})`,
            transformOrigin: 'center center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS?.display ?? 'Impact, sans-serif',
              fontSize: 160,
              fontWeight: 900,
              color: PALETTE.primary ?? '#ffffff',
              textTransform: 'uppercase',
              letterSpacing: '-4px',
              lineHeight: 0.9,
              display: 'block',
              textAlign: 'center',
              textShadow: `
                0 8px 32px rgba(0,0,0,0.8),
                0 0 60px ${accentColors[0]}40
              `,
            }}
          >
            THIS CHANGES
            <br />
            EVERYTHING
          </span>
        </div>
      </div>

      {/* Impact flash: brief white overlay at slam moment */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#ffffff',
          opacity: interpolate(
            frame,
            [SLAM_FRAME - 1, SLAM_FRAME, SLAM_FRAME + 3, SLAM_FRAME + 8],
            [0, 0.35, 0.1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          ),
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
}
