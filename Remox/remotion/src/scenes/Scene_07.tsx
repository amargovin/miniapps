// Scene_07 | templates: centered-hero(3), grid(3), lower-third(1), stacked-reveal(1)
// NOTE: phases 2-3 and 6-7 are ONE persistent chart — same bars, different values
// "A Long-Range Missile Won't Fix India's PL-15 Problem" — THE CLIFF
// Duration: 1459 frames | 8 phases | ALL DARK | CLIMAX scene
// TSM: (165+179+260+152+208+217+215+189) - 7×18 = 1585 - 126 = 1459

import React from 'react';
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  spring, interpolate, Audio, staticFile, Easing, Sequence,
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { Img } from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// ── Film Grain ────────────────────────────────────────────────────────────────
const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => (
  <div style={{
    position: 'absolute', inset: 0, opacity, pointerEvents: 'none',
    mixBlendMode: 'overlay', backgroundImage: GRAIN_SVG, backgroundSize: '170px 170px',
    zIndex: 100,
  }} />
);

// ── Chart geometry constants ──────────────────────────────────────────────────
const CHART_BAR_WIDTH = 140;
const CHART_BAR_GAP = 80;
const CHART_MAX_HEIGHT = 380; // max bar pixel height (= 100%)
const CHART_BASELINE_Y = 680; // y position of the baseline (safe zone respected)
const CHART_CENTER_X = 960; // horizontal center of frame

// total width for 3 bars: 3*140 + 2*80 = 580; left edge = 960 - 290 = 670
const BAR_X = [
  CHART_CENTER_X - CHART_BAR_WIDTH - CHART_BAR_GAP - CHART_BAR_WIDTH / 2, // PL-15: 670
  CHART_CENTER_X - CHART_BAR_WIDTH / 2,                                    // PL-16: 890→ center
  CHART_CENTER_X + CHART_BAR_GAP + CHART_BAR_WIDTH / 2,                   // HQ-9:  1110
];
// Recalculate for center-aligned trio
// Trio total width = 3*140 + 2*80 = 580; center = 960; left start = 960-290 = 670
// Bar centers: 670+70=740, 670+140+80+70=960, 670+280+80+70=1100
const BAR_CENTERS = [740, 960, 1180];

// Helper: convert % to pixel height
const pctToH = (pct: number) => (pct / 100) * CHART_MAX_HEIGHT;

// Phase 1 | template: centered-hero | bg: dark
// ── Phase 1: DIGIT CASCADE + HERO STAT "10,000" ───────────────────────────────
const Phase1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Seeded digit cascade background
  const digits = Array.from({ length: 40 }, (_, i) => {
    const x = ((i * 1920) / 40) + ((i * 37) % 60) - 30;
    const baseY = ((i * 113) % 1080);
    const fallSpeed = 0.4 + ((i * 7) % 5) * 0.15;
    const y = (baseY + frame * fallSpeed) % 1080;
    const digit = ((i * 7 + 13) % 10).toString();
    const opacity = 0.03 + ((i * 3) % 5) * 0.01;
    const fontSize = 16 + ((i * 11) % 20);
    return { x, y, digit, opacity, fontSize };
  });

  // Secondary cascade layer — different seed
  const digits2 = Array.from({ length: 25 }, (_, i) => {
    const x = ((i * 1920) / 25) + ((i * 53) % 80) - 40;
    const baseY = ((i * 197) % 1080);
    const fallSpeed = 0.25 + ((i * 11) % 4) * 0.12;
    const y = (baseY + frame * fallSpeed * 0.7) % 1080;
    const digit = ((i * 13 + 7) % 10).toString();
    const opacity = 0.025 + ((i * 5) % 3) * 0.008;
    const fontSize = 12 + ((i * 17) % 14);
    return { x, y, digit, opacity, fontSize };
  });

  // "10,000" counter: 0 → 10000 over frames 10→120
  const count = Math.round(interpolate(frame, [10, 120], [0, 10000], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  }));
  const countStr = count.toLocaleString();

  // Hero entrance
  const heroP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springSnappy });
  const heroY = interpolate(heroP, [0, 1], [48, 0]);

  // Label below counter
  const labelP = spring({ frame: Math.max(0, frame - 50), fps, config: MOTION.springOverdamped });
  const labelY = interpolate(labelP, [0, 1], [20, 0]);

  // Radial glow pulse
  const glowPulse = 0.6 + 0.4 * Math.sin(frame * 0.08);

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* SFX: rise.mp3 ambient entrance */}
      <Audio
        src={staticFile('sfx/rise.mp3')}
        volume={(f) => interpolate(f, [0, 20, 120, 145], [0, 0.3, 0.3, 0.0], { extrapolateRight: 'clamp' })}
      />

      {/* Digit cascade layer 1 */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }}
           viewBox="0 0 1920 1080">
        {digits.map((d, i) => (
          <text
            key={i}
            x={d.x} y={d.y}
            fontFamily={FONTS.mono}
            fontSize={d.fontSize}
            fill={PALETTE.electric}
            opacity={d.opacity}
            letterSpacing="2"
          >
            {d.digit}
          </text>
        ))}
        {digits2.map((d, i) => (
          <text
            key={`d2-${i}`}
            x={d.x} y={d.y}
            fontFamily={FONTS.mono}
            fontSize={d.fontSize}
            fill={PALETTE.onDark}
            opacity={d.opacity}
            letterSpacing="1"
          >
            {d.digit}
          </text>
        ))}
      </svg>

      {/* Radial glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 60% 55% at 50% 46%, rgba(90,169,255,${0.08 * glowPulse}) 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* Centered hero layout */}
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '140px 200px 240px 200px',
      }}>
        {/* Top mono label */}
        <div style={{
          fontFamily: FONTS.mono, fontSize: 24, fontWeight: 600,
          letterSpacing: '0.30em', textTransform: 'uppercase',
          color: 'rgba(90,169,255,0.5)',
          marginBottom: 24,
          opacity: labelP,
          transform: `translateY(${interpolate(labelP, [0, 1], [-16, 0])}px)`,
        }}>
          MONTE CARLO SIMULATION
        </div>

        {/* Giant counter */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: 168, fontWeight: 900,
          letterSpacing: '-0.04em', color: PALETTE.electric,
          opacity: heroP,
          transform: `translateY(${heroY}px)`,
          lineHeight: 0.95,
          textShadow: `0 0 ${60 * heroP * glowPulse}px rgba(90,169,255,${0.55 * heroP})`,
        }}>
          {countStr}
        </div>

        {/* "SIMULATED ENGAGEMENTS" label */}
        <div style={{
          fontFamily: FONTS.mono, fontSize: 24, fontWeight: 700,
          letterSpacing: '0.26em', textTransform: 'uppercase',
          color: PALETTE.onDark,
          marginTop: 28,
          opacity: labelP,
          transform: `translateY(${labelY}px)`,
        }}>
          SIMULATED ENGAGEMENTS
        </div>

        {/* Accent rule under label */}
        <div style={{
          width: 260, height: 2,
          background: `linear-gradient(90deg, transparent 0%, ${PALETTE.electric} 40%, ${PALETTE.electric} 60%, transparent 100%)`,
          marginTop: 14,
          opacity: labelP * 0.5,
          transform: `scaleX(${spring({ frame: Math.max(0, frame - 55), fps, config: MOTION.springSnappy })})`,
          transformOrigin: 'center',
        }} />
      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// Phase 2 | template: focal-offset | bg: dark
// ── Phase 2: BAR CHART — PL-15 only, cued condition, 80% ─────────────────────
const Phase2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Chart category label
  const topLabelP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springSnappy });

  // PL-15 bar springs up to 80%
  const pl15P = spring({ frame: Math.max(0, frame - 20), fps, config: MOTION.springBouncy });
  const pl15Pct = interpolate(pl15P, [0, 1], [0, 80]);
  const pl15H = pctToH(pl15Pct);

  // Counter animates alongside bar
  const pl15Counter = Math.round(pl15Pct);

  // Bar label entrance
  const barLabelP = spring({ frame: Math.max(0, frame - 30), fps, config: MOTION.springOverdamped });

  // "CUED CONDITION" badge springs in
  const badgeP = spring({ frame: Math.max(0, frame - 80), fps, config: MOTION.springSnappy });

  // Glow pulse
  const glowPulse = 0.7 + 0.3 * Math.sin(frame * 0.12);

  const bx = BAR_CENTERS[0];

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Radial glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 50% 60% at ${bx / 19.2}% 65%, rgba(90,169,255,${0.08 * glowPulse}) 0%, transparent 60%)`,
      }} />

      {/* Chart category label — top */}
      <div style={{
        position: 'absolute', top: 100, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        opacity: topLabelP,
        transform: `translateY(${interpolate(topLabelP, [0, 1], [-14, 0])}px)`,
      }}>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 24, fontWeight: 600,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'rgba(90,169,255,0.5)',
        }}>
          SIMULATED PK — PROBABILITY OF KILL
        </div>
        <div style={{
          width: 440, height: 1, background: PALETTE.electric,
          marginTop: 12, opacity: 0.2,
          transform: `scaleX(${topLabelP})`, transformOrigin: 'center',
        }} />
      </div>

      {/* Chart SVG */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
           viewBox="0 0 1920 1080">

        {/* Baseline */}
        <line
          x1={bx - CHART_BAR_WIDTH / 2 - 60}
          y1={CHART_BASELINE_Y}
          x2={bx + CHART_BAR_WIDTH / 2 + 60}
          y2={CHART_BASELINE_Y}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />

        {/* PL-15 bar */}
        <rect
          x={bx - CHART_BAR_WIDTH / 2}
          y={CHART_BASELINE_Y - pl15H}
          width={CHART_BAR_WIDTH}
          height={pl15H}
          fill={PALETTE.electric}
          opacity={0.9}
          rx={4}
          style={{ filter: `drop-shadow(0 0 ${12 * glowPulse}px rgba(90,169,255,0.5))` }}
        />

        {/* % counter above bar */}
        {pl15H > 10 && (
          <text
            x={bx}
            y={CHART_BASELINE_Y - pl15H - 16}
            textAnchor="middle"
            fontFamily={FONTS.mono}
            fontSize="28"
            fontWeight="700"
            fill={PALETTE.electric}
            opacity={barLabelP}
          >
            {pl15Counter}%
          </text>
        )}

        {/* Bar label below baseline */}
        <text
          x={bx}
          y={CHART_BASELINE_Y + 40}
          textAnchor="middle"
          fontFamily={FONTS.heading}
          fontSize="22"
          fontWeight="700"
          fill={PALETTE.onDark}
          letterSpacing="2"
          opacity={barLabelP}
        >
          PL-15
        </text>
        <text
          x={bx}
          y={CHART_BASELINE_Y + 66}
          textAnchor="middle"
          fontFamily={FONTS.mono}
          fontSize="13"
          fill="rgba(255,255,255,0.45)"
          letterSpacing="2"
          opacity={barLabelP}
        >
          CHINA
        </text>

        {/* Grid lines at 25%, 50%, 75%, 100% */}
        {[25, 50, 75, 100].map((pct) => {
          const gy = CHART_BASELINE_Y - pctToH(pct);
          return (
            <g key={pct} opacity={0.18 * topLabelP}>
              <line
                x1={bx - CHART_BAR_WIDTH / 2 - 80}
                y1={gy}
                x2={bx + CHART_BAR_WIDTH / 2 + 80}
                y2={gy}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="0.5"
                strokeDasharray="6 5"
              />
              <text
                x={bx - CHART_BAR_WIDTH / 2 - 88}
                y={gy + 4}
                textAnchor="end"
                fontFamily={FONTS.mono}
                fontSize="12"
                fill="rgba(255,255,255,0.3)"
              >
                {pct}%
              </text>
            </g>
          );
        })}

      </svg>

      {/* "CUED CONDITION" badge — bottom center */}
      <div style={{
        position: 'absolute', bottom: 240, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: badgeP,
        transform: `translateY(${interpolate(badgeP, [0, 1], [16, 0])}px)`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 24px',
          border: `1px solid rgba(90,169,255,0.35)`,
          background: 'rgba(90,169,255,0.08)',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: PALETTE.electric,
            boxShadow: `0 0 8px ${PALETTE.electric}`,
          }} />
          <div style={{
            fontFamily: FONTS.mono, fontSize: 24, fontWeight: 600,
            letterSpacing: '0.24em', textTransform: 'uppercase',
            color: PALETTE.electric,
          }}>
            CUED CONDITION — FULL SENSOR FUSION ACTIVE
          </div>
        </div>
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// Phase 3 | template: split-compare | bg: dark
// ── Phase 3: BAR CHART — PL-16 joins (f0), HQ-9 joins (f137) ─────────────────
const Phase3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // PL-15 is already at 80% from previous phase — stays there
  const pl15H = pctToH(80);

  // PL-16 bar springs up from frame 0
  const pl16P = spring({ frame: Math.max(0, frame - 0), fps, config: MOTION.springBouncy });
  const pl16Pct = interpolate(pl16P, [0, 1], [0, 89]);
  const pl16H = pctToH(pl16Pct);
  const pl16Counter = Math.round(pl16Pct);

  // HQ-9 bar springs up from frame 137
  const hq9P = spring({ frame: Math.max(0, frame - 137), fps, config: MOTION.springBouncy });
  const hq9Pct = interpolate(hq9P, [0, 1], [0, 79]);
  const hq9H = pctToH(hq9Pct);
  const hq9Counter = Math.round(hq9Pct);

  // Labels
  const topLabelP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springSnappy });
  const hq9LabelP = spring({ frame: Math.max(0, frame - 140), fps, config: MOTION.springOverdamped });
  const hq9ChipP = spring({ frame: Math.max(0, frame - 150), fps, config: MOTION.springSnappy });

  // Grid entrance
  const gridP = spring({ frame: Math.max(0, frame - 4), fps, config: MOTION.springOverdamped });

  const [bx0, bx1, bx2] = BAR_CENTERS;

  // Wide baseline covering all 3 bars
  const baselineLeft = bx0 - CHART_BAR_WIDTH / 2 - 60;
  const baselineRight = bx2 + CHART_BAR_WIDTH / 2 + 60;

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Radial glow — wide, covering all bars */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 65%, rgba(90,169,255,0.05) 0%, transparent 65%)',
      }} />

      {/* Chart top label */}
      <div style={{
        position: 'absolute', top: 100, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        opacity: topLabelP,
        transform: `translateY(${interpolate(topLabelP, [0, 1], [-14, 0])}px)`,
      }}>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 24, fontWeight: 600,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'rgba(90,169,255,0.5)',
        }}>
          SIMULATED PK — PROBABILITY OF KILL
        </div>
        <div style={{
          width: 640, height: 1, background: PALETTE.electric,
          marginTop: 12, opacity: 0.2,
          transform: `scaleX(${topLabelP})`, transformOrigin: 'center',
        }} />
      </div>

      {/* Chart SVG */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
           viewBox="0 0 1920 1080">

        {/* Grid lines */}
        {[25, 50, 75, 100].map((pct) => {
          const gy = CHART_BASELINE_Y - pctToH(pct);
          return (
            <g key={pct} opacity={0.15 * gridP}>
              <line
                x1={baselineLeft - 40} y1={gy}
                x2={baselineRight + 40} y2={gy}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="0.5"
                strokeDasharray="6 5"
              />
              <text
                x={baselineLeft - 48}
                y={gy + 4}
                textAnchor="end"
                fontFamily={FONTS.mono}
                fontSize="12"
                fill="rgba(255,255,255,0.3)"
              >
                {pct}%
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line
          x1={baselineLeft} y1={CHART_BASELINE_Y}
          x2={baselineRight} y2={CHART_BASELINE_Y}
          stroke="rgba(255,255,255,0.15)" strokeWidth="1"
        />

        {/* ── PL-15 bar (electric blue) ── */}
        <rect
          x={bx0 - CHART_BAR_WIDTH / 2}
          y={CHART_BASELINE_Y - pl15H}
          width={CHART_BAR_WIDTH}
          height={pl15H}
          fill={PALETTE.electric}
          opacity={0.9}
          rx={4}
          style={{ filter: 'drop-shadow(0 0 10px rgba(90,169,255,0.45))' }}
        />
        <text
          x={bx0} y={CHART_BASELINE_Y - pl15H - 16}
          textAnchor="middle"
          fontFamily={FONTS.mono} fontSize="26" fontWeight="700"
          fill={PALETTE.electric} opacity={0.9}
        >
          80%
        </text>
        <text x={bx0} y={CHART_BASELINE_Y + 40}
          textAnchor="middle" fontFamily={FONTS.heading}
          fontSize="22" fontWeight="700" fill={PALETTE.onDark} letterSpacing="2">
          PL-15
        </text>
        <text x={bx0} y={CHART_BASELINE_Y + 66}
          textAnchor="middle" fontFamily={FONTS.mono}
          fontSize="13" fill="rgba(255,255,255,0.45)" letterSpacing="2">
          CHINA
        </text>

        {/* ── PL-16 bar (accent/amber) ── */}
        <rect
          x={bx1 - CHART_BAR_WIDTH / 2}
          y={CHART_BASELINE_Y - pl16H}
          width={CHART_BAR_WIDTH}
          height={pl16H}
          fill={PALETTE.accent}
          opacity={0.88}
          rx={4}
          style={{ filter: 'drop-shadow(0 0 8px rgba(196,135,59,0.4))' }}
        />
        {pl16H > 10 && (
          <text
            x={bx1} y={CHART_BASELINE_Y - pl16H - 16}
            textAnchor="middle"
            fontFamily={FONTS.mono} fontSize="26" fontWeight="700"
            fill={PALETTE.accent} opacity={0.9}
          >
            {pl16Counter}%
          </text>
        )}
        <text x={bx1} y={CHART_BASELINE_Y + 40}
          textAnchor="middle" fontFamily={FONTS.heading}
          fontSize="22" fontWeight="700" fill={PALETTE.onDark} letterSpacing="2">
          PL-16
        </text>
        <text x={bx1} y={CHART_BASELINE_Y + 66}
          textAnchor="middle" fontFamily={FONTS.mono}
          fontSize="13" fill="rgba(255,255,255,0.45)" letterSpacing="2">
          CHINA
        </text>

        {/* ── HQ-9 bar (onDark/white) ── */}
        <rect
          x={bx2 - CHART_BAR_WIDTH / 2}
          y={CHART_BASELINE_Y - hq9H}
          width={CHART_BAR_WIDTH}
          height={hq9H}
          fill="rgba(255,255,255,0.75)"
          opacity={0.85}
          rx={4}
        />
        {hq9H > 10 && (
          <text
            x={bx2} y={CHART_BASELINE_Y - hq9H - 16}
            textAnchor="middle"
            fontFamily={FONTS.mono} fontSize="26" fontWeight="700"
            fill={PALETTE.onDark} opacity={hq9LabelP}
          >
            {hq9Counter}%
          </text>
        )}
        <text x={bx2} y={CHART_BASELINE_Y + 40}
          textAnchor="middle" fontFamily={FONTS.heading}
          fontSize="22" fontWeight="700" fill={PALETTE.onDark} letterSpacing="2"
          opacity={hq9LabelP}>
          HQ-9
        </text>
        <text x={bx2} y={CHART_BASELINE_Y + 66}
          textAnchor="middle" fontFamily={FONTS.mono}
          fontSize="13" fill="rgba(255,255,255,0.45)" letterSpacing="2"
          opacity={hq9LabelP}>
          CHINA
        </text>

      </svg>

      {/* HQ-9 photo chip — 100x100 thumbnail beside HQ-9 label */}
      {hq9ChipP > 0.02 && (
        <div style={{
          position: 'absolute',
          left: BAR_CENTERS[2] + CHART_BAR_WIDTH / 2 + 16,
          top: CHART_BASELINE_Y + 22,
          opacity: hq9ChipP,
          transform: `translateY(${interpolate(hq9ChipP, [0, 1], [10, 0])}px)`,
        }}>
          <div style={{
            width: 90, height: 90, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4,
          }}>
            <Img
              src={staticFile('images/s08_hq9.png')}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 50%' }}
            />
          </div>
        </div>
      )}

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// Phase 4 | template: lower-third | bg: dark
// ── Phase 4: LOWER THIRD — chart dims, caption holds ─────────────────────────
const Phase4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Chart holds at end-of-phase3 values but dims
  const chartDimOpacity = interpolate(frame, [0, 40], [0.7, 0.35], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Caption springs in from frame 10
  const captionP = spring({ frame: Math.max(0, frame - 10), fps, config: MOTION.springOverdamped });
  const captionY = interpolate(captionP, [0, 1], [20, 0]);

  // Accent rule draws under caption
  const ruleP = spring({ frame: Math.max(0, frame - 20), fps, config: MOTION.springSnappy });

  const [bx0, bx1, bx2] = BAR_CENTERS;
  const baselineLeft = bx0 - CHART_BAR_WIDTH / 2 - 60;
  const baselineRight = bx2 + CHART_BAR_WIDTH / 2 + 60;

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Dimmed chart in background */}
      <div style={{ opacity: chartDimOpacity }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
             viewBox="0 0 1920 1080">
          <line x1={baselineLeft} y1={CHART_BASELINE_Y} x2={baselineRight} y2={CHART_BASELINE_Y}
            stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          {/* PL-15 */}
          <rect x={bx0 - CHART_BAR_WIDTH / 2} y={CHART_BASELINE_Y - pctToH(80)}
            width={CHART_BAR_WIDTH} height={pctToH(80)}
            fill={PALETTE.electric} opacity={0.7} rx={4} />
          <text x={bx0} y={CHART_BASELINE_Y - pctToH(80) - 16}
            textAnchor="middle" fontFamily={FONTS.mono} fontSize="22" fill={PALETTE.electric} opacity={0.7}>80%</text>
          <text x={bx0} y={CHART_BASELINE_Y + 38}
            textAnchor="middle" fontFamily={FONTS.heading} fontSize="20" fill={PALETTE.onDark} opacity={0.6} letterSpacing="2">PL-15</text>
          {/* PL-16 */}
          <rect x={bx1 - CHART_BAR_WIDTH / 2} y={CHART_BASELINE_Y - pctToH(89)}
            width={CHART_BAR_WIDTH} height={pctToH(89)}
            fill={PALETTE.accent} opacity={0.65} rx={4} />
          <text x={bx1} y={CHART_BASELINE_Y - pctToH(89) - 16}
            textAnchor="middle" fontFamily={FONTS.mono} fontSize="22" fill={PALETTE.accent} opacity={0.7}>89%</text>
          <text x={bx1} y={CHART_BASELINE_Y + 38}
            textAnchor="middle" fontFamily={FONTS.heading} fontSize="20" fill={PALETTE.onDark} opacity={0.6} letterSpacing="2">PL-16</text>
          {/* HQ-9 */}
          <rect x={bx2 - CHART_BAR_WIDTH / 2} y={CHART_BASELINE_Y - pctToH(79)}
            width={CHART_BAR_WIDTH} height={pctToH(79)}
            fill="rgba(255,255,255,0.6)" opacity={0.65} rx={4} />
          <text x={bx2} y={CHART_BASELINE_Y - pctToH(79) - 16}
            textAnchor="middle" fontFamily={FONTS.mono} fontSize="22" fill={PALETTE.onDark} opacity={0.65}>79%</text>
          <text x={bx2} y={CHART_BASELINE_Y + 38}
            textAnchor="middle" fontFamily={FONTS.heading} fontSize="20" fill={PALETTE.onDark} opacity={0.6} letterSpacing="2">HQ-9</text>
        </svg>
      </div>

      {/* Lower-third caption — bottom of frame, safe zone */}
      <div style={{
        position: 'absolute',
        bottom: 240,
        left: 160, right: 160,
        opacity: captionP,
        transform: `translateY(${captionY}px)`,
      }}>
        {/* Accent rule — no drift, static left edge */}
        <div style={{
          width: 260, height: 2,
          background: PALETTE.electric,
          marginBottom: 18, opacity: 0.5,
          transform: `scaleX(${ruleP})`,
          transformOrigin: 'left',
        }} />
        <div style={{
          fontFamily: FONTS.body, fontSize: 32, fontWeight: 400,
          color: PALETTE.onDarkMuted, letterSpacing: '0.01em',
          fontStyle: 'italic',
          lineHeight: 1.4,
        }}>
          A properly cued Chinese kill chain — at full stretch.
        </div>
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// Phase 5 | template: stacked-reveal | bg: dark
// ── Phase 5: STACKED REVEAL — blackout, three lines ──────────────────────────
const Phase5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Complete darkness until ~65f
  // "Not the missile." springs in at frame 71
  const notMissileP = spring({ frame: Math.max(0, frame - 71), fps, config: MOTION.springSnappy });
  const notMissileY = interpolate(notMissileP, [0, 1], [32, 0]);

  // "Not the fighter." springs in at frame 110
  const notFighterP = spring({ frame: Math.max(0, frame - 110), fps, config: MOTION.springSnappy });
  const notFighterY = interpolate(notFighterP, [0, 1], [32, 0]);

  // "THE CUE." scale-slams at frame 144 in PALETTE.secondary
  const theCueP = spring({ frame: Math.max(0, frame - 118), fps, config: { damping: 10, stiffness: 200, mass: 1.0 } });
  const theCueScale = interpolate(
    spring({ frame: Math.max(0, frame - 118), fps, config: { damping: 10, stiffness: 200, mass: 1.0 } }),
    [0, 1], [1.2, 1.0]
  );
  const theCueY = interpolate(theCueP, [0, 1], [40, 0]);

  // Red pulse behind "THE CUE."
  const cueGlow = theCueP > 0.02 ? 0.5 + 0.5 * Math.sin(frame * 0.15) : 0;

  // Faint background vignette (total dark feel)
  const bgOpacity = interpolate(frame, [0, 30], [1, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: '#000000', overflow: 'hidden' }}>
      {/* Subtle dark gradient to add depth without distracting */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(11,22,34,0.0) 0%, rgba(0,0,0,0.6) 100%)',
        opacity: bgOpacity,
      }} />

      {/* Red glow behind THE CUE. */}
      {theCueP > 0.02 && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse 50% 35% at 50% 58%, rgba(196,55,59,${0.12 * cueGlow * theCueP}) 0%, transparent 65%)`,
        }} />
      )}

      {/* Centered stacked layout */}
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '140px 240px 240px 240px',
        gap: 0,
      }}>

        {/* "Not the missile." */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: 48, fontWeight: 700,
          color: PALETTE.onDarkMuted, letterSpacing: '-0.01em',
          textAlign: 'center', lineHeight: 1.2,
          opacity: notMissileP,
          transform: `translateY(${notMissileY}px)`,
          marginBottom: 20,
        }}>
          Not the missile.
        </div>

        {/* "Not the fighter." */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: 48, fontWeight: 700,
          color: PALETTE.onDarkMuted, letterSpacing: '-0.01em',
          textAlign: 'center', lineHeight: 1.2,
          opacity: notFighterP,
          transform: `translateY(${notFighterY}px)`,
          marginBottom: 40,
        }}>
          Not the fighter.
        </div>

        {/* Divider before THE CUE. */}
        {theCueP > 0.02 && (
          <div style={{
            width: interpolate(theCueP, [0, 1], [0, 180]),
            height: 2,
            background: PALETTE.secondary,
            marginBottom: 22,
            opacity: 0.7,
          }} />
        )}

        {/* "THE CUE." — scale slam, red */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: 80, fontWeight: 900,
          color: PALETTE.secondary,
          letterSpacing: '-0.02em', textAlign: 'center', lineHeight: 1.0,
          opacity: theCueP,
          transform: `translateY(${theCueY}px) scale(${theCueScale})`,
          transformOrigin: 'center bottom',
          textShadow: `0 0 ${40 * theCueP * (0.7 + 0.3 * Math.sin(frame * 0.15))}px rgba(196,55,59,${0.7 * theCueP})`,
        }}>
          THE CUE.
        </div>

      </AbsoluteFill>

      <Grain opacity={0.035} />
    </AbsoluteFill>
  );
};

// Phase 6 | template: focal-offset | bg: dark
// ── Phase 6: BARS COLLAPSE — springHeavy, impact.mp3 ─────────────────────────
const Phase6: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Chart reappears at full values first, then collapses
  const chartAppearP = spring({ frame: Math.max(0, frame - 0), fps, config: MOTION.springOverdamped });

  // PL-15 collapse: 80% → 44% starts immediately
  const pl15CollapseP = spring({ frame: Math.max(0, frame - 10), fps, config: MOTION.springHeavy });
  const pl15Pct = interpolate(pl15CollapseP, [0, 1], [80, 44]);
  const pl15H = pctToH(pl15Pct);

  // PL-17 crash: 78% (cued, vs AEW&C/tanker target) → ~5%. Narration names PL-17 here;
  // uncued PL-16 stays ~49% per the source, so the collapsing bar must be PL-17.
  const pl16CollapseP = spring({ frame: Math.max(0, frame - 30), fps, config: MOTION.springHeavy });
  const pl16Pct = interpolate(pl16CollapseP, [0, 1], [78, 5]);
  const pl16H = pctToH(pl16Pct);

  // HQ-9 crash: 79% → ~3%, starts immediately
  const hq9CollapseP = spring({ frame: Math.max(0, frame - 10), fps, config: MOTION.springHeavy });
  const hq9Pct = interpolate(hq9CollapseP, [0, 1], [79, 3]);
  const hq9H = pctToH(hq9Pct);

  // Impact flash at frame ~40 (when collapses peak)
  const impactFlash = interpolate(frame, [38, 42, 52, 65], [0, 1, 0.6, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Red tint grows as bars fall
  const redTint = interpolate(frame, [10, 80], [0, 0.06], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // "UNCUED" label springs in after collapse
  const uncuedP = spring({ frame: Math.max(0, frame - 110), fps, config: MOTION.springSnappy });

  // Top chart label
  const topLabelP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springSnappy });

  const [bx0, bx1, bx2] = BAR_CENTERS;
  const baselineLeft = bx0 - CHART_BAR_WIDTH / 2 - 60;
  const baselineRight = bx2 + CHART_BAR_WIDTH / 2 + 60;

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* SFX: impact.mp3 at frame ~35 */}
      <Sequence from={33}>
        <Audio
          src={staticFile('sfx/impact.mp3')}
          volume={(f) => interpolate(f, [0, 2, 12, 30], [0, 0.7, 0.7, 0.0], { extrapolateRight: 'clamp' })}
        />
      </Sequence>

      {/* Impact flash */}
      {impactFlash > 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `rgba(196,55,59,${impactFlash * 0.12})`,
          zIndex: 90, pointerEvents: 'none',
        }} />
      )}

      {/* Growing red ambient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 80% 70% at 50% 60%, rgba(196,55,59,${redTint}) 0%, transparent 70%)`,
      }} />

      {/* Chart top label */}
      <div style={{
        position: 'absolute', top: 100, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        opacity: topLabelP,
      }}>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 24, fontWeight: 600,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'rgba(90,169,255,0.5)',
        }}>
          SIMULATED PK — CUE REMOVED
        </div>
        {/* Red warning stripe */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 10,
          opacity: interpolate(frame, [30, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          <div style={{ width: 20, height: 1.5, background: PALETTE.secondary, opacity: 0.7 }} />
          <div style={{
            fontFamily: FONTS.mono, fontSize: 24, letterSpacing: '0.22em',
            color: PALETTE.secondary, opacity: 0.7,
          }}>
            SENSOR FUSION OFFLINE
          </div>
          <div style={{ width: 20, height: 1.5, background: PALETTE.secondary, opacity: 0.7 }} />
        </div>
      </div>

      {/* Chart SVG */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
           viewBox="0 0 1920 1080" opacity={chartAppearP}>

        {/* Grid lines */}
        {[25, 50, 75, 100].map((pct) => {
          const gy = CHART_BASELINE_Y - pctToH(pct);
          return (
            <g key={pct} opacity={0.12}>
              <line x1={baselineLeft - 40} y1={gy} x2={baselineRight + 40} y2={gy}
                stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="6 5" />
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={baselineLeft} y1={CHART_BASELINE_Y} x2={baselineRight} y2={CHART_BASELINE_Y}
          stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

        {/* PL-15 bar (electric→dim as it collapses but stays) */}
        <rect
          x={bx0 - CHART_BAR_WIDTH / 2}
          y={CHART_BASELINE_Y - Math.max(pl15H, 0)}
          width={CHART_BAR_WIDTH}
          height={Math.max(pl15H, 0)}
          fill={PALETTE.electric}
          opacity={interpolate(pl15CollapseP, [0, 1], [0.9, 0.5])}
          rx={4}
        />
        <text x={bx0} y={CHART_BASELINE_Y - Math.max(pl15H, 0) - 16}
          textAnchor="middle" fontFamily={FONTS.mono} fontSize="22" fontWeight="700"
          fill={PALETTE.electric} opacity={0.6}>
          {Math.round(pl15Pct)}%
        </text>
        <text x={bx0} y={CHART_BASELINE_Y + 38}
          textAnchor="middle" fontFamily={FONTS.heading} fontSize="20" fontWeight="700"
          fill={PALETTE.onDark} opacity={0.6} letterSpacing="2">PL-15</text>

        {/* PL-16 bar (crashes to near zero — secondary red) */}
        <rect
          x={bx1 - CHART_BAR_WIDTH / 2}
          y={CHART_BASELINE_Y - Math.max(pl16H, 0)}
          width={CHART_BAR_WIDTH}
          height={Math.max(pl16H, 0)}
          fill={interpolate(pl16CollapseP, [0, 0.3, 1], [0, 0, 1]) > 0.3 ? PALETTE.secondary : PALETTE.accent}
          opacity={interpolate(pl16CollapseP, [0, 1], [0.85, 0.7])}
          rx={4}
          style={{ filter: pl16CollapseP > 0.3 ? 'drop-shadow(0 0 8px rgba(196,55,59,0.4))' : 'none' }}
        />
        <text x={bx1} y={CHART_BASELINE_Y - Math.max(pl16H, 6) - 16}
          textAnchor="middle" fontFamily={FONTS.mono} fontSize="22" fontWeight="700"
          fill={PALETTE.secondary} opacity={pl16CollapseP}>
          {Math.round(pl16Pct)}%
        </text>
        <text x={bx1} y={CHART_BASELINE_Y + 38}
          textAnchor="middle" fontFamily={FONTS.heading} fontSize="20" fontWeight="700"
          fill={PALETTE.onDark} opacity={0.6} letterSpacing="2">PL-17</text>

        {/* HQ-9 bar (crashes) */}
        <rect
          x={bx2 - CHART_BAR_WIDTH / 2}
          y={CHART_BASELINE_Y - Math.max(hq9H, 0)}
          width={CHART_BAR_WIDTH}
          height={Math.max(hq9H, 0)}
          fill={hq9CollapseP > 0.3 ? PALETTE.secondary : 'rgba(255,255,255,0.7)'}
          opacity={interpolate(hq9CollapseP, [0, 1], [0.8, 0.65])}
          rx={4}
          style={{ filter: hq9CollapseP > 0.3 ? 'drop-shadow(0 0 8px rgba(196,55,59,0.35))' : 'none' }}
        />
        <text x={bx2} y={CHART_BASELINE_Y - Math.max(hq9H, 6) - 16}
          textAnchor="middle" fontFamily={FONTS.mono} fontSize="22" fontWeight="700"
          fill={PALETTE.secondary} opacity={hq9CollapseP}>
          {Math.round(hq9Pct)}%
        </text>
        <text x={bx2} y={CHART_BASELINE_Y + 38}
          textAnchor="middle" fontFamily={FONTS.heading} fontSize="20" fontWeight="700"
          fill={PALETTE.onDark} opacity={0.6} letterSpacing="2">HQ-9</text>

      </svg>

      {/* "UNCUED CONDITION" badge */}
      <div style={{
        position: 'absolute', bottom: 240, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: uncuedP,
        transform: `translateY(${interpolate(uncuedP, [0, 1], [16, 0])}px)`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 24px',
          border: `1px solid rgba(196,55,59,0.35)`,
          background: 'rgba(196,55,59,0.08)',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: PALETTE.secondary,
            boxShadow: `0 0 8px ${PALETTE.secondary}`,
          }} />
          <div style={{
            fontFamily: FONTS.mono, fontSize: 24, fontWeight: 600,
            letterSpacing: '0.24em', textTransform: 'uppercase',
            color: PALETTE.secondary,
          }}>
            UNCUED — NO OFFBOARD DATA
          </div>
        </div>
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// Phase 7 | template: panoramic-flow | bg: dark
// ── Phase 7: COLLAPSE CONTINUES + GHOST VALUES ────────────────────────────────
const Phase7: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Continued collapse — already collapsed from phase 6, now showing ghost values
  // PL-15 further settles at 44%
  const pl15SettleP = spring({ frame: Math.max(0, frame - 0), fps, config: MOTION.springOverdamped });
  const pl15Pct = interpolate(pl15SettleP, [0, 1], [50, 44]); // settles toward 44
  const pl15H = pctToH(pl15Pct);

  // PL-16 fully crashed at ~0, slight tremble
  const pl16Pct = interpolate(
    spring({ frame: Math.max(0, frame - 0), fps, config: MOTION.springHeavy }),
    [0, 1], [8, 3]
  );
  const pl16H = pctToH(pl16Pct);

  // HQ-9 fully crashed at ~0
  const hq9Pct = interpolate(
    spring({ frame: Math.max(0, frame - 0), fps, config: MOTION.springHeavy }),
    [0, 1], [6, 2]
  );
  const hq9H = pctToH(hq9Pct);

  // Ghost labels fade in at frame 30
  const ghostP = spring({ frame: Math.max(0, frame - 30), fps, config: MOTION.springOverdamped });

  // Ghost text y positions — where old bars used to reach
  const ghost80Y = CHART_BASELINE_Y - pctToH(80); // where PL-15 was
  const ghost89Y = CHART_BASELINE_Y - pctToH(78); // where PL-17 was (cued 78%)
  const ghost79Y = CHART_BASELINE_Y - pctToH(79); // where HQ-9 was

  // Delta labels showing the drop
  const deltaP = spring({ frame: Math.max(0, frame - 60), fps, config: MOTION.springSnappy });

  // Red ambient
  const redAmbient = 0.08;

  const [bx0, bx1, bx2] = BAR_CENTERS;
  const baselineLeft = bx0 - CHART_BAR_WIDTH / 2 - 60;
  const baselineRight = bx2 + CHART_BAR_WIDTH / 2 + 60;

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Red ambient glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 85% 70% at 50% 60%, rgba(196,55,59,${redAmbient}) 0%, transparent 70%)`,
      }} />

      {/* Chart label */}
      <div style={{
        position: 'absolute', top: 100, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 24, fontWeight: 600,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'rgba(196,55,59,0.6)',
        }}>
          SIMULATED PK — CUE REMOVED
        </div>
      </div>

      {/* Chart SVG */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
           viewBox="0 0 1920 1080">

        {/* Baseline */}
        <line x1={baselineLeft} y1={CHART_BASELINE_Y} x2={baselineRight} y2={CHART_BASELINE_Y}
          stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

        {/* ── GHOST LINES at old bar heights ── */}
        {/* Ghost for PL-15 80% */}
        <line x1={bx0 - CHART_BAR_WIDTH / 2 - 20} y1={ghost80Y}
          x2={bx0 + CHART_BAR_WIDTH / 2 + 20} y2={ghost80Y}
          stroke={PALETTE.electric} strokeWidth="1" strokeDasharray="8 4"
          opacity={ghostP * 0.35} />
        <text x={bx0 - CHART_BAR_WIDTH / 2 - 28} y={ghost80Y + 5}
          textAnchor="end" fontFamily={FONTS.mono} fontSize="16" fontWeight="600"
          fill={PALETTE.electric} opacity={ghostP * 0.3}>
          80%
        </text>

        {/* Ghost for PL-17 78% */}
        <line x1={bx1 - CHART_BAR_WIDTH / 2 - 20} y1={ghost89Y}
          x2={bx1 + CHART_BAR_WIDTH / 2 + 20} y2={ghost89Y}
          stroke={PALETTE.accent} strokeWidth="1" strokeDasharray="8 4"
          opacity={ghostP * 0.3} />
        <text x={bx1 - CHART_BAR_WIDTH / 2 - 28} y={ghost89Y + 5}
          textAnchor="end" fontFamily={FONTS.mono} fontSize="16" fontWeight="600"
          fill={PALETTE.accent} opacity={ghostP * 0.28}>
          78%
        </text>

        {/* Ghost for HQ-9 79% */}
        <line x1={bx2 - CHART_BAR_WIDTH / 2 - 20} y1={ghost79Y}
          x2={bx2 + CHART_BAR_WIDTH / 2 + 20} y2={ghost79Y}
          stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="8 4"
          opacity={ghostP * 0.25} />
        <text x={bx2 - CHART_BAR_WIDTH / 2 - 28} y={ghost79Y + 5}
          textAnchor="end" fontFamily={FONTS.mono} fontSize="16" fontWeight="600"
          fill="rgba(255,255,255,0.5)" opacity={ghostP * 0.23}>
          79%
        </text>

        {/* ── Collapsed bars ── */}

        {/* PL-15 — still at 44%, electric but dim */}
        <rect
          x={bx0 - CHART_BAR_WIDTH / 2}
          y={CHART_BASELINE_Y - Math.max(pl15H, 0)}
          width={CHART_BAR_WIDTH}
          height={Math.max(pl15H, 0)}
          fill={PALETTE.electric}
          opacity={0.45}
          rx={4}
        />
        <text x={bx0} y={CHART_BASELINE_Y - Math.max(pl15H, 0) - 14}
          textAnchor="middle" fontFamily={FONTS.mono} fontSize="20" fontWeight="700"
          fill={PALETTE.electric} opacity={0.55}>
          {Math.round(pl15Pct)}%
        </text>
        <text x={bx0} y={CHART_BASELINE_Y + 38}
          textAnchor="middle" fontFamily={FONTS.heading} fontSize="20" fontWeight="700"
          fill={PALETTE.onDark} opacity={0.5} letterSpacing="2">PL-15</text>

        {/* PL-17 — near zero, red rubble */}
        <rect
          x={bx1 - CHART_BAR_WIDTH / 2}
          y={CHART_BASELINE_Y - Math.max(pl16H, 2)}
          width={CHART_BAR_WIDTH}
          height={Math.max(pl16H, 2)}
          fill={PALETTE.secondary}
          opacity={0.7}
          rx={2}
          style={{ filter: 'drop-shadow(0 0 6px rgba(196,55,59,0.3))' }}
        />
        <text x={bx1} y={CHART_BASELINE_Y - Math.max(pl16H, 4) - 14}
          textAnchor="middle" fontFamily={FONTS.mono} fontSize="20" fontWeight="700"
          fill={PALETTE.secondary} opacity={0.7}>
          {Math.round(pl16Pct)}%
        </text>
        <text x={bx1} y={CHART_BASELINE_Y + 38}
          textAnchor="middle" fontFamily={FONTS.heading} fontSize="20" fontWeight="700"
          fill={PALETTE.onDark} opacity={0.5} letterSpacing="2">PL-17</text>

        {/* HQ-9 — near zero, red rubble */}
        <rect
          x={bx2 - CHART_BAR_WIDTH / 2}
          y={CHART_BASELINE_Y - Math.max(hq9H, 2)}
          width={CHART_BAR_WIDTH}
          height={Math.max(hq9H, 2)}
          fill={PALETTE.secondary}
          opacity={0.65}
          rx={2}
          style={{ filter: 'drop-shadow(0 0 6px rgba(196,55,59,0.3))' }}
        />
        <text x={bx2} y={CHART_BASELINE_Y - Math.max(hq9H, 4) - 14}
          textAnchor="middle" fontFamily={FONTS.mono} fontSize="20" fontWeight="700"
          fill={PALETTE.secondary} opacity={0.65}>
          {Math.round(hq9Pct)}%
        </text>
        <text x={bx2} y={CHART_BASELINE_Y + 38}
          textAnchor="middle" fontFamily={FONTS.heading} fontSize="20" fontWeight="700"
          fill={PALETTE.onDark} opacity={0.5} letterSpacing="2">HQ-9</text>

        {/* ── Delta arrows (drop magnitude) ── */}
        {deltaP > 0.05 && (
          <>
            {/* PL-15: 80→44 */}
            <text x={bx0 + CHART_BAR_WIDTH / 2 + 14} y={CHART_BASELINE_Y - pl15H - 10}
              textAnchor="start" fontFamily={FONTS.mono} fontSize="15" fontWeight="700"
              fill={PALETTE.secondary} opacity={deltaP * 0.8}>
              ▼ −36
            </text>

            {/* PL-17: 78→~3 */}
            <text x={bx1 + CHART_BAR_WIDTH / 2 + 14} y={CHART_BASELINE_Y - Math.max(pl16H, 0) - 20}
              textAnchor="start" fontFamily={FONTS.mono} fontSize="15" fontWeight="700"
              fill={PALETTE.secondary} opacity={deltaP * 0.8}>
              ▼ −75
            </text>

            {/* HQ-9: 79→~2 */}
            <text x={bx2 + CHART_BAR_WIDTH / 2 + 14} y={CHART_BASELINE_Y - Math.max(hq9H, 0) - 20}
              textAnchor="start" fontFamily={FONTS.mono} fontSize="15" fontWeight="700"
              fill={PALETTE.secondary} opacity={deltaP * 0.8}>
              ▼ −77
            </text>
          </>
        )}

      </svg>

      {/* Ghost label caption */}
      <div style={{
        position: 'absolute', bottom: 240, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: ghostP,
        transform: `translateY(${interpolate(ghostP, [0, 1], [12, 0])}px)`,
      }}>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 24, letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase',
        }}>
          Dashed lines: cued values. Bars: uncued reality.
        </div>
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// Phase 8 | template: centered-hero | bg: dark
// ── Phase 8: CLIMAX CARD — "CUED, OR NOT?" ───────────────────────────────────
const Phase8: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // SFX: impact.mp3 at climax slam (frame ~125)
  // Small line springs in at frame 0
  const smallLineP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springOverdamped });
  const smallLineY = interpolate(smallLineP, [0, 1], [20, 0]);

  // Accent rule under small line
  const ruleP = spring({ frame: Math.max(0, frame - 18), fps, config: MOTION.springSnappy });

  // Hero slam at frame 128
  const heroP = spring({ frame: Math.max(0, frame - 113), fps, config: { damping: 12, stiffness: 280, mass: 1.0 } });
  const heroScale = interpolate(
    spring({ frame: Math.max(0, frame - 113), fps, config: { damping: 10, stiffness: 200, mass: 1.1 } }),
    [0, 1], [1.2, 1.0]
  );
  const heroY = interpolate(heroP, [0, 1], [44, 0]);

  // Glow pulse on hero
  const heroPulse = heroP > 0.02 ? 0.6 + 0.4 * Math.sin(frame * 0.12) : 0;

  // Red flash on slam
  const slamFlash = interpolate(frame, [128, 132, 140, 155], [0, 1, 0.5, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Background pulse
  const bgPulse = heroP > 0.02 ? 0.5 + 0.5 * Math.sin(frame * 0.1) : 0;

  return (
    <AbsoluteFill style={{ background: '#000000', overflow: 'hidden' }}>
      {/* SFX: impact.mp3 at climax */}
      <Sequence from={126}>
        <Audio
          src={staticFile('sfx/impact.mp3')}
          volume={(f) => interpolate(f, [0, 2, 14, 35], [0, 0.7, 0.7, 0.0], { extrapolateRight: 'clamp' })}
        />
      </Sequence>

      {/* Slam flash */}
      {slamFlash > 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `rgba(196,55,59,${slamFlash * 0.14})`,
          zIndex: 90, pointerEvents: 'none',
        }} />
      )}

      {/* Radial glow — electric/red split */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 60% 55% at 40% 50%, rgba(90,169,255,${0.06 * heroP * bgPulse}) 0%, transparent 55%)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 50% 45% at 65% 54%, rgba(196,55,59,${0.07 * heroP * bgPulse}) 0%, transparent 50%)`,
      }} />

      {/* Centered layout */}
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '140px 200px 240px 200px',
      }}>

        {/* Small setup line */}
        <div style={{
          fontFamily: FONTS.body, fontSize: 28, fontWeight: 400,
          color: PALETTE.onDarkMuted, letterSpacing: '0.01em',
          textAlign: 'center', fontStyle: 'italic',
          opacity: smallLineP,
          transform: `translateY(${smallLineY}px)`,
          marginBottom: 20,
          maxWidth: 840,
        }}>
          The entire architecture lives or dies on a single question.
        </div>

        {/* Thin accent rule */}
        <div style={{
          width: 200, height: 1.5,
          background: `linear-gradient(90deg, ${PALETTE.electric} 0%, ${PALETTE.secondary} 100%)`,
          marginBottom: 44,
          transform: `scaleX(${ruleP})`,
          transformOrigin: 'center',
          opacity: 0.6,
        }} />

        {/* "CUED, OR NOT?" — hero scale slam */}
        <div style={{
          opacity: heroP,
          transform: `translateY(${heroY}px) scale(${heroScale})`,
          transformOrigin: 'center center',
        }}>
          <div style={{
            fontFamily: FONTS.heading, fontSize: 92, fontWeight: 900,
            letterSpacing: '-0.025em', textAlign: 'center',
            lineHeight: 1.0,
            display: 'flex', alignItems: 'baseline',
            flexWrap: 'nowrap', justifyContent: 'center', gap: '0.04em',
          }}>
            <span style={{
              color: PALETTE.electric,
              textShadow: `0 0 ${40 * heroP * heroPulse}px rgba(90,169,255,${0.65 * heroP})`,
            }}>
              CUED
            </span>
            <span style={{ color: PALETTE.onDark, opacity: 0.9 }}>,</span>
            <span style={{ color: PALETTE.onDark, opacity: 0.9, fontSize: 92 }}> OR </span>
            <span style={{
              color: PALETTE.secondary,
              textShadow: `0 0 ${30 * heroP * heroPulse}px rgba(196,55,59,${0.6 * heroP})`,
            }}>
              NOT?
            </span>
          </div>
        </div>

      </AbsoluteFill>

      <Grain opacity={0.035} />
    </AbsoluteFill>
  );
};

// ── Root: TransitionSeries — ALL fade(), ALL 18 frames ────────────────────────
export default function Scene_07() {
  const TRANSITION = 18;

  return (
    <TransitionSeries>
      {/* Phase 1: 165f — digit cascade hero stat */}
      <TransitionSeries.Sequence durationInFrames={165}>
        <Phase1 />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 2: 179f — bar chart PL-15 only */}
      <TransitionSeries.Sequence durationInFrames={179}>
        <Phase2 />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 3: 260f — bar chart PL-16 + HQ-9 join */}
      <TransitionSeries.Sequence durationInFrames={260}>
        <Phase3 />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 4: 152f — lower third, chart dims */}
      <TransitionSeries.Sequence durationInFrames={152}>
        <Phase4 />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 5: 208f — stacked reveal, three lines */}
      <TransitionSeries.Sequence durationInFrames={208}>
        <Phase5 />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 6: 217f — bars collapse with springHeavy */}
      <TransitionSeries.Sequence durationInFrames={217}>
        <Phase6 />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 7: 215f — ghost values, collapsed state */}
      <TransitionSeries.Sequence durationInFrames={215}>
        <Phase7 />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 8: 213f — climax card "CUED, OR NOT?" */}
      <TransitionSeries.Sequence durationInFrames={213}>
        <Phase8 />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
}
