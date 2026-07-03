# Depth & Filter Effects

CSS `filter` property for depth-of-field blur, grayscale
reveals, glow, and mood shifts. Lightweight — pure CSS,
no extra rendering cost.

## Key Patterns

- `filter: blur(Npx)` for depth-of-field — blur background,
  sharp foreground
- `filter: grayscale(1)` → `grayscale(0)` for color reveals
- `filter: brightness(N) contrast(N)` for dramatic lighting
- `filter: drop-shadow(...)` for glow effects on elements
- `filter: saturate(N)` for desaturation → vivid transitions
- Multiple filters chain: `blur(2px) grayscale(0.5)`
- Animate the filter value with `interpolate()` per frame

## When to Use

- **Depth-of-field** — blur a background layer while
  foreground stays sharp, creating cinematic focus
- **Color reveal** — scene starts grayscale, blooms into
  color at a key moment
- **Mood shift** — brightness/contrast change to signal
  tone (hopeful → bleak or reverse)
- **Focus pull** — foreground blurs out while background
  sharpens (or vice versa), shifting viewer attention
- **Glow emphasis** — drop-shadow glow on a key element
  that pulses or appears
- **Desaturated past** — historical content shown muted,
  present shown vivid

## Complete Example

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  spring, interpolate,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// --- Depth of Field: blurred bg, sharp foreground ---
export const DepthOfField: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Focus pull: background starts sharp, blurs as
  // foreground element enters
  const focusProgress = spring({
    frame: frame - 15,
    fps,
    config: MOTION.springOverdamped,
  });

  const bgBlur = interpolate(focusProgress, [0, 1], [0, 6]);
  const fgOpacity = interpolate(
    focusProgress, [0, 1], [0, 1],
  );

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      {/* Background layer — blurs as focus shifts */}
      <AbsoluteFill
        style={{
          filter: `blur(${bgBlur}px)`,
          willChange: 'filter',
        }}
      >
        {/* Background content here */}
        <div style={{
          position: 'absolute',
          top: 200, left: 300,
          fontFamily: FONTS.heading,
          fontSize: 64,
          color: PALETTE.textMuted,
        }}>
          Background Context
        </div>
      </AbsoluteFill>

      {/* Foreground layer — stays sharp */}
      <AbsoluteFill style={{ opacity: fgOpacity }}>
        <div style={{
          position: 'absolute',
          top: 350, left: 400,
          fontFamily: FONTS.heading,
          fontSize: 96,
          fontWeight: 700,
          color: PALETTE.primary,
        }}>
          KEY FACT
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// --- Grayscale to Color Reveal ---
export const ColorReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Color blooms at frame 45
  const colorProgress = spring({
    frame: frame - 45,
    fps,
    config: { stiffness: 60, damping: 18, mass: 1.5 },
  });

  const grayscale = interpolate(
    colorProgress, [0, 1], [1, 0],
  );
  const saturation = interpolate(
    colorProgress, [0, 1], [0.3, 1.2],
  );

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.bg,
        filter: `grayscale(${grayscale}) saturate(${saturation})`,
        willChange: 'filter',
      }}
    >
      {/* Scene content — starts gray, blooms to color */}
    </AbsoluteFill>
  );
};

// --- Focus Pull Between Layers ---
interface FocusPullProps {
  /** Frame when focus shifts from bg to fg */
  pullFrame?: number;
  background: React.ReactNode;
  foreground: React.ReactNode;
}

export const FocusPull: React.FC<FocusPullProps> = ({
  pullFrame = 30,
  background,
  foreground,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pull = spring({
    frame: frame - pullFrame,
    fps,
    config: { stiffness: 40, damping: 14, mass: 2 },
  });

  const bgBlur = interpolate(pull, [0, 1], [0, 8]);
  const fgBlur = interpolate(pull, [0, 1], [4, 0]);

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      <AbsoluteFill
        style={{
          filter: `blur(${bgBlur}px)`,
          willChange: 'filter',
        }}
      >
        {background}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          filter: `blur(${fgBlur}px)`,
          willChange: 'filter',
        }}
      >
        {foreground}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// --- Glow Pulse on Element ---
interface GlowProps {
  color?: string;
  startFrame?: number;
  children: React.ReactNode;
}

export const GlowPulse: React.FC<GlowProps> = ({
  color = PALETTE.accent,
  startFrame = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const elapsed = frame - startFrame;

  // Pulsing glow intensity
  const intensity = Math.sin(elapsed * 0.08) * 8 + 12;

  return (
    <div
      style={{
        filter: `drop-shadow(0 0 ${intensity}px ${color})`,
        willChange: 'filter',
      }}
    >
      {children}
    </div>
  );
};
```

## Filter Chaining

Combine multiple filters for compound effects:

```tsx
// Muted, slightly blurred → vivid and sharp
const progress = spring({ ... });
const blur = interpolate(progress, [0, 1], [2, 0]);
const gray = interpolate(progress, [0, 1], [0.6, 0]);
const brightness = interpolate(progress, [0, 1], [0.8, 1]);

style={{
  filter: `blur(${blur}px) grayscale(${gray}) brightness(${brightness})`,
}}
```

## Presets

| Effect | Filter Value | Feel |
|--------|-------------|------|
| Soft bg | `blur(4px)` | Cinematic depth |
| Heavy bg | `blur(8px)` | Strong focus pull |
| Muted past | `grayscale(0.7) brightness(0.9)` | Historical |
| Vivid present | `saturate(1.3) contrast(1.05)` | Energetic |
| Subtle glow | `drop-shadow(0 0 8px color)` | Emphasis |
| Strong glow | `drop-shadow(0 0 20px color)` | Dramatic |

## Notes

- `willChange: 'filter'` is essential — filter animation
  is GPU-composited when hinted
- Blur values above 10px can cause visible edge artifacts
  at frame boundaries — use `overflow: hidden` on parent
- Grayscale-to-color is one of the most reliably cinematic
  effects in CSS — use it for "moment of realization" beats
- Focus pull is effective for shifting viewer attention
  between two elements without moving either
- Filter animations are cheap in Remotion — safe to use on
  multiple layers simultaneously
- Do NOT combine with `backdrop-filter` (unreliable in
  Remotion's headless renderer)
