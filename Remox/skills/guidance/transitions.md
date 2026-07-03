# Transitions — Remotion 4 Reference

## `<TransitionSeries>` Setup

```tsx
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
```

## Built-in Presentations

```tsx
// Fade: simple opacity crossfade
fade()

// Slide: outgoing slides out, incoming slides in (direction: left|right|up|down)
slide({ direction: "from-right" })

// Wipe: hard edge wipe (direction: from-left|from-right|from-top|from-bottom)
wipe({ direction: "from-left" })

// Flip: 3D card flip (direction: from-left|from-right|from-top|from-bottom)
flip({ direction: "from-right" })
```

## Timing Functions

```tsx
// Linear: constant speed over N frames
linearTiming({ durationInFrames: 20 })

// Spring: physics-based, feels organic
springTiming({
  durationInFrames: 30,
  config: { damping: 20, stiffness: 180 },
})
```

## `<TransitionSeries>` — 3 Scene Example

```tsx
import { AbsoluteFill, TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

const SceneA = () => (
  <AbsoluteFill style={{ background: "#1a1a2e", display: "flex", justifyContent: "center", alignItems: "center" }}>
    <h1 style={{ color: "#fff", fontSize: 80 }}>Scene A</h1>
  </AbsoluteFill>
);
const SceneB = () => (
  <AbsoluteFill style={{ background: "#16213e", display: "flex", justifyContent: "center", alignItems: "center" }}>
    <h1 style={{ color: "#e94560", fontSize: 80 }}>Scene B</h1>
  </AbsoluteFill>
);
const SceneC = () => (
  <AbsoluteFill style={{ background: "#0f3460", display: "flex", justifyContent: "center", alignItems: "center" }}>
    <h1 style={{ color: "#fff", fontSize: 80 }}>Scene C</h1>
  </AbsoluteFill>
);

export const TransitionDemo: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={60}>
      <SceneA />
    </TransitionSeries.Sequence>

    <TransitionSeries.Transition
      presentation={fade()}
      timing={linearTiming({ durationInFrames: 20 })}
    />

    <TransitionSeries.Sequence durationInFrames={60}>
      <SceneB />
    </TransitionSeries.Sequence>

    <TransitionSeries.Transition
      presentation={slide({ direction: "from-right" })}
      timing={springTiming({ durationInFrames: 30, config: { damping: 20, stiffness: 180 } })}
    />

    <TransitionSeries.Sequence durationInFrames={60}>
      <SceneC />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
```

## Custom Presentation: Fade Through Dark

```tsx
import { TransitionPresentation } from "@remotion/transitions";

export const fadeThroughDark = (): TransitionPresentation<Record<string, never>> => ({
  component: ({ children, presentationProgress, presentationDirection }) => {
    const opacity = presentationDirection === "entering"
      ? interpolate(presentationProgress, [0.5, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(presentationProgress, [0, 0.5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

    return (
      <AbsoluteFill style={{ opacity }}>
        {children}
        {/* Dark overlay peaks at mid-transition */}
        <AbsoluteFill
          style={{
            background: "#000",
            opacity: interpolate(
              presentationProgress,
              [0, 0.5, 1],
              presentationDirection === "entering" ? [1, 0, 0] : [0, 0, 1]
            ),
          }}
        />
      </AbsoluteFill>
    );
  },
  props: {},
});
```

## Manual Crossfade with `interpolate` + Opacity

When you need a crossfade without TransitionSeries (e.g., overlapping content):

```tsx
const frame = useCurrentFrame();
const FADE_START = 45;
const FADE_DURATION = 20;

const progress = interpolate(frame, [FADE_START, FADE_START + FADE_DURATION], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});

// Layer A fades out, Layer B fades in
<AbsoluteFill style={{ opacity: 1 - progress }}><SceneA /></AbsoluteFill>
<AbsoluteFill style={{ opacity: progress }}><SceneB /></AbsoluteFill>
```

## Mask-Based Wipe with `clip-path`

```tsx
const frame = useCurrentFrame();
const { width } = useVideoConfig();

const wipeX = interpolate(frame, [0, 30], [0, 100], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});

<AbsoluteFill>
  <SceneA />
  <AbsoluteFill style={{ clipPath: `inset(0 ${100 - wipeX}% 0 0)` }}>
    <SceneB />
  </AbsoluteFill>
</AbsoluteFill>
```

## Gotchas

- `TransitionSeries.Transition` must sit between two `TransitionSeries.Sequence` nodes — never first or last.
- Transition `durationInFrames` is shared: half from outgoing, half from incoming. Both sequences must be long enough.
- `presentationProgress` goes 0→1 for entering, and 0→1 for exiting simultaneously during the overlap window.
- `slide` and `flip` use CSS 3D transforms — they may conflict with other transforms on the root element.
- For opacity-based transitions, always clamp extrapolation to avoid values outside [0, 1].

---

## Remox Transition Standards

### Scene-Boundary Continuity
The ontology specifies transition types between scenes (cut / crossfade / wipe).
Use the specified type at scene boundaries — these were set during narrative
planning and affect emotional continuity. Within a scene, you have full
discretion on transition choice.

### Duration by Tonal Shift
Do not use uniform transition durations. Match duration to the nature
of the boundary:

| Boundary type | Duration | Notes |
|---|---|---|
| Same-tone (text→text, same bg color) | 12 frames | Clean handoff, minimal interruption |
| Contrast shift (cream→navy, navy→cream) | 18 frames | Color change needs breathing room |
| Medium shift (video→text, image→text) | 24 frames | World change; let the previous world exit |
| Major tonal shift (calm→urgent, dark→bright) | 24–30 frames | The transition is part of the drama |

### Wipe Direction Alternation
When using consecutive wipe transitions, alternate direction:
- P3→P4: `wipe({ direction: "from-left" })`
- P4→P5: `wipe({ direction: "from-right" })`

Alternating direction creates a visual rhythm and prevents the
scene from feeling like a one-directional scroll.

### Don't Default to Fade
`fade()` is not the universal transition. Default to wipe for
clean-to-clean phase boundaries — it has an editorial, print-like
feel that suits the Remox aesthetic. Reserve fade for:
- Image-to-clean transitions (a photo dissolving into typography)
- Low-energy, contemplative phase shifts
- Scene outro fades

Use `fadeThroughDark` (see Custom Presentations above) when entering
a backdrop phase from a clean phase — the dip to near-black signals
a world shift and prevents the image from popping in abruptly.
