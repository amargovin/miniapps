# Typography & Text Animation — Scene Standard

This guide codifies the patterns established in Scene 01 as the mandatory standard
for all future scenes. Every text phase must conform to this hierarchy and animation
vocabulary unless a deliberate creative deviation is explicitly justified in the brief.

---

## 1. Typography Hierarchy

Every phase that contains text must follow this four-level hierarchy **in order**.
Not every phase needs all four levels — but the ordering is fixed. You cannot put a
body line above a headline, or a headline above a label. The sequence is always:

```
label → accent rule → headline → body
```

### Level 1 — Label (eyebrow / category)

The label orients the viewer. It is the smallest, quietest element.

```ts
{
  fontFamily: FONTS.body,           // Inter
  fontSize: 34,
  fontWeight: 400,
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  fontVariant: 'small-caps',
  color: PALETTE.secondary,         // colored — not white, not muted
  lineHeight: 1,
}
```

- Always uppercase small-caps with generous letter-spacing
- Color is `PALETTE.secondary` (e.g. `#C4373B`) — this is the first color hit in the phase
- Use `FONTS.body` (Inter), never the heading font
- Minimum size: 34px in landscape (LEARNINGS §43 — 24px labels render near-illegible
  at real viewing sizes). Never smaller.

**Landscape floors for all label-class text (LEARNINGS §43):** labels/eyebrows/mono
data ≥34px, stat sub-labels ≥36px, captions/source credits ≥28px, lower-third
names ≥56px. Hero headlines and stat numbers keep their existing ranges.

### Level 2 — Accent Rule

A horizontal line drawn between the label and headline. It is a punctuation mark, not
decoration. Its spring-draw animation connects the two levels visually.

```tsx
// The rule draws left-to-right via scaleX spring
<div
  style={{
    width: 60,
    height: 3,
    background: PALETTE.secondary,
    transform: `scaleX(${ruleProgress})`,
    transformOrigin: 'left',
    margin: '12px 0',
  }}
/>
```

- Fixed dimensions: **60px wide, 3px tall**
- Color matches the label: `PALETTE.secondary`
- `transformOrigin: 'left'` is mandatory — the line grows from left to right
- Animate `scaleX` from 0 to 1 using a spring (see Section 2, Accent Rule Draw pattern)
- Enter **after** the label, **before** the headline begins to appear

### Level 3 — Headline

The headline is the primary statement of the phase. It should be large enough to read
comfortably from across the room.

```ts
{
  fontFamily: FONTS.heading,        // Georgia serif
  fontSize: 48,                     // 48–72px range; 64px is the workhorse value
  fontWeight: 700,
  color: PALETTE.text,              // near-white or near-black depending on palette
  lineHeight: 1.2,
}
```

- Always `FONTS.heading` (Georgia serif) — never Inter for headlines
- Size range: 48–72px. Use 64px for most phases; 72px for hero/impact moments; 48px for
  phases with long multi-line headlines that would otherwise overflow
- `fontWeight: 700` — bold, no exceptions
- `lineHeight: 1.2` — tight enough for drama, open enough to read on two-line wraps
- Key words may be colored (see Section 3 — Word Color Emphasis)

### Level 4 — Body

Supporting text that elaborates on the headline. Reads at narration pace.

```ts
{
  fontFamily: FONTS.body,           // Inter
  fontSize: 28,                     // 28–32px range
  fontWeight: 400,
  color: PALETTE.textMuted,         // muted variant — not full white
  lineHeight: 1.5,
}
```

- Always `FONTS.body` (Inter) — never Georgia for body copy
- Size range: 28–32px. Use 28px default, 32px for short 1-line body lines that need weight
- `fontWeight: 400` — regular weight; the headline does the heavy lifting
- `color: PALETTE.textMuted` — deliberately quieter than the headline
- `lineHeight: 1.5` — generous for readability across multiple lines

### Hierarchy Summary Table

| Level | Element | Font | Size | Weight | Color |
|-------|---------|------|------|--------|-------|
| 1 | Label | `FONTS.body` | 34px | 400 | `PALETTE.secondary` |
| 2 | Accent Rule | — | 60×3px | — | `PALETTE.secondary` |
| 3 | Headline | `FONTS.heading` | 48–72px | 700 | `PALETTE.text` |
| 4 | Body | `FONTS.body` | 28–32px | 400 | `PALETTE.textMuted` |

### What You Can Omit (and When)

- **No label**: Only if the scene narrative makes the category self-evident (e.g. a closing
  thesis statement that follows multiple labeled phases). Use sparingly.
- **No accent rule**: If you omit the label, omit the rule too. They are a pair.
- **No body**: Short-form phases (hook, dramatic reveal) can be headline-only.
- **Never omit the headline**: Every text phase needs a primary statement.

---

## 2. Text Animation Patterns

All text animations use Remotion's `spring()` function. Never use raw `interpolate()` for
text entrances — spring physics give the natural overshoot and settle that reads as cinematic.

### Pattern A — Spring Slam (vertical drop)

Text drops from 40px above its resting position with a slight overshoot, then settles.
This is the default entrance for headlines and body copy.

```tsx
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// delay: frame offset to stagger multiple elements
const slamProgress = spring({
  frame: Math.max(0, frame - delay),
  fps,
  config: { damping: 14, stiffness: 280, mass: 0.8 },
});

const translateY = interpolate(slamProgress, [0, 1], [40, 0]);
const opacity    = interpolate(slamProgress, [0, 1], [0, 1]);

// Apply to element:
style={{ transform: `translateY(${translateY}px)`, opacity }}
```

Config rationale:
- `stiffness: 280` — fast initial move
- `damping: 14` — slight overshoot before settling
- `mass: 0.8` — lighter feel; snappier than a heavy object

### Pattern B — Scale Slam (scale-down settle)

Text enters slightly oversized (1.15x) and scales down to its natural size. Use for
hero headlines and high-impact moments. Combine with Spring Slam for maximum impact.

```tsx
const scaleProgress = spring({
  frame: Math.max(0, frame - delay),
  fps,
  config: { damping: 10, stiffness: 200 },
  from: 1.15,
  to: 1.0,
});

// Apply to element:
style={{ transform: `scale(${scaleProgress})` }}
```

Config rationale:
- `from: 1.15` — enters 15% larger; noticeable but not jarring
- `damping: 10` — more overshoot than Spring Slam; the scale bounces a touch past 1.0
- `stiffness: 200` — slightly slower than the position spring; they settle at different rates,
  which creates a more organic compound motion

**Combining both:** Apply translateY from Pattern A and scale from Pattern B simultaneously
on the same element for the most impactful headline entrance:

```tsx
style={{
  transform: `translateY(${translateY}px) scale(${scaleProgress})`,
  opacity,
}}
```

### Pattern C — Stagger Reveal (sequential hierarchy entrance)

Each level of the hierarchy enters after the previous one, creating a cascade that guides
the viewer's eye from label → rule → headline → body.

Standard stagger offsets (in frames at 30fps):

```tsx
const { fps } = useVideoConfig();
const frame = useCurrentFrame();

// Label enters first
const labelProgress = spring({
  frame: Math.max(0, frame - 0),
  fps,
  config: MOTION.springSnappy,
});

// Rule enters ~8 frames after label
const ruleProgress = spring({
  frame: Math.max(0, frame - 8),
  fps,
  config: MOTION.springSnappy,
});

// Headline enters ~14 frames after label (6 frames after rule)
const headlineProgress = spring({
  frame: Math.max(0, frame - 14),
  fps,
  config: MOTION.springSnappy,
});

// Body enters ~30 frames after label (16 frames after headline)
const bodyProgress = spring({
  frame: Math.max(0, frame - 30),
  fps,
  config: MOTION.springSnappy,
});
```

Stagger timing guidelines:
- Label → Rule gap: 6–8 frames (rule should start drawing while label is still settling)
- Rule → Headline gap: 6–8 frames (headline enters as rule finishes drawing)
- Headline → Body gap: 14–18 frames (body waits for headline to fully settle)
- If a phase has only headline + body (no label/rule), use a 12–16 frame gap between them

Never set all delays to 0. Simultaneous entrances read as a static slide, not animation.

### Pattern D — Accent Rule Draw

The accent rule grows from left to right using `scaleX`. This is a dedicated pattern
for the rule element only.

```tsx
const ruleProgress = spring({
  frame: Math.max(0, frame - ruleDelay),
  fps,
  config: { damping: 18, stiffness: 300 },  // faster than text springs — rule is small
});

// The rule element:
<div
  style={{
    width: 60,
    height: 3,
    background: PALETTE.secondary,
    transform: `scaleX(${ruleProgress})`,
    transformOrigin: 'left',     // CRITICAL: grows from left, not center
    margin: '12px 0',
  }}
/>
```

- `transformOrigin: 'left'` is not optional. `center` (the CSS default) would make it
  grow from the middle, which looks wrong and breaks the left-aligned visual rhythm.
- `damping: 18, stiffness: 300` — the rule should draw faster than text; it is a small
  element and a slower draw feels sluggish at this scale.

---

## 3. Word Color Emphasis

Headlines can color individual words to direct the viewer's attention. This should be
used sparingly and purposefully — coloring everything is the same as coloring nothing.

### Rules

- Maximum **1–2 emphasized words** per headline
- Use `PALETTE.secondary` (`#C4373B`) for primary emphasis (warning, critical, key noun)
- Use `PALETTE.accent` (`#C4873B`) for secondary emphasis (supporting word, contrast)
- Never color the entire headline — the non-colored words provide the contrast that makes
  the colored words pop
- Prefer coloring **nouns and key descriptors**, not verbs or prepositions

### Implementation

Use a React fragment with an inline `span`. Do not use a wrapper element that changes layout.

```tsx
// Single emphasis word
const headline = (
  <>Carries a <span style={{ color: PALETTE.secondary }}>robotic arm</span> that can latch onto a hostile spacecraft.</>
);

// Two emphasis words (use accent for the second)
const headline2 = (
  <><span style={{ color: PALETTE.secondary }}>$4.2 billion</span> deployed across <span style={{ color: PALETTE.accent }}>six continents</span>.</>
);

// In the component:
<h1
  style={{
    fontFamily: FONTS.heading,
    fontSize: 64,
    fontWeight: 700,
    color: PALETTE.text,
    lineHeight: 1.2,
    transform: `translateY(${translateY}px) scale(${scaleProgress})`,
    opacity,
  }}
>
  {headline}
</h1>
```

The `span` inherits the parent's `fontFamily`, `fontSize`, `fontWeight`, and `lineHeight`.
Only `color` needs to be overridden.

---

## 4. Text Panel Padding

Text panels must have generous padding to prevent clipping and to create the visual
breathing room that separates cinematic work from amateur slideshows.

### Focal-Offset Text Panel (split layout, text on the left or right)

Used when an image occupies one side and text occupies the other.

```tsx
padding: '120px 80px 120px 60px'
// top: 120px | right: 80px | bottom: 120px | left: 60px
```

The asymmetric left/right values account for the panel edge proximity. The left padding
(60px) is slightly tighter because the panel itself has a margin from the frame edge.

### Centered Hero Text

Used when text is the primary element occupying most of the frame.

```tsx
padding: '120px 200px'
// top/bottom: 120px | left/right: 200px
```

Wide horizontal margins keep centered text from spreading to near-legibility limits on
long lines. If a headline needs to be wider, increase the font size rather than
decreasing the padding.

### Lower-Third Text Area

Used for text anchored to the lower portion of the frame, above the subtitle strip.

```tsx
padding: '24px 80px 120px 80px'
// top: 24px | right/left: 80px | bottom: 120px
```

The 120px bottom padding keeps all text clear of the subtitle strip (bottom 20% of
the frame). The 24px top is intentionally tight — this content is bottom-anchored.

### Hard Floor Rule

**NEVER let any text get within 80px of any frame edge.**

This is the `SAFE.min` value from the safe-zones guide. It applies to all text in all
directions — top, right, bottom, left. The 120px bottom padding on lower-third panels
already satisfies this with room to spare.

---

## 5. Anti-Patterns — What NOT to Do

These are the failure modes that make motion graphics look like PowerPoint. Treat
these as hard rules, not guidelines.

### 1. Plain Opacity Fade (no spring physics)

```tsx
// WRONG
const opacity = interpolate(frame, [0, 20], [0, 1]);
style={{ opacity }}

// RIGHT — use spring() for all text entrances
const progress = spring({ frame, fps, config: MOTION.springSnappy });
const opacity = interpolate(progress, [0, 1], [0, 1]);
```

Linear fades have no personality. Spring physics give text a sense of weight and
intention. Even a simple fade should use `spring()` to get the natural easing.

### 2. Simultaneous Entrance (no stagger)

```tsx
// WRONG — all elements enter at frame 0 simultaneously
const label    = spring({ frame, fps, config: MOTION.springSnappy });
const headline = spring({ frame, fps, config: MOTION.springSnappy });
const body     = spring({ frame, fps, config: MOTION.springSnappy });

// RIGHT — staggered entrances (see Section 2, Pattern C)
const label    = spring({ frame: Math.max(0, frame - 0),  fps, config: MOTION.springSnappy });
const headline = spring({ frame: Math.max(0, frame - 14), fps, config: MOTION.springSnappy });
const body     = spring({ frame: Math.max(0, frame - 30), fps, config: MOTION.springSnappy });
```

Simultaneous entrances collapse the hierarchy — the viewer cannot tell what to read
first. Stagger is not optional.

### 3. No Hierarchy (flat design)

```tsx
// WRONG — all text looks the same
<p style={{ fontSize: 40, fontWeight: 400, color: '#fff' }}>TECHNOLOGY</p>
<p style={{ fontSize: 40, fontWeight: 400, color: '#fff' }}>The satellite carries a robotic arm</p>
<p style={{ fontSize: 40, fontWeight: 400, color: '#fff' }}>that can latch onto hostile spacecraft</p>

// RIGHT — distinct levels (label → headline → body)
<p style={{ fontSize: 34, letterSpacing: '0.15em', color: PALETTE.secondary }}>TECHNOLOGY</p>
<h2 style={{ fontSize: 64, fontWeight: 700, fontFamily: FONTS.heading, color: PALETTE.text }}>
  The satellite carries a <span style={{ color: PALETTE.secondary }}>robotic arm</span>
</h2>
<p style={{ fontSize: 28, color: PALETTE.textMuted, lineHeight: 1.5 }}>
  that can latch onto hostile spacecraft
</p>
```

### 4. Text Too Close to Edges (clipping risk)

Any text within 80px of a frame edge will be partially cut off on some displays,
crop incorrectly in thumbnails, and violate broadcast safe zones.

```tsx
// WRONG — no padding, text may clip at edges
<AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start' }}>
  <h1>Headline</h1>
</AbsoluteFill>

// RIGHT — always wrap with safe padding
<AbsoluteFill style={{
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  padding: '120px 80px',
}}>
  <h1>Headline</h1>
</AbsoluteFill>
```

### 5. No Word Emphasis (flat headlines)

```tsx
// WRONG — everything the same color; nothing stands out
<h1 style={{ color: PALETTE.text }}>
  India will deploy a 45-tonne satellite by 2026
</h1>

// RIGHT — key data point colored for emphasis
<h1 style={{ color: PALETTE.text }}>
  India will deploy a <span style={{ color: PALETTE.secondary }}>45-tonne satellite</span> by 2026
</h1>
```

Headlines without emphasis are missed opportunities. The colored word is the thing
the viewer should remember from this phase.

### 6. Missing Label or Accent Rule (slideshow aesthetic)

A headline that appears without a label and accent rule looks like a presentation
slide. The label/rule combination is the signal to the viewer that this is crafted,
intentional, cinematic typography — not a bullet point.

Exception: thesis/closing phases with extremely large hero text (72px+) may omit the
label when the headline is self-evidently the climactic statement of the video.

### 7. Plain Static Label on an Image (user-flagged, LEARNINGS §44)

A plain static two-line label dropped on an image — no motion, no accent, no
hierarchy — is a HARD FAIL: "it can't be this simple." Every text overlay
moment needs deliberate typographic design:

- **Scale hierarchy** between the hero line and support line
- **Staggered kinetic entrance** (Pattern C — never a single simultaneous fade)
- **An animated accent** — rule draw, underline, highlight wash, or indicator dot
- **Ambient life** through the hold (subtle breathe/pulse — never a frozen frame)
- **Diegetic ties** where the image offers a hook (a warning lamp, an instrument):
  tie the type's motion to it

If a phase's text would read the same as a static lower-third caption, redesign it.

---

## 6. Complete Phase Example

A fully-implemented focal-offset text phase demonstrating all four hierarchy levels
with staggered spring animations:

```tsx
import { spring, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

export const TextPhase: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const f = Math.max(0, frame - startFrame);

  // Staggered springs per hierarchy level
  const labelP = spring({ frame: Math.max(0, f - 0),  fps, config: MOTION.springSnappy });
  const ruleP  = spring({ frame: Math.max(0, f - 8),  fps, config: { damping: 18, stiffness: 300 } });
  const headP  = spring({ frame: Math.max(0, f - 14), fps, config: { damping: 14, stiffness: 280, mass: 0.8 } });
  const bodyP  = spring({ frame: Math.max(0, f - 30), fps, config: MOTION.springSnappy });
  const scaleP = spring({ frame: Math.max(0, f - 14), fps, config: { damping: 10, stiffness: 200 }, from: 1.15, to: 1.0 });

  const labelY = interpolate(labelP, [0, 1], [24, 0]);
  const headY  = interpolate(headP,  [0, 1], [40, 0]);
  const bodyY  = interpolate(bodyP,  [0, 1], [28, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '50%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '120px 80px 120px 60px',
        boxSizing: 'border-box',
      }}
    >
      {/* Level 1: Label */}
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 34,
          fontWeight: 400,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: PALETTE.secondary,
          opacity: labelP,
          transform: `translateY(${labelY}px)`,
          marginBottom: 4,
        }}
      >
        Technology
      </div>

      {/* Level 2: Accent Rule */}
      <div
        style={{
          width: 60,
          height: 3,
          background: PALETTE.secondary,
          transform: `scaleX(${ruleP})`,
          transformOrigin: 'left',
          margin: '12px 0',
        }}
      />

      {/* Level 3: Headline with word emphasis */}
      <h2
        style={{
          fontFamily: FONTS.heading,
          fontSize: 64,
          fontWeight: 700,
          color: PALETTE.text,
          lineHeight: 1.2,
          margin: '0 0 24px',
          opacity: headP,
          transform: `translateY(${headY}px) scale(${scaleP})`,
        }}
      >
        Carries a{' '}
        <span style={{ color: PALETTE.secondary }}>robotic arm</span>
        {' '}that can latch onto a hostile spacecraft.
      </h2>

      {/* Level 4: Body */}
      <p
        style={{
          fontFamily: FONTS.body,
          fontSize: 28,
          fontWeight: 400,
          color: PALETTE.textMuted,
          lineHeight: 1.5,
          margin: 0,
          opacity: bodyP,
          transform: `translateY(${bodyY}px)`,
        }}
      >
        The docking mechanism operates autonomously using computer vision
        guidance, requiring no ground intervention.
      </p>
    </div>
  );
};
```
