import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';
import AccentRule from './AccentRule';

interface TitleCardProps {
  label: string;
  title: string;
  bg?: string;
  labelColor?: string;
  titleColor?: string;
}

const TitleCard: React.FC<TitleCardProps> = ({
  label,
  title,
  bg = PALETTE.secondary,
  labelColor = PALETTE.primary,
  titleColor = '#FFFFFF',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Label entrance: frame 0
  const labelSpring = spring({ frame, fps, config: MOTION.springSnappy });
  const labelOpacity = interpolate(labelSpring, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelY = interpolate(labelSpring, [0, 1], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Title entrance: frame 16
  const titleLocalFrame = Math.max(0, frame - 16);
  const titleSpring = spring({ frame: titleLocalFrame, fps, config: MOTION.springSnappy });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleY = interpolate(titleSpring, [0, 1], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      }}
    >
      {/* Label */}
      <div
        style={{
          fontFamily: FONTS.heading,
          fontSize: 16,
          fontWeight: 700,
          color: labelColor,
          textTransform: 'uppercase',
          letterSpacing: '4px',
          opacity: labelOpacity,
          transform: `translateY(${labelY}px)`,
        }}
      >
        {label}
      </div>

      {/* Accent rule (delay 8 frames) */}
      <AccentRule delay={8} color={PALETTE.primary} width={60} thickness={4} />

      {/* Title */}
      <div
        style={{
          fontFamily: FONTS.heading,
          fontSize: 52,
          fontWeight: 700,
          color: titleColor,
          textAlign: 'center',
          maxWidth: '80%',
          lineHeight: 1.15,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {title}
      </div>
    </AbsoluteFill>
  );
};

export default TitleCard;
