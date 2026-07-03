// Scene_04 | templates: lower-third(1), centered-hero(4), focal-offset(1), stacked-reveal(1)
// "WARNED, NOT SURPRISED" — PL-15 defence hybrid video
// Duration: 1175 frames | 6 phases | Phases 1-4 DARK, Phases 5-6 CREAM
// TransitionSeries with 18-frame transitions (wipe for mode-shifts, fade for dark-dark)

import React from 'react';
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  spring, interpolate, Audio, staticFile, Img, Sequence,
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { wipe } from '@remotion/transitions/wipe';
import { fade } from '@remotion/transitions/fade';
import { PALETTE, FONTS, MOTION } from '../theme';

// ── Film grain ────────────────────────────────────────────────────────────────
const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => (
  <div style={{
    position: 'absolute', inset: 0, opacity, pointerEvents: 'none',
    mixBlendMode: 'overlay', backgroundImage: GRAIN_SVG, backgroundSize: '170px 170px',
    zIndex: 100,
  }} />
);

// Phase 1 | template: lower-third | bg: image
const Phase1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = 205;

  // Ken Burns: subtle zoom over the phase duration
  const scale = interpolate(frame, [0, dur], [1.0, 1.06], { extrapolateRight: 'clamp' });

  // Scan line sweeps left-to-right over first 60 frames
  const scanX = interpolate(frame, [0, 60], [-4, 1920], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scanOpacity = interpolate(frame, [0, 4, 55, 60], [0, 0.75, 0.75, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Secondary slower scan pass (adds depth)
  const scan2X = interpolate(frame, [20, 90], [-4, 1920], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scan2Opacity = interpolate(frame, [20, 24, 85, 90], [0, 0.3, 0.3, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Label entrance — spring in from below after scan
  const labelP = spring({ frame: Math.max(0, frame - 50), fps, config: MOTION.springSnappy });
  const labelY = interpolate(labelP, [0, 1], [24, 0]);

  // Faint vignette scrim on image
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: PALETTE.dark }}>
      {/* Full-bleed image with ken burns */}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${scale})`, transformOrigin: '50% 50%' }}>
        <Img
          src={staticFile('images/s04_recon_grid.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 50%' }}
        />
      </div>

      {/* Dark scrim for text legibility */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(0deg, rgba(11,22,34,0.78) 0%, rgba(11,22,34,0.18) 40%, transparent 65%)',
      }} />

      {/* Subtle edge vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 90% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.45) 100%)',
      }} />

      {/* Scan line 1 — primary fast sweep */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: scanX, width: 2,
        background: `linear-gradient(180deg, transparent 0%, ${PALETTE.electric} 30%, rgba(90,169,255,0.9) 50%, ${PALETTE.electric} 70%, transparent 100%)`,
        opacity: scanOpacity,
        boxShadow: `0 0 12px 4px rgba(90,169,255,0.4)`,
        pointerEvents: 'none',
      }} />

      {/* Scan line 2 — secondary softer sweep */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: scan2X, width: 1,
        background: `linear-gradient(180deg, transparent 0%, rgba(90,169,255,0.5) 50%, transparent 100%)`,
        opacity: scan2Opacity,
        pointerEvents: 'none',
      }} />

      {/* LOWER THIRD — label at bottom, safe zone respected (bottom: 280px) */}
      <div style={{
        position: 'absolute', bottom: 280, left: 160,
        opacity: labelP,
        transform: `translateY(${labelY}px)`,
      }}>
        {/* Accent bracket lines */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <div style={{ width: 40, height: 1, background: PALETTE.electric, opacity: 0.6 }} />
          <div style={{
            fontFamily: FONTS.mono, fontSize: 24, fontWeight: 400,
            letterSpacing: '0.28em', textTransform: 'uppercase',
            color: 'rgba(90,169,255,0.6)',
          }}>
            INTEL CLASS: SIGINT/IMINT
          </div>
        </div>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 28, fontWeight: 700,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          color: PALETTE.electric,
          textShadow: `0 0 20px rgba(90,169,255,0.5)`,
        }}>
          NEAR REAL TIME
        </div>
        <div style={{
          width: 320, height: 2, background: PALETTE.electric,
          marginTop: 10, opacity: 0.5,
          transform: `scaleX(${spring({ frame: Math.max(0, frame - 55), fps, config: MOTION.springSnappy })})`,
          transformOrigin: 'left',
        }} />
      </div>

      {/* HUD corner decoration — top left */}
      <div style={{
        position: 'absolute', top: 60, left: 60,
        fontFamily: FONTS.mono, fontSize: 24, letterSpacing: '0.15em',
        color: 'rgba(90,169,255,0.35)', textTransform: 'uppercase',
        opacity: labelP,
      }}>
        REC ● {String(Math.floor(frame / 30)).padStart(2, '0')}:{String((frame % 30)).padStart(2, '0')}
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// Phase 2 | template: centered-hero | bg: dark
const Phase2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "NOT SURPRISED." fades in early
  const notSurprisedP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springSnappy });
  const notSurprisedY = interpolate(notSurprisedP, [0, 1], [36, 0]);

  // Strikethrough line grows across "NOT SURPRISED." at frame 20
  const strikeP = spring({ frame: Math.max(0, frame - 20), fps, config: MOTION.springSnappy });

  // "WARNED." slams in at frame 87
  const warnedP = spring({ frame: Math.max(0, frame - 87), fps, config: { damping: 11, stiffness: 260, mass: 0.8 } });
  const warnedScale = interpolate(
    spring({ frame: Math.max(0, frame - 87), fps, config: { damping: 9, stiffness: 180, mass: 0.9 } }),
    [0, 1], [1.18, 1.0]
  );
  const warnedY = interpolate(warnedP, [0, 1], [52, 0]);

  // Body text — enters after "WARNED." settles
  const bodyP = spring({ frame: Math.max(0, frame - 110), fps, config: MOTION.springOverdamped });
  const bodyY = interpolate(bodyP, [0, 1], [18, 0]);

  // Fade out the "NOT SURPRISED." + strikethrough once WARNED. is in
  const notSurprisedOpacity = interpolate(frame, [95, 125], [1, 0.25], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Subtle electric glow pulse behind WARNED.
  const glowPulse = 0.7 + 0.3 * Math.sin(frame * 0.15);

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Radial glow center */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 55% 50% at 50% 45%, rgba(90,169,255,0.07) 0%, transparent 65%)',
      }} />

      {/* SFX whoosh on WARNED. slam */}
      <Sequence from={85}>
        <Audio
          src={staticFile('sfx/transition.mp3')}
          volume={(f) => interpolate(f, [0, 2, 18, 28], [0, 0.35, 0.35, 0], { extrapolateRight: 'clamp' })}
        />
      </Sequence>

      {/* Center layout */}
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '140px 200px 250px 200px',
        gap: 0,
      }}>

        {/* "NOT SURPRISED." with strikethrough */}
        <div style={{
          position: 'relative', display: 'inline-flex', alignItems: 'center',
          opacity: notSurprisedP * notSurprisedOpacity,
          transform: `translateY(${notSurprisedY}px)`,
          marginBottom: 14,
        }}>
          <div style={{
            fontFamily: FONTS.heading, fontSize: 72, fontWeight: 800,
            letterSpacing: '-0.02em', color: PALETTE.onDarkMuted,
            textAlign: 'center',
          }}>
            NOT SURPRISED.
          </div>
          {/* Strikethrough overlay */}
          <div style={{
            position: 'absolute', top: '50%', left: -4, right: -4, height: 5,
            background: PALETTE.secondary,
            transform: `scaleX(${strikeP})`,
            transformOrigin: 'left',
            borderRadius: 2,
            boxShadow: `0 0 10px rgba(196,55,59,0.6)`,
          }} />
        </div>

        {/* "WARNED." — electric blue slam */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: 120, fontWeight: 900,
          letterSpacing: '-0.03em', color: PALETTE.electric,
          opacity: warnedP,
          transform: `translateY(${warnedY}px) scale(${warnedScale})`,
          textAlign: 'center',
          textShadow: `0 0 ${40 * glowPulse * warnedP}px rgba(90,169,255,${0.6 * warnedP})`,
          lineHeight: 1.0,
        }}>
          WARNED.
        </div>

        {/* Body line */}
        <div style={{
          fontFamily: FONTS.body, fontSize: 28, fontWeight: 400,
          color: PALETTE.onDarkMuted, letterSpacing: '0.02em',
          textAlign: 'center', marginTop: 36,
          opacity: bodyP,
          transform: `translateY(${bodyY}px)`,
          fontStyle: 'italic',
          maxWidth: 760,
        }}>
          "A warned pilot does not turn to fight"
        </div>

      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// Phase 3 | template: focal-offset | bg: dark
const Phase3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Label entrance
  const labelP = spring({ frame: Math.max(0, frame - 10), fps, config: MOTION.springSnappy });

  // Left chevron (fighter) appears first
  const leftP = spring({ frame: Math.max(0, frame - 20), fps, config: MOTION.springOverdamped });
  // Right chevron appears
  const rightP = spring({ frame: Math.max(0, frame - 40), fps, config: MOTION.springOverdamped });

  // Missile arc path draws in frames 50→100
  const pathProgress = interpolate(frame, [50, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Right chevron rotates 180° to run away (frames 80→120)
  const arrowRotation = interpolate(frame, [80, 120], [0, 180], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Right chevron translates right while rotating (fleeing)
  const fleeTranslate = interpolate(frame, [80, 150], [0, 80], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Bottom label springs in
  const bottomLabelP = spring({ frame: Math.max(0, frame - 110), fps, config: MOTION.springSnappy });

  // Missile glow pulse
  const missilePulse = pathProgress > 0 ? 0.7 + 0.3 * Math.sin(frame * 0.2) : 0;

  // SVG arc path: cubic bezier from left chevron to right chevron curving upward
  // Missile path from ~left:420 y:540 → right:1300 y:480 with arc
  const totalLen = 900; // approximate path length for dash animation
  const dashOffset = interpolate(pathProgress, [0, 1], [totalLen, 0]);

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Radial glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(90,169,255,0.06) 0%, transparent 65%)',
      }} />

      {/* Top label */}
      <div style={{
        position: 'absolute', top: 96, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: labelP,
        transform: `translateY(${interpolate(labelP, [0, 1], [-18, 0])}px)`,
      }}>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 24, fontWeight: 600,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'rgba(90,169,255,0.5)', padding: '6px 18px',
          border: `1px solid rgba(90,169,255,0.2)`,
        }}>
          SCENARIO ANALYSIS
        </div>
      </div>

      {/* SVG canvas for diagram */}
      <svg
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Missile arc path */}
        <path
          d="M 460 540 C 620 420, 900 390, 1100 490"
          fill="none"
          stroke={PALETTE.electric}
          strokeWidth="3"
          strokeDasharray={`${totalLen}`}
          strokeDashoffset={`${dashOffset}`}
          strokeLinecap="round"
          opacity={0.85}
          style={{ filter: `drop-shadow(0 0 6px rgba(90,169,255,${0.5 * missilePulse}))` }}
        />

        {/* Missile arrowhead (appears at end of path draw) */}
        {pathProgress > 0.85 && (
          <polygon
            points="1100,490 1082,478 1086,502"
            fill={PALETTE.electric}
            opacity={interpolate(pathProgress, [0.85, 1.0], [0, 1])}
          />
        )}

        {/* Missile body dot that travels along path — shown during draw phase */}
        {pathProgress > 0 && pathProgress < 1 && (
          <circle
            cx={interpolate(pathProgress, [0, 1], [460, 1100])}
            cy={
              // Approximate bezier y via quadratic interpolation
              (() => {
                const t = pathProgress;
                const y0 = 540, y1 = 420, y2 = 390, y3 = 490;
                return (1-t)**3*y0 + 3*(1-t)**2*t*y1 + 3*(1-t)*t**2*y2 + t**3*y3;
              })()
            }
            r="5"
            fill={PALETTE.electric}
            style={{ filter: `drop-shadow(0 0 8px ${PALETTE.electric})` }}
          />
        )}

        {/* Engagement zone dashed circle */}
        {pathProgress > 0.3 && (
          <ellipse
            cx="780" cy="480" rx="280" ry="180"
            fill="none"
            stroke="rgba(196,55,59,0.3)"
            strokeWidth="1.5"
            strokeDasharray="8 6"
            opacity={interpolate(pathProgress, [0.3, 0.6], [0, 0.7])}
          />
        )}

        {/* RANGE ARC label */}
        {pathProgress > 0.5 && (
          <text
            x="780" y="320"
            textAnchor="middle"
            fontFamily={FONTS.mono}
            fontSize="16"
            fill="rgba(196,55,59,0.7)"
            letterSpacing="3"
            opacity={interpolate(pathProgress, [0.5, 0.8], [0, 1])}
          >
            ENGAGEMENT ENVELOPE
          </text>
        )}

        {/* Left chevron — fighter jet polygon (pointing right → attacking) */}
        <g
          transform={`translate(350, 510)`}
          opacity={leftP}
          style={{ filter: `drop-shadow(0 0 8px rgba(90,169,255,0.4))` }}
        >
          {/* Fuselage */}
          <polygon points="110,30 0,0 0,60" fill={PALETTE.electric} opacity={0.9} />
          {/* Swept wings */}
          <polygon points="30,0 60,30 0,30" fill={PALETTE.electric} opacity={0.65} />
          <polygon points="30,60 60,30 0,30" fill={PALETTE.electric} opacity={0.65} />
          {/* Tail fin */}
          <polygon points="0,0 -20,15 0,30" fill={PALETTE.electric} opacity={0.45} />
          {/* Missile exhaust glow */}
          {pathProgress > 0 && (
            <ellipse cx="0" cy="30" rx={6 + 3 * missilePulse} ry="3" fill={PALETTE.electric} opacity={0.4 * missilePulse} />
          )}
        </g>

        {/* "ATTACKER" label left */}
        <text
          x="350" y="640"
          textAnchor="middle"
          fontFamily={FONTS.mono}
          fontSize="15"
          fill="rgba(90,169,255,0.5)"
          letterSpacing="2"
          opacity={leftP}
        >
          ATTACKER
        </text>

        {/* Right chevron — target jet (initially pointing left, then rotates to flee) */}
        <g
          transform={`translate(${1100 + fleeTranslate}, 460) rotate(${arrowRotation}, 0, 30)`}
          opacity={rightP}
          style={{ filter: `drop-shadow(0 0 8px rgba(255,255,255,0.2))` }}
        >
          {/* Mirror of left: points left initially (facing attacker) */}
          <polygon points="-110,30 0,0 0,60" fill="rgba(255,255,255,0.75)" opacity={0.9} />
          <polygon points="-30,0 -60,30 0,30" fill="rgba(255,255,255,0.75)" opacity={0.55} />
          <polygon points="-30,60 -60,30 0,30" fill="rgba(255,255,255,0.75)" opacity={0.55} />
          <polygon points="0,0 20,15 0,30" fill="rgba(255,255,255,0.75)" opacity={0.35} />
        </g>

        {/* "TARGET" label right */}
        <text
          x={1160 + fleeTranslate}
          y="580"
          textAnchor="middle"
          fontFamily={FONTS.mono}
          fontSize="15"
          fill="rgba(255,255,255,0.45)"
          letterSpacing="2"
          opacity={rightP}
        >
          TARGET
        </text>

      </svg>

      {/* Bottom label: REAR-HEMISPHERE ENGAGEMENT */}
      <div style={{
        position: 'absolute', bottom: 280, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        opacity: bottomLabelP,
        transform: `translateY(${interpolate(bottomLabelP, [0, 1], [20, 0])}px)`,
      }}>
        <div style={{ width: 80, height: 2, background: PALETTE.secondary, marginBottom: 16, opacity: 0.7 }} />
        <div style={{
          fontFamily: FONTS.mono, fontSize: 24, fontWeight: 700,
          letterSpacing: '0.26em', textTransform: 'uppercase',
          color: PALETTE.onDark,
        }}>
          REAR-HEMISPHERE ENGAGEMENT
        </div>
        <div style={{
          fontFamily: FONTS.body, fontSize: 24, fontWeight: 400,
          color: PALETTE.onDarkMuted, marginTop: 12, letterSpacing: '0.02em',
        }}>
          Missile released — target already running
        </div>
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// Phase 4 | template: centered-hero | bg: dark
const Phase4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Top label entrance
  const topLabelP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springSnappy });

  // Bar collapses from frame 30 using springHeavy
  const barProgress = spring({ frame: Math.max(0, frame - 30), fps, config: MOTION.springHeavy });
  const fullWidth = 840;
  const collapsedWidth = interpolate(barProgress, [0, 1], [fullWidth, fullWidth / 2]);

  // "IN HALF." stamps at frame 145
  const inHalfP = spring({ frame: Math.max(0, frame - 104), fps, config: { damping: 11, stiffness: 260, mass: 0.9 } });
  const inHalfScale = interpolate(
    spring({ frame: Math.max(0, frame - 104), fps, config: { damping: 9, stiffness: 180, mass: 1.0 } }),
    [0, 1], [1.3, 1.0]
  );
  const inHalfY = interpolate(inHalfP, [0, 1], [40, 0]);

  // Body text after bar collapses
  const bodyP = spring({ frame: Math.max(0, frame - 90), fps, config: MOTION.springOverdamped });

  // Percentage numbers
  const fullPct = 100;
  const halfPct = Math.round(interpolate(barProgress, [0, 1], [100, 50]));

  // Red flash on bar collapse
  const redFlash = interpolate(frame, [65, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) * interpolate(frame, [75, 95], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Flash overlay */}
      {redFlash > 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `rgba(196,55,59,${redFlash * 0.08})`,
          pointerEvents: 'none', zIndex: 99,
        }} />
      )}

      {/* Radial glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 55% 50% at 50% 42%, rgba(90,169,255,0.05) 0%, transparent 65%)',
      }} />

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '140px 200px 240px 200px',
        gap: 0,
      }}>

        {/* Top category label */}
        {/* Headline */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: 56, fontWeight: 800,
          letterSpacing: '-0.02em', color: PALETTE.onDark,
          textAlign: 'center', marginBottom: 48,
          opacity: topLabelP,
          transform: `translateY(${interpolate(topLabelP, [0, 1], [18, 0])}px)`,
        }}>
          R-37M EFFECTIVE RANGE
        </div>

        {/* ── Range bar visualization ── */}
        <div style={{ width: fullWidth, position: 'relative', marginBottom: 20 }}>

          {/* Background track */}
          <div style={{
            width: fullWidth, height: 32, borderRadius: 4,
            background: 'rgba(90,169,255,0.08)',
            border: '1px solid rgba(90,169,255,0.18)',
            position: 'relative', overflow: 'visible',
          }}>

            {/* Full range — dims as bar collapses */}
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: fullWidth, height: 32, borderRadius: 4,
              background: 'rgba(90,169,255,0.12)',
              border: `1px solid rgba(90,169,255,${0.3 * (1 - barProgress * 0.7)})`,
            }} />

            {/* Active (collapsed) portion */}
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: collapsedWidth, height: 32, borderRadius: 4,
              background: `linear-gradient(90deg, rgba(90,169,255,0.45) 0%, rgba(90,169,255,0.25) 100%)`,
              borderRight: `2px solid ${PALETTE.electric}`,
              boxShadow: `0 0 12px rgba(90,169,255,0.3)`,
              transition: 'none',
            }} />

            {/* Collapsed/lost portion — hollow red outline */}
            {barProgress > 0.05 && (
              <div style={{
                position: 'absolute', top: 0,
                left: collapsedWidth, right: 0, height: 32,
                borderRadius: '0 4px 4px 0',
                border: `2px solid rgba(196,55,59,${Math.min(1, barProgress * 1.4)})`,
                borderLeft: 'none',
                background: `rgba(196,55,59,${0.06 * barProgress})`,
              }} />
            )}

            {/* Midpoint marker */}
            <div style={{
              position: 'absolute', top: -8, left: fullWidth / 2, bottom: -8,
              width: 2, background: 'rgba(196,55,59,0.5)',
            }} />
          </div>

          {/* Labels under bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 12, width: fullWidth,
            fontFamily: FONTS.mono, fontSize: 24, letterSpacing: '0.12em',
          }}>
            <span style={{ color: 'rgba(90,169,255,0.5)' }}>0 km</span>
            <span style={{ color: 'rgba(196,55,59,0.6)' }}>— effective ceiling →</span>
            <span style={{ color: 'rgba(90,169,255,0.5)' }}>300+ km</span>
          </div>

          {/* Percentage readout */}
          <div style={{
            position: 'absolute', top: -44, left: collapsedWidth - 2,
            fontFamily: FONTS.mono, fontSize: 24, fontWeight: 700,
            color: PALETTE.electric, letterSpacing: '0.1em',
            transform: 'translateX(-50%)',
            opacity: bodyP,
          }}>
            {halfPct}%
          </div>

        </div>

        {/* Body explanation */}
        {/* "IN HALF." stamp */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: 84, fontWeight: 900,
          color: PALETTE.secondary, letterSpacing: '-0.02em',
          textAlign: 'center', marginTop: 10,
          opacity: inHalfP,
          transform: `translateY(${inHalfY}px) scale(${inHalfScale})`,
          textShadow: `0 0 30px rgba(196,55,59,${0.5 * inHalfP})`,
        }}>
          IN HALF.
        </div>

      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// Phase 5 | template: stacked-reveal | bg: cream
const Phase5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Line 1: "Flies as fast as ever." at local frame 64
  const line1P = spring({ frame: Math.max(0, frame - 64), fps, config: MOTION.springOverdamped });
  const line1Y = interpolate(line1P, [0, 1], [28, 0]);

  // Line 2: "The seeker still works." at local frame 142
  const line2P = spring({ frame: Math.max(0, frame - 121), fps, config: MOTION.springOverdamped });
  const line2Y = interpolate(line2P, [0, 1], [28, 0]);

  // Divider line between entries
  const dividerP = spring({ frame: Math.max(0, frame - 72), fps, config: MOTION.springSnappy });

  // Subtle accent — thin horizontal rule at top of content
  const topRuleP = spring({ frame: Math.max(0, frame - 20), fps, config: MOTION.springSnappy });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, overflow: 'hidden' }}>

      {/* Top rule accent — signals the world shift */}
      <div style={{
        position: 'absolute', top: 108, left: 200, right: 200,
        height: 1, background: PALETTE.primary,
        transform: `scaleX(${topRuleP})`, transformOrigin: 'left',
        opacity: 0.18,
      }} />

      {/* Scene category — analytical label */}
      <div style={{
        position: 'absolute', top: 128, left: 200,
        fontFamily: FONTS.mono, fontSize: 24, fontWeight: 600,
        letterSpacing: '0.28em', textTransform: 'uppercase',
        color: PALETTE.textMuted,
        opacity: topRuleP,
      }}>
        MISSILE PERFORMANCE FACTORS
      </div>

      {/* Centered stacked content */}
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '140px 240px 250px 240px',
        gap: 0,
      }}>

        {/* Line 1 */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: 72, fontWeight: 700,
          letterSpacing: '-0.02em', color: PALETTE.primary,
          textAlign: 'center', lineHeight: 1.12,
          opacity: line1P,
          transform: `translateY(${line1Y}px)`,
        }}>
          Flies as fast as ever.
        </div>

        {/* Divider */}
        <div style={{
          width: 64, height: 2, background: PALETTE.accent,
          margin: '32px 0',
          transform: `scaleX(${dividerP})`, transformOrigin: 'center',
          opacity: 0.7,
        }} />

        {/* Line 2 */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: 72, fontWeight: 700,
          letterSpacing: '-0.02em', color: PALETTE.primary,
          textAlign: 'center', lineHeight: 1.12,
          opacity: line2P,
          transform: `translateY(${line2Y}px)`,
        }}>
          The seeker still works.
        </div>

      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// Phase 6 | template: centered-hero | bg: cream
const Phase6: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = 204;

  // "The target" part fades in first
  const line1P = spring({ frame: Math.max(0, frame - 10), fps, config: MOTION.springOverdamped });
  const line1Y = interpolate(line1P, [0, 1], [30, 0]);

  // 'knows' word red emphasis at frame ~74
  const knowsP = spring({ frame: Math.max(0, frame - 74), fps, config: { damping: 12, stiffness: 300, mass: 0.7 } });
  const knowsScale = interpolate(
    spring({ frame: Math.max(0, frame - 74), fps, config: { damping: 10, stiffness: 220, mass: 0.8 } }),
    [0, 1], [1.25, 1.0]
  );

  // Second line at frame ~146
  const line2P = spring({ frame: Math.max(0, frame - 104), fps, config: MOTION.springOverdamped });
  const line2Y = interpolate(line2P, [0, 1], [28, 0]);

  // Accent underline below last line
  const underlineScale = spring({ frame: Math.max(0, frame - 114), fps, config: MOTION.springSnappy });

  // Top rule
  const topRuleP = spring({ frame: Math.max(0, frame - 6), fps, config: MOTION.springSnappy });

  // Exit fade over last 14 frames
  const exitOpacity = interpolate(frame, [dur - 16, dur], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, overflow: 'hidden', opacity: exitOpacity }}>

      {/* Top rule */}
      <div style={{
        position: 'absolute', top: 108, left: 200, right: 200,
        height: 1, background: PALETTE.primary,
        transform: `scaleX(${topRuleP})`, transformOrigin: 'left',
        opacity: 0.14,
      }} />

      {/* Scene label */}
      <div style={{
        position: 'absolute', top: 128, left: 200,
        fontFamily: FONTS.mono, fontSize: 24, fontWeight: 600,
        letterSpacing: '0.28em', textTransform: 'uppercase',
        color: PALETTE.textMuted,
        opacity: topRuleP,
      }}>
        STRATEGIC IMPLICATION
      </div>

      {/* Centered layout */}
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '140px 200px 250px 200px',
        gap: 0,
      }}>

        {/* Line 1: "The target knows." — 'knows' in red with slam */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: 80, fontWeight: 800,
          letterSpacing: '-0.02em', color: PALETTE.primary,
          textAlign: 'center', lineHeight: 1.1,
          opacity: line1P,
          transform: `translateY(${line1Y}px)`,
          display: 'flex', alignItems: 'baseline', gap: '0.22em',
          flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <span>The target</span>
          <span style={{
            color: knowsP > 0.02 ? PALETTE.secondary : PALETTE.primary,
            display: 'inline-block',
            transform: `scale(${knowsP > 0.02 ? knowsScale : 1})`,
            transformOrigin: 'center bottom',
            textShadow: `0 0 ${20 * knowsP}px rgba(196,55,59,${0.4 * knowsP})`,
          }}>
            knows.
          </span>
        </div>

        {/* Spacer */}
        <div style={{ height: 40 }} />

        {/* Line 2: "And knowing is enough." — subdued entrance */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: 64, fontWeight: 700,
          letterSpacing: '-0.015em',
          color: PALETTE.text,
          textAlign: 'center', lineHeight: 1.15,
          opacity: line2P * 0.82,
          transform: `translateY(${line2Y}px)`,
        }}>
          And knowing is enough.
        </div>

        {/* Accent underline — draws under the last line */}
        <div style={{
          marginTop: 20,
          width: 120, height: 3,
          background: PALETTE.accent,
          transform: `scaleX(${underlineScale})`,
          transformOrigin: 'left',
          borderRadius: 2,
          opacity: 0.85,
        }} />

      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ── Root: TransitionSeries wiring ─────────────────────────────────────────────
export default function Scene_04() {
  return (
    <TransitionSeries>
      {/* Phase 1 — image/dark — wipe in (image entry) */}
      <TransitionSeries.Sequence durationInFrames={205}>
        <Phase1 />
      </TransitionSeries.Sequence>

      {/* Transition 1→2: image→dark = wipe */}
      <TransitionSeries.Transition
        presentation={wipe({ direction: 'from-right' })}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 2 — dark centered hero */}
      <TransitionSeries.Sequence durationInFrames={250}>
        <Phase2 />
      </TransitionSeries.Sequence>

      {/* Transition 2→3: dark→dark = fade */}
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 3 — dark centered hero */}
      <TransitionSeries.Sequence durationInFrames={201}>
        <Phase3 />
      </TransitionSeries.Sequence>

      {/* Transition 3→4: dark→dark = fade */}
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 4 — dark centered hero */}
      <TransitionSeries.Sequence durationInFrames={194}>
        <Phase4 />
      </TransitionSeries.Sequence>

      {/* Transition 4→5: dark→cream = wipe (WORLD SHIFT) */}
      <TransitionSeries.Transition
        presentation={wipe({ direction: 'from-left' })}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 5 — cream stacked reveal */}
      <TransitionSeries.Sequence durationInFrames={211}>
        <Phase5 />
      </TransitionSeries.Sequence>

      {/* Transition 5→6: cream→cream = fade */}
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 6 — cream centered hero */}
      <TransitionSeries.Sequence durationInFrames={204}>
        <Phase6 />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
}
