import { PALETTE, FONTS } from './theme';
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import registry from './SceneRegistry';

interface RemoxSceneProps {
  sceneId: string;
  audioFile?: string;
  durationInFrames: number;
}


// ── CornerBug — alternating show/channel bug (user spec, 2026-07-04) ─────────
// Cycles every 10s (300f): "STANDPOINT" chip ⇄ #SWARAJYA badge.
// Quiet broadcast swap: 12f slide-fade; persistent UI, no attention grabs.
const CornerBug: React.FC = () => {
  const frame = useCurrentFrame();
  const CYCLE = 300;
  const SWAP = 12;
  const phase = frame % (CYCLE * 2);
  const inB = phase >= CYCLE;
  const t = phase % CYCLE;
  // transition progress at the start of each half
  const p = Math.min(1, t / SWAP);
  const easeP = 1 - Math.pow(1 - p, 3);

  const outY = -14 * easeP;
  const inY = 14 * (1 - easeP);
  const aOpacity = inB ? 1 - easeP : easeP;
  const bOpacity = inB ? easeP : 1 - easeP;
  const aY = inB ? outY : inY;
  const bY = inB ? inY : outY;

  return (
    <div style={{ position: 'absolute', top: 90, right: 78, width: 300, height: 76, pointerEvents: 'none' }}>
      {/* A — STANDPOINT chip */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          opacity: aOpacity * 0.92,
          transform: `translateY(${aY}px)`,
          background: 'linear-gradient(180deg, #DA544E 0%, #C4373B 52%, #A32B2F 100%)',
          borderRadius: 6,
          padding: '14px 22px',
          boxShadow:
            'inset 0 2px 0 rgba(255,255,255,0.38), inset 0 -2px 0 rgba(0,0,0,0.28), 0 7px 20px rgba(8,16,25,0.45)',
          overflow: 'hidden',
        }}
      >
        {/* periodic gloss sweep — once per cycle, quiet */}
        <div
          style={{
            position: 'absolute',
            top: -20,
            bottom: -20,
            width: 46,
            left: -80 + ((frame % 300) / 300) * 460,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.32) 50%, transparent 100%)',
            transform: 'rotate(16deg)',
          }}
        />
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: '#FFFFFF',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            textShadow: '0 1px 0 rgba(0,0,0,0.28)',
            position: 'relative',
          }}
        >
          STANDPOINT
        </span>
      </div>
      {/* B — by #SWARAJYA badge */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          opacity: bOpacity * 0.92,
          transform: `translateY(${bY}px)`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 26,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.85)',
            textShadow: '0 1px 8px rgba(0,0,0,0.45)',
          }}
        >
          by
        </span>
        <Img src={staticFile('images/logo.png')} style={{ width: 200, height: 'auto', display: 'block', filter: 'drop-shadow(0 6px 16px rgba(8,16,25,0.42))' }} />
      </div>
    </div>
  );
};

const FADE_FRAMES = 5; // brief fade in/out for inter-scene transitions
const AUDIO_FADE_FRAMES = 10; // slightly longer audio fade for smoother transitions

export const RemoxScene: React.FC<RemoxSceneProps> = ({ sceneId, audioFile, durationInFrames }) => {
  const frame = useCurrentFrame();
  const SceneComponent = registry[sceneId];

  // Audio volume envelope — fade out only over last AUDIO_FADE_FRAMES (no fade-in)
  const audioVolume = (f: number) => {
    return interpolate(f, [durationInFrames - AUDIO_FADE_FRAMES, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
  };

  if (!SceneComponent) {
    return (
      <AbsoluteFill style={{ backgroundColor: PALETTE.bg /* film base colour — never black-blink on bright films (LEARNINGS §50) */, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#ff3366', fontSize: 48, fontFamily: 'monospace' }}>
          Scene not found: {sceneId}
        </span>
      </AbsoluteFill>
    );
  }

  // Fade envelope: fade in first N frames, fade out last N frames
  const fadeIn = interpolate(frame, [0, FADE_FRAMES], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [durationInFrames - FADE_FRAMES, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
  const envelope = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.bg /* film base colour — never black-blink on bright films (LEARNINGS §50) */ }}>
      <AbsoluteFill style={{ opacity: envelope }}>
        <SceneComponent />
        {sceneId !== 'Scene12' && sceneId !== 'Scene14' && sceneId !== 'Closer' && sceneId !== 'Credits' && sceneId !== 'SceneIntro' && sceneId !== 'SceneCloser' && sceneId !== 'SceneEndcard' && (
          <CornerBug />
        )}
      </AbsoluteFill>
      {audioFile && <Audio src={staticFile(audioFile)} volume={audioVolume} />}
    </AbsoluteFill>
  );
};
