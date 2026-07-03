// Scene_08 | templates: lower-third(3), focal-offset(3), centered-hero(2)
// "THE WEB ALREADY EXISTS" — PL-15 defence hybrid video
// Duration: 1419 frames | 8 phases | ALL DARK
// TransitionSeries: wipe for image↔solid, fade for image↔image and solid↔solid
// TSM: (217+151+159+231+159+260+177+191) - 7×18 = 1545 - 126 = 1419 ✓

import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Audio,
  staticFile,
  Easing,
  Sequence,
  Img,
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { wipe } from '@remotion/transitions/wipe';
import { fade } from '@remotion/transitions/fade';
import { PALETTE, FONTS, MOTION } from '../theme';

// ── Film grain ────────────────────────────────────────────────────────────────
const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      opacity,
      pointerEvents: 'none',
      mixBlendMode: 'overlay',
      backgroundImage: GRAIN_SVG,
      backgroundSize: '170px 170px',
      zIndex: 100,
    }}
  />
);

// ── Safe zone constants ────────────────────────────────────────────────────────
// No text in bottom 216px, no text in top-right ~300×200px
const SAFE_BOTTOM = 280; // clearance above subtitle zone (216px)
const SAFE_SIDE = 160;
const SAFE_TOP = 120;

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — THE WESTERN BORDER (lower-third, image, 217f)
// template: lower-third | asset: s08_region_map.png (16:9)
// Lateral westward drift (translateX: 40→0), fade-through-dark entrance
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 1 | template: lower-third | bg: image
const Phase1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = 217;

  // Fade-through-dark: fade in over first 18 frames
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ken Burns: lateral westward drift (right to center)
  const drift = interpolate(frame, [0, dur], [40, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Label entrance spring at frame 30
  const labelP = spring({ frame: Math.max(0, frame - 30), fps, config: MOTION.springSnappy });
  const labelY = interpolate(labelP, [0, 1], [20, 0]);

  // Tag line entrance at frame 48
  const tagP = spring({ frame: Math.max(0, frame - 48), fps, config: MOTION.springOverdamped });

  // Accent rule draws in at frame 38
  const ruleP = spring({ frame: Math.max(0, frame - 38), fps, config: MOTION.springSnappy });

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden', opacity: fadeIn }}>
      {/* Ambient rise SFX */}
      <Audio
        src={staticFile('sfx/rise.mp3')}
        volume={(f) => interpolate(f, [0, 10, dur - 20, dur], [0, 0.2, 0.2, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}
      />

      {/* Full-bleed map with lateral drift */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateX(${drift}px) scale(1.05)`,
          transformOrigin: '50% 50%',
        }}
      >
        <Img
          src={staticFile('images/s08_region_map.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 50%' }}
        />
      </div>

      {/* Bottom gradient scrim for text legibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(0deg, rgba(11,22,34,0.88) 0%, rgba(11,22,34,0.30) 35%, transparent 60%)',
        }}
      />

      {/* Edge vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 90% 80% at 50% 50%, transparent 38%, rgba(0,0,0,0.50) 100%)',
        }}
      />

      {/* LOWER THIRD — "THE WESTERN BORDER" above safe zone */}
      <div
        style={{
          position: 'absolute',
          bottom: SAFE_BOTTOM,
          left: SAFE_SIDE,
          opacity: labelP,
          transform: `translateY(${labelY}px)`,
        }}
      >
        {/* Pre-label bracket */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 10,
            opacity: tagP,
          }}
        >
          <div
            style={{
              width: 36,
              height: 1,
              background: PALETTE.electric,
              opacity: 0.55,
            }}
          />
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 400,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: 'rgba(90,169,255,0.55)',
            }}
          >
            ZONE OF CONCERN
          </div>
        </div>

        {/* Main label */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            color: PALETTE.onDark,
            textShadow: '0 2px 24px rgba(0,0,0,0.7)',
          }}
        >
          THE WESTERN BORDER
        </div>

        {/* Accent rule */}
        <div
          style={{
            width: 280,
            height: 2,
            background: PALETTE.electric,
            marginTop: 12,
            opacity: 0.55,
            transform: `scaleX(${ruleP})`,
            transformOrigin: 'left',
          }}
        />
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — J-10C + PL-15 (focal-offset, image, 151f)
// template: focal-offset | asset: s02_j10c.png (2048×2048 square)
// Headline slam then photo chip entrance
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 2 | template: focal-offset | bg: image
const Phase2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Photo panel: springs in from right at frame 0
  const photoP = spring({ frame: Math.max(0, frame - 0), fps, config: MOTION.springHeavy });
  const photoX = interpolate(photoP, [0, 1], [120, 0]);

  // "IT BOUGHT THE WEB." headline slams at frame 5
  const headlineP = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 12, stiffness: 280, mass: 0.9 } });
  const headlineScale = interpolate(
    spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 9, stiffness: 180, mass: 0.9 } }),
    [0, 1],
    [1.15, 1.0]
  );
  const headlineY = interpolate(headlineP, [0, 1], [30, 0]);

  // "J-10C + PL-15" body line at frame 30
  const bodyP = spring({ frame: Math.max(0, frame - 30), fps, config: MOTION.springSnappy });
  const bodyY = interpolate(bodyP, [0, 1], [18, 0]);

  // Sub detail at frame 52
  const subP = spring({ frame: Math.max(0, frame - 52), fps, config: MOTION.springOverdamped });

  // Left panel width: 45%
  const LEFT_W = 0.45 * 1920;

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Right photo panel — 55% width, square image */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '55%',
          height: '100%',
          opacity: photoP,
          transform: `translateX(${photoX}px)`,
        }}
      >
        <Img
          src={staticFile('images/s02_j10c.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' }}
        />
        {/* Left-edge fade into dark panel */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, rgba(11,22,34,1) 0%, rgba(11,22,34,0.3) 28%, transparent 55%)',
          }}
        />
      </div>

      {/* Left dark scrim panel */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: LEFT_W + 80,
          height: '100%',
          background: `linear-gradient(90deg, ${PALETTE.dark} 0%, ${PALETTE.dark} 70%, transparent 100%)`,
        }}
      />

      {/* Left panel text stack */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: LEFT_W,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: `${SAFE_TOP}px ${64}px ${SAFE_BOTTOM}px ${SAFE_SIDE}px`,
          gap: 0,
        }}
      >
        {/* Top micro-label */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'rgba(90,169,255,0.5)',
            marginBottom: 20,
            opacity: subP,
          }}
        >
          WHAT PAKISTAN ACQUIRED
        </div>

        {/* "IT BOUGHT THE WEB." — headline slam */}
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: PALETTE.onDark,
            lineHeight: 1.05,
            opacity: headlineP,
            transform: `translateY(${headlineY}px) scale(${headlineScale})`,
            transformOrigin: 'left center',
            marginBottom: 28,
          }}
        >
          IT BOUGHT
          <br />
          THE WEB.
        </div>

        {/* "J-10C + PL-15" — electric blue body */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: PALETTE.electric,
            opacity: bodyP,
            transform: `translateY(${bodyY}px)`,
            marginBottom: 16,
            textShadow: `0 0 20px rgba(90,169,255,0.4)`,
          }}
        >
          J-10C + PL-15
        </div>

        {/* Accent rule */}
        <div
          style={{
            width: 200,
            height: 2,
            background: PALETTE.electric,
            opacity: 0.4 * bodyP,
            transform: `scaleX(${bodyP})`,
            transformOrigin: 'left',
          }}
        />
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — HQ-9 + ERIEYE (focal-offset, image, 159f)
// template: focal-offset | asset: s08_hq9.png (2048×2048 square)
// Inventory build, mono counter stamps
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3 | template: focal-offset | bg: image
const Phase3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Photo panel
  const photoP = spring({ frame: Math.max(0, frame - 0), fps, config: MOTION.springHeavy });
  const photoX = interpolate(photoP, [0, 1], [100, 0]);

  // "HQ-9" red label at frame 8
  const labelP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springSnappy });

  // "9× ERIEYE AEW&C" headline at frame 18
  const headlineP = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 14, stiffness: 260, mass: 0.9 } });
  const headlineY = interpolate(headlineP, [0, 1], [28, 0]);

  // "ALREADY FLYING" mono stamp at frame 40
  const stampP = spring({ frame: Math.max(0, frame - 40), fps, config: MOTION.springSnappy });
  const stampScale = interpolate(
    spring({ frame: Math.max(0, frame - 40), fps, config: { damping: 10, stiffness: 220, mass: 0.8 } }),
    [0, 1],
    [1.18, 1.0]
  );

  // Counter items stagger in starting frame 55
  const item1P = spring({ frame: Math.max(0, frame - 55), fps, config: MOTION.springOverdamped });
  const item2P = spring({ frame: Math.max(0, frame - 60), fps, config: MOTION.springOverdamped });
  const item3P = spring({ frame: Math.max(0, frame - 69), fps, config: MOTION.springOverdamped });

  const LEFT_W = 0.45 * 1920;

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Right photo panel */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '55%',
          height: '100%',
          opacity: photoP,
          transform: `translateX(${photoX}px)`,
        }}
      >
        <Img
          src={staticFile('images/s08_hq9.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 40%' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, rgba(11,22,34,1) 0%, rgba(11,22,34,0.25) 30%, transparent 55%)',
          }}
        />
      </div>

      {/* Left dark panel gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: LEFT_W + 80,
          height: '100%',
          background: `linear-gradient(90deg, ${PALETTE.dark} 0%, ${PALETTE.dark} 72%, transparent 100%)`,
        }}
      />

      {/* Left text stack */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: LEFT_W,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: `${SAFE_TOP}px 64px ${SAFE_BOTTOM}px ${SAFE_SIDE}px`,
          gap: 0,
        }}
      >
        {/* "HQ-9" red label */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: PALETTE.secondary,
            opacity: labelP,
            marginBottom: 12,
            textShadow: `0 0 16px rgba(196,55,59,0.45)`,
          }}
        >
          HQ-9
        </div>

        {/* "9× ERIEYE AEW&C" headline */}
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 64,
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: PALETTE.onDark,
            lineHeight: 1.0,
            opacity: headlineP,
            transform: `translateY(${headlineY}px)`,
            marginBottom: 22,
          }}
        >
          9× ERIEYE
          <br />
          AEW&amp;C
        </div>

        {/* "ALREADY FLYING" mono stamp */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: PALETTE.electric,
            opacity: stampP,
            transform: `scale(${stampScale})`,
            transformOrigin: 'left center',
            marginBottom: 28,
            textShadow: `0 0 12px rgba(90,169,255,0.4)`,
          }}
        >
          ALREADY FLYING
        </div>

        {/* Inventory counter items */}
        {[
          { label: '4×', desc: 'Saab-2000 ERIEYE', delay: item1P },
          { label: '5×', desc: 'Saab-340 ERIEYE', delay: item2P },
          { label: '290km', desc: 'radar detection radius', delay: item3P },
        ].map(({ label, desc, delay }, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              marginBottom: 8,
              opacity: delay,
              transform: `translateX(${interpolate(delay, [0, 1], [-14, 0])}px)`,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 24,
                fontWeight: 700,
                color: PALETTE.electric,
                letterSpacing: '0.06em',
              }}
            >
              {label} {desc}
            </span>
          </div>
        ))}
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — KJ-500 (focal-offset, image, 231f)
// template: focal-offset | asset: s06_kj500.png (2048×2048 square)
// Stat digit-rolls at frame ~110
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 4 | template: focal-offset | bg: image
const Phase4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Photo panel
  const photoP = spring({ frame: Math.max(0, frame - 0), fps, config: MOTION.springHeavy });
  const photoX = interpolate(photoP, [0, 1], [100, 0]);

  // "KJ-500" label at frame 8
  const labelP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springSnappy });

  // Label text entrance at frame 22
  const headP = spring({ frame: Math.max(0, frame - 22), fps, config: MOTION.springOverdamped });
  const headY = interpolate(headP, [0, 1], [24, 0]);

  // Digit roll at frame 100→140
  const statValue = Math.round(
    interpolate(frame, [100, 140], [0, 470], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    })
  );
  const statP = spring({ frame: Math.max(0, frame - 100), fps, config: MOTION.springSnappy });

  // "CLAIMED DETECTION RANGE" body at frame 110
  const bodyP = spring({ frame: Math.max(0, frame - 110), fps, config: MOTION.springOverdamped });
  const bodyY = interpolate(bodyP, [0, 1], [18, 0]);

  // Sub-note at frame 130
  const noteP = spring({ frame: Math.max(0, frame - 130), fps, config: MOTION.springOverdamped });

  const LEFT_W = 0.45 * 1920;

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Right photo panel */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '55%',
          height: '100%',
          opacity: photoP,
          transform: `translateX(${photoX}px)`,
        }}
      >
        <Img
          src={staticFile('images/s06_kj500.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 35%' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, rgba(11,22,34,1) 0%, rgba(11,22,34,0.22) 28%, transparent 52%)',
          }}
        />
      </div>

      {/* Left dark panel */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: LEFT_W + 80,
          height: '100%',
          background: `linear-gradient(90deg, ${PALETTE.dark} 0%, ${PALETTE.dark} 72%, transparent 100%)`,
        }}
      />

      {/* Left text stack */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: LEFT_W,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: `${SAFE_TOP}px 64px ${SAFE_BOTTOM}px ${SAFE_SIDE}px`,
          gap: 0,
        }}
      >
        {/* "KJ-500" label */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: PALETTE.secondary,
            opacity: labelP,
            marginBottom: 10,
            textShadow: `0 0 16px rgba(196,55,59,0.4)`,
          }}
        >
          KJ-500
        </div>

        {/* Giant digit-roll stat: "470 KM" */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            marginBottom: 16,
            opacity: statP,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 120,
              fontWeight: 900,
              color: PALETTE.electric,
              lineHeight: 1.0,
              letterSpacing: '-0.04em',
              textShadow: `0 0 40px rgba(90,169,255,0.5)`,
            }}
          >
            {statValue}
          </span>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 40,
              fontWeight: 700,
              color: PALETTE.electric,
              letterSpacing: '0.08em',
              opacity: 0.75,
            }}
          >
            KM
          </span>
        </div>

        {/* "CLAIMED DETECTION RANGE" body */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: PALETTE.onDarkMuted,
            opacity: bodyP,
            transform: `translateY(${bodyY}px)`,
            marginBottom: 16,
          }}
        >
          CLAIMED DETECTION RANGE
        </div>

        {/* Accent rule */}
        <div
          style={{
            width: 220,
            height: 2,
            background: PALETTE.electric,
            opacity: 0.38 * bodyP,
            transform: `scaleX(${bodyP})`,
            transformOrigin: 'left',
            marginBottom: 14,
          }}
        />

      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — SUSPENSE BREATH (centered-hero, solid-dark, 159f)
// template: centered-hero | "Behind the hardware…"
// Vignette dims edges, eerie quiet
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 5 | template: centered-hero | bg: dark
const Phase5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = 159;

  // Text fades in at frame 14, letter-spacing
  const textP = spring({ frame: Math.max(0, frame - 14), fps, config: MOTION.springOverdamped });
  const textOpacity = interpolate(textP, [0, 1], [0, 1]);

  // Ellipsis pulse (the "…" breathes slightly)
  const breathe = 0.85 + 0.15 * Math.sin(frame * 0.08);

  // Exit fade
  const exitOpacity = interpolate(frame, [dur - 14, dur], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{ background: PALETTE.dark, overflow: 'hidden', opacity: exitOpacity }}
    >
      {/* Vignette: darkens from edges inward — the suspense breath */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(11,22,34,0.80) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Additional corner shadow press */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 20%, rgba(0,0,0,0.4) 100%)',
          opacity: 0.6,
        }}
      />

      {/* Centered text: "Behind the hardware…" */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${SAFE_TOP}px 200px ${SAFE_BOTTOM}px 200px`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 36,
            fontWeight: 400,
            letterSpacing: '0.25em',
            color: PALETTE.onDarkMuted,
            opacity: textOpacity,
            textAlign: 'center',
            fontStyle: 'italic',
          }}
        >
          Behind the hardware
          <span style={{ opacity: breathe }}>…</span>
        </div>

        {/* Thin horizontal accent below */}
        <div
          style={{
            width: 40,
            height: 1,
            background: PALETTE.electric,
            marginTop: 32,
            opacity: textOpacity * 0.35,
          }}
        />
      </AbsoluteFill>

      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6 — OPERATION SINDOOR SETUP (lower-third, solid-dark, 260f)
// template: lower-third (dark) | Quote marks draw in, attribution
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 6 | template: lower-third | bg: dark
const Phase6: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = 260;

  // Background subtle glow in
  const bgGlow = spring({ frame: Math.max(0, frame - 5), fps, config: MOTION.springOverdamped });

  // "OPERATION SINDOOR — DGMO TALKS" label at frame 18
  const labelP = spring({ frame: Math.max(0, frame - 18), fps, config: MOTION.springSnappy });
  const labelY = interpolate(labelP, [0, 1], [16, 0]);

  // Decorative large quote marks draw in via spring scale at frame 10
  const quoteMark = spring({ frame: Math.max(0, frame - 10), fps, config: MOTION.springSnappy });

  // Attribution line at frame 50
  const attrP = spring({ frame: Math.max(0, frame - 50), fps, config: MOTION.springOverdamped });
  const attrY = interpolate(attrP, [0, 1], [14, 0]);

  // Second attribution line at frame 70
  const attr2P = spring({ frame: Math.max(0, frame - 70), fps, config: MOTION.springOverdamped });

  // Accent rule draws at frame 30
  const ruleP = spring({ frame: Math.max(0, frame - 30), fps, config: MOTION.springSnappy });

  // Exit fade
  const exitOpacity = interpolate(frame, [dur - 14, dur], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{ background: PALETTE.dark, overflow: 'hidden', opacity: exitOpacity }}
    >
      {/* Radial glow on dark */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 60% 55% at 50% 48%, rgba(90,169,255,${0.04 * bgGlow}) 0%, transparent 68%)`,
        }}
      />

      {/* Large decorative background quote marks */}
      <div
        style={{
          position: 'absolute',
          top: '12%',
          left: SAFE_SIDE - 20,
          fontFamily: FONTS.heading,
          fontSize: 200,
          fontWeight: 900,
          color: PALETTE.electric,
          opacity: 0.12,
          lineHeight: 1,
          transform: `scale(${quoteMark})`,
          transformOrigin: 'left top',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        "
      </div>

      {/* Content — bottom 1/3 area, lower-third layout */}
      <div
        style={{
          position: 'absolute',
          bottom: SAFE_BOTTOM + 40,
          left: SAFE_SIDE,
          right: SAFE_SIDE,
        }}
      >
        {/* Accent top rule */}
        <div
          style={{
            width: 220,
            height: 2,
            background: PALETTE.secondary,
            marginBottom: 20,
            transform: `scaleX(${ruleP})`,
            transformOrigin: 'left',
            opacity: 0.75,
          }}
        />

        {/* "OPERATION SINDOOR — DGMO TALKS" */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: PALETTE.secondary,
            opacity: labelP,
            transform: `translateY(${labelY}px)`,
            marginBottom: 14,
            textShadow: `0 0 18px rgba(196,55,59,0.35)`,
          }}
        >
          OPERATION SINDOOR — DGMO TALKS
        </div>

        {/* Attribution line 1 */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 24,
            fontWeight: 400,
            fontStyle: 'italic',
            color: PALETTE.onDarkMuted,
            opacity: attrP,
            transform: `translateY(${attrY}px)`,
            marginBottom: 6,
          }}
        >
          as revealed by a senior Indian commander, July 2025
        </div>

        {/* Attribution line 2 — classified indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            opacity: attr2P,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: PALETTE.secondary,
              boxShadow: `0 0 8px rgba(196,55,59,0.6)`,
            }}
          />
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 400,
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.32)',
              textTransform: 'uppercase',
            }}
          >
            DGMO-LEVEL COMMUNICATION INTERCEPT
          </span>
        </div>
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 7 — THE QUOTE (centered-hero, solid-dark, 177f)
// template: centered-hero | typewriter quote + red underline at frame 82
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 7 | template: centered-hero | bg: dark
const Phase7: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = 177;

  // Impact SFX when text starts at frame 30
  // (Sequence from=30 handles this)

  // Typewriter: starts frame 5
  const quoteText = '“We know your vector is primed for action. Pull it back.”';
  const charsToShow = Math.floor(
    interpolate(frame, [5, 5 + quoteText.length * 2.5], [0, quoteText.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.linear,
    })
  );
  const displayedText = quoteText.slice(0, charsToShow);

  // Cursor blink (only show while typing, hide when done)
  const isTyping = charsToShow < quoteText.length;
  const cursor = isTyping ? (frame % 20 < 12 ? '|' : '') : '';

  // Red underline on "Pull it back." at frame 82 (spring scaleX)
  const underlineP = spring({ frame: Math.max(0, frame - 82), fps, config: MOTION.springSnappy });

  // Locate the "Pull it back." portion in the string for underline positioning
  // Full string: "We know your vector is primed for action. Pull it back."
  // We underline the last phrase

  // Exit fade
  const exitOpacity = interpolate(frame, [dur - 14, dur], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Attribution fade at frame 120
  const attrP = spring({ frame: Math.max(0, frame - 87), fps, config: MOTION.springOverdamped });

  return (
    <AbsoluteFill
      style={{ background: PALETTE.dark, overflow: 'hidden', opacity: exitOpacity }}
    >
      {/* Subtle radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 60% 50% at 50% 46%, rgba(90,169,255,0.04) 0%, transparent 65%)',
        }}
      />

      {/* Impact SFX at frame 30 */}
      <Sequence from={30}>
        <Audio
          src={staticFile('sfx/impact.mp3')}
          volume={(f) =>
            interpolate(f, [0, 2, 14, 26], [0, 0.5, 0.5, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      </Sequence>

      {/* Centered quote layout */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${SAFE_TOP + 40}px 240px ${SAFE_BOTTOM + 60}px 240px`,
        }}
      >
        {/* Small pre-label */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.28em',
            color: 'rgba(196,55,59,0.65)',
            textTransform: 'uppercase',
            marginBottom: 32,
            opacity: interpolate(frame, [5, 20], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          DIRECT COMMUNICATION
        </div>

        {/* Quote text with typewriter — split to highlight "Pull it back." */}
        <div
          style={{
            position: 'relative',
            fontFamily: FONTS.heading,
            fontSize: 44,
            fontWeight: 600,
            fontStyle: 'italic',
            color: PALETTE.onDark,
            lineHeight: 1.45,
            textAlign: 'center',
            maxWidth: 1100,
          }}
        >
          {/* We render entire typed text normally, then overlay underline on "Pull it back." */}
          {displayedText}
          <span style={{ color: PALETTE.electric, opacity: 0.8 }}>{cursor}</span>

          {/* Red underline on "Pull it back." — absolutely positioned below the last line */}
          {/* Approximate bottom-line position: font 44px, ~3 lines, last line */}
          <div
            style={{
              position: 'absolute',
              bottom: -8,
              right: 0,
              width: 260, // approximate width of "Pull it back."
              height: 3,
              background: PALETTE.secondary,
              transform: `scaleX(${underlineP})`,
              transformOrigin: 'right',
              borderRadius: 2,
              boxShadow: `0 0 10px rgba(196,55,59,0.5)`,
            }}
          />
        </div>

        {/* Attribution line */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 400,
            letterSpacing: '0.16em',
            color: 'rgba(255,255,255,0.32)',
            textTransform: 'uppercase',
            marginTop: 48,
            opacity: attrP,
            textAlign: 'center',
          }}
        >
          — Pakistan DGMO to Indian DGMO, May 2025
        </div>
      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 8 — MAP RETURNS + BEIJING DATALINK (lower-third, image, 186f)
// template: lower-third | SVG arc line Beijing→Pakistan, "It reaches Beijing." stamp
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 8 | template: lower-third | bg: image
const Phase8: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = 186;

  // Fade in
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Map Ken Burns: slow zoom out / settle
  const scale = interpolate(frame, [0, dur], [1.05, 1.02], {
    extrapolateRight: 'clamp',
  });

  // Beijing→Pakistan datalink draw starts frame 20
  const beiPath = 'M 1450 280 Q 1100 150 800 380';
  const pathLen = 750; // approximate path length
  const drawProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { stiffness: 80, damping: 20, mass: 1.0 },
  });
  const dashOffset = pathLen * (1 - drawProgress);

  // Dot pulse traveling along line
  const dotT = interpolate(drawProgress, [0, 1], [0, 1], { extrapolateRight: 'clamp' });

  // Node circles appear after draw: Beijing at frame 40, Pakistan at frame 50
  const beijingDotP = spring({ frame: Math.max(0, frame - 40), fps, config: MOTION.springBouncy });
  const pakDotP = spring({ frame: Math.max(0, frame - 50), fps, config: MOTION.springBouncy });

  // "It reaches Beijing." stamps at frame 141
  const stampP = spring({
    frame: Math.max(0, frame - 101),
    fps,
    config: { damping: 11, stiffness: 260, mass: 0.9 },
  });
  const stampScale = interpolate(
    spring({ frame: Math.max(0, frame - 101), fps, config: { damping: 9, stiffness: 180, mass: 0.9 } }),
    [0, 1],
    [1.22, 1.0]
  );
  const stampY = interpolate(stampP, [0, 1], [30, 0]);

  // Lower-third label entrance
  const labelP = spring({ frame: Math.max(0, frame - 28), fps, config: MOTION.springSnappy });
  const labelY = interpolate(labelP, [0, 1], [20, 0]);

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden', opacity: fadeIn }}>
      {/* Full-bleed map */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: '50% 50%',
        }}
      >
        <Img
          src={staticFile('images/s08_region_map.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 50%' }}
        />
      </div>

      {/* Bottom scrim */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(0deg, rgba(11,22,34,0.88) 0%, rgba(11,22,34,0.22) 38%, transparent 62%)',
        }}
      />

      {/* Edge vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 88% 80% at 50% 50%, transparent 36%, rgba(0,0,0,0.48) 100%)',
        }}
      />

      {/* SVG overlay: Beijing→Pakistan datalink arc */}
      <svg
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Datalink arc path */}
        <path
          d={beiPath}
          fill="none"
          stroke={PALETTE.electric}
          strokeWidth="2.5"
          strokeDasharray={`${pathLen}`}
          strokeDashoffset={`${dashOffset}`}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px rgba(90,169,255,0.55))`,
          }}
          opacity={0.9}
        />

        {/* Glow shadow pass (wider, lower opacity) */}
        <path
          d={beiPath}
          fill="none"
          stroke={PALETTE.electric}
          strokeWidth="6"
          strokeDasharray={`${pathLen}`}
          strokeDashoffset={`${dashOffset}`}
          strokeLinecap="round"
          opacity={0.18}
        />

        {/* Beijing node — pulsing circle */}
        <circle
          cx="1450"
          cy="280"
          r={8 * beijingDotP}
          fill={PALETTE.electric}
          opacity={beijingDotP * 0.9}
          style={{ filter: `drop-shadow(0 0 8px ${PALETTE.electric})` }}
        />
        <circle
          cx="1450"
          cy="280"
          r={16 + 8 * Math.sin(frame * 0.18) * beijingDotP}
          fill="none"
          stroke={PALETTE.electric}
          strokeWidth="1.5"
          opacity={0.3 * beijingDotP}
        />

        {/* Pakistan/Islamabad node */}
        <circle
          cx="800"
          cy="380"
          r={8 * pakDotP}
          fill={PALETTE.secondary}
          opacity={pakDotP * 0.9}
          style={{ filter: `drop-shadow(0 0 8px rgba(196,55,59,0.7))` }}
        />
        <circle
          cx="800"
          cy="380"
          r={16 + 8 * Math.sin(frame * 0.18) * pakDotP}
          fill="none"
          stroke={PALETTE.secondary}
          strokeWidth="1.5"
          opacity={0.28 * pakDotP}
        />

        {/* Node labels */}
        {beijingDotP > 0.5 && (
          <text
            x="1465"
            y="268"
            fontFamily={FONTS.mono}
            fontSize="13"
            fill="rgba(90,169,255,0.7)"
            letterSpacing="2"
            opacity={Math.min(1, (beijingDotP - 0.5) * 2)}
          >
            BEIJING
          </text>
        )}
        {pakDotP > 0.5 && (
          <text
            x="738"
            y="408"
            fontFamily={FONTS.mono}
            fontSize="13"
            fill="rgba(196,55,59,0.7)"
            letterSpacing="2"
            opacity={Math.min(1, (pakDotP - 0.5) * 2)}
          >
            ISLAMABAD
          </text>
        )}

        {/* Traveling dot along the arc */}
        {drawProgress > 0.05 && drawProgress < 0.95 && (
          <circle
            cx={(() => {
              // Quadratic bezier: P0=(1450,280), P1=(1100,150), P2=(800,380)
              const t = dotT;
              return (1 - t) * (1 - t) * 1450 + 2 * (1 - t) * t * 1100 + t * t * 800;
            })()}
            cy={(() => {
              const t = dotT;
              return (1 - t) * (1 - t) * 280 + 2 * (1 - t) * t * 150 + t * t * 380;
            })()}
            r="5"
            fill={PALETTE.electric}
            style={{ filter: `drop-shadow(0 0 8px ${PALETTE.electric})` }}
          />
        )}
      </svg>

      {/* "It reaches Beijing." stamp at frame 141 */}
      {stampP > 0.01 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) translateY(${stampY}px) scale(${stampScale})`,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 56,
              fontWeight: 900,
              letterSpacing: '0.08em',
              color: PALETTE.onDark,
              opacity: stampP,
              textShadow: `0 0 40px rgba(0,0,0,0.8), 0 2px 32px rgba(0,0,0,0.6)`,
              background: 'rgba(11,22,34,0.55)',
              padding: '12px 32px',
              borderRadius: 4,
              borderLeft: `3px solid ${PALETTE.electric}`,
            }}
          >
            It reaches{' '}
            <span
              style={{
                color: PALETTE.electric,
                textShadow: `0 0 20px rgba(90,169,255,0.6)`,
              }}
            >
              Beijing.
            </span>
          </div>
        </div>
      )}

      {/* LOWER THIRD label */}
      <div
        style={{
          position: 'absolute',
          bottom: SAFE_BOTTOM,
          left: SAFE_SIDE,
          opacity: labelP,
          transform: `translateY(${labelY}px)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: PALETTE.electric,
              boxShadow: `0 0 8px rgba(90,169,255,0.7)`,
            }}
          />
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 400,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: 'rgba(90,169,255,0.55)',
            }}
          >
            C2 DATALINK ARCHITECTURE
          </div>
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: PALETTE.onDark,
            textShadow: '0 2px 20px rgba(0,0,0,0.7)',
          }}
        >
          THE WEB ALREADY EXISTS
        </div>
        <div
          style={{
            width: 240,
            height: 2,
            background: PALETTE.electric,
            marginTop: 10,
            opacity: 0.5,
            transform: `scaleX(${spring({ frame: Math.max(0, frame - 35), fps, config: MOTION.springSnappy })})`,
            transformOrigin: 'left',
          }}
        />
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT — TransitionSeries
// All dark. Transitions:
//   image↔solid = wipe | image↔image = fade | solid↔solid = fade
// TSM: (217+151+159+231+159+260+177+191) - 7×18 = 1545 - 126 = 1419
// ═══════════════════════════════════════════════════════════════════════════════
export default function Scene_08() {
  const TRANSITION = 18; // frames per transition

  return (
    <TransitionSeries>
      {/* Phase 1 — image lower-third */}
      <TransitionSeries.Sequence durationInFrames={217}>
        <Phase1 />
      </TransitionSeries.Sequence>

      {/* T1: image→image (both dark) = fade */}
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 2 — focal-offset image */}
      <TransitionSeries.Sequence durationInFrames={151}>
        <Phase2 />
      </TransitionSeries.Sequence>

      {/* T2: image→image = fade */}
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 3 — focal-offset image */}
      <TransitionSeries.Sequence durationInFrames={159}>
        <Phase3 />
      </TransitionSeries.Sequence>

      {/* T3: image→image = fade */}
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 4 — focal-offset image */}
      <TransitionSeries.Sequence durationInFrames={231}>
        <Phase4 />
      </TransitionSeries.Sequence>

      {/* T4: image→solid = wipe */}
      <TransitionSeries.Transition
        presentation={wipe({ direction: 'from-right' })}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 5 — centered-hero solid dark */}
      <TransitionSeries.Sequence durationInFrames={159}>
        <Phase5 />
      </TransitionSeries.Sequence>

      {/* T5: solid→solid = fade */}
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 6 — lower-third solid dark */}
      <TransitionSeries.Sequence durationInFrames={260}>
        <Phase6 />
      </TransitionSeries.Sequence>

      {/* T6: solid→solid = fade */}
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 7 — centered-hero solid dark (quote) */}
      <TransitionSeries.Sequence durationInFrames={177}>
        <Phase7 />
      </TransitionSeries.Sequence>

      {/* T7: solid→image = wipe */}
      <TransitionSeries.Transition
        presentation={wipe({ direction: 'from-left' })}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 8 — image lower-third + Beijing datalink */}
      <TransitionSeries.Sequence durationInFrames={191}>
        <Phase8 />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
}
