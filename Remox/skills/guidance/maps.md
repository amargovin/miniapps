# Maps — Official Boundaries Must Be Deterministic Vector (canonical for §63)

**Read this before rendering ANY map where national boundaries carry editorial
or legal weight.** This is a high-importance rule. It supersedes, for
official-boundary maps, the general "AI imagery / plates over bespoke vector"
preference (§41): for boundaries, AI is WRONG, and a coded vector from an
authoritative dataset is both more correct AND more editorial.

## The rule

Do NOT rely on AI image/video generation for maps whose boundaries matter.
AI image-gen repeatedly draws disputed, incomplete, or plain wrong borders —
it cannot be prompted into consistent, authoritative boundaries. For any such
map, render a **deterministic VECTOR from an official boundary dataset.**

This applies to India especially, where the border is both legally sensitive
and routinely mis-drawn by generative models.

## India — the full official claim (NON-NEGOTIABLE, §22 + §63)

India's map must show the **complete official territory as one unbroken
landmass**:

- All of Jammu & Kashmir, **including Pakistan-occupied Kashmir (PoK) and
  Gilgit-Baltistan**, as integral Indian territory.
- **Ladakh and Aksai Chin** as integral Indian territory.
- **No Line of Control (LoC) drawn as an international border.** No dotted
  "disputed" lines carving the north into pieces. One continuous national
  outline.

AI generation cannot be trusted to do this (it draws the LoC as a border, drops
PoK/Aksai Chin, or hallucinates the coastline). **Use a coded vector.**

## Workflow — official dataset → vector → verify

1. **Source an authoritative boundary dataset.** Use a Survey-of-India-
   consistent official source. Validated: **datameet/maps**
   `india-composite.geojson` (the composite that renders the full official
   claim). Do NOT use generic world-atlas GeoJSON (Natural Earth etc.) for
   India — those encode the LoC as a border.
2. **Extract the outer ring** for the country (or the region you need),
   **simplify** it to a reasonable vertex count for smooth rendering, and
   render it as an **SVG path / highlight** in the scene (fill + `strokeGlow`
   per motion-doctrine.md, or a filled territory highlight).
   - For coded India SVG outside a full GeoJSON pipeline, the fallback source
     is `atharvvvg/map-india-svg` (viewBox `0 0 1000 1136`,
     `fillRule="evenodd"` for multi-subpath) — confirm it carries the full
     claim before use (editorial-design.md → "Map Accuracy").
3. **Verify by reading a TIGHT CROP of the boundary region from the ACTUAL
   rendered frame.** Do not eyeball the whole map — cut a crop over the
   northern boundary (J&K / Ladakh / Aksai Chin) and Read it (see
   pipeline-traps.md / producer.md → image verification: downscale big
   originals first, then read a tight crop). Confirm: PoK and Gilgit-Baltistan
   included, Aksai Chin included, no LoC line, one unbroken outline.

## Why vector wins here

- **Correctness:** a checked-in official dataset is deterministic — it renders
  the same authoritative boundary every time, with no generative drift.
- **Editorial quality:** a clean animated territory highlight (draw-on outline,
  fill sweep, glow) reads as authored and precise — MORE editorial than a
  photoreal AI map, not less. This is the one place bespoke vector beats a
  plate.

For any OTHER country where its specific shape carries editorial weight, apply
the same standard: official SVG path data, verified — never approximate, never
AI-generated (editorial-design.md → "Map Accuracy"; video-gen.md → "Geography
and Real-World Settings").
