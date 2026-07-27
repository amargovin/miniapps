# Creative Direction — Thinking Before Drawing

Read this before writing any scene. This is not a decision tree —
it's a set of questions that force you to think about *what* to
show before thinking about *how* to animate it.

## The Problem This Solves

Without creative direction, scene code starts with "what animation
technique looks cool?" That's backwards. The voiceover text tells
a story. Your job is to find the visual story hiding inside it,
then build that.

## Step 0: Read the Ontology

Before any creative thinking, read the scene's entry in
`ontology.yml`. Note:

- **composition_template** — your spatial layout
- **weight_class** — the scene's creative role (hero, supporting, connective)
- **palette_emphasis** — which 2-3 colors should dominate

The composition template guides your spatial thinking. The weight
class tells you how much visual attention this scene deserves.
The palette emphasis keeps you coherent with the rest of the video.

## Step 1: Read in Context

Never read a scene's text in isolation. Always ask:

- **Where are we in the story?** Opening hook? Building evidence? Climax? Wind-down? The same sentence means different things at different positions.
- **What just happened?** What did the viewer just see? Your scene must feel like the next chapter, not a random jump.
- **What comes next?** Your scene should set up what follows. If the next scene is a dramatic reveal, this one should build tension. If the next scene is reflective, this one might be the peak.

## Step 2: Find the Core Idea

Every scene communicates ONE thing. Maybe the text has three sentences — but there's one underlying idea. Find it.

Ask: **"If I had to explain what this scene is about in five words, what would I say?"**

Examples from real scenes:
- "India's EV optimism hides dependency" → surface vs. reality
- "China controls the battery supply chain" → power asymmetry
- "The PLI scheme failed" → broken promise

The core idea determines everything. A scene about "surface vs. reality" needs a visual that peels back layers. A scene about "power asymmetry" needs a visual that makes one side dominant. A scene about "broken promise" needs something that starts hopeful and collapses.

**Forcing function:** Once you have the core idea, immediately ask: *"What's the most powerful way to SHOW this information?"* Consider in order: Can key words/numbers carry it (kinetic typography)? Can data show it (chart/viz)? Can a real photo show it (duotone collage)? Only if none of those work, find a simple physical metaphor — but keep it flat and iconic, not detailed.

## Step 2b: Choose Your Visual Approach

Before jumping to a specific metaphor, ask: **"How would
someone encounter this information in the real world?"**

This question unlocks variety. A scene about sanctions is
*news* — you encounter it through headlines. A scene about
patent counts is *research* — you encounter it through
documents and filings. A scene about a policy failure is
*bureaucracy* — you encounter it through government reports
and audit findings. The approach should match the content's
natural medium, not default to "show one illustrated object."

**The Remotion visual vocabulary** — ordered by what
produces the most professional results:

- **Kinetic typography** — words as architecture. Stacked
  word builds, highlighted phrases within sentences,
  big number slams, pull quote zooms, word-as-spatial-
  composition. The viewer hears the narrator and sees
  the key phrases land with visual emphasis. This is
  the single most effective approach — Vox uses it in
  nearly every video. Best for: arguments, claims,
  emotional peaks, any scene with a strong verbal hook.
  See `kinetic-typography.md`.
- **Data visualization** — animated bar/line charts,
  donut charts with spring fills, conic sweep gauges,
  percentage circles, comparative side-by-side numbers.
  The Economist's primary technique. Best for: market
  share, trends, proportional data, any scene with
  numbers. See `charts.md`, `conic-sweep.md`.
- **Photo collage / duotone** — real photography
  treated with CSS filters (grayscale + contrast +
  mix-blend-mode) for editorial look. Ken Burns slow
  zoom on stills. Masked imagery via clip-path. Color
  wash overlays. Looks 10x more professional than
  code-generated SVG illustrations. Best for: real-world
  subjects (people, places, products, events).
  See `duotone-photo.md`.
- **Generated backdrop** — AI-generated atmospheric
  images (via ImageGen skill, instant mode) used as
  phase backgrounds with CSS editorial treatment.
  Three treatments: full duotone (Economist look),
  defocused atmosphere (blurred painterly bg with sharp
  text), masked reveal (image through clip-path shape).
  Generate up to 5 images in parallel. CRITICAL: not
  every phase gets an image — alternate with clean
  typography phases for visual breathing. Best for:
  hero scenes, establishing shots, emotional beats,
  any phase that benefits from environmental atmosphere.
  See `generated-backdrop.md`.
- **Annotated overlay** — image or diagram with animated
  callout annotations: arrows, circles, labels appearing
  sequentially. Vox's signature explainer technique.
  Best for: explaining parts of a system, highlighting
  details, "let me show you what I mean" moments.
  See `annotated-overlay.md`.
- **Editorial cards** — headline montages, news clippings,
  quote cards, ticker-style reveals. Best for: news events,
  policy announcements, public statements.
- **Map-based** — country outlines, supply routes,
  geographic comparisons, trade flows. Best for:
  geopolitics, trade, regional comparisons.
- **Diagrammatic** — flow charts, stacked layers, split
  comparisons, timelines, connected nodes. Best for:
  processes, comparisons, hierarchies, cause-and-effect.
- **Progressive construction** — elements that draw/build
  themselves on screen: SVG paths tracing routes, diagram
  edges connecting nodes, borders framing content. Best
  for: connections, routes, systems being assembled.
- **Depth & atmosphere** — layered parallax with
  depth-of-field blur, focus pulls, grayscale-to-color
  mood transitions. Best for: establishing shots,
  emotional shifts, cinematic openings.
- **Flat simplified SVG** — simple silhouettes, icon-scale
  objects, geometric shapes with 2-3 flat colors. USE
  SPARINGLY — only when no photo exists and the concept
  can't be shown through typography or data viz. Never
  attempt detailed multi-path illustrations (buildings
  with windows, vehicles with panels) — they look
  amateur when code-generated. Best for: abstract
  concepts that need a simple visual anchor.
- **Layered blending** — elements that visually interact
  via blend modes: text that merges into backgrounds,
  spotlight effects, color wash overlays. Best for: text
  over photo/illustrated scenes, emphasis, mood/tone.
- **Shape reveals** — content revealed through animated
  clip-path shapes: diagonal wipes, diamond reveals, torn
  edges, inset rectangles growing from nothing. Best for:
  transitions, before/after reveals, dramatic unveils.

STOP: You MUST consider at least 3 approaches from this
list before committing to one. If your first instinct is
flat simplified SVG (drawing an object), force yourself
to evaluate kinetic typography, data visualization, and
photo collage first. Illustration is the approach of
last resort — use it only when the other approaches
genuinely cannot serve the content.

**Variety awareness:** Check what your neighboring scenes
are doing. If three consecutive scenes all use the same
approach, at least one should change. Variety in approach
is what keeps a video visually interesting.

**Approach diversity target:** Across a full video, aim
for at least 4 different approaches. A 10-scene video
using only typographic impact and editorial cards is
monotonous. Mix in illustrated scenes, progressive
construction, depth shots, and data visualization.

## Step 2c: Choose Your Rendering Technique

Once you have an approach, ask: **"What CSS/SVG capability
will bring this to life?"**

This is where you pick from the cinematic cookbook. The
approach tells you WHAT to show. The technique tells you
HOW to animate it. Match them:

| Approach | Primary Techniques | Cookbook Patterns |
|----------|-------------------|------------------|
| Kinetic typography | Spring-driven text, counters, stagger | `kinetic-typography`, `speed-remap`, `font-morphing` |
| Data visualization | conic-gradient, interpolated values, SVG | `conic-sweep`, `charts` |
| Photo collage / duotone | CSS filters, mix-blend-mode, clip-path | `duotone-photo`, `clip-path-reveal`, `depth-blur` |
| Generated backdrop | CSS filters, ImageGen, mix-blend-mode | `generated-backdrop`, `depth-blur`, `blend-layers` |
| Annotated overlay | Positioned SVG over image, stagger | `annotated-overlay`, `svg-path-draw` |
| Editorial cards | CSS 3D transforms, stagger timing | `card-flip-3d`, `speed-remap` |
| Map-based | SVG path draw, country outlines | `svg-path-draw`, `parallax-layers` |
| Diagrammatic | SVG path draw, stagger, flow | `svg-path-draw`, `split-screen` |
| Progressive construction | stroke-dasharray animation | `svg-path-draw` |
| Depth & atmosphere | CSS filters, 3D transforms | `depth-blur`, `parallax-layers`, `particle-systems` |
| Flat simplified SVG | Simple shapes, spring entrances | `spring-physics`, `speed-remap` |
| Layered blending | mix-blend-mode, gradient overlays | `blend-layers` |
| Shape reveals | clip-path polygon/inset animation | `clip-path-reveal`, `arc-wipe`, `dither-dissolve` |

**Combination power:** The best scenes combine an approach
with 1-2 techniques. Examples:

- Kinetic typography + `speed-remap` + `clip-path-reveal` =
  key phrase slams in, then diagonal wipe reveals the stat
- Data viz + `conic-sweep` + `depth-blur` = pie chart in
  sharp foreground, context label blurred behind it
- Photo collage + `duotone-photo` + `parallax-layers` =
  duotoned photo with slow parallax drift, text overlay
- Annotated overlay + `svg-path-draw` + `speed-remap` =
  arrows draw themselves onto an image, slam-stop on label
- Map-based + `svg-path-draw` + `depth-blur` = trade route
  drawing itself on a map with blurred geographic background
- Editorial cards + `card-flip-3d` + `speed-remap` =
  headline montage with slam-stop on the key card
- Kinetic typography + `font-morphing` + `blend-layers` =
  word morphs into contrasting word, blended into scene
- Generated backdrop + `depth-blur` + `kinetic-typography` =
  AI image blurs into atmosphere, sharp stat slams in foreground
- Generated backdrop + `clip-path-reveal` + `speed-remap` =
  diagonal wipe reveals atmospheric image, text slam-stops on top

**The full rendering toolkit:**

| Capability | What It Does | Pattern Doc |
|------------|-------------|-------------|
| Spring physics | Natural overshoot motion | `spring-physics` |
| SVG path draw | Lines draw themselves | `svg-path-draw` |
| CSS clip-path | Shape-based reveals/morphs | `clip-path-reveal` |
| CSS filters | Blur, grayscale, glow | `depth-blur` |
| CSS 3D transforms | Perspective, depth layers | `parallax-layers`, `card-flip-3d` |
| mix-blend-mode | Visual layer interaction | `blend-layers` |
| conic-gradient | Pie/radar/clock fills | `conic-sweep` |
| stroke-dasharray | Progressive line reveal | `svg-path-draw` |
| CSS transforms | Position, scale, rotate | (fundamental — all patterns) |
| Stagger timing | Sequential element entrance | (fundamental — all patterns) |
| Interpolated values | Counters, gauges, fills | (fundamental — `interpolate()`) |

If a scene uses none of these capabilities — just static text
with opacity — consider reaching for the toolkit. Most scenes
benefit from at least one rendering technique beyond basic
fade-in.

## Step 3: Find the Visual Metaphor

This is the creative leap. You're translating a verbal idea into something spatial and visual.

Ask: **"If the viewer opened their eyes right now, what single image would make them understand?"**

Don't default to complex SVG illustrations. Think in information, emphasis, and contrast first. When a physical metaphor is needed, keep it flat and simple:

- **Dependency** → a supply line that can be cut, a plug that can be pulled
- **Growth** → something filling up, expanding, multiplying
- **Failure** → something draining, cracking, going dark
- **Comparison** → two versions of the same thing, side by side, one thriving and one empty
- **Hidden truth** → a surface that peels away, a zoom that reveals what's underneath
- **Momentum** → objects flowing, accelerating, accumulating
- **Barrier** → a wall, a gate, a customs checkpoint, a bottleneck
- **Monopoly / control** → a single hand on a valve, one key for many locks, a puppet master's strings
- **Vulnerability** → a single thin cable holding a heavy load, a cracked dam, a house of cards
- **Missed opportunity** → a door closing, a train leaving the platform, a window bricking over
- **Scale mismatch** → a tiny bucket under a waterfall, an ant carrying a boulder, a rowboat next to a cargo ship
- **Systemic risk** → dominoes lined up, interconnected pipes where one leak floods everything
- **Political promise** → a ribbon-cutting on an empty building, a blueprint gathering dust, a foundation with no walls
- **Technological gap** → a modern factory next to a hand-crank workshop, a rocket next to a bicycle
- **Acceleration** → a conveyor belt speeding up, wheels spinning faster, a countdown clock
- **Stagnation** → a factory with cobwebs, still water, a clock with frozen hands
- **Transfer of power** → a baton pass, a crown changing heads, keys handed over
- **Warning ignored** → a flashing red light in a dark room, a cracking bridge with traffic still flowing
- **Accumulation** → liquid filling a vessel, objects piling up, layers building
- **Erosion** → sand through fingers, a melting structure, paint peeling off
- **Isolation** → a single lit building in darkness, an island, a cut wire

The metaphor should be *specific*, not abstract. Not "India struggles" but "India's battery factory sits empty while China's chimneys smoke." Specificity is what makes motion graphics watchable.

**Template fit check:** The metaphor MUST be expressible within
the assigned composition template. If you have `centered-hero`,
the metaphor needs a single focal object. If you have
`split-compare`, the metaphor needs two contrasting elements.
If you have `focal-offset`, the metaphor needs asymmetric
emphasis. If you have `grid`, the metaphor needs peer items.
If the metaphor doesn't fit, simplify the metaphor — do NOT
change the template.

**Hero template blending:** For hero scenes only, the ontology
may assign `composition_template: [primary, secondary]`. The
primary template defines the overall structure; the secondary
contributes one element or zone. Example: `[focal-offset,
lower-third]` — hero element at 1/3 offset with a text bar
anchored to the bottom.

### Depicting the Metaphor: From Concept to Scene

Once you have your metaphor, turn it into a concrete visual scene in six steps:

1. **Choose a physical setting.** Where does this metaphor live? A factory floor, a shipping port, a laboratory bench, a desert landscape. The setting provides context and grounding.

2. **Identify the key object as focal point.** What single object embodies the metaphor? A battery draining, a valve being shut, a bridge cracking. This object is the visual center of gravity — everything else orbits it.

3. **Add environmental context.** What surrounds the key object? Walls, pipes, other machines, sky, ground. The environment tells the viewer *where* they are and makes the object feel real.

4. **Animate the metaphor's verb.** Every metaphor has an action — draining, filling, cracking, flowing, shutting, accelerating. This action is your primary animation. It should be the most visually prominent motion in the scene.

5. **Use depth and scale.** Place elements at different depths (foreground, midground, background). Use scale to show importance — the key object should be the largest element. Smaller objects provide context without competing.

6. **Compose tight.** All elements should cluster around the key object, connected and spatially related. A factory with its chimney, smoke, supply pipes, and loading dock — these form one composed group. Never scatter elements to separate regions of the frame. If you can draw a bounding box around your visual group that covers less than 60% of the frame, you're composed well.

### Anti-Patterns: What Metaphors Are NOT

A metaphor is a physical scene that embodies an idea. It is NOT:

- **A chart with a label.** "77% dependency" is not a metaphor. A battery with only 23% charge remaining while a hand reaches for the charger — that's a metaphor.
- **A panel layout.** Two colored rectangles side by side is not a comparison metaphor. Two factories — one lit with smoke and activity, one dark and crumbling — that's a metaphor.
- **A progress bar.** A bar filling from left to right is a UI widget. Liquid rising in a vessel, a building being constructed floor by floor, a pipeline filling with flow — those are metaphors.
- **A badge or label.** Putting "CHINA" in a red pill badge is UI design. Painting "MADE IN CHINA" stenciled on a shipping container — that's environmental storytelling.
- **Scattered elements with captions.** Four facts placed in four corners of the screen is a web page. Four objects on a shelf, or four stages in a pipeline — that's a scene.

## Step 4: Plan the Phases

A "phase" is a complete visual frame-set — a distinct composition
that fully replaces the previous one via `<Series>`. Every 4-5
seconds the viewer sees a new visual.

Ask: **"What's the visual narrative arc within this scene?"**

How many phases? As many as the content needs. A rough guide:
~4-5 seconds per visual beat feels natural. A 20-second scene
might have 4 phases, an 8-second scene might have 1-2.

**MANDATORY: Phase durations must be derived from Whisper timestamps, not set
uniformly.** Run Whisper on the scene audio, map each sentence to a phase, and
calculate `durationInFrames = round((end_time - start_time) * fps)`. Uniform
phase durations cause visual-audio drift. See "Audio-Sync Phase Timing" in
`SKILL.md` for the full process.

Structure phases like a story — each one advances the argument:

Example from Scene04 (27s, 5 phases, "India's EV ambitions hide
battery dependency"):
- Phase 1 (0-5s): Headline card — "Tata announces EV revolution" — the optimistic surface
- Phase 2 (5-11s): EV silhouette with battery cell grid glowing — the object of ambition
- Phase 3 (11-17s): Battery cells draining one by one — the hidden vulnerability
- Phase 4 (17-22s): India map (dark factory) vs China map (smoking chimneys) — the structural gap
- Phase 5 (22-27s): Supply line from China with red X through it — the blocked dependency

Each phase is a complete visual. Phase 1 disappears entirely
before Phase 2 appears. Each gets its own composition and
focal element.

## Step 4b: Phase Transitions

Use `<TransitionSeries>` (not plain `<Series>`) for multi-phase
scenes. This enables smooth transitions between phases instead
of hard cuts.

**Default:** Use `<TransitionSeries>` with transitions between
phases. Hard cuts (plain `<Series>`) are reserved for rapid-fire
montage or intentional shock edits.

**Transition selection by phase boundary type:**

| Boundary | Transition | Duration | Why |
|---|---|---|---|
| Clean → Clean | `wipe({ direction: "from-left" })` | 15-20 frames | Clean handoff, editorial feel |
| Clean → Image backdrop | Fade-through-dark (custom) | 20-25 frames | Dark dip signals world shift |
| Image → Clean | `fade()` | 15-20 frames | Image dissolves, clean phase emerges |
| Image → Image | `wipe({ direction: "from-left" })` | 18-22 frames | Hard visual boundary between two image worlds |
| Any → Color wash close | `fade()` | 12-15 frames | Brief fade into bold statement |

**Fade-through-dark** is the signature transition for entering
a backdrop phase. The current phase dims to near-black, then
the image phase fades in from dark. This prevents the jarring
pop of a photograph suddenly appearing. See `transitions.md`
for the `fadeThroughDark` custom presentation code.

**Implementation:**

```tsx
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";

// In your scene's main export:
<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={300}>
    <PhaseCleanTypography />
  </TransitionSeries.Sequence>

  <TransitionSeries.Transition
    presentation={fadeThroughDark()}
    timing={linearTiming({ durationInFrames: 22 })}
  />

  <TransitionSeries.Sequence durationInFrames={340}>
    <PhaseDuotoneBackdrop />
  </TransitionSeries.Sequence>

  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: 18 })}
  />

  <TransitionSeries.Sequence durationInFrames={340}>
    <PhaseCleanStat />
  </TransitionSeries.Sequence>
</TransitionSeries>
```

**Phase isolation rules (unchanged):**
- Each phase fully replaces the previous in content.
- A persistent static background can span all phases.
- Animated foreground content gets its own phase.
- One idea per phase. A stat and a quote are two ideas — give
  them separate phases.

See `sequencing.md` for `<Series>` patterns and `transitions.md`
for `<TransitionSeries>` API reference.

## Step 4c: Intensity Layering

You have your phases. Now run each one through this checklist.
The goal is to prevent every phase from feeling identical in
production weight. A video where every phase uses the same
background, the same entrance, and the same text treatment is
a slideshow — even if each phase has different content.

Go through each phase and ask the six questions below. You do
not need to say yes to all six — but you should be intentional
about each one.

**1. Background color** — Does this phase use the default cream/white
   background, or should it shift to dark or a strong palette color
   for impact? At least one phase per scene should break from the
   default background. A dark phase inside a mostly-light scene
   creates contrast and signals importance.

**2. Camera drift** — Choose a drift treatment per phase: zoom in
   (`scale 1→1.03`), zoom out (`scale 1.03→1`), Ken Burns on
   image only (backdrop phases), or NO drift (stillness for
   authority). VARY between phases — uniform drift on every
   phase is as monotonous as no drift at all. See
   `editorial-design.md` Section 12 for the full menu.

**3. Phase transition** — How does this phase ENTER? Decide
   intentionally:
   - **Cut** (default) — fine for most phases, especially fast edits
   - **Clip-path wipe** — diagonal, horizontal, or radial reveal;
     use for scene entrances and dramatic phase shifts.
     See `clip-path-reveal.md`.
   - **Color wash flash** — a brief full-color frame precedes the
     content; use to signal a tonal shift or to punch into a
     high-energy phase.

**4. Stat presentation** — If this phase contains a number or
   metric, choose how it enters:
   - **Simple count-up** (default) — fine for supporting stats
   - **Digit-roll counter** — for hero stats where the number
     is the story. See `animated-counters.md`.
   - **Progress bar alongside** — for comparative or proportional
     stats where the magnitude matters. See `animated-counters.md`.

**5. Depth** — Can this phase benefit from a layered composition?
   - **Parallax layers** — foreground text and background element
     drift at different speeds, creating perceived depth.
     See `parallax-layers.md`.
   - **Film grain overlay** — optional production polish; adds
     texture and analog warmth. Use sparingly.

**6. Speed ramp** — Does the key moment in this phase deserve a
   speed-remap slam? A sudden ease-in / ease-out snap on the
   critical beat makes it memorable. Reserve this for 1-2 moments
   per video maximum — overuse kills the effect. See `speed-remap`
   in the cinematic cookbook.

**Intensity Layering output:** After running this checklist, note
which phases got which treatments. If every phase has the same
answers (same bg, cut entrance, no depth), revise at least two
phases before writing code.

## Step 5: Feel the Weight

Not every scene is a showstopper. The video has a rhythm.

**Hero**: The moments the viewer remembers. Go all out —
detailed illustrations, multi-element choreography, cinematic
patterns. These are the peaks.

**Supporting**: Professional, clean, clear. Carries the
narrative without stealing the show.

**Connective**: Breathing room. Simple, quiet. Lets the
viewer's eyes rest.

Ask: **"Is this THE moment of the video, or does it serve THE moment?"**

If you're not sure, it's supporting.

## Step 6: Check Against Neighbors

Before writing code, mentally line up your scene with its neighbors:

- **Visual variety**: Does this scene look different from the one before it? Two headline montages in a row is boring. A chart after a chart is numbing.
- **Pacing**: Does the rhythm breathe? A hero scene should be followed by something quieter, not another hero.
- **Color shift**: If every scene uses the same dominant color, the video feels monotone. Vary which palette colors dominate.
- **Element type**: If the previous scene was text-heavy, make this one image-heavy. If the previous was abstract, make this one concrete.

## The Creative Brief

After working through these questions, write a brief before any code:

```
CORE IDEA: [5 words]
APPROACH: [which visual approach from Step 2b]
TECHNIQUE: [which rendering techniques from Step 2c]
METAPHOR: [the visual concept]
METAPHOR SCENE:
  Setting: [physical environment — factory floor, port, etc.]
  Key Object: [the single object that embodies the metaphor]
  Key Action: [the verb — draining, filling, cracking, etc.]
  Supporting Elements: [environmental objects for context]
WEIGHT: hero | supporting | connective

PHASES:
1. Setup: [what happens]
2. Development: [what happens]
3. Landing: [what happens]

PALETTE EMPHASIS: [which 2-3 colors dominate]
PREVIOUS SCENE: [what it showed] → CONTRAST: [how this
  differs in approach, technique, and palette]

REJECTED ALTERNATIVES:
  - [approach 1]: [why it doesn't fit as well]
  - [approach 2]: [why it doesn't fit as well]
```

The `REJECTED ALTERNATIVES` section forces you to prove
you considered multiple approaches. If you can't name two
alternatives you rejected, you haven't explored enough.

This brief is your creative contract. Write the code to
execute this brief, not the other way around.

## Common Creative Traps

**"Detailed SVG illustration" as default.** If your first
instinct is to draw a factory/ship/machine in SVG, STOP.
Code-generated SVG illustrations with windows, chimneys,
smoke, gears, etc. look amateur. Instead:
1. Can kinetic typography carry this scene? (usually yes)
2. Can a data viz or chart show it? (if numbers exist)
3. Can a duotoned photo show it? (if the subject is real)
4. Only then consider a FLAT, SIMPLIFIED icon/silhouette.

**"Chart because there's a number."** A number doesn't automatically need a chart. A single number is best as kinetic typography — big, bold, center frame. Charts are for trends and multi-variable comparisons, not single facts.

**"Everything enters from the left."** Vary your spatial choreography. Things can grow from center, fall from top, materialize in place, assemble from parts, reveal by unmasking.

**"Same visual density throughout."** Some moments need visual silence — a single object on a clean background. Others need complexity. Match density to narrative intensity.

**"Cool technique in search of a scene."** Never pick a cinematic technique first and then figure out how to apply it. Start with the core idea. The right technique will be obvious once you know what you're trying to show.

**"Dashboard layout because there are multiple items."** Having four data points doesn't mean you need a four-panel grid. Put four objects on a shelf, four stages in a pipeline, four floors in a building. Multiple items belong in a single composed environment, not separate UI containers.

**"Colored rectangles as containers."** A blue panel for "China" and a green panel for "India" is a web UI mockup. Instead: big bold "CHINA" and "INDIA" as kinetic typography with contrasting numbers below each, or a split-screen with duotoned photos, or an animated bar chart comparing the two.

**"Scattered placement — elements in separate corners."** Elements distributed to different quadrants with empty space between them is a web page layout, not a cinematic frame. Compose elements as a group around a focal point. Every element should be spatially connected to its neighbors — stacked, overlapping, linked by flows, or nested within a shared environment.

**"Text with opacity fade as the universal scene."** If
every scene is serif text spring-entering on a plain
background, the video is a slideshow. Kinetic typography
is NOT just "text fading in" — it's words with spatial
arrangement, emphasis animation (underlines, highlights,
scale changes), staggered builds, and counter animations.
Make text MOVE, not just appear. And mix in data viz,
photo collage, and other approaches — at least 4
different approaches across a full video.

**"Ignoring the rendering toolkit."** Every scene should
use at least one technique from Step 2c beyond basic
`interpolate(frame, ..., [0, 1])` opacity. SVG path draw,
clip-path reveals, depth blur, parallax, blend modes,
conic sweeps — these are what separate motion graphics
from a text slideshow. If you planned moves but haven't
chosen a rendering technique, go back to Step 2c.

**"Every phase looks the same."** If all phases in a scene
use the cream background, centered text, and a spring
entrance, the scene is a slideshow regardless of content.
Vary at least one of the following between phases:
background color, text position, entrance style, or
dominant scale. Use the Intensity Layering checklist
(Step 4c) to force this intentionality before writing code.

---

## Remox Visual Standards

### Visual Variety — No Consecutive Repetition
Never use the same background type for 3+ consecutive phases.
Alternate cream / navy / image / video backgrounds across phases.

Beyond background color: never run 3+ consecutive phases that are all
text-on-solid-background, even if the colors differ. At least every
third phase must introduce an image or video asset. Text-only phases
serve pacing — they are not the default.

### Editing for Momentum — cut the meta/roadmap scene (§67)

Cutting a scene for pace is a valid editorial move, not a failure. The most
cuttable scene is usually the **meta/roadmap scene** — one that talks ABOUT
the video ("in this video we'll look at...", "there are three things to
understand here") rather than delivering content. It stalls momentum; the film
is almost always stronger without it, straight into the substance.

When you cut a scene, **keep it on the shelf — do not delete it.** Move the
TSX/brief/assets aside (e.g. a `_shelf/` folder, or comment it out of the
scene manifest) so it can be restored in one step if the cut proves wrong.
Renumber cautiously or keep IDs stable to avoid churn across the pipeline.

### Backdrop Treatment — Follow the Ontology
The scene ontology specifies `phases_with_image`, `treatment`
(duotone / defocused / masked), and `prompt_style`. Respect these.
Not every phase gets an image — the ontology already planned which
phases breathe clean. Alternate atmospheric image phases with clean
typography phases.

Three standard backdrop treatments:
- **Duotone** — grayscale + contrast + mix-blend-mode for Economist look
- **Defocused** — blurred painterly background, sharp text foreground
- **Masked reveal** — image through clip-path shape

### Image Aspect Ratios
Match the image to the spatial panel it will fill:
- Full-bleed background: 16:9
- Split panel (~50-55% width, focal-offset or split-compare): 1:1
- Narrow panel (~40% width): 4:5

Generating the wrong ratio forces objectFit to crop unpredictably
and can decapitate faces or key objects.

### Style Invariants — Editorial-Clean
These are non-negotiable across all scenes:
1. `PALETTE.bg` (#F5F3EE cream) is the default background — use it unless you have an explicit reason to break
2. Navy (`PALETTE.primary`) backgrounds are reserved for dramatic / high-contrast phases only
3. Serif headlines (`FONTS.heading`), sans-serif body (`FONTS.body`) — never swap these
4. Animate the information, not decoration — counters, charts, text slams, path draws
5. Text inhabits the scene (stenciled, etched, typeset) — it does not sit in UI containers
6. No UI patterns: no dashboards, no progress bars, no card grids, no modal-style frames
7. Compose tight around a focal point — elements cluster, they don't scatter to corners

### Camera Drift — Vary Per Phase
Assign one drift treatment to each phase and vary them:
- Zoom-in: `scale 1.0 → 1.03` over the phase duration
- Zoom-out: `scale 1.03 → 1.0` over the phase duration
- Ken Burns: use only on image backdrop phases — slow diagonal drift
- Stillness: no drift; use for authority, data reveals, or quiet beats

Never apply uniform drift to every phase. Identical motion on every
phase is as monotonous as no motion at all. If you find yourself
writing the same scale interpolation for five consecutive phases,
stop and redesign the drift plan.
