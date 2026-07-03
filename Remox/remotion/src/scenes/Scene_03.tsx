// Scene_03 | templates: focal-offset(2), lower-third(1), centered-hero(1), stacked-reveal(1)
// "A Long-Range Missile Won't Fix India's PL-15 Problem" — Swarajya Defence Video
// Scene 03: THE CONFESSION IN MOSCOW
// Total: 1130 frames | 5 phases | All dark | 30fps

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

// ── Film grain ────────────────────────────────────────────────────────────────
const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      opacity,
      pointerEvents: 'none',
      mixBlendMode: 'overlay',
      backgroundImage: FILM_GRAIN_SVG,
      backgroundSize: '170px 170px',
      zIndex: 100,
    }}
  />
);

// ── Navy ramp background — replaces all flat #0B1622 fills ────────────────────
const NavyRampBg: React.FC<{ scaleVal?: number }> = ({ scaleVal = 1 }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: RAMP.navy[1],
      transform: `scale(${scaleVal})`,
      willChange: 'transform',
    }}
  >
    {/* Subtle centre lift — 2-3% luminance difference */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse 70% 65% at 50% 45%, ${RAMP.navy[2]} 0%, ${RAMP.navy[0]} 100%)`,
      }}
    />
    <Grain opacity={0.04} />
  </div>
);

// ── Shared spring helper ──────────────────────────────────────────────────────
function useSpring(frame: number, fps: number, delay: number, config: any) {
  return spring({ frame: Math.max(0, frame - delay), fps, config });
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — FOCAL OFFSET: Colonel Stepkin portrait
// dur=269f | focal-offset | duotone photo | word-by-word masked name reveal (NO caret)
// ══════════════════════════════════════════════════════════════════════════════
// Phase 1 | template: focal-offset | bg: image
const Phase1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const DUR = 269;

  // Image panel clip reveal from bottom
  const revealP = useSpring(frame, fps, 4, { damping: 22, stiffness: 90 });
  const clipPct = interpolate(revealP, [0, 1], [100, 0]);

  // Ken Burns: ambient slow push
  const scale = interpolate(frame, [0, DUR], [1.0, 1.08], { extrapolateRight: 'clamp' });

  // ── EXIT: elements leave 18–32f before end (transition window = last 18f) ──
  const EXIT_START = DUR - 32;
  const locationOpacity = holdOpacity(frame, { enterStart: 12, enterDur: 18, exitStart: EXIT_START, exitDur: 14 });
  const nameOpacity = holdOpacity(frame, { enterStart: 20, enterDur: 20, exitStart: EXIT_START + 4, exitDur: 14 });
  const journalOpacity = holdOpacity(frame, { enterStart: 145, enterDur: 18, exitStart: EXIT_START + 2, exitDur: 12 });
  const ruleOpacity = holdOpacity(frame, { enterStart: 18, enterDur: 12, exitStart: EXIT_START, exitDur: 12 });

  // Location entrance Y
  const locationP = useSpring(frame, fps, 12, MOTION.springSnappy);
  const locationY = interpolate(locationP, [0, 1], [18, 0]);

  // Rule width
  const ruleP = useSpring(frame, fps, 18, { damping: 18, stiffness: 300 });

  // ── WORD-BY-WORD name reveal — NO caret, no typewriter ───────────────────
  // Each word reveals by un-masking (clipPath on the word span), staggered 8f apart
  const NAME_WORDS = ['COL.', 'A.', 'YU.', 'STEPKIN'];
  const WORD_START = 22;
  const WORD_STAGGER = 8;

  // Journal entrance
  const journalP = useSpring(frame, fps, 145, MOTION.springSnappy);
  const journalY = interpolate(journalP, [0, 1], [20, 0]);

  // Ambient breathe on name during hold (after full reveal)
  const nameBreathe = breathe(frame, { period: 140, amp: 0.003, phase: 0 });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <NavyRampBg />

      {/* LEFT PANEL — image (45% width) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: '45%',
          overflow: 'hidden',
          clipPath: `inset(0 0 ${clipPct}% 0)`,
        }}
      >
        <Img
          src={staticFile('images/s03_officer.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 22%',
            transform: `scale(${scale})`,
            willChange: 'transform',
            filter: 'grayscale(0.45) contrast(1.22) brightness(0.88) saturate(0.75)',
          }}
        />
        {/* Duotone navy overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: RAMP.navy[1],
            opacity: 0.4,
            mixBlendMode: 'multiply',
          }}
        />
        {/* Edge feather toward right text panel */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(270deg, ${RAMP.navy[1]} 0%, transparent 18%)`,
          }}
        />
        {/* Bottom fade */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(0deg, ${RAMP.navy[0]} 0%, transparent 30%)`,
          }}
        />
        <Grain opacity={0.04} />
      </div>

      {/* RIGHT PANEL — text content */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '45%',
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 80px 0 72px',
          boxSizing: 'border-box',
        }}
      >
        {/* MOSCOW label */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: PALETTE.secondary,
            opacity: locationOpacity,
            transform: `translateY(${locationY}px)`,
            marginBottom: 10,
          }}
        >
          MOSCOW
        </div>

        {/* Red accent rule — scaleX reveal */}
        <div
          style={{
            width: 60,
            height: 3,
            background: PALETTE.secondary,
            transformOrigin: 'left',
            transform: `scaleX(${ruleP})`,
            opacity: ruleOpacity,
            marginBottom: 28,
          }}
        />

        {/* Name — word-by-word clip reveal, NO caret */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0 16px',
            fontFamily: FONTS.heading,
            fontSize: 56,
            fontWeight: 800,
            color: PALETTE.onDark,
            letterSpacing: '-0.01em',
            lineHeight: 1.05,
            marginBottom: 32,
            minHeight: '1.1em',
            opacity: nameOpacity,
            transform: `scale(${nameBreathe})`,
            transformOrigin: 'left center',
          }}
        >
          {NAME_WORDS.map((word, i) => {
            const wordReveal = enterP(frame, WORD_START + i * WORD_STAGGER, 10);
            return (
              <span
                key={word}
                style={{
                  display: 'inline-block',
                  overflow: 'hidden',
                  // clip reveals word sliding up from bottom
                  clipPath: `inset(0 0 ${interpolate(wordReveal, [0, 1], [100, 0])}% 0)`,
                  transform: `translateY(${interpolate(wordReveal, [0, 1], [12, 0])}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Journal line — appears at ~145f */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 28,
            fontWeight: 400,
            color: PALETTE.onDarkMuted,
            letterSpacing: '0.04em',
            fontStyle: 'italic',
            opacity: journalOpacity,
            transform: `translateY(${journalY}px)`,
          }}
        >
          Voyennaya Mysl — Military Thought
        </div>
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — LOWER THIRD: Journal page / doctrine text
// dur=157f | lower-third | ken-burns image
// ══════════════════════════════════════════════════════════════════════════════
// Phase 2 | template: lower-third | bg: image
const Phase2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const DUR = 157;

  // Image reveal clip from bottom
  const revealP = useSpring(frame, fps, 4, { damping: 22, stiffness: 90 });
  const clipPct = interpolate(revealP, [0, 1], [100, 0]);

  // Ken Burns ambient push
  const scale = interpolate(frame, [0, DUR], [1.02, 1.09], { extrapolateRight: 'clamp' });

  // EXIT: text leaves before transition (last 18f = transition window)
  const EXIT_START = DUR - 30;

  const textOpacity = holdOpacity(frame, { enterStart: 18, enterDur: 18, exitStart: EXIT_START, exitDur: 12 });
  const barOpacity = holdOpacity(frame, { enterStart: 14, enterDur: 12, exitStart: EXIT_START, exitDur: 12 });

  const textP = useSpring(frame, fps, 18, MOTION.springSnappy);
  const textY = interpolate(textP, [0, 1], [24, 0]);

  const barP = useSpring(frame, fps, 14, { damping: 18, stiffness: 260 });

  // Ambient drift on lower-third block during hold
  const ambientY = driftY(frame, { amp: 4, period: 200, phase: 30 });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <NavyRampBg />

      {/* Full-bleed image */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `inset(0 0 ${clipPct}% 0)`,
          overflow: 'hidden',
        }}
      >
        <Img
          src={staticFile('images/s03_journal.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 38%',
            transform: `scale(${scale})`,
            willChange: 'transform',
            filter: 'grayscale(0.3) contrast(1.12) brightness(0.78) saturate(0.8)',
          }}
        />
        {/* Dark vignette base */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: RAMP.navy[1],
            mixBlendMode: 'multiply',
            opacity: 0.32,
          }}
        />
        {/* Radial vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 80% 75% at 50% 46%, transparent 30%, rgba(0,0,0,0.55) 100%)',
          }}
        />
        {/* Lower-third gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(0deg, ${RAMP.navy[0]} 0%, rgba(11,22,34,0.75) 25%, transparent 55%)`,
          }}
        />
      </div>

      {/* Lower-third content */}
      <div
        style={{
          position: 'absolute',
          bottom: 240,
          left: 120,
          right: '40%',
          opacity: textOpacity,
          transform: `translateY(${textY + ambientY}px)`,
        }}
      >
        {/* Thin accent bar */}
        <div
          style={{
            width: `${interpolate(barP, [0, 1], [0, 52])}px`,
            height: 3,
            background: PALETTE.secondary,
            marginBottom: 18,
            opacity: barOpacity,
          }}
        />
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: PALETTE.secondary,
            marginBottom: 14,
          }}
        >
          DOCTRINE
        </div>
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 48,
            fontWeight: 700,
            color: PALETTE.onDark,
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
          }}
        >
          How they are meant to fight.
        </div>
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — FOCAL OFFSET: "A CONFESSION" / Su-35 / Ukraine stats
// dur=289f | focal-offset | starts solid-dark → image fades in at ~130f
// ══════════════════════════════════════════════════════════════════════════════
// Phase 3 | template: focal-offset | bg: image
const Phase3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const DUR = 289;

  // EXIT timing — leave 32f before end
  const EXIT_START = DUR - 32;

  // "A CONFESSION." slam entrance
  const confessionP = useSpring(frame, fps, 0, { damping: 14, stiffness: 280, mass: 0.8 });
  const confessionScaleP = useSpring(frame, fps, 0, { damping: 11, stiffness: 200 });
  const confessionScale = interpolate(confessionScaleP, [0, 1], [1.18, 1.0]);
  const confessionY = interpolate(confessionP, [0, 1], [48, 0]);
  const confessionOpacity = holdOpacity(frame, { enterStart: 0, enterDur: 12, exitStart: EXIT_START + 4, exitDur: 14 });

  // Image fades in at ~130f
  const imageOpacity = interpolate(frame, [130, 160], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ken Burns from when image is visible
  const scale = interpolate(frame, [130, DUR], [1.0, 1.08], { extrapolateRight: 'clamp' });

  // "FOUR YEARS OVER UKRAINE" — appears ~60f
  const subtitleP = useSpring(frame, fps, 60, MOTION.springSnappy);
  const subtitleY = interpolate(subtitleP, [0, 1], [20, 0]);
  const subtitleOpacity = holdOpacity(frame, { enterStart: 60, enterDur: 18, exitStart: EXIT_START + 2, exitDur: 12 });

  // Stats line — appears ~120f
  const statsP = useSpring(frame, fps, 120, MOTION.springSnappy);
  const statsY = interpolate(statsP, [0, 1], [18, 0]);
  const statsOpacity = holdOpacity(frame, { enterStart: 120, enterDur: 18, exitStart: EXIT_START, exitDur: 12 });

  // Rule entrance
  const ruleP = useSpring(frame, fps, 14, { damping: 18, stiffness: 300 });
  const ruleOpacity = holdOpacity(frame, { enterStart: 14, enterDur: 12, exitStart: EXIT_START + 4, exitDur: 12 });

  // Ambient breathe on "A CONFESSION" during hold
  const confessionBreathe = breathe(frame, { period: 160, amp: 0.004, phase: 20 });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <NavyRampBg />

      {/* Faint radial red glow before image appears */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 60% 55% at 50% 42%, rgba(196,55,59,0.07) 0%, transparent 62%)',
          opacity: interpolate(imageOpacity, [0, 1], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      />

      {/* Background image — fades in ~130f, right panel */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: '58%',
          overflow: 'hidden',
          opacity: imageOpacity,
        }}
      >
        <Img
          src={staticFile('images/s03_su35.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 50%',
            transform: `scale(${scale})`,
            willChange: 'transform',
            filter: 'grayscale(0.25) contrast(1.15) brightness(0.78) saturate(0.85)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: RAMP.navy[1],
            opacity: 0.4,
            mixBlendMode: 'multiply',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg, ${RAMP.navy[1]} 0%, transparent 25%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(0deg, ${RAMP.navy[0]} 0%, transparent 35%)`,
          }}
        />
      </div>

      {/* TEXT CONTENT — left panel */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: '58%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 80px 0 120px',
          boxSizing: 'border-box',
        }}
      >
        {/* "A CONFESSION." — scale-slam in red */}
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 88,
            fontWeight: 900,
            color: PALETTE.secondary,
            letterSpacing: '-0.02em',
            lineHeight: 0.95,
            opacity: confessionOpacity,
            transform: `translateY(${confessionY}px) scale(${confessionScale * confessionBreathe})`,
            transformOrigin: 'left center',
            marginBottom: 20,
          }}
        >
          A CONFESSION.
        </div>

        {/* Red rule — scaleX reveal */}
        <div
          style={{
            width: `${interpolate(ruleP, [0, 1], [0, 72])}px`,
            height: 3,
            background: PALETTE.secondary,
            opacity: ruleOpacity,
            marginBottom: 32,
          }}
        />

        {/* "FOUR YEARS OVER UKRAINE" */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: PALETTE.onDarkMuted,
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
            marginBottom: 36,
          }}
        >
          FOUR YEARS OVER UKRAINE
        </div>

        {/* Stats line */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 36,
            fontWeight: 600,
            color: PALETTE.onDark,
            lineHeight: 1.2,
            opacity: statsOpacity,
            transform: `translateY(${statsY}px)`,
            maxWidth: 580,
          }}
        >
          Outranges everything{' '}
          <span style={{ color: PALETTE.electric }}>Ukraine flies.</span>
        </div>
      </div>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — CENTERED HERO: Tally marks + "THE RESULT?"
// dur=225f | centered-hero | solid-dark | SVG tally with stroke-draw animation
// ══════════════════════════════════════════════════════════════════════════════

// Phase 4 | template: centered-hero | bg: dark
const Phase4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const DUR = 225;

  // EXIT timing — 32f before end
  const EXIT_START = DUR - 32;

  // "THE RESULT?" — scale-slam at ~40f, exits before transition
  const resultP = useSpring(frame, fps, 40, { damping: 14, stiffness: 240, mass: 0.9 });
  const resultScaleP = useSpring(frame, fps, 40, { damping: 11, stiffness: 190 });
  const resultScale = interpolate(resultScaleP, [0, 1], [1.15, 1.0]);
  const resultY = interpolate(resultP, [0, 1], [44, 0]);
  const resultOpacity = holdOpacity(frame, { enterStart: 40, enterDur: 16, exitStart: EXIT_START, exitDur: 14 });

  // Label — "CONFIRMED KILLS — BVAAM ENGAGEMENTS" — exits cleanly before transition
  // It appears at ~80f and FULLY exits before EXIT_START so no collision with Phase 5
  const labelOpacity = holdOpacity(frame, { enterStart: 80, enterDur: 18, exitStart: EXIT_START + 4, exitDur: 12 });

  // Ambient scale drift on the whole canvas
  const canvasScale = 1 + interpolate(frame, [0, DUR], [0, 0.025], {
    extrapolateRight: 'clamp',
    easing: EASING.drift,
  });

  // Tally: 18 marks total, each drawn via stroke-dash animation
  // Each mark: strokeDasharray = mark-length, strokeDashoffset animates 0 over 3f
  // Marks stagger 3f apart starting at frame 4
  // After ~181f freeze marks but keep breathe going
  const TALLY_DRAW_START = 4;
  const TALLY_STAGGER = 3;
  const TALLY_DRAW_DUR = 3;
  const totalMarks = 18;

  // Vertical mark length = 44, diagonal length ≈ 62 (hypotenuse of ~54×32)
  const V_LEN = 44;
  const D_LEN = 65;

  // Tally breathe — whole group subtly scales after marks fully drawn
  const tallyBreathe = breathe(frame, { period: 110, amp: 0.005, phase: 60 });
  const tallyGroupOpacity = holdOpacity(frame, { enterStart: 4, enterDur: 6, exitStart: EXIT_START + 2, exitDur: 12 });

  // Build stroke-draw progress per mark
  const markProgress = Array.from({ length: totalMarks }, (_, i) => {
    const start = TALLY_DRAW_START + i * TALLY_STAGGER;
    return interpolate(frame, [start, start + TALLY_DRAW_DUR], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASING.out,
    });
  });

  // Layout: 18 marks in 2 rows of 9
  // Within each row: 9 marks = 1 group of 5 (with diagonal) + 4 singles
  // group spacing = 5*14 + 26 gap
  const MARK_SPACING = 14;
  const GROUP_GAP = 26;

  function markX(i: number): number {
    const groupIdx = Math.floor(i / 5);
    const posInGroup = i % 5;
    return groupIdx * (5 * MARK_SPACING + GROUP_GAP) + posInGroup * MARK_SPACING;
  }

  const ROW_Y = [0, 66];
  const ROW_MARKS = 9;

  // Diagonal slash endpoints per group per row
  // groups 0 and 1 in each of the 2 rows
  type DiagEntry = { row: number; grp: number; markIdx: number };
  const diagonals: DiagEntry[] = [
    { row: 0, grp: 0, markIdx: 4 },
    { row: 0, grp: 1, markIdx: 9 },
    { row: 1, grp: 0, markIdx: 4 + ROW_MARKS },
    { row: 1, grp: 1, markIdx: 9 + ROW_MARKS },
  ];

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <NavyRampBg scaleVal={canvasScale} />

      {/* Subtle blue radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 60% 55% at 50% 42%, rgba(90,169,255,0.05) 0%, transparent 62%)',
        }}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '0 0 0 200px',
          boxSizing: 'border-box',
          transform: `scale(${canvasScale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* CONFIRMED KILLS label — exits cleanly before transition */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: PALETTE.onDarkMuted,
            opacity: labelOpacity,
            marginBottom: 32,
          }}
        >
          CONFIRMED KILLS — BVAAM ENGAGEMENTS
        </div>

        {/* SVG tally marks — stroke-draw animation */}
        <svg
          width={520}
          height={140}
          style={{
            marginBottom: 48,
            overflow: 'visible',
            opacity: tallyGroupOpacity,
            transform: `scale(${tallyBreathe})`,
            transformOrigin: 'left center',
          }}
        >
          {/* Vertical marks — rows 0 and 1 */}
          {Array.from({ length: ROW_MARKS }, (_, i) => (
            <React.Fragment key={`marks-${i}`}>
              {/* Row 0 */}
              {(() => {
                const prog = markProgress[i];
                const drawn = prog * V_LEN;
                return (
                  <line
                    x1={markX(i)} y1={ROW_Y[0]}
                    x2={markX(i)} y2={ROW_Y[0] + V_LEN}
                    stroke={PALETTE.electric}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray={`${V_LEN}`}
                    strokeDashoffset={`${V_LEN - drawn}`}
                  />
                );
              })()}
              {/* Row 1 */}
              {(() => {
                const prog = markProgress[i + ROW_MARKS];
                const drawn = prog * V_LEN;
                return (
                  <line
                    x1={markX(i)} y1={ROW_Y[1]}
                    x2={markX(i)} y2={ROW_Y[1] + V_LEN}
                    stroke={PALETTE.electric}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray={`${V_LEN}`}
                    strokeDashoffset={`${V_LEN - drawn}`}
                  />
                );
              })()}
            </React.Fragment>
          ))}

          {/* Diagonal slashes — one per group of 5 in each row */}
          {diagonals.map(({ row, grp, markIdx }) => {
            const prog = markIdx < totalMarks ? markProgress[markIdx] : 0;
            const drawn = prog * D_LEN;
            const baseX = grp * (5 * MARK_SPACING + GROUP_GAP);
            const y = ROW_Y[row];
            return (
              <line
                key={`diag-${row}-${grp}`}
                x1={baseX - 4} y1={y + 48}
                x2={baseX + 56} y2={y - 4}
                stroke={PALETTE.electric}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={`${D_LEN}`}
                strokeDashoffset={`${D_LEN - drawn}`}
              />
            );
          })}
        </svg>

        {/* "THE RESULT?" — slam entrance, exits before transition */}
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 96,
            fontWeight: 900,
            color: PALETTE.onDark,
            letterSpacing: '-0.025em',
            lineHeight: 0.95,
            opacity: resultOpacity,
            transform: `translateY(${resultY}px) scale(${resultScale})`,
            transformOrigin: 'left center',
          }}
        >
          THE RESULT?
        </div>
      </AbsoluteFill>

      {/* SFX */}
      <Sequence from={4}>
        <Audio
          src={staticFile('sfx/reveal.mp3')}
          volume={(f) =>
            interpolate(f, [0, 8], [0.3, 0], {
              extrapolateRight: 'clamp',
            })
          }
        />
      </Sequence>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — STACKED REVEAL: "A HANDFUL OF KILLS." (display hero) + four reason bars
// dur=248f | stacked-reveal | solid-dark
// "A HANDFUL OF KILLS." is the PAYOFF — biggest type in the scene (120px, 900)
// ══════════════════════════════════════════════════════════════════════════════

const REASONS = [
  { id: 1, label: 'Warning intelligence', isInfo: true },
  { id: 2, label: 'Datalink cueing', isInfo: true },
  { id: 3, label: 'Network awareness', isInfo: true },
  { id: 4, label: 'Missile hardware', isInfo: false },
];

// Phase 5 | template: stacked-reveal | bg: dark
const Phase5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const DUR = 262;

  // EXIT timing
  const EXIT_START = DUR - 30;

  // ── "A HANDFUL OF KILLS." — the PAYOFF, biggest type in scene ──────────────
  // Enters with a powerful scale-slam (spring, not soft settle) then settles
  const headlineSlamP = useSpring(frame, fps, 4, { damping: 13, stiffness: 260, mass: 0.8 });
  const headlineSlam = interpolate(headlineSlamP, [0, 1], [1.22, 1.0]);
  const headlineY = interpolate(headlineSlamP, [0, 1], [30, 0]);
  const headlineOpacity = holdOpacity(frame, { enterStart: 4, enterDur: 14, exitStart: EXIT_START, exitDur: 14 });

  // Ambient breathe on headline during hold
  const headlineBreathe = breathe(frame, { period: 150, amp: 0.003, phase: 0 });

  // Ambient scale drift for whole canvas
  const canvasScale = 1 + interpolate(frame, [0, DUR], [0, 0.022], {
    extrapolateRight: 'clamp',
    easing: EASING.drift,
  });

  // Bars stagger from ~64f, 15f between each
  const barEnters = REASONS.map((_, i) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSpring(frame, fps, 64 + i * 15, MOTION.springSnappy)
  );

  const barsOpacity = holdOpacity(frame, { enterStart: 64, enterDur: 20, exitStart: EXIT_START + 2, exitDur: 12 });

  // INFORMATION stamp at ~217f
  const stampP = useSpring(frame, fps, 217, { damping: 10, stiffness: 320, mass: 0.7 });
  const stampScaleP = useSpring(frame, fps, 217, { damping: 9, stiffness: 280 });
  const stampScale = interpolate(stampScaleP, [0, 1], [1.22, 1.0]);
  const stampOpacity = holdOpacity(frame, { enterStart: 217, enterDur: 10, exitStart: EXIT_START + 4, exitDur: 12 });

  // Bar recolor to electric at ~217f
  const recolorProgress = interpolate(frame, [217, 234], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  function barColor(isInfo: boolean): string {
    if (!isInfo) return 'rgba(255,255,255,0.18)';
    const gray = [160, 165, 175];
    const elec = [90, 169, 255];
    const r = Math.round(gray[0] + (elec[0] - gray[0]) * recolorProgress);
    const g = Math.round(gray[1] + (elec[1] - gray[1]) * recolorProgress);
    const b = Math.round(gray[2] + (elec[2] - gray[2]) * recolorProgress);
    return `rgb(${r},${g},${b})`;
  }

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <NavyRampBg scaleVal={canvasScale} />

      {/* Subtle radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 65% 60% at 50% 42%, rgba(90,169,255,0.06) 0%, transparent 65%)',
        }}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '0 180px 0 200px',
          boxSizing: 'border-box',
          transform: `scale(${canvasScale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* "A HANDFUL OF KILLS." — PAYOFF: display Archivo 900, 120px */}
        {/* This is the biggest type moment of the scene — hierarchy correct */}
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 120,
            fontWeight: 900,
            color: PALETTE.onDark,
            letterSpacing: '-0.03em',
            lineHeight: 0.98,
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px) scale(${headlineSlam * headlineBreathe})`,
            transformOrigin: 'left center',
            marginBottom: 52,
          }}
        >
          A HANDFUL{' '}
          <span style={{ color: PALETTE.secondary }}>OF KILLS.</span>
        </div>

        {/* Four reason bars */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            width: '100%',
            position: 'relative',
            opacity: barsOpacity,
          }}
        >
          {REASONS.map((reason, i) => {
            const barP = barEnters[i];
            const barW = interpolate(barP, [0, 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const color = barColor(reason.isInfo);
            const labelY = interpolate(barP, [0, 1], [10, 0]);

            return (
              <div
                key={reason.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  opacity: barP,
                }}
              >
                {/* Number */}
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 24,
                    fontWeight: 600,
                    color: reason.isInfo
                      ? `rgba(90,169,255,${0.5 + recolorProgress * 0.5})`
                      : 'rgba(255,255,255,0.35)',
                    width: 28,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {reason.id}.
                </div>

                {/* Bar track */}
                <div
                  style={{
                    width: 440,
                    height: 6,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 3,
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: `${barW * 100}%`,
                      height: '100%',
                      background: color,
                      borderRadius: 3,
                    }}
                  />
                </div>

                {/* Label */}
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 30,
                    fontWeight: reason.isInfo ? 600 : 400,
                    color: reason.isInfo
                      ? `rgba(90,169,255,${0.7 + recolorProgress * 0.3})`
                      : 'rgba(255,255,255,0.42)',
                    letterSpacing: '0.01em',
                    transform: `translateY(${labelY}px)`,
                  }}
                >
                  {reason.label}
                </div>
              </div>
            );
          })}

          {/* INFORMATION stamp — spans bars 1-3 */}
          <div
            style={{
              position: 'absolute',
              top: -14,
              left: 284,
              pointerEvents: 'none',
              opacity: stampOpacity,
              transform: `scale(${stampScale})`,
              transformOrigin: 'center center',
            }}
          >
            <div
              style={{
                fontFamily: FONTS.heading,
                fontSize: 56,
                fontWeight: 900,
                color: PALETTE.electric,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                lineHeight: 1,
                border: `3px solid ${PALETTE.electric}`,
                padding: '6px 20px',
                opacity: 0.92,
                transform: 'rotate(-2.5deg)',
                whiteSpace: 'nowrap',
                background: `rgba(${RAMP.navy[1].slice(1).match(/../g)!.map(h => parseInt(h,16)).join(',')},0.6)`,
              }}
            >
              INFORMATION
            </div>
          </div>
        </div>

      </AbsoluteFill>

      <Grain opacity={0.04} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SCENE_03 ROOT — TransitionSeries wiring
// Total: (269+157+289+225+262) - 4×18 = 1202 - 72 = 1130 frames
// (Note: scene registered with 1130 — TransitionSeries overlap accounts for it)
// ══════════════════════════════════════════════════════════════════════════════
export default function Scene_03() {
  return (
    <AbsoluteFill style={{ background: RAMP.navy[1] }}>
      <TransitionSeries>
        {/* Phase 1: Officer portrait — 269f */}
        <TransitionSeries.Sequence durationInFrames={269}>
          <Phase1 />
        </TransitionSeries.Sequence>

        {/* Transition 1→2: fade (image→image) — 18f */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 18 })}
        />

        {/* Phase 2: Journal — 157f */}
        <TransitionSeries.Sequence durationInFrames={157}>
          <Phase2 />
        </TransitionSeries.Sequence>

        {/* Transition 2→3: fade (image→image/dark) — 18f */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 18 })}
        />

        {/* Phase 3: A CONFESSION / Su-35 — 289f */}
        <TransitionSeries.Sequence durationInFrames={289}>
          <Phase3 />
        </TransitionSeries.Sequence>

        {/* Transition 3→4: wipe (image→solid-dark) — 18f */}
        <TransitionSeries.Transition
          presentation={wipe({ direction: 'from-left' })}
          timing={linearTiming({ durationInFrames: 18 })}
        />

        {/* Phase 4: Tally marks / THE RESULT? — 225f */}
        <TransitionSeries.Sequence durationInFrames={225}>
          <Phase4 />
        </TransitionSeries.Sequence>

        {/* Transition 4→5: wipe (solid-dark→solid-dark) — 18f */}
        <TransitionSeries.Transition
          presentation={wipe({ direction: 'from-right' })}
          timing={linearTiming({ durationInFrames: 18 })}
        />

        {/* Phase 5: Four reason bars — 262f */}
        <TransitionSeries.Sequence durationInFrames={262}>
          <Phase5 />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
}
