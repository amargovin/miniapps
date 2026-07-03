# Video Generation — Grok Pipeline

Reference for generating AI video clips via xAI's `grok-imagine-video` model for Remox productions.

---

## API Overview

**Model:** `grok-imagine-video`
**Base URL:** `https://api.x.ai/v1`
**Auth:** `XAI_API_KEY` from `.env`
**Specs:** Up to 15s, 720p, 16:9

---

## Async Workflow

Generation is a three-step async process — submit, poll, download.

### 1. Submit Job

```
POST https://api.x.ai/v1/videos/generations
Authorization: Bearer $XAI_API_KEY
Content-Type: application/json

{
  "model": "grok-imagine-video",
  "prompt": "...",
  "duration": 6,
  "aspect_ratio": "16:9",
  "resolution": "720p"
}
```

Response returns a `request_id` (may also be keyed as `id`).

### 2. Poll Until Complete

```
GET https://api.x.ai/v1/videos/{request_id}
Authorization: Bearer $XAI_API_KEY
```

Poll every 10s. Terminal statuses: `done` / `completed` / `succeeded` → proceed. `failed` / `error` / `cancelled` → abort. Timeout after 300s.

### 3. Download MP4

Extract the download URL from the response — check keys in order: `url`, `video_url`, `output.url`, `video.url`. Stream-download to the output path.

### Script Reference

Full implementation: `~/.claude/skills/varnam/scripts/video_gen.py`

Usage:
```bash
python video_gen.py \
  --prompt "Aerial shot of a factory at dusk" \
  --duration 6 \
  --output public/video/s02_factory_aerial.mp4
```

Flags: `--duration` (1–15), `--aspect` (default 16:9), `--resolution` (720p/480p), `--timeout` (default 300), `--retries` (default 1).

The script also validates with `ffprobe` and writes a `.meta.json` sidecar.

---

## File Naming

```
public/video/s{scene_number}_{description}.mp4
```

Examples:
- `public/video/s01_city_timelapse.mp4`
- `public/video/s03_factory_floor.mp4`
- `public/video/s07_aerial_coast.mp4`

Use lowercase, underscores, keep descriptions short (2–3 words).

---

## Remotion Integration

### Basic Usage

```tsx
import { OffthreadVideo, staticFile } from 'remotion';

<OffthreadVideo
  src={staticFile('video/s01_city_timelapse.mp4')}
  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
/>
```

### VideoBg Wrapper Component

Use this for full-bleed scene backgrounds. Drop in `src/components/VideoBg.tsx`.

```tsx
import { OffthreadVideo, staticFile } from 'remotion';

const VideoBg: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) => {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <OffthreadVideo
        src={staticFile(src)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.45) 100%)' }} />
    </div>
  );
};

export default VideoBg;
```

Scene usage:
```tsx
<VideoBg src="video/s01_city_timelapse.mp4" />
```

The radial gradient vignette is baked in — no need to add it separately.

---

## Editorial Filter

Apply this CSS filter on the `OffthreadVideo` (or pass via `style` prop) for a consistent editorial look:

```tsx
style={{
  filter: 'grayscale(0.3) contrast(1.1) brightness(0.9)',
}}
```

This desaturates slightly, adds punch, and dims — matches the Remox restrained editorial aesthetic without going full black-and-white.

---

## Best Practices

**One clip per phase.** Do not reuse the same video file across three or more phases. Each phase that uses a video background should have its own distinct clip. If you run out of unique clips, generate another rather than repeat.

**Prompt style must match ontology.** The `backdrop_prompt_style` field in the ontology defines the visual register — sparse, specific, grounded. Write video prompts in that same style. Avoid generic stock-footage language ("business people meeting"). Prefer specific, textured images ("Close-up of hands sorting mail in a post office, warm fluorescent light, 1970s").

**Duration guidance:**
- 5–8s: Most scene backgrounds (loops cleanly within a typical phase duration)
- 10–15s: Only for phases with long dwell time or explicit slow-burn intent

**Aspect ratio:** Always 16:9 for Remotion compositions at 1920x1080.

**Resolution:** Always 720p. 480p only as fallback if 720p generation fails.

**Layering order:** `VideoBg` sits at z-index 0. All content layers above it. The built-in vignette handles edge darkening — don't add a separate overlay unless you need a heavier color grade.

**No audio from generated clips.** `OffthreadVideo` may carry audio; set `muted` if the clip has any, or ensure the prompt doesn't imply audio-critical content.

---

## Geography and Real-World Settings

**AI video is unreliable for specific geography.** Never rely on Grok
for specific geographic locations, recognizable country shapes,
named landmarks, or real-world settings where accuracy is required.
AI will hallucinate geography — generating, for example, India as an
island, or a coastal city that looks nothing like its real counterpart.

When a scene requires location-specific visuals, use instead:
- **Real footage** — download via yt-dlp from YouTube (check license)
- **AI-generated images** — more controllable than video; review before use
- **Abstract/symbolic representations** — trade flow lines, map outlines
  in SVG, typographic place names without photorealistic geography

This applies equally to specific buildings, infrastructure, equipment,
and branded objects. If accurate depiction matters, don't use generative
video.
