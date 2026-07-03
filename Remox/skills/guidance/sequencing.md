# Sequencing — Remotion 4 Reference

## `<Sequence>` Component

```tsx
import { Sequence, useCurrentFrame } from "remotion";

// `frame` inside a Sequence is LOCAL — starts at 0 when the Sequence starts
// from: absolute frame in parent when this sequence begins
// durationInFrames: how long this sequence is visible (clips children)
// name: shows in Remotion Studio timeline

<Sequence from={30} durationInFrames={60} name="Title Card">
  <TitleCard /> {/* sees frame 0..59 regardless of parent frame */}
</Sequence>
```

## `<Series>` Component

Auto-advances sequences back to back without manual `from` math:

```tsx
import { Series } from "remotion";

<Series>
  <Series.Sequence durationInFrames={45} name="Intro">
    <IntroScene />
  </Series.Sequence>
  <Series.Sequence durationInFrames={90} name="Body">
    <BodyScene />
  </Series.Sequence>
  <Series.Sequence durationInFrames={30} name="Outro">
    <OutroScene />
  </Series.Sequence>
</Series>
// Total: 165 frames. Each child sees frame 0..N-1 locally.
```

## Stagger Patterns

```tsx
const ITEMS = ["One", "Two", "Three", "Four"];
const STAGGER_FRAMES = 8;
const ITEM_DURATION = 60;

{ITEMS.map((item, i) => (
  <Sequence
    key={item}
    from={i * STAGGER_FRAMES}
    durationInFrames={ITEM_DURATION}
  >
    <AnimatedItem label={item} />
  </Sequence>
))}
// Last item starts at frame 24, ends at frame 84
// Total span needed: (N-1)*STAGGER + ITEM_DURATION
```

## Frame Math — Local vs Global

```tsx
// Inside any Sequence, useCurrentFrame() returns LOCAL frame (0-based)
// To get global frame for absolute-time triggers, lift the hook above the Sequence

const GlobalAware: React.FC<{ globalFrame: number }> = ({ globalFrame }) => {
  const localFrame = useCurrentFrame(); // 0-based inside this Sequence
  // globalFrame passed as prop for any global-time logic
};
```

## Entrance → Hold → Exit Pattern

```tsx
// Fixed-duration segment: 90 frames total
// Entrance: frames 0-14 (15 frames)
// Hold: frames 15-74 (60 frames)
// Exit: frames 75-89 (15 frames)

const AnimatedCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const TOTAL = 90;
  const ENTER = 15;
  const EXIT_START = TOTAL - 15;

  const entranceProgress = spring({ frame, fps, config: { damping: 20, stiffness: 180 } });
  const exitProgress = spring({
    frame: Math.max(0, frame - EXIT_START),
    fps,
    config: { damping: 20, stiffness: 180 },
    reverse: true,
  });

  const progress = frame < EXIT_START ? entranceProgress : exitProgress;
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const y = interpolate(progress, [0, 1], [30, 0]);

  return <div style={{ opacity, transform: `translateY(${y}px)` }}>Content</div>;
};
```

## 3-Part Sequence with Staggered Elements

```tsx
import { AbsoluteFill, Sequence, Series, spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const FadeIn: React.FC<{ delay?: number; children: React.ReactNode }> = ({ delay = 0, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const opacity = spring({ frame: f, fps, config: { damping: 20, stiffness: 120 } });
  return <div style={{ opacity }}>{children}</div>;
};

export const ThreePartScene: React.FC = () => (
  <AbsoluteFill style={{ background: "#0a0a0a", color: "#fff", fontFamily: "sans-serif" }}>
    <Series>
      {/* Part 1: Hook — 60 frames */}
      <Series.Sequence durationInFrames={60} name="Hook">
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <FadeIn><h1 style={{ fontSize: 96 }}>The Question</h1></FadeIn>
        </AbsoluteFill>
      </Series.Sequence>

      {/* Part 2: Evidence — 90 frames, 3 staggered points */}
      <Series.Sequence durationInFrames={90} name="Evidence">
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-start", padding: 120, flexDirection: "column", gap: 24 }}>
          {["Point one", "Point two", "Point three"].map((p, i) => (
            <FadeIn key={p} delay={i * 12}>
              <p style={{ fontSize: 48 }}>{p}</p>
            </FadeIn>
          ))}
        </AbsoluteFill>
      </Series.Sequence>

      {/* Part 3: Resolution — 60 frames */}
      <Series.Sequence durationInFrames={60} name="Resolution">
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <FadeIn><h2 style={{ fontSize: 72, color: "#f5a623" }}>The Answer</h2></FadeIn>
        </AbsoluteFill>
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
```

## Series for Phase Isolation

Use `<Series>` to implement phase isolation in multi-move
scenes. Each phase fully replaces the previous — no opacity
overlaps, no competing elements.

```tsx
import { AbsoluteFill, Series, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

/**
 * Two-phase scene: Setup → Reveal
 * Phase 1 disappears entirely before Phase 2 appears.
 * Each phase sees local frame 0..N-1.
 */
export const PhaseIsolatedScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  // Split duration: 40% setup, 60% reveal
  const setupFrames = Math.round(durationInFrames * 0.4);
  const revealFrames = durationInFrames - setupFrames;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      <Series>
        {/* Phase 1: Setup — one focal element */}
        <Series.Sequence durationInFrames={setupFrames} name="Setup">
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <SetupElement />
          </AbsoluteFill>
        </Series.Sequence>

        {/* Phase 2: Reveal — replaces setup entirely */}
        <Series.Sequence durationInFrames={revealFrames} name="Reveal">
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <RevealElement />
          </AbsoluteFill>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

// Each phase component uses local frames (0-based)
const SetupElement: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: MOTION.springSnappy });
  return (
    <div style={{
      opacity: entrance,
      transform: `scale(${0.8 + entrance * 0.2})`,
      fontSize: 64,
      fontFamily: FONTS.heading,
      color: PALETTE.text,
    }}>
      Setup Content
    </div>
  );
};

const RevealElement: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: MOTION.springBouncy });
  return (
    <div style={{
      opacity: entrance,
      transform: `translateY(${(1 - entrance) * 40}px)`,
      fontSize: 72,
      fontFamily: FONTS.heading,
      color: PALETTE.primary,
    }}>
      Reveal Content
    </div>
  );
};
```

**Key points:**
- Each `<Series.Sequence>` gets local frames starting at 0
- Phase 1 is completely unmounted before Phase 2 mounts
- No opacity crossfade — clean cut between phases
- Background can be shared (outside `<Series>`) if static
- For editorial-clean: 120-frame minimum per phase

## Gotchas

- `useCurrentFrame()` resets to 0 at the start of every `<Sequence>`. Never assume it's global.
- A Sequence with no `durationInFrames` renders for the remainder of the parent composition — usually not what you want.
- `<Series>` sequences must be direct `<Series.Sequence>` children — no wrappers between them.
- Overlapping sequences require manual `from` offsets; `<Series>` is strictly sequential.
- For crossfade-style overlaps, use `<TransitionSeries>` from `@remotion/transitions` instead.
