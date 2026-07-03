# Typography — Remotion 4 Reference

## Font Pairing by Content Type

| Content Type | Headlines | Body | Effect |
|---|---|---|---|
| Documentary / essay / editorial | `Georgia, serif` | `Inter, sans-serif` | Economist / Claude authority |
| Tech / product / startup | `Inter, sans-serif` | `Inter, sans-serif` | Clean, modern |
| News / breaking | `Georgia, serif` or condensed | `Inter, sans-serif` | Urgency + readability |

Sans-serif-only looks generic. A serif/sans pairing creates visual hierarchy automatically.
See `editorial-design.md` for full rationale.

**BRAND OVERRIDE (LEARNINGS §6):** the table above is generic guidance. For
Swarajya productions the brand guide wins: body = Helvetica. For display,
load a REAL display grotesk with true 800/900 weights via
@remotion/google-fonts — **Archivo** is the validated choice (same family
voice as Helvetica, actual display weights). System Helvetica at weight 700
for hero type is a confirmed amateur tell.

## Text Sizing Rules (1920x1080)

```
Hero / Title:      72–120px   — full-screen statements, single line
Subheading:        48–64px    — section labels, supporting headers
Body:              36–48px    — readable at standard viewing distance
Labels / eyebrows / mono: ≥34px — floor raised July 2026 (LEARNINGS §43)
Stat sub-labels:   ≥36px      — must pair legibly with the stat number
Caption / source:  ≥28px      — floor raised from 18px (LEARNINGS §43)
Lower-third names: ≥56px
MINIMUM any text:  28px       — author to this floor; the mechanical audit's
                                24px hard-fail is only a legacy backstop
```

**Warning:** First-instinct sizes are almost always too small. Entity names (countries, brands) need 48px+. If it looks "about right" in code, scale up 1.5x.

### Display type rules (headlines ≥ 96px)

- Weight 800–900 (real display weights, not faux-bold)
- `lineHeight: 0.98–1.05` for stacked display lines — the default 1.2 leaves
  amateur gaps between lines
- `letterSpacing: '-0.02em'` to `'-0.03em'` — negative tracking scales with size
- `fontVariantNumeric: 'tabular-nums'` on all counting/stat numerals

## Font Loading — use @remotion/google-fonts

Never rely on system fonts being present, and never hand-roll
delayRender/continueRender font loading. The template's `theme.ts` loads
fonts at module level; every scene that imports FONTS gets them:

```tsx
// theme.ts
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';

const archivo = loadArchivo('normal', { weights: ['500', '600', '700', '800', '900'] });
const jbMono = loadJetBrainsMono('normal', { weights: ['400', '500', '700'] });

export const FONTS = {
  heading: `'${archivo.fontFamily}', Helvetica, Arial, sans-serif`,
  body: 'Helvetica, Arial, sans-serif',   // brand
  mono: `'${jbMono.fontFamily}', monospace`,
} as const;
```

## ~~Typewriter with Cursor Blink~~ — BANNED

**Do not use typewriter reveals with a visible caret.** Frames get sampled
(thumbnails, pauses, stills review) and viewers see half-typed nonsense like
"COL. A. YU. STEPK|". Confirmed amateur-tell in production review
(see motion-doctrine.md, PL-15 v2 pilot).

Instead, reveal words WHOLE with a masked clip-path (each word unclips
bottom-up over ~10f, staggered ~8f apart):

```tsx
const wordReveal = (frame: number, i: number) => {
  const p = interpolate(frame, [i * 8, i * 8 + 10], [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out });
  return {
    clipPath: `inset(${(1 - p) * 100}% 0 0 0)`,
    transform: `translateY(${(1 - p) * 14}px)`,
    display: 'inline-block',
  };
};
// <span style={wordReveal(frame, wordIndex)}>{word}&nbsp;</span> per word
```

## Word-by-Word Reveal

```tsx
import { useCurrentFrame } from "remotion";

const FRAMES_PER_WORD = 8;

export const WordReveal: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  const wordsVisible = Math.floor(frame / FRAMES_PER_WORD);

  return (
    <div style={{ fontSize: 64, color: "#fff", display: "flex", flexWrap: "wrap", gap: "0.3em" }}>
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            opacity: i < wordsVisible ? 1 : 0,
            transform: i < wordsVisible ? "translateY(0)" : "translateY(12px)",
            transition: "none", // Remotion handles timing — no CSS transitions
            display: "inline-block",
          }}
        >
          {word}
        </span>
      ))}
    </div>
  );
};
```

## Highlight / Keyword Crossfade

Animate `background-color` on a keyword as the voiceover hits it:

```tsx
import { interpolate, useCurrentFrame } from "remotion";

export const HighlightWord: React.FC<{ word: string; highlightAt: number }> = ({ word, highlightAt }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [highlightAt, highlightAt + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bg = `rgba(245, 166, 35, ${progress * 0.35})`;
  const color = progress > 0.5 ? "#f5a623" : "#ffffff";

  return (
    <span style={{ background: bg, color, borderRadius: 4, padding: "0 4px", transition: "none" }}>
      {word}
    </span>
  );
};
```

## Kinetic Typography — Per-Word Animation

```tsx
import { spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const WORDS = ["India", "needs", "batteries."];
const STAGGER = 10;

export const KineticText: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ display: "flex", gap: "0.3em", flexWrap: "wrap" }}>
      {WORDS.map((word, i) => {
        const f = Math.max(0, frame - i * STAGGER);
        const p = spring({ frame: f, fps, config: { damping: 12, stiffness: 150 } });
        const scale = interpolate(p, [0, 1], [0.4, 1]);
        const y = interpolate(p, [0, 1], [40, 0]);
        const rotate = interpolate(p, [0, 1], [-8, 0]);
        const opacity = interpolate(p, [0, 1], [0, 1]);

        return (
          <span
            key={i}
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: "#fff",
              display: "inline-block",
              transform: `translateY(${y}px) scale(${scale}) rotate(${rotate}deg)`,
              opacity,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
```

## Character Flip / Carousel

Cycle through characters (useful for number reveals, counters):

```tsx
import { useCurrentFrame } from "remotion";

const CYCLE = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export const CharFlip: React.FC<{ targetChar: string; settleAt: number }> = ({ targetChar, settleAt }) => {
  const frame = useCurrentFrame();
  const targetIdx = CYCLE.indexOf(targetChar);
  const currentIdx = frame < settleAt
    ? Math.floor((frame / settleAt) * targetIdx)
    : targetIdx;

  return (
    <span style={{ fontFamily: "monospace", fontSize: 96, fontWeight: 700 }}>
      {CYCLE[Math.min(currentIdx, CYCLE.length - 1)]}
    </span>
  );
};
```

## Gotchas

- Never use CSS `transition:` property — Remotion drives all animation through frame values. CSS transitions create double-animation bugs.
- `font-display: swap` in @font-face can cause a flash during preview. Use `delayRender` to ensure fonts are loaded.
- Line height should be 1.1–1.3 for display/hero text, 1.5–1.6 for body. Default browser line-height (1.2) is usually fine for headlines.
- `white-space: nowrap` on animated word spans prevents layout reflow mid-animation.
- For text on video backgrounds, always add a text shadow or semi-transparent overlay to ensure legibility.

---

## Remox Scene Rules

### Max 2 Text Elements Per Phase
One hero element + one supporting element per phase. No more. If you
need to communicate more, split into phases rather than cramming.
Crowded text phases read as slideshows.

### Font Families by Role
Always use the theme font tokens — never raw font strings:
- `FONTS.heading` (Georgia, serif) — hero text, emotional emphasis, section labels
- `FONTS.body` (Inter, sans-serif) — supporting text, body copy, narration
- `FONTS.mono` (monospace) — data values, dates, counters, technical labels

Mixing heading and body fonts in one phase creates automatic hierarchy.
Using body-only in both positions collapses that hierarchy.

### Font Size Minimums (1920x1080)
```
Hero:    ≥72px   — full-screen statements, dominant stats
Section: ≥56px   — section labels, phase headlines
Body:    ≥36px   — supporting copy, context
Labels:  ≥34px   — labels/eyebrows/mono floor (LEARNINGS §43)
Caption: ≥28px   — absolute floor; never go below this for any readable element
```

Create hierarchy through weight, color, and opacity — NOT by making
supporting text smaller than the body minimum. If it looks "about
right" at first glance, scale up 1.5x — first instincts are almost
always too small at render resolution.
