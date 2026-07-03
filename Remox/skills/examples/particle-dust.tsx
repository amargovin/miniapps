import {
  AbsoluteFill,
  random,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// Lissajous curve: x = A * sin(a*t + delta), y = B * sin(b*t)
// Different a/b ratios produce different orbital patterns

const PARTICLE_COUNT = 200;

// Generate all particle parameters at module level — deterministic via seeded random
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  // Lissajous frequency ratios — classic values: 1:1, 1:2, 2:3, 3:4, 3:5
  const ratioChoices: [number, number][] = [
    [1, 1], [1, 2], [2, 3], [3, 4], [3, 5],
  ];
  const ratioIndex = Math.floor(random('lratio-' + i) * ratioChoices.length);
  const [freqA, freqB] = ratioChoices[ratioIndex];

  // Depth layer: 0 = far (small, dim), 1 = mid, 2 = near (large, bright, glow)
  const depth = Math.floor(random('ldepth-' + i) * 3);

  return {
    // Lissajous parameters
    freqA,
    freqB,
    delta:    random('ldelta-' + i) * Math.PI * 2,  // phase offset
    orbitalR: random('lorb-' + i) * 0.28 + 0.08,    // orbit radius as fraction of min(w,h)
    centerX:  random('lcx-' + i) * 0.7 + 0.15,      // orbit center X (normalized)
    centerY:  random('lcy-' + i) * 0.7 + 0.15,      // orbit center Y (normalized)
    speed:    random('lspd-' + i) * 0.018 + 0.006,   // radians per frame
    phaseOffset: random('lph-' + i) * Math.PI * 2,   // starting angle in orbit

    // Visual
    depth,
    size:    depth === 2 ? random('lsz-' + i) * 3 + 3
           : depth === 1 ? random('lsz-' + i) * 2 + 1.5
           :               random('lsz-' + i) * 1.5 + 0.5,
    baseOpacity: depth === 2 ? 0.85
               : depth === 1 ? 0.5
               :               0.2,
    colorIndex: Math.floor(random('lclr-' + i) * 3), // index into accent palette
    glowRadius: depth === 2 ? random('lglow-' + i) * 12 + 6 : 0,
  };
});

// Sort by depth so far particles render first (painter's algorithm)
const sortedParticles = [...particles].sort((a, b) => a.depth - b.depth);

export default function ParticleDust() {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Global fade in/out envelope
  const fadeIn  = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
  const globalOpacity = Math.min(fadeIn, fadeOut);

  const accentColors = [
    PALETTE.accent?.[0] ?? '#4fc3f7',
    PALETTE.accent?.[1] ?? '#81d4fa',
    PALETTE.accent?.[2] ?? '#b3e5fc',
  ];

  return (
    <AbsoluteFill style={{ background: PALETTE.background ?? '#0a0a0f', overflow: 'hidden' }}>
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <defs>
          {/* Glow filter for near-layer particles */}
          <filter id="particle-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {sortedParticles.map((p, i) => {
          // Current angle in Lissajous orbit
          const t = frame * p.speed + p.phaseOffset;

          // Lissajous position (normalized -1 to 1)
          const lx = Math.sin(p.freqA * t + p.delta);
          const ly = Math.sin(p.freqB * t);

          // Scale orbit to screen space
          const orbitPx = p.orbitalR * Math.min(width, height);
          const cx = p.centerX * width  + lx * orbitPx;
          const cy = p.centerY * height + ly * orbitPx;

          // Subtle twinkling via sin on depth-2 particles
          const twinkle = p.depth === 2
            ? 0.7 + 0.3 * Math.sin(frame * 0.15 + p.phaseOffset)
            : 1;

          const opacity = globalOpacity * p.baseOpacity * twinkle;
          const color   = accentColors[p.colorIndex];

          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={p.size}
              fill={color}
              opacity={opacity}
              filter={p.depth === 2 ? 'url(#particle-glow)' : undefined}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}
