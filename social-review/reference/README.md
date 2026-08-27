# Reference material — read-only, do not import from here

These files came from the manual process this service replaces (a claude.ai
`weekly-social-review` skill). They are the source for the port in build-order step 5,
not runtime code.

- `build_deck.py` — the existing renderer. Port its **visual system** (palette, paragraph
  styles, table helper, page furniture, `--verify` link/page checks) into `app/`. The
  full multi-slide layout it renders is NOT the target — the target is the four-slide
  layout in RAILWAY_BRIEF.md §8.
- `aggregate.py` — the metric arithmetic the skill used. Cross-check against §6, which is
  authoritative where they differ.
- `metrics.md`, `narrative-schema.md` — the skill's own documentation of metric
  definitions and the narrative JSON the old renderer consumed.

**Missing:** the brief (§8) says a `build_short.py` with the four-slide layout was
supplied alongside it. It was not found anywhere on the machine this repo was scaffolded
on. The four-slide layout is fully specified in §8 (slide 1 = week-on-week table, slides
2–4 = top-25 appendices per channel), so implement from the spec, reusing
`build_deck.py`'s visual system. If Amar can locate `build_short.py`, drop it in here
first and port it instead.
