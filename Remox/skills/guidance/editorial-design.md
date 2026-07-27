# Editorial Design — Lessons & Principles

Hard-won principles from iterative production. Read this before writing any scene.

## Style Invariants

These are non-negotiable. Every scene must satisfy all of them regardless of visual approach, weight class, or creative direction. If a scene violates any invariant, it is wrong — fix it before anything else.

1. **Palette background only.** Use `PALETTE.bg` for the scene background. For the `editorial` preset this is `#F5F3EE` (cream). Never use dark backgrounds (`#0a0a0a`, `#1a1a2e`, etc.) unless the project's palette preset is `dark-cinematic`.
2. **Distinct heading vs body families.** Headlines and key labels use `FONTS.heading`; body and secondary text use `FONTS.body` — never collapse them into one family. Which families those tokens carry is a brand decision (Swarajya: Archivo display + Helvetica body — see typography.md → "BRAND OVERRIDE", §6). Never set fonts without checking the brand guide.
3. **Information over illustration.** The primary visual vocabulary is typography, data visualization, and photo collage — not hand-drawn SVG objects. Animate the *information*, not a picture of the thing. When illustration is needed, use flat simplified shapes (2-3 colors, no gradients, no faux-detail). Complex multi-path SVG illustrations (buildings with windows, ships with rigging) look amateur when code-generated — avoid them.
4. **Text inhabits the scene.** Text is stenciled, etched, grounded, or atmospheric. Never floating UI labels, never pill badges, never card shadows, never `boxShadow` treatments.
5. **No UI patterns.** No dashboards, no progress bars as progress bars, no card grids, no web-layout spacing. If it could be a screenshot of a web app, it's wrong.
6. **Tight composition around a focal point.** All elements form a cohesive visual group. No scattered elements in separate corners. If you can draw a bounding box around all content that covers less than 60% of the frame, the composition is grouped correctly.

7. **Text contrast adapts to background.** On SeamlessCanvas / over-image phases, sampled backgrounds can be light (cream, amber, sage) — white text on them is invisible. Choose text color by the brightness rule and back it with a SOLID chip (not a soft scrim). Full rule: SKILL.md → "Text Contrast on SeamlessCanvas" (§59).

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

## 2. Typography: Distinct Heading + Body Families

Sans-serif-only typography looks generic — a distinct heading/body pairing
creates visual hierarchy automatically (the Economist / Claude editorial
effect). WHICH families is a brand decision: for Swarajya, Archivo display +
Helvetica body (typography.md → "BRAND OVERRIDE", §6). Load display type via
`@remotion/google-fonts` with true 800/900 weights — system-font faux-bold is
an amateur tell.

## 3. Font Sizes: Bigger Than You Think, Hierarchy Through Weight Not Size

First-instinct sizes are almost always too small for 1080p video, and the
reflex to shrink "secondary" text below the floor is the #1 legibility failure.
**All canonical size floors (landscape and portrait) live in typography.md**
(§43 floors, §52 role-sizing) — author to those, never restate them here.

The one principle that belongs here: **create hierarchy through WEIGHT, COLOR,
and OPACITY — never by dropping below the floor.** A 14-22px sub-label works on
a web page (viewer 60cm away) but is invisible noise in video on phones and
TVs. Every meaningful line — setup labels, entity names, attributions, even
bare source citations ("Source: NITI Aayog 2024") — sits AT the floor, not
below it.

```
BAD:   "MARUTI SUZUKI" at 16px, letter-spacing 7
GOOD:  "MARUTI SUZUKI" at floor size, color: textMuted, letter-spacing 4
```

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

**Image phases especially (§44):** a small label in one corner and an image in another, with dead space between, is a HARD FAIL in the visual still review — see composition-templates.md → Composition Doctrine #2 for the full rule (composed text block OR luminous narration-led full-bleed; never crush the image under a dark overlay).

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

**Never approximate country outlines, and NEVER AI-generate a
boundary-bearing map.** Use official vector data. Full doctrine (dataset,
extract-simplify-render, verify-by-crop) lives in `maps.md` (§63) — read it
before rendering any map where borders matter.

- India: Must show the FULL official claim as one unbroken landmass — J&K
  incl. PoK and Gilgit-Baltistan, Ladakh, Aksai Chin; NO LoC as an
  international border. Preferred source: an official GeoJSON
  (datameet/maps `india-composite.geojson`); coded-SVG fallback
  `atharvvvg/map-india-svg` (viewBox `0 0 1000 1136`, `fillRule="evenodd"`).
- Other countries: proper SVG outlines from reputable sources, verified.

For India specifically, using an inaccurate map is a content sensitivity and
legal issue, not just an aesthetic one — see maps.md.

## 10. Color Palette Discipline

When a brand/project defines a palette:
1. **Background**: Use the specified bg color. If none specified, default LIGHT not dark.
2. **Primary contrast**: Text color should have 4.5:1+ contrast ratio against bg.
3. **Accent colors**: Use for highlights, borders, fills — not as primary text
   color. This matters MORE than it looks: a mid-tone accent (e.g. brand bronze
   `#C4873B`) can look dark enough to trust as text yet fail contrast badly
   (~2.75:1 on cream). For accent-colored TEXT, add a darkened `accentInk`
   variant to the palette and use it — see typography.md → "Bronze on cream
   fails" (§60). Keep the bright accent for graphics only.
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

**`accentInk` — the 7th key (§60):** where the palette's `accent` is a
mid-tone (bronze, ochre, warm gold) that will be used for text on a light bg,
add an `accentInk` key one step darker (e.g. editorial `accent #C4873B` →
`accentInk #8A5E22`, ~5.11:1 on cream). Bright `accent` = graphics only
(rules, dots, bars, arrows, badges); `accentInk` = accent-colored TEXT. See
typography.md → "Bronze on cream fails."

**Custom palettes:** If a brand provides specific colors,
create a custom PALETTE following the same 6-key structure (plus `accentInk`
where needed). The preset system is a starting point, not a cage.

**Per-scene palette emphasis:** The ontology specifies
which 2-3 palette keys dominate each scene. This prevents
every scene using the same color mix. Vary emphasis across
the video: primary-heavy → accent-heavy → secondary-heavy.

## 11. Imagery Treatment (canonical — LEARNINGS §2, §3, §4, §17, §25, §27, §29, §30)

How photographs and generated images are treated in-frame. Every rule below
was learned from a user-flagged production failure.

### 11.1 Backdrop image treatment — light touch, keep the color (§2)

What failed: `grayscale(0.7)` + `brightness(0.8)` = "grey something in the
background"; `blur(16px)` = unrecognizable; a full-screen dark overlay at
0.45 opacity killed the image entirely.

What works:
- `blur(4px) contrast(1.1) brightness(0.95)` — gentle depth without
  destroying the image
- NO grayscale — keep the color; that's the whole point of a backdrop image
- NO full-screen dark overlay — handle text readability locally, not globally

### 11.2 Text readability over images (§3)

Static frosted-glass panels (light `rgba(245,243,238,0.75)` or dark
`rgba(0,0,0,0.4)`) read as lazy overlays pasted on top. What works: the
**AnimatedTextBox** pattern — an SVG border draws itself on (~15 frames), a
dark fill (`rgba(0,0,0,0.35)`) fades in behind, text reveals after the box is
drawn. The background treatment becomes a deliberate design element, not a
readability hack. Size the box to the text, never a fixed screen percentage.

### 11.3 AnimatedTextBox text color (§4)

The box's fill is dark and translucent, so text inside MUST be white or
light (`#FFFFFF`, `rgba(255,255,255,0.85)`, cream). NEVER dark palette
colors inside it — dark text on a dark transparent box over a dark image is
invisible. For emphasis, vary brightness (full white hero, 0.7 white muted);
warm accents are OK at full saturation.

### 11.4 Visuals must ADD to audio — never text-karaoke (§25)

Displaying the narrator's exact words as on-screen text ("75,000 TONNES /
NUCLEAR-POWERED" while the narrator says exactly that) wastes the visual
channel and bores the viewer. Good documentary visuals:

1. **SHOW what the narrator TELLS** — the image depicts the subject while
   the voice describes it
2. **ADD information audio can't** — maps, faces, diagrams, facilities
3. **Create emotional context** — dark ocean for stealth, reactor room for
   engineering difficulty
4. **Use text SPARINGLY** — key stats, names/dates, dramatic emphasis only

Per-phase rules:
- **Image phases:** the image IS the visual. Overlay text is a short label,
  name, or date — max 2 lines — never a transcript of the narration.
- **Text-only phases:** reserved for maximum dramatic moments where the
  WORDS are the visual ("She gave the order." / "Dead."). Rare — 2-3 per
  scene maximum.
- **The mute test:** if you mute the audio, does the image alone tell you
  something? If the screen just shows text that means nothing without audio,
  it FAILS.
- On a SHORT (~5s) narration-led beat, prefer NO text over a fleeting label
  that restates the narration — the image and voice carry it (LEARNINGS §46f
  corollary).
- At ontology level, `visual_depiction` describes what the viewer SEES;
  text overlays go in a minimal separate `text_elements` field.

### 11.5 Portrait photos must show the full face (§27)

Default `objectFit: cover` + `objectPosition: center` often crops real
photos of people at the nose or neck — worse than no image. Before using any
portrait photo, READ/VIEW the image, then set `objectPosition`:

- Face in upper third → `objectPosition: '50% 20%'`
- Face centered → `'50% 35%'` (slight top bias to show the full head)
- Face in lower half → `'50% 50%'`
- Full-body shot → `'50% 15%'` (keep head and torso)

Test mentally: in the target crop, is the full face visible forehead to
chin? Keep a lookup of verified values per image and reuse them.

### 11.6 Low-resolution images — upscale before use (§29)

Wikipedia/Wikimedia photos are often 400-800px wide and look pixelated in a
1920×1080 frame. Minimums: full-bleed 1920×1080; half-frame panels 960×1080.
Check every downloaded image (`ffprobe -v quiet -show_entries
stream=width,height -of csv=p=0 image.jpg`); if under minimum, upscale with
lanczos:

```bash
ffmpeg -y -i input.jpg -vf "scale=1920:-1:flags=lanczos" -q:v 2 output.jpg
```

If the required upscale exceeds 3x, skip the image and use a generated
alternative — 3x+ upscaling produces visible artifacts.

### 11.7 Aspect ratio must match the panel — never distort (§30)

`objectFit: cover` on a mismatched ratio chops heads, halves ships, crops
map borders. The image's native ratio must be compatible with its panel
(full-bleed 16:9 ← 16:9 or 3:2; ~9:10 split panels ← 1:1, 4:5, 3:4). When
ratios don't match: prefer `objectFit: contain` with a matching background
color; or `cover` with a carefully set `objectPosition`; or last resort, pad:

```bash
# Pad a 4:3 image to 16:9 with black bars
ffmpeg -y -i input.jpg -vf "pad=ih*16/9:ih:(ow-iw)/2:0:black" output.jpg
```

See also SKILL.md → "Image Aspect Ratios for Split Layouts" for generating
at the right ratio in the first place.

### 11.8 Real imagery swaps (§17)

Replace AI-generated PNGs with processed real photos at the SAME filename —
no TSX changes needed. Processing for editorial consistency (crop square,
desaturate, film grain):

```bash
ffmpeg -i input.jpg \
  -vf "crop=ih:ih:(iw-ih)/2:0,scale=1080:1080,eq=contrast=1.3:saturation=0.12,noise=alls=10:allf=t" \
  output.png
```

Real images ALWAYS take priority over AI-generated when they match the
subject (see pre-production.md — real-image mapping at ontology level, §24).

### 11.9 Image specificity — depict the NAMED subject, never generic b-roll (§56)

The strongest, most-repeated production note: **when the narration names a
specific thing at a specific moment, the image must depict THAT thing.** Not a
mood-adjacent stand-in, not generic stock-feel b-roll.

- A named country → its flag, a recognizable landmark, its leadership setting,
  or its territory on a map — not "a generic city skyline."
- "X's oil / X's fleet / X's factories" → infrastructure that reads as
  X's (X-flagged tanker, X's refinery, the plant with X's context) — not any
  refinery photo.
- A named person → the place, the hardware, the flag, or an anonymous figure
  standing in for the role (see §57 — never an AI likeness of the real person).
- A named event → imagery of THAT event, that place, that moment — not a
  generic "conflict" or "meeting" image.

Generic imagery under a specific claim is a DEFECT, flagged the same as a
show-don't-tell failure in the visual review (producer.md Step 4). The user's
verdict: *"too many generic images look like you're throwing images for the
heck of it."* A wall of pretty-but-unspecific images reads as filler and
erodes trust in the film.

**Test per phase:** could this exact image sit under a DIFFERENT sentence
about a different subject without anyone noticing? If yes, it is too generic —
find or generate the specific depiction. This is set at ontology time
(`visual_depiction` names the specific subject, not a mood — §23) and
enforced at visual review.

### 11.10 Never generate AI likenesses of real people (§57)

Do NOT generate identifiable real public figures — heads of state, named
officials, named individuals. It is an editorial and legal hazard (AI
likenesses are inaccurate, uncanny, and unlicensed) and it looks amateur.

Depict the person's ROLE instead:
- The place (the office, the podium, the capital, the ministry building).
- The hardware or the flag associated with them.
- An **anonymous** figure standing in for the role — e.g. an official shot
  from BEHIND at a lectern, a silhouette, hands signing a document, a figure
  at a distance. The viewer reads "the leader / the official" without a face.

When a real photo of the person exists and is licensed/usable, a real photo
is fine (see §11.5 face-crop rules). The ban is on GENERATING a synthetic
likeness. Also see `video-gen.md` (AI video is even less reliable for faces).

## 11b. Restraint / sensibilities (folded from the retired restraint.md)

These are sensibilities, not hard rules — creative judgment applies. They are
the taste layer that sits over every other rule in this file.

**The Only Real Rule.** Every element on screen must earn its place. If you can
remove something and the scene still works, remove it. This is the master
restraint principle — when in doubt, cut.

**White space is a feature, not wasted pixels.**
- Let elements breathe. If the frame feels full, it probably is.
- The focal element needs clear space around it to draw the eye.
- An empty frame with one powerful object beats a crowded frame with five
  competing objects.
- Negative space creates rhythm — the visual equivalent of a musical rest.
  Use white space to pace the eye, not just to fill layout gaps.

(The palette, typography, motion, pacing, and sound sensibilities that used to
also live in restraint.md are canonical elsewhere: palette + type in §2, §3,
§10 above; motion + stagger + ambient life in `motion-doctrine.md`; phase pacing
in `SKILL.md` → "Phase Pacing"; sound in `sound-design.md`.)

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
- [ ] Headlines use `FONTS.heading` (brand display type), all text at/above the typography.md floors
- [ ] Text inhabits the scene (stenciled, etched, grounded) — not floating UI labels
- [ ] Key entities (countries, products, concepts) have strong screen presence
- [ ] Country maps use official outlines
- [ ] Color palette matches project/brand requirements
- [ ] At least one phase per scene uses a non-default background color
- [ ] Hold phases have subtle scale drift (1 to 1.03) to avoid static feel
- [ ] Smallest text element is still readable at arm's length on a phone
- [ ] (Optional) Film grain overlay applied for cinematic texture
