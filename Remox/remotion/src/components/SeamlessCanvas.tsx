import React from 'react';
import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface SeamlessCanvasProps {
  imageSrc: string;
  imagePosition?: 'left' | 'right';
  imageBg: string;
  imageSplit?: number;
  kenBurnsScale?: number;
  children: React.ReactNode;
}

const SeamlessCanvas: React.FC<SeamlessCanvasProps> = ({
  imageSrc,
  imagePosition = 'left',
  imageBg,
  imageSplit = 0.55,
  kenBurnsScale = 1.07,
  children,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1.0, kenBurnsScale], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const imagePanel = (
    <div
      style={{
        width: `${imageSplit * 100}%`,
        height: '100%',
        overflow: 'hidden',
        backgroundColor: imageBg,
        flexShrink: 0,
      }}
    >
      <Img
        src={staticFile(imageSrc)}
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

  const textPanel = (
    <div
      style={{
        flex: 1,
        backgroundColor: imageBg,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 64px',
      }}
    >
      {children}
    </div>
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: imagePosition === 'left' ? 'row' : 'row-reverse',
      }}
    >
      {imagePanel}
      {textPanel}
    </div>
  );
};

export default SeamlessCanvas;
