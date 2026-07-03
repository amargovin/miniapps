import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { PALETTE, FONTS } from '../theme';

type FormatType = 'comma' | 'short' | 'currency';

function formatNumber(value: number, format?: FormatType, prefix?: string, suffix?: string): string {
  let formatted: string;

  if (format === 'comma') {
    formatted = Math.round(value).toLocaleString('en-US');
  } else if (format === 'short') {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) {
      formatted = (value / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    } else if (abs >= 1_000_000) {
      formatted = (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (abs >= 1_000) {
      formatted = (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    } else {
      formatted = String(Math.round(value));
    }
  } else if (format === 'currency') {
    formatted = '$' + Math.round(value).toLocaleString('en-US');
  } else {
    formatted = String(Math.round(value));
  }

  return (prefix ?? '') + formatted + (suffix ?? '');
}

interface NumberCounterProps {
  target: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  format?: FormatType;
  fontSize?: number;
  color?: string;
}

const NumberCounter: React.FC<NumberCounterProps> = ({
  target,
  duration = 60,
  prefix,
  suffix,
  format,
  fontSize = 96,
  color = PALETTE.text,
}) => {
  const frame = useCurrentFrame();

  const current = interpolate(frame, [0, duration], [0, target], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const displayText = formatNumber(current, format, prefix, suffix);

  return (
    <span
      style={{
        fontFamily: FONTS.heading,
        fontSize,
        fontWeight: 700,
        color,
        lineHeight: 1,
        display: 'inline-block',
      }}
    >
      {displayText}
    </span>
  );
};

export default NumberCounter;
