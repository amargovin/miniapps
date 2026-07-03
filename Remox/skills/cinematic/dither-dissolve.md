# Dither Dissolve

40x22 tile grid dissolve reveal — frame-keyed random seed for reproducible per-frame noise.

## Key Patterns

- Divide 1920x1080 into a grid of tiles (40 cols x 22 rows = 880 tiles)
- Each tile has a random reveal threshold pre-computed from its index
- `progress` (0–1) determines what fraction of tiles are visible
- Tile is shown if `threshold <= progress`
- Frame-stable: thresholds are static — same frame always produces same pattern
- No `random()` calls inside the render loop — use precomputed array

## Complete Example

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate,
} from 'remotion';
import { random } from 'remotion';
import { PALETTE } from '../theme';

const COLS = 40;
const ROWS = 22;
const TILE_W = 1920 / COLS;  // 48px
const TILE_H = 1080 / ROWS;  // ~49px

// Precompute thresholds once — each tile has a fixed reveal order
const TILE_THRESHOLDS = Array.from(
  { length: COLS * ROWS },
  (_, i) => random(`dissolve-tile-${i}`),
);

interface DitherDissolveProps {
  /** Frame when dissolve begins */
  startFrame: number;
  /** Duration of dissolve in frames */
  durationFrames: number;
  /** Color of the tiles (covers the scene beneath) */
  tileColor?: string;
  /** reveal = tiles disappear (reveal scene); cover = tiles appear (cover scene) */
  mode?: 'reveal' | 'cover';
  children?: React.ReactNode;
}

export const DitherDissolve: React.FC<DitherDissolveProps> = ({
  startFrame,
  durationFrames,
  tileColor = PALETTE.bg,
  mode = 'reveal',
  children,
}) => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill>
      {children}
      {/* Tile overlay */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {TILE_THRESHOLDS.map((threshold, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);

          const visible = mode === 'reveal'
            ? threshold > progress   // tiles disappear as progress increases
            : threshold <= progress; // tiles appear as progress increases

          if (!visible) return null;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: col * TILE_W,
                top:  row * TILE_H,
                width:  TILE_W + 1, // +1 avoids sub-pixel gaps
                height: TILE_H + 1,
                background: tileColor,
              }}
            />
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// --- Usage: scene transition ---
export const DitherTransitionDemo: React.FC = () => (
  <AbsoluteFill style={{ background: PALETTE.surface }}>
    {/* Scene content underneath */}
    <AbsoluteFill>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 120, fontWeight: 900, color: PALETTE.text,
      }}>
        REVEALED
      </div>
    </AbsoluteFill>

    {/* Dissolve away the covering layer over 40 frames starting at frame 20 */}
    <DitherDissolve
      startFrame={20}
      durationFrames={40}
      tileColor={PALETTE.bg}
      mode="reveal"
    />
  </AbsoluteFill>
);
```

## Grid Size Reference

| Grid   | Tiles  | Tile Size     | Feel          |
|--------|--------|---------------|---------------|
| 20x11  | 220    | 96x98px       | Chunky, bold  |
| 40x22  | 880    | 48x49px       | Classic dither|
| 80x45  | 3600   | 24x24px       | Fine grain    |
| 160x90 | 14400  | 12x12px       | Near-pixel    |

## Notes

- For colored tile variation, use `PALETTE` array and `i % colors.length` per tile
- Ease the `progress` input with `interpolate` easing for non-linear dissolve pacing
- Combine with audio hit: set `startFrame` to the exact beat frame
- Large grids (>3600 tiles) may impact render performance — profile first
