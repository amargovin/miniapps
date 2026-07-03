import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { FONTS, MOTION } from '../theme';

interface BarDatum {
  label: string;
  value: number;
  color: string;
}

interface AnimatedBarChartProps {
  data: BarDatum[];
  orientation?: 'horizontal' | 'vertical';
  staggerDelay?: number;
  maxBarWidth?: number;
}

const BAR_HEIGHT = 48;
const BAR_GAP = 16;
const LABEL_WIDTH = 160;
const VALUE_WIDTH = 80;

const AnimatedBarChart: React.FC<AnimatedBarChartProps> = ({
  data,
  orientation = 'horizontal',
  staggerDelay = 6,
  maxBarWidth = 500,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const maxValue = Math.max(...data.map((d) => d.value));

  if (orientation === 'vertical') {
    // Vertical bar chart
    const barWidth = Math.min(maxBarWidth / data.length - 12, 80);
    const chartHeight = 300;
    const totalWidth = data.length * (barWidth + 12);

    return (
      <div style={{ display: 'inline-block' }}>
        <svg
          width={totalWidth + LABEL_WIDTH}
          height={chartHeight + 40}
          style={{ overflow: 'visible' }}
        >
          {data.map((d, i) => {
            const localFrame = Math.max(0, frame - i * staggerDelay);
            const progress = spring({ frame: localFrame, fps, config: MOTION.springSnappy });
            const barHeightPx = interpolate(progress, [0, 1], [0, (d.value / maxValue) * chartHeight], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const opacity = interpolate(progress, [0, 0.2], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            const x = i * (barWidth + 12);
            const y = chartHeight - barHeightPx;

            return (
              <g key={i} opacity={opacity}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeightPx}
                  fill={d.color}
                  rx={3}
                  ry={3}
                />
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  fontFamily={FONTS.body}
                  fontSize={14}
                  fill="currentColor"
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // Horizontal bar chart (default)
  const totalHeight = data.length * (BAR_HEIGHT + BAR_GAP) - BAR_GAP;
  const totalWidth = LABEL_WIDTH + maxBarWidth + VALUE_WIDTH + 16;

  return (
    <div style={{ display: 'inline-block' }}>
      <svg
        width={totalWidth}
        height={totalHeight}
        style={{ overflow: 'visible' }}
      >
        {data.map((d, i) => {
          const localFrame = Math.max(0, frame - i * staggerDelay);
          const progress = spring({ frame: localFrame, fps, config: MOTION.springSnappy });

          const barWidth = interpolate(progress, [0, 1], [0, (d.value / maxValue) * maxBarWidth], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          const opacity = interpolate(progress, [0, 0.2], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          const y = i * (BAR_HEIGHT + BAR_GAP);
          const barY = y + (BAR_HEIGHT - 32) / 2;

          return (
            <g key={i} opacity={opacity}>
              {/* Label on left */}
              <text
                x={LABEL_WIDTH - 12}
                y={y + BAR_HEIGHT / 2 + 6}
                textAnchor="end"
                fontFamily={FONTS.body}
                fontSize={18}
                fill="currentColor"
              >
                {d.label}
              </text>

              {/* Bar */}
              <rect
                x={LABEL_WIDTH}
                y={barY}
                width={barWidth}
                height={32}
                fill={d.color}
                rx={3}
                ry={3}
              />

              {/* Value on right */}
              <text
                x={LABEL_WIDTH + barWidth + 10}
                y={y + BAR_HEIGHT / 2 + 7}
                textAnchor="start"
                fontFamily={FONTS.heading}
                fontSize={20}
                fontWeight="bold"
                fill="currentColor"
              >
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default AnimatedBarChart;
