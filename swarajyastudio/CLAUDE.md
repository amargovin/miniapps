# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this directory is

A reference/asset bundle for Swarajya magazine content work. No build, no tests — just markdown docs and a packaged skill archive. Tasks here are content-production tasks, not software engineering.

Contents:

- `swarajya-studio 0.44.skill` — versioned zip snapshot of the `swarajya-studio` Claude Skill (SKILL.md + foundation/, content/, visual/, editorial/, distribution/, api/ submodules). The same skill is installed and reachable via the `Skill` tool as `swarajya-studio` — use that for any live Swarajya task, including bullet tweet drafting. This file is the archived source, useful for diffing changes or reinstalling.

## When asked for a Swarajya task

Fetching, rewriting in Sharp style, metadata, carousels, infographics, X cards, featured images, newspaper layouts, email generation, bullet tweet drafting, editorial review against Big Read / Explainer standards → invoke the `swarajya-studio` skill rather than re-reading the zipped copy.

## Editing the skill archive

The `.skill` file is a zip. To inspect or modify:

```
unzip -l "swarajya-studio 0.44.skill"          # list contents
unzip -p "swarajya-studio 0.44.skill" swarajya-studio/SKILL.md   # read one file
```

Don't unpack into this directory — it would shadow the installed skill. If a new version is needed, bump the version in the filename (e.g. `0.45`) and rezip from a working copy elsewhere.
