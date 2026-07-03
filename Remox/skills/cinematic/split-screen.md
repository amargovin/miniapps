# Split Screen

Spring-driven panel rebalancing — 2 panels animate from 50/50 to any ratio split.

## Key Patterns

- Each panel uses `overflow: 'hidden'` + absolute inner content positioned to stay centered
- Divider position is the single animated value (as percentage of 1920px)
- Spring drives `dividerX` from `960` to target `X`
- Left panel: `width = dividerX`, right panel: `width = 1920 - dividerX`
- Inner content uses negative margin trick to keep it centered within its panel

## Complete Example

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate,
} from 'remotion';
import { PALETTE, FONTS } from '../theme';

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const DIVIDER_INITIAL = CANVAS_W * 0.5;   // 50%
const DIVIDER_TARGET  = CANVAS_W * 0.7;   // 70%
const DIVIDER_THICKNESS = 4;

interface PanelProps {
  width: number;
  side: 'left' | 'right';
  children: React.ReactNode;
  bgColor: string;
}

const Panel: React.FC<PanelProps> = ({ width, side, children, bgColor }) => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: side === 'left' ? 0 : undefined,
      right: side === 'right' ? 0 : undefined,
      width,
      height: CANVAS_H,
      overflow: 'hidden',
      background: bgColor,
    }}
  >
    {/* Inner content stays at full canvas width — panel clips it */}
    <div
      style={{
        position: 'absolute',
        width: CANVAS_W,
        height: CANVAS_H,
        left: side === 'right' ? -(CANVAS_W - width) : 0,
      }}
    >
      {children}
    </div>
  </div>
);

export const SplitScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Rebalance starts at frame 45
  const REBALANCE_START = 45;
  const progress = spring({
    frame: frame - REBALANCE_START,
    fps,
    config: { stiffness: 120, damping: 20, mass: 1.5 },
  });

  const dividerX = DIVIDER_INITIAL + (DIVIDER_TARGET - DIVIDER_INITIAL) * progress;
  const leftW  = dividerX;
  const rightW = CANVAS_W - dividerX;

  // Label opacity: left label fades when panel shrinks too small
  const leftLabelOp  = interpolate(leftW, [200, 400], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rightLabelOp = interpolate(rightW, [200, 400], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const labelStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 80,
    left: 0,
    width: CANVAS_W,
    textAlign: 'center',
    fontFamily: FONTS.headline,
    fontSize: 52,
    fontWeight: 900,
    color: '#fff',
    letterSpacing: '0.05em',
  };

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* Left panel */}
      <Panel width={leftW} side="left" bgColor={PALETTE.surface}>
        <div style={{ ...labelStyle, opacity: leftLabelOp }}>BEFORE</div>
      </Panel>

      {/* Right panel */}
      <Panel width={rightW} side="right" bgColor={PALETTE.accent}>
        <div style={{ ...labelStyle, opacity: rightLabelOp }}>AFTER</div>
      </Panel>

      {/* Divider line */}
      <div
        style={{
          position: 'absolute',
          left: dividerX - DIVIDER_THICKNESS / 2,
          top: 0,
          width: DIVIDER_THICKNESS,
          height: CANVAS_H,
          background: '#fff',
          willChange: 'left',
        }}
      />
    </AbsoluteFill>
  );
};
```

## Extending to 3 Panels

```tsx
// Three panels: left | center | right
// Track two divider positions: div1X and div2X
const div1Progress = spring({ frame: frame - 30, fps, config: { stiffness: 120, damping: 20 } });
const div2Progress = spring({ frame: frame - 45, fps, config: { stiffness: 120, damping: 20 } });
const div1X = 640 + (400 - 640) * div1Progress;  // 33% → 21%
const div2X = 1280 + (1600 - 1280) * div2Progress; // 67% → 83%
```

## Notes

- The inner `left: -(CANVAS_W - width)` trick keeps right-panel content visually centered
- Add `transition` on divider for pure CSS fallback (non-Remotion contexts)
- Use `AbsoluteFill` inside panels instead of the `CANVAS_W` trick for simpler layouts
