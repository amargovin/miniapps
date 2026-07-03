import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { PALETTE, MOTION } from '../theme';

interface AccentRuleProps {
  width?: number;
  color?: string;
  thickness?: number;
  delay?: number;
}

const AccentRule: React.FC<AccentRuleProps> = ({
  width = 60,
  color = PALETTE.primary,
  thickness = 4,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - delay);

  const progress = spring({
    frame: localFrame,
    fps,
    config: MOTION.springOverdamped,
  });

  const drawnWidth = interpolate(progress, [0, 1], [0, width], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <svg
      width={width}
      height={thickness}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <line
        x1={0}
        y1={thickness / 2}
        x2={drawnWidth}
        y2={thickness / 2}
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
      />
    </svg>
  );
};

export default AccentRule;
