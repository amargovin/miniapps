// Scene_01 | templates: lower-third(2), centered-hero(2), focal-offset(2)
// "A Long-Range Missile Won't Fix India's PL-15 Problem" — Swarajya defence video
// Cold Open: Ghost Arrival | 1286 frames @ 30fps | All phases: PALETTE.dark

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

// ── Film grain ───────────────────────────────────────────────────────────────
const GRAIN_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      opacity,
      pointerEvents: 'none',
      backgroundImage: GRAIN_URL,
      backgroundSize: '128px 128px',
    }}
  />
);

// ── Spring enter helper (reads local frame internally) ────────────────────────
function useEnter(delay = 0, config: { damping: number; stiffness: number; mass: number } = MOTION.springSnappy) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: Math.max(0, frame - delay), fps, config });
}

// ── Scale-slam config ─────────────────────────────────────────────────────────
const SLAM = { damping: 14, stiffness: 280, mass: 0.8 };

// ── Reusable dark scrim for text legibility ───────────────────────────────────
const TextScrim: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      display: 'inline-block',
      background: 'rgba(0,0,0,0.35)',
      borderRadius: 4,
      padding: '6px 18px',
      ...style,
    }}
  >
    {children}
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// Phase 1 | template: lower-third | bg: image | asset: s01_cockpit_warning.png
// dur=181f — Cockpit interior, mono label top-left. Ken Burns on image only.
// ══════════════════════════════════════════════════════════════════════════════
const Phase1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Ken Burns: scale image only
  const imageScale = interpolate(frame, [0, 181], [1.0, 1.06], { extrapolateRight: 'clamp' });

  // Label entrance
  const labelP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springSnappy });

  // Fade in overall
  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden', opacity: fadeIn }}>
      {/* Full-bleed cockpit image — Ken Burns on image tag only */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={staticFile('s01_cockpit_warning.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 45%',
            transform: `scale(${imageScale})`,
            willChange: 'transform',
            filter: 'blur(2px) contrast(1.1) brightness(0.78)',
          }}
        />
        {/* Dark vignette — bottom heavy for safe text zone */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(11,22,34,0.55) 0%, rgba(11,22,34,0.12) 40%, rgba(11,22,34,0.72) 100%)',
          }}
        />
        {/* Multiply tint */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: PALETTE.dark,
            mixBlendMode: 'multiply',
            opacity: 0.3,
          }}
        />
      </AbsoluteFill>

      {/* Mono label — TOP LEFT, safe from logo zone (top-right 300×200px excluded) */}
      <div
        style={{
          position: 'absolute',
          top: 72,
          left: 80,
          opacity: labelP,
          transform: `translateY(${interpolate(labelP, [0, 1], [12, 0])}px)`,
        }}
      >
        <TextScrim>
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
            SOMEWHERE OVER THE SUBCONTINENT
          </span>
        </TextScrim>
      </div>

      {/* SFX: scene entrance rise */}
      <Sequence from={0}>
        <Audio src={staticFile('sfx/rise.mp3')} volume={0.25} />
      </Sequence>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 2 | template: centered-hero | bg: solid-dark | asset: radar scope (code-drawn)
// dur=238f — Conic-sweep radar scope. Text staggered at local frame equivalents.
// Global whisper times → local frames: 8320ms→0f, 9480ms→35f, 10780ms→72f from phase start
// ══════════════════════════════════════════════════════════════════════════════
const Phase2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Radar sweep angle — full rotation every 90 frames
  const sweepAngle = (frame / 90) * 360;

  // Range rings pulse
  const ringPulse = interpolate(Math.sin((frame / 30) * Math.PI * 2), [-1, 1], [0.6, 1.0]);

  // Text stagger — local frame offsets from phase start
  // "CLOSE." enters at local frame 0
  const p1 = spring({ frame: Math.max(0, frame - 0), fps, config: SLAM });
  const s1 = spring({ frame: Math.max(0, frame - 0), fps, config: { damping: 11, stiffness: 200, mass: 0.8 } });
  // "CLOSING." enters at local frame 35 (≈8320→9480ms = 1160ms = ~35f)
  const p2 = spring({ frame: Math.max(0, frame - 35), fps, config: SLAM });
  const s2 = spring({ frame: Math.max(0, frame - 35), fps, config: { damping: 11, stiffness: 200, mass: 0.8 } });
  // "ALREADY LOCKED." enters at local frame 72 (≈9480→10780ms = 1300ms = ~39f further)
  const p3 = spring({ frame: Math.max(0, frame - 72), fps, config: SLAM });
  const s3 = spring({ frame: Math.max(0, frame - 72), fps, config: { damping: 11, stiffness: 200, mass: 0.8 } });

  const scaleWord = (p: number) => interpolate(p, [0, 1], [1.18, 1.0]);

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Subtle electric radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 65% at 50% 48%, rgba(90,169,255,0.07) 0%, transparent 65%)',
        }}
      />

      {/* Radar scope — centered, 480px diameter */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 480,
          height: 480,
        }}
      >
        {/* Outer ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `1.5px solid rgba(90,169,255,${ringPulse * 0.4})`,
          }}
        />
        {/* Mid ring */}
        <div
          style={{
            position: 'absolute',
            inset: 80,
            borderRadius: '50%',
            border: `1px solid rgba(90,169,255,${ringPulse * 0.28})`,
          }}
        />
        {/* Inner ring */}
        <div
          style={{
            position: 'absolute',
            inset: 160,
            borderRadius: '50%',
            border: `1px solid rgba(90,169,255,${ringPulse * 0.22})`,
          }}
        />
        {/* Crosshairs */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 1,
            background: `rgba(90,169,255,0.18)`,
            transform: 'translateY(-0.5px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 1,
            background: `rgba(90,169,255,0.18)`,
            transform: 'translateX(-0.5px)',
          }}
        />
        {/* Conic sweep gradient — rotates each frame */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `conic-gradient(from ${sweepAngle}deg, rgba(90,169,255,0.45) 0deg, rgba(90,169,255,0.12) 25deg, transparent 55deg)`,
            overflow: 'hidden',
            clipPath: 'circle(50%)',
          }}
        />
        {/* Sweep line */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '50%',
            height: 2,
            background: 'linear-gradient(90deg, rgba(90,169,255,0.9) 0%, transparent 100%)',
            transformOrigin: '0% 50%',
            transform: `translateY(-1px) rotate(${sweepAngle}deg)`,
          }}
        />
        {/* Hostile blip — fixed at ~310deg, 38% radius from center */}
        {(() => {
          const blipAngle = 310 * (Math.PI / 180);
          const blipR = 0.38 * 240; // 38% of 240px radius
          const bx = 240 + blipR * Math.cos(blipAngle);
          const by = 240 + blipR * Math.sin(blipAngle);
          const blipPulse = 0.5 + 0.5 * Math.sin((frame / 8) * Math.PI);
          return (
            <div
              style={{
                position: 'absolute',
                left: bx - 6,
                top: by - 6,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: PALETTE.secondary,
                boxShadow: `0 0 ${8 + blipPulse * 10}px ${PALETTE.secondary}`,
                opacity: 0.85 + blipPulse * 0.15,
              }}
            />
          );
        })()}
        {/* Blip trail echo */}
        {(() => {
          const blipAngle = 310 * (Math.PI / 180);
          const blipR = 0.38 * 240;
          const bx = 240 + blipR * Math.cos(blipAngle);
          const by = 240 + blipR * Math.sin(blipAngle);
          return (
            <div
              style={{
                position: 'absolute',
                left: bx - 10,
                top: by - 10,
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: `1px solid ${PALETTE.secondary}`,
                opacity: 0.35,
              }}
            />
          );
        })()}
      </div>

      {/* Staggered threat words — centered, vertically spread */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 220,
        }}
      >
        {/* "CLOSE." */}
        <div
          style={{
            opacity: p1,
            transform: `translateY(${interpolate(p1, [0, 1], [36, 0])}px) scale(${scaleWord(s1)})`,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 88,
              fontWeight: 800,
              color: PALETTE.onDark,
              letterSpacing: '-0.02em',
            }}
          >
            CLOSE.
          </span>
        </div>

        {/* "CLOSING." */}
        <div
          style={{
            opacity: p2,
            transform: `translateY(${interpolate(p2, [0, 1], [36, 0])}px) scale(${scaleWord(s2)})`,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 88,
              fontWeight: 800,
              color: PALETTE.onDark,
              letterSpacing: '-0.02em',
            }}
          >
            CLOSING.
          </span>
        </div>

        {/* "ALREADY LOCKED." — secondary/red, impact SFX */}
        <div
          style={{
            opacity: p3,
            transform: `translateY(${interpolate(p3, [0, 1], [36, 0])}px) scale(${scaleWord(s3)})`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 88,
              fontWeight: 800,
              color: PALETTE.secondary,
              letterSpacing: '-0.02em',
            }}
          >
            ALREADY LOCKED.
          </span>
        </div>
      </AbsoluteFill>

      {/* Impact SFX when "ALREADY LOCKED." slams in at local frame 72 */}
      <Sequence from={72}>
        <Audio src={staticFile('sfx/impact.mp3')} volume={0.6} />
      </Sequence>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 3 | template: focal-offset | bg: image | asset: s01_su30mki_dusk.png
// dur=183f — "NO WARNING." scale-slam. Ken Burns zoom-in.
// ══════════════════════════════════════════════════════════════════════════════
const Phase3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Ken Burns zoom-in on image only
  const imageScale = interpolate(frame, [0, 183], [1.0, 1.06], { extrapolateRight: 'clamp' });

  // Scale-slam for "NO WARNING."
  const textP = spring({ frame: Math.max(0, frame - 10), fps, config: SLAM });
  const textS = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 11, stiffness: 200, mass: 0.8 } });
  const textScale = interpolate(textS, [0, 1], [1.18, 1.0]);
  const textY = interpolate(textP, [0, 1], [48, 0]);

  const fadeIn = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden', opacity: fadeIn }}>
      {/* Full-bleed Su-30MKI dusk image — Ken Burns on image only, text is static */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={staticFile('s01_su30mki_dusk.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 60%',
            transform: `scale(${imageScale})`,
            willChange: 'transform',
            filter: 'contrast(1.1) brightness(0.72)',
          }}
        />
        {/* Gradient scrim — left panel for text legibility */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, rgba(11,22,34,0.88) 0%, rgba(11,22,34,0.45) 42%, transparent 68%)',
          }}
        />
        {/* Bottom fade */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(0deg, rgba(11,22,34,0.75) 0%, transparent 40%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: PALETTE.dark,
            mixBlendMode: 'multiply',
            opacity: 0.25,
          }}
        />
      </AbsoluteFill>

      {/* "NO WARNING." — left-aligned, vertically centered, scale-slam */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '120px 200px 240px 100px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            opacity: textP,
            transform: `translateY(${textY}px) scale(${textScale})`,
            transformOrigin: 'left center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 104,
              fontWeight: 800,
              color: PALETTE.onDark,
              letterSpacing: '-0.025em',
              lineHeight: 1.0,
              display: 'block',
            }}
          >
            NO WARNING.
          </span>
        </div>
      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 4 | template: lower-third | bg: image | asset: s01_horizon_night.png
// dur=245f — "BEYOND THE HORIZON" + SVG missile arc draws from left toward viewer.
// Ken Burns drift.
// ══════════════════════════════════════════════════════════════════════════════
const Phase4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Ken Burns
  const imageScale = interpolate(frame, [0, 245], [1.0, 1.06], { extrapolateRight: 'clamp' });

  // Text entrance
  const labelP = spring({ frame: Math.max(0, frame - 12), fps, config: MOTION.springSnappy });
  const headP = spring({ frame: Math.max(0, frame - 22), fps, config: SLAM });
  const headS = spring({ frame: Math.max(0, frame - 22), fps, config: { damping: 11, stiffness: 200, mass: 0.8 } });

  // SVG path draw — missile arc. Starts drawing from frame 40, completes by frame 120.
  const arcProgress = interpolate(frame, [40, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Curved arc path: left horizon → up and over → approaching bottom-right (toward viewer)
  // SVG viewBox 1920×1080. Arc from (0,580) curves up through (700,180) to (1700,820)
  const arcPathTotal = 'M 0 580 Q 700 100 1700 820';
  // Compute approximate stroke length for dashoffset animation
  // We use a large number and animate dashoffset to simulate path draw
  const STROKE_LEN = 2200;
  const dashOffset = STROKE_LEN * (1 - arcProgress);

  // Missile blip position along arc (parametric approximation)
  const t = arcProgress;
  const p0x = 0, p0y = 580;
  const p1x = 700, p1y = 100;
  const p2x = 1700, p2y = 820;
  const missileX = (1 - t) * (1 - t) * p0x + 2 * (1 - t) * t * p1x + t * t * p2x;
  const missileY = (1 - t) * (1 - t) * p0y + 2 * (1 - t) * t * p1y + t * t * p2y;
  const showMissile = arcProgress > 0.02;

  const fadeIn = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden', opacity: fadeIn }}>
      {/* Full-bleed night horizon */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={staticFile('s01_horizon_night.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 50%',
            transform: `scale(${imageScale})`,
            willChange: 'transform',
            filter: 'contrast(1.08) brightness(0.75)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(0deg, rgba(11,22,34,0.82) 0%, rgba(11,22,34,0.2) 50%, rgba(11,22,34,0.45) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: PALETTE.dark,
            mixBlendMode: 'multiply',
            opacity: 0.22,
          }}
        />
      </AbsoluteFill>

      {/* SVG missile arc overlay */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
      >
        {/* Glow layer */}
        <path
          d={arcPathTotal}
          fill="none"
          stroke={PALETTE.electric}
          strokeWidth={6}
          strokeDasharray={STROKE_LEN}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          opacity={0.25}
          style={{ filter: 'blur(4px)' }}
        />
        {/* Sharp arc line */}
        <path
          d={arcPathTotal}
          fill="none"
          stroke={PALETTE.electric}
          strokeWidth={2}
          strokeDasharray={STROKE_LEN}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          opacity={0.9}
        />
        {/* Missile blip */}
        {showMissile && (
          <g transform={`translate(${missileX},${missileY})`}>
            <circle r={7} fill={PALETTE.secondary} opacity={0.95} />
            <circle r={14} fill="none" stroke={PALETTE.secondary} strokeWidth={1.5} opacity={0.4} />
            <circle r={22} fill="none" stroke={PALETTE.secondary} strokeWidth={1} opacity={0.2} />
          </g>
        )}
      </svg>

      {/* Text — lower-third, bottom-left area (above 20% safe zone) */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '120px 200px 260px 100px',
          boxSizing: 'border-box',
        }}
      >
        {/* Label */}
        <div
          style={{
            opacity: labelP,
            transform: `translateY(${interpolate(labelP, [0, 1], [14, 0])}px)`,
            marginBottom: 16,
          }}
        >
          <TextScrim>
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
              BVR ENGAGEMENT
            </span>
          </TextScrim>
        </div>

        {/* "BEYOND THE HORIZON" */}
        <div
          style={{
            opacity: headP,
            transform: `translateY(${interpolate(headP, [0, 1], [42, 0])}px) scale(${interpolate(headS, [0, 1], [1.12, 1.0])})`,
            transformOrigin: 'left bottom',
          }}
        >
          <TextScrim style={{ padding: '8px 24px' }}>
            <span
              style={{
                fontFamily: FONTS.heading,
                fontSize: 80,
                fontWeight: 800,
                color: PALETTE.onDark,
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
              }}
            >
              BEYOND THE HORIZON
            </span>
          </TextScrim>
        </div>
      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 5 | template: centered-hero | bg: solid-dark | asset: null
// dur=295f — "A GHOST ARRIVAL." scale-slam at local frame 99.
// Ghost echo copies. Sub-line at local frame 161.
// ══════════════════════════════════════════════════════════════════════════════
const Phase5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "A GHOST ARRIVAL." slams at local frame 99
  const ghostP = spring({ frame: Math.max(0, frame - 99), fps, config: SLAM });
  const ghostS = spring({ frame: Math.max(0, frame - 99), fps, config: { damping: 11, stiffness: 200, mass: 0.8 } });
  const ghostScale = interpolate(ghostS, [0, 1], [1.22, 1.0]);
  const ghostY = interpolate(ghostP, [0, 1], [52, 0]);

  // Sub-line enters at local frame 161
  const subP = spring({ frame: Math.max(0, frame - 161), fps, config: MOTION.springSnappy });
  const subY = interpolate(subP, [0, 1], [20, 0]);

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Electric radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(90,169,255,0.06) 0%, transparent 62%)',
        }}
      />

      {/* Centered content — vertically balanced, stays clear of bottom 20% */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '120px 160px 260px 160px',
          boxSizing: 'border-box',
        }}
      >
        {/* Ghost echo layer 1 — furthest back, most offset */}
        <div
          style={{
            position: 'absolute',
            opacity: ghostP * 0.08,
            transform: `translateY(${ghostY}px) scale(${ghostScale}) translateX(-28px)`,
            transformOrigin: 'center',
            // Slightly above center to align with main text
            top: '50%',
            left: 0,
            right: 0,
            textAlign: 'center',
            marginTop: -80,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 92,
              fontWeight: 800,
              color: PALETTE.onDark,
              letterSpacing: '-0.02em',
              lineHeight: 1.0,
              whiteSpace: 'nowrap',
            }}
          >
            A GHOST ARRIVAL.
          </span>
        </div>

        {/* Ghost echo layer 2 — behind, medium offset */}
        <div
          style={{
            position: 'absolute',
            opacity: ghostP * 0.15,
            transform: `translateY(${ghostY}px) scale(${ghostScale}) translateX(-14px)`,
            transformOrigin: 'center',
            top: '50%',
            left: 0,
            right: 0,
            textAlign: 'center',
            marginTop: -80,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 92,
              fontWeight: 800,
              color: PALETTE.onDark,
              letterSpacing: '-0.02em',
              lineHeight: 1.0,
              whiteSpace: 'nowrap',
            }}
          >
            A GHOST ARRIVAL.
          </span>
        </div>

        {/* Main text — "A GHOST ARRIVAL." */}
        <div
          style={{
            opacity: ghostP,
            transform: `translateY(${ghostY}px) scale(${ghostScale})`,
            transformOrigin: 'center',
            marginBottom: 48,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 92,
              fontWeight: 800,
              color: PALETTE.onDark,
              letterSpacing: '-0.02em',
              lineHeight: 1.0,
              whiteSpace: 'nowrap',
            }}
          >
            A GHOST ARRIVAL.
          </span>
        </div>

        {/* Sub-line at frame 161 */}
        <div
          style={{
            opacity: subP,
            transform: `translateY(${subY}px)`,
            maxWidth: 900,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 32,
              fontWeight: 400,
              color: PALETTE.electric,
              letterSpacing: '0.02em',
              lineHeight: 1.5,
            }}
          >
            The first warning you get is the last one you get.
          </span>
        </div>
      </AbsoluteFill>

      {/* Impact SFX when "A GHOST ARRIVAL." slams at local frame 99 */}
      <Sequence from={99}>
        <Audio src={staticFile('sfx/impact.mp3')} volume={0.6} />
      </Sequence>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 6 | template: focal-offset | bg: image | asset: s01_r37m_underwing.png
// dur=234f — "THE OBVIOUS RESPONSE" then "A bigger missile." at local frame 203.
// Ken Burns zoom-in.
// ══════════════════════════════════════════════════════════════════════════════
const Phase6: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Ken Burns zoom-in on image
  const imageScale = interpolate(frame, [0, 234], [1.0, 1.06], { extrapolateRight: 'clamp' });

  // "THE OBVIOUS RESPONSE" enters early
  const headP = spring({ frame: Math.max(0, frame - 14), fps, config: MOTION.springSnappy });
  const headY = interpolate(headP, [0, 1], [24, 0]);

  // "A bigger missile." enters at local frame 203
  // (Global: 41820ms = 41820-35060 = 6760ms from phase start = ~203f)
  const subP = spring({ frame: Math.max(0, frame - 153), fps, config: SLAM });
  const subS = spring({ frame: Math.max(0, frame - 153), fps, config: { damping: 11, stiffness: 200, mass: 0.8 } });
  const subScale = interpolate(subS, [0, 1], [1.14, 1.0]);
  const subY = interpolate(subP, [0, 1], [36, 0]);

  const fadeIn = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden', opacity: fadeIn }}>
      {/* Full-bleed R-37M underwing image */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={staticFile('s01_r37m_underwing.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 55%',
            transform: `scale(${imageScale})`,
            willChange: 'transform',
            filter: 'contrast(1.1) brightness(0.72)',
          }}
        />
        {/* Left gradient scrim for text panel */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, rgba(11,22,34,0.92) 0%, rgba(11,22,34,0.55) 40%, rgba(11,22,34,0.12) 65%, transparent 80%)',
          }}
        />
        {/* Bottom gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(0deg, rgba(11,22,34,0.8) 0%, transparent 40%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: PALETTE.dark,
            mixBlendMode: 'multiply',
            opacity: 0.28,
          }}
        />
      </AbsoluteFill>

      {/* Text — focal-offset left-anchored */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '120px 200px 260px 100px',
          boxSizing: 'border-box',
          maxWidth: '55%',
        }}
      >
        {/* Label */}
        <div
          style={{
            opacity: headP,
            transform: `translateY(${interpolate(headP, [0, 1], [12, 0])}px)`,
            marginBottom: 16,
          }}
        >
          <TextScrim>
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
              INDIA'S ANSWER
            </span>
          </TextScrim>
        </div>

        {/* "THE OBVIOUS RESPONSE" */}
        <div
          style={{
            opacity: headP,
            transform: `translateY(${headY}px)`,
            marginBottom: 32,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 72,
              fontWeight: 800,
              color: PALETTE.onDark,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              display: 'block',
            }}
          >
            THE OBVIOUS
            <br />
            RESPONSE
          </span>
        </div>

        {/* "A bigger missile." — scale-slam at frame 203 */}
        <div
          style={{
            opacity: subP,
            transform: `translateY(${subY}px) scale(${subScale})`,
            transformOrigin: 'left center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 56,
              fontWeight: 700,
              color: PALETTE.secondary,
              letterSpacing: '-0.01em',
              fontStyle: 'italic',
            }}
          >
            A bigger missile.
          </span>
        </div>
      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Scene_01 root — TransitionSeries with 18-frame transitions
// Transition rules:
//   image→solid: wipe() | image↔image: fade() | solid→solid: fade() | solid→image: wipe()
// TSM: 181+238+183+245+295+234 = 1376 − (5×18=90) = 1286 frames ✓
// ══════════════════════════════════════════════════════════════════════════════
export default function Scene_01() {
  return (
    <AbsoluteFill style={{ background: PALETTE.dark }}>
      <TransitionSeries>
        {/* Phase 1 → Phase 2: image → solid = wipe() */}
        <TransitionSeries.Sequence durationInFrames={181}>
          <Phase1 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: 'from-left' })}
          timing={linearTiming({ durationInFrames: 18 })}
        />

        {/* Phase 2 → Phase 3: solid → image = wipe() */}
        <TransitionSeries.Sequence durationInFrames={238}>
          <Phase2 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: 'from-right' })}
          timing={linearTiming({ durationInFrames: 18 })}
        />

        {/* Phase 3 → Phase 4: image → image = fade() */}
        <TransitionSeries.Sequence durationInFrames={183}>
          <Phase3 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 18 })}
        />

        {/* Phase 4 → Phase 5: image → solid = wipe() */}
        <TransitionSeries.Sequence durationInFrames={245}>
          <Phase4 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: 'from-left' })}
          timing={linearTiming({ durationInFrames: 18 })}
        />

        {/* Phase 5 → Phase 6: solid → image = wipe() */}
        <TransitionSeries.Sequence durationInFrames={295}>
          <Phase5 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: 'from-right' })}
          timing={linearTiming({ durationInFrames: 18 })}
        />

        {/* Phase 6 — final (253f gives ≥30f breathing after last whisper word at 1275f, net total=1305f) */}
        <TransitionSeries.Sequence durationInFrames={253}>
          <Phase6 />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
}
