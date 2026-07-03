# Safe Zones — Remotion 4 Reference

## 1920x1080 Safe Zone Margins

```
Canvas:          1920 × 1080 px
Action safe:     96px from all edges  (center 1728 × 888)  — nothing critical outside this
Title safe:      192px from all edges (center 1536 × 696)  — all text inside this
Absolute min:    80px from all edges  — never place text closer than this
```

```ts
const SAFE = {
  action:  96,   // 5% from edge  — no critical content outside
  title:   192,  // 10% from edge — all readable text inside
  min:     80,   // hard floor for any text element
};
```

## Safe Zone Wrapper Component

```tsx
import { AbsoluteFill } from "remotion";

type SafeZone = "title" | "action" | "min";

const MARGINS: Record<SafeZone, number> = {
  title:  192,
  action: 96,
  min:    80,
};

export const SafeArea: React.FC<{
  zone?: SafeZone;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ zone = "title", children, style }) => {
  const m = MARGINS[zone];
  return (
    <AbsoluteFill
      style={{
        top: m, left: m, right: m, bottom: m,
        width: undefined, height: undefined,
        position: "absolute",
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// Usage:
// <SafeArea zone="title">   — all body text
// <SafeArea zone="action">  — UI elements, labels
```

## Text Sizing Hierarchy

```ts
const TEXT = {
  hero:       { fontSize: 96,  fontWeight: 800, lineHeight: 1.05 }, // full-screen statements
  title:      { fontSize: 72,  fontWeight: 700, lineHeight: 1.1  }, // scene titles
  subheading: { fontSize: 56,  fontWeight: 600, lineHeight: 1.2  }, // section labels
  body:       { fontSize: 40,  fontWeight: 400, lineHeight: 1.55 }, // narration text
  caption:    { fontSize: 28,  fontWeight: 400, lineHeight: 1.4  }, // labels, footnotes
  // NEVER below 28px for any element that must be read (LEARNINGS §43)
};
```

## Flexbox Centering Patterns

```tsx
// Full-screen centered single element
<AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
  <h1>Centered Content</h1>
</AbsoluteFill>

// Centered column (multiple stacked elements)
<AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 24 }}>
  <h1>Title</h1>
  <p>Subtitle</p>
</AbsoluteFill>

// Bottom-anchored lower third
<AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: SAFE.action }}>
  <LowerThird />
</AbsoluteFill>

// Top-left title with safe margin
<AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "flex-start", padding: SAFE.title }}>
  <h2>Section Label</h2>
</AbsoluteFill>
```

## Text Legibility on Busy Backgrounds

```tsx
// Option 1: Text shadow (subtle, works on most backgrounds)
const TEXT_SHADOW = "0 2px 8px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,1)";

<h1 style={{ textShadow: TEXT_SHADOW }}>Title</h1>

// Option 2: Semi-transparent scrim behind a text block
<div
  style={{
    background: "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)",
    padding: "24px 48px 24px 32px",
    borderRadius: 8,
  }}
>
  <h2>Text on video background</h2>
</div>

// Option 3: Full-width gradient overlay at bottom (lower third)
<AbsoluteFill
  style={{
    background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 40%)",
    pointerEvents: "none",
  }}
/>
```

## Lower Third Pattern

```tsx
export const LowerThird: React.FC<{ name: string; title: string; frame: number }> = ({ name, title, frame }) => {
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 20, stiffness: 180 } });
  const x = interpolate(progress, [0, 1], [-400, 0]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: SAFE.action,
        left: SAFE.action,
        transform: `translateX(${x}px)`,
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,0.8)",
          borderLeft: "4px solid #f5a623",
          padding: "12px 24px",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, color: "#fff" }}>{name}</div>
        <div style={{ fontSize: 28, color: "#f5a623", marginTop: 4 }}>{title}</div>
      </div>
    </div>
  );
};
```

## Complete Composition with Safe Zones

```tsx
export const SafeComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 20, stiffness: 120 } });

  return (
    <AbsoluteFill style={{ background: "#0a0a0a" }}>
      {/* Background fills entire canvas — no safe zone needed */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0a 70%)" }} />

      {/* Hero text — title safe zone */}
      <SafeArea zone="title" style={{ justifyContent: "center", alignItems: "center" }}>
        <h1 style={{ ...TEXT.hero, color: "#fff", textShadow: TEXT_SHADOW, textAlign: "center" }}>
          Where Is India's Battery?
        </h1>
      </SafeArea>

      {/* Lower third — action safe zone */}
      <LowerThird name="Amar Singh" title="Executive Producer" frame={frame} />
    </AbsoluteFill>
  );
};
```

## Gotchas

- `AbsoluteFill` sets `position: absolute, top:0, left:0, width:100%, height:100%`. To use it as a safe-zone container, override `top`/`left`/`right`/`bottom` and unset `width`/`height`.
- Titles and subtitles must stay inside title-safe (192px). Data labels and UI chrome can go to action-safe (96px). Background elements can go to canvas edge.
- `padding` on an `AbsoluteFill` does NOT shrink the clickable/visible area — content can still overflow. Use the `SafeArea` wrapper above instead.
- On a 1920x1080 composition, 1px = 1px. There is no DPR scaling — design at actual pixel dimensions.
- `backdropFilter` requires `background` to be semi-transparent to take effect. It also creates a new stacking context.
