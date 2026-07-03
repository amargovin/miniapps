import {
  AbsoluteFill,
  Img,
  Series,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

// Generated Backdrop Phases: demonstrates alternating between
// AI-generated image backgrounds (treated with CSS filters)
// and clean typography phases for visual breathing.
//
// Pre-requisite: generate backdrop images via ImageGen skill
// and place in public/ before rendering:
//   backdrop-scene-phase1.png  (port/industrial, atmospheric)
//   backdrop-scene-phase3.png  (factory/interior, atmospheric)
//   backdrop-scene-phase5.png  (corridor/architectural, atmospheric)

const FPS = 30;

// ─── Phase 1: Duotone Backdrop — establishing shot ─────────

const Phase1Duotone: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const zoom = interpolate(frame, [0, 150], [1, 1.06], {
    extrapolateRight: "clamp",
  });

  const textIn = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: MOTION.springSnappy,
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Generated image + duotone treatment */}
      <Img
        src={staticFile("backdrop-scene-phase1.png")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "grayscale(0.85) contrast(1.3) brightness(0.85)",
          transform: `scale(${zoom})`,
          willChange: "transform",
        }}
      />

      {/* Color tint */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: PALETTE.primary,
          mixBlendMode: "multiply",
          opacity: 0.6,
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(
            ellipse 70% 60% at 50% 50%,
            transparent 30%,
            rgba(0,0,0,0.55) 100%
          )`,
        }}
      />

      {/* Bottom gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(transparent 50%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Typography */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 192,
          right: 192,
          opacity: interpolate(textIn, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(
            textIn,
            [0, 1],
            [30, 0]
          )}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 64,
            fontWeight: 700,
            color: "#FFFFFF",
            lineHeight: 1.15,
            textShadow: "0 2px 20px rgba(0,0,0,0.4)",
          }}
        >
          India's Battery Dependency
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 30,
            color: "rgba(255,255,255,0.85)",
            marginTop: 12,
            textShadow: "0 1px 10px rgba(0,0,0,0.3)",
          }}
        >
          A supply chain built on a single source
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Phase 2: Clean Typography — stat reveal ───────────────

const Phase2Stat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const drift = interpolate(frame, [0, 135], [1, 1.03], {
    extrapolateRight: "clamp",
  });

  const setupIn = spring({
    frame,
    fps,
    config: MOTION.springSnappy,
  });

  const numberIn = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: MOTION.springBouncy,
  });

  // Count-up for the stat
  const countValue = Math.round(
    interpolate(
      spring({
        frame: Math.max(0, frame - 12),
        fps,
        config: { damping: 25, stiffness: 60 },
      }),
      [0, 1],
      [0, 77]
    )
  );

  const contextIn = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: MOTION.springSnappy,
  });

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.bg,
        transform: `scale(${drift})`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 192,
      }}
    >
      {/* Setup line */}
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 28,
          color: PALETTE.textMuted,
          textTransform: "uppercase",
          letterSpacing: 3,
          marginBottom: 24,
          opacity: interpolate(setupIn, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(
            setupIn,
            [0, 1],
            [20, 0]
          )}px)`,
        }}
      >
        Battery Cell Imports
      </div>

      {/* Big number */}
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 160,
          fontWeight: 700,
          color: PALETTE.secondary,
          lineHeight: 1,
          opacity: interpolate(numberIn, [0, 1], [0, 1]),
          transform: `scale(${interpolate(
            numberIn,
            [0, 1],
            [0.7, 1]
          )})`,
        }}
      >
        {countValue}%
      </div>

      {/* Underline accent */}
      <div
        style={{
          width: interpolate(numberIn, [0, 1], [0, 200]),
          height: 4,
          background: PALETTE.secondary,
          marginTop: 16,
          marginBottom: 24,
          borderRadius: 2,
        }}
      />

      {/* Context */}
      <div
        style={{
          fontFamily: FONTS.heading,
          fontSize: 36,
          color: PALETTE.text,
          textAlign: "center",
          opacity: interpolate(contextIn, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(
            contextIn,
            [0, 1],
            [15, 0]
          )}px)`,
        }}
      >
        from a{" "}
        <span style={{ color: PALETTE.secondary, fontWeight: 700 }}>
          single country
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ─── Phase 3: Defocused Backdrop — atmosphere shift ────────

const Phase3Defocused: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const drift = interpolate(frame, [0, 150], [1, 1.04], {
    extrapolateRight: "clamp",
  });

  const textIn = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: MOTION.springSnappy,
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Blurred backdrop */}
      <Img
        src={staticFile("backdrop-scene-phase3.png")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter:
            "blur(16px) grayscale(0.7) contrast(1.1) brightness(0.8)",
          transform: `scale(${drift * 1.05})`,
          willChange: "transform, filter",
        }}
      />

      {/* Subtle PALETTE.bg wash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: PALETTE.bg,
          opacity: 0.25,
        }}
      />

      {/* Sharp foreground text */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 240,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 52,
            fontWeight: 700,
            color: "#FFFFFF",
            textAlign: "center",
            lineHeight: 1.3,
            textShadow: "0 2px 30px rgba(0,0,0,0.6)",
            opacity: interpolate(textIn, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(
              textIn,
              [0, 1],
              [25, 0]
            )}px)`,
          }}
        >
          China controls the cathode,
          <br />
          anode, and electrolyte supply
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Phase 4: Clean Typography — breathing room ────────────

const Phase4Clean: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const drift = interpolate(frame, [0, 120], [1, 1.03], {
    extrapolateRight: "clamp",
  });

  const textIn = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: MOTION.springSnappy,
  });

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.primary,
        transform: `scale(${drift})`,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 240,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.heading,
          fontSize: 56,
          fontWeight: 700,
          color: "#FFFFFF",
          textAlign: "center",
          lineHeight: 1.3,
          opacity: interpolate(textIn, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(
            textIn,
            [0, 1],
            [20, 0]
          )}px)`,
        }}
      >
        Not a trade relationship.
        <br />A{" "}
        <span
          style={{
            textDecoration: "underline",
            textDecorationColor: PALETTE.accent,
            textUnderlineOffset: 8,
            textDecorationThickness: 4,
          }}
        >
          dependency
        </span>
        .
      </div>
    </AbsoluteFill>
  );
};

// ─── Phase 5: Masked Backdrop — final reveal ───────────────

const Phase5Masked: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reveal = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const clipRadius = interpolate(reveal, [0, 1], [0, 38]);

  const textIn = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: MOTION.springSnappy,
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      {/* Masked image on the right */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: `circle(${clipRadius}% at 68% 50%)`,
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile("backdrop-scene-phase5.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "grayscale(0.6) contrast(1.2)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: PALETTE.primary,
            mixBlendMode: "multiply",
            opacity: 0.4,
          }}
        />
      </div>

      {/* Text on the left */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 120,
          width: "35%",
          transform: `translateY(-50%) translateY(${interpolate(
            textIn,
            [0, 1],
            [20, 0]
          )}px)`,
          opacity: interpolate(textIn, [0, 1], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 22,
            color: PALETTE.textMuted,
            textTransform: "uppercase",
            letterSpacing: 3,
            marginBottom: 16,
          }}
        >
          The Question
        </div>
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 48,
            fontWeight: 700,
            color: PALETTE.text,
            lineHeight: 1.25,
          }}
        >
          Can India build
          <br />
          before China cuts?
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Scene: Series of alternating phases ──────────────

export default function BackdropPhases() {
  return (
    <AbsoluteFill>
      <Series>
        {/* Phase 1: Duotone image — establishes world */}
        <Series.Sequence durationInFrames={5 * FPS}>
          <Phase1Duotone />
        </Series.Sequence>

        {/* Phase 2: Clean stat — focused, breathing */}
        <Series.Sequence durationInFrames={4.5 * FPS}>
          <Phase2Stat />
        </Series.Sequence>

        {/* Phase 3: Defocused image — atmosphere shift */}
        <Series.Sequence durationInFrames={4.5 * FPS}>
          <Phase3Defocused />
        </Series.Sequence>

        {/* Phase 4: Clean typography — dark bg, contrast */}
        <Series.Sequence durationInFrames={4 * FPS}>
          <Phase4Clean />
        </Series.Sequence>

        {/* Phase 5: Masked reveal — editorial ending */}
        <Series.Sequence durationInFrames={5 * FPS}>
          <Phase5Masked />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
}
