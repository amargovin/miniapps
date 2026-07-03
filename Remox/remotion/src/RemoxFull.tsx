import React from 'react';
import { AbsoluteFill, Sequence, Audio, staticFile } from 'remotion';
import registry from './SceneRegistry';

interface SceneEntry {
  id: string;
  audio?: string;
  durationFrames: number;
}

interface RemoxFullProps {
  scenes: SceneEntry[];
}

export const RemoxFull: React.FC<RemoxFullProps> = ({ scenes }) => {
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {scenes.map((scene) => {
        const SceneComponent = registry[scene.id];
        const from = currentFrame;
        currentFrame += scene.durationFrames;

        if (!SceneComponent) return null;

        return (
          <React.Fragment key={scene.id}>
            <Sequence from={from} durationInFrames={scene.durationFrames}>
              <SceneComponent />
            </Sequence>
            {scene.audio && (
              <Sequence from={from} durationInFrames={scene.durationFrames}>
                <Audio src={staticFile(scene.audio)} volume={1} />
              </Sequence>
            )}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
