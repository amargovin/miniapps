/**
 * Kinetic Typography Example: Stat Reveal with Context
 *
 * Demonstrates the Vox/Economist style:
 * Phase 1: Setup line enters (small, muted)
 * Phase 2: Big number slams in with count-up
 * Phase 3: Context phrase with highlighted keyword
 * Phase 4: Source attribution fades in
 *
 * This is the kind of scene that should REPLACE a
 * complex SVG illustration of a battery or factory.
 */
import {
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Series,
  Easing,
} from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

// --- Phase 1: Setup Line ---
const SetupLine: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: MOTION.springGentle,
  });

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 36,
          color: PALETTE.textMuted,
          textTransform: "uppercase",
          letterSpacing: 4,
          opacity: interpolate(entrance, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(entrance, [0, 1], [20, 0])}px)`,
        }}
      >
        India's Battery Cell Imports
      </div>
    </AbsoluteFill>
  );
};

// --- Phase 2: Number Slam ---
const NumberSlam: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Number entrance with slam
  const numIn = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  // Count up animation
  const countUp = interpolate(frame, [0, 35], [0, 77], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Subtle underline that draws after number lands
  const underlineIn = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Context above */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 28,
            color: PALETTE.textMuted,
            textTransform: "uppercase",
            letterSpacing: 3,
            opacity: interpolate(numIn, [0, 1], [0, 0.7]),
          }}
        >
          Import Dependency
        </div>

        {/* Big number */}
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 200,
            fontWeight: 800,
            color: PALETTE.secondary,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-6px",
            lineHeight: 1,
            position: "relative",
            opacity: interpolate(numIn, [0, 1], [0, 1]),
            transform: `scale(${interpolate(numIn, [0, 0.8, 1], [0.6, 1.05, 1])})`,
          }}
        >
          {Math.round(countUp)}%

          {/* Underline accent */}
          <div
            style={{
              position: "absolute",
              bottom: -8,
              left: "10%",
              width: `${interpolate(underlineIn, [0, 1], [0, 80])}%`,
              height: 5,
              background: PALETTE.secondary,
              borderRadius: 3,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// --- Phase 3: Context with Highlight ---
const ContextPhrase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lineIn = spring({
    frame,
    fps,
    config: MOTION.springSnappy,
  });

  // Highlight animation on "China"
  const highlightIn = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 14, stiffness: 160 },
  });

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.bg,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 240px",
      }}
    >
      <div
        style={{
          fontFamily: FONTS.heading,
          fontSize: 52,
          color: PALETTE.text,
          lineHeight: 1.5,
          textAlign: "center",
          opacity: interpolate(lineIn, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(lineIn, [0, 1], [25, 0])}px)`,
        }}
      >
        of India's battery cells{" "}
        <br />
        are sourced from{" "}
        <span
          style={{
            color: PALETTE.secondary,
            fontWeight: 700,
            position: "relative",
            display: "inline-block",
          }}
        >
          a single country
          {/* Marker highlight effect */}
          <span
            style={{
              position: "absolute",
              bottom: 0,
              left: -4,
              right: -4,
              height: "40%",
              background: `${PALETTE.secondary}20`,
              borderRadius: 2,
              transform: `scaleX(${interpolate(highlightIn, [0, 1], [0, 1])})`,
              transformOrigin: "left",
            }}
          />
        </span>
      </div>
    </AbsoluteFill>
  );
};

// --- Phase 4: Source Attribution ---
const SourceLine: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({
    frame,
    fps,
    config: MOTION.springGentle,
  });

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.bg,
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 96,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 20,
          color: PALETTE.textMuted,
          opacity: interpolate(fadeIn, [0, 1], [0, 0.6]),
        }}
      >
        Source: Ministry of Commerce, 2024
      </div>
    </AbsoluteFill>
  );
};

// --- Composed Scene ---
const KineticStatReveal: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={45}>
        <SetupLine />
      </Series.Sequence>
      <Series.Sequence durationInFrames={60}>
        <NumberSlam />
      </Series.Sequence>
      <Series.Sequence durationInFrames={55}>
        <ContextPhrase />
      </Series.Sequence>
      <Series.Sequence durationInFrames={40}>
        <SourceLine />
      </Series.Sequence>
    </Series>
  );
};

export default KineticStatReveal;
