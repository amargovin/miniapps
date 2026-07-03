import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

interface HighlightTextProps {
  text: string;
  highlightColor?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  delay?: number;
}

const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  highlightColor = `rgba(206, 81, 82, 0.25)`,
  fontSize = 40,
  fontWeight = 700,
  color = PALETTE.text,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - delay);

  const textSpring = spring({
    frame: localFrame,
    fps,
    config: MOTION.springSnappy,
  });

  const textOpacity = interpolate(textSpring, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const highlightWidthSpring = spring({
    frame: Math.max(0, localFrame - 4),
    fps,
    config: MOTION.springSnappy,
  });

  const highlightWidth = interpolate(highlightWidthSpring, [0, 1], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        fontFamily: FONTS.body,
        fontSize,
        fontWeight,
        color,
        opacity: textOpacity,
      }}
    >
      {/* Highlight rectangle behind text */}
      <span
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '35%',
          width: `${highlightWidth}%`,
          backgroundColor: highlightColor,
          zIndex: 0,
        }}
      />
      {/* Text on top */}
      <span style={{ position: 'relative', zIndex: 1 }}>{text}</span>
    </span>
  );
};

export default HighlightText;
