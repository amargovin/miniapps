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

## Bronze on cream fails — use a darker text-bronze (canonical for §60)

The brand bronze (`#C4873B`) is only ~2.75:1 on cream (`#F5F3EE`) — well below
the 4.5:1 body-text minimum. As TEXT it is effectively unreadable (user-flagged
across a full film). Split the bronze into two roles:

- **Decorative bronze** (`#C4873B`, the bright brand bronze) — rules, dots,
  borders, chart bars, arrows, badges, underline accents, indicator glyphs.
  Anything that is a GRAPHIC element, not something you read.
- **Text bronze** — a darker `accentInk` (`#8A5E22`, ~5.11:1 on cream) for any
  bronze-colored TEXT on cream. Passes contrast; still unmistakably bronze.

Add `accentInk` to the theme palette convention (a 7th key alongside the six
in editorial-design.md → "Palette Presets"):

```ts
// theme.ts — PALETTE, editorial preset
accent:    '#C4873B',  // DECORATIVE bronze only (rules, dots, bars, arrows)
accentInk: '#8A5E22',  // bronze TEXT on cream (~5.11:1) — never use bright accent for text
```

Rule: **never set body/label/stat text in `PALETTE.accent`.** Bronze text uses
`PALETTE.accentInk`. Bright `accent` is for graphics only. (This is a specific
instance of editorial-design.md §10.3 — accent colors are for
highlights/borders/fills, not primary text — that repeatedly failed in
practice because bronze LOOKS dark enough to trust. It is not.)

## Text Sizing — THE Authority

This file is the canonical and SOLE home of the size floors. SKILL.md and
editorial-design.md point here rather than restating the tables — keep the
numbers in this one place.

### Landscape floors (1920×1080) — canonical for LEARNINGS §43

The original skill minimums (labels/eyebrows 20px, captions 18px) produced
near-illegible text at real viewing sizes — a rendered 20px mono eyebrow over
a photographic background disappears (user-flagged, PL-15 July 2026). Floors
for label-class text (hero headlines and stat numbers at skill defaults are
fine — this is about the SMALL classes):

```
Hero / Title:      72–120px   — full-screen statements, single line
Subheading:        48–64px    — section labels, supporting headers
Body:              36–48px    — readable at standard viewing distance
Labels / eyebrows / mono data: ≥34px  — floor raised from 20px (§43)
Stat sub-labels:   ≥36px      — must pair legibly with the stat number
Caption / source:  ≥28px      — floor raised from 18px (§43)
Lower-third names: ≥56px      — raised from 48px (§43)
MINIMUM any text:  28px       — author to this floor; the mechanical audit's
                                24px hard-fail is only a legacy backstop
```

Also re-check placement when bumping sizes: small labels tend to sit low in
the frame, and after enlargement they can breach the bottom-20% subtitle zone.

### Size by ROLE, not by floor — minimums are not defaults (canonical for §52)

Raising the floors fixed illegibility but created a new failure: agents
authoring AT the floor (an opening hero stat at 72px — barely above the
statNumber floor — read as small; user-flagged, July 2026). Choose size by
the element's ROLE in the phase:

| Role in the phase | Scale |
|---|---|
| THE payoff of the phase (hero stat, verdict word) | heroStat 140-170px |
| Phase headline / primary statement | 84-124px |
| Secondary stat, callout label | 48-72px |
| Supporting labels/eyebrows/subs | the §43 floors (34-44px) |

The question is never "is it above the minimum?" but "is this the biggest
thing in the phase when it is the most important thing in the phase?" A
phase's single hero element should visually dominate — if the narration beat
IS the number, the number is the composition.

**Err large, and NEVER render a killer stat faint (§52 reinforcement).**
Repeated across a full film: a hero stat or thesis line must be UNMISSABLE.
Two ways teams accidentally kill the payoff element:

1. **Faint / low-opacity.** A stat rendered at reduced opacity (holding it at
   0.4–0.6 for "subtlety") reads as *small and unimportant* — the opposite of
   its role. The hero number lands at FULL opacity and full weight.
2. **Too small / too timid.** Sizing the payoff near the floor because the
   number "feels big enough" in the code preview. Err LARGE — at render
   resolution, on phones and TVs, the payoff can take far more scale than
   instinct suggests. When in doubt, go bigger.

Floors are for supporting classes. The payoff element is sized (and lit) by
its role: the most important thing in the phase is the biggest, brightest,
heaviest thing in the phase.

### Portrait floors (1080×1920 / 9:16) — canonical for LEARNINGS §1

Vertical video is consumed on phones at arm's length. Text that looks fine
at landscape 1080p is unreadable in 9:16:

```
Hero / impact text:  80px+  — confirmed readable in production
Section title:       60px+
Body / labels / eyebrows / mono data: 44px minimum — 36px was still too
                            small after two rounds of user feedback
Stat numbers:        80px+
Stat labels:         36px+
Lower-third names:   56px+ (subtitles 44px+)
Caption / source:    32px+
```

**Rule:** if it wouldn't be readable on a phone screen held vertically at
arm's length, it's too small. Portrait does NOT use the `TYPE_SCALE`
defaults from `theme.ts` (landscape values) — override per component.

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
- `FONTS.heading` — hero text, emotional emphasis, section labels
- `FONTS.body` — supporting text, body copy, narration
- `FONTS.mono` — data values, dates, counters, technical labels

Which families those tokens carry is a theme/brand decision — see "BRAND
OVERRIDE" above and always check the brand guide before setting fonts in
`theme.ts` (LEARNINGS §6: Georgia and Inter were wrong for Swarajya; the
brand guide specifies Helvetica body, and Archivo is the validated display
grotesk with true 800/900 weights).

Mixing heading and body fonts in one phase creates automatic hierarchy.
Using body-only in both positions collapses that hierarchy.

### Font Size Minimums
See "Text Sizing — THE Authority" above for the canonical floors (landscape
and portrait) and the role-sizing rule. Never author below those floors.

Create hierarchy through weight, color, and opacity — NOT by making
supporting text smaller than the body minimum. If it looks "about
right" at first glance, scale up 1.5x — first instincts are almost
always too small at render resolution.
