# Kinetic Typography — Words as Architecture

The single most effective visual approach for motion graphics.
Vox, The Economist, and every professional explainer uses this
as their primary technique. The narrator says the words — the
screen shows them with spatial arrangement and emphasis.

## Core Principle

Kinetic typography is NOT "text fading in." It's words with:
- **Spatial arrangement** — stacked, offset, radiating
- **Emphasis animation** — underlines, highlights, scale changes
- **Staggered timing** — each word/line enters separately
- **Typographic contrast** — size, weight, color differences

## Pattern 1: Stacked Word Build

Key phrases stack vertically, each line spring-entering with
a stagger. The final stack reads as a complete statement.

```tsx
import { spring, interpolate, useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

const LINES = [
  { text: "INDIA IMPORTS", size: 42, color: PALETTE.textMuted },
  { text: "77%", size: 120, color: PALETTE.secondary, weight: 800 },
  { text: "OF ITS BATTERY CELLS", size: 42, color: PALETTE.textMuted },
  { text: "FROM CHINA", size: 64, color: PALETTE.primary, weight: 700 },
];

const STAGGER = 12; // frames between each line

export const StackedBuild: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{
      background: PALETTE.bg,
      justifyContent: "center",
      alignItems: "center",
    }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}>
        {LINES.map((line, i) => {
          const f = Math.max(0, frame - i * STAGGER);
          const entrance = spring({
            frame: f,
            fps,
            config: MOTION.springSnappy,
          });

          return (
            <div
              key={i}
              style={{
                fontFamily: FONTS.heading,
                fontSize: line.size,
                fontWeight: line.weight || 400,
                color: line.color,
                letterSpacing: line.size > 80 ? "-2px" : "1px",
                textTransform: "uppercase",
                opacity: interpolate(entrance, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(
                  entrance, [0, 1], [40, 0]
                )}px)`,
              }}
            >
              {line.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

## Pattern 2: Highlighted Phrase

A full sentence appears, then specific words get emphasized
with an animated underline, background highlight, or color
change.

```tsx
import { spring, interpolate, useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

const SENTENCE = "The entire supply chain is controlled by a single country";
const HIGHLIGHT_WORDS = "single country";
const HIGHLIGHT_START = 30; // frame when highlight begins

export const HighlightedPhrase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Sentence entrance
  const sentenceIn = spring({
    frame,
    fps,
    config: MOTION.springGentle,
  });

  // Highlight animation
  const highlightF = Math.max(0, frame - HIGHLIGHT_START);
  const highlight = spring({
    frame: highlightF,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  const parts = SENTENCE.split(HIGHLIGHT_WORDS);

  return (
    <AbsoluteFill style={{
      background: PALETTE.bg,
      justifyContent: "center",
      alignItems: "center",
      padding: "0 240px",
    }}>
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: 52,
        color: PALETTE.text,
        lineHeight: 1.4,
        textAlign: "center",
        opacity: interpolate(sentenceIn, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(
          sentenceIn, [0, 1], [20, 0]
        )}px)`,
      }}>
        {parts[0]}
        <span style={{
          color: interpolate(highlight, [0, 1], [0, 1]) > 0.5
            ? PALETTE.secondary : PALETTE.text,
          position: "relative",
          display: "inline",
        }}>
          {HIGHLIGHT_WORDS}
          {/* Animated underline */}
          <span style={{
            position: "absolute",
            bottom: -4,
            left: 0,
            width: `${interpolate(highlight, [0, 1], [0, 100])}%`,
            height: 4,
            background: PALETTE.secondary,
            borderRadius: 2,
          }} />
        </span>
        {parts[1]}
      </div>
    </AbsoluteFill>
  );
};
```

## Pattern 3: Big Number Slam

A stat fills the frame with a counting animation, then
supporting context appears below.

```tsx
import { spring, interpolate, useCurrentFrame, useVideoConfig, AbsoluteFill, Easing } from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

const TARGET = 77;
const SUFFIX = "%";
const CONTEXT = "of India's battery cells come from China";
const CONTEXT_DELAY = 35; // frames

export const NumberSlam: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Number entrance — fast slam with overshoot
  const numIn = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  // Count up
  const countUp = interpolate(frame, [0, 40], [0, TARGET], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Context line entrance
  const ctxF = Math.max(0, frame - CONTEXT_DELAY);
  const ctxIn = spring({
    frame: ctxF,
    fps,
    config: MOTION.springGentle,
  });

  return (
    <AbsoluteFill style={{
      background: PALETTE.bg,
      justifyContent: "center",
      alignItems: "center",
    }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
      }}>
        {/* Big number */}
        <div style={{
          fontFamily: FONTS.heading,
          fontSize: 180,
          fontWeight: 800,
          color: PALETTE.secondary,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-4px",
          opacity: interpolate(numIn, [0, 1], [0, 1]),
          transform: `scale(${interpolate(
            numIn, [0, 1], [0.7, 1]
          )})`,
        }}>
          {Math.round(countUp)}{SUFFIX}
        </div>

        {/* Context line */}
        <div style={{
          fontFamily: FONTS.body,
          fontSize: 36,
          color: PALETTE.textMuted,
          textAlign: "center",
          maxWidth: 600,
          opacity: interpolate(ctxIn, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(
            ctxIn, [0, 1], [20, 0]
          )}px)`,
        }}>
          {CONTEXT}
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

## Pattern 4: Word-by-Word Reveal

Words appear one at a time in sync with narration pacing.
Creates dramatic emphasis through timing.

```tsx
const WORDS = ["India", "cannot", "build", "batteries", "without", "China"];
const EMPHASIS_INDEX = 5; // "China" gets special treatment
const FRAMES_PER_WORD = 8;

export const WordByWord: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{
      background: PALETTE.bg,
      justifyContent: "center",
      alignItems: "center",
      padding: "0 192px",
    }}>
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: 64,
        lineHeight: 1.5,
        textAlign: "center",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 16px",
      }}>
        {WORDS.map((word, i) => {
          const wordFrame = Math.max(0, frame - i * FRAMES_PER_WORD);
          const entrance = spring({
            frame: wordFrame,
            fps,
            config: { damping: 18, stiffness: 180 },
          });

          const isEmphasis = i === EMPHASIS_INDEX;

          return (
            <span
              key={i}
              style={{
                color: isEmphasis ? PALETTE.secondary : PALETTE.text,
                fontWeight: isEmphasis ? 800 : 400,
                fontSize: isEmphasis ? 80 : 64,
                opacity: interpolate(entrance, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(
                  entrance, [0, 1], [30, 0]
                )}px)`,
                display: "inline-block",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

## Pattern 5: Contrasting Text Columns

Two statements side by side with different visual treatments,
creating tension through typographic contrast.

```tsx
export const ContrastColumns: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftIn = spring({ frame, fps, config: MOTION.springSnappy });
  const rightIn = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: MOTION.springSnappy,
  });

  return (
    <AbsoluteFill style={{
      background: PALETTE.bg,
      flexDirection: "row",
    }}>
      {/* Left column */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 96,
        opacity: interpolate(leftIn, [0, 1], [0, 1]),
      }}>
        <div style={{
          fontFamily: FONTS.heading,
          fontSize: 28,
          color: PALETTE.textMuted,
          textTransform: "uppercase",
          letterSpacing: 3,
        }}>INDIA</div>
        <div style={{
          fontFamily: FONTS.heading,
          fontSize: 96,
          fontWeight: 800,
          color: PALETTE.text,
        }}>3</div>
        <div style={{
          fontFamily: FONTS.body,
          fontSize: 28,
          color: PALETTE.textMuted,
        }}>battery plants</div>
      </div>

      {/* Divider */}
      <div style={{
        width: 2,
        background: `${PALETTE.text}15`,
        margin: "120px 0",
      }} />

      {/* Right column */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 96,
        opacity: interpolate(rightIn, [0, 1], [0, 1]),
      }}>
        <div style={{
          fontFamily: FONTS.heading,
          fontSize: 28,
          color: PALETTE.textMuted,
          textTransform: "uppercase",
          letterSpacing: 3,
        }}>CHINA</div>
        <div style={{
          fontFamily: FONTS.heading,
          fontSize: 96,
          fontWeight: 800,
          color: PALETTE.secondary,
        }}>93</div>
        <div style={{
          fontFamily: FONTS.body,
          fontSize: 28,
          color: PALETTE.textMuted,
        }}>battery plants</div>
      </div>
    </AbsoluteFill>
  );
};
```

## Techniques for Emphasis

### Animated Underline
```tsx
<span style={{
  position: "absolute",
  bottom: -4,
  left: 0,
  width: `${progress * 100}%`,
  height: 4,
  background: PALETTE.secondary,
  borderRadius: 2,
}} />
```

### Background Highlight (marker pen effect)
```tsx
<span style={{
  background: `linear-gradient(transparent 60%, ${PALETTE.accent}40 60%)`,
  padding: "0 4px",
}} />
```

### Scale Pop on Landing
```tsx
transform: `scale(${interpolate(entrance, [0, 0.8, 1], [0.5, 1.1, 1])})`
```

### Letter Spacing Tighten
```tsx
letterSpacing: `${interpolate(entrance, [0, 1], [20, -1])}px`
```

### Color Shift on Emphasis
```tsx
color: frame > EMPHASIS_FRAME ? PALETTE.secondary : PALETTE.text
// Or animated:
color: `rgb(${interpolate(progress, [0, 1], [26, 196])}, ...)`
```

## Pattern 6: Background Color Shift

When a phase needs maximum impact, shift the entire background
from the default palette bg to a contrasting color (dark primary,
near-black, or full secondary). White/cream text on dark = instant
drama. Use for tension beats, reveals, contradictions.

The transition happens around frame 20, driven by a spring. Text
color shifts simultaneously so both background and foreground
invert together.

```tsx
import { spring, interpolate, useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

const TRANSITION_FRAME = 20;

export const BackgroundShift: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring that starts at TRANSITION_FRAME
  const shiftF = Math.max(0, frame - TRANSITION_FRAME);
  const shift = spring({
    frame: shiftF,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  // Background: PALETTE.bg → PALETTE.primary (dark)
  // Assumes PALETTE.bg is light (e.g. #F5F0E8) and PALETTE.primary is dark (e.g. #1A1A2E)
  const bgColor = interpolate(shift, [0, 1], [0, 1]) > 0.5
    ? PALETTE.primary
    : PALETTE.bg;

  // Text: PALETTE.primary → white
  const textColor = interpolate(shift, [0, 1], [0, 1]) > 0.5
    ? "#FFFFFF"
    : PALETTE.primary;

  // Entrance animation for the text itself
  const entrance = spring({ frame, fps, config: MOTION.springSnappy });

  return (
    <AbsoluteFill style={{
      background: bgColor,
      justifyContent: "center",
      alignItems: "center",
      transition: "background 0.1s", // fallback — Remotion uses interpolated value
    }}>
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: 72,
        fontWeight: 800,
        color: textColor,
        textTransform: "uppercase",
        letterSpacing: "-1px",
        textAlign: "center",
        maxWidth: 900,
        opacity: interpolate(entrance, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(entrance, [0, 1], [30, 0])}px)`,
      }}>
        The dependency runs deeper than you think.
      </div>
    </AbsoluteFill>
  );
};
```

For a smooth color interpolation rather than a hard flip, use
per-channel RGB interpolation:

```tsx
// Smooth background color transition
const r = Math.round(interpolate(shift, [0, 1], [245, 26]));
const g = Math.round(interpolate(shift, [0, 1], [240, 26]));
const b = Math.round(interpolate(shift, [0, 1], [232, 46]));
const bgColor = `rgb(${r}, ${g}, ${b})`;

// Smooth text color transition (light cream → white)
const tr = Math.round(interpolate(shift, [0, 1], [26, 255]));
const tg = Math.round(interpolate(shift, [0, 1], [26, 255]));
const tb = Math.round(interpolate(shift, [0, 1], [46, 255]));
const textColor = `rgb(${tr}, ${tg}, ${tb})`;
```

## Pattern 7: Full-Bleed Color Wash

A brief (60–90 frame) phase where the entire screen is a single
bold color with large white text. Used sparingly — max once per
scene — as a visual shockwave moment. This is punctuation, not
a paragraph. PALETTE.secondary for urgency, PALETTE.primary for
gravity.

The entrance is a flash: opacity 0→1 fast with a slight scale
overshoot so it feels like it slams into existence.

```tsx
import { spring, interpolate, useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

export const ColorWash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Flash entrance: snappy spring with overshoot
  const slam = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 300 }, // high stiffness = fast slam
  });

  return (
    <AbsoluteFill style={{
      background: PALETTE.secondary, // full bleed — no padding, no margin
      justifyContent: "center",
      alignItems: "center",
    }}>
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: 120,
        fontWeight: 900,
        color: "#FFFFFF",
        textTransform: "uppercase",
        letterSpacing: "-3px",
        textAlign: "center",
        lineHeight: 1,
        maxWidth: 1400,
        padding: "0 96px",
        // Flash entrance: opacity snaps in fast
        opacity: interpolate(slam, [0, 0.3, 1], [0, 1, 1], {
          extrapolateRight: "clamp",
        }),
        // Slight scale overshoot for impact
        transform: `scale(${interpolate(slam, [0, 1], [0.85, 1])})`,
      }}>
        China controls the supply chain.
      </div>
    </AbsoluteFill>
  );
};
```

Keep this phase SHORT. At 30fps, 60 frames = 2 seconds, 90 frames
= 3 seconds. If it runs longer it becomes a background, not a
shockwave. Cut away before the viewer adapts.

## Anti-Patterns

- **Plain text fade-in** — If text just fades in with opacity
  and sits there, it's not kinetic typography. It needs
  spatial arrangement, stagger, or emphasis animation.
- **All same size** — Typographic hierarchy comes from
  dramatic size contrast. The stat should be 3-4x larger
  than the context text.
- **Centered paragraph** — Don't put a paragraph of text
  on screen. Extract the key phrase (3-8 words max) and
  make it visual.
- **No motion after entrance** — Text should have micro-
  animations even after entering: subtle breathe, emphasis
  shift, underline draw. Static text = slideshow.
- **Same background for every phase** — If all phases use
  PALETTE.bg, the scene feels flat. Vary background color
  for at least one phase to create visual rhythm. Even a
  single dark phase in a light scene creates contrast and
  pacing. Use Pattern 6 or Pattern 7 at least once per scene.
