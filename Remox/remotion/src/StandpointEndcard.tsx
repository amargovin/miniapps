// StandpointEndcard | Standpoint house end card — reusable 7s closer (210f @ 30fps)
// SHIPS WITH THE SCAFFOLD (src/StandpointEndcard.tsx). Register as:
//   import StandpointEndcard from './StandpointEndcard';
//   registry['SceneEndcard'] = StandpointEndcard;
// Add to project.json: { id: 'SceneEndcard', audio: 'audio/scene_98.mp3', durationFrames: 210 }
// (generate silent audio: ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 7 -q:a 9 scene_98.mp3)
// RemoxScene must skip the corner logo for 'SceneEndcard' (endcard exception, LEARNINGS §7).
// Prefer the pre-rendered copy at ~/.claude/skills/Remox/assets/standpoint_endcard.mp4 —
// concat it directly unless the credits text needs to change.
// Merges the credits closer + brand sting into one two-beat end card:
//   Beat 1 (f0–105):  credits — Script by / Creative Direction by / disclaimer
//   Beat 2 (f105–210): brand sign-off — STANDPOINT + by [Swarajya wordmark chip]
// Bright happy language: warm white field, colour ribbons, confetti.
// Fades in from white (cuts off any final scene); ends fading to white.
// Silent by design — pair with a silent AAC track for concat compatibility.

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
import { FONTS, EASING } from './theme';

const DUR = 210;
const BEAT2 = 105;

const COLORS = ['#4F46E5', '#FF6B57', '#F5A623', '#34C182', '#5AA9FF', '#C4373B'];
const NAVY = '#12283F';
const RED = '#C4373B';

const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Ribbons sweep in from upper-right at open; a second, reverse sweep marks beat 2.
function Ribbons({ frame }: { frame: number }): React.ReactElement {
  const make = (i: number, c: string, start: number, reverse: boolean) => {
    const p = interpolate(frame, [start, start + 32], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASING.inOut,
    });
    const x = reverse ? -1400 + p * 3400 : 2000 - p * 3400;
    const y = reverse ? 900 - p * 1000 : -200 + p * 1000;
    const drift = Math.sin(frame / 26 + i * 1.7) * 8;
    const thickness = 90 + rnd(i, 3) * 90;
    const length = 900 + rnd(i, 4) * 700;
    return (
      <div
        key={`${i}-${reverse ? 'r' : 'f'}`}
        style={{
          position: 'absolute',
          left: x + (reverse ? i * 120 : -i * 120),
          top: y + (reverse ? i * 60 : -i * 60) + drift,
          width: length,
          height: thickness,
          borderRadius: thickness / 2,
          background: c,
          opacity: 0.85,
          transform: 'rotate(-24deg)',
        }}
      />
    );
  };
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {COLORS.map((c, i) => make(i, c, 2 + i * 3, false))}
      {COLORS.map((c, i) => make(i, c, BEAT2 - 4 + i * 3, true))}
    </AbsoluteFill>
  );
}

function Confetti({ frame }: { frame: number }): React.ReactElement {
  const N = 70;
  const dots: React.ReactElement[] = [];
  for (let i = 0; i < N; i++) {
    const c = COLORS[i % COLORS.length];
    const x0 = rnd(i, 1) * 1920;
    const y0 = rnd(i, 2) * 1080;
    const rise = (frame * (0.4 + rnd(i, 5) * 0.9)) % 1160;
    const y = ((y0 - rise) % 1160 + 1160) % 1160 - 40;
    const wobble = Math.sin(frame / 18 + i) * 10;
    const o = interpolate(frame, [4, 18], [0, 0.5 + rnd(i, 6) * 0.4], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const s = 6 + rnd(i, 7) * 10;
    dots.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: x0 + wobble,
          top: y,
          width: s,
          height: s,
          borderRadius: rnd(i, 8) > 0.5 ? '50%' : 2,
          background: c,
          opacity: o,
          transform: `rotate(${frame * (1 + rnd(i, 9) * 3)}deg)`,
        }}
      />,
    );
  }
  return <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>{dots}</AbsoluteFill>;
}

function CreditLine({
  frame,
  at,
  exitAt,
  role,
  name,
}: {
  frame: number;
  at: number;
  exitAt: number;
  role: string;
  name: string;
}): React.ReactElement {
  const enter = interpolate(frame, [at, at + 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASING.out,
  });
  const exit = interpolate(frame, [exitAt, exitAt + 14], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASING.in,
  });
  const y = interpolate(frame, [at, at + 18], [18, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASING.out,
  });
  return (
    <div
      style={{
        opacity: enter * exit,
        transform: `translateY(${y}px)`,
        display: 'flex',
        alignItems: 'baseline',
        gap: 18,
      }}
    >
      <span style={{ fontFamily: FONTS.heading, fontSize: 40, fontWeight: 600, color: 'rgba(18,40,63,0.55)' }}>
        {role}
      </span>
      <span style={{ fontFamily: FONTS.heading, fontSize: 56, fontWeight: 800, letterSpacing: '0.01em', color: NAVY }}>
        {name}
      </span>
    </div>
  );
}

const StandpointEndcard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const whiteIn = interpolate(frame, [0, 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const whiteOut = interpolate(frame, [DUR - 12, DUR], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASING.in,
  });

  const CREDIT_EXIT = BEAT2 - 16;

  // beat 1 extras
  const ruleP = interpolate(frame, [52, 72], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out,
  });
  const ruleExit = interpolate(frame, [CREDIT_EXIT, CREDIT_EXIT + 14], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.in,
  });
  const disclaimerO =
    interpolate(frame, [64, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out }) *
    ruleExit;

  // beat 2: brand lockup
  const T_AT = BEAT2 + 14;
  const sp = spring({ frame: Math.max(0, frame - T_AT), fps, config: { damping: 14, stiffness: 220 } });
  const titleO = frame >= T_AT ? 1 : 0;
  const titleScale = 1.5 - 0.5 * sp;
  const rule2P = interpolate(frame, [T_AT + 12, T_AT + 32], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out,
  });
  const byO = interpolate(frame, [T_AT + 22, T_AT + 34], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out,
  });
  const byY = interpolate(frame, [T_AT + 22, T_AT + 36], [16, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out,
  });

  const breathe = 1 + 0.006 * Math.sin(frame / 14);

  return (
    <AbsoluteFill style={{ backgroundColor: '#FFFFFF' }}>
      <AbsoluteFill
        style={{ background: 'radial-gradient(ellipse at 50% 40%, #FFFFFF 0%, #FDF9F0 55%, #F7EFDF 100%)' }}
      />
      <Ribbons frame={frame} />
      <Confetti frame={frame} />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 47%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.75) 30%, transparent 58%)',
        }}
      />

      {/* Beat 1 — credits */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 34,
          transform: `scale(${breathe})`,
        }}
      >
        <CreditLine frame={frame} at={14} exitAt={CREDIT_EXIT} role="Script by" name="Prakhar Gupta" />
        <CreditLine frame={frame} at={32} exitAt={CREDIT_EXIT + 4} role="Creative Direction by" name="Raghavan S Rao" />
        <div style={{ display: 'flex', gap: 10, marginTop: 6, width: 620, justifyContent: 'center', opacity: ruleExit }}>
          {COLORS.map((c, i) => {
            const segP = Math.min(1, Math.max(0, ruleP * COLORS.length - i));
            return <div key={c} style={{ height: 8, borderRadius: 4, width: 88 * segP, background: c }} />;
          })}
        </div>
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 30,
            fontStyle: 'italic',
            color: 'rgba(18,40,63,0.5)',
            opacity: disclaimerO,
          }}
        >
          Images are for illustration purposes only.
        </span>
      </AbsoluteFill>

      {/* Beat 2 — brand sign-off */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${breathe})`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 170,
            fontWeight: 900,
            letterSpacing: '0.02em',
            color: NAVY,
            opacity: titleO,
            transform: `scale(${titleScale})`,
            lineHeight: 1,
          }}
        >
          STANDPOINT
        </span>
        <div style={{ display: 'flex', gap: 10, marginTop: 34, width: 760, justifyContent: 'center' }}>
          {COLORS.map((c, i) => {
            const segP = Math.min(1, Math.max(0, rule2P * COLORS.length - i));
            return <div key={c} style={{ height: 10, borderRadius: 5, width: 110 * segP, background: c }} />;
          })}
        </div>
        <div
          style={{
            opacity: byO,
            transform: `translateY(${byY}px)`,
            marginTop: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span style={{ fontFamily: FONTS.heading, fontSize: 44, fontWeight: 600, color: 'rgba(18,40,63,0.55)' }}>
            by
          </span>
          {/* official white wordmark — white-on-dark rule honoured via red chip */}
          <div style={{ display: 'inline-flex', alignItems: 'center', background: RED, borderRadius: 8, padding: '14px 26px' }}>
            <Img src={staticFile('images/swarajya_logo_white.png')} style={{ height: 46, width: 'auto', display: 'block' }} />
          </div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{ backgroundColor: '#FFFFFF', opacity: Math.max(whiteIn, whiteOut), pointerEvents: 'none' }}
      />
    </AbsoluteFill>
  );
};

export default StandpointEndcard;
