import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';
import NumberCounter from './NumberCounter';

type FormatType = 'comma' | 'short' | 'currency';

interface StatCardProps {
  number: number;
  label: string;
  prefix?: string;
  suffix?: string;
  format?: FormatType;
  bg?: string;
  accentColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  number,
  label,
  prefix,
  suffix,
  format,
  bg = PALETTE.secondary,
  accentColor = PALETTE.primary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entranceSpring = spring({
    frame,
    fps,
    config: MOTION.springSnappy,
  });

  const scale = interpolate(entranceSpring, [0, 1], [0.9, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(entranceSpring, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        borderRadius: 8,
        padding: '40px 48px',
        transform: `scale(${scale})`,
        opacity,
        gap: 16,
      }}
    >
      <NumberCounter
        target={number}
        prefix={prefix}
        suffix={suffix}
        format={format}
        color={accentColor}
      />
      <span
        style={{
          fontFamily: FONTS.body,
          fontSize: 16,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.85)',
          textTransform: 'uppercase',
          letterSpacing: '2px',
        }}
      >
        {label}
      </span>
    </div>
  );
};

export default StatCard;
