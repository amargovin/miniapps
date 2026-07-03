# Generated Backdrop — AI Image Backgrounds Per Phase

AI-generated images as atmospheric phase backgrounds, treated
with CSS filters to maintain editorial authority. The image
sets mood and context; typography still tells the story.

**Dependency:** Uses the ImageGen skill (instant mode) to
generate images via Google Nano Banana Pro (Gemini 3 Pro).

## When to Use

- Phases that benefit from atmosphere beyond flat color
- Real-world subjects where photography would anchor the
  content (ports, factories, corridors, landscapes)
- Emotional or establishing beats where mood matters
- Hero scenes that need cinematic weight
- NOT every phase — alternate with clean typography phases
  to create visual breathing (see Rhythm section)

## Generation Workflow

### Step 1: Craft Atmospheric Prompts

Prompts must request **environmental/atmospheric** shots,
NOT literal depictions of the content. The image provides
mood, not narrative.

**Always include these style anchors:**
`editorial photography, shallow depth of field, cinematic
lighting, atmospheric, muted palette, no text, no words,
no letters, no watermarks`

**Prompt crafting rules:**
- Describe a physical environment, not a concept
- Ask for shallow depth of field (natural focus falloff)
- Specify lighting (golden hour, tungsten, diffused, etc.)
- Request muted/desaturated palette (the CSS treatment
  handles color — raw vivid images fight the overlay)
- NEVER include text/words/labels in the prompt — AI
  models render them poorly and they conflict with
  typography overlay
- NEVER wrap intended text in quotes — models render
  quotation marks literally

| Phase Content | Bad Prompt | Good Prompt |
|---|---|---|
| Battery imports stat | "batteries being imported to India" | "cargo port at dusk, shipping containers stacked deep, cinematic lighting, shallow depth of field, editorial photography, atmospheric haze, muted palette" |
| China supply chain dominance | "China flag with batteries" | "industrial factory floor, chemical processing vats, warm tungsten lighting, shallow DOF, atmospheric steam, editorial photography, muted palette" |
| Policy announcement | "Indian government building" | "marble corridor with tall arched windows, morning light streaming in, shallow depth of field, editorial photography, atmospheric, muted warm tones" |
| Technology gap | "old vs new factory" | "abandoned workshop interior, dust particles in shaft of light, rusty machinery, shallow DOF, editorial photography, cinematic, desaturated" |
| Market growth | "graph going up" | "aerial view of highway interchange at golden hour, vehicles in motion blur, cinematic lighting, editorial photography, muted palette" |

### Step 2: Generate Images (Up to 5 Parallel)

Fire up to 5 instant ImageGen requests simultaneously.
Use 16:9 aspect ratio at 2K for 1920x1080 video frames.
Save to the project's `public/` directory.

```bash
# Generate up to 5 phase backdrops in parallel
# Each runs in instant mode (synchronous per call,
# but launch all 5 as parallel Bash tool calls)

bun run /Users/amar/.claude/skills/ImageGen/tools/GenerateImage.ts \
  --prompt "cargo port at dusk, shipping containers stacked deep, cinematic lighting, shallow depth of field, editorial photography, atmospheric haze, muted palette, no text no words no letters" \
  --size 2K \
  --aspect-ratio 16:9 \
  --output ./remotion/public/backdrop-phase1.png

bun run /Users/amar/.claude/skills/ImageGen/tools/GenerateImage.ts \
  --prompt "industrial factory floor, chemical processing vats, warm tungsten lighting, shallow DOF, atmospheric steam, editorial photography, muted palette, no text no words no letters" \
  --size 2K \
  --aspect-ratio 16:9 \
  --output ./remotion/public/backdrop-phase3.png

# ... up to 5 parallel calls
```

**Naming convention:** `backdrop-{sceneId}-phase{N}.png`
e.g., `backdrop-scene04-phase1.png`

### Step 3: Apply CSS Treatment

Every generated image goes through a treatment stack.
NEVER use a raw AI image as background — it will look
like an AI slideshow, not editorial motion graphics.

## Three Treatment Options

### Treatment A: Full Duotone (Recommended Default)

The Economist documentary look. Image fills frame,
heavy filter treatment makes it monochromatic, white
text on top.

**Best for:** Stat reveals, emotional beats, hero moments.

```tsx
import {
  AbsoluteFill, Img, staticFile, useCurrentFrame,
  useVideoConfig, spring, interpolate,
} from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

export const DuotoneBackdrop: React.FC<{
  image: string;       // staticFile path e.g. "backdrop-phase1.png"
  headline: string;
  subtext?: string;
  tintColor?: string;  // defaults to PALETTE.primary
}> = ({ image, headline, subtext, tintColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tint = tintColor || PALETTE.primary;

  // Ken Burns slow zoom
  const zoom = interpolate(frame, [0, 150], [1, 1.06], {
    extrapolateRight: "clamp",
  });

  // Text entrance
  const textIn = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: MOTION.springSnappy,
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Layer 1: Generated image with Ken Burns */}
      <Img
        src={staticFile(image)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "grayscale(0.85) contrast(1.3) brightness(0.85)",
          transform: `scale(${zoom})`,
          willChange: "transform",
        }}
      />

      {/* Layer 2: Color tint overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: tint,
        mixBlendMode: "multiply",
        opacity: 0.6,
      }} />

      {/* Layer 3: Dark vignette for text readability */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(
          ellipse 70% 60% at 50% 50%,
          transparent 30%,
          rgba(0,0,0,0.55) 100%
        )`,
      }} />

      {/* Layer 4: Bottom gradient for lower-third text */}
      <div style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(transparent 50%, rgba(0,0,0,0.5) 100%)",
      }} />

      {/* Layer 5: Typography */}
      <div style={{
        position: "absolute",
        bottom: 120,
        left: 192,
        right: 192,
        opacity: interpolate(textIn, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(
          textIn, [0, 1], [30, 0]
        )}px)`,
      }}>
        <div style={{
          fontFamily: FONTS.heading,
          fontSize: 64,
          fontWeight: 700,
          color: "#FFFFFF",
          lineHeight: 1.15,
          marginBottom: 16,
          textShadow: "0 2px 20px rgba(0,0,0,0.4)",
        }}>
          {headline}
        </div>
        {subtext && (
          <div style={{
            fontFamily: FONTS.body,
            fontSize: 30,
            color: "rgba(255,255,255,0.85)",
            textShadow: "0 1px 10px rgba(0,0,0,0.3)",
          }}>
            {subtext}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
```

### Treatment B: Defocused Atmosphere

Image is heavily blurred and desaturated — becomes a
soft, painterly backdrop. Text stays razor-sharp in
foreground. The contrast between blurred bg and sharp
text sells cinematic depth.

**Best for:** Context-setting phases, transitions,
supporting beats where text is the primary content.

```tsx
export const DefocusedBackdrop: React.FC<{
  image: string;
  children: React.ReactNode;  // text content as children
}> = ({ image, children }) => {
  const frame = useCurrentFrame();

  // Slow drift
  const drift = interpolate(frame, [0, 150], [1, 1.04], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Layer 1: Blurred image */}
      <Img
        src={staticFile(image)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(16px) grayscale(0.7) contrast(1.1) brightness(0.8)",
          transform: `scale(${drift * 1.05})`,
          willChange: "transform, filter",
        }}
      />

      {/* Layer 2: Subtle tint */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: PALETTE.bg,
        opacity: 0.25,
      }} />

      {/* Layer 3: Sharp foreground content */}
      <AbsoluteFill style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 192,
      }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

### Treatment C: Masked Reveal

Image visible through a geometric clip-path (circle,
polygon, diagonal). Rest of frame is solid PALETTE.bg.
Text sits in the solid area. Editorial magazine feel.

**Best for:** When the image itself is worth seeing with
some clarity. Good for introducing a new topic or location.

```tsx
export const MaskedBackdrop: React.FC<{
  image: string;
  headline: string;
  maskShape?: "circle" | "diagonal-left" | "diagonal-right";
}> = ({ image, headline, maskShape = "circle" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reveal = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const clipPaths = {
    "circle": `circle(${interpolate(reveal, [0, 1], [0, 38])}% at 65% 50%)`,
    "diagonal-left": `polygon(${interpolate(reveal, [0, 1], [100, 45])}% 0%, 100% 0%, 100% 100%, ${interpolate(reveal, [0, 1], [100, 55])}% 100%)`,
    "diagonal-right": `polygon(0% 0%, ${interpolate(reveal, [0, 1], [0, 55])}% 0%, ${interpolate(reveal, [0, 1], [0, 45])}% 100%, 0% 100%)`,
  };

  const textIn = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: MOTION.springSnappy,
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      {/* Masked image region */}
      <div style={{
        position: "absolute",
        inset: 0,
        clipPath: clipPaths[maskShape],
        overflow: "hidden",
      }}>
        <Img
          src={staticFile(image)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "grayscale(0.6) contrast(1.2)",
          }}
        />
        <div style={{
          position: "absolute",
          inset: 0,
          background: PALETTE.primary,
          mixBlendMode: "multiply",
          opacity: 0.4,
        }} />
      </div>

      {/* Text in the solid bg region */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: 120,
        width: "35%",
        transform: `translateY(-50%) translateY(${interpolate(
          textIn, [0, 1], [20, 0]
        )}px)`,
        opacity: interpolate(textIn, [0, 1], [0, 1]),
      }}>
        <div style={{
          fontFamily: FONTS.heading,
          fontSize: 56,
          fontWeight: 700,
          color: PALETTE.text,
          lineHeight: 1.2,
        }}>
          {headline}
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

## Rhythm: Alternating Image and Clean Phases

**Critical rule:** NOT every phase gets a backdrop image.
Alternate between image-backed and clean typography phases
to create visual breathing.

```
Phase 1: IMAGE (duotone)     — sets the world, establishes mood
Phase 2: CLEAN typography    — stat slam on PALETTE.bg, focused
Phase 3: IMAGE (defocused)   — atmosphere shift, new context
Phase 4: CLEAN typography    — landing statement, breathing room
Phase 5: IMAGE (masked)      — final reveal with visual weight
```

**Why this works:**
- All-image phases feel relentless and visually noisy
- All-typography phases feel flat and slideshow-like
- The contrast between them makes BOTH more powerful
- Image phases earn their impact by being surrounded by
  clean space

**Density guidelines:**
- In a 4-phase scene: 1-2 image phases, 2-3 clean
- In a 6-phase scene: 2-3 image phases, 3-4 clean
- NEVER more than 2 consecutive image-backed phases
- Hero scenes can push to 60% image-backed
- Connective scenes should stay at 0-25% image-backed

## Combining with Other Patterns

Generated backdrops layer naturally with existing patterns:

| Combination | Effect |
|---|---|
| Backdrop + `depth-blur` | Focus pull from blurred bg to sharp text |
| Backdrop + `parallax-layers` | Multi-plane depth with image as far layer |
| Backdrop + `clip-path-reveal` | Phase enters via wipe revealing the image |
| Backdrop + `blend-layers` | Text blended into the image via multiply |
| Backdrop + `speed-remap` | Slam-stop on key text over atmospheric bg |
| Backdrop + `kinetic-typography` | Stacked word build over defocused image |

## Treatment Selection Guide

| Phase Weight | Content Type | Recommended Treatment |
|---|---|---|
| Hero | Emotional beat, climax | A: Full Duotone |
| Hero | Key stat reveal | A: Full Duotone |
| Supporting | Context/setup | B: Defocused Atmosphere |
| Supporting | Topic transition | C: Masked Reveal |
| Connective | Breathing room | No backdrop (clean) |

## Anti-Patterns

- **Raw AI image with no filter treatment** — looks like
  an AI slideshow. ALWAYS apply grayscale + contrast +
  tint overlay at minimum.
- **Text fighting the image** — if you're covering 80%+
  of the image with text, use clean typography instead.
  The image should be visible and contribute atmosphere.
- **Every phase has a backdrop** — creates visual fatigue.
  Alternate with clean phases. See Rhythm section.
- **Literal prompt matching content** — "a battery being
  imported" produces bad AI art. Use atmospheric/
  environmental prompts instead.
- **Vivid/saturated AI images** — fight the editorial
  treatment. Request muted palettes in prompts so the
  CSS overlay works harmoniously.
- **Text in the image prompt** — AI models render text
  poorly. All text is added as HTML typography overlay,
  never baked into the generated image.
- **Inconsistent image style** — all backdrop images in
  a video should share the same style anchors in their
  prompts (editorial photography, shallow DOF, muted
  palette) for visual coherence across scenes.
