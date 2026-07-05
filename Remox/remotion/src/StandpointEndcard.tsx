// StandpointEndcard | Standpoint house end card — BROADCAST NEWS closer (210f @ 30fps)
// SHIPS WITH THE SCAFFOLD (src/StandpointEndcard.tsx). Register as 'SceneEndcard',
// 210f, silent 7s audio; RemoxScene skips the corner logo for it. Prefer the
// pre-rendered ~/.claude/skills/Remox/assets/standpoint_endcard.mp4 unless the
// credit names change.
// v2 (2026-07-04): "news TV show" register replacing the confetti sting.
//   Deep navy studio field + slow sweeping diagonal light bands + grain.
//   Beat 1 (f0-105): credit STRAPS slide in (red kicker block + glass bar).
//   Beat 2 (f105-210): STANDPOINT slams in white 900, red rule sweep,
//   "by [Swarajya wordmark on red chip]", specular shine pass, fade to black.
// Silent by design — pair with silent AAC for concat.

import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { FONTS, EASING, FILM_GRAIN_SVG } from './theme';

const DUR = 210;
const BEAT2 = 105;

const NAVY_DEEP = '#081019';
const NAVY = '#0E1E2E';
const RED = '#C4373B';

// ── Sweeping diagonal light bands — the broadcast studio backdrop ─────────────
function LightBands({ frame }: { frame: number }): React.ReactElement {
  const bands = [
    { w: 520, o: 0.05, speed: 0.55, phase: 0, c: '#5A7BA6' },
    { w: 340, o: 0.07, speed: 0.8, phase: 700, c: '#FFFFFF' },
    { w: 760, o: 0.04, speed: 0.38, phase: 1400, c: RED },
  ];
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {bands.map((b, i) => {
        const x = ((frame * b.speed + b.phase) % 3200) - 1200;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: -400,
              width: b.w,
              height: 2000,
              background: `linear-gradient(90deg, transparent 0%, ${b.c} 50%, transparent 100%)`,
              opacity: b.o,
              transform: 'rotate(22deg)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

// ── Broadcast credit strap: red kicker block + glass bar ──────────────────────
function CreditStrap({
  frame,
  at,
  exitAt,
  kicker,
  name,
  top,
}: {
  frame: number;
  at: number;
  exitAt: number;
  kicker: string;
  name: string;
  top: number;
}): React.ReactElement | null {
  const enter = interpolate(frame, [at, at + 16], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out,
  });
  const exit = interpolate(frame, [exitAt, exitAt + 14], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.in,
  });
  if (frame < at || exit >= 1) return null;
  const x = (1 - enter) * -80 + exit * 90;
  const o = enter * (1 - exit);
  return (
    <div
      style={{
        position: 'absolute',
        left: 260,
        top,
        display: 'flex',
        alignItems: 'stretch',
        transform: `translateX(${x}px)`,
        opacity: o,
      }}
    >
      {/* red kicker block */}
      <div
        style={{
          background: RED,
          display: 'flex',
          alignItems: 'center',
          padding: '0 28px',
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '0.22em',
            color: '#FFFFFF',
            whiteSpace: 'nowrap',
          }}
        >
          {kicker}
        </span>
      </div>
      {/* glass name bar */}
      <div
        style={{
          background: 'rgba(255,255,255,0.08)',
          borderTop: '1px solid rgba(255,255,255,0.14)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          padding: '18px 44px',
          backdropFilter: 'blur(6px)',
        }}
      >
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 58,
            fontWeight: 800,
            letterSpacing: '0.01em',
            color: '#FFFFFF',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
        >
          {name}
        </span>
      </div>
    </div>
  );
}

const StandpointEndcard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const STRAP_EXIT = BEAT2 - 18;

  // disclaimer (beat 1)
  const discO =
    interpolate(frame, [56, 72], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out,
    }) *
    interpolate(frame, [STRAP_EXIT, STRAP_EXIT + 14], [1, 0], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.in,
    });

  // beat 2: STANDPOINT slam
  const T_AT = BEAT2 + 10;
  const sp = spring({ frame: Math.max(0, frame - T_AT), fps, config: { damping: 15, stiffness: 210 } });
  const titleO = frame >= T_AT ? 1 : 0;
  const titleScale = 1.4 - 0.4 * sp;

  // red rule sweeps under the title
  const ruleP = interpolate(frame, [T_AT + 10, T_AT + 30], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out,
  });
  const byO = interpolate(frame, [T_AT + 24, T_AT + 38], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out,
  });
  const byY = interpolate(frame, [T_AT + 24, T_AT + 40], [14, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out,
  });

  // specular shine pass across the lockup
  const shineX = interpolate(frame, [T_AT + 34, T_AT + 74], [-500, 2400], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.inOut,
  });

  // end: fade to black (broadcast sign-off)
  const blackOut = interpolate(frame, [DUR - 14, DUR], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.in,
  });
  const breathe = 1 + 0.004 * Math.sin(frame / 15);

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY_DEEP }}>
      {/* studio field */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 38%, ${NAVY} 0%, ${NAVY_DEEP} 62%, #050B12 100%)`,
        }}
      />
      <LightBands frame={frame} />
      {/* red baseline accent — studio floor line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 236,
          height: 4,
          background: `linear-gradient(90deg, transparent 0%, ${RED} 18%, ${RED} 82%, transparent 100%)`,
          opacity: 0.5,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: FILM_GRAIN_SVG,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
          opacity: 0.04,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />

      {/* Beat 1 — credit straps */}
      <CreditStrap frame={frame} at={14} exitAt={STRAP_EXIT} kicker="SCRIPT" name="Prakhar Gupta" top={340} />
      <CreditStrap frame={frame} at={34} exitAt={STRAP_EXIT + 4} kicker="CREATIVE DIRECTION" name="Raghavan S Rao" top={470} />
      <div
        style={{
          position: 'absolute',
          left: 260,
          top: 620,
          opacity: discO,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 28,
            fontStyle: 'italic',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          Images are for illustration purposes only.
        </span>
      </div>

      {/* Beat 2 — brand sign-off */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 90,
          transform: `scale(${breathe})`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 172,
            fontWeight: 900,
            letterSpacing: '0.02em',
            color: '#FFFFFF',
            opacity: titleO,
            transform: `scale(${titleScale})`,
            lineHeight: 1,
          }}
        >
          STANDPOINT
        </span>
        {/* red rule sweep */}
        <div
          style={{
            width: 880 * ruleP,
            height: 8,
            background: RED,
            marginTop: 30,
            opacity: titleO,
          }}
        />
        <div
          style={{
            opacity: byO,
            transform: `translateY(${byY}px)`,
            marginTop: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 42,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            by
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', background: RED, borderRadius: 6, padding: '13px 24px' }}>
            <Img src={staticFile('images/swarajya_logo_white.png')} style={{ height: 44, width: 'auto', display: 'block' }} />
          </div>
        </div>
      </AbsoluteFill>

      {/* specular shine pass over the lockup */}
      {frame >= T_AT && (
        <div
          style={{
            position: 'absolute',
            left: shineX,
            top: -300,
            width: 260,
            height: 1800,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 50%, transparent 100%)',
            transform: 'rotate(18deg)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* end fade to black */}
      <AbsoluteFill style={{ backgroundColor: '#000000', opacity: blackOut, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};

export default StandpointEndcard;
