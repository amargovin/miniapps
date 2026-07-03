# Style: editorial-clean (DEFAULT)

One focal element per phase rendered large. Typography as
the star. White space is generous. The video breathes.

## Character

- Clean, restrained, publication-quality feel
- Typography does the heavy lifting
- Generous negative space — let elements breathe
- Staggered entrances with comfortable holds between them
- One idea per phase, one focal element per phase

## Palette Tendency

Leans toward muted tones, desaturated accents, warm grays.
But follows the palette preset chosen in `ontology.yml`.

## Phase Structure

Multi-phase scenes use `<Series>` for clean handoffs. Each
phase is a complete visual — a new composition every ~4-5
seconds. Phase 1 disappears entirely before Phase 2 appears.

## When to Use

- Documentary-style explainers and visual essays
- Long-form content (2+ minutes) where pacing matters
- Data journalism and editorial storytelling
- Any project where clarity > spectacle

## Activation

This is the default style. If `ontology.yml` has no `style`
field, editorial-clean is assumed.

```yaml
project:
  style: editorial-clean  # or omit — this is the default
```
