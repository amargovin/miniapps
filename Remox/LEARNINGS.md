# Production Learnings — Vertical Video (9:16)

Lessons from multiple rounds of iteration on a 14-scene vertical video at 1080x1920, 30fps.

---

## 1. Text Size for Vertical (9:16)

Vertical video is consumed on mobile phones. Text that looks fine at 1080p landscape is unreadable at 1080x1920 vertical.

**Minimum sizes:**
- Hero/impact text: 80px+
- Subheadings: 60px+
- Body/labels/eyebrows: 44px minimum (36px was still too small after two rounds of feedback)
- Mono/data: 44px minimum

**Rule:** If it wouldn't be readable on a phone screen held vertically, it's too small.

---

## 2. Backdrop Image Treatment

### What failed:
- `grayscale(0.7)` + `brightness(0.8)` = "grey something in the background" — user couldn't see the images at all
- `blur(16px)` = image completely unrecognizable
- Full-screen dark overlay at `opacity: 0.45` = killed the image entirely
- Even `blur(6px)` + `grayscale(0.7)` with reduced overlay still looked like grey mush

### What works:
- `blur(4px) contrast(1.1) brightness(0.95)` — gentle depth without destroying the image
- NO grayscale — keep the color, that's the whole point of having a backdrop image
- NO full-screen dark overlay — handle text readability locally, not globally

---

## 3. Text Readability Over Images

### What failed:
- Static frosted glass panel (`rgba(245,243,238,0.75)` + `backdropFilter: blur(20px)`) — too aggressive, looked like a white box pasted on top
- Dark frosted panel (`rgba(0,0,0,0.4)`) — better but still felt like a lazy overlay, sometimes too large for the text content

### What works:
- **AnimatedTextBox** component: SVG border draws itself on (~15 frames), dark fill fades in behind, text reveals after box is drawn
- This makes the background treatment feel like a deliberate design element, not a readability hack
- Black with transparency (`rgba(0,0,0,0.35)`) feels part of the image
- Box should be sized to the text area, not a fixed percentage of the screen

---

## 4. AnimatedTextBox — Text Color Rule

The AnimatedTextBox has a dark fill (`rgba(0,0,0,0.35)`) with `backdropFilter: blur(8px)`. This means:

- Text inside **MUST be white or light colored**: `#FFFFFF`, `rgba(255,255,255,0.85)`, cream
- **NEVER use dark colors** inside AnimatedTextBox: no `PALETTE.primary` (#1B3A5F), no `PALETTE.text` (#1A1A1A), no `PALETTE.secondary` (#C4373B)
- For emphasis inside the box, use brightness variations: full white for hero, `rgba(255,255,255,0.7)` for muted
- Accent colors like `PALETTE.accent` (#C4873B) are OK if used at full saturation on light text

**The test:** If you put dark-colored text on a dark transparent box over a dark image, it's invisible. Always use light text in AnimatedTextBox phases.

---

## 5. Text Effects and Animation Variety

### What failed:
- Every element using the same spring fade-in from below = monotonous
- No exit animations = phases just freeze at the end

### What's expected:
- Word-by-word reveals
- Animated underlines (scaleX draw from left)
- Exit fades on outgoing phases
- Highlight washes (colored background animating behind key phrases)
- Staggered entrances with varied delays

**Rule:** Never use the same entrance animation for every text element in a phase. Vary the spring config, direction, and timing.

---

## 5. Phase Transitions

### What failed:
- Hard cuts between phases — jarring, no visual continuity
- `<Series>` with no overlap = instant switch from one phase to the next

### What's needed:
- Cross-fade between phases: last ~12 frames of outgoing phase overlap with first frames of incoming phase
- Use `<Series.Sequence offset={-12}>` on phases 2+ for overlap
- Every phase except the last in a scene should have an exit fade over its final 12 frames

---

## 6. Fonts

The Swarajya brand guide (`~/.claude/skills/swarajya-studio/visual/brand-core.md`) specifies:
- **Display/Titles:** Helvetica, Arial, sans-serif
- **Body/Data:** Helvetica, Arial, sans-serif
- **Mono:** JetBrains Mono, monospace

Georgia and Inter were wrong — caught after user review.

**Rule:** Always check the brand guide before setting fonts in `theme.ts`.

---

## 7. Logo

- Logo burn-in is handled by `RemoxScene.tsx`, not individual scenes
- For vertical (9:16): width should be **229px** (160px original → 208px → 229px — each iteration increased ~10% for better presence)
- Position: `top: 90, right: 78` (right margin increased by 30px from previous 48px for better breathing room from edge)
- Opacity: 0.85

### Endcard Scene: Skip Corner Logo

When a scene is a dedicated endcard (large centered logo + tagline), skip the small corner logo overlay — it clashes with the centered hero logo. In `RemoxScene.tsx`, wrap the corner logo `<Img>` with a scene ID check:

```tsx
{sceneId !== 'SceneEndcard' && (
  <Img
    src={staticFile('images/logo.png')}
    style={{ position: 'absolute', top: 90, right: 78, width: 229, opacity: 0.85 }}
  />
)}
```

Replace `'SceneEndcard'` with whatever the actual last scene ID is (e.g. `'Scene14'`).

---

## 8. Visual Variety Across Scenes

### What failed:
- Every backdrop phase looking identical (same blur, same overlay, same panel)
- Consecutive scenes with the same visual treatment = viewer fatigue

### Rules:
- Never 3+ consecutive scenes with the same treatment
- At least 20% of runtime should be low-text or no-text (narration-led)
- Vary text layout: centered, left-aligned, top-left positioned, split-screen
- Solid-bg phases used sparingly for maximum dramatic contrast (1-2 per video)
- Mix backdrop phases between pure text phases — no scene should be entirely text

---

## 9. Safe Zones (Vertical)

```
+---------------------------------------+
|  [TOP-LEFT: safe]          [LOGO]     |  <- top-right reserved for logo
|                                       |
|         [CENTER: hero text]           |
|                                       |
|                                       |
+---------------------------------------+
|        [SUBTITLE STRIP — OFF]         |  <- bottom 20% reserved for subtitles
+---------------------------------------+
```

- NEVER place text in bottom 20% (subtitles live there)
- NEVER place text in top-right (logo lives there)
- Preferred: center-middle (hero), top-left (secondary)

### CSS implementation traps:
- **`alignItems: 'flex-end'`** pushes content to the BOTTOM of the frame — directly into the subtitle zone. NEVER use `flex-end` for text positioning.
- **`alignItems: 'flex-start'`** pushes content to the TOP-LEFT — safe, but verify it doesn't overlap the logo zone (top-right ~300px × 200px).
- **Full-width dark bars** (`width: '100%'`, `background: rgba(...)`) anchored to `flex-end` = a "lower-third" bar sitting ON the subtitle strip. This is WRONG even though it looks like a common TV lower-third — our subtitles burn into that exact space in post-production.
- **The "lower-third" template is a misnomer.** Never implement it as a bottom-anchored bar. Instead, position text at center-left: `justifyContent: 'center', alignItems: 'flex-start', padding: '80px 192px 220px'` — the 220px bottom padding keeps text above the subtitle zone.
- **Safe pattern for text over images:** `<AbsoluteFill style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 192px 220px' }}>` — text centered vertically, left-aligned, clear of both logo and subtitle zones.
- **NEVER use `justifyContent: 'flex-start'` for text containers** — this pushes text to the very top of the frame, making it look like a top banner. Always use `justifyContent: 'center'` to vertically center text in the safe zone between logo (top) and subtitles (bottom).

---

## 10. Production Pipeline Order

1. Read ALL guidance files before writing any code
2. Build ontology (narrative arc, per-scene treatments)
3. Creative direction (visual treatment per scene, variety check)
4. Write theme.ts (correct fonts, palette)
5. Write scenes with proper text sizes, animations, transitions
6. Validate (frame 0 render)
7. Visual audit (7 keypoint frames per scene)
8. Fix issues found in audit
9. Render
10. Review with user

**Do not skip steps 2-3.** Most problems in this session came from jumping straight to code without proper creative direction.

---

## 11. Text-Only Pipeline

When the user requests "text only" visuals, skip all ImageGen and backdrop image generation entirely. Use pure kinetic typography on cream backgrounds with color wash phases. This is faster and often more visually effective than generated backdrops — the typography IS the visual, and there is no backdrop image to generate, approve, or re-generate.

---

## 12. Post-Production Subtitle Pipeline

### Pipeline Order

1. **Render video** from Remotion first (full render, not preview)
2. **Transcribe source voiceover** with Whisper (not the rendered video — the original audio file, or extracted audio if needed)
3. **Generate ASS subtitle file** using `gen_subs.py`
4. **Burn subtitles** into the rendered video with ffmpeg

**Order matters:** Transcribe the source voiceover (not the sped-up output) when the voiceover matches the script exactly. If the video was sped up, transcribe AFTER speed-up so Whisper timestamps align.

### Environment Setup

```bash
source ~/.claude/.env   # loads OPENAI_API_KEY
```

### Whisper Transcription

```bash
curl https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F file=@voiceover.mp3 \
  -F model=whisper-1 \
  -F response_format=verbose_json \
  -F timestamp_granularities[]=word \
  > whisper.json
```

Use `verbose_json` + `timestamp_granularities[]=word` for word-level sync. Sentence-level timestamps are not sufficient for subtitle burn-in.

### Generate ASS File

```bash
python3 ~/.claude/skills/Remox/skills/utilities/gen_subs.py whisper.json subs.ass
```

### Burn Subtitles

```bash
ffmpeg -y -i rendered.mp4 -vf "ass=subs.ass" -c:v libx264 -preset medium -crf 18 -c:a copy output_with_subs.mp4
```

### ASS Subtitle Style Rules

- **BorderStyle=3** — opaque box (solid background behind text). CRITICAL: `Outline=0` makes the black box invisible. Always use `Outline >= 12` (use 15 for comfortable padding).
- **Default color:** Full white text — `PrimaryColour=&H00FFFFFF` and `SecondaryColour=&H00FFFFFF`. Do NOT add karaoke color highlighting unless the user explicitly requests it.
- **Vertical (9:16) settings:** Helvetica Bold, 58px, `MarginV=420`
- **Why 420:** Instagram's bottom UI (username, caption, music info, action buttons) covers ~400-440px from the bottom on a 1920px frame. `MarginV=180` is too low for Instagram — subtitles get hidden behind Instagram's bottom overlay.
- **Line grouping:** Max 7 words per line, break on pauses > 0.4s

### Audio Splitting (Scene Audio Files)

To detect paragraph/scene boundaries in a long voiceover and split into per-scene audio files:

```bash
ffmpeg -i voiceover.mp3 -af silencedetect=noise=-30dB:d=0.5 -f null - 2>&1 | grep silence
```

Split at silence gaps > 1s. These mark natural paragraph boundaries suitable for scene audio files.

---

## 13. Subtitle Styling (Vertical 9:16) — Archived Settings

Previous session settings (before March 2026 calibration — superseded by section 12):

- **Font:** Helvetica bold, 64px (current: 58px — see section 12)
- **Color:** White with black outline (2.5px)
- **Position:** `MarginV: 320`
- **Word highlight:** Active word turns accent gold with 110% scale bump (current: no highlight by default)
- **Line grouping:** Max 8 words per line, break on pauses > 350ms

---

## 15. AudioSync — Phase Duration Formula

Phase durations MUST be derived from Whisper word timestamps, not estimated or set uniformly.

**Formula:** `dur[i] = whisperStart[i+1] - whisperStart[i] + 18`

The `+18` accounts for the transition overlap frame budget. For the last phase:
`dur[last] = totalFrames - whisperStart[last]`

The phase TEXT content must also match what is being narrated at that time — boundary alignment alone is not enough. A phase that starts at the right frame but displays the wrong sentence is still an AV sync failure.

**Tool:** `~/.claude/skills/Remox/remotion/audiosync.mjs`

---

## 16. Remove Callback/Recall Phases

Short post-audio phases (30-50f) that flash an image or text after narration ends are jarring. The viewer perceives a momentary flicker with no audio context.

**Rule:** Let the last content phase hold to the end of the scene. There is no need for a "callback" phase after the narration completes. Scene 07 ("But the point was made.") is the reference example — the final phase simply holds until scene end.

---

## 17. Real Imagery Swaps

Replace AI-generated PNGs with processed real photos at the same filename — no TSX changes needed since the filename stays the same.

**Processing pipeline:** crop to square, desaturate heavily, add film grain for consistency with the editorial aesthetic.

**ffmpeg command:**
```bash
ffmpeg -i input.jpg \
  -vf "crop=ih:ih:(iw-ih)/2:0,scale=1080:1080,eq=contrast=1.3:saturation=0.12,noise=alls=10:allf=t" \
  output.png
```

This crops center-square, scales to 1080×1080, reduces saturation to near-monochrome (0.12), boosts contrast slightly, and adds film grain noise.

---

## 18. Disk Cleanup — Remotion Webpack Bundles

Remotion creates a ~500MB webpack bundle per render in the system temp directory. After 50+ renders this accumulates 25GB+ of orphaned temp files.

**Clean with:**
```bash
rm -rf /var/folders/bv/*/T/remotion-webpack-bundle-*
```

Run this periodically during long production sessions, especially before a final render batch.

---

## 19. Phase Count — Too Many Phases Kills the Video

### What failed:
- Ontology planned 2-4 coarse phases per scene with "~25 second" estimates
- Producer agents inflated these into either too few phases (3 for 56s = 18s each) or too many (28 for 117s = some under 2s)
- Too many phases = flickering slideshow where no image registers before it's gone
- Too few phases = static wall of text with no visual rhythm

### The rule:
**Target: audio_duration ÷ 4.5 seconds = number of phases.** This is the planning target, not a hard limit.

- 60s scene → ~13 phases
- 90s scene → ~20 phases
- 120s scene → ~27 phases
- 200s scene → ~44 phases

**Hard limits per phase:**
- Minimum: 150 frames (5 seconds) — anything shorter is a flicker, merge it into a neighbor
- Maximum: 240 frames (8 seconds) — acceptable for slow analytical narration
- Sweet spot: 150-210 frames (5-7 seconds)
- **NEVER allow phases under 150 frames.** If whisper timestamps produce a sub-150f phase, MERGE it with the adjacent phase. No exceptions.

**Phase count formula:** `target_phases = ceil(duration_seconds / 6)`

- 60s scene → ~10 phases
- 100s scene → ~17 phases
- 120s scene → ~20 phases
- 200s scene → ~34 phases

The old formula (`duration / 4.5`) produced too many short phases causing a flickering slideshow. Each phase must cover one COMPLETE sentence or thought — the viewer needs time to read, absorb the image, and connect to what they're hearing.

**Exception:** Variable durations are acceptable when derived from Whisper timestamps and narration has naturally slow/fast sections. A 10-second analytical hold over a single image is fine if the narrator is speaking slowly. But 2-second flashes are never fine.

### What to check at ontology level:
The ontology MUST include `target_phases` per scene computed from audio duration. If a scene's ontology has fewer phase concepts than `target_phases`, the ontology is too coarse — break each concept into finer beats before proceeding to creative direction.

---

## 20. Ontology Must Include LEARNINGS.md as Input

The ontology conversion step MUST read `LEARNINGS.md` alongside the 8 mandatory guidance files. LEARNINGS.md contains hard-won production rules that override theoretical guidance — especially:
- Phase count targets (§19)
- AudioSync formula (§15)
- Image treatment (§2, §3)
- Text readability over images (§4)
- Visual variety (§8)
- Phase transitions (§5)
- Remove callback/recall phases (§16)

Without these inputs, the ontology will produce plans that violate proven production constraints.

---

## 21. Image Density Target at Ontology Level

The ontology MUST specify image density per scene:
- **Hero scenes:** 70%+ phases with images
- **Supporting scenes:** 50%+ phases with images
- **Connective scenes:** 30%+ phases with images

This prevents the "text-only wall" problem where agents default to kinetic typography for every phase because the ontology didn't mandate images.

At the ontology level, each scene's `visual_plan` should include:
```yaml
image_density: high    # high (70%+) | medium (50%+) | low (30%+)
```

---

## 23. Ontology Must Contain Concrete Visual Direction Per Phase

### What failed:
The ontology had vague phase descriptions like "defocused ocean backdrop, kinetic word slam" and "duotoned war room image, lower-third text." These gave creative INTENT but not concrete DIRECTION. The producer agent then improvised wildly — putting wrong content in phases, using dark images when light was needed, choosing wrong image styles.

### What the ontology MUST specify per phase:
For EACH phase in EACH scene (at `target_phases` granularity):

```yaml
phases:
  - id: 1
    narration_text: "exact words the narrator says during this phase"
    whisper_start_ms: 0        # from whisper timestamps
    whisper_end_ms: 4500
    duration_frames: 135
    visual_depiction: "Real photo of USS Enterprise CVN-65 at sea (use real_uss_enterprise_1971_aerial.jpg), Ken Burns zoom, focal-offset layout with headline left"
    image_source: "real/real_uss_enterprise_1971_aerial.jpg"  # or "generate: [prompt]"
    image_style: cinematic-photorealistic  # cinematic-photorealistic | satellite-recon | naval-schematic | geopolitical-map | editorial-portrait | industrial-documentary | cream-editorial-infographic
    template: focal-offset
    background: image
```

### Key rules:
- `narration_text` must be the EXACT words from the script that play during this phase
- `whisper_start_ms` and `whisper_end_ms` are derived from whisper timestamps
- `visual_depiction` must be a concrete, unambiguous description — not creative intent
- `image_source` must reference either a real image file (checked for existence) or a generation prompt
- The producer should NOT need to "figure out" what to show — the ontology tells it

### Available image styles (for this project):
1. **cinematic-photorealistic** — moody, atmospheric, film grain (for military hardware, ocean, facilities)
2. **satellite-recon** — grainy thermal imaging (for stealth/surveillance moments)
3. **naval-schematic** — white lines on navy background (for engineering specs)
4. **geopolitical-map** — clean dark cartography (for locations, routes, range arcs)
5. **editorial-portrait** — dramatic duotone (for key figures)
6. **industrial-documentary** — tungsten lighting, film grain (for facilities, labs)
7. **cream-editorial-infographic** — navy line art on cream background (for data, diagrams, clean editorial)

### Image style as ontology-level decision:
The choice of image style per phase is a CREATIVE DIRECTION decision, not a producer decision. It must be locked in the ontology so the producer simply executes it.

---

## 24. Real Images Must Be Mapped at Ontology Level

The ontology must list available real images per scene (from `image_manifest.md`) and assign them to specific phases. Real images ALWAYS take priority over AI-generated images when they match the subject.

The ontology writer must:
1. Read `image_manifest.md`
2. For each scene, list matching real images
3. Assign real images to specific phases
4. Only mark phases as "generate" when no real image matches

This prevents the producer from generating AI images that are worse than available real photos.

---

## 27. Portrait Photos Must Show Full Face — Never Crop at Nose or Neck

### What failed:
When using real photos of people (Gandhi, Nixon, Kalam, Gorshkov, Modi) as backgrounds in 16:9 frames, the default `objectFit: cover` with `objectPosition: center` often crops the photo at the nose or neck — the viewer sees a forehead or a chin but not a complete face. This is worse than no image at all.

### The fix:
Before using any portrait photo, the agent MUST:
1. **Read/view the image** to see where the face is positioned
2. **Set `objectPosition`** to keep the full face visible:
   - If face is in upper third: `objectPosition: '50% 20%'` (pull crop toward top)
   - If face is centered: `objectPosition: '50% 35%'` (slight top bias to show full head)
   - If face is in lower half: `objectPosition: '50% 50%'` (center is fine)
   - If it's a full-body shot: `objectPosition: '50% 15%'` (keep head and torso)
3. **Test mentally**: In a 1920×1080 crop of this image, is the full face visible from forehead to chin?

### Per-image objectPosition values:
Maintain a lookup of tested values. Once a real image's crop is verified, reuse the same `objectPosition` whenever that image appears.

### At production time:
The producer/fix agent must visually analyze every real photo used in the video and compute the correct `objectPosition` before rendering.

---

## 26. Text Must NEVER Be Right-Aligned or Top-Right Positioned

### What failed:
Phases using `alignItems: 'flex-end'` pushed text to the right side of the frame — directly behind the channel logo that burns into the top-right corner via `RemoxScene.tsx`. The text becomes unreadable or visually cluttered.

### Hard rule:
- **Text goes LEFT, image goes RIGHT** in focal-offset/split layouts
- `alignItems: 'flex-start'` (left-align) — NEVER `flex-end` (right-align)
- `justifyContent: 'flex-start'` (top) or `'center'` — acceptable
- The top-right quadrant (approximately right 300px × top 200px) is ALWAYS occupied by the logo
- Lower-third text should be left-aligned at `left: 80-192px`, never right-aligned or centered-right

### In TSX:
```tsx
// CORRECT — text left, safe from logo
<AbsoluteFill style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 192px' }}>

// WRONG — pushes text under the logo
<AbsoluteFill style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: '0 80px 220px' }}>
```

---

## 25. Visuals Must ADD to Audio, Not Repeat It

### What failed:
Most phases displayed the narrator's exact words as on-screen text. Narrator says "seventy-five thousand tonnes, nuclear-powered" and the screen shows "75,000 TONNES / NUCLEAR-POWERED" in big text. This is text-karaoke — the viewer is reading what they're hearing. It wastes the visual channel and is boring.

### What good documentary visuals do:
1. **SHOW what the narrator TELLS** — when narrator says "75,000 tonnes," the viewer SEES the Enterprise photo. The scale of the image communicates tonnage better than text.
2. **ADD information audio can't** — maps, faces, diagrams, facility photos
3. **Create emotional context** — dark ocean for stealth, reactor room for engineering difficulty
4. **Use text SPARINGLY** — only for: key stats/numbers, names/dates, dramatic emphasis ("GONE.", "Dead.", "India's nuclear triad is complete")

### Rules for each phase:
- **Image phases**: The image IS the visual. Overlay text should be a short label, name, or date — NOT a transcript of what the narrator is saying. Max 2 lines of text on an image phase.
- **Text-only phases**: Reserved for maximum dramatic moments where the WORDS are the visual ("She gave the order.", "Dead.", "Silent. Invisible. Always watching."). These should be rare — 2-3 per scene maximum.
- **The test**: If you mute the audio, does the image alone tell you something? If the screen just shows text that means nothing without audio, it's wrong.

### At ontology level:
For each phase, the `visual_depiction` field must describe what the viewer SEES (an image, a diagram, a face), not what text appears on screen. Text overlay details go in a separate `text_elements` field and should be minimal.

---

## 22. India Map Borders — Non-Negotiable

Any map of India MUST show complete territory including Jammu & Kashmir and Ladakh as integral parts of India. The Line of Control must NOT be shown as an international boundary. This is non-negotiable for any Indian publication content.

Map generation prompt must always include: "Complete map of India including Jammu Kashmir and Ladakh as integral parts of India."

---

## 29. Low-Resolution Internet Images — Upscale Before Use

### What failed:
Real photos downloaded from Wikipedia/Wikimedia are often low resolution (400-800px wide). When placed in a 1920×1080 frame with `objectFit: cover`, they look blurry and pixelated — destroying the documentary quality.

### Minimum resolution requirements:
| Panel usage | Minimum width | Minimum height |
|---|---|---|
| Full-bleed background | 1920px | 1080px |
| Focal-offset split (50%) | 960px | 1080px |
| Split-compare panel | 960px | 1080px |

### Fix for low-res images:
Before using ANY downloaded image, check its resolution:
```bash
ffprobe -v quiet -show_entries stream=width,height -of csv=p=0 image.jpg
```

If below minimum, upscale using lanczos:
```bash
# Upscale to 2x with high-quality lanczos filter
ffmpeg -y -i input.jpg -vf "scale=iw*2:ih*2:flags=lanczos" -q:v 2 output.jpg

# Or upscale to specific minimum width (e.g. 1920px for full-bleed)
ffmpeg -y -i input.jpg -vf "scale=1920:-1:flags=lanczos" -q:v 2 output.jpg
```

### At production time:
The producer agent must check every real image's resolution BEFORE writing TSX. If under minimum, upscale it. If upscaling would be more than 3x (image is tiny), skip it and use an AI-generated alternative instead — 3x+ upscaling produces visible artifacts.

---

## 30. Image Aspect Ratio Must Match Panel — Never Distort

### What failed:
Using `objectFit: 'cover'` on images whose aspect ratio doesn't match the panel crops significant content. A 4:3 portrait photo in a 16:9 full-bleed frame loses the top and bottom. A 16:9 landscape in a 1:1 split panel loses the left and right sides. The subject gets cut off — heads chopped, ships halved, maps missing borders.

### The rule:
**Never distort or excessively crop images.** The image's native aspect ratio must be compatible with the panel it occupies.

| Panel type | Panel aspect ratio | Compatible image ratios |
|---|---|---|
| Full-bleed (1920×1080) | 16:9 | 16:9, 3:2 (minor crop) |
| Focal-offset split (~960×1080) | ~9:10 | 1:1, 4:5, 3:4, 9:16 (minor crop) |
| Split-compare (~960×1080) | ~9:10 | 1:1, 4:5, 3:4 |

### What to do when aspect ratios don't match:
1. **Preferred**: Use `objectFit: 'contain'` with a matching background color — shows the full image with bars
2. **Acceptable**: Use `objectFit: 'cover'` with `objectPosition` carefully set to keep the subject visible
3. **Last resort**: Pad the image to match the target ratio:
```bash
# Pad a 4:3 image to 16:9 with black bars
ffmpeg -y -i input.jpg -vf "pad=ih*16/9:ih:(ow-iw)/2:0:black" output.jpg

# Pad a 16:9 to 1:1 with cream bars (#F5F3EE)
ffmpeg -y -i input.jpg -vf "pad=iw:iw:0:(oh-ih)/2:0xF5F3EE" output.jpg
```

### At production time:
Before assigning an image to a phase, check its aspect ratio against the panel type. If incompatible, either pad it, use `contain`, or choose a different image.

---

## 14. Thumbnail Generation

- Use **ImageGen skill** (Gemini Nano Banana Pro) for Instagram thumbnails, not HTML screenshots
- 9:16 aspect ratio, 2K size
- Reuse the video's first backdrop image with duotone treatment for visual consistency
- Include: headline text, subtitle, #SWARAJYA badge, play button indicator
- Keep bottom 15% clear (Instagram UI overlaps there)

---

## 31. Stale Audio in Skill Template — Nuclear Bug

### What failed:
The Remox skill template at `~/.claude/skills/Remox/remotion/` retains audio files from PREVIOUS projects. The render pipeline bundles from the skill template directory (`render.mjs` line 76: `resolve(__dirname, 'src', 'index.ts')`), so `staticFile('audio/scene_XX.mp3')` resolves to the **skill template's** `public/audio/`, not the project's. If a previous project had a `scene_02.mp3`, the new project renders with the OLD audio silently — same filename, different content.

### The fix — MANDATORY before every render:
1. **Sync ALL audio** from the project source to the skill template:
   ```bash
   for f in /path/to/project/audio/scene_*.mp3; do
     cp -f "$f" ~/.claude/skills/Remox/remotion/public/audio/$(basename "$f")
   done
   ```
2. **Sync Whisper timestamps** too (same pattern).
3. **Remove stale scene audio** — if the old project had 15 scenes and the new one has 6, delete scene_07 through scene_15 from both `project/remotion/public/audio/` and `~/.claude/skills/Remox/remotion/public/audio/`.
4. **Clean Remotion temp cache** before re-rendering after an audio swap:
   ```bash
   rm -rf /var/folders/bv/*/T/remotion-*
   ```
   Remotion's asset preprocessor caches audio. Even if the source file changes, the cached preprocessed audio may persist. Delete ALL remotion temp artifacts to force a fresh bundle.
5. **Post-render verification** — after every render, extract 5 seconds of audio and transcribe to confirm it matches the expected narration:
   ```bash
   ffmpeg -y -i output/scenes/SceneXX.mp4 -t 5 -q:a 0 /tmp/check.mp3
   # Transcribe with Whisper and compare first words
   ```

### Why this is critical:
A video with wrong audio is worse than no video. The filename matches, the duration may be close, and nothing in the pipeline flags it. The only way to catch it is to listen to the output or transcribe-verify.

---

## 32. Series Frame Bug — useCurrentFrame() Inside Phase Components

### What failed:
Phase components received `frame` as a prop from the scene root's `useCurrentFrame()`. This gives the **global scene frame**, not the **local phase frame**. Inside `<Series.Sequence>`, the global frame for Phase 5 might be 1200 — but the phase component thinks `frame=1200` and `exitOpacity(1200, 200)` returns 0 (invisible).

Result: Phase 1 and 2 render fine (global frame ≈ local frame). Phase 3+ are invisible.

### The fix:
Each Phase component MUST call `useCurrentFrame()` internally. Never pass the parent's frame as a prop.

```tsx
// WRONG — Phase gets global frame, goes invisible after Phase 2
const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Series>
      <Series.Sequence durationInFrames={200}>
        <Phase1 frame={frame} duration={200} />  // frame=0-200 ✓
      </Series.Sequence>
      <Series.Sequence durationInFrames={200}>
        <Phase2 frame={frame} duration={200} />  // frame=200-400 ✗ invisible!
      </Series.Sequence>
    </Series>
  );
};

// RIGHT — Each Phase reads its own local frame
const Phase1: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame(); // local: 0 to duration
  // ...
};
```

### At production time:
The producer agent must NEVER pass `frame` from the root to Phase components. Each Phase calls `useCurrentFrame()` itself. The audit should flag this pattern.

---

## 33. SceneRegistry — Only .ts, Never .tsx, Delete Stale Entries

### What failed:
The skill template had TWO registry files: `SceneRegistry.tsx` (old project, lowercase keys like `scene_02`, imported 14 scenes from a previous video) and `SceneRegistry.ts` (auto-generated by pipeline, correct `'Scene02'` keys). TypeScript resolves `.tsx` before `.ts`, so the OLD registry was always used. Result: `registry['Scene02']` returned `undefined`, the scene rendered as a black "Scene not found" screen, and the output was 5.3MB instead of ~100MB.

### The fix:
1. **Only `SceneRegistry.ts` should exist.** Delete any `.tsx` variant.
2. **The pipeline auto-generates `SceneRegistry.ts`** — never hand-edit it.
3. **Before every render**, verify the registry maps scene IDs correctly:
   ```bash
   grep "'Scene02'" ~/.claude/skills/Remox/remotion/src/SceneRegistry.ts
   ```
4. **Delete stale scene files** from previous projects. If the old project had Scene_03 through Scene_14 and the new one has Scene_01 through Scene_06, remove the old ones to prevent import errors.

### Post-render size check:
A properly rendered 1920x1080 scene with images should be roughly **0.8-1.0 MB per second** of video. If a 120s scene renders to 5MB, something is wrong — likely blank/solid-color frames with no images loading. Check:
- Are images referenced in TSX present in `public/images/`?
- Does the SceneRegistry map the correct scene ID?
- Does `useCurrentFrame()` work inside each Phase? (see §32)

---

## 34. Visual Phase Review — Mandatory Before Render

### What failed:
Agents wrote TSX, passed mechanical audit, rendered — but the output had text in wrong positions, text repeating what the narrator says (text karaoke), and poor aesthetics. The mechanical audit checks structure (phase count, TSM math, font sizes, template tags) but CANNOT check visual quality, text placement in the actual rendered frame, or show-don't-tell compliance.

### The rule:
After writing TSX and BEFORE calling the render pipeline, the producer agent MUST:
1. Render keypoint stills (`validate.mjs --audit` or extract frames with ffmpeg)
2. **Read/view each still image** using the Read tool
3. Check every phase for:
   - **Text placement**: not in bottom 20% (subtitles), not in top-right (logo), vertically centered
   - **Show don't tell** (§25): image phases should SHOW what narrator TELLS. If the phase just displays the narrator's words as on-screen text, it FAILS. The image should depict the subject; text is a minimal label only.
   - **Aesthetic quality**: professional composition, visual variety, readable fonts, appropriate white space
4. Fix failures BEFORE rendering

### Why this is critical:
A video that passes all mechanical audits but looks like a slideshow of text karaoke is worse than useless. The visual review is the quality gate that catches what algorithms cannot — whether the video actually looks good and communicates visually.

See `skills/guidance/producer.md` Step 4 for the full review process.

---

## 35a. Preproduction Cleanup — Clear Previous Project Artifacts

### What failed:
Starting a new video project without clearing artifacts from the previous one. Old scene TSX files, audio, whisper timestamps, images, webpack bundles, and SceneRegistry entries from the previous video persist in the skill template and cause silent failures — wrong audio playing, "Scene not found" renders, stale images appearing.

### The rule — MANDATORY at the start of every new project:
```bash
# 1. Clear skill template scenes
rm -f ~/.claude/skills/Remox/remotion/src/scenes/Scene_*.tsx

# 2. Clear skill template audio
rm -f ~/.claude/skills/Remox/remotion/public/audio/scene_*

# 3. Clear skill template images (keep logo.png)
find ~/.claude/skills/Remox/remotion/public/images/ -name "s[0-9]*" -delete 2>/dev/null

# 4. Clear webpack cache
rm -rf /var/folders/bv/*/T/remotion-*

# 5. Clear old renders
rm -rf ~/.claude/skills/Remox/remotion/output/scenes/

# 6. Reset SceneRegistry
echo "const registry: Record<string, React.FC> = {}; export default registry;" > ~/.claude/skills/Remox/remotion/src/SceneRegistry.ts
```

This cleanup must happen BEFORE any preproduction steps (audio generation, scaffold, etc.) for a new project.

---

## 35. Skill Template Sync — Verify Before Every Render

### What failed:
The producer agent wrote new TSX to the project directory but forgot to copy it to the skill template (`~/.claude/skills/Remox/remotion/src/scenes/`). The render pipeline reads from the skill template, not the project dir. Result: all 7 scenes rendered from OLD code while the new code sat unused in the project directory. Every render was stale.

### The rule — MANDATORY before every pipeline run:
1. **Copy TSX to skill template**:
   ```bash
   cp /path/to/project/remotion/src/scenes/Scene_XX.tsx ~/.claude/skills/Remox/remotion/src/scenes/
   cp /path/to/project/remotion/src/theme.ts ~/.claude/skills/Remox/remotion/src/
   ```
2. **Verify with MD5**:
   ```bash
   md5 /path/to/project/remotion/src/scenes/Scene_XX.tsx ~/.claude/skills/Remox/remotion/src/scenes/Scene_XX.tsx
   ```
   If the hashes don't match, the render WILL use the wrong code. Do not proceed.
3. **Also sync images**:
   ```bash
   rsync -av /path/to/project/remotion/public/images/ ~/.claude/skills/Remox/remotion/public/images/
   ```

### Why this keeps happening:
The Remotion project at the skill template (`~/.claude/skills/Remox/remotion/`) is the actual render source — `render.mjs` bundles from there. The project directory's `remotion/` is a scaffold copy for editing. They are TWO SEPARATE directories. Every file change in the project dir must be explicitly copied to the skill template before rendering. There is no auto-sync.

### ✅ FIXED AT ROOT (2026-07-02) — see §36:
`render.mjs`, `validate.mjs`, `audit.mjs`, `audiosync.mjs`, and `pipeline.mjs`
now resolve the source tree from the PROJECT (`<projectDir>/remotion/`) when it
exists, falling back to the skill template only for legacy projects. For
scaffolded projects the sync ritual above is OBSOLETE — edit the project tree
and render. Keep this section for legacy projects without their own remotion/.

## 36. Render Tree Resolution + Version Mixing (Root Fix for §35)

### What failed (PL-15 v2 pilot):
Three agents edited project-tree scene files; all audits and renders silently
used the skill-template copies (old code). Stills from `npx remotion still`
(run in the project) showed NEW code while `render.mjs` MP4s showed OLD code —
both "passed" their checks. Two full render cycles were wasted.

### The fix:
1. All pipeline scripts prefer `<projectDir>/remotion/` as the source tree.
   `render.mjs`/`validate.mjs` print `Source tree: <path>` — CHECK THIS LINE
   in every render log.
2. `render.mjs`/`validate.mjs` load `@remotion/bundler` + `@remotion/renderer`
   via `createRequire` FROM THE TREE BEING BUNDLED. Mixing the skill's bundler
   with a project's modules throws webpack "export not found" errors (e.g.
   `HtmlInCanvas`) whenever versions drift.

### Rules:
- New npm deps used by scenes (e.g. `@remotion/google-fonts`) must be
  installed in the PROJECT's remotion/node_modules (scaffold's npm install
  handles this for new projects since the dep is now in the template
  package.json).
- Never verify visual changes from stills alone: after rendering, extract
  frames from the OUTPUT MP4 (`ffmpeg -ss <t> -i out.mp4 -frames:v 1 f.png`)
  at the moments you changed, and LOOK at them.

## 37. Motion Doctrine Is Mandatory — Read motion-doctrine.md

`skills/guidance/motion-doctrine.md` (validated in the PL-15 v2 pilot) is now
a mandatory read before writing scene code. Summary of hard rules:
- Every phase has three acts: entrance → ambient idle → exit. No static holds.
- Springs for impact beats only; long-tail beziers (`EASING.out/outSoft`) for
  editorial beats; exits accelerate (`EASING.in`) and finish before the
  transition window.
- BANNED: typewriter carets, textShadow glow on text, in-place text
  crossfades, CSS `transition:` properties.
- Payoff lines are NEVER smaller than their setup lines.
- Backgrounds are never one flat hex — tonal ramp + grain (RAMP in theme.ts).
- Charts follow the Chart Craft Requirements in `charts.md` (axis, gridlines,
  count-up value labels, source line, delta annotation).

## 38. Never Change TransitionSeries Durations When Re-Skinning

### What failed:
An agent upgrading a scene's visuals changed the last phase's
`durationInFrames` from 262 → 248 (and its `DUR` constant). TSM audit failed:
`sum(durations) - (N-1)*18` no longer matched the scene's frame count, and
the phase timing drifted off the Whisper-synced narration.

### The rule:
Visual upgrades re-skin the INTERIOR of phases. Phase count, order, and every
`durationInFrames` (sequences AND transitions) are Whisper-derived and frozen.
If exit choreography needs timing, derive it from the existing `DUR` constant
(`exitStart = DUR - 32`), never by changing `DUR`.

## 39. Finishing Pass — Unified Grade Before Concat

Rendered scenes get one shared grade so photo scenes and vector scenes read
as a single film: gentle S-curve with lifted blacks, +5% saturation, subtle
vignette, temporal grain.

```bash
~/.claude/skills/Remox/scripts/finish.sh output/scenes/SceneXX.mp4 output/graded/SceneXX.mp4
```

Run per scene after RENDER, then concat the GRADED files. Calibration note:
the first version (vignette PI/5, noise 5) grayed the cream scenes — current
settings (vignette PI/7, noise 4, saturation 1.05) preserve warmth. If cream
scenes look dirty-gray after grading, the vignette is too strong.

## 40. Bundle Temp Cleanup — ENOSPC Guard

Every `bundle()` call copies the full `public/` assets (often 100MB+) into a
temp dir. A production day with 25+ render/validate runs filled the disk
completely (ENOSPC — even shell commands stopped working). `render.mjs` and
`validate.mjs` now delete their own bundle temp dir on process exit. If disk
fills anyway, clear `$TMPDIR/remotion*` and stale `$TMPDIR/react-*` bundles.

## 41. Bespoke Vector Diagrams Are an Amateur Tell — Use Illustrated Plates

### Validated in production: PL-15 v3 session (2026-07). User-approved.

Bespoke thin-vector diagrams (hand-coded SVG with 1–2px strokes, small shapes,
minimal fills on a plain background) are a confirmed amateur tell. They read as
"clip art" regardless of how carefully the geometry is drawn. The thin-line
look that feels "clean" in a browser is invisible and cheap on video.

### The validated replacement: illustrated plates + cinematic camera

A 4K textless illustration generated with the ImageGen skill (Nano Banana Pro),
with a cinematic camera (zoom/pan keyframes in normalised coordinates) synced
to narration. Text overlays remain Remotion kinetic typography layered above.

This produces broadcast-quality results: the plate provides environmental depth
and atmosphere; the camera creates progressive revelation; text floats cleanly
above.

See `skills/cinematic/illustrated-plate.md` for the complete authoring guide.
The component is `remotion/src/IllustratedPlate.tsx` (ships in the scaffold).

### Where vector is still appropriate

- Data charts — where axis alignment and animated counters require code
  (follow `charts.md` Chart Craft Requirements)
- Kinetic typography decorations — rule draws, underlines, accent brackets

### Modern vector tokens are mandatory when vector IS used

The `motion-utils.ts` v3 tokens (`strokeGlow()`, `barFill()`, `gridline()`)
enforce the minimum stroke weights and glow treatment that make vector legible
on video. Never hand-roll thin flat SVG for primary elements. See
`motion-doctrine.md` § "Modern vector language".

## 42. TTS Audio Needs a Trailing Silence Buffer — Pad Before Production

### Validated in production: PL-15 full production (2026-07). User-flagged.

ElevenLabs TTS output ends almost exactly on the final word. Scenes rendered
to that duration cut off abruptly ("the very last few microseconds of the
words are cut"), and concatenated scenes feel breathless.

### The rule:
Append ~1.1s of trailing silence to every scene MP3 immediately after TTS
generation, BEFORE Whisper and pre-production, so all frame counts are correct
from the start:

```bash
ffmpeg -y -i scene_XX.mp3 -af "apad=pad_dur=1.1" scene_XX_padded.mp3
```

- durationFrames = ceil((speech + 1.1s) × fps); the LAST phase absorbs the
  padding (audiosync's dur[last] formula handles this automatically).
- Tail-only. NEVER prepend silence — it shifts every Whisper word timestamp.
- Why 1.1s and not 0.9s: the H5 audit rule requires ≥30 frames AFTER the last
  word's END. TTS speech usually ends a hair before the file does, so 0.9s of
  pad yielded exactly 27f in production and failed H5. 1.1s clears the floor
  with margin. (If a scene still trips H5, extend the scene a few frames —
  the audio simply ends early; the wrapper fade handles it.)
- If audio was already produced unpadded, pad at a clean boundary, add +27f
  (at 30fps) to every scene in project.json, update audioDurationMs in the
  whisper JSONs, and re-run `audiosync.mjs --fix` per built scene. This is a
  sanctioned exception to §38 because the audio itself changed.

### Between phases:
True silent gaps between phases are impossible without desyncing narration
(phase starts are pinned to Whisper word starts). The equivalent breathing
comes from letting each phase's exit choreography play through the narrator's
natural sentence pauses instead of holding a static frame and slamming into
the next phase.

## 43. Landscape Label Sizes — Skill Minimums Are Too Small

### Validated in production: PL-15 full production (2026-07). User-flagged.

The landscape (1920×1080) typography minimums in SKILL.md (labels/eyebrows
20px, captions 18px) produce near-illegible small text at real viewing sizes.
A rendered 20px mono eyebrow over a photographic background disappears.

### Floors for label-class text in landscape (hero headlines and stat numbers
at skill defaults are fine — this is about the SMALL classes):
| Role | Old min | New floor |
|---|---|---|
| Labels / eyebrows / mono data | 20px | 34px |
| Stat sub-labels | 20px | 36px |
| Captions / source credits | 18px | 28px |
| Lower-third names | 48px | 56px |

Also re-check placement when bumping sizes: small labels tend to sit low in
the frame, and after enlargement they can breach the bottom-20% subtitle zone.

## 44. Rich Phase Composition — No "Lone Label + Image" Phases

### Validated in production: PL-15 full production (2026-07). User-flagged.

A phase consisting of one small text label in one corner and an image in
another — especially an image crushed by dark overlays — reads as dead air.
User verdict: "too simplistic depiction — text is in one corner, image in
another, we want rich depictions."

### The rule — every image phase must be one of:
1. **Composed text block**: eyebrow + headline-weight line + supporting
   detail, tied together with an animated accent (rule draw, bracket,
   highlight wash), left-aligned in the safe zone, with entrance/ambient/exit
   choreography and a gentle Ken Burns on the image; OR
2. **Narration-led full-bleed**: the image itself is rich and luminous enough
   to carry the frame (light-touch treatment per §2 — never crushed), with
   text minimal or absent.

Corner-text + corner-image flatness is a HARD FAIL in the §34 visual still
review.

### Extension — text treatments too (user-flagged, same production):
A plain static two-line label dropped on an image ("A FEW SECONDS" + support
line, no motion, no accent) is equally a fail: "it can't be this simple."
Every text overlay moment needs deliberate typographic design — scale
hierarchy between hero line and support line, staggered kinetic entrance, an
animated accent (rule draw, underline, highlight wash, indicator dot), and
ambient life (breathe/pulse) through the hold. Where the image offers a
diegetic hook (a cockpit warning lamp, an instrument), tie the type's motion
to it. If a phase's text would read the same as a lower-third caption,
redesign it.

## 45. Sequential Production Is the Default — User Override + Pre-Render Feedback Gate

### Validated in production: PL-15 full production (2026-07). User-flagged.

The old auto-selection rule (">5 scenes = parallel producer pattern with
--auto-approve") is RETIRED. The user explicitly overrode it: parallel
production ran every scene past the preview gate before feedback on scene
one (label sizes §43, rich composition §44, audio tails §42) could land, so
the same mistakes compounded across the whole video.

### The rules:
1. **Sequential, always.** One scene at a time through the full pipeline,
   preview gate pausing for review, regardless of scene count. Spawn
   concurrent per-scene agents (with `--auto-approve`) ONLY when the user
   explicitly asks for parallel production. Within a scene, parallel
   asset+TSX sub-agents remain fine.
2. **Pre-render feedback gate.** The producer's §34 visual still review must
   include an explicit checklist pass — fixed BEFORE rendering, not noted
   for later:
   - Audio tail buffer present, scene never cuts on the last word (§42)
   - Label-class sizes at or above the §43 floors (34/36/28/56)
   - Rich composition — no lone corner label + corner image (§44)
   - Rich text treatment — no plain static labels, accents + stagger +
     ambient life required (§44 extension)
   - Phase breathing — exits play through narration pauses, no
     static-hold-then-slam (§42)

See producer.md "Step 4: Visual Phase Review" for the operative checklist.

## 46. Inline-Production Learnings — PL-15 Full Production (2026-07)

Five technical traps hit while producing Scenes 06-10; all verified in production.

### a. Audit TSM regex needs INLINE transition timing
`audit.mjs` parses transitions with `/Transition[^>]*durationInFrames:\s*(\d+)/`.
A shared `const TRANSITION = linearTiming({...})` + `timing={TRANSITION}` parses
as ZERO transitions → TSM hard-fails "off by (N-1)×18". Write
`timing={linearTiming({ durationInFrames: 18 })}` inline on EVERY
`<TransitionSeries.Transition>`.

### b. AudioSync v2 fuzzy anchors can mis-map phases — don't blindly --fix
audiosync v2 anchors phases by fuzzy-matching brief text to whisper words +
gap detection. On Scene06 it mis-anchored (common words like "and more" match
early) and proposed sub-150f phases that violate the §19 floor. When phase
durations are derived directly from whisper starts via the §15 formula and the
TSM sum checks out, TRUST THE FORMULA: skip stage 6 with
`pipeline.mjs --from audit` instead of accepting `--fix`'s rewrite.

### c. H3 false positive: `bottom: 0` on IMAGE panels near text styles
H3 flags any `bottom: <216` that has fontFamily/fontSize within ±10 lines —
including full-height image panel containers that contain no text. Use
`top: 0, height: 1080` instead of `top: 0, bottom: 0` for image panels, and
keep text style objects ≥10 lines away from panel style blocks.

### d. Pipeline temp-project path bug — FIXED AT ROOT (2026-07-03)
Pipeline stages 9/10 write a single-scene temp JSON to `<project>/output/` and
call validate.mjs on it; validate derived projectDir from the JSON's dirname →
`output/` has no remotion/ → silently fell back to the SKILL TEMPLATE tree
(stale registry → "Scene not found"). `validate.mjs` and `render.mjs` now
prefer the `projectDir` FIELD inside the project JSON when present. Keep
`"projectDir": "/abs/path"` in every project.json.

### e. Stale stills across runs
`validate.mjs --audit` writes stills next to prior runs' files; after a
duration change the frame numbers differ and OLD stills linger (e.g. a
"Scene not found" still from before the scene was registered). ALWAYS check
still mtimes (`ls -t`) and only review the newest set.

### f. Rich images need hold time — merge worlds across short phases (user-flagged)
A spectacular image on a ~≤180f phase "is cut short too quickly, doesn't get
time for registering in audience mind." When a rich new image lands on a short
whisper-pinned phase, carry it through the ADJACENT phase as a continuity
world: the next phase renders its text/content over the same image with the
camera move continuing (end state = next start state). Durations never change
— only the background persists. Switch visuals on short phases only when both
neighbours are already image-rich.

Corollary (user-flagged, same production): on a SHORT narration-led plate/photo
beat, prefer NO text over a fleeting label. A label that restates the narration
("the missile must chase from behind") on a ~5s beat is §25 text-karaoke with
too little screen time to read anyway — the image and the voice carry it. Drop
the label; let the phase breathe.

### g. Stale-render trap — RENDER "success" can be an old file
`pipeline.mjs` treats RENDER as passed if the output MP4 exists and is >100KB —
but if a hard audit failure blocked the render, the PREVIOUS run's MP4 at the
same path survives and reads as success. After every render, verify the output
file's MTIME is newer than the TSX that was supposed to produce it. (Hit in
the bright re-skin: an H5 failure blocked re-render and July-2 files silently
persisted for three scenes.)

## 47. World-Pinned Labels — Default for Text Over Moving Imagery

Screen-fixed label blocks over a moving image read as two disconnected layers
— the user's "image + text composition too boring" complaint. Labels that name
a thing IN the image must PIN to it: compute screen position from the camera
transform each frame via `plateCameraState()` / `plateToScreen()` (exported by
`IllustratedPlate.tsx`; same math as the render, so pins never drift). Applies
to plates AND photos with camera moves. Screen-fixed text is reserved for UI
(eyebrows, stamps, source lines, counters). See illustrated-plate.md →
"World-Pinned Labels".

## 48. Recurring Subjects Need Reference-Image Chaining

When the same entity appears in multiple scenes (a character, a specific
aircraft, a location), generate its later appearances with ImageGen's
`--reference-image` pointing at the FIRST generated image of it. Continuity of
subjects is felt even when unnoticed; two different-looking "same men"
(S01/S10 bookends) break the callback. Track recurring entities at ontology
time and note the reference chain in the briefs (e.g. "reuse
s01_two_men.png as --reference-image").

## 49. Side-by-Side Splits Are Boring — Integrate, Don't Divide

### User-flagged (July 2026): "split compositions with image on one side and
### text on another — very boring."

The focal-offset / split layout (image column | text panel, straight vertical
divider) is an ARRANGEMENT, not a composition: the image is cropped into a
column, the text floats on dead flat space, and nothing interacts. Demoted
from default status.

### The default replacement: INTEGRATED FULL-BLEED
1. **Generate the image WITH designed negative space** — prompt the subject
   off-centre and demand clear sky / soft shadow / open ground on the side
   where text will live ("subject in right third, vast clear sky upper-left").
   16:9 native — no more cropping 1:1 panels out of it.
2. Run a gentle camera move over the full-bleed image (cam keyframes).
3. Set the composed text block INTO the negative space (scrim chip only if
   contrast demands), and WORLD-PIN any label that names a thing (§47).
The image becomes the environment for the words, not a neighbour.

### When a split IS the story (A-vs-B comparison), make the split itself alive:
- **Diagonal or curved divider** (clip-path), never a straight vertical rule
- **Subject breakout**: the subject crosses the divider (nose of the jet
  overlaps the text side) — cutout layer or generated overlap
- **Animated divider**: the boundary MOVES during the phase as narration
  shifts attention (55/45 → 30/70), text reflowing in choreography
- Panels acknowledge each other: colour echo, connector, shared horizon line

### Hard rule for the §34/feedback-gate review:
A static straight-divider split with a flat text panel is a FAIL unless the
narration is an explicit two-thing comparison AND at least one of the
techniques above is applied.

## 50. Transitions Are a Design Layer — Kill the Black Blink, Vary the Cuts

### User-flagged (July 2026): "transitions are rather abrupt."

Two problems, two fixes:

### a. Scene boundaries: crossfade at concat, never fade-through-black
The RemoxScene wrapper's 5f fade in/out through BLACK makes every scene
boundary a dark blink — a slideshow tell, brutal on bright films.
1. `RemoxScene.tsx` wrapper background must be the film's base colour
   (PALETTE.bg / PALETTE.dark per film mood), never #000 on a bright film.
2. Concat with soft crossfades instead of butt joints:
   `python3 ~/.claude/skills/Remox/scripts/concat_xfade.py out.mp4 <graded scenes...>`
   (12f video dissolve + audio acrossfade per join; the §42 silence tails make
   the audio joins safe). Total duration shrinks by (N−1)×0.4s — fine.
3. Reserve fade-through-black for intentional act breaks only (max 1–2 per film).

### b. Phase boundaries: motivated transitions, not 63 identical fades
All-identical 18f cross-fades read as monotone. Choose per boundary in the
brief, same 18f budget (TSM unchanged):
- **fade** — default for calm narration boundaries
- **wipe, matching camera travel** — if the camera just swept left, wipe left;
  the cut inherits the motion (never contradict the camera's direction)
- **zoom-through** — world→world cuts (push into one image, arrive inside the next)
- **white flash (4f)** — impact beats only, max 2 per scene
- **slide-over** — list/sequence items shoving the previous item out
Rule: a transition should feel CAUSED by what the imagery is doing, not
applied to it. Brief field: `transition_out: wipe-left | fade | zoom | flash | slide`.

## 51. Text Registers Only If It ARRIVES — Land It on the Whisper Beat

### User-flagged (July 2026): stat chip on the opening shot "just never
### registers at all."

The chip was fully on screen by frame ~24 — present while the scene itself was
still entering, and ~3 seconds BEFORE the narration said the number. Text that
is already there when the viewer's eye lands is wallpaper: no entrance, no
attention, no read.

### The rule:
1. **The image establishes ALONE first** — minimum ~1s (30f) of pure imagery
   at every scene open and every new-world phase before any text enters.
2. **Text lands ON its whisper beat** — the frame the narrator says the number
   or name is the frame the text's kinetic entrance fires (count-up, scale
   settle). The motion onset at the spoken moment is what captures the eye.
   Entering early pre-empts the beat; entering late orphans it.
3. **If on-beat entry leaves the text <2s of hold**, skip its exit fade and
   let the phase cross-fade take it out — visibility comes from the tail, not
   from entering early.
4. Applies doubly to Phase 1 of Scene 1: the film's first seconds carry the
   scene entrance AND the viewer's arrival; nothing textual should compete.
5. **MINIMUM HOLD: 3 seconds (90f) on screen for any text element** (user
   rule, July 2026). If landing exactly on the whisper beat would leave less
   than 90f before the phase ends, enter EARLIER: enterAt = min(beat,
   phaseDur − 90). The minimum hold outranks perfect beat alignment — text
   that arrives on beat but vanishes in 2s registers no better than
   wallpaper.

## 52. Size by ROLE, Not by Floor — Minimums Are Not Defaults

### User-flagged (July 2026), second sizing complaint of the production:
the opening "$1.2 BN" hero stat was authored at 72px — barely above the
statNumber floor — and read as small. Raising floors (§43) fixed illegibility
but created a new failure: agents author AT the floor.

### The rule — choose size by the element's ROLE in the phase:
| Role in the phase | Scale |
|---|---|
| THE payoff of the phase (hero stat, verdict word) | heroStat 140-170px |
| Phase headline / primary statement | 84-124px |
| Secondary stat, callout label | 48-72px |
| Supporting labels/eyebrows/subs | the §43 floors (34-44px) |

The question is never "is it above the minimum?" but "is this the biggest
thing in the phase when it is the most important thing in the phase?" A
phase's single hero element should visually dominate — if the narration beat
IS the number, the number is the composition.

## 53. Broadcast Text Cards — the TV-News Grammar for Image+Text

### User doctrine (July 2026): "Unlike in television programs where a text
### card is almost 70-80% of the screen width in two parts — a caption part
### maybe 20% of element height, and remaining 80% for text — think news
### programs. Otherwise the graphics just look like bad PPT. And even within
### a phase the text can change, like TV news shows."

Small floating chips/labels on an image are PRINT graphics pasted on video.
Broadcast solved image+text long ago: the two-part strap.

### The grammar (component ships in scaffold: src/BroadcastCard.tsx):
- **KICKER tab**: short accent band (~20% of card height), mono caps, brand
  red/accent background — the category/context line
- **MAIN bar**: the dominant text area (~80% of card height), 56-84px heading
  type on a solid bar — the actual statement
- **70-80% of screen width**, anchored lower-left ABOVE the subtitle floor
- **ONE message per card per phase** (user correction, July 2026): a typical
  phase is 5-7s and the card enters 2-3s in — there is no time for strap
  swaps; a swapped text fragments the read and nothing registers. The items[]
  swap API exists but is RESERVED for rare ≥10s phases where every message
  still gets ≥3s of hold. Default: single kicker + single main, held to the
  phase end.

### Usage rules:
- DEFAULT for image+text phases (full-bleed imagery + broadcast card).
  Floating chips are demoted to minor in-image annotations only.
- World-pinned callouts (§47) remain the tool for NAMING things in the image;
  the broadcast card carries the SENTENCE-level message.
- One message per phase. No swaps on normal-length phases (see above).
- Card text follows §52 role sizing: main bar text is the phase's statement —
  size it like one (56-84px; hero numbers can go larger inside the bar).

### §53 reference exemplar — person-introduction phases (user: "brilliant")
PL-15 Scene05 P1 is the canonical person-intro: full-bleed environmental
portrait (pilot + sun-flared visor in the right third, vast open sky as
designed negative space), slow push toward the subject, BroadcastCard with
the person's NAME as the main line landing exactly on the spoken-name beat
("THE FRAMEWORK / Sameer Joshi — ex-IAF Mirage pilot", 4s hold). When a
script introduces a person, author the phase to this pattern.
