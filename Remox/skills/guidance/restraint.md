# Aesthetic Guide

Visual taste for Remox productions. These are sensibilities,
not hard rules. Use your creative judgment.

## Palette

Choose a palette preset in `ontology.yml` and let it guide
the entire video. Consistency across scenes is what makes a
video feel authored rather than assembled.

- **editorial** — muted tones, desaturated accents, warm grays.
  Feels like a quality publication.
- **dark-cinematic** — deep backgrounds, high-contrast accents,
  moody lighting. Feels like a film.
- **vibrant** — saturated colors, bold contrasts, energetic.
  Feels alive and urgent.
- **muted** — pastel-leaning, soft contrast, gentle. Feels
  contemplative and calm.
- **monochrome** — single hue family with value variation.
  Feels focused and intentional.

**Color flow:** Plan how palette emphasis shifts across scenes.
A warm → cool → warm arc gives the video emotional movement.
Note this in `ontology.yml`'s continuity section.

**Per-scene emphasis:** Each scene should lean on 2-3 colors
from the palette, not use all of them equally. Variety comes
from which colors dominate, not from adding new ones.

## Typography

Typography is a visual element, not just content delivery.

- **Font pairing:** One heading family, one body family. That's
  enough. Consistency across scenes matters more than variety.
- **Scale as hierarchy:** Use size to show importance. A hero
  stat should be dramatically larger than supporting text.
  Let scale do the work — you rarely need bold AND large AND
  colored.
- **Generous line-height:** Give text room to breathe. Cramped
  text looks like a document, not motion graphics. 1.4x minimum.
- **One text animation at a time:** When text is entering,
  give it the stage. Don't animate two text blocks simultaneously
  — the eye can't read both.

## White Space

White space is a feature, not wasted pixels.

- Let elements breathe. If the frame feels full, it probably is.
- The focal element needs clear space around it to draw the eye.
- An empty frame with one powerful object beats a crowded frame
  with five competing objects.
- Negative space creates rhythm — the visual equivalent of a
  musical rest.

## Pacing & Phases

Phases (via `<Series>`) are a structural tool for sequencing
visual ideas within a scene. Use them when a scene has multiple
distinct visual beats.

- **Phase isolation:** Each phase fully replaces the previous.
  Don't layer phases with opacity overlaps — use `<Series>` for
  clean handoffs.
- **One idea per phase.** Each `<Series.Sequence>` presents one
  visual thought. A stat and a quote are two ideas — give them
  separate phases.
- **Natural rhythm:** ~4-5 seconds per visual beat feels right
  for motion graphics. Shorter feels rushed, longer feels static.
  But follow the content — a dramatic reveal might hold longer,
  a quick transition might be shorter.

## Motion

- **Stagger entrances.** Let one element settle before the next
  enters. This creates a reading order and prevents visual chaos.
- **Spring physics for organic motion.** Springs feel natural.
  Linear easing feels mechanical. Use springs from
  `spring-physics.md` for entrances and transitions.
- **Ambient life:** Gentle micro-animations (opacity breathe,
  slow drift) make static frames feel alive without competing
  for attention.

## Sound

Sound reinforces visual beats — it doesn't compete with them.
Default is silence. Add SFX only when it makes the moment land
harder. Voiceover always wins over SFX.

See `sound-design.md` for categories and implementation.

## The Only Real Rule

Every element on screen should earn its place. If you can
remove something and the scene still works, remove it.
