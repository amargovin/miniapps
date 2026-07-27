# Composition Templates

Eight named spatial layouts. The template is assigned in the
ontology. The creative metaphor should fit the template — if
your visual idea doesn't fit, simplify the idea or update
the ontology.

**Exception — Hero Template Blending:** Scenes with
`weight_class: hero` may combine elements from TWO templates
to create a distinctive composition. Declare both in the
ontology as `composition_template: [primary, secondary]`.
The primary template defines the overall spatial structure;
the secondary contributes one element or zone. This is
reserved for the 1-3 hero scenes per video — supporting
and connective scenes use exactly one template.

## Template Index

| Template | Best For | Max Elements (dense) | Max Elements (clean) | Feel |
|----------|----------|---------------------|---------------------|------|
| centered-hero | Stats, reveals, emotional peaks | 3 | 2 | Bold, focused |
| lower-third | Narration, context-setting | 3 | 2 | Cinematic, grounded |
| split-compare | Comparisons, before/after | 4 (2 per panel) | 3 (1+label per panel) | Analytical, clear |
| stacked-reveal | Lists, processes, sequences | 3 | 2 | Structured, rhythmic |
| orbit | Systems, ecosystems, relationships | 5 (1 center + 4 sat) | 3 (1 center + 2 sat) | Dynamic, connected |
| panoramic-flow | Timelines, journeys, processes | 4 | 3 | Sweeping, directional |
| focal-offset | Asymmetric emphasis, editorial feel | 4 | 3 | Dynamic, cinematic |
| grid | Multi-item showcase, comparisons | 6 (2×3) | 4 (2×2) | Structured, dense |

**Rich composition rule (§44) applies to every template** — "label" never
means a lone static caption floating in a corner. See "Composition Doctrine"
at the end of this file for the full, authoritative rules.

---

## centered-hero

Single focal element at frame center. Maximum visual impact.

```
+------------------------------------------+
|              [title-safe]                |
|                                          |
|          ┌─ SUPPORT TEXT ─┐              |
|          │                │              |
|          │   ┌────────┐   │              |
|          │   │  HERO  │   │              |
|          │   │ ELEMENT│   │              |
|          │   └────────┘   │              |
|          │                │              |
|          └─ SUPPORT TEXT ─┘              |
|                                          |
+------------------------------------------+
```

**CSS pattern:**
```tsx
<AbsoluteFill style={{
  justifyContent: 'center',
  alignItems: 'center',
  background: PALETTE.bg,
}}>
  {/* Hero element: max 40% frame width, centered */}
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 32,
    maxWidth: '40%',
  }}>
    {/* Optional top text */}
    {/* Hero visual */}
    {/* Optional bottom text */}
  </div>
</AbsoluteFill>
```

**Rules:**
- Hero element occupies max 40% of frame width
- Supporting text above and/or below, within title-safe (192px)
- Max 3 elements total (hero + up to 2 text elements)
- Background is clean — no competing visuals
- All content within a 768px-wide vertical column

**Works well with:** ripple-expand, spring-physics,
posterize-stutter, speed-remap

---

## lower-third

Hero visual in upper frame, text bar anchored to bottom.
Classic documentary/news feel.

```
+------------------------------------------+
|              [title-safe]                |
|                                          |
|          ┌────────────────┐              |
|          │  HERO VISUAL   │              |
|          │  (upper 60%)   │              |
|          └────────────────┘              |
|                                          |
|  ── breathing room (10%) ──────────────  |
|                                          |
|  ┌──────────────────────────────────┐    |
|  │  TEXT BAR (lower 25%)            │    |
|  │  Title + subtitle                │    |
|  └──────────────────────────────────┘    |
+------------------------------------------+
```

**CSS pattern:**
```tsx
<AbsoluteFill style={{
  background: PALETTE.bg,
}}>
  {/* Upper visual area: top 60% */}
  <div style={{
    position: 'absolute',
    top: 96, left: 192, right: 192,
    height: '55%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }}>
    {/* Hero visual */}
  </div>

  {/* Lower third text bar */}
  <div style={{
    position: 'absolute',
    bottom: 96, left: 192, right: 192,
    height: '20%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  }}>
    {/* Title text */}
    {/* Subtitle or attribution */}
  </div>
</AbsoluteFill>
```

**Rules:**
- Hero visual in upper 55-60% of frame
- Text in lower 20-25%, above action-safe (96px)
- 10% breathing room between visual and text
- Max 3 elements (1 visual + 2 text lines)
- Text is large — 48px+ title, 30px+ subtitle; lower-third NAMES ≥56px
  (typography.md floors, §43)
- The text bar is a composed block with hierarchy and an animated accent
  (rule draw under the title, staggered entrance) — never two static lines
  dropped on the frame (Composition Doctrine, §44)

**Works well with:** typography, spring-physics,
arc-wipe, dither-dissolve

---

## split-compare

Two panels side by side. Each panel has ONE focal element.

```
+------------------------------------------+
|              [title-safe]                |
|                                          |
|   ┌───────────┐ │ ┌───────────┐         |
|   │  PANEL A  │ │ │  PANEL B  │         |
|   │           │ │ │           │         |
|   │  [focal]  │ │ │  [focal]  │         |
|   │           │ │ │           │         |
|   │  label    │ │ │  label    │         |
|   └───────────┘ │ └───────────┘         |
|                  │                       |
|          [optional shared label]         |
+------------------------------------------+
```

**CSS pattern:**
```tsx
<AbsoluteFill style={{
  background: PALETTE.bg,
  flexDirection: 'row',
}}>
  {/* Panel A: 50% (or 60% if dominant) */}
  <div style={{
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 96,
  }}>
    {/* One focal element */}
    {/* One label */}
  </div>

  {/* Divider */}
  <div style={{
    width: 2,
    background: `${PALETTE.text}22`,
    margin: '96px 0',
  }} />

  {/* Panel B: 50% (or 40%) */}
  <div style={{
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 96,
  }}>
    {/* One focal element */}
    {/* One label */}
  </div>
</AbsoluteFill>
```

**Rules:**
- Two panels: 50/50 or 60/40 split
- Each panel has exactly ONE focal element + ONE label
- Max 4 total (2 visuals + 2 labels)
- Clear divider between panels (thin line or gap)
- Panels can animate independently (spring divider position)
- Optional shared label below both panels

**Works well with:** split-screen, spring-physics,
dither-dissolve, typography

---

## stacked-reveal

2-3 elements stacked vertically, revealed sequentially.

```
+------------------------------------------+
|              [title-safe]                |
|                                          |
|          ┌────────────────┐              |
|          │  ELEMENT 1     │  ← reveal 1  |
|          └────────────────┘              |
|                 ↕ 48px                   |
|          ┌────────────────┐              |
|          │  ELEMENT 2     │  ← reveal 2  |
|          └────────────────┘              |
|                 ↕ 48px                   |
|          ┌────────────────┐              |
|          │  ELEMENT 3     │  ← reveal 3  |
|          └────────────────┘              |
|                                          |
+------------------------------------------+
```

**CSS pattern:**
```tsx
<AbsoluteFill style={{
  background: PALETTE.bg,
  justifyContent: 'center',
  alignItems: 'center',
}}>
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 48,
    maxWidth: '60%',
  }}>
    {/* Element 1: revealed first */}
    {/* Element 2: revealed second (staggered 15-20 frames) */}
    {/* Element 3: revealed third (staggered 15-20 frames) */}
  </div>
</AbsoluteFill>
```

**Rules:**
- 2-3 elements maximum, center-aligned vertically
- Sequential reveal: top-to-bottom, staggered 15-20 frames
- Each element is a complete unit (visual + label together)
- 48px gap between elements
- All elements within 60% frame width
- Use spring entrance (springSnappy or springBouncy)

**Works well with:** sequencing, spring-physics, typography,
card-flip-3d

---

## orbit

Central element with 2-4 satellites in orbital arrangement.

```
+------------------------------------------+
|              [title-safe]                |
|                                          |
|              ○ sat-1                     |
|             ╱                            |
|    sat-4 ○─── ■ CENTER ───○ sat-2       |
|             ╲                            |
|              ○ sat-3                     |
|                                          |
|          [optional label below]          |
+------------------------------------------+
```

**CSS pattern:**
```tsx
<AbsoluteFill style={{
  background: PALETTE.bg,
  justifyContent: 'center',
  alignItems: 'center',
}}>
  {/* Center element */}
  <div style={{
    position: 'absolute',
    // Dead center of frame
  }}>
    {/* Central visual — largest element */}
  </div>

  {/* Satellites — positioned with transform + rotation */}
  {satellites.map((sat, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const radius = 280; // orbit radius
    return (
      <div key={i} style={{
        position: 'absolute',
        left: 960 + Math.cos(angle) * radius - satSize / 2,
        top: 540 + Math.sin(angle) * radius - satSize / 2,
      }}>
        {/* Satellite visual — smaller than center */}
      </div>
    );
  })}
</AbsoluteFill>
```

**Rules:**
- 1 center element (largest, primary focus)
- 2-4 satellite elements (smaller, supporting)
- Max 5 total elements
- Satellites spring inward from off-screen
- Center element appears first, satellites stagger in
- Optional connecting lines (thin, subtle) from center to satellites
- Orbit radius: 250-350px from center

**Works well with:** particle-systems, spring-physics,
ripple-expand, sequencing

---

## panoramic-flow

Horizontal movement across the frame. Camera-move feel.

```
+------------------------------------------+
|              [title-safe]                |
|                                          |
|  ← ── ── [elem1] ── [elem2] ── [elem3]  |
|                                          |
|         flow direction →                 |
|                                          |
|  ── connecting line / flow path ──────── |
|                                          |
|          [optional narration]            |
+------------------------------------------+
```

**CSS pattern:**
```tsx
<AbsoluteFill style={{
  background: PALETTE.bg,
  overflow: 'hidden',
}}>
  {/* Scrolling container — translateX animated */}
  <div style={{
    position: 'absolute',
    top: '20%',
    height: '50%',
    display: 'flex',
    alignItems: 'center',
    gap: 120,
    transform: `translateX(${scrollX}px)`,
  }}>
    {/* Element 1 */}
    {/* Connecting flow line */}
    {/* Element 2 */}
    {/* Connecting flow line */}
    {/* Element 3 */}
  </div>

  {/* Fixed narration text — lower third */}
  <div style={{
    position: 'absolute',
    bottom: 96, left: 192, right: 192,
  }}>
    {/* Text */}
  </div>
</AbsoluteFill>
```

**Rules:**
- Elements arranged horizontally, animated via translateX
- Max 4 elements in the flow
- Elements connected by lines, arrows, or flow paths
- Flow enters from right, moves left (reading direction)
- Fixed text anchor in lower third (doesn't scroll)
- Scrolling is spring-driven, not linear

**Works well with:** speed-remap, spring-physics,
sequencing, typography

---

## focal-offset

Hero element placed at the rule-of-thirds intersection,
not dead center. Creates visual tension and cinematic
asymmetry. The opposite side holds supporting context
or breathes as negative space.

```
+------------------------------------------+
|              [title-safe]                |
|     ·              ·              ·      |
|                                          |
|     · ┌────────┐   ·              ·      |
|       │  HERO  │                         |
|       │ ELEMENT│        [supporting      |
|     · └────────┘   ·    text or          |
|                         negative space]  |
|     ·              ·              ·      |
|                                          |
+------------------------------------------+
```

**CSS pattern:**
```tsx
<AbsoluteFill style={{
  background: PALETTE.bg,
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
}}>
  {/* Hero zone: left third (or right third — pick per scene) */}
  <div style={{
    flex: '0 0 45%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '96px 64px 96px 192px',
  }}>
    {/* Hero element */}
  </div>

  {/* Supporting zone: remaining space */}
  <div style={{
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '96px 192px 96px 64px',
    gap: 24,
  }}>
    {/* Supporting text, stat, or leave empty for negative space */}
  </div>
</AbsoluteFill>
```

**Rules:**
- Hero element in left OR right ~40-45% of frame
- Placement at rule-of-thirds line (roughly 640px or 1280px horizontal)
- Supporting content on opposite side — text, small visual, or empty
- Max 3 elements (editorial-clean), 4 elements (cinematic-dense)
- Hero element can be larger than centered-hero (up to 50% frame width)
  since it's offset and balanced by negative space
- Flip direction (hero left vs right) scene-to-scene for variety
- Title-safe margins still apply: 192px edges
- When the hero is an IMAGE, the supporting zone must be a composed text
  block (eyebrow + headline + support + animated accent, staggered entrance)
  or deliberate negative space — NEVER a lone small label stranded in the
  opposite corner (Composition Doctrine, §44)

**Works well with:** spring-physics, clip-path-reveal,
depth-blur, speed-remap, typography

---

## grid

2×2 or 2×3 arrangement for showing multiple items
simultaneously. Each cell holds one element + optional label.
Staggered reveals prevent visual overload.

```
+------------------------------------------+
|              [title-safe]                |
|                                          |
|   ┌──────────┐  48px  ┌──────────┐      |
|   │  CELL 1  │        │  CELL 2  │      |
|   │  [item]  │        │  [item]  │      |
|   │  label   │        │  label   │      |
|   └──────────┘        └──────────┘      |
|               48px                       |
|   ┌──────────┐  48px  ┌──────────┐      |
|   │  CELL 3  │        │  CELL 4  │      |
|   │  [item]  │        │  [item]  │      |
|   │  label   │        │  label   │      |
|   └──────────┘        └──────────┘      |
|                                          |
+------------------------------------------+
```

**CSS pattern:**
```tsx
<AbsoluteFill style={{
  background: PALETTE.bg,
  justifyContent: 'center',
  alignItems: 'center',
}}>
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 48,
    padding: '96px 192px',
    maxWidth: '85%',
  }}>
    {items.map((item, i) => {
      const delay = i * 18; // stagger: 18 frames per cell
      const entrance = spring({
        frame,
        fps,
        config: MOTION.springSnappy,
        delay,
      });
      return (
        <div key={i} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          opacity: interpolate(entrance, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(entrance, [0, 1], [30, 0])}px)`,
        }}>
          {/* Visual element */}
          {/* Label */}
        </div>
      );
    })}
  </div>
</AbsoluteFill>
```

**Rules:**
- 2×2 (4 cells) for editorial-clean, up to 2×3 (6 cells) for cinematic-dense
- Each cell has ONE visual element + ONE optional label
- Stagger reveals: 15-20 frames between cells
- Reveal order: top-left → top-right → bottom-left → bottom-right (Z-pattern)
- All cells are equal size — no cell dominates
- 48px gap between cells, title-safe margins on edges
- Optional shared title above or below the grid
- Cells can have subtle borders or backgrounds to define regions

**When to prefer over stacked-reveal:**
- 4+ items that are peers (not a ranked sequence)
- Comparison across multiple dimensions
- Feature grids, geographic spread, category breakdowns

**Works well with:** card-flip-3d, spring-physics,
stagger timing, dither-dissolve, clip-path-reveal

---

## Choosing a Template

Decision tree for template selection:

1. Is there ONE dominant visual? → **centered-hero**
2. Is there ONE dominant visual with asymmetric tension? → **focal-offset**
3. Is there a comparison (A vs B)? → **split-compare**
4. Are there 4+ peer items to show simultaneously? → **grid**
5. Is there a list or ranked sequence (2-3 items)? → **stacked-reveal**
6. Is there a system with connected parts? → **orbit**
7. Is there a journey or timeline? → **panoramic-flow**
8. Is this narration/context-setting? → **lower-third**

**focal-offset vs centered-hero:** Use focal-offset when the
scene benefits from visual tension or editorial asymmetry —
the hero element is important but isn't the ONLY thing on
screen. Use centered-hero when the hero element demands
total focus with nothing else competing.

**grid vs stacked-reveal:** Use grid when items are peers
(no ranking, no sequence). Use stacked-reveal when order
matters or there are only 2-3 items.

If you cannot fit your scene into any template, the visual
concept may be too complex. Consider simplifying.

---

## Composition Doctrine (July 2026 — canonical for §8, §26, §44, §46f, §49, §53)

This section reconciles the July 2026 user feedback into one authoritative
doctrine for how image and text share a frame. It overrides the template
defaults above wherever they conflict.

### 1. Integrated full-bleed supersedes focal-offset (§49)

User verdict: "split compositions with image on one side and text on
another — very boring." Focal-offset and split-compare are DEMOTED from
default choices — an image column beside a text panel is an ARRANGEMENT, not
a composition: the image is cropped into a column, the text floats on dead
flat space, and nothing interacts.

The default replacement — **integrated full-bleed**:
1. **Generate the image WITH designed negative space** — prompt the subject
   off-centre and demand clear sky / soft shadow / open ground on the side
   where text will live ("subject in right third, vast clear sky
   upper-left"). 16:9 native — no more cropping 1:1 panels out of it.
2. Run a gentle camera move over the full-bleed image (cam keyframes).
3. Set the composed text block INTO the negative space (scrim chip only if
   contrast demands), and WORLD-PIN any label that names a thing in the
   image (§47, illustrated-plate.md).
The image becomes the environment for the words, not a neighbour.

**When a split IS the story** (explicit A-vs-B comparison), make the split
itself alive — at least one of:
- **Diagonal or curved divider** (clip-path), never a straight vertical rule
- **Subject breakout**: the subject crosses the divider (nose of the jet
  overlaps the text side)
- **Animated divider**: the boundary MOVES during the phase as narration
  shifts attention (55/45 → 30/70), text reflowing in choreography
- Panels acknowledge each other: colour echo, connector, shared horizon line

A static straight-divider split with a flat text panel is a review FAIL
unless the narration is an explicit two-thing comparison AND one of the
techniques above is applied.

### 2. Rich phase composition — no "lone label + image" phases (§44)

User verdict: "too simplistic depiction — text is in one corner, image in
another, we want rich depictions." A phase consisting of one small text label
in one corner and an image in another — especially an image crushed by dark
overlays — reads as dead air. Every image phase must be one of:

1. **Composed text block**: eyebrow + headline-weight line + supporting
   detail, tied together with an animated accent (rule draw, bracket,
   highlight wash), left-aligned in the safe zone, with entrance/ambient/exit
   choreography and a gentle Ken Burns on the image; OR
2. **Narration-led full-bleed**: the image itself is rich and luminous enough
   to carry the frame (light-touch treatment per editorial-design.md §11.1 —
   never crushed), with text minimal or absent.

Corner-text + corner-image flatness is a HARD FAIL in the producer's visual
still review (§34).

**Extension — text treatments too (user: "it can't be this simple"):** a
plain static two-line label dropped on an image is equally a fail. Every text
overlay moment needs deliberate typographic design — scale hierarchy between
hero line and support line, staggered kinetic entrance, an animated accent
(rule draw, underline, highlight wash, indicator dot), and ambient life
(breathe/pulse) through the hold. Where the image offers a diegetic hook (a
cockpit warning lamp, an instrument), tie the type's motion to it. If a
phase's text would read the same as a lower-third caption, redesign it.

**Sanctioned split exceptions (July 2026 sweep verdicts):**
1. **Designed editorial spreads** — multi-item ledger/audit layouts (cream
   ledger panels with rules, stamps, line items). A composed print grammar
   and the film's variety breather, not a lazy split.
2. **Live-diagram splits** — when the second panel is an ANIMATED diagram or
   counter (photo | radar-fan draw + counting stat). Both halves alive = the
   split earns itself.
Everything else converts to integrated full-bleed.

### 3. Broadcast text cards — the TV-news grammar for image+text (§53)

User doctrine: "Unlike in television programs where a text card is almost
70-80% of the screen width in two parts — a caption part maybe 20% of element
height, and remaining 80% for text — think news programs. Otherwise the
graphics just look like bad PPT."

Small floating chips/labels on an image are PRINT graphics pasted on video.
The grammar (component ships in scaffold: `src/BroadcastCard.tsx`):
- **KICKER tab**: short accent band (~20% of card height), mono caps, brand
  red/accent background — the category/context line
- **MAIN bar**: the dominant text area (~80% of card height), 56-84px heading
  type on a solid bar — the actual statement
- **70-80% of screen width**, anchored lower-left ABOVE the subtitle floor
- **ONE message per card per phase** (user correction, July 2026): a typical
  phase is 5-7s and the card enters 2-3s in — there is no time for strap
  swaps; a swapped text fragments the read and nothing registers. The
  `items[]` swap API is RESERVED for rare ≥10s phases where every message
  still gets ≥3s of hold. Default: single kicker + single main, held to the
  phase end.

Usage rules:
- DEFAULT for image+text phases (full-bleed imagery + broadcast card).
  Floating chips are demoted to minor in-image annotations only.
- World-pinned callouts (§47) remain the tool for NAMING things in the
  image; the broadcast card carries the SENTENCE-level message.
- Card text follows the §52 role-sizing rule (typography.md): the main bar
  is the phase's statement — size it like one.

**Reference exemplar — person-introduction phases (user: "brilliant"):**
full-bleed environmental portrait (subject in the right third, vast open sky
as designed negative space), slow push toward the subject, BroadcastCard with
the person's NAME as the main line landing exactly on the spoken-name beat
(e.g. "THE FRAMEWORK / Sameer Joshi — ex-IAF Mirage pilot", 4s hold). When a
script introduces a person, author the phase to this pattern.

### 4. Rich images need hold time — merge worlds across short phases (§46f)

A spectacular image on a ~≤180f phase "is cut short too quickly, doesn't get
time for registering in audience mind." When a rich new image lands on a
short whisper-pinned phase, carry it through the ADJACENT phase as a
continuity world: the next phase renders its text/content over the same image
with the camera move continuing (end state = next start state). Durations
never change — only the background persists. Switch visuals on short phases
only when both neighbours are already image-rich.

Corollary: on a SHORT narration-led plate/photo beat, prefer NO text over a
fleeting label that restates the narration — that is §25 text-karaoke with
too little screen time to read anyway. Drop the label; let the phase breathe.

### 5. Text placement — never right-aligned or top-right (§26)

- **Text goes LEFT, image goes RIGHT** in offset/split layouts
- `alignItems: 'flex-start'` (left-align) — NEVER `'flex-end'` (right-align,
  which pushes text under the burned-in top-right logo)
- `justifyContent: 'flex-start'` (top) or `'center'` — acceptable
- The top-right quadrant (~right 300px × top 200px) is ALWAYS logo territory
- Lower-third text is left-aligned at `left: 80-192px`, never right-aligned
  or centered-right

### 6. Visual variety across scenes (§8)

- Never 3+ consecutive scenes with the same treatment
- At least 20% of runtime low-text or no-text (narration-led)
- Vary text layout: centered, left-aligned, top-left, split
- Solid-bg phases sparingly for maximum dramatic contrast (1-2 per video)
- Mix backdrop phases between pure text phases — no scene entirely text

### Extended composition vocabulary

Beyond integrated full-bleed, five sanctioned compositions — all generation +
existing machinery, no new infrastructure:

1. **Diegetic typography** — stats/labels rendered as part of the world:
   perspective-warped type on tarmac/walls (CSS 3D transform), anchored via
   world-pin math (§47). Text IN the world beats text OVER it.
2. **Framed-through** — generate the shot THROUGH a foreground element
   (canopy arch, hangar doorway); instant depth + a natural dark zone for text.
3. **Evidence board** — for document/testimony beats: one plate of a desk with
   scattered prints/clippings/tape; camera glides print-to-print with
   world-pinned annotations. Investigation-scene energy.
4. **Silhouette negative-space hero** — subject as bold dark shape against a
   bright sky at 60-70% of frame; text inside the silhouette or the open sky.
   Poster energy for thesis beats without going solid-bg.
5. **Type-as-mask chapter card** — imagery visible through giant letterforms
   (clip-path/mask). Act breaks; doubles as thumbnail material.
