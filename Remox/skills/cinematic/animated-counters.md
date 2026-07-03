# Animated Counters — Stat Reveals with Visual Intensity

Two techniques for making stat reveals hit harder. Both
replace the default interpolated count-up with something
more visually satisfying and dramatically timed.

## Pattern 1: Animated Progress Bar

For percentage stats, a horizontal bar fills to the target
value alongside the number. The bar is pure CSS — no SVG —
and deliberately delayed so it lands after the number
settles, adding a second beat of visual payoff.

```tsx
import {
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
} from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

interface StatWithBarProps {
  label: string;
  value: number;       // the displayed integer (e.g. 73)
  targetPercent: number; // bar fill target (e.g. 73 for 73%)
  statColor: string;   // e.g. PALETTE.primary
  delay?: number;      // frame offset for stagger
}

export const StatWithBar: React.FC<StatWithBarProps> = ({
  label,
  value,
  targetPercent,
  statColor,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Number counts up first
  const f = Math.max(0, frame - delay);
  const numberProgress = spring({
    frame: f,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  // Bar fills after the number has landed (~30 frames later)
  const barProgress = spring({
    frame: Math.max(0, frame - delay - 30),
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const displayValue = Math.round(
    interpolate(numberProgress, [0, 1], [0, value])
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Stat label */}
      <div style={{
        fontFamily: FONTS.body,
        fontSize: 22,
        fontWeight: 500,
        color: `${statColor}CC`,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity: interpolate(numberProgress, [0, 0.3], [0, 1], {
          extrapolateRight: "clamp",
        }),
      }}>
        {label}
      </div>

      {/* Animated number */}
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: 72,
        fontWeight: 800,
        color: statColor,
        lineHeight: 1,
        transform: `scale(${interpolate(numberProgress, [0, 0.6, 1], [0.7, 1.04, 1])})`,
        transformOrigin: "left center",
      }}>
        {displayValue}%
      </div>

      {/* Progress bar — appears after number lands */}
      <div style={{
        width: 400,
        height: 8,
        borderRadius: 4,
        background: `${statColor}15`,
        overflow: "hidden",
      }}>
        <div style={{
          width: `${interpolate(barProgress, [0, 1], [0, targetPercent])}%`,
          height: "100%",
          borderRadius: 4,
          background: statColor,
        }} />
      </div>
    </div>
  );
};

// Stacked layout — three stats side by side with staggered bars
export const StatBarRow: React.FC = () => {
  const stats = [
    { label: "Market share", value: 73, targetPercent: 73, statColor: PALETTE.primary, delay: 0 },
    { label: "Margin", value: 41, targetPercent: 41, statColor: PALETTE.secondary, delay: 15 },
    { label: "Growth", value: 28, targetPercent: 28, statColor: PALETTE.accent, delay: 30 },
  ];

  return (
    <AbsoluteFill style={{
      background: PALETTE.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-around",
      padding: "0 80px",
    }}>
      {stats.map((stat, i) => (
        <StatWithBar key={i} {...stat} />
      ))}
    </AbsoluteFill>
  );
};
```

## Pattern 2: Digit-Roll Counter

Individual digit columns that scroll vertically like a
mechanical counter or slot machine. Each digit is a strip of
0-9 that translates upward until the target digit is
centered in the "window." Rightmost digits lead the roll,
leftmost digits trail — matching the feel of a real odometer.

```tsx
import {
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
} from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

interface DigitRollProps {
  value: number;
  progress: number;
  fontSize?: number;
  color?: string;
}

const DigitRoll: React.FC<DigitRollProps> = ({
  value,
  progress,
  fontSize = 80,
  color = PALETTE.primary,
}) => {
  const digits = String(value).split("");

  return (
    <div style={{
      display: "flex",
      overflow: "hidden",
      height: "1em",
      fontSize,
      fontFamily: FONTS.heading,
      fontWeight: 800,
      color,
      lineHeight: 1,
    }}>
      {digits.map((d, i) => {
        const target = parseInt(d, 10);

        // Rightmost digit (highest index) leads; leftmost trails.
        // Each column is staggered by 0.08 of the total progress range.
        const stagger = (digits.length - 1 - i) * 0.08;
        const colProgress = interpolate(
          progress,
          [stagger, 1],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        // translateY: 0em shows digit 0 at top of strip.
        // Moving to -target em shows the target digit.
        const y = interpolate(colProgress, [0, 1], [0, -target], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              transform: `translateY(${y}em)`,
              lineHeight: 1,
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <div key={n} style={{ height: "1em" }}>
                {n}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

// Full scene: hero stat with digit roll
export const HeroStatRoll: React.FC<{
  value: number;
  label: string;
  unit?: string;
}> = ({ value, label, unit = "" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 80 },
  });

  // Digit roll starts on frame 10, runs over ~40 frames
  const rollFrame = Math.max(0, frame - 10);
  const rollSpring = spring({
    frame: rollFrame,
    fps,
    config: MOTION.spring.snappy,
  });

  return (
    <AbsoluteFill style={{
      background: PALETTE.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
    }}>
      {/* Unit prefix or suffix row */}
      <div style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        transform: `translateY(${interpolate(entrance, [0, 1], [40, 0])}px)`,
        opacity: interpolate(entrance, [0, 0.4], [0, 1], {
          extrapolateRight: "clamp",
        }),
      }}>
        <DigitRoll value={value} progress={rollSpring} fontSize={96} />
        {unit && (
          <span style={{
            fontFamily: FONTS.heading,
            fontSize: 48,
            fontWeight: 700,
            color: `${PALETTE.primary}99`,
          }}>
            {unit}
          </span>
        )}
      </div>

      {/* Label beneath */}
      <div style={{
        fontFamily: FONTS.body,
        fontSize: 26,
        fontWeight: 500,
        color: `${PALETTE.primary}88`,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        opacity: interpolate(rollSpring, [0.7, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}>
        {label}
      </div>
    </AbsoluteFill>
  );
};
```

## When to Use

**Progress bars** — use when showing multiple stats in a
stacked or side-by-side layout. The bars add visual weight
behind each number, create a shared baseline for
comparison, and give the viewer an instant sense of relative
scale without reading every value carefully. Best when the
percentage IS the point (market share, completion rate,
survey results).

**Digit rolls** — use for hero stat moments where the number
itself is the content. The mechanical rolling animation
signals to the viewer that something significant is landing.
Works best when a single stat gets its own full-screen beat,
or when a number is being revealed for the first time after
a buildup. The staggered column timing adds the satisfying
"click into place" feel of a real odometer.

## Anti-Patterns

- **Do not use both on the same stat.** Progress bar AND
  digit roll fighting for attention on one number produces
  visual noise, not drama. Pick the technique that matches
  the stat's role in the scene.

- **Keep bars subtle.** 6-8px height is the right range.
  A taller bar starts to compete with the number above it
  and looks like a chart element rather than a supporting
  accent.

- **Digit roll is overkill for single digits.** A single
  digit rolling from 0 to 7 is over in a blink and reads
  as glitchy rather than satisfying. For single-digit
  stats, use a standard spring count-up with a scale
  punch on landing instead.

- **Do not roll numbers with more than 4 digits** unless
  the font size is large enough that each column is
  clearly readable. At small sizes, a 6-digit roll looks
  like flickering noise.
