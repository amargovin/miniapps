# Editorial Design — Lessons & Principles

Hard-won principles from iterative production. Read this before writing any scene.

## Style Invariants

These are non-negotiable. Every scene must satisfy all of them regardless of visual approach, weight class, or creative direction. If a scene violates any invariant, it is wrong — fix it before anything else.

1. **Palette background only.** Use `PALETTE.bg` for the scene background. For the `editorial` preset this is `#F5F3EE` (cream). Never use dark backgrounds (`#0a0a0a`, `#1a1a2e`, etc.) unless the project's palette preset is `dark-cinematic`.
2. **Serif headlines, sans-serif body.** Headlines and key labels use `FONTS.heading` (Georgia). Body and secondary text use `FONTS.body` (Inter). No exceptions, no swapping.
3. **Information over illustration.** The primary visual vocabulary is typography, data visualization, and photo collage — not hand-drawn SVG objects. Animate the *information*, not a picture of the thing. When illustration is needed, use flat simplified shapes (2-3 colors, no gradients, no faux-detail). Complex multi-path SVG illustrations (buildings with windows, ships with rigging) look amateur when code-generated — avoid them.
4. **Text inhabits the scene.** Text is stenciled, etched, grounded, or atmospheric. Never floating UI labels, never pill badges, never card shadows, never `boxShadow` treatments.
5. **No UI patterns.** No dashboards, no progress bars as progress bars, no card grids, no web-layout spacing. If it could be a screenshot of a web app, it's wrong.
6. **Tight composition around a focal point.** All elements form a cohesive visual group. No scattered elements in separate corners. If you can draw a bounding box around all content that covers less than 60% of the frame, the composition is grouped correctly.

7. **Text contrast adapts to background.** On SeamlessCanvas phases, the background color is sampled from the image and can be light (cream, amber, sage). White text on a light background is invisible — a production failure. Use `PALETTE.text` (`#2C2C2C`) for headlines and `rgba(44,44,44,0.72)` for body text whenever the phase background brightness exceeds 128 (`brightness = (R×299 + G×587 + B×114) / 1000`). See "Text Contrast on SeamlessCanvas" in SKILL.md for the full rule.

Everything below this line is guidance — principles that improve quality but allow creative judgment in application.

---

## 1. Light Backgrounds by Default

Dark backgrounds (`#0a0a0a`, `#1a1a2e`) feel like tech demos, not editorial video essays.
For documentary, explainer, or essay content, **default to light/cream backgrounds** (e.g. `#F5F3EE`, `#FAFAFA`, `#F8F6F3`).

Dark backgrounds are appropriate only for:
- Dramatic reveals / impact moments
- Tech product showcases
- Night/thriller narrative tone

When a brand palette specifies a mandatory background color, always use it. Never override with dark defaults.

## 2. Typography: Serif for Editorial Authority

**The Economist / Claude video effect** comes from serif fonts on headlines:

```
Headlines & Key Labels:  Georgia, "Times New Roman", serif  — authority, editorial gravitas
Body & Secondary Text:   Inter, system-ui, sans-serif       — clean, modern readability
Data & Code:             "JetBrains Mono", monospace        — technical precision
```

When defining `FONTS` in theme.ts, consider the content type:
- Documentary / essay / editorial → `heading: 'Georgia'`
- Tech / product / startup → `heading: 'Inter'`
- News / breaking → `heading: 'Georgia'` or condensed serif

Sans-serif-only typography looks generic. The serif/sans pairing creates visual hierarchy automatically.

## 3. Font Sizes: Bigger Than You Think

First-instinct sizes are almost always too small for 1080p video. Common mistake progression:

```
First attempt:    14-22px labels  →  unreadable
Second attempt:   24-30px labels  →  technically readable but weak
Final (correct):  36-48px+ labels →  confident, editorial presence
```

**Minimum sizes for editorial video (1920x1080):**
```
Hero / Title text:        72-120px  — full-screen statements, big number slams
Entity Names:             48-64px   — company names, country names — visual anchors
Subheadings / Labels:     36-48px   — section headers, setup lines, context phrases
Labels / eyebrows / mono: 34px+     — floor raised July 2026 (LEARNINGS §43)
Body / Supporting text:   28-36px   — anything the viewer needs to read
ABSOLUTE MINIMUM:         28px      — including source citations (raised from
                                      24px, July 2026 — LEARNINGS §43)
```

**The 28px Floor — HARD RULE:**

Any text that carries meaning the viewer should absorb MUST
be 28px minimum. This includes:
- Setup labels ("China's rare earth exports")
- Context phrases ("Indian automakers — that's all they had")
- Entity names ("MARUTI SUZUKI — E-VITARA")
- Attribution lines ("— executives, on camera")
- Subtext lines ("internal e-Vitara target — slashed")

ALL of the above are meaningful content, not citations.

Even **literal source citations** — lines that name the data
source and nothing else ("Source: NITI Aayog 2024",
"Data: IEA 2025") — sit AT the 28px floor, never below it
(raised from 24px after July 2026 user review, LEARNINGS §43).
Nothing in the frame renders under 28px.

**Common violation pattern — "small because secondary":**
Designers instinctively shrink supporting text to create
hierarchy. In web design, 14px sub-labels work because
the viewer's eyes are 60cm from the screen. In video at
1080p, viewed on phones, TVs, and projectors, 14-22px
text is invisible noise. Create hierarchy through WEIGHT
and COLOR, not by shrinking below the floor:

```
BAD:   "MARUTI SUZUKI" at 16px, letter-spacing 7
GOOD:  "MARUTI SUZUKI" at 28px, color: textMuted, letter-spacing 4

BAD:   "— executives, on camera" at 17px
GOOD:  "— executives, on camera" at 28px, opacity: 0.6

BAD:   "CHINA'S RARE EARTH EXPORTS" at 22px
GOOD:  "CHINA'S RARE EARTH EXPORTS" at 30px, color: rgba(255,255,255,0.7)
```

The hierarchy comes from opacity, color, and weight — not
from making text too small to read.

## 4. Visual Approach Hierarchy (Vox/Economist Style)

Professional motion graphics animate *information*, not illustrations. Code-generated SVG drawings of ships, factories, and machines look like clip art — no matter how many windows you add. The following hierarchy produces consistently professional results:

### Tier 1: Kinetic Typography (use most often)
Words are the visual. Text IS the motion graphics.
- **Stacked word builds** — key phrases that stack vertically, each line spring-entering
- **Highlighted phrases** — a sentence on screen where specific words get underlined, colored, or scaled
- **Big number slams** — a stat fills the frame, counts up, then supporting text appears below
- **Pull quote zooms** — narrator's key phrase appears large, camera-style zoom in
- **Word architecture** — words arranged spatially to create visual meaning (stacked, radiating, contrasting)

This is Vox's primary technique. It works because the voice says the words while the screen shows them with emphasis. See `kinetic-typography.md`.

### Tier 2: Animated Data Visualization
Charts, maps, and diagrams where the *data itself* is the visual.
- Animated bar/line charts with spring physics
- Annotated maps with route traces (svg-path-draw)
- Percentage circles, conic sweep gauges
- Animated timelines with milestone markers
- Comparative data: side-by-side numbers, before/after stats

This is The Economist's primary technique. See `charts.md` and `conic-sweep.md`.

### Tier 3: Photo Collage & Duotone
Real photography treated with CSS filters for editorial look.
- **Duotone** — `filter: grayscale(1) contrast(1.2)` + color overlay via `mix-blend-mode: multiply`
- **Masked imagery** — `clip-path` on photos for shaped reveals
- **Ken Burns** — slow zoom on a still photo with text overlay
- **Color wash** — desaturated photo with one accent color remaining

This is what separates professional from amateur. A duotoned photo of a factory looks 10x better than an SVG factory. See `duotone-photo.md`.

### Tier 3b: Generated Backdrops
AI-generated atmospheric images as phase backgrounds, treated with
CSS filters. When no stock photo exists, generate one via ImageGen
(instant mode, up to 5 parallel). Three treatments: full duotone,
defocused atmosphere, masked reveal. Alternate with clean typography
phases — never all-image. See `generated-backdrop.md`.

### Tier 4: Annotated Overlays
Image or diagram with animated callout annotations.
- Arrows, circles, and labels appearing sequentially over an image
- Red circles or underlines highlighting specific parts
- Connector lines from callout to subject

Vox's signature explainer technique. See `annotated-overlay.md`.

### Tier 5: Flat Simplified Illustration (use sparingly)
When you MUST illustrate and no photo exists:
- **Silhouettes and icons** — use Lucide/Phosphor-style icons at large scale (80-200px)
- **Flat shapes** — solid color fills, NO strokes, NO gradients, 2-3 colors max per object
- **Geometric simplification** — a building = rectangle + smaller rectangles. A battery = rounded rect + terminal nubs. That's it.
- **Isometric-lite** — simple 3D perspective with flat colors (no shading)

**What to NEVER attempt in code-generated SVG:**
- Detailed vehicles (curved panels, mirrors, handles)
- Realistic buildings (multiple stories, chimneys with smoke)
- Organic shapes (trees with branches, people with features)
- Mechanical detail (gears with teeth, engine internals)

These always look amateur. Use a photo, an icon, or kinetic typography instead.

**Anti-pattern:** If your visual could be a screenshot of a web app, you haven't found the scene yet. No dashboards, no card grids, no progress bars.

## 5. Text Must Inhabit the Scene

Raw text floating on canvas looks like a wireframe. But the solution is NOT web-style UI treatments (pill badges, card shadows, underline accents). Text should feel like it belongs in the environment.

**Environmental text** — text as part of the physical world:
```tsx
// Stenciled on a wall or surface
<div style={{
  fontFamily: 'Georgia, serif', fontSize: 48,
  color: 'rgba(27,58,95,0.85)', letterSpacing: '2px',
  textTransform: 'uppercase',
  // Texture: slight roughness from the surface
  textShadow: '1px 1px 0 rgba(0,0,0,0.1)',
}}>BATTERY CELL PLANT</div>
```

**Grounded text** — text with perspective, sitting on a surface:
```tsx
// Label etched into a shelf, floor, or platform
<div style={{
  fontFamily: 'Georgia, serif', fontSize: 36,
  color: '#5a4a3a',
  transform: 'perspective(600px) rotateX(15deg)',
  transformOrigin: 'bottom center',
}}>Cathode Material</div>
```

**Atmospheric text** — text affected by the scene's depth and lighting:
```tsx
// Text receding into depth, part of the scene's atmosphere
<div style={{
  fontFamily: 'Georgia, serif', fontSize: 64,
  color: '#2a3a5a',
  opacity: 0.9,
  filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))',
  // Parallax-ready: moves slower than foreground objects
}}>India's Dependency</div>
```

**The test:** If your text treatment could exist in a web app's sidebar, it's wrong. Text should feel painted, stenciled, etched, projected, or grown — not clicked.

## 6. Screen Presence: Double Your First Instinct

Elements on a 1920x1080 canvas are viewed on screens ranging from phones to 4K monitors. Small elements disappear.

| Element | Too Small | Correct |
|---------|----------|---------|
| Scene objects (vessels, buildings, machines) | 100-150px | 250-400px |
| Flow paths (pipes, supply lines, conveyor belts) | 1-2px stroke | 4-8px stroke |
| Object detail (windows, terminals, gauges) | 10-20px | 30-60px |
| Country/entity nodes | r=60-85 | r=150-200 |
| Icons and symbols | 24-32px | 48-80px |

Rule of thumb: if an element looks "about right" in the code preview, it's too small for video. Scale up 1.5-2x.

## 7. Tight Composition — No Scattered Layouts

The most common anti-pattern from web design thinking: elements placed in separate corners or edges of the frame with empty space between them. This is a web page layout, not a cinematic frame.

**The rule:** All scene elements should form a cohesive visual group, composed around a single focal area. Elements relate to each other spatially — stacked, overlapping, adjacent, connected by lines or flows. They do not float independently in different quadrants.

**Cinematic composition:** The frame has a center of gravity. Elements orbit it. A factory with smoke stacks, surrounded by supply lines, with a label stenciled on the wall — that's a composed scene. A factory in the top-left, a chart in the bottom-right, and a label floating in the center — that's a web layout wearing a video costume.

**Image phases especially (LEARNINGS §44):** a small label in one corner and an image in another, with dead space between, is a HARD FAIL in the visual still review. Either build a composed multi-level text block — eyebrow + headline-weight line + supporting detail, tied together with an animated accent — or let a luminous image carry the frame narration-led with minimal text. Never crush the image under a dark overlay to make weak text legible.

**How to self-check:**
- Could you draw a circle around all your elements that covers less than 60% of the frame? Good — they're grouped.
- If your elements could be rearranged without changing the meaning, they are not composed — they are just placed.
- If removing one element wouldn't create a visual gap in the group, it wasn't connected to the composition.

**Composition strategies:**
- **Stacked/layered**: foreground object, mid-ground context, background environment
- **Connected by flow**: elements linked by pipes, wires, conveyor belts, arrows, or supply lines
- **Nested**: smaller elements contained within larger ones (cells inside a battery, workers inside a factory)
- **Radiating**: elements emanating from a central focal point (supply routes from a hub, cracks from an impact)

## 8. When You Must Use SVG: Flat & Minimal

Avoid code-generated illustration whenever possible (use typography, data viz, or photos instead). When SVG illustration is unavoidable:

**DO — flat, minimal, 2-3 color:**
- Simple silhouette shapes (solid fill, no stroke)
- Icon-scale objects (Lucide/Phosphor aesthetic)
- Geometric simplification: rectangle = building, circle = node, line = connection
- Maps using official SVG path data (never approximate)

**DON'T — detailed, multi-path, faux-realistic:**
- Curved body panels, windshields, mirrors on vehicles
- Windows, chimneys, smoke, doors on buildings
- Individual cell grids on batteries
- Gears with teeth, engine internals
- Trees with branches, people with features

**The test:** If your SVG has more than 8-10 path elements for a single object, it will look like clip art. Simplify or switch to a different visual approach entirely.

## 9. Map Accuracy

**Never approximate country outlines.** Use official SVG path data:

- India: Must include J&K + Ladakh. Use `fillRule="evenodd"` for multi-subpath rendering.
- Reference: `atharvvvg/map-india-svg` on GitHub (viewBox `0 0 1000 1136`)
- Other countries: Find proper SVG outlines from reputable sources

For India specifically, using an inaccurate map is a content sensitivity issue, not just an aesthetic one.

## 10. Color Palette Discipline

When a brand/project defines a palette:
1. **Background**: Use the specified bg color. If none specified, default LIGHT not dark.
2. **Primary contrast**: Text color should have 4.5:1+ contrast ratio against bg.
3. **Accent colors**: Use for highlights, borders, fills — not as primary text color.
4. **Tinted fills**: Use palette colors at 10-20% opacity for area fills (node backgrounds, card backgrounds).

### Palette Presets

Select a preset in the ontology (`palette_preset` field).
Write the chosen preset to `theme.ts` at project setup.

| Preset | bg | primary | secondary | accent | text | textMuted | Feel |
|--------|-----|---------|-----------|--------|------|-----------|------|
| **editorial** | `#F5F3EE` | `#1B3A5F` | `#C4373B` | `#C4873B` | `#1A1A1A` | `rgba(26,26,26,0.55)` | Economist, documentary |
| **dark-cinematic** | `#0A0A0F` | `#4A9EFF` | `#FFB347` | `#6366F1` | `#E8E8F0` | `rgba(232,232,240,0.5)` | Film noir, tech |
| **vibrant** | `#FFFFFF` | `#4F46E5` | `#059669` | `#F97316` | `#1A1A1A` | `rgba(26,26,26,0.55)` | Bold, startup, energy |
| **muted** | `#E8E4DF` | `#475569` | `#BE7B7B` | `#7C9473` | `#2D3748` | `rgba(45,55,72,0.55)` | Thoughtful, reflective |
| **monochrome** | `#FAFAFA` | `#1A1A1A` | `#6B7280` | `#9CA3AF` | `#1A1A1A` | `rgba(26,26,26,0.45)` | Minimal, serious |

**Choosing a preset:**
- Documentary / editorial / essay → **editorial** (default)
- Tech product / dramatic / thriller → **dark-cinematic**
- Startup / bold / energetic → **vibrant**
- Personal / reflective / nuanced → **muted**
- Serious / formal / minimal → **monochrome**

**Custom palettes:** If a brand provides specific colors,
create a custom PALETTE following the same 6-key structure.
The preset system is a starting point, not a cage.

**Per-scene palette emphasis:** The ontology specifies
which 2-3 palette keys dominate each scene. This prevents
every scene using the same color mix. Vary emphasis across
the video: primary-heavy → accent-heavy → secondary-heavy.

## 12. Camera Drift — Vary It, Don't Uniform It

A subtle scale drift on a phase's outermost container prevents
the "static slide" feel. But applying the SAME drift to every
phase creates its own monotony — the viewer subconsciously
detects the uniform zoom and it feels mechanical.

**Rule:** Use drift as a creative tool. Vary it between phases.
Some phases drift, some hold still, some drift differently.
The contrast between drifting and static phases is what makes
both effective.

**Drift options (choose per phase):**

| Treatment | Code | Feel | Use When |
|---|---|---|---|
| Slow zoom in | `scale(1 → 1.03)` | Drawing closer, tension building | Stats, reveals, emotional beats |
| Slow zoom out | `scale(1.03 → 1)` | Pulling back, breathing room | Context phases, wide shots |
| No drift | (none) | Stillness, authority, finality | Bold statements, color washes, punchy closes |
| Ken Burns on image only | `scale(1 → 1.06)` on `<Img>`, text static | Parallax depth — image moves, text anchored | Backdrop phases where image IS the motion |

```tsx
// Zoom in (most common)
const drift = interpolate(frame, [0, PHASE_DURATION], [1, 1.03], {
  extrapolateRight: 'clamp',
});

// Zoom out (for pull-back beats)
const drift = interpolate(frame, [0, PHASE_DURATION], [1.03, 1], {
  extrapolateRight: 'clamp',
});

// Apply to outermost container:
// transform: `scale(${drift})`
```

**Per-scene variety target:** In a 4-phase scene, use at least
2 different drift treatments. Example:
- Phase 1: zoom in (building toward stat)
- Phase 2: Ken Burns on backdrop image, text static (parallax)
- Phase 3: no drift (still, authoritative contradiction)
- Phase 4: no drift (bold color wash, slam text — stillness = finality)

**Implementation notes:**
- Apply to the outermost container, not individual text elements
- The 1.03 ceiling is intentional — beyond ~1.04 reads as active zoom
- For backdrop phases, the image's own Ken Burns (1→1.06) provides
  motion. Adding container drift on top is optional — it creates
  parallax (image moves faster than text) which can be powerful
  but isn't always needed
- Stillness is a valid creative choice. A phase with zero drift
  after a drifting phase feels authoritative and grounded

## 13. Film Grain / Noise Texture (Optional — Recommended for Production Polish)

A subtle noise overlay at 3–5% opacity makes scenes feel cinematic rather than like a web slideshow. It adds texture that the eye reads as "film" rather than "screen."

Apply as an absolutely-positioned `div` on top of all scene content with `pointerEvents: 'none'` so it does not interfere with any interaction or hit-testing.

```tsx
<div style={{
  position: 'absolute',
  inset: 0,
  opacity: 0.04,
  pointerEvents: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
  backgroundSize: '128px 128px',
}} />
```

**This is optional.** It is a finishing touch, not a structural requirement. Add it after the scene is compositionally correct. Do not add it to fix other problems — grain cannot rescue bad typography or poor composition.

**When it helps most:**
- Light cream backgrounds (the `editorial` palette) — grain removes the "digital white" flatness
- Scenes that already look good but feel too clean or synthetic
- Final render pass before delivery

**When to skip it:**
- If the scene uses strong photo collage (the photos already carry texture)
- Data visualization scenes where clean precision is the point
- If the project style guide specifies a clean/minimal aesthetic

## 14. Visual Hierarchy Checklist

Before finalizing any scene, verify:

- [ ] **No UI patterns**: no pill badges, card shadows, dashboard grids, progress bars, or boxShadow card treatments
- [ ] **Visual approach from the hierarchy**: kinetic typography → data viz → photo collage → annotated overlay → flat SVG (in order of preference)
- [ ] **No amateur SVG**: if using illustration, it's flat/minimal (under 10 paths per object), not detailed clip-art
- [ ] **Information is animated, not decorated**: the motion shows the data/argument, not a picture of the topic
- [ ] **Cinematic composition**: scene has a focal point and tight grouping
- [ ] **Elements tightly composed** around a focal area — no scattered corner placement or web-layout spacing
- [ ] Background is appropriate for content type (light for editorial, dark only if justified)
- [ ] Headlines use serif font at 30px+ minimum
- [ ] Text inhabits the scene (stenciled, etched, grounded) — not floating UI labels
- [ ] Key entities (countries, products, concepts) have strong screen presence
- [ ] Country maps use official outlines
- [ ] Color palette matches project/brand requirements
- [ ] At least one phase per scene uses a non-default background color
- [ ] Hold phases have subtle scale drift (1 to 1.03) to avoid static feel
- [ ] Smallest text element is still readable at arm's length on a phone
- [ ] (Optional) Film grain overlay applied for cinematic texture
