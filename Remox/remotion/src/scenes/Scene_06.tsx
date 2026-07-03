// Scene_06 | templates: centered-hero(3), focal-offset(1), lower-third(1), orbit(2)
// "A Long-Range Missile Won't Fix India's PL-15 Problem" — Swarajya Defence Video
// Scene 06: THE SILENT KILL WEB
// Total: 1262 frames @ 30fps | 7 phases | ALL DARK

import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Audio,
  staticFile,
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

// ── Shared spring helper ──────────────────────────────────────────────────────
function useSpring(
  frame: number,
  fps: number,
  delay: number,
  config: { damping: number; stiffness: number; mass?: number }
) {
  return spring({ frame: Math.max(0, frame - delay), fps, config });
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — CENTERED HERO | bg: solid-dark | dur=180f
// "So what is the NETWORK for?" fades in.
// "EVERYTHING ELSE." slams at frame 69.
// ══════════════════════════════════════════════════════════════════════════════
// Phase 1 | template: centered-hero | bg: dark
const Phase1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Question line: fades in gently via spring opacity at frame 10
  const questionP = useSpring(frame, fps, 10, MOTION.springSnappy);
  const questionOpacity = interpolate(questionP, [0, 1], [0, 1]);
  const questionY = interpolate(questionP, [0, 1], [20, 0]);

  // "EVERYTHING ELSE." scale-slam at frame 69
  const answerP = useSpring(frame, fps, 69, { damping: 10, stiffness: 200, mass: 0.9 });
  const answerOpacity = interpolate(answerP, [0, 1], [0, 1]);
  const answerScale = interpolate(answerP, [0, 1], [1.2, 1.0]);

  // Radial glow brightens when answer appears
  const glowOpacity = interpolate(frame, [69, 99], [0, 0.12], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 75% 65% at 50% 50%, rgba(90,169,255,${glowOpacity}) 0%, transparent 70%)`,
        }}
      />

      {/* SFX: ambient rise */}
      <Sequence from={0}>
        <Audio src={staticFile('sfx/rise.mp3')} volume={0.2} />
      </Sequence>

      {/* Content — vertically centered, left-padded for safe zone */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 160px 216px 160px',
          boxSizing: 'border-box',
          gap: 32,
        }}
      >
        {/* Question line */}
        <div
          style={{
            opacity: questionOpacity,
            transform: `translateY(${questionY}px)`,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 52,
              fontWeight: 600,
              color: PALETTE.onDarkMuted,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            {'So what is the '}
            <span
              style={{
                color: PALETTE.electric,
                fontWeight: 700,
              }}
            >
              NETWORK
            </span>
            {' for?'}
          </span>
        </div>

        {/* Answer slam */}
        <div
          style={{
            opacity: answerOpacity,
            transform: `scale(${answerScale})`,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 80,
              fontWeight: 800,
              color: PALETTE.electric,
              letterSpacing: '-0.02em',
              lineHeight: 1.0,
              textTransform: 'uppercase',
            }}
          >
            EVERYTHING ELSE.
          </span>
        </div>
      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — FOCAL OFFSET | bg: image | asset: s06_kj500.png | dur=210f
// KJ-500 AEW&C aircraft — holds the target track. Radar ripple rings.
// ══════════════════════════════════════════════════════════════════════════════
// Phase 2 | template: focal-offset | bg: image
const Phase2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Ken Burns: very gentle scale on image (square image in right panel)
  const imageScale = interpolate(frame, [0, 210], [1.0, 1.055], {
    extrapolateRight: 'clamp',
  });

  // Left panel content springs
  const labelP = useSpring(frame, fps, 8, MOTION.springSnappy);
  const labelY = interpolate(labelP, [0, 1], [16, 0]);

  const headlineP = useSpring(frame, fps, 22, MOTION.springSnappy);
  const headlineY = interpolate(headlineP, [0, 1], [20, 0]);

  const bodyP = useSpring(frame, fps, 40, MOTION.springSnappy);
  const bodyY = interpolate(bodyP, [0, 1], [18, 0]);

  // Overall fade in
  const fadeIn = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const RIPPLE_COUNT = 3;

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden', opacity: fadeIn }}>
      {/* ── RIGHT PANEL: KJ-500 image (55% width) ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '57%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <Img
          src={staticFile('s06_kj500.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 50%',
            transform: `scale(${imageScale})`,
            willChange: 'transform',
            filter: 'brightness(0.75) contrast(1.08)',
          }}
        />
        {/* Gradient feather on left edge of image */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 280,
            height: '100%',
            background:
              'linear-gradient(90deg, rgba(11,22,34,1) 0%, rgba(11,22,34,0.65) 40%, transparent 100%)',
          }}
        />
        {/* Dark vignette bottom */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, transparent 40%, rgba(11,22,34,0.72) 100%)',
          }}
        />
        {/* Multiply tint */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: PALETTE.dark,
            mixBlendMode: 'multiply',
            opacity: 0.22,
          }}
        />

        {/* ── Radar ripple rings — centered on aircraft in right panel ── */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none',
          }}
          viewBox="0 0 1094 1080"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Aircraft center approx: 50% width of right panel, 48% height */}
          {Array.from({ length: RIPPLE_COUNT }).map((_, i) => {
            const delay = i * 30;
            const rippleProgress = interpolate(
              frame - delay,
              [0, 90],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );
            const r = interpolate(rippleProgress, [0, 1], [20, 220]);
            const opacity = interpolate(rippleProgress, [0, 0.25, 1], [0, 0.55, 0]);
            return (
              <circle
                key={i}
                cx={547}
                cy={480}
                r={r}
                fill="none"
                stroke={PALETTE.electric}
                strokeWidth={1.5}
                opacity={opacity}
              />
            );
          })}
          {/* Additional looping ripples — second cycle */}
          {Array.from({ length: RIPPLE_COUNT }).map((_, i) => {
            const delay = i * 30 + 90;
            const rippleProgress = interpolate(
              frame - delay,
              [0, 90],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );
            const r = interpolate(rippleProgress, [0, 1], [20, 220]);
            const opacity = interpolate(rippleProgress, [0, 0.25, 1], [0, 0.45, 0]);
            return (
              <circle
                key={`b${i}`}
                cx={547}
                cy={480}
                r={r}
                fill="none"
                stroke={PALETTE.electric}
                strokeWidth={1.2}
                opacity={opacity}
              />
            );
          })}
        </svg>
      </div>

      {/* ── LEFT PANEL: text content ── */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '0 0 216px 100px',
          boxSizing: 'border-box',
          width: '46%',
          gap: 16,
        }}
      >
        {/* Label: THE EYES */}
        <div
          style={{
            opacity: labelP,
            transform: `translateY(${labelY}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '0.22em',
              color: PALETTE.electric,
              textTransform: 'uppercase',
            }}
          >
            THE EYES
          </span>
        </div>

        {/* Accent rule */}
        <div
          style={{
            width: interpolate(headlineP, [0, 1], [0, 60]),
            height: 3,
            background: PALETTE.secondary,
            borderRadius: 2,
          }}
        />

        {/* Headline: KJ-500 */}
        <div
          style={{
            opacity: headlineP,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 88,
              fontWeight: 800,
              color: PALETTE.onDark,
              letterSpacing: '-0.02em',
              lineHeight: 0.95,
            }}
          >
            KJ-500
          </span>
        </div>

        {/* Body copy */}
        <div
          style={{
            opacity: bodyP,
            transform: `translateY(${bodyY}px)`,
            marginTop: 12,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 30,
              fontWeight: 400,
              color: PALETTE.onDarkMuted,
              letterSpacing: '0.01em',
              lineHeight: 1.45,
            }}
          >
            holds the target track
          </span>
        </div>
      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — LOWER THIRD | bg: image | asset: s06_fighter_cold.png | dur=178f
// "RADAR-COLD." stamps at frame 110. Cold blue-white letters.
// ══════════════════════════════════════════════════════════════════════════════
// Phase 3 | template: lower-third | bg: image
const Phase3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Very slow Ken Burns: scale 1.0 → 1.03 only
  const imageScale = interpolate(frame, [0, 178], [1.0, 1.03], {
    extrapolateRight: 'clamp',
  });

  // "RADAR-COLD." stamp at frame 110
  const stampP = useSpring(frame, fps, 110, { damping: 11, stiffness: 260, mass: 0.8 });
  const stampScale = interpolate(stampP, [0, 1], [1.18, 1.0]);
  const stampOpacity = interpolate(stampP, [0, 0.4, 1], [0, 1, 1]);

  // Supporting sublabel at frame 130
  const subP = useSpring(frame, fps, 130, MOTION.springSnappy);
  const subOpacity = interpolate(subP, [0, 1], [0, 1]);
  const subY = interpolate(subP, [0, 1], [14, 0]);

  // Overall fade in
  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cold blue-white: #B8D4FF
  const COLD_BLUE = '#B8D4FF';

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden', opacity: fadeIn }}>
      {/* Full-bleed fighter image */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={staticFile('s06_fighter_cold.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 40%',
            transform: `scale(${imageScale})`,
            willChange: 'transform',
            filter: 'brightness(0.55) contrast(1.12) saturate(0.6) hue-rotate(10deg)',
          }}
        />
        {/* Heavy bottom vignette for lower-third text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(11,22,34,0.18) 0%, rgba(11,22,34,0.1) 40%, rgba(11,22,34,0.88) 80%, rgba(11,22,34,0.96) 100%)',
          }}
        />
        {/* Top vignette */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 180,
            background:
              'linear-gradient(180deg, rgba(11,22,34,0.65) 0%, transparent 100%)',
          }}
        />
        {/* Multiply tint — cool/blue */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#0a1830',
            mixBlendMode: 'multiply',
            opacity: 0.28,
          }}
        />
      </AbsoluteFill>

      {/* Lower-third text zone — bottom left, above safe zone */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '0 0 260px 100px',
          boxSizing: 'border-box',
          gap: 12,
        }}
      >
        {/* "RADAR-COLD." cold blue-white stamp */}
        <div
          style={{
            opacity: stampOpacity,
            transform: `scale(${stampScale})`,
            transformOrigin: 'left center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 96,
              fontWeight: 900,
              color: COLD_BLUE,
              letterSpacing: '-0.025em',
              lineHeight: 1.0,
              textShadow: `0 0 40px rgba(184,212,255,0.35), 0 0 80px rgba(90,169,255,0.18)`,
            }}
          >
            RADAR-COLD.
          </span>
        </div>

        {/* Sub-label */}
        <div
          style={{
            opacity: subOpacity,
            transform: `translateY(${subY}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '0.18em',
              color: PALETTE.onDarkMuted,
              textTransform: 'uppercase',
            }}
          >
            FIGHTER RUNNING SILENT — NO EMISSIONS
          </span>
        </div>
      </AbsoluteFill>

      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SHARED ORBIT DIAGRAM DATA
// Used by Phase4 and Phase5 to maintain consistent diagram state
// ══════════════════════════════════════════════════════════════════════════════

// Diagram coordinates (SVG viewBox 1920×1080)
const ORBIT = {
  // Missile center chevron
  missile: { x: 960, y: 540 },
  // AEW&C satellite — top center
  aewc: { x: 960, y: 240 },
  // Ground radar — bottom left
  groundRadar: { x: 660, y: 720 },
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — ORBIT DIAGRAM | bg: solid-dark | dur=166f
// Satellites appear, dashed datalink lines draw, "UNTRACEABLE" label.
// ══════════════════════════════════════════════════════════════════════════════
// Phase 4 | template: panoramic-flow | bg: dark
const Phase4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Missile chevron entrance
  const missileP = useSpring(frame, fps, 6, MOTION.springSnappy);
  const missileOpacity = interpolate(missileP, [0, 1], [0, 1]);
  const missileScale = interpolate(missileP, [0, 1], [0.6, 1.0]);

  // Satellite 1 (AEW&C) — appears at frame 20
  const sat1P = useSpring(frame, fps, 20, MOTION.springSnappy);
  const sat1Opacity = interpolate(sat1P, [0, 1], [0, 1]);
  const sat1Scale = interpolate(sat1P, [0, 1], [0.5, 1.0]);

  // Satellite 2 (ground radar) — appears at frame 35
  const sat2P = useSpring(frame, fps, 35, MOTION.springSnappy);
  const sat2Opacity = interpolate(sat2P, [0, 1], [0, 1]);
  const sat2Scale = interpolate(sat2P, [0, 1], [0.5, 1.0]);

  // Line draw via stroke-dasharray/dashoffset
  const LINE_LEN = 310;
  const line1Draw = useSpring(frame, fps, 30, { stiffness: 80, damping: 20, mass: 1.0 });
  const dashOffset1 = LINE_LEN * (1 - line1Draw);

  const line2Draw = useSpring(frame, fps, 45, { stiffness: 80, damping: 20, mass: 1.0 });
  const dashOffset2 = LINE_LEN * (1 - line2Draw);

  // "UNTRACEABLE" label at frame 100
  const untracP = useSpring(frame, fps, 100, MOTION.springSnappy);
  const untracOpacity = interpolate(untracP, [0, 1], [0, 1]);
  const untracY = interpolate(untracP, [0, 1], [16, 0]);

  // Node label entrances
  const nodeLabel1P = useSpring(frame, fps, 55, MOTION.springSnappy);
  const nodeLabel2P = useSpring(frame, fps, 70, MOTION.springSnappy);

  // Radial background glow
  const glowOpacity = interpolate(frame, [0, 40], [0, 0.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 80% 70% at 50% 50%, rgba(90,169,255,${glowOpacity * 10}) 0%, transparent 70%)`,
        }}
      />

      {/* SVG Orbit Diagram */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Dashed line: AEW&C → Missile */}
        <line
          x1={ORBIT.aewc.x}
          y1={ORBIT.aewc.y + 28}
          x2={ORBIT.missile.x}
          y2={ORBIT.missile.y - 28}
          stroke={PALETTE.electric}
          strokeWidth={2}
          strokeDasharray="8 6"
          strokeDashoffset={dashOffset1}
          opacity={0.7}
        />

        {/* Dashed line: Ground Radar → Missile */}
        <line
          x1={ORBIT.groundRadar.x + 28}
          y1={ORBIT.groundRadar.y - 18}
          x2={ORBIT.missile.x - 28}
          y2={ORBIT.missile.y + 18}
          stroke={PALETTE.electric}
          strokeWidth={2}
          strokeDasharray="8 6"
          strokeDashoffset={dashOffset2}
          opacity={0.7}
        />

        {/* ── MISSILE CENTER: arrow chevron ── */}
        <g
          transform={`translate(${ORBIT.missile.x}, ${ORBIT.missile.y})`}
          opacity={missileOpacity}
          style={{ transformOrigin: `${ORBIT.missile.x}px ${ORBIT.missile.y}px` }}
        >
          <g transform={`scale(${missileScale})`}>
            {/* Glow circle behind */}
            <circle r={44} fill="rgba(90,169,255,0.08)" stroke={PALETTE.electric} strokeWidth={1} opacity={0.5} />
            {/* Chevron/arrow pointing right */}
            <polygon
              points="-18,-14 14,0 -18,14 -8,0"
              fill={PALETTE.electric}
              opacity={0.9}
            />
            <circle r={28} fill="none" stroke={PALETTE.electric} strokeWidth={1.5} opacity={0.6} />
          </g>
        </g>

        {/* ── AEW&C SATELLITE (top) ── */}
        <g
          transform={`translate(${ORBIT.aewc.x}, ${ORBIT.aewc.y})`}
          opacity={sat1Opacity}
        >
          <g transform={`scale(${sat1Scale})`}>
            <circle r={32} fill={PALETTE.darkAlt} stroke={PALETTE.electric} strokeWidth={2} />
            {/* Simple aircraft silhouette lines */}
            <line x1="-20" y1="0" x2="20" y2="0" stroke={PALETTE.electric} strokeWidth={2.5} />
            <line x1="0" y1="-12" x2="0" y2="12" stroke={PALETTE.electric} strokeWidth={2} />
            <line x1="8" y1="6" x2="16" y2="10" stroke={PALETTE.electric} strokeWidth={1.5} />
          </g>
        </g>

        {/* AEW&C label */}
        <text
          x={ORBIT.aewc.x + 48}
          y={ORBIT.aewc.y - 8}
          fill={PALETTE.electric}
          fontFamily={FONTS.mono}
          fontSize={22}
          fontWeight={500}
          letterSpacing="0.12em"
          opacity={nodeLabel1P}
        >
          AEW&amp;C
        </text>
        <text
          x={ORBIT.aewc.x + 48}
          y={ORBIT.aewc.y + 18}
          fill={PALETTE.onDarkMuted}
          fontFamily={FONTS.body}
          fontSize={20}
          opacity={nodeLabel1P}
        >
          KJ-500
        </text>

        {/* ── GROUND RADAR (bottom-left) ── */}
        <g
          transform={`translate(${ORBIT.groundRadar.x}, ${ORBIT.groundRadar.y})`}
          opacity={sat2Opacity}
        >
          <g transform={`scale(${sat2Scale})`}>
            <circle r={28} fill={PALETTE.darkAlt} stroke={PALETTE.accent} strokeWidth={2} />
            {/* Radar dish shape */}
            <path
              d="M -14 8 Q 0 -20 14 8 Z"
              fill="none"
              stroke={PALETTE.accent}
              strokeWidth={2}
            />
            <line x1="0" y1="8" x2="0" y2="14" stroke={PALETTE.accent} strokeWidth={2} />
            <line x1="-8" y1="14" x2="8" y2="14" stroke={PALETTE.accent} strokeWidth={2} />
          </g>
        </g>

        {/* Ground radar label */}
        <text
          x={ORBIT.groundRadar.x - 48}
          y={ORBIT.groundRadar.y - 10}
          fill={PALETTE.accent}
          fontFamily={FONTS.mono}
          fontSize={22}
          fontWeight={500}
          letterSpacing="0.12em"
          textAnchor="end"
          opacity={nodeLabel2P}
        >
          GND RADAR
        </text>
        <text
          x={ORBIT.groundRadar.x - 48}
          y={ORBIT.groundRadar.y + 16}
          fill={PALETTE.onDarkMuted}
          fontFamily={FONTS.body}
          fontSize={20}
          textAnchor="end"
          opacity={nodeLabel2P}
        >
          IADS link
        </text>
      </svg>

      {/* "UNTRACEABLE" label — bottom center, above safe zone */}
      <div
        style={{
          position: 'absolute',
          bottom: 260,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: untracOpacity,
          transform: `translateY(${untracY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '0.28em',
            color: PALETTE.onDark,
            textTransform: 'uppercase',
            borderBottom: `2px solid ${PALETTE.electric}`,
            paddingBottom: 8,
          }}
        >
          UNTRACEABLE
        </span>
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — ORBIT DIAGRAM CONTINUED | bg: solid-dark | dur=202f
// Pulsing data packets travel along links. At frame 124 seeker cone flares red.
// "DATALINK / FINAL SECONDS"
// ══════════════════════════════════════════════════════════════════════════════
// Phase 5 | template: panoramic-flow | bg: dark
const Phase5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Traveling data packet along line 1 (AEW&C → missile) — cycles every 60 frames
  const cycle1 = (frame % 60) / 60;
  // Traveling data packet along line 2 (ground → missile) — offset by 20 frames
  const cycle2 = ((frame + 20) % 60) / 60;

  // Line 1 path: from AEW&C bottom (960, 268) → missile top (960, 512)
  const packet1X = interpolate(cycle1, [0, 1], [ORBIT.aewc.x, ORBIT.missile.x]);
  const packet1Y = interpolate(cycle1, [0, 1], [ORBIT.aewc.y + 28, ORBIT.missile.y - 28]);

  // Line 2 path: from GND radar right (688, 702) → missile bottom-left (932, 558)
  const packet2X = interpolate(cycle2, [0, 1], [ORBIT.groundRadar.x + 28, ORBIT.missile.x - 28]);
  const packet2Y = interpolate(cycle2, [0, 1], [ORBIT.groundRadar.y - 18, ORBIT.missile.y + 18]);

  // Packet pulse opacity — bright at center of travel, dim at ends
  const pulseFn = (c: number) => interpolate(c, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);

  // At frame 124: seeker cone flares red
  const coneP = useSpring(frame, fps, 124, { damping: 10, stiffness: 280, mass: 0.8 });
  const coneOpacity = interpolate(coneP, [0, 1], [0, 0.85]);
  const coneScale = interpolate(coneP, [0, 1], [0.3, 1.0]);

  // Datalink label entrance
  const labelP = useSpring(frame, fps, 14, MOTION.springSnappy);
  const labelOpacity = interpolate(labelP, [0, 1], [0, 1]);
  const labelY = interpolate(labelP, [0, 1], [18, 0]);

  // "FINAL SECONDS" subtitle at frame 130
  const finalP = useSpring(frame, fps, 130, MOTION.springSnappy);
  const finalOpacity = interpolate(finalP, [0, 1], [0, 1]);
  const finalY = interpolate(finalP, [0, 1], [16, 0]);

  // Missile pulse glow — accelerates after frame 124
  const missilePulseBase = Math.sin((frame / 15) * Math.PI) * 0.5 + 0.5;
  const missileGlowIntensity = frame >= 124
    ? interpolate(missilePulseBase, [0, 1], [0.12, 0.32])
    : interpolate(missilePulseBase, [0, 1], [0.05, 0.12]);

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Radial glow — intensifies after cone flare */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: frame >= 124
            ? `radial-gradient(ellipse 60% 55% at 50% 50%, rgba(196,55,59,${missileGlowIntensity}) 0%, rgba(90,169,255,0.06) 60%, transparent 80%)`
            : `radial-gradient(ellipse 75% 65% at 50% 50%, rgba(90,169,255,0.09) 0%, transparent 70%)`,
        }}
      />

      {/* SVG Orbit Diagram — persistent state */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Dashed datalink lines — always visible (inherited from Phase 4) */}
        <line
          x1={ORBIT.aewc.x}
          y1={ORBIT.aewc.y + 28}
          x2={ORBIT.missile.x}
          y2={ORBIT.missile.y - 28}
          stroke={PALETTE.electric}
          strokeWidth={2}
          strokeDasharray="8 6"
          opacity={0.55}
        />
        <line
          x1={ORBIT.groundRadar.x + 28}
          y1={ORBIT.groundRadar.y - 18}
          x2={ORBIT.missile.x - 28}
          y2={ORBIT.missile.y + 18}
          stroke={PALETTE.electric}
          strokeWidth={2}
          strokeDasharray="8 6"
          opacity={0.55}
        />

        {/* ── Traveling data packets ── */}
        {/* Packet on line 1 (AEW&C → missile) */}
        <circle
          cx={packet1X}
          cy={packet1Y}
          r={5}
          fill={PALETTE.electric}
          opacity={pulseFn(cycle1)}
        />
        <circle
          cx={packet1X}
          cy={packet1Y}
          r={9}
          fill="none"
          stroke={PALETTE.electric}
          strokeWidth={1}
          opacity={pulseFn(cycle1) * 0.4}
        />

        {/* Packet on line 2 (ground → missile) */}
        <circle
          cx={packet2X}
          cy={packet2Y}
          r={5}
          fill={PALETTE.electric}
          opacity={pulseFn(cycle2)}
        />
        <circle
          cx={packet2X}
          cy={packet2Y}
          r={9}
          fill="none"
          stroke={PALETTE.electric}
          strokeWidth={1}
          opacity={pulseFn(cycle2) * 0.4}
        />

        {/* ── MISSILE CENTER ── */}
        <g transform={`translate(${ORBIT.missile.x}, ${ORBIT.missile.y})`}>
          {/* Glow ring — pulsing */}
          <circle r={54} fill={`rgba(90,169,255,${missileGlowIntensity})`} />
          <circle r={44} fill="rgba(90,169,255,0.06)" stroke={PALETTE.electric} strokeWidth={1.5} opacity={0.6} />
          <polygon
            points="-18,-14 14,0 -18,14 -8,0"
            fill={PALETTE.electric}
            opacity={0.9}
          />
          <circle r={28} fill="none" stroke={PALETTE.electric} strokeWidth={1.5} opacity={0.6} />

          {/* Seeker cone — flares red at frame 124 */}
          <g opacity={coneOpacity} transform={`scale(${coneScale})`}>
            {/* Red forward-facing seeker cone */}
            <polygon
              points="14,0 80,-40 80,40"
              fill={PALETTE.secondary}
              opacity={0.5}
            />
            <polygon
              points="14,0 80,-40 80,40"
              fill="none"
              stroke={PALETTE.secondary}
              strokeWidth={2}
              opacity={0.85}
            />
            {/* Inner brighter cone */}
            <polygon
              points="14,0 55,-22 55,22"
              fill={PALETTE.secondary}
              opacity={0.25}
            />
          </g>
        </g>

        {/* ── AEW&C NODE (persistent) ── */}
        <g transform={`translate(${ORBIT.aewc.x}, ${ORBIT.aewc.y})`}>
          <circle r={32} fill={PALETTE.darkAlt} stroke={PALETTE.electric} strokeWidth={2} />
          <line x1="-20" y1="0" x2="20" y2="0" stroke={PALETTE.electric} strokeWidth={2.5} />
          <line x1="0" y1="-12" x2="0" y2="12" stroke={PALETTE.electric} strokeWidth={2} />
        </g>
        <text x={ORBIT.aewc.x + 48} y={ORBIT.aewc.y - 8} fill={PALETTE.electric} fontFamily={FONTS.mono} fontSize={22} fontWeight={500} letterSpacing="0.12em">AEW&amp;C</text>
        <text x={ORBIT.aewc.x + 48} y={ORBIT.aewc.y + 18} fill={PALETTE.onDarkMuted} fontFamily={FONTS.body} fontSize={20}>KJ-500</text>

        {/* ── GROUND RADAR NODE (persistent) ── */}
        <g transform={`translate(${ORBIT.groundRadar.x}, ${ORBIT.groundRadar.y})`}>
          <circle r={28} fill={PALETTE.darkAlt} stroke={PALETTE.accent} strokeWidth={2} />
          <path d="M -14 8 Q 0 -20 14 8 Z" fill="none" stroke={PALETTE.accent} strokeWidth={2} />
          <line x1="0" y1="8" x2="0" y2="14" stroke={PALETTE.accent} strokeWidth={2} />
          <line x1="-8" y1="14" x2="8" y2="14" stroke={PALETTE.accent} strokeWidth={2} />
        </g>
        <text x={ORBIT.groundRadar.x - 48} y={ORBIT.groundRadar.y - 10} fill={PALETTE.accent} fontFamily={FONTS.mono} fontSize={22} fontWeight={500} letterSpacing="0.12em" textAnchor="end">GND RADAR</text>
      </svg>

      {/* Text: "DATALINK" label — top left */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 100,
          opacity: labelOpacity,
          transform: `translateY(${labelY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.22em',
            color: PALETTE.electric,
            textTransform: 'uppercase',
          }}
        >
          DATALINK
        </span>
      </div>

      {/* "FINAL SECONDS" — appears at frame 130, bottom left above safe zone */}
      <div
        style={{
          position: 'absolute',
          bottom: 260,
          left: 100,
          opacity: finalOpacity,
          transform: `translateY(${finalY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 42,
            fontWeight: 700,
            color: PALETTE.secondary,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          FINAL SECONDS
        </span>
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 6 — CENTERED HERO | bg: solid-dark | dur=199f
// "THE SILENT KILL WEB" hero headline with web lines behind.
// At frame 117: "The missile is the bullet." springs in.
// ══════════════════════════════════════════════════════════════════════════════
// Phase 6 | template: centered-hero | bg: dark
const Phase6: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Hero headline entrance
  const heroP = useSpring(frame, fps, 10, MOTION.springSnappy);
  const heroOpacity = interpolate(heroP, [0, 1], [0, 1]);
  const heroY = interpolate(heroP, [0, 1], [28, 0]);

  // Web lines fade in with headline
  const webLinesOpacity = interpolate(frame, [8, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "The missile is the bullet." at frame 117
  const bulletP = useSpring(frame, fps, 117, MOTION.springSnappy);
  const bulletOpacity = interpolate(bulletP, [0, 1], [0, 1]);
  const bulletY = interpolate(bulletP, [0, 1], [18, 0]);

  // Web lines: 12 lines radiating at 30° intervals from center (960, 500)
  const WEB_CENTER = { x: 960, y: 500 };
  const WEB_LINES = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 * Math.PI) / 180;
    const len = 480 + Math.sin(i * 1.2) * 80;
    return {
      x2: WEB_CENTER.x + Math.cos(angle) * len,
      y2: WEB_CENTER.y + Math.sin(angle) * len,
    };
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* ── Web lines behind text — blend screen for glow ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          mixBlendMode: 'screen',
          opacity: webLinesOpacity * 0.35,
        }}
      >
        <svg
          style={{ width: '100%', height: '100%' }}
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid meet"
        >
          {WEB_LINES.map((line, i) => (
            <line
              key={i}
              x1={WEB_CENTER.x}
              y1={WEB_CENTER.y}
              x2={line.x2}
              y2={line.y2}
              stroke={PALETTE.electric}
              strokeWidth={1}
              opacity={0.6 + Math.sin(i * 0.8) * 0.3}
            />
          ))}
          {/* Subtle intersection nodes along lines */}
          {WEB_LINES.map((line, i) => {
            const t = 0.45;
            return (
              <circle
                key={`n${i}`}
                cx={WEB_CENTER.x + (line.x2 - WEB_CENTER.x) * t}
                cy={WEB_CENTER.y + (line.y2 - WEB_CENTER.y) * t}
                r={2.5}
                fill={PALETTE.electric}
                opacity={0.5}
              />
            );
          })}
          {/* Concentric rings at center */}
          <circle cx={WEB_CENTER.x} cy={WEB_CENTER.y} r={60} fill="none" stroke={PALETTE.electric} strokeWidth={0.8} opacity={0.4} />
          <circle cx={WEB_CENTER.x} cy={WEB_CENTER.y} r={180} fill="none" stroke={PALETTE.electric} strokeWidth={0.6} opacity={0.25} />
          <circle cx={WEB_CENTER.x} cy={WEB_CENTER.y} r={320} fill="none" stroke={PALETTE.electric} strokeWidth={0.5} opacity={0.15} />
        </svg>
      </div>

      {/* Radial glow at center */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 55% at 50% 46%, rgba(90,169,255,0.1) 0%, transparent 70%)',
          opacity: webLinesOpacity,
        }}
      />

      {/* Hero headline + sub-line */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 120px 216px 120px',
          boxSizing: 'border-box',
          gap: 28,
        }}
      >
        {/* "THE SILENT KILL WEB" */}
        <div
          style={{
            opacity: heroOpacity,
            transform: `translateY(${heroY}px)`,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 84,
              fontWeight: 900,
              color: PALETTE.onDark,
              letterSpacing: '-0.02em',
              lineHeight: 1.0,
              textTransform: 'uppercase',
              textShadow: `0 0 60px rgba(90,169,255,0.25)`,
            }}
          >
            THE SILENT KILL WEB
          </span>
        </div>

        {/* Thin divider line */}
        <div
          style={{
            width: interpolate(heroP, [0, 1], [0, 320]),
            height: 2,
            background: `linear-gradient(90deg, transparent, ${PALETTE.electric}, transparent)`,
          }}
        />

        {/* "The missile is the bullet." */}
        <div
          style={{
            opacity: bulletOpacity,
            transform: `translateY(${bulletY}px)`,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 36,
              fontWeight: 400,
              color: PALETTE.onDarkMuted,
              letterSpacing: '0.02em',
              lineHeight: 1.4,
              fontStyle: 'italic',
            }}
          >
            The missile is the bullet.
          </span>
        </div>
      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 7 — CENTERED HERO | bg: solid-dark | dur=235f
// "The radar plane is the gun." springs in at frame 0.
// Red warning lamp callback at frame 66.
// "Gets seconds." hard slam at frame 184. Stillness.
// ══════════════════════════════════════════════════════════════════════════════
// Phase 7 | template: centered-hero | bg: dark
const Phase7: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "The radar plane is the gun." — springs in immediately
  const gunP = useSpring(frame, fps, 0, MOTION.springSnappy);
  const gunOpacity = interpolate(gunP, [0, 1], [0, 1]);
  const gunY = interpolate(gunP, [0, 1], [22, 0]);

  // Small red warning lamp — appears at frame 66, pulses
  const lampP = useSpring(frame, fps, 66, MOTION.springSnappy);
  const lampOpacity = interpolate(lampP, [0, 1], [0, 1]);
  const lampScale = interpolate(lampP, [0, 1], [0.4, 1.0]);

  // Lamp pulse — stops after frame 184 (stillness)
  const lampPulse = frame < 184
    ? interpolate(Math.sin((frame / 18) * Math.PI), [-1, 1], [0.65, 1.0])
    : 0.65;

  // Lamp glow pulse
  const lampGlow = frame < 184
    ? interpolate(Math.sin((frame / 18) * Math.PI), [-1, 1], [12, 30])
    : 12;

  // "Gets seconds." hard slam at frame 184
  // After frame 184: stillness — no more motion
  const getP = useSpring(frame, fps, 184, { damping: 10, stiffness: 280, mass: 0.85 });
  const getOpacity = interpolate(getP, [0, 0.6, 1], [0, 1, 1]);
  const getScale = interpolate(getP, [0, 1], [1.22, 1.0]);

  // SFX impact at frame 184
  // Stillness: after 184, only the static "Gets seconds." text is shown

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Subtle vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 40%, rgba(11,22,34,0.55) 100%)',
        }}
      />

      {/* SFX: hard beat impact at frame 184 */}
      <Sequence from={184}>
        <Audio src={staticFile('sfx/impact.mp3')} volume={0.6} />
      </Sequence>

      {/* Content — centered column */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 120px 216px 120px',
          boxSizing: 'border-box',
          gap: 36,
        }}
      >
        {/* "The radar plane is the gun." */}
        <div
          style={{
            opacity: gunOpacity,
            transform: `translateY(${gunY}px)`,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 40,
              fontWeight: 400,
              color: PALETTE.onDarkMuted,
              letterSpacing: '0.01em',
              lineHeight: 1.4,
              fontStyle: 'italic',
            }}
          >
            The radar plane is the gun.
          </span>
        </div>

        {/* Red warning lamp — RWR callback from Scene 01 */}
        <div
          style={{
            opacity: lampOpacity * lampPulse,
            transform: `scale(${lampScale})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          {/* Glow circle */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: PALETTE.secondary,
              boxShadow: `0 0 ${lampGlow}px ${PALETTE.secondary}, 0 0 ${lampGlow * 2}px rgba(196,55,59,0.4)`,
            }}
          />
          {/* Label next to lamp */}
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '0.18em',
              color: PALETTE.secondary,
              textTransform: 'uppercase',
            }}
          >
            LAUNCH WARNING
          </span>
        </div>

        {/* "Gets seconds." — hard slam at frame 184 */}
        <div
          style={{
            opacity: getOpacity,
            transform: `scale(${getScale})`,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 72,
              fontWeight: 900,
              color: PALETTE.secondary,
              letterSpacing: '-0.02em',
              lineHeight: 1.0,
              textTransform: 'uppercase',
              textShadow: `0 0 40px rgba(196,55,59,0.4)`,
            }}
          >
            Gets seconds.
          </span>
        </div>
      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SCENE_06 ROOT — TransitionSeries wiring
// TSM MATH: (180+210+178+166+202+199+235) - 6×18 = 1370 - 108 = 1262 frames
//
// Transitions:
//   Ph1→Ph2: wipe  (solid-dark → image)
//   Ph2→Ph3: wipe  (image → image)
//   Ph3→Ph4: wipe  (image → solid-dark)
//   Ph4→Ph5: fade  (solid-dark → solid-dark)
//   Ph5→Ph6: fade  (solid-dark → solid-dark)
//   Ph6→Ph7: fade  (solid-dark → solid-dark)
// ══════════════════════════════════════════════════════════════════════════════
export default function Scene_06() {
  return (
    <AbsoluteFill style={{ background: PALETTE.dark }}>
      <TransitionSeries>
        {/* Phase 1: "So what is the NETWORK for?" — 180f */}
        <TransitionSeries.Sequence durationInFrames={250}>
          <Phase1 />
        </TransitionSeries.Sequence>

        {/* Transition 1→2: wipe (solid-dark → image) — 18f */}
        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: 18 })}
          presentation={wipe({ direction: 'from-left' })}
        />

        {/* Phase 2: KJ-500 focal-offset with radar ripples — 210f */}
        <TransitionSeries.Sequence durationInFrames={140}>
          <Phase2 />
        </TransitionSeries.Sequence>

        {/* Transition 2→3: wipe (image → image) — 18f */}
        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: 18 })}
          presentation={wipe({ direction: 'from-right' })}
        />

        {/* Phase 3: "RADAR-COLD." lower-third — 178f */}
        <TransitionSeries.Sequence durationInFrames={128}>
          <Phase3 />
        </TransitionSeries.Sequence>

        {/* Transition 3→4: wipe (image → solid-dark) — 18f */}
        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: 18 })}
          presentation={wipe({ direction: 'from-left' })}
        />

        {/* Phase 4: Orbit diagram — satellites appear, lines draw — 166f */}
        <TransitionSeries.Sequence durationInFrames={272}>
          <Phase4 />
        </TransitionSeries.Sequence>

        {/* Transition 4→5: fade (solid-dark → solid-dark) — 18f */}
        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: 18 })}
          presentation={fade()}
        />

        {/* Phase 5: Orbit diagram — data packets, cone flare — 202f */}
        <TransitionSeries.Sequence durationInFrames={186}>
          <Phase5 />
        </TransitionSeries.Sequence>

        {/* Transition 5→6: fade (solid-dark → solid-dark) — 18f */}
        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: 18 })}
          presentation={fade()}
        />

        {/* Phase 6: "THE SILENT KILL WEB" hero + web lines — 199f */}
        <TransitionSeries.Sequence durationInFrames={101}>
          <Phase6 />
        </TransitionSeries.Sequence>

        {/* Transition 6→7: fade (solid-dark → solid-dark) — 18f */}
        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: 18 })}
          presentation={fade()}
        />

        {/* Phase 7: "The radar plane is the gun." + red lamp + "Gets seconds." — 235f */}
        <TransitionSeries.Sequence durationInFrames={293}>
          <Phase7 />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
}
