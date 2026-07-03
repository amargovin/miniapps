import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// Liquid Vessels: Four illustrated beaker/flask SVGs on a shelf, filling with
// colored liquid to different levels. Same stagger timing and spring physics as
// bar-chart pattern, but depicted as physical objects in an environment.
// Labels etched on the shelf surface, not floating as UI text.

const VESSEL_STAGGER_FRAMES = 8;
const SHELF_APPEAR_FRAMES = 15;

const vessels = [
  { label: 'Battery Cells',    value: 77, color: '#3a7ca5' },
  { label: 'Cathode Material', value: 68, color: '#5a9ec4' },
  { label: 'Anode Material',   value: 54, color: '#7bb8d4' },
  { label: 'Electrolyte',      value: 43, color: '#9dd0e4' },
];

// Vessel dimensions
const VESSEL_W = 160;
const VESSEL_H = 340;
const VESSEL_GAP = 80;
const SHELF_Y = 680;  // Y position of shelf surface
const GLASS_STROKE = '#8a9aaa';
const GLASS_FILL = 'rgba(200,220,235,0.08)';

// Beaker SVG: a flat-bottom flask shape with measurement marks
const Beaker: React.FC<{
  x: number;
  fillPercent: number;
  color: string;
  opacity: number;
}> = ({ x, fillPercent, color, opacity }) => {
  const innerH = VESSEL_H - 40; // internal fill area height
  const fillH = (fillPercent / 100) * innerH;
  const fillY = SHELF_Y - 20 - fillH; // bottom of vessel minus fill height

  // Beaker shape: slight taper at top (neck), wider body
  const bodyLeft = x + 10;
  const bodyRight = x + VESSEL_W - 10;
  const neckLeft = x + 30;
  const neckRight = x + VESSEL_W - 30;
  const top = SHELF_Y - VESSEL_H;
  const bottom = SHELF_Y - 4;
  const neckH = 50;

  const beakerPath = `
    M ${neckLeft} ${top}
    L ${neckLeft} ${top + neckH}
    Q ${bodyLeft} ${top + neckH + 20} ${bodyLeft} ${top + neckH + 40}
    L ${bodyLeft} ${bottom}
    Q ${bodyLeft} ${bottom + 6} ${bodyLeft + 8} ${bottom + 6}
    L ${bodyRight - 8} ${bottom + 6}
    Q ${bodyRight} ${bottom + 6} ${bodyRight} ${bottom}
    L ${bodyRight} ${top + neckH + 40}
    Q ${bodyRight} ${top + neckH + 20} ${neckRight} ${top + neckH}
    L ${neckRight} ${top}
  `;

  // Liquid shape: fills inside the beaker body
  const liquidTop = fillY;
  const liquidBottom = bottom;

  // Clamp liquid to beaker body bounds
  const clampedTop = Math.max(liquidTop, top + neckH + 40);

  return (
    <g opacity={opacity}>
      {/* Glass body */}
      <path
        d={beakerPath}
        fill={GLASS_FILL}
        stroke={GLASS_STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />

      {/* Measurement marks on left side */}
      {[0.25, 0.5, 0.75].map((pct) => {
        const markY = bottom - pct * innerH;
        return (
          <line
            key={pct}
            x1={bodyLeft + 4}
            y1={markY}
            x2={bodyLeft + 18}
            y2={markY}
            stroke={GLASS_STROKE}
            strokeWidth={1.5}
            opacity={0.5}
          />
        );
      })}

      {/* Liquid fill */}
      {fillPercent > 0 && (
        <rect
          x={bodyLeft + 3}
          y={clampedTop}
          width={bodyRight - bodyLeft - 6}
          height={Math.max(0, liquidBottom - clampedTop)}
          fill={color}
          rx={4}
          opacity={0.85}
        />
      )}

      {/* Liquid surface — slight meniscus highlight */}
      {fillPercent > 2 && (
        <ellipse
          cx={x + VESSEL_W / 2}
          cy={clampedTop}
          rx={(bodyRight - bodyLeft - 6) / 2}
          ry={4}
          fill={color}
          opacity={0.6}
        />
      )}

      {/* Rim highlight */}
      <line
        x1={neckLeft}
        y1={top}
        x2={neckRight}
        y2={top}
        stroke={GLASS_STROKE}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </g>
  );
};

export default function LiquidVessels() {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // Center the vessel group
  const totalW = vessels.length * VESSEL_W + (vessels.length - 1) * VESSEL_GAP;
  const startX = (width - totalW) / 2;

  // Shelf and environment entrance
  const shelfProgress = spring({
    frame,
    fps,
    config: MOTION.springOverdamped,
    from: 0,
    to: 1,
  });
  const shelfOpacity = interpolate(frame, [0, SHELF_APPEAR_FRAMES], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Title
  const titleOpacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background: subtle workshop environment */}
        {/* Back wall with slight texture gradient */}
        <rect x={0} y={0} width={width} height={SHELF_Y - VESSEL_H - 40} fill={PALETTE.bg} />
        <rect
          x={0}
          y={SHELF_Y - VESSEL_H - 40}
          width={width}
          height={VESSEL_H + 140}
          fill="url(#wallGradient)"
          opacity={shelfOpacity}
        />

        <defs>
          <linearGradient id="wallGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.bg} />
            <stop offset="100%" stopColor="#e8e4dd" />
          </linearGradient>
        </defs>

        {/* Shelf — a thick wooden plank with shadow */}
        <g opacity={shelfOpacity}>
          {/* Shelf shadow */}
          <rect
            x={startX - 60}
            y={SHELF_Y + 16}
            width={totalW + 120}
            height={8}
            rx={4}
            fill="rgba(0,0,0,0.08)"
          />
          {/* Shelf surface */}
          <rect
            x={startX - 60}
            y={SHELF_Y}
            width={totalW + 120}
            height={20}
            rx={3}
            fill="#8B7355"
          />
          {/* Wood grain highlight */}
          <rect
            x={startX - 60}
            y={SHELF_Y}
            width={totalW + 120}
            height={6}
            rx={3}
            fill="rgba(255,255,255,0.15)"
          />
          {/* Shelf bracket left */}
          <rect
            x={startX - 30}
            y={SHELF_Y + 20}
            width={12}
            height={40}
            rx={2}
            fill="#6B5B45"
          />
          {/* Shelf bracket right */}
          <rect
            x={startX + totalW + 18}
            y={SHELF_Y + 20}
            width={12}
            height={40}
            rx={2}
            fill="#6B5B45"
          />
        </g>

        {/* Vessels */}
        {vessels.map((v, i) => {
          const vesselStartFrame = SHELF_APPEAR_FRAMES + i * VESSEL_STAGGER_FRAMES;

          const fillProgress = spring({
            frame: frame - vesselStartFrame,
            fps,
            config: MOTION.springOverdamped,
            from: 0,
            to: 1,
          });

          const vesselOpacity = interpolate(
            frame,
            [vesselStartFrame - 5, vesselStartFrame + 5],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          const currentFill = v.value * fillProgress;
          const displayValue = Math.round(v.value * fillProgress);
          const x = startX + i * (VESSEL_W + VESSEL_GAP);

          // Value label opacity — appears when vessel is >80% filled
          const valueFade = interpolate(fillProgress, [0.8, 1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <g key={i}>
              <Beaker
                x={x}
                fillPercent={currentFill}
                color={v.color}
                opacity={vesselOpacity}
              />

              {/* Value label — etched style above vessel */}
              <text
                x={x + VESSEL_W / 2}
                y={SHELF_Y - VESSEL_H - 20}
                textAnchor="middle"
                fontFamily={FONTS.mono}
                fontSize={32}
                fontWeight={700}
                fill={v.color}
                opacity={valueFade * vesselOpacity}
              >
                {displayValue}%
              </text>

              {/* Label — etched on shelf surface */}
              <text
                x={x + VESSEL_W / 2}
                y={SHELF_Y + 52}
                textAnchor="middle"
                fontFamily={FONTS.heading}
                fontSize={20}
                fontWeight={600}
                fill="#5a4a3a"
                opacity={vesselOpacity * 0.85}
                letterSpacing="0.5px"
              >
                {v.label}
              </text>
            </g>
          );
        })}

        {/* Title — stenciled on the wall above the shelf */}
        <text
          x={width / 2}
          y={SHELF_Y - VESSEL_H - 80}
          textAnchor="middle"
          fontFamily={FONTS.heading}
          fontSize={36}
          fontWeight={700}
          fill={PALETTE.primary}
          opacity={titleOpacity}
          letterSpacing="1.5px"
        >
          China Import Dependency
        </text>
      </svg>
    </AbsoluteFill>
  );
}
