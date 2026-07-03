import {
  AbsoluteFill,
  random,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// 500 depth-scaled circles flying toward the viewer
// Countdown 3 → 2 → 1 morphs in the center

const CIRCLE_COUNT = 500;

// Generate circle properties deterministically
const circles = Array.from({ length: CIRCLE_COUNT }, (_, i) => ({
  // Normalized position on the tunnel cross-section (-1 to 1)
  nx:    random('tnx-' + i) * 2 - 1,
  ny:    random('tny-' + i) * 2 - 1,
  // Base depth: 0 = far back, 1 = near/at-viewer
  baseDepth: random('tdp-' + i),
  // Each circle has its own speed so they don't move in lockstep
  speed: random('tspd-' + i) * 0.6 + 0.4,
  // Small noise drift so they wander slightly off-axis
  driftX: (random('tdx-' + i) - 0.5) * 0.3,
  driftY: (random('tdy-' + i) - 0.5) * 0.3,
  size:  random('tsz-' + i) * 2 + 1,
}));

// Sort far-to-near so overlap looks right
const sortedCircles = [...circles].sort((a, b) => a.baseDepth - b.baseDepth);

export default function TunnelCountdown() {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  const cx = width  / 2;
  const cy = height / 2;

  // --- Countdown timing ---
  // Divide the composition into thirds: 3, 2, 1
  const third = durationInFrames / 3;
  // 0 = "3", 1 = "2", 2 = "1"
  const countIndex = Math.min(Math.floor(frame / third), 2);
  const digits = ['3', '2', '1'];

  // Color progress: deep navy → electric blue as countdown advances
  const colorProgress = interpolate(frame, [0, durationInFrames], [0, 1]);
  const bgR = Math.round(interpolate(colorProgress, [0, 1], [4, 0]));
  const bgG = Math.round(interpolate(colorProgress, [0, 1], [8, 60]));
  const bgB = Math.round(interpolate(colorProgress, [0, 1], [32, 200]));
  const bgColor = `rgb(${bgR},${bgG},${bgB})`;

  // Circle hue shifts deep-blue → bright primary
  const circleH = Math.round(interpolate(colorProgress, [0, 1], [210, 190]));
  const circleS = Math.round(interpolate(colorProgress, [0, 1], [60, 100]));

  // Speed ramp: tunnel accelerates as countdown progresses
  const flySpeed = interpolate(frame, [0, durationInFrames], [0.4, 1.6]);

  // Digit morph: quick fade-out of old, fade-in of new at each third
  const frameInThird = frame % third;
  const morphOut = interpolate(frameInThird, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const morphIn  = interpolate(frameInThird, [third * 0.15, third * 0.35], [0, 1], { extrapolateRight: 'clamp' });
  const digitOpacity  = countIndex === 0 ? interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }) : morphIn;
  const digitScaleIn  = spring({ frame: frameInThird - Math.floor(third * 0.15), fps, config: MOTION.bouncy, from: 0.4, to: 1 });

  // Pulse on each new digit — scale briefly larger then snaps back
  const pulseFrame = frameInThird;
  const digitScale = spring({ frame: pulseFrame, fps, config: { damping: 6, stiffness: 160 }, from: 1.4, to: 1 });

  return (
    <AbsoluteFill style={{ background: bgColor, overflow: 'hidden' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <radialGradient id="tunnel-vignette" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={bgColor} stopOpacity="0" />
            <stop offset="80%"  stopColor={bgColor} stopOpacity="0" />
            <stop offset="100%" stopColor={bgColor} stopOpacity="0.9" />
          </radialGradient>
        </defs>

        {sortedCircles.map((c, i) => {
          // Animate depth from 0 to 1 cyclically, wrapping around
          const rawDepth = ((c.baseDepth + frame * c.speed * flySpeed * 0.004) % 1);
          // Perspective projection: depth 0 = tiny/far, depth 1 = huge/near
          const perspective = rawDepth * rawDepth; // quadratic feel

          const projectedX = cx + (c.nx + c.driftX * rawDepth) * cx * perspective * 1.6;
          const projectedY = cy + (c.ny + c.driftY * rawDepth) * cy * perspective * 1.6;
          const projectedR = c.size * perspective * 8 + 0.3;

          // Lightness increases as circles approach
          const lightness = Math.round(40 + perspective * 55);
          const circleColor = `hsl(${circleH},${circleS}%,${lightness}%)`;
          const circleOpacity = interpolate(rawDepth, [0, 0.1, 0.85, 1], [0, 0.7, 0.7, 0]);

          return (
            <circle
              key={i}
              cx={projectedX}
              cy={projectedY}
              r={Math.max(projectedR, 0.1)}
              fill={circleColor}
              opacity={circleOpacity}
            />
          );
        })}

        {/* Vignette overlay */}
        <rect width={width} height={height} fill="url(#tunnel-vignette)" />
      </svg>

      {/* Countdown digit — center overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontFamily: FONTS?.display ?? 'Impact, sans-serif',
            fontSize: 280,
            fontWeight: 900,
            color: '#ffffff',
            opacity: digitOpacity,
            transform: `scale(${countIndex === 0 ? digitScaleIn : digitScale})`,
            letterSpacing: '-8px',
            textShadow: `
              0 0 40px rgba(255,255,255,0.6),
              0 0 80px rgba(100,200,255,0.4),
              0 0 160px rgba(100,200,255,0.2)
            `,
            lineHeight: 1,
          }}
        >
          {digits[countIndex]}
        </span>
      </div>
    </AbsoluteFill>
  );
}
