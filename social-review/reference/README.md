# Reference material — read-only, do not import from here

These files came from the manual process this service replaces (a claude.ai
`weekly-social-review` skill). They are the source for the port in build-order step 5,
not runtime code.

- `build_deck.py` — the existing renderer. Port its **visual system** (palette, paragraph
  styles, table helper, page furniture, `--verify` link/page checks) into `app/`. The
  full multi-slide layout it renders is NOT the target — the target is the four-slide
  layout in `build_short.py` / RAILWAY_BRIEF.md §8.
- `build_short.py` — the four-slide layout to port (one week-on-week slide + three
  appendices). Note it imports build_deck.py's style helpers via a hardcoded skill path
  (`/root/.claude/skills/...`) — in the port, both live in one module inside `app/`, so
  drop that importlib shim entirely.
- `aggregate.py` — the metric arithmetic the skill used. Cross-check against §6, which is
  authoritative where they differ.
- `metrics.md`, `narrative-schema.md` — the skill's own documentation of metric
  definitions and the narrative JSON the old renderer consumed.

Where `build_short.py` and the brief's §8 disagree, §8 wins.
