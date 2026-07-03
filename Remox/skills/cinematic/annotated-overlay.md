# Annotated Overlay — Image + Callout Labels

Vox's signature explainer technique: show an image
(photo, map, diagram, or screenshot), then progressively
add animated annotations — arrows, circles, labels,
connector lines — to highlight specific parts.

## Core Principle

The image provides context. The annotations provide
understanding. Each annotation appears one at a time,
building comprehension sequentially.

## Pattern 1: Photo with Callout Labels

An image with positioned labels that spring in
with connector lines.

```tsx
import { spring, interpolate, useCurrentFrame, useVideoConfig, AbsoluteFill, Img, staticFile } from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

interface Annotation {
  label: string;
  x: number;        // percentage position on image
  y: number;
  anchorX: number;  // where the label box sits
  anchorY: number;
  delay: number;    // frame delay for stagger
}

const ANNOTATIONS: Annotation[] = [
  { label: "Cathode plant", x: 25, y: 35, anchorX: 10, anchorY: 15, delay: 20 },
  { label: "Anode processing", x: 60, y: 45, anchorX: 70, anchorY: 20, delay: 35 },
  { label: "Cell assembly", x: 45, y: 70, anchorX: 55, anchorY: 85, delay: 50 },
];

export const AnnotatedPhoto: React.FC<{ photo: string }> = ({ photo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      {/* Base image — slight duotone treatment */}
      <div style={{
        position: "absolute",
        inset: 60,
        borderRadius: 8,
        overflow: "hidden",
      }}>
        <Img
          src={staticFile(photo)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "contrast(1.1) brightness(0.95)",
          }}
        />

        {/* Annotations layer */}
        {ANNOTATIONS.map((ann, i) => {
          const f = Math.max(0, frame - ann.delay);
          const entrance = spring({
            frame: f,
            fps,
            config: { damping: 15, stiffness: 150 },
          });

          return (
            <div key={i} style={{
              position: "absolute",
              inset: 0,
              opacity: interpolate(entrance, [0, 1], [0, 1]),
            }}>
              {/* Dot on the subject */}
              <div style={{
                position: "absolute",
                left: `${ann.x}%`,
                top: `${ann.y}%`,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: PALETTE.secondary,
                border: `2px solid white`,
                transform: "translate(-50%, -50%)",
                boxShadow: `0 0 12px ${PALETTE.secondary}88`,
              }} />

              {/* Connector line (SVG) */}
              <svg style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}>
                <line
                  x1={`${ann.x}%`}
                  y1={`${ann.y}%`}
                  x2={`${ann.anchorX}%`}
                  y2={`${ann.anchorY}%`}
                  stroke={PALETTE.secondary}
                  strokeWidth={2}
                  strokeDasharray={200}
                  strokeDashoffset={interpolate(
                    entrance, [0, 1], [200, 0]
                  )}
                />
              </svg>

              {/* Label box */}
              <div style={{
                position: "absolute",
                left: `${ann.anchorX}%`,
                top: `${ann.anchorY}%`,
                transform: `translate(-50%, -50%) scale(${interpolate(
                  entrance, [0, 1], [0.8, 1]
                )})`,
                background: "rgba(0,0,0,0.85)",
                padding: "8px 16px",
                borderRadius: 4,
                borderLeft: `3px solid ${PALETTE.secondary}`,
              }}>
                <div style={{
                  fontFamily: FONTS.body,
                  fontSize: 22,
                  color: "#FFFFFF",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}>
                  {ann.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

## Pattern 2: Red Circle Highlight

The classic "look here" technique — circles or rectangles
drawn around parts of an image.

```tsx
interface CircleHighlight {
  x: number;      // center % position
  y: number;
  radius: number;  // px
  label: string;
  delay: number;
}

const CircleAnnotation: React.FC<{
  highlight: CircleHighlight;
}> = ({ highlight }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const f = Math.max(0, frame - highlight.delay);
  const draw = spring({
    frame: f,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  const circumference = 2 * Math.PI * highlight.radius;

  return (
    <>
      {/* Animated circle */}
      <svg style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}>
        <circle
          cx={`${highlight.x}%`}
          cy={`${highlight.y}%`}
          r={highlight.radius}
          fill="none"
          stroke={PALETTE.secondary}
          strokeWidth={3}
          strokeDasharray={circumference}
          strokeDashoffset={interpolate(
            draw, [0, 1], [circumference, 0]
          )}
        />
      </svg>

      {/* Label below circle */}
      <div style={{
        position: "absolute",
        left: `${highlight.x}%`,
        top: `calc(${highlight.y}% + ${highlight.radius + 16}px)`,
        transform: "translateX(-50%)",
        fontFamily: FONTS.body,
        fontSize: 24,
        fontWeight: 600,
        color: PALETTE.secondary,
        opacity: interpolate(draw, [0.7, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        whiteSpace: "nowrap",
      }}>
        {highlight.label}
      </div>
    </>
  );
};
```

## Pattern 3: Arrow Pointer

Animated arrow that draws from label to subject.

```tsx
const ArrowAnnotation: React.FC<{
  fromX: number; fromY: number;
  toX: number; toY: number;
  label: string;
  delay: number;
}> = ({ fromX, fromY, toX, toY, label, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const f = Math.max(0, frame - delay);
  const draw = spring({
    frame: f,
    fps,
    config: { damping: 16, stiffness: 140 },
  });

  // Arrow path
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);

  // Arrowhead points
  const headSize = 12;
  const head1X = toX - headSize * Math.cos(angle - 0.4);
  const head1Y = toY - headSize * Math.sin(angle - 0.4);
  const head2X = toX - headSize * Math.cos(angle + 0.4);
  const head2Y = toY - headSize * Math.sin(angle + 0.4);

  const pathLength = Math.sqrt(dx * dx + dy * dy);

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      opacity: interpolate(draw, [0, 0.3], [0, 1], {
        extrapolateRight: "clamp",
      }),
    }}>
      <svg style={{
        position: "absolute",
        width: "100%",
        height: "100%",
      }}>
        {/* Arrow line */}
        <line
          x1={`${fromX}%`} y1={`${fromY}%`}
          x2={`${toX}%`} y2={`${toY}%`}
          stroke={PALETTE.secondary}
          strokeWidth={2.5}
          strokeDasharray={pathLength * 10}
          strokeDashoffset={interpolate(
            draw, [0, 1], [pathLength * 10, 0]
          )}
        />
        {/* Arrowhead */}
        <polygon
          points={`${toX}%,${toY}% ${head1X}%,${head1Y}% ${head2X}%,${head2Y}%`}
          fill={PALETTE.secondary}
          opacity={interpolate(draw, [0.8, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
        />
      </svg>

      {/* Label at arrow start */}
      <div style={{
        position: "absolute",
        left: `${fromX}%`,
        top: `${fromY - 3}%`,
        transform: "translate(-50%, -100%)",
        fontFamily: FONTS.body,
        fontSize: 24,
        fontWeight: 600,
        color: PALETTE.secondary,
        background: `${PALETTE.bg}CC`,
        padding: "4px 12px",
        borderRadius: 4,
        opacity: interpolate(draw, [0.5, 0.8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}>
        {label}
      </div>
    </div>
  );
};
```

## Composition Guidelines

- **Stagger annotations 15-25 frames apart** — give each
  one time to register before the next appears
- **Max 4-5 annotations per scene** — more than that is
  visual clutter
- **Annotations appear in reading order** — left-to-right,
  top-to-bottom, or following a logical flow
- **Use consistent annotation style** — don't mix circles
  with arrows with boxes in the same scene
- **Photo should be slightly dimmed** — `brightness(0.9)`
  or `contrast(1.1)` so annotations pop against it

## Anti-Patterns

- **Too many simultaneous annotations** — reveal one at
  a time, never all at once
- **Annotations covering the subject** — labels should
  point TO the subject, not obscure it
- **Thin connector lines** — use 2-3px minimum stroke
  width for video readability
- **Annotations without a base image** — if there's no
  photo/diagram underneath, use kinetic typography instead
