import React from 'react';
import { AbsoluteFill } from 'remotion';

interface MotionGraphicsProps {
  bg: string;
  children: React.ReactNode;
}

const MotionGraphics: React.FC<MotionGraphicsProps> = ({ bg, children }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        padding: 80,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export default MotionGraphics;
