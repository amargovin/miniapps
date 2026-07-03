// Scene_09 | templates: split-compare(2), focal-offset(2), stacked-reveal(1), panoramic-flow(1)
// "A Long-Range Missile Won't Fix India's PL-15 Problem" — THE MIRROR (India's sensor fleet is thin)
// 1176 frames @ 30fps | ALL phases: PALETTE.bg (cream) — sober audit tone
// TSM: (245+163+160+255+219+224) − (5×18=90) = 1266 − 90 = 1176 ✓

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

// ── Aircraft pictogram (simple jet chevron) ──────────────────────────────────
const AircraftIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 28,
  color = PALETTE.primary,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 28"
    style={{ display: 'block' }}
  >
    {/* Fuselage */}
    <polygon points="14,2 16.5,17 14,14 11.5,17" fill={color} opacity={0.9} />
    {/* Left wing */}
    <polygon points="13.5,10 2,18 2,21 13.5,13" fill={color} opacity={0.82} />
    {/* Right wing */}
    <polygon points="14.5,10 26,18 26,21 14.5,13" fill={color} opacity={0.82} />
    {/* Left tail */}
    <polygon points="13.5,14 8,22 9.5,23.5 13.5,16" fill={color} opacity={0.65} />
    {/* Right tail */}
    <polygon points="14.5,14 20,22 18.5,23.5 14.5,16" fill={color} opacity={0.65} />
  </svg>
);

// ══════════════════════════════════════════════════════════════════════════════
// Phase 1 | template: split-compare | bg: solid-cream
// dur=245f — "9" vs "6" hero numerals. Pakistan 9 AEW&C vs India 6 AEW&C.
// Aircraft pictograms stagger in per panel.
// ══════════════════════════════════════════════════════════════════════════════
const Phase1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Panel entries
  const leftP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springSnappy });
  const rightP = spring({ frame: Math.max(0, frame - 20), fps, config: MOTION.springSnappy });

  // Divider draws from frame 10
  const dividerP = spring({ frame: Math.max(0, frame - 10), fps, config: MOTION.springSnappy });

  // Left label (Pakistan) at frame 30
  const leftLabelP = spring({ frame: Math.max(0, frame - 30), fps, config: MOTION.springSnappy });
  // Right label (India) at frame 40
  const rightLabelP = spring({ frame: Math.max(0, frame - 40), fps, config: MOTION.springSnappy });

  // 9 Pakistani aircraft pictograms — grid 3×3
  const pak9 = Array.from({ length: 9 });
  // 6 Indian aircraft pictograms — grid 2×3
  const ind6 = Array.from({ length: 6 });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, overflow: 'hidden' }}>
      {/* ── Vertical divider ── */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 120,
          width: 1.5,
          height: `${dividerP * 84}%`,
          background: PALETTE.primary,
          opacity: 0.15,
          transform: 'translateX(-50%)',
        }}
      />

      {/* ══ LEFT PANEL — Pakistan ══ */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '50%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 220,
          paddingTop: 80,
          boxSizing: 'border-box',
          opacity: leftP,
          transform: `translateX(${interpolate(leftP, [0, 1], [-24, 0])}px)`,
        }}
      >
        {/* Country label */}
        <div
          style={{
            opacity: leftLabelP,
            transform: `translateY(${interpolate(leftLabelP, [0, 1], [10, 0])}px)`,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '0.22em',
              color: PALETTE.textMuted,
              textTransform: 'uppercase',
            }}
          >
            PAKISTAN — AEW&amp;C
          </span>
        </div>

        {/* Hero numeral "9" */}
        <div style={{ marginBottom: 28 }}>
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 200,
              fontWeight: 800,
              color: PALETTE.secondary,
              letterSpacing: '-0.06em',
              lineHeight: 1.0,
              display: 'block',
            }}
          >
            9
          </span>
        </div>

        {/* 9 aircraft icons — 3×3 grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 36px)',
            gridTemplateRows: 'repeat(3, 36px)',
            gap: '10px 12px',
          }}
        >
          {pak9.map((_, i) => {
            const iconP = spring({
              frame: Math.max(0, frame - (40 + i * 10)),
              fps,
              config: MOTION.springBouncy,
            });
            return (
              <div
                key={i}
                style={{
                  opacity: iconP,
                  transform: `scale(${interpolate(iconP, [0, 1], [0.4, 1.0])}) translateY(${interpolate(iconP, [0, 1], [8, 0])}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AircraftIcon size={28} color={PALETTE.secondary} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ RIGHT PANEL — India ══ */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '50%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 220,
          paddingTop: 80,
          boxSizing: 'border-box',
          opacity: rightP,
          transform: `translateX(${interpolate(rightP, [0, 1], [24, 0])}px)`,
        }}
      >
        {/* Country label */}
        <div
          style={{
            opacity: rightLabelP,
            transform: `translateY(${interpolate(rightLabelP, [0, 1], [10, 0])}px)`,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '0.22em',
              color: PALETTE.textMuted,
              textTransform: 'uppercase',
            }}
          >
            INDIA — AEW&amp;C
          </span>
        </div>

        {/* Hero numeral "6" */}
        <div style={{ marginBottom: 28 }}>
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 200,
              fontWeight: 800,
              color: PALETTE.primary,
              letterSpacing: '-0.06em',
              lineHeight: 1.0,
              display: 'block',
            }}
          >
            6
          </span>
        </div>

        {/* 6 aircraft icons — 2×3 grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 36px)',
            gridTemplateRows: 'repeat(2, 36px)',
            gap: '10px 12px',
          }}
        >
          {ind6.map((_, i) => {
            const iconP = spring({
              frame: Math.max(0, frame - (50 + i * 12)),
              fps,
              config: MOTION.springBouncy,
            });
            return (
              <div
                key={i}
                style={{
                  opacity: iconP,
                  transform: `scale(${interpolate(iconP, [0, 1], [0.4, 1.0])}) translateY(${interpolate(iconP, [0, 1], [8, 0])}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AircraftIcon size={28} color={PALETTE.primary} />
              </div>
            );
          })}
        </div>
      </div>

      <Grain opacity={0.038} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 2 | template: focal-offset | bg: image | asset: s09_awacs_ageing.png (2048×2048 square)
// dur=163f — 3× Phalcon A-50EI / 3× Netra Mk-1 label. Muted photo. Ken Burns.
// ══════════════════════════════════════════════════════════════════════════════
const Phase2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Ken Burns: subtle zoom 1.0 → 1.06
  const kbScale = interpolate(frame, [0, 163], [1.0, 1.06], {
    extrapolateRight: 'clamp',
  });

  const labelP = spring({ frame: Math.max(0, frame - 10), fps, config: MOTION.springSnappy });
  const typeP1 = spring({ frame: Math.max(0, frame - 30), fps, config: MOTION.springSnappy });
  const typeP2 = spring({ frame: Math.max(0, frame - 52), fps, config: MOTION.springSnappy });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, overflow: 'hidden' }}>
      {/* ── Right panel: image (55%) — square image, objectFit cover ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '55%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <Img
          src={staticFile('s09_awacs_ageing.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 40%',
            transform: `scale(${kbScale})`,
            willChange: 'transform',
            filter: 'grayscale(0.3) brightness(0.9) contrast(1.04)',
          }}
        />
        {/* Left-edge fade to cream */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 160,
            height: '100%',
            background: `linear-gradient(90deg, ${PALETTE.bg}, transparent)`,
          }}
        />
        {/* Bottom fade */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 180,
            background: `linear-gradient(0deg, ${PALETTE.bg} 0%, transparent 100%)`,
          }}
        />
      </div>

      {/* ── Left panel: text ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '48%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '120px 80px 240px 140px',
          boxSizing: 'border-box',
        }}
      >
        {/* Section label */}
        <div
          style={{
            opacity: labelP,
            transform: `translateY(${interpolate(labelP, [0, 1], [12, 0])}px)`,
            marginBottom: 24,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '0.24em',
              color: PALETTE.secondary,
              textTransform: 'uppercase',
            }}
          >
            INDIA'S FLEET — TODAY
          </span>
        </div>

        {/* Accent rule */}
        <div
          style={{
            width: interpolate(labelP, [0, 1], [0, 56]),
            height: 3,
            background: PALETTE.primary,
            marginBottom: 32,
            borderRadius: 2,
          }}
        />

        {/* Type line 1 */}
        <div
          style={{
            opacity: typeP1,
            transform: `translateY(${interpolate(typeP1, [0, 1], [18, 0])}px)`,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 48,
              fontWeight: 700,
              color: PALETTE.primary,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            3× PHALCON A-50EI
          </span>
        </div>

        {/* Type line 2 */}
        <div
          style={{
            opacity: typeP2,
            transform: `translateY(${interpolate(typeP2, [0, 1], [18, 0])}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 48,
              fontWeight: 700,
              color: PALETTE.primary,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            3× NETRA MK-1
          </span>
        </div>

        {/* Supporting note */}
        <div
          style={{
            marginTop: 32,
            opacity: interpolate(frame, [80, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 24,
              color: PALETTE.textMuted,
              lineHeight: 1.6,
            }}
          >
            Six aircraft to cover a frontier that demands twelve.
          </span>
        </div>
      </div>

      <Grain opacity={0.038} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 3 | template: stacked-reveal | bg: solid-cream
// dur=160f — Audit line items stamp. Serviceability / aircrew shortage / no repair plan.
// Red flag marks beside each line.
// ══════════════════════════════════════════════════════════════════════════════
const Phase3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Header enters at frame 5
  const headerP = spring({ frame: Math.max(0, frame - 5), fps, config: MOTION.springSnappy });

  // Stamp springs for each line
  const line1P = spring({ frame: Math.max(0, frame - 18), fps, config: MOTION.springSnappy });
  const line1Scale = interpolate(line1P, [0, 1], [1.1, 1.0]);

  const line2P = spring({ frame: Math.max(0, frame - 48), fps, config: MOTION.springSnappy });
  const line2Scale = interpolate(line2P, [0, 1], [1.1, 1.0]);

  const line3P = spring({ frame: Math.max(0, frame - 60), fps, config: MOTION.springSnappy });
  const line3Scale = interpolate(line3P, [0, 1], [1.1, 1.0]);

  // Citation at frame 112
  const citationP = spring({ frame: Math.max(0, frame - 70), fps, config: MOTION.springSnappy });

  const auditLines = [
    { label: 'Serviceability', flag: true, p: line1P, scale: line1Scale },
    { label: 'Aircrew shortage', flag: true, p: line2P, scale: line2Scale },
    { label: 'No long-term repair plan', flag: true, p: line3P, scale: line3Scale },
  ];

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '120px 240px 240px 240px',
          boxSizing: 'border-box',
        }}
      >
        {/* Section header */}
        <div
          style={{
            opacity: headerP,
            transform: `translateY(${interpolate(headerP, [0, 1], [14, 0])}px)`,
            marginBottom: 40,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '0.26em',
              color: PALETTE.secondary,
              textTransform: 'uppercase',
            }}
          >
            AUDIT FINDINGS
          </span>
        </div>

        {/* Accent rule */}
        <div
          style={{
            width: interpolate(headerP, [0, 1], [0, 56]),
            height: 3,
            background: PALETTE.primary,
            marginBottom: 48,
            borderRadius: 2,
          }}
        />

        {/* Audit lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {auditLines.map(({ label, p, scale }, i) => (
            <div
              key={i}
              style={{
                opacity: p,
                transform: `scale(${scale})`,
                transformOrigin: 'left center',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
              }}
            >
              {/* Red flag */}
              <div
                style={{
                  width: 10,
                  height: 36,
                  background: PALETTE.secondary,
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              />
              {/* Small flag pennant */}
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '12px solid transparent',
                  borderBottom: '12px solid transparent',
                  borderLeft: `20px solid ${PALETTE.secondary}`,
                  marginLeft: -16,
                  flexShrink: 0,
                  opacity: 0.7,
                }}
              />
              <span
                style={{
                  fontFamily: FONTS.heading,
                  fontSize: 56,
                  fontWeight: 700,
                  color: PALETTE.primary,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.1,
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* CAG citation */}
        <div
          style={{
            marginTop: 40,
            opacity: citationP,
            transform: `translateY(${interpolate(citationP, [0, 1], [12, 0])}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              color: PALETTE.textMuted,
              letterSpacing: '0.12em',
            }}
          >
            — CAG, 2015
          </span>
        </div>
      </div>

      <Grain opacity={0.038} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 4 | template: split-compare | bg: solid-cream
// dur=255f — Blueprint outline cards. "NETRA MK-1A ×6" / "AWACS INDIA ×6 (A321)".
// Both stamped "ON PAPER" in red at ~frame 100.
// ══════════════════════════════════════════════════════════════════════════════
const Phase4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card 1 appears at frame 10
  const card1P = spring({ frame: Math.max(0, frame - 10), fps, config: MOTION.springSnappy });
  // Card 2 appears at frame 28
  const card2P = spring({ frame: Math.max(0, frame - 28), fps, config: MOTION.springSnappy });

  // Card border draws (clip from top-left)
  const borderDraw1 = interpolate(frame, [10, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const borderDraw2 = interpolate(frame, [28, 98], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "ON PAPER" stamp at frame 100
  const stamp1P = spring({
    frame: Math.max(0, frame - 100),
    fps,
    config: { damping: 12, stiffness: 300, mass: 0.8 },
  });
  const stampScale1 = interpolate(stamp1P, [0, 1], [1.3, 1.0]);

  const stamp2P = spring({
    frame: Math.max(0, frame - 114),
    fps,
    config: { damping: 12, stiffness: 300, mass: 0.8 },
  });
  const stampScale2 = interpolate(stamp2P, [0, 1], [1.3, 1.0]);

  // Caveats at frame 150
  const caveatP = spring({ frame: Math.max(0, frame - 150), fps, config: MOTION.springSnappy });

  const BlueprintCard: React.FC<{
    title: string;
    subtitle: string;
    cardOpacity: number;
    borderProgress: number;
    stampProgress: number;
    stampScale: number;
  }> = ({ title, subtitle, cardOpacity, borderProgress, stampProgress, stampScale }) => (
    <div
      style={{
        opacity: cardOpacity,
        position: 'relative',
        width: 700,
        padding: '60px 56px',
        boxSizing: 'border-box',
      }}
    >
      {/* Blueprint border — drawn via SVG */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        width="700"
        height="280"
      >
        {/* Dashed outline of the card */}
        <rect
          x="1"
          y="1"
          width="698"
          height="278"
          fill="none"
          stroke={PALETTE.primary}
          strokeWidth={1.5}
          strokeDasharray="12 6"
          opacity={0.35}
          strokeDashoffset={interpolate(borderProgress, [0, 1], [2800, 0])}
        />
      </svg>

      {/* Content */}
      <div style={{ paddingTop: 8 }}>
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.22em',
            color: PALETTE.textMuted,
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: 16,
          }}
        >
          {subtitle}
        </span>
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 52,
            fontWeight: 700,
            color: PALETTE.primary,
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
            display: 'block',
          }}
        >
          {title}
        </span>
      </div>

      {/* ON PAPER stamp */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          right: 48,
          opacity: stampProgress,
          transform: `scale(${stampScale}) rotate(-5deg)`,
          transformOrigin: 'right bottom',
          border: `3px solid ${PALETTE.secondary}`,
          borderRadius: 4,
          padding: '8px 20px',
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: '0.22em',
            color: PALETTE.secondary,
            textTransform: 'uppercase',
          }}
        >
          ON PAPER
        </span>
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 96,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.26em',
            color: PALETTE.textMuted,
            textTransform: 'uppercase',
          }}
        >
          PLANNED — NOT YET DELIVERED
        </span>
      </div>

      {/* Two cards side by side */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 80,
          paddingBottom: 200,
          paddingTop: 80,
        }}
      >
        <BlueprintCard
          title="NETRA MK-1A ×6"
          subtitle="Programme A"
          cardOpacity={card1P}
          borderProgress={borderDraw1}
          stampProgress={stamp1P}
          stampScale={stampScale1}
        />
        <BlueprintCard
          title={"AWACS INDIA ×6\n(A321)"}
          subtitle="Programme B"
          cardOpacity={card2P}
          borderProgress={borderDraw2}
          stampProgress={stamp2P}
          stampScale={stampScale2}
        />
      </div>

      <Grain opacity={0.038} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 5 | template: panoramic-flow | bg: solid-cream
// dur=219f — Timeline draws left to right: "2026" → "END OF THE 2030s".
// Greyed ticks at 2028/2030/2032/2034. Label lands at ~frame 152.
// ══════════════════════════════════════════════════════════════════════════════
const Phase5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const LINE_X1 = 200;
  const LINE_X2 = 1720;
  const LINE_LEN = LINE_X2 - LINE_X1; // 1520px
  const LINE_Y = 540;

  // Line draws left to right from frame 10
  const lineProgress = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { stiffness: 60, damping: 18, mass: 1 },
  });
  const dashOffset = LINE_LEN * (1 - lineProgress);

  // "2026" node at frame 12
  const node2026P = spring({ frame: Math.max(0, frame - 12), fps, config: MOTION.springSnappy });

  // Intermediate ticks appear as line passes them
  const tickYears = [2028, 2030, 2032, 2034];
  const tickXs = tickYears.map((y) => {
    const t = (y - 2026) / (2039 - 2026);
    return LINE_X1 + t * LINE_LEN;
  });

  // "END OF THE 2030s" label at frame 152
  const endLabelP = spring({ frame: Math.max(0, frame - 119), fps, config: MOTION.springSnappy });

  // Header at frame 6
  const headerP = spring({ frame: Math.max(0, frame - 6), fps, config: MOTION.springSnappy });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: headerP,
          transform: `translateY(${interpolate(headerP, [0, 1], [12, 0])}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.26em',
            color: PALETTE.textMuted,
            textTransform: 'uppercase',
          }}
        >
          DELIVERY TIMELINE — BOTH PROGRAMMES
        </span>
      </div>

      {/* ── SVG timeline ── */}
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
        viewBox="0 0 1920 1080"
        width="1920"
        height="1080"
      >
        {/* Main timeline line */}
        <line
          x1={LINE_X1}
          y1={LINE_Y}
          x2={LINE_X2}
          y2={LINE_Y}
          stroke={PALETTE.primary}
          strokeWidth={2}
          strokeDasharray={LINE_LEN}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          opacity={0.55}
        />

        {/* Arrowhead at right end */}
        <g
          opacity={interpolate(lineProgress, [0.9, 1.0], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}
        >
          <polygon
            points={`${LINE_X2},${LINE_Y} ${LINE_X2 - 20},${LINE_Y - 10} ${LINE_X2 - 20},${LINE_Y + 10}`}
            fill={PALETTE.primary}
            opacity={0.55}
          />
        </g>

        {/* 2026 start node */}
        <circle
          cx={LINE_X1}
          cy={LINE_Y}
          r={7}
          fill={PALETTE.primary}
          opacity={node2026P * 0.8}
        />
        <text
          x={LINE_X1}
          y={LINE_Y - 22}
          textAnchor="middle"
          fill={PALETTE.primary}
          fontFamily={FONTS.mono}
          fontSize={22}
          fontWeight={700}
          opacity={node2026P}
        >
          2026
        </text>

        {/* Intermediate ticks */}
        {tickYears.map((year, i) => {
          const tx = tickXs[i];
          // Each tick appears as the line reaches its position
          const tickProgress = Math.max(0, (tx - LINE_X1) / LINE_LEN);
          const tickOpacity = interpolate(
            lineProgress,
            [tickProgress, tickProgress + 0.1],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );
          return (
            <g key={year} opacity={tickOpacity * 0.45}>
              <line
                x1={tx}
                y1={LINE_Y - 14}
                x2={tx}
                y2={LINE_Y + 14}
                stroke={PALETTE.textMuted}
                strokeWidth={1.5}
              />
              <text
                x={tx}
                y={LINE_Y + 36}
                textAnchor="middle"
                fill={PALETTE.textMuted}
                fontFamily={FONTS.mono}
                fontSize={17}
              >
                {year}
              </text>
            </g>
          );
        })}

        {/* End node */}
        <circle
          cx={LINE_X2}
          cy={LINE_Y}
          r={7}
          fill={PALETTE.secondary}
          opacity={endLabelP * 0.9}
        />
      </svg>

      {/* "END OF THE 2030s" label */}
      <div
        style={{
          position: 'absolute',
          left: LINE_X2 - 180,
          top: LINE_Y - 90,
          opacity: endLabelP,
          transform: `translateY(${interpolate(endLabelP, [0, 1], [14, 0])}px)`,
          textAlign: 'right',
        }}
      >
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 36,
            fontWeight: 700,
            color: PALETTE.secondary,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          END OF THE 2030s
        </span>
        <br />
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 24,
            color: PALETTE.textMuted,
          }}
        >
          Best-case estimate
        </span>
      </div>

      <Grain opacity={0.038} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 6 | template: focal-offset | bg: image | asset: s01_r37m_underwing.png (16:9)
// dur=224f — Desaturated/muted small photo left. "A question nobody was asking." No drift.
// ══════════════════════════════════════════════════════════════════════════════
const Phase6: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Photo fades in at frame 8 — NO drift (stillness)
  const photoP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springHeavy });

  // Headline at frame 28
  const headP = spring({ frame: Math.max(0, frame - 28), fps, config: MOTION.springSnappy });

  // Sub-note at frame 80
  const subP = spring({ frame: Math.max(0, frame - 80), fps, config: MOTION.springSnappy });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, overflow: 'hidden' }}>
      {/* ── Left panel: muted photo (35%) ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '35%',
          height: '100%',
          overflow: 'hidden',
          opacity: photoP,
        }}
      >
        <Img
          src={staticFile('s01_r37m_underwing.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 50%',
            // NO drift — complete stillness
            filter: 'grayscale(0.5) brightness(0.85) contrast(0.95)',
          }}
        />
        {/* Right-edge blend to cream */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 180,
            height: '100%',
            background: `linear-gradient(90deg, transparent, ${PALETTE.bg})`,
          }}
        />
        {/* Bottom fade */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 200,
            background: `linear-gradient(0deg, ${PALETTE.bg} 0%, transparent 100%)`,
          }}
        />
      </div>

      {/* ── Right panel: text (65%) ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '65%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '120px 180px 240px 80px',
          boxSizing: 'border-box',
        }}
      >
        {/* Accent rule */}
        <div
          style={{
            width: interpolate(headP, [0, 1], [0, 56]),
            height: 3,
            background: PALETTE.primary,
            marginBottom: 32,
            borderRadius: 2,
          }}
        />

        {/* "A question nobody was asking." */}
        <div
          style={{
            opacity: headP,
            transform: `translateY(${interpolate(headP, [0, 1], [28, 0])}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 64,
              fontWeight: 700,
              color: PALETTE.primary,
              letterSpacing: '-0.01em',
              lineHeight: 1.15,
            }}
          >
            A question{' '}
            <span style={{ color: PALETTE.secondary }}>nobody</span>
            {' '}was asking.
          </span>
        </div>

        {/* Sub note */}
        <div
          style={{
            marginTop: 36,
            opacity: subP,
            transform: `translateY(${interpolate(subP, [0, 1], [14, 0])}px)`,
            maxWidth: 640,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 28,
              color: PALETTE.textMuted,
              lineHeight: 1.6,
            }}
          >
            The question everyone should have been asking: can India even see far enough to use what it is about to buy?
          </span>
        </div>
      </div>

      <Grain opacity={0.038} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Scene_09 root — TransitionSeries with 18-frame fade() transitions (all cream)
// TSM: (245+163+160+255+219+224) − (5×18=90) = 1266 − 90 = 1176 ✓
// ══════════════════════════════════════════════════════════════════════════════
export default function Scene_09() {
  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      <TransitionSeries>
        {/* Phase 1 → Phase 2 */}
        <TransitionSeries.Sequence durationInFrames={245}>
          <Phase1 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 18 })} />

        {/* Phase 2 → Phase 3 */}
        <TransitionSeries.Sequence durationInFrames={163}>
          <Phase2 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 18 })} />

        {/* Phase 3 → Phase 4 */}
        <TransitionSeries.Sequence durationInFrames={160}>
          <Phase3 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 18 })} />

        {/* Phase 4 → Phase 5 */}
        <TransitionSeries.Sequence durationInFrames={255}>
          <Phase4 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 18 })} />

        {/* Phase 5 → Phase 6 */}
        <TransitionSeries.Sequence durationInFrames={219}>
          <Phase5 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 18 })} />

        {/* Phase 6 — final */}
        <TransitionSeries.Sequence durationInFrames={248}>
          <Phase6 />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
}
