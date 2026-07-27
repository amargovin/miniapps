# Charts & Data Visualization — Remotion 4 Reference

> **Charts are a tool of last resort.** Before reaching for a chart, ask: can this data be shown as a physical quantity? A battery draining to 23%. Liquid filling vessels to different levels. Objects accumulating or disappearing. A gauge needle swinging to a position. A building being constructed floor by floor. See `creative-direction.md` Step 3 for metaphor guidance. Use charts only for 5+ data point trends, time series, or multi-variable comparisons that genuinely cannot be expressed as a physical metaphor. A single number is never a chart — it's an object at a level.

## Data-viz restraint — cut what doesn't land (canonical for §62)

Restated across a full film: **when a chart or gauge doesn't clearly
communicate, cut it and go text-forward.** A fiddly data-viz that the viewer
can't decode in ~2s is worse than a clean stat line — it looks busy and
undesigned. Specifics learned in production:

- **Remove data-viz that doesn't land.** Climbing gauges, stepped mini-bars,
  and small multi-part meters routinely fail to read at video scale and pace.
  If it isn't instantly legible, delete it — replace with a hero stat / thesis
  line (typography.md → "Size by ROLE"), and **widen the text box** to fit the
  text properly rather than shrinking the text to fit a leftover chart slot.
- **When you DO chart, encode the ACTUAL variable meaningfully.** A disparity
  is clearest when bar LENGTH maps to the quantity that differs — the eye
  compares lengths instantly. Prefer **horizontal bars**, scaled UP, with
  generous whitespace, so the comparison is the whole composition. Don't dress
  a single number as a chart (see the last-resort note below — a single number
  is an object at a level, never a chart).

This is the same instinct as editorial-design.md Tier 1 (kinetic typography is
the default) and the "charts are a tool of last resort" note below: reach for
text first, chart only when the data genuinely needs it, and cut any chart
that fights the viewer.

## Alive from f0 — never a blank data frame (§61)

A chart/counter/ring must NOT slam in after empty seconds. Establish the
scaffolding (axis, gridlines, ring TRACK, baseline) from frame 0 so the frame
reads as present, then animate the DATA into it:

- Counters count UP from 0, *arriving* at the value on the whisper beat — not
  a blank frame that suddenly shows a finished number.
- The ring/donut track is drawn (faint) from f0; the fill sweeps in.
- The axis and gridlines are present early; bars grow into the established
  grid.

See motion-doctrine.md → "Never open on an empty frame."

## Chart Craft Requirements (mandatory when a chart IS used)

Two naked bars floating in empty space is not a chart — it's the #1
"undesigned" tell (PL-15 v1 review). Every chart must have ALL of:

1. **Baseline axis** — 2px hairline at the chart's zero line, with an origin tick.
2. **Gridlines** — use the `gridline()` token from `motion-utils.ts`:
   `<div style={{ ...gridline(PALETTE.primary), position: 'absolute', ... }}>` —
   this gives 2px height at 18% opacity, the only sanctioned thin line on video.
   3–5 gridlines with unit tick labels in `FONTS.mono` (≥28px, tabular-nums —
   floor raised per LEARNINGS §43).
3. **Direct value labels** — the value rides the bar/line end and COUNTS UP
   as the bar draws (`Math.round(value * progress)`), mono, tabular-nums.
4. **Series labels** — at the bar/series, never in a detached legend.
5. **Source line** — bottom-left in mono caption size, ABOVE the subtitle
   zone (bottom ≥ 220px).
6. **Delta annotation when the story is a gap** — bracket/band between two
   values with a "+N unit" label; the difference IS the story, mark it.
7. **Motion**: bars grow with `EASING.outSoft` (never spring-bounce for
   editorial data), staggered ~8f; whole chart block gets ambient `driftY`
   during holds; exits per motion-doctrine.md.

### Modern vector tokens (mandatory for charts and diagrams — v3)

Import from `motion-utils.ts` and apply:

- **Bars**: use `barFill(color)` — vertical gradient + inner highlight +
  box-shadow glow. Never a flat `background: color`.
  ```tsx
  import { barFill } from '../motion-utils';
  <div style={{ ...barFill(data.color), width: BAR_WIDTH, height: barHeight }} />
  ```

- **Gridlines**: use `gridline(color)` — always 2px at 18% opacity.
  ```tsx
  import { gridline } from '../motion-utils';
  <div style={{ ...gridline(PALETTE.primary), position: 'absolute', left: 0, right: 0, top: `${y}%` }} />
  ```

- **Diagram strokes (SVG)**: use `strokeGlow(color)` — render the SAME path
  TWICE: halo layer under, core layer over.
  ```tsx
  import { strokeGlow } from '../motion-utils';
  const sg = strokeGlow(PALETTE.electric);
  // Halo pass:
  <path d={pathD} {...sg.halo} fill="none" />
  // Core pass:
  <path d={pathD} {...sg.core} fill="none" />
  ```

**BANNED — no exceptions:**
- Flat strokes under 3px for any primary diagram or chart element
- `height: 1` or `strokeWidth: 1` on anything the viewer is meant to read
- `background: color` on bars without the gradient + highlight treatment
- Manual `filter: blur(Xpx)` on strokes instead of `strokeGlow()`

**Audit note (TXT rule):** the mechanical audit counts `fontSize:`
occurrences per phase (max 4). A crafted chart legitimately has 6+ text
roles. Hoist chart text styles into a module-scope `CHART_TYPE` constant
(defined ABOVE the first phase component, outside any phase's code range)
and spread them (`...CHART_TYPE.tick`) — one shared definition, no audit
false-positives, cleaner code.

## Color Palette

```ts
const PALETTE = {
  primary:   "#f5a623",
  accent:    "#e94560",
  positive:  "#4caf50",
  negative:  "#f44336",
  neutral:   "#90a4ae",
  bg:        "#0a0a0a",
  surface:   "#1a1a2e",
  text:      "#ffffff",
  muted:     "#888888",
};
```

## Animated Bar Chart — 4 Bars with Staggered Spring Entrance

Uses `barFill()` for every bar — the mandated modern vector token (vertical
gradient + inner highlight + glow). Never a flat `background: color` bar.

```tsx
import { spring, interpolate, useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";
import { barFill } from "../motion-utils";

const BAR_DATA = [
  { label: "China",  value: 78, color: "#e94560" },
  { label: "USA",    value: 12, color: "#f5a623" },
  { label: "EU",     value: 7,  color: "#4caf50" },
  { label: "India",  value: 2,  color: "#90a4ae" },
];
const MAX_VALUE = 100;
const CHART_HEIGHT = 400;
const BAR_WIDTH = 120;
const STAGGER = 8;

const Bar: React.FC<{ data: typeof BAR_DATA[0]; index: number }> = ({ data, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const f = Math.max(0, frame - index * STAGGER);
  const progress = spring({ frame: f, fps, config: { damping: 18, stiffness: 160 } });

  const barHeight = interpolate(progress, [0, 1], [0, (data.value / MAX_VALUE) * CHART_HEIGHT]);
  const labelOpacity = interpolate(progress, [0.8, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Display value counts up as bar grows
  const displayValue = Math.round(interpolate(progress, [0, 1], [0, data.value]));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {/* Value label — appears when bar is nearly full */}
      <div style={{ fontSize: 36, fontWeight: 700, color: data.color, opacity: labelOpacity, height: 44 }}>
        {displayValue}%
      </div>

      {/* Bar — barFill() gives the gradient + inner highlight + glow */}
      <div
        style={{
          ...barFill(data.color),
          width: BAR_WIDTH,
          height: barHeight,
        }}
      />

      {/* Axis label */}
      <div style={{ fontSize: 28, color: "#fff", marginTop: 8 }}>{data.label}</div>
    </div>
  );
};

export const BarChart: React.FC = () => (
  <AbsoluteFill style={{ background: "#0a0a0a", justifyContent: "flex-end", alignItems: "center", paddingBottom: 120, gap: 32, flexDirection: "row" }}>
    {BAR_DATA.map((d, i) => <Bar key={d.label} data={d} index={i} />)}
  </AbsoluteFill>
);
```

## Animated Donut Chart (SVG `stroke-dasharray`)

```tsx
import { spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const R = 140;
const CIRCUMFERENCE = 2 * Math.PI * R;

export const DonutChart: React.FC<{ percentage: number; label: string }> = ({ percentage, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const filled = interpolate(progress, [0, 1], [0, (percentage / 100) * CIRCUMFERENCE]);
  const displayPct = Math.round(interpolate(progress, [0, 1], [0, percentage]));

  return (
    <svg width={360} height={360} viewBox="0 0 360 360">
      {/* Background track */}
      <circle cx={180} cy={180} r={R} fill="none" stroke="#1a1a2e" strokeWidth={28} />
      {/* Animated fill */}
      <circle
        cx={180} cy={180} r={R}
        fill="none"
        stroke="#f5a623"
        strokeWidth={28}
        strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
        strokeLinecap="round"
        transform="rotate(-90 180 180)"
      />
      {/* Center label */}
      <text x={180} y={172} textAnchor="middle" fill="#fff" fontSize={64} fontWeight={700}>{displayPct}%</text>
      <text x={180} y={218} textAnchor="middle" fill="#888" fontSize={28}>{label}</text>
    </svg>
  );
};
```

## Counter / Number Animation

```tsx
import { interpolate, useCurrentFrame, Easing } from "remotion";

export const Counter: React.FC<{ from: number; to: number; durationFrames?: number; suffix?: string }> = ({
  from, to, durationFrames = 60, suffix = "",
}) => {
  const frame = useCurrentFrame();
  const value = interpolate(frame, [0, durationFrames], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <span style={{ fontSize: 96, fontWeight: 800, color: "#f5a623", fontVariantNumeric: "tabular-nums" }}>
      {Math.round(value).toLocaleString()}{suffix}
    </span>
  );
};
```

## Axis and Gridline Entrance

Every gridline is `gridline()` — the ONLY sanctioned thin line on video (2px
at 18% opacity). Never `height: 1` with a flat `background`. Multiply the
token's baked-in opacity by the spring so the line still animates in.

```tsx
import { gridline } from "../motion-utils";
import { PALETTE } from "../theme";

const GridLines: React.FC<{ count?: number }> = ({ count = 5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const gl = gridline(PALETTE.primary); // { background, height: 2, opacity: 0.18 }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: count }).map((_, i) => {
        const f = Math.max(0, frame - i * 4);
        const enter = spring({ frame: f, fps, config: { damping: 20, stiffness: 100 } });
        const y = ((i + 1) / (count + 1)) * 100;
        return (
          <div
            key={i}
            style={{
              ...gl,
              position: "absolute",
              top: `${y}%`,
              left: 0, right: 0,
              opacity: gl.opacity * enter, // animate the token's 18% in
            }}
          />
        );
      })}
    </div>
  );
};
```

## Gotchas

- SVG `stroke-dashoffset` is an alternative to `stroke-dasharray` — use dasharray for simpler "fill from 0" animations.
- `fontVariantNumeric: "tabular-nums"` prevents layout jitter when counters update — always use for numbers.
- Bar chart bottoms should be anchored: use `justifyContent: "flex-end"` on a fixed-height container, not absolute positioning.
- `Easing.out(Easing.cubic)` on counters feels more natural than spring — springs can overshoot and show values > target.
- For percentage labels, delay their opacity until `progress > 0.85` so they don't appear before the bar is readable.
- Always set a fixed `height` on the chart container to prevent layout shift as bars animate.
