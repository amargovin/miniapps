import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import registry from './SceneRegistry';

interface RemoxSceneProps {
  sceneId: string;
  audioFile?: string;
  durationInFrames: number;
}

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
      <AbsoluteFill style={{ backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill style={{ opacity: envelope }}>
        <SceneComponent />
        {sceneId !== 'Scene12' && sceneId !== 'Scene14' && sceneId !== 'Closer' && sceneId !== 'Credits' && (
          <Img
            src={staticFile('images/logo.png')}
            style={{
              position: 'absolute',
              top: 90,
              right: 78,
              width: 229,
              height: 'auto',
              opacity: 0.85,
              pointerEvents: 'none',
            }}
          />
        )}
      </AbsoluteFill>
      {audioFile && <Audio src={staticFile(audioFile)} volume={audioVolume} />}
    </AbsoluteFill>
  );
};
