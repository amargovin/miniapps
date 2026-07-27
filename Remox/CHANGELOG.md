# Remox — Changelog

Check your installed version: `cat ~/.claude/skills/Remox/VERSION`
(or read `version:` in SKILL.md's frontmatter).

## 1.0.0 — 2026-07-09

First formally versioned release. Highlights of the accumulated state:

- **Production learnings folded in (LEARNINGS §56–§68):** image specificity;
  no AI likenesses of real people; montage pacing floor (~3s holds, slow eased
  directional slides, no white cut-flashes); solid-chip (not soft-scrim) text
  contrast; bronze-on-cream fails → `accentInk`; size-by-role / never a faint
  key stat; never open on an empty frame; official-boundary VECTOR maps;
  data-viz restraint; broadcast show-brand opener with corner-bug suppression;
  transition-overlap phase-duration math; downscale-before-Read image verify;
  edit-for-momentum scene cutting; **OpenRouter provider routing (§68)**.
- **New guidance:** `maps.md` (official-boundary vector maps),
  `providers.md` (OpenRouter routing for Whisper / Nano Banana Pro / TTS).
- **De-bloat:** removed the pre-refactor archive and duplicated tables;
  retired `restraint.md` (folded into `editorial-design.md §11b`); fixed
  self-contradictions in `charts.md` and `transitions.md`; trimmed the
  mandatory-read lists to a lean core + "read when relevant".
- **Providers:** Whisper timestamps and Nano Banana Pro image gen can route
  through a single `OPENROUTER_API_KEY` (Whisper needs an OpenAI-compatible
  model pinned); TTS stays on ElevenLabs for the branded voice.

Distributed as source only — no `node_modules`, no past-production media.
Run `npm install` in `remotion/` after install.
