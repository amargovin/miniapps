# Sound Design — Audio Beyond Voiceover

Sound effects make motion graphics feel physical. A whoosh on
a slide-in, an impact on a stat reveal, ambient texture under
a factory scene — these turn visuals into experiences.

## How Remotion Handles Audio

Remotion mixes all `<Audio>` components automatically during
render. Multiple audio sources play simultaneously. No manual
mixing step needed.

```tsx
import { Audio, Sequence } from "remotion";
import { staticFile } from "remotion";
import { interpolate } from "remotion";

// SFX at frame 45, 50% volume, 0.3s fade-out
<Sequence from={45}>
  <Audio
    src={staticFile("sfx/whoosh.mp3")}
    volume={(f) => interpolate(f, [0, 9], [0.5, 0], {
      extrapolateRight: "clamp",
    })}
  />
</Sequence>
```

Key facts:
- `<Audio>` inside `<Sequence from={N}>` starts at frame N
- `volume` can be a callback: `(f) => number` where f=0
  when the audio starts, NOT the global frame
- `trimBefore` / `trimAfter` (frames) trim the source file
- `renderMedia` mixes all tracks via FFmpeg automatically
- Voiceover is already in the scene via the project pipeline
  — SFX layer on top of it

## SFX Categories for Motion Graphics

| Category | When to Use | Examples |
|----------|------------|---------|
| **whoosh** | Element slides in/out, camera pan | air-whoosh, soft-swipe, fast-pass |
| **impact** | Stat lands, element slams into place | thud, punch, bass-hit |
| **rise** | Building tension, counter climbing | tonal-rise, pitch-sweep-up |
| **reveal** | Unveiling, unmasking, arc-wipe | shimmer, sparkle, chime |
| **ambient** | Background texture for environment | factory-hum, wind, static |
| **transition** | Between phases in a scene | tape-stop, glitch, reverse-cymbal |
| **click** | Small UI-like moments, tick marks | soft-click, mechanical-tick |

## SFX Philosophy

One well-timed whoosh beats three competing sounds. Use SFX
to punctuate moments, not to fill silence. editorial-clean
videos lean toward fewer effects; cinematic-dense can use
more freely.

## Ontology Integration

Each scene in `ontology.yml` can specify sound design:

```yaml
scenes:
  - id: Scene01
    # ... existing fields ...
    sound_design:
      - sfx: whoosh
        trigger: entrance    # entrance | impact | transition | ambient
        trigger_frame: 45    # exact frame, or omit for auto-sync
        volume: 0.5
      - sfx: impact
        trigger: impact
        trigger_frame: 120
        volume: 0.7
```

### Trigger Types

| Trigger | Auto-Sync Behavior |
|---------|-------------------|
| `entrance` | Sync to first element's spring entrance start |
| `impact` | Sync to stat reveal or key object landing frame |
| `transition` | Sync to `<Series.Sequence>` boundary |
| `ambient` | Starts at frame 0, loops, low volume (0.1-0.3) |

When `trigger_frame` is omitted, the code generator should
calculate it from the animation timing in the scene's moves.

## SFX Assignment Rules

During ontology conversion (Step 0), assign SFX based on:

| Scene Characteristic | Default SFX |
|---------------------|-------------|
| Hero scene with stat reveal | impact on landing frame |
| Element entrance (spring-in) | whoosh synced to entrance |
| Phase transition (`<Series>`) | transition at boundary |
| Tension build (rising counter) | rise, starting soft |
| Environmental scene (factory, port) | ambient at 0.15 volume |
| Connective / simple text | none — let it breathe |

**Default: no SFX.** Only add when the sound reinforces the
visual beat. Silent scenes are not incomplete — they create
contrast that makes the next SFX-enhanced scene hit harder.

## Implementation in Scene Code

### Pattern: SFX synced to spring entrance

```tsx
import { Audio, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { interpolate, spring, staticFile } from "remotion";
import { PALETTE, FONTS, MOTION } from "../theme";

const Scene01: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Visual: element enters at frame 30
  const enterProgress = spring({
    frame: frame - 30,
    fps,
    config: MOTION.springSnappy,
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      {/* Voiceover is handled by the project pipeline */}

      {/* SFX: whoosh synced to entrance */}
      <Sequence from={30}>
        <Audio
          src={staticFile("sfx/whoosh.mp3")}
          volume={0.4}
        />
      </Sequence>

      {/* Visual element */}
      <div style={{
        transform: `translateX(${interpolate(enterProgress, [0, 1], [-200, 0])}px)`,
        opacity: enterProgress,
      }}>
        {/* ... */}
      </div>
    </AbsoluteFill>
  );
};
```

### Pattern: Impact on stat reveal

```tsx
{/* Stat counter lands at frame 90 */}
<Sequence from={90}>
  <Audio
    src={staticFile("sfx/impact.mp3")}
    volume={(f) => interpolate(f, [0, 15], [0.7, 0], {
      extrapolateRight: "clamp",
    })}
  />
</Sequence>
```

### Pattern: Ambient texture (looped, low volume)

```tsx
{/* Factory ambient — loops entire scene */}
<Audio
  src={staticFile("sfx/factory-hum.mp3")}
  loop
  volume={0.15}
/>
```

### Pattern: Phase transition sound

```tsx
{/* Transition whoosh between Series phases */}
<Sequence from={phaseOneDuration - 5}>
  <Audio
    src={staticFile("sfx/transition-tape-stop.mp3")}
    volume={0.5}
  />
</Sequence>
```

## SFX File Management

### Directory Structure

```
project-dir/
├── audio/           # Voiceover files (existing)
│   ├── scene_01.mp3
│   └── scene_02.mp3
└── sfx/             # Sound effects library
    ├── whoosh.mp3
    ├── impact.mp3
    ├── rise.mp3
    ├── shimmer.mp3
    ├── transition.mp3
    ├── click.mp3
    └── factory-hum.mp3
```

SFX files are placed in the Remotion project's `public/sfx/`
directory so `staticFile("sfx/whoosh.mp3")` resolves correctly.

### Sourcing SFX

**Tier 1 — Pre-curated library (recommended):**
Download CC0 sounds from Freesound.org once per category.
Cache in a shared `sfx/` library. Use `freesound-client` npm
package or raw fetch with `filter=license:"Creative Commons 0"`.

```bash
# One-time setup: search and download CC0 whoosh sounds
curl "https://freesound.org/apiv2/search/text/?query=whoosh&filter=license:\"Creative Commons 0\"&fields=id,name,previews&token=$FREESOUND_API_KEY"
```

**Tier 2 — AI-generated (custom sounds):**
ElevenLabs SFX API for bespoke sounds. Generate once, commit
the MP3. Requires Creator plan ($22/mo) for commercial use.

```bash
curl -X POST "https://api.elevenlabs.io/v1/sound-generation" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"cinematic whoosh","duration_seconds":1.5}' \
  --output sfx/whoosh.mp3
```

**Tier 3 — Bundled defaults:**
Ship a minimal set of 5-7 SFX files with the Remox skill
itself for zero-setup production.

## Volume Guidelines

| SFX Type | Volume Range | Notes |
|----------|-------------|-------|
| whoosh | 0.3-0.5 | Should accent, not dominate |
| impact | 0.5-0.8 | Hero moments can go louder |
| rise | 0.2-0.4 | Gradual, sits under voiceover |
| ambient | 0.1-0.2 | Barely perceptible texture |
| transition | 0.4-0.6 | Brief, punctuating |
| click | 0.2-0.4 | Subtle mechanical feel |

If voiceover is competing with SFX, lower the SFX. Voiceover
always wins. SFX should feel like it's coming from the scene's
environment, not from a separate audio layer.

## FFmpeg Post-Processing Alternative

For adding SFX AFTER rendering (without re-rendering scenes),
use FFmpeg's `adelay` + `amix` in a single pass:

```bash
ffmpeg \
  -i rendered_video.mp4 \
  -i sfx/whoosh.mp3 \
  -i sfx/impact.mp3 \
  -filter_complex "
    [1:a]adelay=delays=2000:all=1,volume=0.5[sfx1];
    [2:a]adelay=delays=5500:all=1,volume=0.7[sfx2];
    [0:a][sfx1][sfx2]amix=inputs=3:duration=first:normalize=0
  " \
  -c:v copy -c:a aac -b:a 192k output.mp4
```

- `adelay=delays=Nms:all=1` places SFX at timestamp N
- `volume=X` sets level before mixing
- `normalize=0` prevents auto-volume reduction
- `-c:v copy` skips video re-encoding (fast)

Use this approach when:
- SFX timing needs adjustment without re-rendering
- Adding transition sounds at scene boundaries during concat
- Layering ambient tracks across the full video
