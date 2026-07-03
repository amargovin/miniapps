// Scene_10 | templates: centered-hero(3), stacked-reveal(1), split-compare(1), lower-third(1)
// "A Long-Range Missile Won't Fix India's PL-15 Problem" — THESIS (network against network)
// 1147 frames @ 30fps | ALL phases: PALETTE.dark — final scene, resolute close
// TSM: (207+175+169+227+175+284) − (5×18=90) = 1237 − 90 = 1147 ✓

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

const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.055 }) => (
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

// ══════════════════════════════════════════════════════════════════════════════
// Phase 1 | template: centered-hero | bg: solid-dark
// dur=207f — "MISSILE vs MISSILE" struck through. "NETWORK vs NETWORK" scale-slams at ~frame 116.
// Electric/red split coloring.
// ══════════════════════════════════════════════════════════════════════════════
const Phase1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "MISSILE vs MISSILE" enters at frame 8
  const missileP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springSnappy });
  const missileY = interpolate(missileP, [0, 1], [24, 0]);

  // Strikethrough grows from frame 10
  const strikeScale = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: MOTION.springSnappy,
  });

  // "NETWORK vs NETWORK" slams at frame 116
  const networkP = spring({
    frame: Math.max(0, frame - 116),
    fps,
    config: { damping: 9, stiffness: 240, mass: 1.0 },
  });
  const networkScale = interpolate(networkP, [0, 1], [1.2, 1.0]);
  const networkY = interpolate(networkP, [0, 1], [40, 0]);

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Subtle dark radial vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.4) 100%)`,
          pointerEvents: 'none',
        }}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 220,
          gap: 32,
        }}
      >
        {/* "MISSILE vs MISSILE" with strikethrough */}
        <div
          style={{
            opacity: missileP,
            transform: `translateY(${missileY}px)`,
            position: 'relative',
            display: 'inline-block',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 72,
              fontWeight: 700,
              color: PALETTE.onDarkMuted,
              letterSpacing: '-0.01em',
              lineHeight: 1.1,
            }}
          >
            MISSILE vs MISSILE
          </span>
          {/* Strikethrough bar */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              height: 4,
              width: `${strikeScale * 100}%`,
              background: PALETTE.secondary,
              transform: 'translateY(-50%)',
              borderRadius: 2,
            }}
          />
        </div>

        {/* "NETWORK vs NETWORK" — electric / muted / secondary */}
        <div
          style={{
            opacity: networkP,
            transform: `translateY(${networkY}px) scale(${networkScale})`,
            transformOrigin: 'center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.0,
            }}
          >
            <span style={{ color: PALETTE.electric }}>NETWORK</span>
            <span style={{ color: PALETTE.onDarkMuted, fontSize: 64, fontWeight: 400, margin: '0 20px' }}>vs</span>
            <span style={{ color: PALETTE.secondary }}>NETWORK</span>
          </span>
        </div>
      </AbsoluteFill>

      <Grain />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 2 | template: stacked-reveal | bg: solid-dark
// dur=175f — "SENSORS." / "DATALINKS." / "BATTLE MANAGEMENT." stamp on beats.
// Thin web lines connect them after frame 80.
// ══════════════════════════════════════════════════════════════════════════════
const Phase2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Stamps: phase-relative frames from TSM whisper beats
  // 6300ms = 0f into phase, 7440ms = 34f, 8400ms = 63f
  const stamp1P = spring({ frame: Math.max(0, frame - 0), fps, config: MOTION.springSnappy });
  const stamp1Scale = interpolate(stamp1P, [0, 1], [1.1, 1.0]);

  const stamp2P = spring({ frame: Math.max(0, frame - 34), fps, config: MOTION.springSnappy });
  const stamp2Scale = interpolate(stamp2P, [0, 1], [1.1, 1.0]);

  const stamp3P = spring({ frame: Math.max(0, frame - 63), fps, config: MOTION.springSnappy });
  const stamp3Scale = interpolate(stamp3P, [0, 1], [1.1, 1.0]);

  // Web lines appear at frame 88
  const webP = spring({
    frame: Math.max(0, frame - 75),
    fps,
    config: { stiffness: 50, damping: 16, mass: 1 },
  });

  // Layout: three words positioned in a triangle
  // Sensors: top-center, Datalinks: bottom-left, Battle Management: bottom-right
  const pos = {
    sensors:    { x: 960, y: 340 },
    datalinks:  { x: 480, y: 680 },
    battle:     { x: 1440, y: 680 },
  };

  const lineLen1 = Math.hypot(pos.datalinks.x - pos.sensors.x, pos.datalinks.y - pos.sensors.y);
  const lineLen2 = Math.hypot(pos.battle.x - pos.datalinks.x, pos.battle.y - pos.datalinks.y);
  const lineLen3 = Math.hypot(pos.battle.x - pos.sensors.x, pos.battle.y - pos.sensors.y);

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Web SVG lines — triangle connecting the three */}
      <svg
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
        viewBox="0 0 1920 1080"
        width="1920"
        height="1080"
      >
        {/* sensors → datalinks */}
        <line
          x1={pos.sensors.x}
          y1={pos.sensors.y}
          x2={pos.datalinks.x}
          y2={pos.datalinks.y}
          stroke={PALETTE.electric}
          strokeWidth={1}
          strokeDasharray={lineLen1}
          strokeDashoffset={lineLen1 * (1 - webP)}
          opacity={webP * 0.4}
        />
        {/* datalinks → battle */}
        <line
          x1={pos.datalinks.x}
          y1={pos.datalinks.y}
          x2={pos.battle.x}
          y2={pos.battle.y}
          stroke={PALETTE.electric}
          strokeWidth={1}
          strokeDasharray={lineLen2}
          strokeDashoffset={lineLen2 * (1 - webP)}
          opacity={webP * 0.4}
        />
        {/* sensors → battle */}
        <line
          x1={pos.sensors.x}
          y1={pos.sensors.y}
          x2={pos.battle.x}
          y2={pos.battle.y}
          stroke={PALETTE.electric}
          strokeWidth={1}
          strokeDasharray={lineLen3}
          strokeDashoffset={lineLen3 * (1 - webP)}
          opacity={webP * 0.4}
        />
        {/* Node dots */}
        {Object.values(pos).map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={5}
            fill={PALETTE.electric}
            opacity={webP * 0.55}
          />
        ))}
      </svg>

      {/* SENSORS. */}
      <div
        style={{
          position: 'absolute',
          left: pos.sensors.x,
          top: pos.sensors.y - 40,
          transform: `translate(-50%, -50%) scale(${stamp1Scale})`,
          transformOrigin: 'center',
          opacity: stamp1P,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 80,
            fontWeight: 800,
            color: PALETTE.onDark,
            letterSpacing: '-0.02em',
          }}
        >
          SENSORS.
        </span>
      </div>

      {/* DATALINKS. */}
      <div
        style={{
          position: 'absolute',
          left: pos.datalinks.x,
          top: pos.datalinks.y - 40,
          transform: `translate(-50%, -50%) scale(${stamp2Scale})`,
          transformOrigin: 'center',
          opacity: stamp2P,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 80,
            fontWeight: 800,
            color: PALETTE.onDark,
            letterSpacing: '-0.02em',
          }}
        >
          DATALINKS.
        </span>
      </div>

      {/* BATTLE MANAGEMENT. */}
      <div
        style={{
          position: 'absolute',
          left: pos.battle.x,
          top: pos.battle.y - 40,
          transform: `translate(-50%, -50%) scale(${stamp3Scale})`,
          transformOrigin: 'center',
          opacity: stamp3P,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 72,
            fontWeight: 800,
            color: PALETTE.onDark,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          BATTLE MANAGEMENT.
        </span>
      </div>

      <Grain />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 3 | template: split-compare | bg: solid-dark
// dur=169f — Left "ARRIVE LIKE GHOSTS" (ghosted echo). Right "ARRIVE ANNOUNCED" (red).
// Vertical divider.
// ══════════════════════════════════════════════════════════════════════════════
const Phase3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Left panel enters at frame 8
  const leftP = spring({ frame: Math.max(0, frame - 8), fps, config: MOTION.springSnappy });
  // Right panel enters at frame 24
  const rightP = spring({ frame: Math.max(0, frame - 24), fps, config: MOTION.springSnappy });

  // Divider draws
  const dividerP = spring({ frame: Math.max(0, frame - 5), fps, config: MOTION.springSnappy });

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Vertical divider */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 100,
          width: 1.5,
          height: `${dividerP * 80}%`,
          background: PALETTE.onDark,
          opacity: 0.18,
          transform: 'translateX(-50%)',
        }}
      />

      {/* ══ LEFT PANEL — "ARRIVE LIKE GHOSTS" ══ */}
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
        }}
      >
        <div style={{ position: 'relative' }}>
          {/* Echo copies (ghost effect) + primary via map to share single fontSize ref */}
          {[{ op: 0.15, tx: 8 }, { op: 0.07, tx: 16 }, { op: 0.72, tx: 0 }].map(({ op, tx }, i) => (
            <span
              key={i}
              style={{
                fontFamily: FONTS.heading,
                fontSize: 60,
                fontWeight: 800,
                color: PALETTE.onDark,
                letterSpacing: '-0.01em',
                lineHeight: 1.15,
                opacity: op,
                display: 'block',
                position: i < 2 ? 'absolute' : 'relative',
                top: i < 2 ? 0 : undefined,
                left: i < 2 ? 0 : undefined,
                transform: `translateX(${tx}px)`,
                mixBlendMode: i < 2 ? 'screen' : undefined,
                pointerEvents: i < 2 ? 'none' : undefined,
              }}
            >
              ARRIVE
              <br />
              LIKE GHOSTS
            </span>
          ))}
        </div>

        {/* Sub-label */}
        <div
          style={{
            marginTop: 24,
            opacity: interpolate(frame, [60, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * leftP,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              color: PALETTE.onDarkMuted,
              letterSpacing: '0.20em',
            }}
          >
            WITH NETWORK SUPERIORITY
          </span>
        </div>
      </div>

      {/* ══ RIGHT PANEL — "ARRIVE ANNOUNCED" ══ */}
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
        }}
      >
        {/* Harsh spotlight */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 50% 50%, ${PALETTE.secondary}22, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 60,
            fontWeight: 800,
            color: PALETTE.secondary,
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
            position: 'relative',
          }}
        >
          ARRIVE
          <br />
          ANNOUNCED
        </span>

        {/* Sub-label */}
        <div
          style={{
            marginTop: 24,
            opacity: interpolate(frame, [70, 100], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * rightP,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              color: PALETTE.secondary,
              letterSpacing: '0.20em',
              opacity: 0.7,
            }}
          >
            WITHOUT IT
          </span>
        </div>
      </div>

      <Grain />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 4 | template: lower-third | bg: image | asset: s01_two_men.png (16:9)
// dur=227f — Duotone full-bleed. "MOSCOW" / "BENGALURU" labels fade at opposite corners.
// Ken Burns.
// ══════════════════════════════════════════════════════════════════════════════
const Phase4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Ken Burns: slow zoom 1.0 → 1.05
  const kbScale = interpolate(frame, [0, 227], [1.0, 1.05], {
    extrapolateRight: 'clamp',
  });

  // "MOSCOW" label at frame 20 — top-left
  const moscowP = spring({ frame: Math.max(0, frame - 20), fps, config: MOTION.springSnappy });
  // "BENGALURU" label at frame 32 — top-right area (avoiding logo zone)
  const bengaluruP = spring({ frame: Math.max(0, frame - 32), fps, config: MOTION.springSnappy });

  // Lower-third caption at frame 80
  const captionP = spring({ frame: Math.max(0, frame - 80), fps, config: MOTION.springSnappy });

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Full-bleed image */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
        }}
      >
        <Img
          src={staticFile('s01_two_men.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 35%',
            transform: `scale(${kbScale})`,
            willChange: 'transform',
          }}
        />
      </div>

      {/* Duotone overlay — deep navy to darken */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(11, 22, 34, 0.52)`,
          pointerEvents: 'none',
        }}
      />

      {/* Bottom gradient for lower-third */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 320,
          background: `linear-gradient(0deg, ${PALETTE.dark} 0%, transparent 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Top gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 200,
          background: `linear-gradient(180deg, rgba(11,22,34,0.55) 0%, transparent 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* MOSCOW — top-left */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: 140,
          opacity: moscowP,
          transform: `translateY(${interpolate(moscowP, [0, 1], [-12, 0])}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.22em',
            color: PALETTE.onDark,
            textTransform: 'uppercase',
          }}
        >
          MOSCOW
        </span>
        <div
          style={{
            width: interpolate(moscowP, [0, 1], [0, 40]),
            height: 2,
            background: PALETTE.electric,
            marginTop: 6,
            borderRadius: 1,
          }}
        />
      </div>

      {/* BENGALURU — top-right area, offset from extreme corner to avoid logo zone */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          right: 400,
          opacity: bengaluruP,
          transform: `translateY(${interpolate(bengaluruP, [0, 1], [-12, 0])}px)`,
          textAlign: 'right',
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.22em',
            color: PALETTE.onDark,
            textTransform: 'uppercase',
          }}
        >
          BENGALURU
        </span>
        <div
          style={{
            width: interpolate(bengaluruP, [0, 1], [0, 50]),
            height: 2,
            background: PALETTE.accent,
            marginTop: 6,
            borderRadius: 1,
            marginLeft: 'auto',
          }}
        />
      </div>

      {/* Lower-third caption */}
      <div
        style={{
          position: 'absolute',
          bottom: 248,
          left: 140,
          opacity: captionP,
          transform: `translateY(${interpolate(captionP, [0, 1], [16, 0])}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 32,
            fontWeight: 400,
            color: PALETTE.onDark,
            letterSpacing: '0.01em',
            lineHeight: 1.5,
          }}
        >
          Two capitals. One problem. Opposite answers.
        </span>
      </div>

      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 5 | template: centered-hero | bg: solid-dark
// dur=175f — Converging arrows callback from Scene05. "Buy the missile if you must." at ~frame 86.
// ══════════════════════════════════════════════════════════════════════════════
const Phase5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ARROW_LEN = 840;
  const CX = 960;
  const CY = 480;

  // Both arrows draw from frame 8
  const arrowProgress = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { stiffness: 80, damping: 20, mass: 1 },
  });

  const leftDashOffset = ARROW_LEN * (1 - arrowProgress);
  const rightDashOffset = ARROW_LEN * (1 - arrowProgress);

  // Arrowhead opacity when arrows complete
  const arrowheadOpacity = interpolate(arrowProgress, [0.82, 1.0], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Centre convergence dot
  const dotOpacity = interpolate(arrowProgress, [0.7, 1.0], [0, 0.8], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "Buy the missile if you must." at frame 86
  const textP = spring({
    frame: Math.max(0, frame - 75),
    fps,
    config: MOTION.springSnappy,
  });
  const textY = interpolate(textP, [0, 1], [28, 0]);

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Subtle radial vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 48%, transparent 35%, rgba(0,0,0,0.35) 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Converging arrows SVG ── */}
      <svg
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
        viewBox="0 0 1920 1080"
        width="1920"
        height="1080"
      >
        {/* Left arrow: 0,CY → CX-120,CY */}
        <line
          x1={0}
          y1={CY}
          x2={CX - 120}
          y2={CY}
          stroke={PALETTE.electric}
          strokeWidth={2}
          strokeDasharray={ARROW_LEN}
          strokeDashoffset={leftDashOffset}
          strokeLinecap="round"
          opacity={0.55}
        />
        {/* Left arrowhead pointing right (toward center) */}
        <g opacity={arrowheadOpacity}>
          <polygon
            points={`${CX - 120},${CY} ${CX - 142},${CY - 11} ${CX - 142},${CY + 11}`}
            fill={PALETTE.electric}
            opacity={0.65}
          />
        </g>

        {/* Right arrow: 1920,CY → CX+120,CY */}
        <line
          x1={1920}
          y1={CY}
          x2={CX + 120}
          y2={CY}
          stroke={PALETTE.electric}
          strokeWidth={2}
          strokeDasharray={ARROW_LEN}
          strokeDashoffset={rightDashOffset}
          strokeLinecap="round"
          opacity={0.55}
        />
        {/* Right arrowhead pointing left (toward center) */}
        <g opacity={arrowheadOpacity}>
          <polygon
            points={`${CX + 120},${CY} ${CX + 142},${CY - 11} ${CX + 142},${CY + 11}`}
            fill={PALETTE.electric}
            opacity={0.65}
          />
        </g>

        {/* Center convergence dot — glows electric */}
        <circle
          cx={CX}
          cy={CY}
          r={8}
          fill={PALETTE.electric}
          opacity={dotOpacity}
        />
        {/* Glow ring */}
        <circle
          cx={CX}
          cy={CY}
          r={22}
          fill="none"
          stroke={PALETTE.electric}
          strokeWidth={2}
          opacity={dotOpacity * 0.3}
          style={{ filter: 'blur(3px)' }}
        />
      </svg>

      {/* "Buy the missile if you must." */}
      <div
        style={{
          position: 'absolute',
          bottom: 310,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: textP,
          transform: `translateY(${textY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 48,
            fontWeight: 600,
            color: PALETTE.accent,
            letterSpacing: '-0.005em',
            lineHeight: 1.2,
            textAlign: 'center',
          }}
        >
          Buy the missile if you must.
        </span>
      </div>

      <Grain />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Phase 6 | template: centered-hero | bg: solid-dark
// dur=284f — Final three beats. Fade to black at end. SFX impact.mp3 for final line.
// Beat 1 at frame 3: "The missile was never the answer."
// Beat 2 at frame 103: "The first warning you get is the last one." (electric)
// Beat 3 at frame 195: "Make sure it is the other side that gets it." (bold, large)
// Fade to black frames 240→284.
// ══════════════════════════════════════════════════════════════════════════════
const Phase6: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat 1 at frame 3
  const beat1P = spring({ frame: Math.max(0, frame - 3), fps, config: MOTION.springSnappy });
  const beat1Y = interpolate(beat1P, [0, 1], [28, 0]);

  // Beat 2 at frame 103
  const beat2P = spring({ frame: Math.max(0, frame - 103), fps, config: MOTION.springSnappy });
  const beat2Y = interpolate(beat2P, [0, 1], [28, 0]);

  // Beat 3 at frame 195
  const beat3P = spring({
    frame: Math.max(0, frame - 195),
    fps,
    config: { damping: 14, stiffness: 260, mass: 1.0 },
  });
  const beat3Scale = interpolate(beat3P, [0, 1], [1.08, 1.0]);
  const beat3Y = interpolate(beat3P, [0, 1], [32, 0]);

  // Fade to black: frames 240 → 284
  const fadeToBlack = interpolate(frame, [240, 284], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
      {/* Subtle vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.45) 100%)`,
          pointerEvents: 'none',
        }}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 240,
          paddingTop: 60,
          gap: 28,
          padding: '80px 200px 260px 200px',
          boxSizing: 'border-box',
        }}
      >
        {/* Beat 1: "The missile was never the answer." */}
        <div
          style={{
            opacity: beat1P,
            transform: `translateY(${beat1Y}px)`,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 56,
              fontWeight: 600,
              color: PALETTE.onDark,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            The missile was never the answer.
          </span>
        </div>

        {/* Beat 2: "The first warning you get is the last one." */}
        <div
          style={{
            opacity: beat2P,
            transform: `translateY(${beat2Y}px)`,
            textAlign: 'center',
            marginTop: 12,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 48,
              fontWeight: 600,
              color: PALETTE.electric,
              letterSpacing: '-0.01em',
              lineHeight: 1.25,
            }}
          >
            The first warning you get is the last one.
          </span>
        </div>

        {/* Beat 3: "Make sure it is the other side that gets it." */}
        <div
          style={{
            opacity: beat3P,
            transform: `translateY(${beat3Y}px) scale(${beat3Scale})`,
            transformOrigin: 'center',
            textAlign: 'center',
            marginTop: 16,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 64,
              fontWeight: 800,
              color: PALETTE.onDark,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            Make sure it is the other side that gets it.
          </span>
        </div>
      </AbsoluteFill>

      {/* SFX: impact.mp3 for final line at frame 195 */}
      <Sequence from={195}>
        <Audio src={staticFile('sfx/impact.mp3')} volume={0.5} />
      </Sequence>

      {/* Fade to black overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#000000',
          opacity: fadeToBlack,
          pointerEvents: 'none',
        }}
      />

      <Grain />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Scene_10 root — TransitionSeries with 18-frame fade() transitions (all dark)
// TSM: (207+175+169+227+175+284) − (5×18=90) = 1237 − 90 = 1147 ✓
// ══════════════════════════════════════════════════════════════════════════════
export default function Scene_10() {
  return (
    <AbsoluteFill style={{ background: PALETTE.dark }}>
      <TransitionSeries>
        {/* Phase 1 → Phase 2 */}
        <TransitionSeries.Sequence durationInFrames={207}>
          <Phase1 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 18 })} />

        {/* Phase 2 → Phase 3 */}
        <TransitionSeries.Sequence durationInFrames={175}>
          <Phase2 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 18 })} />

        {/* Phase 3 → Phase 4 */}
        <TransitionSeries.Sequence durationInFrames={169}>
          <Phase3 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 18 })} />

        {/* Phase 4 → Phase 5 */}
        <TransitionSeries.Sequence durationInFrames={227}>
          <Phase4 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 18 })} />

        {/* Phase 5 → Phase 6 */}
        <TransitionSeries.Sequence durationInFrames={175}>
          <Phase5 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 18 })} />

        {/* Phase 6 — final */}
        <TransitionSeries.Sequence durationInFrames={311}>
          <Phase6 />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
}
