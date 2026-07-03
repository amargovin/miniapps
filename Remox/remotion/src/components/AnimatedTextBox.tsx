import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { MOTION } from '../theme';

interface AnimatedTextBoxProps {
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const AnimatedTextBox: React.FC<AnimatedTextBoxProps> = ({
  delay = 0,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - delay);

  // Border draw: 0 → 1 over ~15 frames
  const drawProgress = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fill fade: starts at frame 8 (while border is still drawing), completes at frame 18
  const fillOpacity = interpolate(localFrame, [8, 18], [0, 0.35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Content fade: appears after box is drawn
  const contentSpring = spring({
    frame: Math.max(0, localFrame - 12),
    fps,
    config: MOTION.springSnappy,
  });
  const contentOpacity = interpolate(contentSpring, [0, 1], [0, 1]);

  // Estimated perimeter for a large rect — exact pixel size unknown at render time.
  // Visual effect works regardless of actual dimensions; dashoffset just won't
  // reach exactly 0, but the draw-on effect reads correctly.
  const PERIMETER = 4000;
  const dashOffset = PERIMETER * (1 - drawProgress);

  return (
    <div
      style={{
        position: 'relative',
        ...style,
      }}
    >
      {/* SVG border draw — absolutely positioned over the full box */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="1"
          y="1"
          width="99.8%"
          height="99.8%"
          rx="16"
          ry="16"
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="2"
          strokeDasharray={PERIMETER}
          strokeDashoffset={dashOffset}
        />
      </svg>

      {/* Dark frosted fill — sits behind content, above SVG stacking order */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(0, 0, 0, ${fillOpacity})`,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 16,
        }}
      />

      {/* Content — sits on top with its own opacity spring */}
      <div style={{ position: 'relative', opacity: contentOpacity }}>
        {children}
      </div>
    </div>
  );
};
