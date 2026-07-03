import React from 'react';
import { Img, staticFile, spring, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

interface ImageItem {
  src: string;
  durationInFrames: number;
  kenBurnsEnd?: number;
}

interface RapidCutProps {
  images: ImageItem[];
  transition?: 'cut' | 'fast-fade';
}

interface KenBurnsImageProps {
  src: string;
  kenBurnsEnd: number;
  durationInFrames: number;
}

const KenBurnsImage: React.FC<KenBurnsImageProps> = ({ src, kenBurnsEnd, durationInFrames }) => {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [0, durationInFrames], [1.0, kenBurnsEnd], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <Img
        src={staticFile(src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  );
};

const RapidCut: React.FC<RapidCutProps> = ({
  images,
  transition = 'fast-fade',
}) => {
  const transitionDuration = transition === 'fast-fade' ? 4 : 0;

  return (
    <TransitionSeries>
      {images.map((img, i) => {
        const kenBurnsEnd = img.kenBurnsEnd ?? 1.05;

        return (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={img.durationInFrames}>
              <KenBurnsImage
                src={img.src}
                kenBurnsEnd={kenBurnsEnd}
                durationInFrames={img.durationInFrames}
              />
            </TransitionSeries.Sequence>
            {i < images.length - 1 && transitionDuration > 0 && (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={linearTiming({ durationInFrames: transitionDuration })}
              />
            )}
          </React.Fragment>
        );
      })}
    </TransitionSeries>
  );
};

export default RapidCut;
