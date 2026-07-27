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

### Never Hard-Cut Between Phases (canonical for LEARNINGS §5-transitions)
Hard cuts between phases — `<Series>` with no overlap — are jarring, with no
visual continuity. Every phase boundary gets a transition (default budget
18f, see SKILL.md → Transition Rules for the TSM math), and every phase
except the last in a scene needs exit choreography over its final frames
(see motion-doctrine.md Act 3) so the last thing the viewer sees before a
transition is motion, never a freeze.

### Scene-Boundary Continuity
The ontology specifies transition types between scenes (cut / crossfade / wipe).
Use the specified type at scene boundaries — these were set during narrative
planning and affect emotional continuity. Within a scene, you have full
discretion on transition choice.

### Duration by Tonal Shift
**18f is the audit-safe DEFAULT — use it unless you take the documented
exception.** The mechanical audit's TSM check assumes a uniform 18f transition
budget across a scene (SKILL.md → "Standardize all transitions to 18 frames"),
so a bare non-18f transition will BREAK the audit. The tonal-shift durations
below are creative guidance for *when the boundary earns a deviation* — they are
NOT free to use. Any value other than 18f REQUIRES the explicit TSX
header-comment exception AND a matching adjustment to the TSM math (SKILL.md →
Transition Rules). Default to 18f; deviate deliberately, and document it.

| Boundary type | Duration | Audit status | Notes |
|---|---|---|---|
| Contrast shift (cream→navy, navy→cream) | **18 frames (DEFAULT)** | audit-safe | The standard budget — no exception needed |
| Same-tone (text→text, same bg color) | 12 frames | needs documented exception + TSM adjust | Clean handoff, minimal interruption |
| Medium shift (video→text, image→text) | 24 frames | needs documented exception + TSM adjust | World change; let the previous world exit |
| Major tonal shift (calm→urgent, dark→bright) | 24–30 frames | needs documented exception + TSM adjust | The transition is part of the drama |

The tonal-duration guidance still holds creatively — a same-tone handoff CAN
feel snappier at 12f and a major tonal shift CAN earn 24–30f — but every
non-18f value is a deliberate, documented exception, never a silent default.
If you are not writing the header-comment exception, use 18f.

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

---

## Motivated Transition Vocabulary (July 2026 — canonical for LEARNINGS §50)

User-flagged: "transitions are rather abrupt." Two problems, two fixes —
(a) scene boundaries: crossfade at concat, never fade-through-black (the
RemoxScene wrapper's fade through BLACK makes every boundary a dark blink, a
slideshow tell, brutal on bright films; wrapper background must be the film's
base colour, and fade-through-black is reserved for intentional act breaks,
max 1-2 per film); (b) phase boundaries: motivated transitions, not N
identical fades. A transition should feel CAUSED by what the imagery is
doing, not applied to it. Brief field:
`transition_out: wipe-left | fade | zoom | flash | slide`.

Pick per boundary, in the brief
(`transition_out:` per phase), all within the standard 18f budget:

| Type | Use when | Implementation |
|---|---|---|
| fade | calm boundary (default) | `fade()` |
| wipe (directional) | camera just travelled that way | `wipe({direction})` — match travel |
| zoom-through | leaving one world, entering another | custom: scale outgoing 1→1.15 + fade, incoming 1.15→1 |
| white flash | impact beat lands at the cut | 4f white overlay straddling the boundary (max 2/scene) |
| slide-over | list/sequence progression | `slide()` — incoming shoves outgoing |

Scene-level: never butt-joint graded scenes — use
`scripts/concat_xfade.py` (12f dissolve + audio acrossfade). RemoxScene fade
colour = film base colour, never black on bright films.
