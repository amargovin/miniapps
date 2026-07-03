# Blend Layers

CSS `mix-blend-mode` for visual layering where elements
interact with each other's colors instead of just stacking.

## Key Patterns

- `mix-blend-mode: multiply` — darken where layers overlap
  (ink/print feel, shadows)
- `mix-blend-mode: screen` — lighten where layers overlap
  (light/glow feel, highlights)
- `mix-blend-mode: overlay` — contrast boost where layers
  meet (dramatic emphasis)
- `mix-blend-mode: difference` — high-contrast inversion
  (glitch, reveal, comparison)
- `mix-blend-mode: color-dodge` — intense brightening
  (fire, energy, neon)
- Layer order matters — blend mode applies to the element
  relative to what's beneath it

## When to Use

- **Text over illustrated backgrounds** — text blends
  into the scene instead of floating above it
  (multiply or overlay)
- **Layered color washes** — colored overlays that tint
  regions of the frame (screen or multiply)
- **Highlight / emphasis overlays** — a bright shape
  that intensifies what's beneath it (color-dodge)
- **Before/after contrast** — difference mode shows
  exactly what changed between two states
- **Texture overlays** — paper grain, noise, or
  brushstroke textures blended onto content
- **Light effects** — simulating light beams, lens flare,
  or glow without filter: drop-shadow

## Complete Example

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  spring, interpolate,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// --- Text blended into background ---
export const BlendedText: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textProgress = spring({
    frame: frame - 10,
    fps,
    config: MOTION.springSnappy,
  });

  const textY = interpolate(textProgress, [0, 1], [40, 0]);

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      {/* Background scene content */}
      <AbsoluteFill>
        <svg width={1920} height={1080}
          viewBox="0 0 1920 1080">
          <rect x={200} y={200} width={1520} height={680}
            fill={PALETTE.primary} opacity={0.15} rx={8} />
        </svg>
      </AbsoluteFill>

      {/* Blended text — merges with bg visually */}
      <div
        style={{
          position: 'absolute',
          top: 400 + textY, left: 0,
          width: 1920,
          textAlign: 'center',
          fontFamily: FONTS.heading,
          fontSize: 120,
          fontWeight: 900,
          color: PALETTE.primary,
          mixBlendMode: 'multiply',
          opacity: textProgress,
          willChange: 'transform, opacity',
        }}
      >
        DEPENDENCY
      </div>
    </AbsoluteFill>
  );
};

// --- Color wash overlay ---
export const ColorWash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Wash sweeps across the frame
  const washProgress = spring({
    frame: frame - 20,
    fps,
    config: { stiffness: 60, damping: 18, mass: 1.5 },
  });

  const washX = interpolate(
    washProgress, [0, 1], [-1920, 0],
  );

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      {/* Scene content underneath */}
      <AbsoluteFill>
        {/* ... your scene elements ... */}
      </AbsoluteFill>

      {/* Color wash — tints everything it covers */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: washX,
          width: 1920,
          height: 1080,
          background: PALETTE.secondary,
          opacity: 0.2,
          mixBlendMode: 'multiply',
          willChange: 'transform',
        }}
      />
    </AbsoluteFill>
  );
};

// --- Spotlight / Light Beam ---
export const Spotlight: React.FC = () => {
  const frame = useCurrentFrame();

  // Spotlight position drifts slowly
  const spotX = 960 + Math.sin(frame * 0.02) * 100;
  const spotY = 400 + Math.cos(frame * 0.015) * 50;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      {/* Scene content */}
      <AbsoluteFill>
        {/* ... elements ... */}
      </AbsoluteFill>

      {/* Spotlight — brightens what it touches */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: 1920, height: 1080,
          background: `radial-gradient(
            ellipse 400px 500px at ${spotX}px ${spotY}px,
            rgba(255,255,255,0.3),
            transparent
          )`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
```

## Blend Mode Reference

| Mode | Effect | Good For |
|------|--------|----------|
| `multiply` | Darkens | Text on bg, shadows, ink |
| `screen` | Lightens | Light, glow, highlights |
| `overlay` | Contrast | Emphasis, drama |
| `soft-light` | Subtle contrast | Gentle emphasis |
| `difference` | Inversion | Comparison, glitch |
| `color-dodge` | Intense bright | Fire, energy, neon |
| `exclusion` | Muted inversion | Subtle comparison |

## Notes

- `mix-blend-mode` works on any HTML element or SVG — not
  limited to special layers
- On light backgrounds (`editorial` palette), `multiply`
  is the most useful mode — it darkens text into the
  surface naturally
- On dark backgrounds (`dark-cinematic`), `screen` is the
  most useful — it creates light/glow effects
- Blend modes are zero-cost in CSS rendering — they don't
  add any performance overhead
- `difference` mode is powerful for A/B comparisons: stack
  two versions, one in difference mode, and only the
  differences are visible
- Combine with animated opacity to transition blend
  effects in and out
- Do NOT overuse — one blend layer per scene is usually
  sufficient. Multiple competing blend modes create
  visual mud.
