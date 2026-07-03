import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { createNoise2D } from 'simplex-noise';
import { PALETTE, FONTS, MOTION } from '../theme';

// Camera Shake Scene: a masked portal/circle in the center reveals a gradient animation.
// Multi-axis SimplexNoise camera shake that intensifies over the scene duration.
// Noise instance created at module level for performance and determinism.

const noise2D = createNoise2D();

// Portal dimensions
const PORTAL_RADIUS_FACTOR = 0.35; // fraction of min(w,h)

// Shake intensity ramp: grows from 0 at start to SHAKE_MAX at end
const SHAKE_MAX_X  = 28;  // max horizontal shake px
const SHAKE_MAX_Y  = 18;  // max vertical shake px
const SHAKE_MAX_R  = 1.8; // max rotation degrees
const SHAKE_SPEED  = 0.045; // noise walk speed per frame

export default function CameraShakeScene() {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  const cx = width  / 2;
  const cy = height / 2;
  const portalRadius = PORTAL_RADIUS_FACTOR * Math.min(width, height);

  // --- Shake intensity ramp (linear 0 → 1 over scene) ---
  const shakeIntensity = interpolate(
    frame,
    [0, durationInFrames * 0.2, durationInFrames],
    [0, 0.15, 1],
    { extrapolateRight: 'clamp' }
  );

  // --- Multi-axis SimplexNoise shake ---
  // Different noise offsets per axis so they don't correlate
  const noiseX = noise2D(frame * SHAKE_SPEED,       0.0) * SHAKE_MAX_X * shakeIntensity;
  const noiseY = noise2D(frame * SHAKE_SPEED + 100, 0.0) * SHAKE_MAX_Y * shakeIntensity;
  const noiseR = noise2D(frame * SHAKE_SPEED + 200, 0.0) * SHAKE_MAX_R * shakeIntensity;
  // Secondary high-frequency tremor that kicks in at high intensity
  const tremorX = noise2D(frame * SHAKE_SPEED * 4.5, 10) * 6 * Math.max(0, shakeIntensity - 0.5);
  const tremorY = noise2D(frame * SHAKE_SPEED * 4.5, 20) * 4 * Math.max(0, shakeIntensity - 0.5);

  const totalShakeX = noiseX + tremorX;
  const totalShakeY = noiseY + tremorY;

  // --- Portal entrance spring ---
  const portalScale = spring({
    frame,
    fps,
    config: MOTION.heavy,
    from: 0,
    to: 1,
  });

  // --- Gradient animation inside the portal ---
  // Hue rotates slowly over the scene
  const gradientHue1 = (frame * 0.8) % 360;
  const gradientHue2 = (gradientHue1 + 120) % 360;
  const gradientHue3 = (gradientHue1 + 240) % 360;
  // Gradient origin slowly drifts
  const gradOriginX = 50 + 30 * Math.sin(frame * 0.02);
  const gradOriginY = 50 + 20 * Math.cos(frame * 0.03);

  const portalGradient = `radial-gradient(
    ellipse at ${gradOriginX}% ${gradOriginY}%,
    hsl(${gradientHue1},90%,60%) 0%,
    hsl(${gradientHue2},80%,40%) 40%,
    hsl(${gradientHue3},70%,20%) 100%
  )`;

  // --- Dark background pulse synced to shake intensity ---
  const bgLightness = interpolate(shakeIntensity, [0, 1], [5, 12]);
  const bgColor     = `hsl(240, 20%, ${bgLightness}%)`;

  // Unique SVG clip path ID
  const clipId = 'portal-clip';

  return (
    <AbsoluteFill
      style={{
        background: bgColor,
        overflow:   'hidden',
        // The entire scene gets camera shake applied
        transform:  `translate(${totalShakeX}px, ${totalShakeY}px) rotate(${noiseR}deg)`,
        transformOrigin: `${cx}px ${cy}px`,
      }}
    >
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
      >
        <defs>
          {/* Circular clip mask for the portal */}
          <clipPath id={clipId}>
            <circle
              cx={cx}
              cy={cy}
              r={portalRadius * portalScale}
            />
          </clipPath>

          {/* Vignette filter for portal edge */}
          <radialGradient id="portal-vignette" cx="50%" cy="50%" r="50%">
            <stop offset="70%"  stopColor="black" stopOpacity="0"   />
            <stop offset="100%" stopColor="black" stopOpacity="0.7" />
          </radialGradient>

          {/* Outer glow filter */}
          <filter id="portal-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Portal ring glow — outside the clip */}
        <circle
          cx={cx}
          cy={cy}
          r={portalRadius * portalScale}
          fill="none"
          stroke={`hsl(${gradientHue1}, 90%, 70%)`}
          strokeWidth={4}
          opacity={0.7 + shakeIntensity * 0.3}
          filter="url(#portal-glow)"
        />

        {/* Second glow ring, slightly larger */}
        <circle
          cx={cx}
          cy={cy}
          r={portalRadius * portalScale + 16}
          fill="none"
          stroke={`hsl(${gradientHue2}, 80%, 60%)`}
          strokeWidth={1.5}
          opacity={0.35 + shakeIntensity * 0.2}
        />

        {/* Portal content (gradient) clipped to circle */}
        <g clipPath={`url(#${clipId})`}>
          {/* Gradient background fill */}
          <foreignObject x={cx - portalRadius} y={cy - portalRadius} width={portalRadius * 2} height={portalRadius * 2}>
            <div
              style={{
                width:      portalRadius * 2,
                height:     portalRadius * 2,
                background: portalGradient,
              }}
            />
          </foreignObject>

          {/* Vignette at portal edge */}
          <circle
            cx={cx}
            cy={cy}
            r={portalRadius * portalScale}
            fill="url(#portal-vignette)"
          />
        </g>
      </svg>

      {/* Content text inside the portal — also clipped conceptually by the portal, shown centered */}
      <div
        style={{
          position:   'absolute',
          inset:      0,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            textAlign:   'center',
            // Text is only legible in the portal region — clip it visually using the same radius
            clipPath:    `circle(${portalRadius * portalScale}px at ${cx}px ${cy}px)`,
            width:       width,
            display:     'flex',
            flexDirection: 'column',
            alignItems:  'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontFamily:    FONTS?.display ?? 'sans-serif',
              fontSize:      96,
              fontWeight:    900,
              color:         '#ffffff',
              textShadow:    '0 2px 30px rgba(0,0,0,0.8)',
              letterSpacing: '-3px',
              lineHeight:    1,
              opacity:       spring({ frame: frame - 15, fps, config: MOTION.snappy, from: 0, to: 1 }),
            }}
          >
            THE PORTAL
          </div>
          <div
            style={{
              fontFamily:    FONTS?.mono ?? 'monospace',
              fontSize:      18,
              color:         'rgba(255,255,255,0.7)',
              letterSpacing: '6px',
              marginTop:     16,
              textTransform: 'uppercase',
              opacity:       spring({ frame: frame - 25, fps, config: MOTION.snappy, from: 0, to: 1 }),
            }}
          >
            Shake intensifies
          </div>
        </div>
      </div>

      {/* Chromatic aberration overlay at high shake intensity */}
      <div
        style={{
          position:   'absolute',
          inset:      0,
          background: `rgba(255,0,0,${shakeIntensity * 0.04})`,
          mixBlendMode: 'screen',
          transform:  `translate(${totalShakeX * 0.5}px, 0)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position:   'absolute',
          inset:      0,
          background: `rgba(0,0,255,${shakeIntensity * 0.04})`,
          mixBlendMode: 'screen',
          transform:  `translate(${totalShakeX * -0.5}px, 0)`,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
}
