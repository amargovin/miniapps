# Image Style Guide for Remox Video

Image style is a **user decision**, not a skill default. During pre-production,
ask the user which style they want or read it from the ontology. Never assume
a default style.

## Bespoke Vector Illustration — Last Resort

**Bespoke vector illustration (hand-coded SVG diagrams with thin lines and
small shapes) is now a LAST RESORT.** It is a confirmed amateur tell when used
for scene-setting, concept diagrams, engagement geometry, or network maps.

**Before reaching for bespoke SVG, use an illustrated plate instead:**
see `skills/cinematic/illustrated-plate.md` — a 4K textless AI-generated
illustration with a cinematic camera (zoom/pan keyframes, synced to narration).
Plates produce professional, broadcast-quality results in less authoring time.

**Reserve bespoke vector for:**
- Data charts where axis alignment and animated counters require code
  (use `charts.md` patterns)
- Kinetic typography phases where vector is the decorative element (rule
  draws, underlines, accent brackets)

**When vector IS used, modern tokens are mandatory:**
- All diagram strokes via `strokeGlow()` — core + halo dual-stroke
- All bars/fills via `barFill()` — gradient + highlight
- All gridlines via `gridline()` — 2px at 18% opacity
- See `motion-doctrine.md` § "Modern vector language" for the full doctrine

---

## Available Styles

| Style | Prompt directive | Best for |
|-------|-----------------|----------|
| **Photorealistic** | "cinematic documentary photography, shallow depth of field, film grain, natural lighting. No text." | Defence, industrial, facilities, people, military hardware |
| **Editorial portrait** | "editorial portrait photography, dramatic lighting, desaturated documentary treatment, film grain. No text." | Key figures, leaders, scientists |
| **WPA poster** | "in Modern Vintage Poster Style - bold, screen-printed aesthetic with large fields of flat color, inspired by WPA National Park posters. No text, no photorealism, no gradients." | Stylized, iconic, abstract concepts |
| **Satellite/recon** | "satellite reconnaissance imagery, thermal imaging aesthetic, grainy surveillance footage. No text." | Stealth, surveillance, strategic overview |
| **Dark cartography** | "dark geopolitical map, strategic military overlay, city lights at night, cinematic cartography. No text." | Geography, force projection, range arcs |
| **Industrial documentary** | "industrial documentary photography, tungsten lighting, concrete and steel, film grain, technical environment. No text." | Facilities, reactors, labs, infrastructure |

## How to Select

The image style is set at the **ontology level** — one primary style per
project, with per-scene overrides where appropriate. Read the user's
preference from:
1. Explicit instruction ("use photorealistic images")
2. The ontology's `image_style` field
3. The brief's per-phase `image_style` field

If no style is specified, **ask the user**. Do not default to any style.

## Real Photographs

When the user provides real photographs of people, places, or hardware:
- **Always prefer real photos over AI-generated images**
- Process for documentary treatment: `ffmpeg -vf "crop=...,eq=contrast=1.3:saturation=0.4,noise=alls=8:allf=t"`
- Check resolution — upscale with lanczos if below minimum (see LEARNINGS.md §29)
- Set `objectPosition` to keep faces visible (see LEARNINGS.md §27)

## Color Palettes by Scene Mood

| Mood | Colors |
|------|--------|
| Defence/Authority | Deep Navy (#1B3A5F), Steel Gray, Burnt Orange, Teal |
| Danger/Threat | Burnt Orange, Deep Red (#CE5152), Muted Yellow, Navy |
| India/Technology | Warm Amber (#C4873B), Deep Teal (#2A7B6F), Navy, Gold |
| Analysis/Strategy | Navy (#1B3A5F), Slate Gray, Cream, Burgundy accent |
| Resolution/Achievement | Dawn Gold, Amber, Navy, Teal, Cream |

Use 4-6 specific named colors per prompt. Vary the dominant color
across scenes for visual rhythm.

## Subject & Topic Specificity (CRITICAL)

Image prompts must be specific to the actual subject matter of the video.
Generic imagery kills credibility. The viewer must recognize what they're
looking at.

**Rules:**
1. Name specific hardware, vehicles, organizations, locations
2. Reference real-world equivalents the viewer would recognize
3. Avoid generic terms without context

**Examples — BAD vs GOOD:**

| Bad (generic) | Good (specific) |
|---|---|
| "rocket launching" | "Indian PSLV rocket launching from Sriharikota launch pad" |
| "missile in storage" | "Agni-V ballistic missile on mobile TEL launcher" |
| "nuclear reactor" | "Interior of fast breeder reactor vessel, fuel rod assemblies, sodium coolant pipes" |
| "submarine" | "INS Arihant SSBN surfacing, Indian Navy nuclear submarine" |

**How to apply:** Before writing any image prompt, ask:
- What SPECIFIC thing is this scene about?
- What would the viewer expect to see?
- What real-world object/place/vehicle matches this narration?
- Would an expert on this topic recognize this image as accurate?

## Aspect Ratios for Video Panels

| Panel usage | Aspect ratio |
|---|---|
| Focal-offset split (48% panel) | 1:1 |
| Lower-third (top 60%) | 16:9 |
| Masked-reveal (circle/shape) | 1:1 |
| Full-bleed (rare) | 16:9 |

## Composition in Video Frames

Illustrations live ALONGSIDE text in **focal-offset** splits —
image panel on one side (48%), text on the other (52%).

**Alternate sides** between phases for visual rhythm.

**objectFit: cover** on image panels for Ken Burns zoom room.

## Ken Burns on Image Panels (Standard)

All focal-offset and lower-third image panels get subtle Ken Burns:
- Image panel: `transform: scale(1.0 → 1.06)` over phase duration
- Container: `overflow: hidden` to clip the zoom
- Text panel: completely static
- Creates parallax depth between moving image and still text

Does NOT apply to masked-reveal or centered-hero.

## AV Sync Rule

**Every phase change must match the narration.** When the visual
transitions to a new phase, the narration should be reaching that
topic. The viewer must never see visuals that are ahead of or behind
what they're hearing.

Phase durations are derived from word-level timestamps. The first
word of each phase's narration content determines when that phase
starts visually.

## Image Density Target

- ~50% of phases should have an image (±10%)
- Hero scenes: up to 60%
- Connective scenes: 25-40%
- Never more than 3 consecutive text-only phases
- Never more than 2 consecutive image phases with same side

## What NOT to Do

- Do NOT hardcode a default image style — always read user preference
- Do NOT use dark/black backgrounds unless the brief specifies it
- Do NOT use gradients or 3D effects
- Do NOT make images full-bleed with text overlaid — use split layouts
- Do NOT add clutter — bold, simplified shapes only
