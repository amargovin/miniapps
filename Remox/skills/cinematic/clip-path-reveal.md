# Clip Path Reveal

Animated CSS `clip-path` shapes for reveals, morphs, and
custom wipes beyond circle (which `arc-wipe` handles).

## Key Patterns

- `clip-path: polygon(...)` for arbitrary shape reveals
- `clip-path: inset(T R B L round RADIUS)` for rectangular
  reveals with rounded corners
- Animate polygon vertex coordinates frame-by-frame for
  shape morphing
- Interpolate individual vertex positions between two
  polygon states
- Spring-driven for organic feel, linear for mechanical

## When to Use

- **Diagonal wipes** — angled line reveals (not just circle)
- **Shape morphs** — one polygon transforming into another
- **Torn / jagged edges** — many-point polygons with
  irregular vertices for a ripped-paper boundary
- **Diamond / star reveals** — geometric shape expanding
  from center
- **Inset reveals** — rectangular content area growing from
  nothing
- **Panel borders** — content revealed within a custom
  boundary shape

## Complete Example

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  spring, interpolate,
} from 'remotion';
import { PALETTE } from '../theme';

// --- Diagonal Wipe ---
interface DiagonalWipeProps {
  startFrame?: number;
  /** Angle in degrees — 0 = left-to-right, 45 = diagonal */
  angle?: number;
  children: React.ReactNode;
}

export const DiagonalWipe: React.FC<DiagonalWipeProps> = ({
  startFrame = 0,
  angle = 20,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { stiffness: 120, damping: 22, mass: 1 },
  });

  // Convert angle to polygon offset
  const rad = (angle * Math.PI) / 180;
  const offset = Math.tan(rad) * 100; // percentage offset

  // Sweep from left to right with angled edge
  const x = interpolate(progress, [0, 1], [-10, 110]);

  const poly = `polygon(
    ${x - offset}% 0%,
    ${x}% 100%,
    110% 100%,
    110% 0%
  )`;

  return (
    <AbsoluteFill
      style={{
        clipPath: poly,
        willChange: 'clip-path',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// --- Diamond Reveal ---
interface DiamondRevealProps {
  startFrame?: number;
  children: React.ReactNode;
}

export const DiamondReveal: React.FC<DiamondRevealProps> = ({
  startFrame = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { stiffness: 100, damping: 18, mass: 1.2 },
  });

  // Diamond grows from center
  const size = progress * 80; // percentage from center

  const poly = `polygon(
    50% ${50 - size}%,
    ${50 + size}% 50%,
    50% ${50 + size}%,
    ${50 - size}% 50%
  )`;

  return (
    <AbsoluteFill
      style={{
        clipPath: poly,
        willChange: 'clip-path',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// --- Jagged Edge Boundary ---
// Creates a torn/ripped paper boundary between two layers
interface JaggedEdgeProps {
  /** Frame when the tear animates */
  startFrame?: number;
  /** X position of tear center (0-1920) */
  tearX?: number;
  /** Number of jagged points along the edge */
  points?: number;
  /** How far points deviate from center line */
  roughness?: number;
  children: React.ReactNode;
}

export const JaggedEdge: React.FC<JaggedEdgeProps> = ({
  startFrame = 0,
  tearX = 960,
  points = 20,
  roughness = 40,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { stiffness: 80, damping: 16, mass: 1.5 },
  });

  // Build jagged polygon — left side of the tear
  const jaggedPoints: string[] = [];
  jaggedPoints.push('0% 0%');

  for (let i = 0; i <= points; i++) {
    const y = (i / points) * 100;
    // Deterministic "random" offset using sin
    const jitter = Math.sin(i * 7.3 + 2.1) * roughness;
    const xPct = ((tearX + jitter) / 1920) * 100;
    // Animate: points sweep from left edge to tear position
    const animX = interpolate(progress, [0, 1], [100, xPct]);
    jaggedPoints.push(`${animX}% ${y}%`);
  }

  jaggedPoints.push('0% 100%');

  return (
    <AbsoluteFill
      style={{
        clipPath: `polygon(${jaggedPoints.join(', ')})`,
        willChange: 'clip-path',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// --- Inset Reveal ---
interface InsetRevealProps {
  startFrame?: number;
  borderRadius?: number;
  children: React.ReactNode;
}

export const InsetReveal: React.FC<InsetRevealProps> = ({
  startFrame = 0,
  borderRadius = 12,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { stiffness: 150, damping: 24, mass: 1 },
  });

  // Inset shrinks from 50% (invisible) to 0% (full frame)
  const inset = interpolate(progress, [0, 1], [50, 0]);

  return (
    <AbsoluteFill
      style={{
        clipPath: `inset(${inset}% round ${borderRadius}px)`,
        willChange: 'clip-path',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
```

## Polygon Morph Between Shapes

Both polygons must have the SAME number of vertices:

```tsx
// Triangle → Square: both need 4 points
// (duplicate a vertex on the triangle)
const triPoints = [[50,10],[90,90],[10,90],[50,10]]; // 4 pts
const sqPoints  = [[10,10],[90,10],[90,90],[10,90]]; // 4 pts

const morphed = triPoints.map(([tx, ty], i) => {
  const [sx, sy] = sqPoints[i];
  const x = interpolate(progress, [0, 1], [tx, sx]);
  const y = interpolate(progress, [0, 1], [ty, sy]);
  return `${x}% ${y}%`;
});

clipPath = `polygon(${morphed.join(', ')})`;
```

## Notes

- `arc-wipe` already handles `clip-path: circle()` — use
  this pattern for everything else
- Keep polygon vertex count reasonable (<30 points) for
  performance
- `willChange: 'clip-path'` is essential for smooth animation
- For torn-paper effects, use `Math.sin(i * prime)` for
  deterministic jitter — never `Math.random()`
- Combine diagonal wipe with speed-remap for a
  fast-sweep → settle effect
- Inset reveal is excellent for "zooming into" content
  from a clean frame
