import React from 'react';
import { Composition } from 'remotion';
import { RemoxScene } from './RemoxScene';
import { RemoxFull } from './RemoxFull';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="RemoxScene"
        component={RemoxScene}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        defaultProps={{
          sceneId: 'Scene01',
          audioFile: '',
          durationInFrames: 150,
        }}
        calculateMetadata={async ({ props }) => {
          return {
            durationInFrames: (props as any).durationInFrames || 150,
            width: (props as any).width || 1920,
            height: (props as any).height || 1080,
            props,
          };
        }}
      />
      <Composition
        id="RemoxFull"
        component={RemoxFull}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={300}
        defaultProps={{
          scenes: [],
        }}
        calculateMetadata={async ({ props }) => {
          const scenes = (props as any).scenes || [];
          const totalFrames = scenes.reduce((sum: number, s: any) => sum + (s.durationFrames || 0), 0);
          return {
            durationInFrames: totalFrames || 300,
            width: (props as any).width || 1920,
            height: (props as any).height || 1080,
            props,
          };
        }}
      />
    </>
  );
};
