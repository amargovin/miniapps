import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { FONTS, MOTION } from '../theme';

interface DataPoint {
  x: string | number;
  y: number;
}

interface AnimatedLineChartProps {
  data: DataPoint[];
  color: string;
  lineWidth?: number;
  showDots?: boolean;
  showLabels?: boolean;
}

const PADDING = { top: 24, right: 24, bottom: 48, left: 48 };
const CHART_W = 600;
const CHART_H = 320;

const AnimatedLineChart: React.FC<AnimatedLineChartProps> = ({
  data,
  color,
  lineWidth = 3,
  showDots = true,
  showLabels = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const innerW = CHART_W - PADDING.left - PADDING.right;
  const innerH = CHART_H - PADDING.top - PADDING.bottom;

  const minY = Math.min(...data.map((d) => d.y));
  const maxY = Math.max(...data.map((d) => d.y));
  const yRange = maxY - minY || 1;

  const toSvgX = (i: number) => (i / (data.length - 1)) * innerW;
  const toSvgY = (y: number) => innerH - ((y - minY) / yRange) * innerH;

  const points = data.map((d, i) => ({
    svgX: toSvgX(i),
    svgY: toSvgY(d.y),
    label: String(d.x),
    value: d.y,
  }));

  // Build SVG path string
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.svgX} ${p.svgY}`)
    .join(' ');

  // Approximate path length via point-to-point distances
  let pathLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].svgX - points[i - 1].svgX;
    const dy = points[i].svgY - points[i - 1].svgY;
    pathLength += Math.sqrt(dx * dx + dy * dy);
  }

  // Line draw: 0 → 70% of durationInFrames
  const drawEndFrame = Math.floor(durationInFrames * 0.7);
  const lineProgress = interpolate(frame, [0, drawEndFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const strokeDashoffset = interpolate(lineProgress, [0, 1], [pathLength, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const gridColor = 'rgba(0,0,0,0.1)';

  return (
    <div style={{ display: 'inline-block' }}>
      <svg
        width={CHART_W}
        height={CHART_H}
        style={{ overflow: 'visible' }}
      >
        <g transform={`translate(${PADDING.left}, ${PADDING.top})`}>
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={0}
              y1={innerH * (1 - t)}
              x2={innerW}
              y2={innerH * (1 - t)}
              stroke={gridColor}
              strokeWidth={1}
            />
          ))}

          {/* Animated line */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth={lineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength}
            strokeDashoffset={strokeDashoffset}
          />

          {/* Dots */}
          {showDots &&
            points.map((p, i) => {
              // Dot appears when the line has reached this point
              const pointFraction = i / (points.length - 1);
              const dotAppearProgress = interpolate(
                lineProgress,
                [Math.max(0, pointFraction - 0.05), pointFraction],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );
              const dotSpring = spring({
                frame: Math.max(0, frame - Math.floor(drawEndFrame * pointFraction)),
                fps,
                config: MOTION.springBouncy,
              });
              const dotScale = interpolate(dotSpring, [0, 1], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              return (
                <circle
                  key={i}
                  cx={p.svgX}
                  cy={p.svgY}
                  r={5 * dotScale}
                  fill={color}
                  opacity={dotAppearProgress}
                />
              );
            })}

          {/* X-axis labels */}
          {showLabels &&
            points.map((p, i) => (
              <text
                key={i}
                x={p.svgX}
                y={innerH + 28}
                textAnchor="middle"
                fontFamily={FONTS.body}
                fontSize={13}
                fill="currentColor"
                opacity={0.7}
              >
                {p.label}
              </text>
            ))}
        </g>
      </svg>
    </div>
  );
};

export default AnimatedLineChart;
