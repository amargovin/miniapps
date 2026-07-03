import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

interface LowerThirdProps {
  name: string;
  title: string;
  accentColor?: string;
  startFrame?: number;
  exitFrame?: number;
}

const LowerThird: React.FC<LowerThirdProps> = ({
  name,
  title,
  accentColor = PALETTE.primary,
  startFrame = 0,
  exitFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  // Accent bar: slides in from left, 15 frames
  const barSpring = spring({ frame: localFrame, fps, config: MOTION.springSnappy });
  const barX = interpolate(barSpring, [0, 1], [-40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const barOpacity = interpolate(barSpring, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Name: delay 8 from startFrame
  const nameLocalFrame = Math.max(0, frame - (startFrame + 8));
  const nameSpring = spring({ frame: nameLocalFrame, fps, config: MOTION.springSnappy });
  const nameY = interpolate(nameSpring, [0, 1], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const nameOpacity = interpolate(nameSpring, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Job title: delay 13 from startFrame
  const titleLocalFrame = Math.max(0, frame - (startFrame + 13));
  const titleSpring = spring({ frame: titleLocalFrame, fps, config: MOTION.springSnappy });
  const titleY = interpolate(titleSpring, [0, 1], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Exit animation (reverse entrance)
  let exitScale = 1;
  let exitOpacity = 1;
  if (exitFrame !== undefined) {
    const exitLocalFrame = Math.max(0, frame - exitFrame);
    const exitSpring = spring({ frame: exitLocalFrame, fps, config: MOTION.springSnappy });
    exitOpacity = interpolate(exitSpring, [0, 1], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    exitScale = interpolate(exitSpring, [0, 1], [1, 0.95], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          left: 80,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          opacity: exitOpacity,
          transform: `scale(${exitScale})`,
          transformOrigin: 'left bottom',
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            width: 6,
            height: 56,
            backgroundColor: accentColor,
            borderRadius: 3,
            flexShrink: 0,
            transform: `translateX(${barX}px)`,
            opacity: barOpacity,
          }}
        />

        {/* Text content with semi-transparent backing */}
        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: 4,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {/* Name */}
          <div
            style={{
              fontFamily: FONTS.heading,
              fontSize: 36,
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1.1,
              opacity: nameOpacity,
              transform: `translateY(${nameY}px)`,
            }}
          >
            {name}
          </div>

          {/* Job title */}
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 22,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.2,
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
            }}
          >
            {title}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default LowerThird;
