# Production Learnings — Rule Index & Incident Log

**This file is an INDEX.** Every rule keeps its stable § number (scene code
and guidance files cite them), but the canonical rule text lives in the file
each entry points to. Read the pointed-to file before doing work the rule
governs.

Role-scoped mandatory-read lists: SKILL.md → "Mandatory Reads (role-scoped)".
(Numbering notes: §5 was accidentally used twice in the original log — both
entries are kept below; there is no §28.)

---

## 1. Text Size for Vertical (9:16)
Portrait is consumed on phones — body/labels/mono need 44px minimum, hero 80px+ (36px labels failed two feedback rounds).
Canonical: `skills/guidance/typography.md` → "Portrait floors (1080×1920)"

## 2. Backdrop Image Treatment
Light touch only — `blur(4px) contrast(1.1) brightness(0.95)`; no grayscale, no full-screen dark overlays (user: "grey something in the background").
Canonical: `skills/guidance/editorial-design.md` → §11.1

## 3. Text Readability Over Images
No static frosted panels — use the AnimatedTextBox pattern (border draws on, dark fill fades in, text reveals), sized to the text.
Canonical: `skills/guidance/editorial-design.md` → §11.2

## 4. AnimatedTextBox — Text Color Rule
Text inside the dark translucent box MUST be white/light; dark palette colors are invisible on it.
Canonical: `skills/guidance/editorial-design.md` → §11.3

## 5. Text Effects and Animation Variety
Never the same entrance for every element — vary spring config, direction, timing; every phase needs entrance/ambient/exit.
Canonical: `skills/guidance/motion-doctrine.md` (three acts, staggered entrances)

## 5. Phase Transitions (duplicate number in original log)
No hard cuts between phases — cross-fade with the standard overlap; outgoing phases need exit choreography.
Canonical: `skills/guidance/transitions.md` → "Never Hard-Cut Between Phases"

## 6. Fonts
Always check the brand guide before setting fonts in theme.ts (Georgia/Inter were wrong for Swarajya — caught in user review); Archivo display + Helvetica body validated.
Canonical: `skills/guidance/typography.md` → "BRAND OVERRIDE" + "Font Families by Role"

## 7. Logo
Corner logo burns in via RemoxScene.tsx (229px, top 90 / right 78, 0.85); dedicated endcard scenes skip it via scene-ID check.
Canonical: `SKILL.md` → "Logo Burn-In"

## 8. Visual Variety Across Scenes
Never 3+ consecutive scenes with the same treatment; ≥20% of runtime low/no-text; vary layouts; solid-bg sparingly.
Canonical: `skills/guidance/composition-templates.md` → Composition Doctrine #6

## 9. Safe Zones (Vertical)
Bottom 20% = subtitles, top-right = logo — plus the CSS traps (`flex-end` pushes text into the subtitle zone; "lower-third" is a misnomer).
Canonical: `skills/guidance/safe-zones.md` → "Reserved Zones & CSS Traps"

## 10. Production Pipeline Order
Read guidance → ontology → creative direction → theme → scenes → validate → visual audit → fix → render → review; never skip ontology/creative direction.
Canonical: `SKILL.md` → "Pipeline" / "How It Works" + `workflows/Produce.md`

## 11. Text-Only Pipeline
"Text only" requests skip ALL image generation — pure kinetic typography on cream with color washes.
Canonical: `SKILL.md` → "Text-Only Productions"

## 12. Post-Production Subtitle Pipeline
Render → Whisper (word-level, source audio) → gen_subs.py → ffmpeg ASS burn; BorderStyle=3 with Outline≥12; MarginV=420 for Instagram.
Canonical: `SKILL.md` → "Post-Production Subtitle Burn-In"

## 13. Subtitle Styling (9:16) — Archived Settings
SUPERSEDED by §12 (pre-March-2026 calibration: 64px, MarginV 320, gold word highlight).
Canonical: `SKILL.md` → "Post-Production Subtitle Burn-In" (current settings)

## 14. Thumbnail Generation
ImageGen (not HTML screenshots), 9:16 2K, reuse the first backdrop duotoned, bottom 15% clear.
Canonical: `SKILL.md` → "Thumbnail Generation"

## 15. AudioSync — Phase Duration Formula
`dur[i] = whisperStart[i+1] - whisperStart[i] + 18`; last phase runs to scene end; phase TEXT must also match the narration at that time.
Canonical: `SKILL.md` → "Audio-Sync Phase Timing"

## 16. Remove Callback/Recall Phases
No short post-audio flash phases — let the last content phase hold to scene end.
Canonical: `SKILL.md` → "Audio-Sync Phase Timing" (Key Points)

## 17. Real Imagery Swaps
Swap real photos in at the SAME filename (no TSX changes); process for editorial consistency (crop/desaturate/grain).
Canonical: `skills/guidance/editorial-design.md` → §11.8

## 18. Disk Cleanup — Remotion Webpack Bundles
~500MB orphaned bundle per render; clean `/var/folders/*/T/remotion-webpack-bundle-*` during long sessions.
Canonical: `skills/guidance/pipeline-traps.md` → "Disk hygiene"

## 19. Phase Count — Too Many Phases Kills the Video
`target_phases = ceil(duration_seconds / 6)`; 150f HARD minimum (merge shorter), 240f max, 150-210f sweet spot. (An earlier ÷4.5 formula produced flickering slideshows — superseded.)
Canonical: `SKILL.md` → "Phase Pacing"

## 20. Ontology Must Include LEARNINGS as Input
The ontology step reads this index alongside the guidance files — production rules override theoretical guidance.
Canonical: `skills/guidance/ontology.md` → "Mandatory Inputs"

## 21. Image Density Target at Ontology Level
Hero 70%+ / supporting 50%+ / connective 30%+ phases with images, declared per scene in the ontology.
Canonical: `skills/guidance/pre-production.md` → Step 3 (image density targets)

## 22. India Map Borders — Non-Negotiable
Any India map shows J&K + Ladakh as integral; LoC never an international boundary; generation prompts must say so explicitly.
Canonical: `skills/cinematic/illustrated-plate.md` → prompt requirements; coded SVG: `skills/guidance/editorial-design.md` → "Map Accuracy"

## 23. Ontology Must Contain Concrete Visual Direction Per Phase
Per phase: exact `narration_text`, whisper ms bounds, unambiguous `visual_depiction`, `image_source`, `image_style`, `template` — the producer never "figures out" what to show.
Canonical: `skills/guidance/pre-production.md` → Step 3 (concrete visual direction) + `skills/guidance/ontology.md`

## 24. Real Images Must Be Mapped at Ontology Level
Real photos always beat AI when they match; assign them to phases from image_manifest.md at ontology time.
Canonical: `skills/guidance/pre-production.md` → Step 3 (real-image mapping)

## 25. Visuals Must ADD to Audio, Not Repeat It
No text-karaoke — SHOW what the narrator TELLS; text sparingly (stats/names/emphasis); the mute test decides.
Canonical: `skills/guidance/editorial-design.md` → §11.4; enforced in `skills/guidance/producer.md` → Step 4

## 26. Text Must NEVER Be Right-Aligned or Top-Right Positioned
Text LEFT, image RIGHT; `flex-end` pushes text under the burned-in logo.
Canonical: `skills/guidance/composition-templates.md` → Composition Doctrine #5

## 27. Portrait Photos Must Show Full Face
View every people-photo and set `objectPosition` so the face is complete — never crop at nose or neck.
Canonical: `skills/guidance/editorial-design.md` → §11.5

## 29. Low-Resolution Internet Images — Upscale Before Use
Check resolution before use; lanczos-upscale below minimums; >3x needed = use a generated alternative.
Canonical: `skills/guidance/editorial-design.md` → §11.6

## 30. Image Aspect Ratio Must Match Panel — Never Distort
Native ratio must suit the panel; contain/objectPosition/pad — never blind `cover` crops.
Canonical: `skills/guidance/editorial-design.md` → §11.7 + `SKILL.md` → "Image Aspect Ratios for Split Layouts"

## 31. Stale Audio in Skill Template — Nuclear Bug
Same-filename audio from a previous project renders silently into the new one; sync/clean audio + remotion temp cache, transcribe-verify output.
Canonical: `skills/guidance/pipeline-traps.md` → "Stale audio in the render tree"

## 32. Series Frame Bug — useCurrentFrame() Inside Phase Components
Never pass the root `frame` into phases — Phase 3+ render invisible; each Phase calls `useCurrentFrame()` itself.
Canonical: `skills/guidance/pipeline-traps.md` → "Series frame bug"

## 33. SceneRegistry — Only .ts, Never .tsx
A stale `.tsx` registry shadows the generated `.ts` (black "Scene not found" frames); healthy output ≈ 0.8-1.0 MB/s.
Canonical: `skills/guidance/pipeline-traps.md` → "SceneRegistry"

## 34. Visual Phase Review — Mandatory Before Render
Render keypoint stills, VIEW each one, check placement / show-don't-tell / feedback-gate items, fix BEFORE rendering.
Canonical: `skills/guidance/producer.md` → Step 4

## 35. Skill Template Sync — Verify Before Every Render
SUPERSEDED by §36 for scaffolded projects; legacy projects without their own remotion/ still need the copy + MD5-verify ritual.
Canonical: `skills/guidance/pipeline-traps.md` → "Legacy projects only" (§35)

## 35a. Preproduction Cleanup — Clear Previous Project Artifacts
Mandatory cleanup script (scenes, audio, images, cache, renders, registry) before any new project's preproduction.
Canonical: `skills/guidance/pipeline-traps.md` → "Project start"

## 36. Render Tree Resolution + Version Mixing (root fix for §35)
Pipeline prefers `<projectDir>/remotion/` and loads Remotion tooling from that tree; CHECK the `Source tree:` log line; verify from output MP4 frames, not stills. (PL-15 v2 pilot: two render cycles wasted on stale template code.)
Canonical: `skills/guidance/pipeline-traps.md` → "Source-tree resolution"

## 37. Motion Doctrine Is Mandatory
Three acts per phase, easing palette, banned tropes (typewriter carets, glow, in-place crossfades, CSS transitions), payoff hierarchy, tonal-ramp backgrounds.
Canonical: `skills/guidance/motion-doctrine.md` (mandatory read for everyone)

## 38. Never Change TransitionSeries Durations When Re-Skinning
Phase count/order and every durationInFrames are Whisper-derived and FROZEN; derive exit timing from DUR, never change DUR. (Sole exception: the audio itself changed — see §42 retrofit.)
Canonical: `SKILL.md` → "Frozen durations" (Audio-Sync Phase Timing)

## 39. Finishing Pass — Unified Grade Before Concat
finish.sh per scene after render (S-curve, vignette PI/7, noise 4, sat 1.05), then concat the GRADED files.
Canonical: `SKILL.md` → "Finishing Pass & Concat"

## 40. Bundle Temp Cleanup — ENOSPC Guard
bundle() copies all public/ assets per run; a 25-render day filled the disk; scripts self-clean but purge `$TMPDIR/remotion*` when disk fills.
Canonical: `skills/guidance/pipeline-traps.md` → "Disk hygiene"

## 41. Bespoke Vector Diagrams Are an Amateur Tell — Use Illustrated Plates
Thin-vector SVG diagrams read as clip art on video (PL-15 v3, user-approved verdict); replace with 4K textless plates + cinematic camera; vector only for charts/typography accents with v3 tokens.
Canonical: `skills/cinematic/illustrated-plate.md` → "Why plates"

## 42. TTS Audio Needs a Trailing Silence Buffer
Pad every scene MP3 with ~1.1s tail silence BEFORE Whisper/pre-production (0.9s failed the H5 ≥30f rule at 27f); tail-only, never prepend. (PL-15, user-flagged: "last few microseconds of the words are cut".)
Canonical: `skills/guidance/pre-production.md` → Step 2; generation-time: `skills/guidance/voiceover.md`

## 43. Landscape Label Sizes — Skill Minimums Were Too Small
Label-class floors raised (labels/eyebrows/mono ≥34px, stat sub-labels ≥36px, captions ≥28px, lower-third names ≥56px). (PL-15, user-flagged.)
Canonical: `skills/guidance/typography.md` → "Landscape floors"

## 44. Rich Phase Composition — No "Lone Label + Image" Phases
Every image phase = composed text block OR luminous narration-led full-bleed; plain static labels equally fail; two sanctioned split exceptions. (PL-15, user: "we want rich depictions" / "it can't be this simple".)
Canonical: `skills/guidance/composition-templates.md` → Composition Doctrine #2

## 45. Sequential Production Is the Default
One scene at a time through the full pipeline with the preview gate pausing; parallel ONLY on explicit user request; pre-render feedback-gate checklist in the visual review. (User override, July 2026 — parallel let scene-one feedback compound across the whole video.)
Canonical: `skills/guidance/producer.md` → "Parallelization Strategy" + Step 4 feedback gate

## 46. Inline-Production Learnings — PL-15 (2026-07)
- **a. Inline transition timing** — shared timing consts parse as zero transitions in audit. → `pipeline-traps.md` → "Audit TSM regex"
- **b. Don't blindly --fix audiosync** — fuzzy anchors mis-map; trust the §15 formula when TSM checks out. → `pipeline-traps.md` → "AudioSync v2 fuzzy anchors"
- **c. H3 false positive** — use `top: 0, height: 1080` for image panels, not `bottom: 0`. → `pipeline-traps.md` → "H3 false positive"
- **d. Temp-project path bug (fixed at root)** — keep `"projectDir"` in every project.json. → `pipeline-traps.md` → "Pipeline temp-project path bug"
- **e. Stale stills** — only review the newest set (`ls -t`). → `pipeline-traps.md` → "Stale stills"
- **f. Rich images need hold time (user-flagged)** — carry a rich image through the adjacent phase as a continuity world; prefer no text on short beats. → `composition-templates.md` → Composition Doctrine #4
- **g. Stale-render trap** — verify output MP4 mtime is newer than the TSX. → `pipeline-traps.md` → "Stale-render trap"

## 47. World-Pinned Labels — Default for Text Over Moving Imagery
Labels naming a thing IN the image pin to it via `plateCameraState()`/`plateToScreen()`; screen-fixed text is for genuine UI only.
Canonical: `skills/cinematic/illustrated-plate.md` → "World-Pinned Labels"

## 48. Recurring Subjects Need Reference-Image Chaining
Generate later appearances of the same entity with `--reference-image` pointing at its first image; track chains at ontology time.
Canonical: `skills/cinematic/illustrated-plate.md` → plate generation step 6

## 49. Side-by-Side Splits Are Boring — Integrate, Don't Divide
Default is integrated full-bleed (designed negative space + camera move + text set INTO the image); splits only for true A-vs-B with a live divider. (User: "very boring".)
Canonical: `skills/guidance/composition-templates.md` → Composition Doctrine #1

## 50. Transitions Are a Design Layer — Kill the Black Blink, Vary the Cuts
Crossfade-concat scenes (concat_xfade.py), wrapper fade in film base colour never black; motivated per-boundary transition vocabulary within the 18f budget. (User: "transitions are rather abrupt".)
Canonical: `skills/guidance/transitions.md` → "Motivated Transition Vocabulary"; concat: `SKILL.md` → "Finishing Pass & Concat"

## 51. Text Registers Only If It ARRIVES — Land It on the Whisper Beat
Image establishes alone ~1s first; text's kinetic entrance fires on the spoken beat; MINIMUM HOLD 90f outranks beat alignment. (User: opening stat chip "just never registers at all".)
Canonical: `SKILL.md` → "Text arrival & minimum hold"

## 52. Size by ROLE, Not by Floor — Minimums Are Not Defaults
The phase's payoff element dominates the composition (heroStat 140-170px); floors are for supporting classes only. (User-flagged: 72px hero stat "read as small".)
Canonical: `skills/guidance/typography.md` → "Size by ROLE, not by floor"

## 53. Broadcast Text Cards — the TV-News Grammar for Image+Text
Default image+text treatment: BroadcastCard kicker tab + main bar at 70-80% width; ONE message per card per phase; person-intro exemplar pattern. (User doctrine: "otherwise the graphics just look like bad PPT".)
Canonical: `skills/guidance/composition-templates.md` → Composition Doctrine #3

## 54. Corner Bug — Alternating Show/Channel Brand
Red STANDPOINT chip ⇄ by-#SWARAJYA badge, 10s cadence, quiet 12f swap, 3D-lit with gloss sweep; endcard/intro scenes skip it. (User spec, July 2026.)
Canonical: `SKILL.md` → "Corner Bug"

## 55. House End Card Is the BROADCAST NEWS Closer (v2)
Navy studio field, credit straps, STANDPOINT slam, fade to black; brand furniture must read AUTHORITATIVE, not celebratory. (Confetti v1 retired as "a little amateur".)
Canonical: `SKILL.md` → "Standpoint End Card"

## 56. Image Specificity — Depict the NAMED Subject, Never Generic B-Roll
When narration names a country/company/person/event, SHOW that specific thing (flag/landmark/X-flagged infrastructure), never mood-adjacent stock filler; generic imagery under a specific claim is a defect. (User, recurring: "too many generic images look like you're throwing images for the heck of it.")
Canonical: `skills/guidance/editorial-design.md` → §11.9

## 57. No AI Likenesses of Real People
Never generate identifiable real public figures (editorial + legal hazard); depict the role via place, hardware, flag, or an ANONYMOUS figure (official shot from behind at a lectern). Real licensed photos are fine.
Canonical: `skills/guidance/editorial-design.md` → §11.10; see also `skills/guidance/video-gen.md` → "Geography and Real-World Settings"

## 58. Montage Pacing Floor — SLOW Joins, Held Underlay, No White Flashes
Each montage image holds ~3s (≥90f), floor 2.5s; joins 30-40f eased directional slides, incoming over outgoing held FULLSCREEN underneath, directions varied; FEWER images beats faster cuts; NEVER white cut-flashes between images (strobe). ~One image per sentence-clause.
Canonical: `skills/guidance/motion-doctrine.md` → "Montage & multi-image beats"; `SKILL.md` → "Phase Pacing" (image montages)

## 59. Text Contrast = SOLID Chips, Not Soft Scrims
Text over any image/busy/bright bg sits on a SOLID opaque chip (deep-navy ~0.86-0.90 + white, or solid cream + ink), chosen by the brightness rule; feathered gradient-to-transparent scrims FAIL. Verify on the actual rendered still.
Canonical: `SKILL.md` → "Text Contrast on SeamlessCanvas" → "SOLID chips, not soft scrims"

## 60. Bronze-on-Cream Fails — Use a Darker Text-Bronze (accentInk)
Brand bronze `#C4873B` is ~2.75:1 on cream (unreadable as text); define `accentInk` `#8A5E22` (~5.11:1) for bronze TEXT, keep bright bronze for DECORATIVE elements only (rules/dots/borders/bars/arrows/badges). Add `accentInk` as the palette's 7th key.
Canonical: `skills/guidance/typography.md` → "Bronze on cream fails"; palette: `skills/guidance/editorial-design.md` → §10 ("accentInk — the 7th key")

## 61. Never Open on an Empty Frame — Counters/Rings Alive from Start
Something intentional is alive by ~f10 (a <0.2-opacity texture reads as blank); counters count UP from 0 arriving ON the whisper beat, ring tracks/axes established early — never slam data in after empty seconds.
Canonical: `skills/guidance/motion-doctrine.md` → "Never open on an empty frame"; `skills/guidance/charts.md` → "Alive from f0"

## 62. Data-Viz Restraint — Cut What Doesn't Land
When a chart/gauge doesn't clearly communicate, cut it and go text-forward; remove fiddly viz (climbing gauges, stepped mini-bars), widen text boxes to fit. When you DO chart, map bar LENGTH to the differing quantity — horizontal, scaled up, generous whitespace.
Canonical: `skills/guidance/charts.md` → "Data-viz restraint"

## 63. Official-Boundary Maps Must Be VECTOR from an Authoritative Source (esp. India)
Never AI-generate boundary-bearing maps (they draw disputed/wrong borders); render a deterministic VECTOR from an official dataset (datameet/maps `india-composite.geojson`) — India = full claim (J&K incl. PoK/Gilgit-Baltistan, Ladakh, Aksai Chin, one unbroken outline, no LoC as border). Verify by reading a tight crop of the boundary from the ACTUAL frame. Extends §22.
Canonical: `skills/guidance/maps.md`; cross-ref `skills/guidance/editorial-design.md` → §9 "Map Accuracy"

## 64. Show-Brand Opener — Suppress the Corner Bug for Its Full Duration
An opener can layer over the cold open (show name hero → episode title lands → docks); SUPPRESS the corner bug/DOG for the opener's full duration (avoid double-brand), it returns after. Openers bookend the endcard; all brand furniture reads AUTHORITATIVE.
Canonical: `SKILL.md` → "Show-Brand Opener"; extends §54/§55

## 65. Phase Duration Math Must Compensate for Transition Overlap
Each Nf transition pulls the next phase's visible start Nf earlier; naive Σ(durations) drift COMPOUNDS (several seconds by scene end). Visible start = Σ(prior seq durations) − Σ(prior transition durations). Also: audiosync's fuzzy gap-anchor gives FALSE failures with no large gaps — verify against actual whisper word starts, don't trust `--fix`. Strengthens §15/§46b.
Canonical: `skills/guidance/pipeline-traps.md` → "Phase-duration math must compensate for transition overlap" + "AudioSync v2 fuzzy anchors"

## 66. Image Verification — Never Read Multi-MB Originals
Downscale to ~1600px preview first (`sips -Z 1600 -s format jpeg`), then Read; for boundary/detail checks cut a tight crop and Read that. Reading big originals risks stream-stall/crash.
Canonical: `skills/guidance/pipeline-traps.md` → "Image verification"

## 67. Editing for Momentum — Cut the Meta/Roadmap Scene, Keep It on the Shelf
Cutting for pace is valid; the meta/roadmap scene (talks ABOUT the video, not content) is usually the most cuttable. When cutting, shelve the scene (don't delete) for one-step restore.
Canonical: `skills/guidance/creative-direction.md` → "Editing for Momentum"

## 68. Provider Routing via OpenRouter (optional)
Whisper (word timestamps) and Nano Banana Pro image gen can route through a single `OPENROUTER_API_KEY` (Whisper needs an OpenAI-compatible model pinned). TTS: OpenRouter can't do the ElevenLabs voice or alignment — keep ElevenLabs native. Smoke-test before relying on it.
Canonical: `skills/guidance/providers.md`
