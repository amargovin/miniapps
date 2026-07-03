// Scene_02 | templates: centered-hero(3), focal-offset(2), split-compare(2), stacked-reveal(1)
// "A Long-Range Missile Won't Fix India's PL-15 Problem" — THE OBVIOUS ANSWER
// 1510 frames @ 30fps | 8 phases | Hybrid: cream editorial → dark-cinematic

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
import { PALETTE, FONTS, MOTION, EASING, RAMP, FILM_GRAIN_SVG } from '../theme';
import { ambientScale, breathe, driftY, enterP, exitP, holdOpacity } from '../motion-utils';

// ── Film grain layer ──────────────────────────────────────────────────────────
const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.035 }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      opacity,
      pointerEvents: 'none',
      mixBlendMode: 'overlay',
      backgroundImage: FILM_GRAIN_SVG,
      backgroundSize: '170px 170px',
    }}
  />
);

// ── Tonal background helpers ──────────────────────────────────────────────────
// Cream scenes: RAMP.cream base with subtle radial ramp for depth
const CreamBg: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 90% 80% at 50% 46%, ${RAMP.cream[3]} 0%, ${RAMP.cream[2]} 42%, ${RAMP.cream[0]} 100%)`,
    }}
  />
);

// ── Safe zone constants ────────────────────────────────────────────────────────
const SAFE_PAD_TOP = 120;
const SAFE_PAD_BOTTOM = 240;
const SAFE_PAD_SIDE = 160;

// ── Chart typography (shared by the range-gap chart) ──────────────────────────
// 24px floor per audit TYP rule; hoisted to module scope.
const CHART_TYPE = {
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 24,
    fontWeight: 500,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: PALETTE.textMuted,
  },
  tick: {
    fontFamily: FONTS.mono,
    fontSize: 24,
    fontWeight: 500,
    color: PALETTE.textMuted,
    letterSpacing: '0.04em',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  barLabel: {
    fontFamily: FONTS.body,
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  value: {
    fontFamily: FONTS.mono,
    fontSize: 24,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  bracket: {
    fontFamily: FONTS.mono,
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  source: {
    fontFamily: FONTS.mono,
    fontSize: 24,
    fontWeight: 400,
    letterSpacing: '0.06em',
    color: PALETTE.textMuted,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — THE PURCHASE (centered-hero, cream, 241f)
// template: centered-hero | entrance: label→rule→headline stagger
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 1 | template: centered-hero | bg: cream
const Phase1: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 241;

  // Entrances — editorial bezier, not spring bounce
  const labelOp = enterP(frame, 0, 22);
  const labelY = interpolate(labelOp, [0, 1], [18, 0]);
  const ruleScale = enterP(frame, 10, 20);
  const headlineOp = enterP(frame, 20, 26);
  const headlineY = interpolate(headlineOp, [0, 1], [44, 0]);
  const subOp = enterP(frame, 36, 22);
  const subY = interpolate(subOp, [0, 1], [22, 0]);

  // Ambient idle — whole canvas slow push
  const canvasScale = ambientScale(frame, { from: 1, to: 1.034, over: dur });

  // Ghost numeral activates dead void (top left region)
  const ghostOp = enterP(frame, 14, 30) * 0.05;

  // Exit — reverse hierarchy: sub → headline → label, finish by frame dur-18
  const exitStart = dur - 32;
  const subExitOp = 1 - exitP(frame, exitStart, 12);
  const headExitOp = 1 - exitP(frame, exitStart + 4, 12);
  const labelExitOp = 1 - exitP(frame, exitStart + 8, 12);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <CreamBg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${canvasScale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Ghost oversized numeral — activates top-left void */}
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 80,
            fontFamily: FONTS.heading,
            fontSize: 340,
            fontWeight: 900,
            color: RAMP.cream[0],
            lineHeight: 1,
            opacity: ghostOp,
            userSelect: 'none',
            pointerEvents: 'none',
            letterSpacing: '-0.04em',
          }}
        >
          02
        </div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${SAFE_PAD_TOP}px ${SAFE_PAD_SIDE}px ${SAFE_PAD_BOTTOM}px ${SAFE_PAD_SIDE}px`,
            boxSizing: 'border-box',
          }}
        >
          {/* Label */}
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: PALETTE.secondary,
              opacity: labelOp * labelExitOp,
              transform: `translateY(${labelY}px)`,
              marginBottom: 14,
            }}
          >
            THE PURCHASE
          </div>

          {/* Accent rule */}
          <div
            style={{
              width: 64,
              height: 3,
              background: PALETTE.secondary,
              transformOrigin: 'center',
              transform: `scaleX(${ruleScale})`,
              marginBottom: 32,
              opacity: labelExitOp,
            }}
          />

          {/* Hero headline */}
          <div
            style={{
              fontFamily: FONTS.heading,
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: PALETTE.primary,
              textAlign: 'center',
              lineHeight: 1.02,
              maxWidth: 1200,
              opacity: headlineOp * headExitOp,
              transform: `translateY(${headlineY}px)`,
              transformOrigin: 'center',
            }}
          >
            A deal unthinkable<br />not long ago
          </div>

          {/* Sub-label */}
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: '0.01em',
              color: PALETTE.textMuted,
              textAlign: 'center',
              marginTop: 40,
              opacity: subOp * subExitOp,
              transform: `translateY(${subY}px)`,
            }}
          >
            MARCH – APRIL 2026
          </div>
        </div>
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — $1.2 BILLION (centered-hero, cream, 215f)
// template: centered-hero | digit-roll hero stat + count-up
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 2 | template: centered-hero | bg: cream
const Phase2: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 215;

  // Digit roll $1.2B — editorial pace
  const dollarRoll = interpolate(frame, [12, 70], [0, 1.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASING.outSoft,
  });

  // Missiles count-up 0 → 300
  const missileCount = interpolate(frame, [22, 95], [0, 300], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASING.outSoft,
  });

  // Entrance
  const labelOp = enterP(frame, 0, 20);
  const labelY = interpolate(labelOp, [0, 1], [14, 0]);
  const statOp = enterP(frame, 8, 28);
  const statY = interpolate(statOp, [0, 1], [62, 0]);
  const subOp = enterP(frame, 30, 22);
  const subY = interpolate(subOp, [0, 1], [28, 0]);
  const dividerW = interpolate(subOp, [0, 1], [0, 320]);

  // Ambient idle — stat breathes, sub drifts slightly
  const statBreathe = breathe(frame, { period: 140, amp: 0.005, phase: 0 });
  const subDrift = driftY(frame, { amp: 5, period: 200, phase: 40 });
  const canvasScale = ambientScale(frame, { from: 1, to: 1.03, over: dur });

  // Ghost oversized '$' activates left void
  const ghostOp = enterP(frame, 6, 30) * 0.045;

  // Exits — body first, then stat, then label
  const exitStart = dur - 30;
  const subExitOp = 1 - exitP(frame, exitStart, 12);
  const statExitOp = 1 - exitP(frame, exitStart + 4, 12);
  const labelExitOp = 1 - exitP(frame, exitStart + 8, 12);

  const displayBillion = dollarRoll.toFixed(1);
  const displayMissiles = Math.round(missileCount);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <CreamBg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${canvasScale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Ghost oversized '$' in background */}
        <div
          style={{
            position: 'absolute',
            top: -40,
            left: -20,
            fontFamily: FONTS.heading,
            fontSize: 520,
            fontWeight: 900,
            color: RAMP.cream[0],
            lineHeight: 1,
            opacity: ghostOp,
            userSelect: 'none',
            pointerEvents: 'none',
            letterSpacing: '-0.05em',
          }}
        >
          $
        </div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${SAFE_PAD_TOP}px ${SAFE_PAD_SIDE}px ${SAFE_PAD_BOTTOM}px ${SAFE_PAD_SIDE}px`,
            boxSizing: 'border-box',
          }}
        >
          {/* Label */}
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: PALETTE.accent,
              opacity: labelOp * labelExitOp,
              transform: `translateY(${labelY}px)`,
              marginBottom: 32,
            }}
          >
            THE DEAL
          </div>

          {/* Hero stat — $X.X BILLION */}
          <div
            style={{
              fontFamily: FONTS.heading,
              fontSize: 168,
              fontWeight: 900,
              letterSpacing: '-0.035em',
              color: PALETTE.primary,
              textAlign: 'center',
              lineHeight: 1.0,
              fontVariantNumeric: 'tabular-nums',
              opacity: statOp * statExitOp,
              transform: `translateY(${statY}px) scale(${statBreathe})`,
              transformOrigin: 'center',
            }}
          >
            ${displayBillion}{' '}
            <span style={{ color: PALETTE.secondary }}>BILLION</span>
          </div>

          {/* Divider rule */}
          <div
            style={{
              width: dividerW,
              height: 2,
              background: PALETTE.textMuted,
              margin: '32px 0',
              opacity: subOp * subExitOp,
            }}
          />

          {/* Missile count-up */}
          <div
            style={{
              fontFamily: FONTS.heading,
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: PALETTE.text,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
              opacity: subOp * subExitOp,
              transform: `translateY(${subDrift}px)`,
            }}
          >
            ≈{displayMissiles}{' '}
            <span style={{ fontWeight: 400, color: PALETTE.textMuted }}>R-37M MISSILES</span>
          </div>
        </div>
      </div>

      {/* SFX at frame ~12 when digit starts rolling */}
      <Sequence from={12}>
        <Audio src={staticFile('sfx/impact.mp3')} volume={0.5} />
      </Sequence>

      <Grain />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — R-37M (focal-offset, image bg s01_r37m_underwing.png 16:9, 234f)
// template: focal-offset | Ken Burns + text panel overlay left side
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3 | template: focal-offset | bg: image
const Phase3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = 234;

  // Ken Burns on the 16:9 image — scale 1 → 1.07 via drift
  const imgScale = interpolate(frame, [0, dur], [1.0, 1.07], {
    extrapolateRight: 'clamp',
    easing: EASING.drift,
  });

  // Text panel entrances — editorial bezier
  const labelOp = enterP(frame, 8, 22);
  const labelY = interpolate(labelOp, [0, 1], [14, 0]);
  const ruleScale = enterP(frame, 16, 20);
  const headlineOp = enterP(frame, 22, 28);
  const headlineY = interpolate(headlineOp, [0, 1], [38, 0]);
  const bodyOp = enterP(frame, 36, 22);
  const bodyY = interpolate(bodyOp, [0, 1], [20, 0]);

  // Ambient — text panel breathes independently
  const panelDrift = driftY(frame, { amp: 6, period: 250, phase: 0 });
  const headBreathe = breathe(frame, { period: 160, amp: 0.004, phase: 60 });

  // Exits — reverse hierarchy, finish before dur-18
  const exitStart = dur - 32;
  const bodyExitOp = 1 - exitP(frame, exitStart, 12);
  const headExitOp = 1 - exitP(frame, exitStart + 4, 12);
  const labelExitOp = 1 - exitP(frame, exitStart + 8, 12);

  // Rule spring (structural, ok to use spring here for draw effect)
  const ruleSpring = spring({ frame: Math.max(0, frame - 16), fps, config: { damping: 18, stiffness: 300, mass: 0.8 } });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* Full-bleed 16:9 background image with Ken Burns */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Img
          src={staticFile('images/s01_r37m_underwing.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 50%',
            transform: `scale(${imgScale})`,
            willChange: 'transform',
            filter: 'contrast(1.05) brightness(0.88) saturate(0.94)',
          }}
        />
        {/* Overall dark overlay to ensure text legibility */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.30)' }} />
      </div>

      {/* Left-side text panel with scrim — ambient drift */}
      <div
        style={{
          position: 'absolute',
          left: SAFE_PAD_SIDE,
          top: SAFE_PAD_TOP,
          bottom: SAFE_PAD_BOTTOM,
          width: 580,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          transform: `translateY(${panelDrift}px)`,
        }}
      >
        {/* Scrim behind text content */}
        <div
          style={{
            position: 'absolute',
            inset: '-24px -32px',
            background: 'rgba(0,0,0,0.35)',
            borderRadius: 4,
            backdropFilter: 'blur(2px)',
          }}
        />

        {/* Label */}
        <div
          style={{
            position: 'relative',
            fontFamily: FONTS.body,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: PALETTE.secondary,
            opacity: labelOp * labelExitOp,
            transform: `translateY(${labelY}px)`,
            marginBottom: 14,
          }}
        >
          R-37M
        </div>

        {/* Rule */}
        <div
          style={{
            position: 'relative',
            width: 64,
            height: 3,
            background: PALETTE.secondary,
            transformOrigin: 'left',
            transform: `scaleX(${ruleSpring})`,
            marginBottom: 28,
            opacity: labelExitOp,
          }}
        />

        {/* Headline */}
        <div
          style={{
            position: 'relative',
            fontFamily: FONTS.heading,
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: '-0.01em',
            color: PALETTE.onDark,
            lineHeight: 1.05,
            opacity: headlineOp * headExitOp,
            transform: `translateY(${headlineY}px) scale(${headBreathe})`,
            transformOrigin: 'left',
            marginBottom: 24,
          }}
        >
          One of the longest-reaching ever built
        </div>

        {/* Body */}
        <div
          style={{
            position: 'relative',
            fontFamily: FONTS.body,
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: '0.01em',
            color: PALETTE.onDarkMuted,
            lineHeight: 1.5,
            opacity: bodyOp * bodyExitOp,
            transform: `translateY(${bodyY}px)`,
          }}
        >
          For the Su-30MKI fleet
        </div>
      </div>

      <Grain />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — THE RANGE GAP (split-compare on cream bg, 178f)
// template: split-compare (cream) | full chart craft: axis, gridlines, km labels,
//   animated count-up value labels riding bar ends, source caption
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 4 | template: split-compare | bg: cream
const Phase4: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 178;

  // ── Layout ────────────────────────────────────────────────────────────────
  // Centered chart block — commands the frame
  const CHART_LEFT = 320;           // left edge of bars (wider label column)
  const CHART_RIGHT_PAD = 220;      // right padding from frame edge
  const CHART_WIDTH = 1920 - CHART_LEFT - CHART_RIGHT_PAD; // ~1380px
  const BAR_HEIGHT = 62;
  const ROW_GAP = 80;
  // Vertical centering: chart block vertically centered in safe area
  const CHART_TOP = 360;

  // Bar data — PL-15: ~400km; IAF in-service AAMs at Sindoor: ~150km
  const PL15_KM = 400;
  const IAF_KM = 150;
  const MAX_KM = 440; // axis max
  const KM_PER_PX = CHART_WIDTH / MAX_KM;

  // Bar entrance — interpolated with EASING.outSoft for editorial feel
  const bar1Prog = interpolate(frame, [18, 70], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.outSoft,
  });
  const bar2Prog = interpolate(frame, [32, 88], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.outSoft,
  });

  // Title entrance
  const titleOp = enterP(frame, 0, 24);
  const titleY = interpolate(titleOp, [0, 1], [32, 0]);

  // Gridlines / axis entrance
  const gridOp = enterP(frame, 10, 20);

  // Bracket / gap label entrance — after both bars are mostly drawn
  const bracketOp = enterP(frame, 96, 22);

  // Source caption entrance
  const sourceOp = enterP(frame, 110, 18);

  // Animated km labels riding bar ends (count-up)
  const km1Display = Math.round(PL15_KM * bar1Prog);
  const km2Display = Math.round(IAF_KM * bar2Prog);

  // Bar pixel widths
  const bar1Width = PL15_KM * KM_PER_PX * bar1Prog;
  const bar2Width = IAF_KM * KM_PER_PX * bar2Prog;

  // Gridline positions (100km, 200km, 300km)
  const gridKmValues = [100, 200, 300, 400];

  // Gap bracket geometry
  const gapStart = CHART_LEFT + bar2Width;
  const gapEnd = CHART_LEFT + bar1Width;
  const gapWidth = Math.max(0, gapEnd - gapStart);

  // Ambient idle — chart block breathes on Y, canvas slow push
  const chartDrift = driftY(frame, { amp: 4, period: 240, phase: 20 });
  const canvasScale = ambientScale(frame, { from: 1, to: 1.025, over: dur });

  // Ghost oversized text in background activates void
  const ghostOp = enterP(frame, 12, 30) * 0.04;

  // Exits — source first, bracket, labels, bars, title
  const exitStart = dur - 32;
  const sourceExitOp = 1 - exitP(frame, exitStart, 12);
  const bracketExitOp = 1 - exitP(frame, exitStart + 2, 12);
  const barsExitOp = 1 - exitP(frame, exitStart + 5, 12);
  const titleExitOp = 1 - exitP(frame, exitStart + 9, 12);

  // Axis bottom Y position
  const AXIS_Y = CHART_TOP + BAR_HEIGHT + ROW_GAP + BAR_HEIGHT + 20;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <CreamBg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${canvasScale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Ghost structural text activates right void */}
        <div
          style={{
            position: 'absolute',
            right: 60,
            top: 80,
            fontFamily: FONTS.heading,
            fontSize: 260,
            fontWeight: 900,
            color: RAMP.cream[0],
            lineHeight: 1,
            opacity: ghostOp,
            userSelect: 'none',
            pointerEvents: 'none',
            letterSpacing: '-0.04em',
          }}
        >
          km
        </div>

        {/* Section title */}
        <div
          style={{
            position: 'absolute',
            top: SAFE_PAD_TOP + 28,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: titleOp * titleExitOp,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.heading,
              fontSize: 76,
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: PALETTE.primary,
              textAlign: 'center',
              lineHeight: 1.0,
            }}
          >
            THE RANGE GAP
          </div>
          {/* Subtitle */}
          <div style={{ ...CHART_TYPE.subtitle, marginTop: 10 }}>
            Operation Sindhur · Air-to-Air Missiles
          </div>
        </div>

        {/* Chart block with ambient drift */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: CHART_TOP,
            transform: `translateY(${chartDrift}px)`,
          }}
        >
          {/* ── Gridlines ─────────────────────────────────────────────── */}
          {gridKmValues.map((km) => {
            const x = CHART_LEFT + km * KM_PER_PX;
            return (
              <div key={km} style={{ opacity: gridOp }}>
                {/* Vertical hairline */}
                <div
                  style={{
                    position: 'absolute',
                    left: x,
                    top: -8,
                    width: 1,
                    height: BAR_HEIGHT + ROW_GAP + BAR_HEIGHT + 32,
                    background: 'rgba(18,40,63,0.10)',
                  }}
                />
                {/* km tick label */}
                <div
                  style={{
                    ...CHART_TYPE.tick,
                    position: 'absolute',
                    left: x,
                    top: BAR_HEIGHT + ROW_GAP + BAR_HEIGHT + 28,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {km}km
                </div>
              </div>
            );
          })}

          {/* ── Baseline axis ────────────────────────────────────────── */}
          <div
            style={{
              position: 'absolute',
              left: CHART_LEFT,
              top: BAR_HEIGHT + ROW_GAP + BAR_HEIGHT + 18,
              width: CHART_WIDTH,
              height: 2,
              background: 'rgba(18,40,63,0.20)',
              opacity: gridOp,
            }}
          />
          {/* Axis origin tick */}
          <div
            style={{
              position: 'absolute',
              left: CHART_LEFT - 1,
              top: -8,
              width: 2,
              height: BAR_HEIGHT + ROW_GAP + BAR_HEIGHT + 26,
              background: 'rgba(18,40,63,0.20)',
              opacity: gridOp,
            }}
          />
          {/* Origin label */}
          <div
            style={{
              ...CHART_TYPE.tick,
              position: 'absolute',
              left: CHART_LEFT,
              top: BAR_HEIGHT + ROW_GAP + BAR_HEIGHT + 28,
              transform: 'translateX(-50%)',
              opacity: gridOp,
            }}
          >
            0km
          </div>

          {/* ── Bar 1: PL-15 (red) ───────────────────────────────────── */}
          <div
            style={{
              position: 'absolute',
              left: SAFE_PAD_SIDE,
              top: 0,
              width: CHART_LEFT - SAFE_PAD_SIDE - 20,
              height: BAR_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              ...CHART_TYPE.barLabel,
              color: PALETTE.secondary,
              opacity: barsExitOp * interpolate(bar1Prog, [0, 0.1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            }}
          >
            PL-15
          </div>
          {/* Bar fill */}
          <div
            style={{
              position: 'absolute',
              left: CHART_LEFT,
              top: 0,
              width: bar1Width,
              height: BAR_HEIGHT,
              background: `linear-gradient(90deg, ${PALETTE.secondary} 0%, ${PALETTE.secondary}CC 100%)`,
              borderRadius: '0 4px 4px 0',
              opacity: barsExitOp,
            }}
          />
          {/* Animated km label riding bar end */}
          {bar1Width > 20 && (
            <div
              style={{
                position: 'absolute',
                ...CHART_TYPE.value,
                left: CHART_LEFT + bar1Width + 10,
                top: BAR_HEIGHT / 2,
                transform: 'translateY(-50%)',
                color: PALETTE.secondary,
                opacity: barsExitOp * interpolate(bar1Prog, [0.05, 0.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              }}
            >
              {km1Display} km
            </div>
          )}

          {/* ── Bar 2: IAF in-service (navy) ─────────────────────────── */}
          <div
            style={{
              position: 'absolute',
              left: SAFE_PAD_SIDE,
              top: BAR_HEIGHT + ROW_GAP,
              width: CHART_LEFT - SAFE_PAD_SIDE - 20,
              height: BAR_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              ...CHART_TYPE.barLabel,
              color: PALETTE.primary,
              opacity: barsExitOp * interpolate(bar2Prog, [0, 0.1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            }}
          >
            IAF In-Service
          </div>
          <div
            style={{
              position: 'absolute',
              left: CHART_LEFT,
              top: BAR_HEIGHT + ROW_GAP,
              width: bar2Width,
              height: BAR_HEIGHT,
              background: `linear-gradient(90deg, ${PALETTE.primary} 0%, ${PALETTE.primary}CC 100%)`,
              borderRadius: '0 4px 4px 0',
              opacity: barsExitOp,
            }}
          />
          {/* Animated km label riding bar end */}
          {bar2Width > 20 && (
            <div
              style={{
                position: 'absolute',
                ...CHART_TYPE.value,
                left: CHART_LEFT + bar2Width + 10,
                top: BAR_HEIGHT + ROW_GAP + BAR_HEIGHT / 2,
                transform: 'translateY(-50%)',
                color: PALETTE.primary,
                opacity: barsExitOp * interpolate(bar2Prog, [0.05, 0.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              }}
            >
              {km2Display} km
            </div>
          )}

          {/* ── Gap bracket ──────────────────────────────────────────── */}
          {gapWidth > 20 && (
            <div style={{ position: 'absolute', opacity: bracketOp * bracketExitOp }}>
              {/* Left vertical tick at bar2 end */}
              <div
                style={{
                  position: 'absolute',
                  left: gapStart,
                  top: -16,
                  width: 2,
                  height: BAR_HEIGHT + ROW_GAP + BAR_HEIGHT + 32,
                  background: PALETTE.accent,
                }}
              />
              {/* Right vertical tick at bar1 end */}
              <div
                style={{
                  position: 'absolute',
                  left: gapEnd - 2,
                  top: -16,
                  width: 2,
                  height: BAR_HEIGHT + ROW_GAP + BAR_HEIGHT + 32,
                  background: PALETTE.accent,
                }}
              />
              {/* Horizontal connector at top */}
              <div
                style={{
                  position: 'absolute',
                  left: gapStart,
                  top: -16,
                  width: gapWidth,
                  height: 2,
                  background: PALETTE.accent,
                }}
              />
              {/* Gap label */}
              <div
                style={{
                  position: 'absolute',
                  ...CHART_TYPE.bracket,
                  left: gapStart + gapWidth / 2,
                  top: -58,
                  transform: 'translateX(-50%)',
                  color: PALETTE.accent,
                  background: RAMP.cream[2],
                  padding: '4px 14px',
                  border: `1px solid ${PALETTE.accent}44`,
                  borderRadius: 2,
                }}
              >
                +{Math.round((PL15_KM - IAF_KM) * bar1Prog)} km GAP
              </div>
            </div>
          )}
        </div>

        {/* Source caption — above subtitle zone */}
        <div
          style={{
            position: 'absolute',
            ...CHART_TYPE.source,
            left: CHART_LEFT,
            bottom: SAFE_PAD_BOTTOM + 16,
            opacity: sourceOp * sourceExitOp,
          }}
        >
          Source: Open-source estimates · Sindhur operational reports, 2026
        </div>
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — J-10C / PL-15 SPLIT COMPARE (split-compare, image both sides, 231f)
// template: split-compare | both panels slide from opposite edges
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 5 | template: split-compare | bg: image
const Phase5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = 231;

  // Panel slides — editorial inOut easing
  const leftSlideP = interpolate(frame, [0, 32], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.outSoft,
  });
  const rightSlideP = interpolate(frame, [8, 40], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.outSoft,
  });

  // Ken Burns both images
  const imgScale = interpolate(frame, [0, dur], [1.0, 1.08], {
    extrapolateRight: 'clamp',
    easing: EASING.drift,
  });

  // Labels fade in after panels settle
  const labelOp = enterP(frame, 42, 22);
  const labelY = interpolate(labelOp, [0, 1], [24, 0]);

  // Divider appearance
  const dividerSettle = Math.max(leftSlideP, rightSlideP);
  const dividerOp = interpolate(dividerSettle, [0.6, 1.0], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Ambient — panels breathe independently
  const leftDrift = driftY(frame, { amp: 5, period: 300, phase: 0 });
  const rightDrift = driftY(frame, { amp: 5, period: 300, phase: 80 });

  // Exits
  const exitStart = dur - 30;
  const labelExitOp = 1 - exitP(frame, exitStart, 12);
  const panelExitOp = 1 - exitP(frame, exitStart + 6, 12);

  const leftX = interpolate(leftSlideP, [0, 1], [-960, 0]);
  const rightX = interpolate(rightSlideP, [0, 1], [960, 0]);

  return (
    <AbsoluteFill style={{ background: RAMP.navy[0], overflow: 'hidden', opacity: panelExitOp }}>
      {/* Left panel — J-10C */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '50%',
          height: '100%',
          overflow: 'hidden',
          transform: `translateX(${leftX}px)`,
          willChange: 'transform',
        }}
      >
        <div style={{ width: '100%', height: '100%', transform: `translateY(${leftDrift}px)` }}>
          <Img
            src={staticFile('images/s02_j10c.png')}
            style={{
              width: '100%',
              height: '105%',
              objectFit: 'cover',
              objectPosition: '60% 50%',
              transform: `scale(${imgScale})`,
              willChange: 'transform',
              filter: 'contrast(1.08) brightness(0.85) saturate(0.9)',
            }}
          />
        </div>
        {/* Scrim — right side gradient to divider */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(270deg, rgba(11,22,34,0.72) 0%, transparent 35%)',
          }}
        />
        {/* Bottom scrim for label */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(0deg, rgba(11,22,34,0.88) 0%, transparent 40%)',
          }}
        />
        {/* Label */}
        <div
          style={{
            position: 'absolute',
            bottom: SAFE_PAD_BOTTOM + 16,
            left: SAFE_PAD_SIDE,
            opacity: labelOp * labelExitOp,
            transform: `translateY(${labelY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: PALETTE.electric,
              marginBottom: 8,
            }}
          >
            ATTACKER
          </div>
          <div
            style={{
              fontFamily: FONTS.heading,
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: PALETTE.onDark,
              lineHeight: 1.0,
            }}
          >
            J-10C
          </div>
        </div>
      </div>

      {/* Right panel — PL-15 */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '50%',
          height: '100%',
          overflow: 'hidden',
          transform: `translateX(${rightX}px)`,
          willChange: 'transform',
        }}
      >
        <div style={{ width: '100%', height: '100%', transform: `translateY(${rightDrift}px)` }}>
          <Img
            src={staticFile('images/s02_pl15.png')}
            style={{
              width: '100%',
              height: '105%',
              objectFit: 'cover',
              objectPosition: '40% 50%',
              transform: `scale(${imgScale})`,
              willChange: 'transform',
              filter: 'contrast(1.06) brightness(0.85) saturate(0.9)',
            }}
          />
        </div>
        {/* Scrim — left side gradient to divider */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, rgba(11,22,34,0.72) 0%, transparent 35%)',
          }}
        />
        {/* Bottom scrim for label */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(0deg, rgba(11,22,34,0.88) 0%, transparent 40%)',
          }}
        />
        {/* Label */}
        <div
          style={{
            position: 'absolute',
            bottom: SAFE_PAD_BOTTOM + 16,
            left: 40,
            opacity: labelOp * labelExitOp,
            transform: `translateY(${labelY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: PALETTE.secondary,
              marginBottom: 8,
            }}
          >
            THE WEAPON
          </div>
          <div
            style={{
              fontFamily: FONTS.heading,
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: PALETTE.onDark,
              lineHeight: 1.0,
            }}
          >
            PL-15
          </div>
        </div>
      </div>

      {/* Centre divider line */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          width: 2,
          height: '100%',
          background: 'rgba(255,255,255,0.22)',
          transform: 'translateX(-50%)',
          opacity: dividerOp,
        }}
      />

      <Grain />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6 — SIMPLE (stacked-reveal, cream, 172f)
// template: stacked-reveal | "Range gap? / Buy range. / Simple."
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 6 | template: stacked-reveal | bg: cream
const Phase6: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 172;

  // Line 1: "Range gap?" — editorial ease
  const line1Op = enterP(frame, 4, 26);
  const line1Y = interpolate(line1Op, [0, 1], [42, 0]);
  // Line 2: "Buy range." — staggered
  const line2Op = enterP(frame, 26, 26);
  const line2Y = interpolate(line2Op, [0, 1], [42, 0]);
  // Line 3: "Simple." — lands alone ~82f into phase (voiceover: 36940ms = ~82f in this phase)
  const line3Op = enterP(frame, 80, 28);
  const line3Y = interpolate(line3Op, [0, 1], [58, 0]);
  const dividerW = interpolate(line3Op, [0, 1], [0, 160]);

  // Ambient — lines breathe at different phases
  const line1Breathe = breathe(frame, { period: 150, amp: 0.004, phase: 0 });
  const line2Breathe = breathe(frame, { period: 160, amp: 0.004, phase: 55 });
  const line3Breathe = breathe(frame, { period: 130, amp: 0.005, phase: 110 });
  const canvasScale = ambientScale(frame, { from: 1, to: 1.028, over: dur });

  // Exits
  const exitStart = dur - 30;
  const line1ExitOp = 1 - exitP(frame, exitStart, 12);
  const line2ExitOp = 1 - exitP(frame, exitStart + 4, 12);
  const line3ExitOp = 1 - exitP(frame, exitStart + 8, 12);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <CreamBg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${canvasScale})`,
          transformOrigin: 'center center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${SAFE_PAD_TOP}px ${SAFE_PAD_SIDE}px ${SAFE_PAD_BOTTOM}px ${SAFE_PAD_SIDE}px`,
            boxSizing: 'border-box',
            gap: 16,
          }}
        >
          {/* Line 1 */}
          <div
            style={{
              fontFamily: FONTS.heading,
              fontSize: 92,
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: PALETTE.textMuted,
              textAlign: 'center',
              lineHeight: 1.02,
              opacity: line1Op * line1ExitOp,
              transform: `translateY(${line1Y}px) scale(${line1Breathe})`,
              transformOrigin: 'center',
            }}
          >
            Range gap?
          </div>

          {/* Line 2 */}
          <div
            style={{
              fontFamily: FONTS.heading,
              fontSize: 92,
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: PALETTE.primary,
              textAlign: 'center',
              lineHeight: 1.02,
              opacity: line2Op * line2ExitOp,
              transform: `translateY(${line2Y}px) scale(${line2Breathe})`,
              transformOrigin: 'center',
            }}
          >
            Buy range.
          </div>

          {/* Divider rule that draws in before "Simple." */}
          <div
            style={{
              width: dividerW,
              height: 3,
              background: PALETTE.secondary,
              margin: '12px 0',
              opacity: line3Op * line3ExitOp,
            }}
          />

          {/* Line 3 — "Simple." lands with emphasis — BIGGEST type moment */}
          <div
            style={{
              fontFamily: FONTS.heading,
              fontSize: 124,
              fontWeight: 900,
              letterSpacing: '-0.03em',
              color: PALETTE.secondary,
              textAlign: 'center',
              lineHeight: 1.0,
              opacity: line3Op * line3ExitOp,
              transform: `translateY(${line3Y}px) scale(${line3Breathe})`,
              transformOrigin: 'center',
            }}
          >
            Simple.
          </div>
        </div>
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 7 — EXCEPT… (focal-offset, s03_su35.png 2048x2048, 156f)
// template: focal-offset | cream dims toward dark via overlay
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 7 | template: focal-offset | bg: image
const Phase7: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = 156;

  // Dark overlay fades in as phase progresses (0 → 0.42)
  const darkOverlay = interpolate(frame, [0, dur], [0, 0.42], { extrapolateRight: 'clamp' });

  // Image reveal (clip from left)
  const imgReveal = spring({ frame: Math.max(0, frame - 4), fps, config: { damping: 22, stiffness: 90, mass: 1.2 } });
  const imgScale = interpolate(frame, [0, dur], [1.0, 1.07], {
    extrapolateRight: 'clamp',
    easing: EASING.drift,
  });

  // "Except…" text enters — editorial
  const textOp = enterP(frame, 28, 28);
  const textY = interpolate(textOp, [0, 1], [52, 0]);

  // Ambient — text breathes
  const textBreathe = breathe(frame, { period: 180, amp: 0.005, phase: 0 });

  // Exit
  const exitStart = dur - 28;
  const textExitOp = 1 - exitP(frame, exitStart, 12);
  const overallExitOp = 1 - exitP(frame, exitStart + 6, 12);

  // Text color opacity transitions from primary → onDark as dark overlay increases
  const textColorOpacity = interpolate(darkOverlay, [0, 0.25, 0.42], [0, 0.5, 1.0]);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: overallExitOp }}>
      {/* Cream base with tonal ramp */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 90% 80% at 50% 46%, ${RAMP.cream[3]} 0%, ${RAMP.cream[2]} 42%, ${RAMP.cream[0]} 100%)`,
        }}
      />

      {/* Right side focal panel — square image in ~55% right side */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '55%',
          height: '100%',
          overflow: 'hidden',
          clipPath: `inset(0 0 0 ${interpolate(imgReveal, [0, 1], [100, 0])}%)`,
        }}
      >
        <Img
          src={staticFile('images/s03_su35.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 40%',
            transform: `scale(${imgScale})`,
            willChange: 'transform',
            filter: 'contrast(1.06) brightness(0.88) saturate(0.92)',
          }}
        />
        {/* Left-side feather to blend into cream */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg, ${RAMP.cream[2]} 0%, transparent 28%)`,
          }}
        />
      </div>

      {/* Progressive dark overlay over entire frame */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: RAMP.navy[1],
          opacity: darkOverlay,
          pointerEvents: 'none',
        }}
      />

      {/* Left text area */}
      <div
        style={{
          position: 'absolute',
          left: SAFE_PAD_SIDE,
          top: 0,
          bottom: 0,
          width: 680,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {/* "Except…" headline */}
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 112,
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.0,
            opacity: textOp * textExitOp,
            transform: `translateY(${textY}px) scale(${textBreathe})`,
            transformOrigin: 'left',
          }}
        >
          {/* Color blend: starts primary, transitions toward onDark */}
          <span style={{ color: PALETTE.primary }}>Except</span>
          <span
            style={{
              color: PALETTE.onDark,
              opacity: textColorOpacity,
              position: 'absolute',
              left: 0,
            }}
          >
            Except
          </span>
          <span style={{ color: PALETTE.secondary }}>…</span>
        </div>
      </div>

      <Grain />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 8 — IT FAILS. IN PRINT. (centered-hero, s03_journal.png 2048x2048, 209f)
// template: centered-hero | spotlight vignette, slow zoom-in
// ═══════════════════════════════════════════════════════════════════════════════
// Phase 8 | template: centered-hero | bg: image
const Phase8: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 232; // last sequence is 232f per TransitionSeries

  // Slow zoom in on the journal image
  const imgScale = interpolate(frame, [0, dur], [1.0, 1.12], {
    extrapolateRight: 'clamp',
    easing: EASING.drift,
  });

  // Spotlight vignette intensifies
  const vignetteOpacity = interpolate(frame, [0, 60], [0, 1.0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Text entrances — editorial
  const line1Op = enterP(frame, 18, 26);
  const line1Y = interpolate(line1Op, [0, 1], [38, 0]);
  const line2Op = enterP(frame, 50, 28);
  const line2Y = interpolate(line2Op, [0, 1], [44, 0]);
  const dividerW = interpolate(line2Op, [0, 1], [0, 120]);

  // Ambient — text breathes
  const line1Breathe = breathe(frame, { period: 160, amp: 0.004, phase: 0 });
  const line2Breathe = breathe(frame, { period: 150, amp: 0.005, phase: 70 });

  // "In print." is the PAYOFF — must be AT LEAST as large as "It fails."
  // Both at 88px, payoff gets accent red emphasis

  return (
    <AbsoluteFill style={{ background: RAMP.navy[1], overflow: 'hidden' }}>
      {/* Centered journal image panel */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '52%',
          aspectRatio: '1 / 1',
          overflow: 'hidden',
          borderRadius: 4,
          boxShadow: `0 0 80px ${RAMP.shadowOnDark}, 0 0 200px ${RAMP.shadowOnDark}`,
        }}
      >
        <Img
          src={staticFile('images/s03_journal.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 50%',
            transform: `scale(${imgScale})`,
            willChange: 'transform',
            filter: 'contrast(1.10) brightness(0.92) saturate(0.88)',
          }}
        />
      </div>

      {/* Radial vignette spotlight — focuses attention on centre */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 56% at 50% 50%, transparent 30%, rgba(6,12,20,0.70) 65%, rgba(6,12,20,0.94) 100%)',
          opacity: vignetteOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Dark overlay for cinematic depth */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(${parseInt(RAMP.navy[1].slice(1, 3), 16)},${parseInt(RAMP.navy[1].slice(3, 5), 16)},${parseInt(RAMP.navy[1].slice(5, 7), 16)},0.38)`,
          pointerEvents: 'none',
        }}
      />

      {/* Text block — above centre, safe zone compliant */}
      <div
        style={{
          position: 'absolute',
          bottom: SAFE_PAD_BOTTOM + 40,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* "It fails." */}
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 88,
            fontWeight: 800,
            letterSpacing: '-0.025em',
            color: PALETTE.onDark,
            textAlign: 'center',
            opacity: line1Op,
            transform: `translateY(${line1Y}px) scale(${line1Breathe})`,
            transformOrigin: 'center',
          }}
        >
          It fails.
        </div>

        {/* Divider */}
        <div
          style={{
            width: dividerW,
            height: 2,
            background: PALETTE.secondary,
            opacity: line2Op,
          }}
        />

        {/* "In print." — payoff: same size, accent color for emphasis */}
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 88,
            fontWeight: 900,
            letterSpacing: '-0.025em',
            color: PALETTE.secondary,
            textAlign: 'center',
            opacity: line2Op,
            transform: `translateY(${line2Y}px) scale(${line2Breathe})`,
            transformOrigin: 'center',
          }}
        >
          In print.
        </div>
      </div>

      <Grain />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITION DEFINITIONS
// Phase 1 (cream) → Phase 2 (cream): fade
// Phase 2 (cream) → Phase 3 (image): wipe
// Phase 3 (image) → Phase 4 (cream): wipe
// Phase 4 (cream) → Phase 5 (image): wipe
// Phase 5 (image) → Phase 6 (cream): wipe
// Phase 6 (cream) → Phase 7 (image): wipe
// Phase 7 (image) → Phase 8 (image): fade
// ═══════════════════════════════════════════════════════════════════════════════

export default function Scene_02() {
  return (
    <TransitionSeries>
      {/* Phase 1: cream, 241f */}
      <TransitionSeries.Sequence durationInFrames={241}>
        <Phase1 />
      </TransitionSeries.Sequence>

      {/* cream → cream: fade */}
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 2: cream, 215f */}
      <TransitionSeries.Sequence durationInFrames={215}>
        <Phase2 />
      </TransitionSeries.Sequence>

      {/* cream → image: wipe */}
      <TransitionSeries.Transition
        presentation={wipe({ direction: 'from-left' })}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 3: image (16:9 underwing), 234f */}
      <TransitionSeries.Sequence durationInFrames={234}>
        <Phase3 />
      </TransitionSeries.Sequence>

      {/* image → cream: wipe */}
      <TransitionSeries.Transition
        presentation={wipe({ direction: 'from-right' })}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 4: cream, 178f */}
      <TransitionSeries.Sequence durationInFrames={178}>
        <Phase4 />
      </TransitionSeries.Sequence>

      {/* cream → image: wipe */}
      <TransitionSeries.Transition
        presentation={wipe({ direction: 'from-left' })}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 5: image (split), 231f */}
      <TransitionSeries.Sequence durationInFrames={231}>
        <Phase5 />
      </TransitionSeries.Sequence>

      {/* image → cream: wipe */}
      <TransitionSeries.Transition
        presentation={wipe({ direction: 'from-right' })}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 6: cream, 172f */}
      <TransitionSeries.Sequence durationInFrames={172}>
        <Phase6 />
      </TransitionSeries.Sequence>

      {/* cream → image: wipe */}
      <TransitionSeries.Transition
        presentation={wipe({ direction: 'from-left' })}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 7: image (su35), 156f */}
      <TransitionSeries.Sequence durationInFrames={156}>
        <Phase7 />
      </TransitionSeries.Sequence>

      {/* image → image: fade */}
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />

      {/* Phase 8: image (journal), 232f */}
      <TransitionSeries.Sequence durationInFrames={232}>
        <Phase8 />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
}
