# Duotone Photo — Editorial Photography Treatment

Real photography with CSS filter treatments for a
professional editorial look. A duotoned photo of a subject
looks 10x better than a code-generated SVG illustration
of the same subject.

## Core Technique

CSS filters transform any photo into an editorial asset:

```tsx
// Basic duotone: grayscale + contrast + color overlay
<div style={{ position: "relative" }}>
  <Img
    src={staticFile("photo.jpg")}
    style={{
      width: "100%",
      height: "100%",
      objectFit: "cover",
      filter: "grayscale(1) contrast(1.2)",
    }}
  />
  {/* Color overlay via mix-blend-mode */}
  <div style={{
    position: "absolute",
    inset: 0,
    background: PALETTE.primary,
    mixBlendMode: "multiply",
    opacity: 0.7,
  }} />
</div>
```

## Pattern 1: Full-Frame Duotone with Text Overlay

Photo fills the frame, duotoned, with kinetic typography
layered on top. The Economist's signature look.

```tsx
import { spring, interpolate, useCurrentFrame, useVideoConfig, AbsoluteFill, Img, staticFile } from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

export const DuotoneHero: React.FC<{
  photo: string;
  headline: string;
  subtext: string;
  tintColor?: string;
}> = ({ photo, headline, subtext, tintColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tint = tintColor || PALETTE.primary;

  // Slow Ken Burns zoom
  const zoom = interpolate(frame, [0, 150], [1, 1.08], {
    extrapolateRight: "clamp",
  });

  // Text entrance
  const textIn = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: MOTION.springSnappy,
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Photo layer */}
      <Img
        src={staticFile(photo)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "grayscale(1) contrast(1.3) brightness(0.9)",
          transform: `scale(${zoom})`,
        }}
      />

      {/* Color tint overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: tint,
        mixBlendMode: "multiply",
        opacity: 0.65,
      }} />

      {/* Darkening gradient for text readability */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(transparent 40%, rgba(0,0,0,0.6) 100%)",
      }} />

      {/* Text overlay */}
      <div style={{
        position: "absolute",
        bottom: 120,
        left: 192,
        right: 192,
        opacity: interpolate(textIn, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(
          textIn, [0, 1], [30, 0]
        )}px)`,
      }}>
        <div style={{
          fontFamily: FONTS.heading,
          fontSize: 56,
          fontWeight: 700,
          color: "#FFFFFF",
          lineHeight: 1.2,
          marginBottom: 16,
        }}>
          {headline}
        </div>
        <div style={{
          fontFamily: FONTS.body,
          fontSize: 28,
          color: "rgba(255,255,255,0.8)",
        }}>
          {subtext}
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

## Pattern 2: Masked Photo Reveal

Photo revealed through an animated clip-path shape.

```tsx
export const MaskedReveal: React.FC<{ photo: string }> = ({ photo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reveal = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  // Circle reveal expanding from center
  const radius = interpolate(reveal, [0, 1], [0, 80]);

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      <div style={{
        position: "absolute",
        inset: 96,
        overflow: "hidden",
        clipPath: `circle(${radius}% at 50% 50%)`,
      }}>
        <Img
          src={staticFile(photo)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "grayscale(1) contrast(1.2)",
          }}
        />
        <div style={{
          position: "absolute",
          inset: 0,
          background: PALETTE.primary,
          mixBlendMode: "multiply",
          opacity: 0.5,
        }} />
      </div>
    </AbsoluteFill>
  );
};
```

## Pattern 3: Split Duotone Comparison

Two photos side by side with different color tints for
A vs B comparison.

```tsx
export const SplitDuotone: React.FC<{
  photoA: string;
  photoB: string;
  labelA: string;
  labelB: string;
}> = ({ photoA, photoB, labelA, labelB }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ flexDirection: "row" }}>
      {[
        { photo: photoA, label: labelA, tint: PALETTE.primary, delay: 0 },
        { photo: photoB, label: labelB, tint: PALETTE.secondary, delay: 12 },
      ].map((panel, i) => {
        const entrance = spring({
          frame: Math.max(0, frame - panel.delay),
          fps,
          config: MOTION.springSnappy,
        });

        return (
          <div key={i} style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            opacity: interpolate(entrance, [0, 1], [0, 1]),
          }}>
            <Img
              src={staticFile(panel.photo)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "grayscale(1) contrast(1.3)",
              }}
            />
            <div style={{
              position: "absolute",
              inset: 0,
              background: panel.tint,
              mixBlendMode: "multiply",
              opacity: 0.6,
            }} />
            {/* Label */}
            <div style={{
              position: "absolute",
              bottom: 80,
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: FONTS.heading,
              fontSize: 48,
              fontWeight: 700,
              color: "#FFFFFF",
              textTransform: "uppercase",
              letterSpacing: 3,
            }}>
              {panel.label}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
```

## Filter Recipes

### Classic Duotone (one color)
```tsx
filter: "grayscale(1) contrast(1.2)"
// + overlay div with mixBlendMode: "multiply"
```

### High-Contrast Editorial
```tsx
filter: "grayscale(1) contrast(1.5) brightness(0.85)"
```

### Warm Sepia Tone
```tsx
filter: "grayscale(1) sepia(0.3) contrast(1.1)"
```

### Selective Color (desaturate everything except red)
```tsx
filter: "saturate(0.15) contrast(1.2)"
// Keeps hint of original colors, mostly desaturated
```

### Posterized (reduced tonal range)
```tsx
filter: "grayscale(1) contrast(2) brightness(1.1)"
// Creates stark black/white with minimal midtones
```

## Using Photos in Remotion

Place photos in the `public/` directory and reference via
`staticFile()`:

```tsx
import { Img, staticFile } from "remotion";

<Img src={staticFile("factory-aerial.jpg")} />
```

**Photo sourcing for production:**
- Use `staticFile()` for bundled assets
- For dynamic/URL-based images, use standard `<img>` tags
- Photos should be 1920x1080 or larger for full-frame use
- Compress to JPEG quality 80 for bundle size

## Anti-Patterns

- **No filter treatment** — raw photos look like a
  slideshow. Always apply at least grayscale + contrast.
- **Too many blend modes** — stick to `multiply` for
  duotone. `screen`, `overlay`, etc. are unpredictable.
- **Photo as background wallpaper** — the photo should
  be the visual, not decoration behind text. If you're
  covering 80% of the photo with text, use kinetic
  typography instead.
- **Low-res photos** — blurry upscaled photos look worse
  than no photo. Use high-res or switch approach.
