import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// Two Worlds: Two illustrated factory environments side-by-side.
// Left: optimistic, lit factory with smoke and an EV (green tones).
// Right: same factory but dark, idle, with cracks (amber tones).
// Same split-point spring animation (50/50 → 30/70) as split-reveal,
// but rendered as illustrated scenes, not colored <div> panels.
// Labels painted/stenciled on the scene surfaces.

const SPLIT_APPEAR = 5;
const SHIFT_START = 30;

// --- SVG Factory Components ---

const SmokePuff: React.FC<{
  cx: number; cy: number; r: number; delay: number; active: boolean;
}> = ({ cx, cy, r, delay, active }) => {
  const frame = useCurrentFrame();
  if (!active) return null;
  const cycle = ((frame + delay * 10) % 90) / 90; // 0→1 over 3s
  const puffY = cy - cycle * 80;
  const puffOpacity = interpolate(cycle, [0, 0.3, 1], [0, 0.35, 0], {
    extrapolateRight: 'clamp',
  });
  const puffR = r + cycle * 15;
  return <circle cx={cx} cy={puffY} r={puffR} fill="#b0b8c0" opacity={puffOpacity} />;
};

const Factory: React.FC<{
  x: number; y: number; w: number; h: number;
  lit: boolean; opacity: number;
}> = ({ x, y, w, h, lit, opacity: groupOpacity }) => {
  const frame = useCurrentFrame();

  // Building colors
  const wallColor = lit ? '#4a6a8a' : '#3a3a40';
  const roofColor = lit ? '#3a5a7a' : '#2a2a30';
  const windowColor = lit ? '#f0d060' : '#1a1a20';
  const doorColor = lit ? '#5a8aaa' : '#2a2a30';
  const chimneyColor = lit ? '#5a5a60' : '#3a3a3a';
  const groundColor = lit ? '#6a8a5a' : '#4a4a3a';

  // Factory dimensions relative to container
  const bx = x + w * 0.1;
  const by = y + h * 0.25;
  const bw = w * 0.8;
  const bh = h * 0.5;

  // Chimney
  const chW = bw * 0.12;
  const chH = bh * 0.6;
  const chX = bx + bw * 0.7;
  const chY = by - chH;

  return (
    <g opacity={groupOpacity}>
      {/* Ground */}
      <rect x={x} y={by + bh} width={w} height={h - (by + bh - y)} fill={groundColor} />

      {/* Chimney */}
      <rect x={chX} y={chY} width={chW} height={chH + 4} fill={chimneyColor} rx={2} />
      <rect x={chX - 4} y={chY} width={chW + 8} height={8} fill={chimneyColor} rx={2} />

      {/* Smoke puffs */}
      <SmokePuff cx={chX + chW / 2} cy={chY - 5} r={8} delay={0} active={lit} />
      <SmokePuff cx={chX + chW / 2 - 8} cy={chY - 5} r={6} delay={3} active={lit} />
      <SmokePuff cx={chX + chW / 2 + 10} cy={chY - 5} r={10} delay={6} active={lit} />

      {/* Main building */}
      <rect x={bx} y={by} width={bw} height={bh} fill={wallColor} rx={4} />

      {/* Roof — angled shape */}
      <polygon
        points={`${bx - 8},${by} ${bx + bw / 2},${by - 30} ${bx + bw + 8},${by}`}
        fill={roofColor}
      />

      {/* Windows — 2 rows of 3 */}
      {[0.2, 0.45, 0.7].map((px) =>
        [0.2, 0.55].map((py) => (
          <rect
            key={`${px}-${py}`}
            x={bx + bw * px}
            y={by + bh * py}
            width={bw * 0.15}
            height={bh * 0.18}
            fill={windowColor}
            rx={2}
          />
        )),
      )}

      {/* Door */}
      <rect
        x={bx + bw * 0.4}
        y={by + bh * 0.6}
        width={bw * 0.2}
        height={bh * 0.4}
        fill={doorColor}
        rx={3}
      />

      {/* Cracks on dark factory */}
      {!lit && (
        <g opacity={0.4}>
          <line x1={bx + bw * 0.15} y1={by + bh * 0.3} x2={bx + bw * 0.25} y2={by + bh * 0.6} stroke="#666" strokeWidth={2} />
          <line x1={bx + bw * 0.25} y1={by + bh * 0.6} x2={bx + bw * 0.2} y2={by + bh * 0.75} stroke="#666" strokeWidth={1.5} />
          <line x1={bx + bw * 0.6} y1={by + bh * 0.1} x2={bx + bw * 0.65} y2={by + bh * 0.35} stroke="#666" strokeWidth={2} />
        </g>
      )}

      {/* EV car in front of lit factory */}
      {lit && (
        <g>
          {/* Car body */}
          <rect
            x={bx + bw * 0.15}
            y={by + bh - 30}
            width={bw * 0.35}
            height={20}
            fill="#5aaa7a"
            rx={6}
          />
          {/* Car cabin */}
          <rect
            x={bx + bw * 0.22}
            y={by + bh - 44}
            width={bw * 0.2}
            height={18}
            fill="#4a9a6a"
            rx={5}
          />
          {/* Wheels */}
          <circle cx={bx + bw * 0.22} cy={by + bh - 8} r={8} fill="#333" />
          <circle cx={bx + bw * 0.42} cy={by + bh - 8} r={8} fill="#333" />
          {/* Charging bolt symbol */}
          <text
            x={bx + bw * 0.3}
            y={by + bh - 18}
            fontSize={14}
            fill="#f0d060"
            textAnchor="middle"
            fontWeight={700}
          >
            ⚡
          </text>
        </g>
      )}

      {/* Cobwebs on dark factory */}
      {!lit && (
        <g opacity={0.25}>
          <path
            d={`M ${bx + bw * 0.8} ${by + bh * 0.15} Q ${bx + bw * 0.9} ${by + bh * 0.25} ${bx + bw - 2} ${by + bh * 0.1}`}
            fill="none"
            stroke="#888"
            strokeWidth={1}
          />
          <path
            d={`M ${bx + bw * 0.82} ${by + bh * 0.15} L ${bx + bw * 0.88} ${by + bh * 0.05}`}
            fill="none"
            stroke="#888"
            strokeWidth={0.8}
          />
        </g>
      )}
    </g>
  );
};

export default function TwoWorlds() {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // --- Split point: starts at 50%, springs to 30% ---
  const splitX = spring({
    frame: frame - SHIFT_START,
    fps,
    config: MOTION.springOverdamped,
    from: width * 0.5,
    to: width * 0.3,
  });

  // Scene entrance: panels slide in from sides
  const leftSlide = spring({
    frame: frame - SPLIT_APPEAR,
    fps,
    config: MOTION.springHeavy,
    from: -width * 0.5,
    to: 0,
  });
  const rightSlide = spring({
    frame: frame - SPLIT_APPEAR,
    fps,
    config: MOTION.springHeavy,
    from: width * 0.5,
    to: 0,
  });
  const panelOpacity = interpolate(
    frame,
    [SPLIT_APPEAR, SPLIT_APPEAR + 12],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Content fades in after panels have landed
  const leftContentFade = spring({
    frame: frame - (SPLIT_APPEAR + 15),
    fps,
    config: MOTION.springSnappy,
    from: 0,
    to: 1,
  });
  const rightContentFade = spring({
    frame: frame - (SPLIT_APPEAR + 20),
    fps,
    config: MOTION.springSnappy,
    from: 0,
    to: 1,
  });

  // Divider
  const dividerHeight = spring({
    frame: frame - SPLIT_APPEAR,
    fps,
    config: MOTION.springSnappy,
    from: 0,
    to: height,
  });

  const rightPanelWidth = width - splitX;

  // Sky gradients
  const leftSky = 'linear-gradient(180deg, #7ab8e0 0%, #b8dce8 40%, #d4e8d0 100%)';
  const rightSky = 'linear-gradient(180deg, #4a4040 0%, #6a5a4a 40%, #8a7a6a 100%)';

  return (
    <AbsoluteFill style={{ background: '#2a2a2a', overflow: 'hidden' }}>
      {/* Left panel — Thriving factory */}
      <div
        style={{
          position: 'absolute',
          left: leftSlide,
          top: 0,
          width: splitX,
          height,
          background: leftSky,
          opacity: panelOpacity,
          overflow: 'hidden',
        }}
      >
        <svg
          width={splitX}
          height={height}
          viewBox={`0 0 ${splitX} ${height}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <Factory
            x={0}
            y={height * 0.15}
            w={splitX}
            h={height * 0.7}
            lit={true}
            opacity={leftContentFade}
          />

          {/* Stenciled label on the ground */}
          <text
            x={splitX / 2}
            y={height * 0.92}
            textAnchor="middle"
            fontFamily={FONTS.heading}
            fontSize={splitX > 400 ? 28 : 20}
            fontWeight={700}
            fill="rgba(255,255,255,0.7)"
            letterSpacing="3px"
            opacity={leftContentFade}
          >
            THE NARRATIVE
          </text>
          <text
            x={splitX / 2}
            y={height * 0.92 + 28}
            textAnchor="middle"
            fontFamily={FONTS.body}
            fontSize={14}
            fill="rgba(255,255,255,0.45)"
            letterSpacing="2px"
            opacity={leftContentFade}
          >
            WHAT WE'RE TOLD
          </text>
        </svg>
      </div>

      {/* Right panel — Idle, cracked factory */}
      <div
        style={{
          position: 'absolute',
          left: splitX + rightSlide,
          top: 0,
          width: rightPanelWidth,
          height,
          background: rightSky,
          opacity: panelOpacity,
          overflow: 'hidden',
        }}
      >
        <svg
          width={rightPanelWidth}
          height={height}
          viewBox={`0 0 ${rightPanelWidth} ${height}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <Factory
            x={0}
            y={height * 0.15}
            w={rightPanelWidth}
            h={height * 0.7}
            lit={false}
            opacity={rightContentFade}
          />

          {/* Stenciled label on the ground — larger on the expanding side */}
          <text
            x={rightPanelWidth / 2}
            y={height * 0.90}
            textAnchor="middle"
            fontFamily={FONTS.heading}
            fontSize={rightPanelWidth > 600 ? 48 : 32}
            fontWeight={900}
            fill="rgba(255,255,255,0.8)"
            letterSpacing="3px"
            opacity={rightContentFade}
          >
            THE NUMBERS
          </text>
          <text
            x={rightPanelWidth / 2}
            y={height * 0.90 + 32}
            textAnchor="middle"
            fontFamily={FONTS.body}
            fontSize={15}
            fill="rgba(255,255,255,0.5)"
            letterSpacing="2px"
            opacity={rightContentFade}
          >
            WHAT DATA SHOWS
          </text>
        </svg>
      </div>

      {/* Divider line — a physical fence post / crack in the ground */}
      <div
        style={{
          position: 'absolute',
          left: splitX - 1,
          top: (height - dividerHeight) / 2,
          width: 3,
          height: dividerHeight,
          background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.5), transparent)',
        }}
      />
    </AbsoluteFill>
  );
}
