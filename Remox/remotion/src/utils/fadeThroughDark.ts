import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { TransitionPresentation } from '@remotion/transitions';

export const fadeThroughDark = (): TransitionPresentation<Record<string, never>> => ({
  component: ({ children, presentationProgress, presentationDirection }) => {
    const opacity = presentationDirection === 'entering'
      ? interpolate(presentationProgress, [0.5, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : interpolate(presentationProgress, [0, 0.5], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    return React.createElement(AbsoluteFill, { style: { opacity } },
      children,
      React.createElement(AbsoluteFill, {
        style: {
          background: '#000',
          opacity: interpolate(
            presentationProgress,
            [0, 0.5, 1],
            presentationDirection === 'entering' ? [1, 0, 0] : [0, 0, 1],
          ),
        },
      }),
    );
  },
  props: {},
});
