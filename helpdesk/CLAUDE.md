# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file Bun web app for triaging Swarajya / Kovai Media helpdesk tickets. An operator logs in, fetches open tickets, runs them through Claude for rule-based classification, reviews the suggestions, and executes the chosen actions (tag, escalate, reply, close) back against the helpdesk API.

There are **two parallel implementations** in this repo, each a self-contained `server.ts`:

- `server.ts` (repo root) — current implementation, talks to **LibreDesk** (self-hosted). This is what deploys.
- `freshdesk/server.ts` — older implementation against **Freshdesk** SaaS, kept for reference / fallback. Same shape, different API surface.

When asked to change "the helpdesk app", default to editing the root `server.ts` unless the user names Freshdesk explicitly.

## Run / deploy

```bash
bun run server.ts        # local dev, default port 3847
bun start                # same, via package.json
```

Deployment is Railway via Nixpacks (`nixpacks.toml` + `railway.toml`). Healthcheck is `GET /health` — it returns `{status: "degraded", missing: [...]}` rather than failing, so deploys can come up before env vars are set and the app returns 503 on real routes until configured. `Dockerfile.disabled` is a leftover; Railway uses Nixpacks.

There are no tests, no linter, no build step.

## Required env vars

Root (LibreDesk) `server.ts`:
- `LIBREDESK_URL`, `LIBREDESK_API_KEY`, `LIBREDESK_API_SECRET`
- `ANTHROPIC_API_KEY`
- `USERS` — comma-separated `user:password` pairs, e.g. `amar:pass1,raghu:pass2`. This is the login allowlist; sessions are in-memory UUIDs in a `Map`, so they reset on restart.

`freshdesk/server.ts` swaps the LibreDesk vars for `FRESHDESK_API_KEY` and `FRESHDESK_DOMAIN`.

## Architecture

Everything (server, HTML, CSS, client JS) lives inline in one `server.ts`. `Bun.serve` exposes four routes plus `/` and `/health`:

- `POST /api/login` — issues a session cookie
- `GET  /api/tickets?page=N` — pages through helpdesk conversations, enriches each open one with a parsed excerpt of its first incoming message
- `POST /api/triage` — batches tickets in groups of 30 and sends each batch to Claude (`claude-sonnet-4-20250514`) with `TRIAGE_SYSTEM_PROMPT` (the content of `triage-rules.md`, inlined into the source). Parses a JSON array out of the response.
- `POST /api/execute` — runs the chosen actions against the helpdesk API

The triage rules in `triage-rules.md` are the **product logic**. The file isn't read at runtime — its contents are duplicated into `TRIAGE_SYSTEM_PROMPT` in `server.ts`. If you change the rules, change both, or wire one to read the other.

### Action types

`ActionType = "escalate_both" | "escalate_amar" | "forward_drafts" | "close" | "leave"`. Each maps to a specific sequence of LibreDesk API calls in `handleExecute` (server.ts:376) — typically: post a private note, post a forward/reply, reassign to Amar's agent ID (looked up once by email and cached in `cachedAmarAgentId`), and add a tag. `leave` is a no-op-by-design that still adds a tag.

### LibreDesk API quirks worth knowing

- All calls go through `ldApi()` (server.ts:67). Auth is `token <key>:<secret>`.
- 429s are auto-retried up to `MAX_RETRIES` (3) honoring `Retry-After`.
- Responses are wrapped: `{status: "success", data: ...}`. `ldApi` unwraps `data`; list endpoints further unwrap via `extractList()` because the shape varies.
- Conversations are addressed by **UUID** for API calls but referenced by `reference_number` in the UI — keep both on the `TriageTicket` type.
- `parallel(items, CONCURRENCY=5, fn)` is the fan-out helper for message enrichment.

### Frontend

The `appPage()` and `loginPage()` template literals return the full HTML. UI state lives in module-level vars in the inline `<script>` block: fetched tickets, triage suggestions, per-row user overrides. The flow is three phases: Fetch → Triage → Execute, each with its own button and progress bar.

## Conventions

- Single-file by design. Don't split `server.ts` into modules unless the user asks — the whole point is one deployable file.
- New helpdesk action types need a branch in `handleExecute` **and** a corresponding rule + tag in `triage-rules.md` (and the inlined `TRIAGE_SYSTEM_PROMPT`).
- The agent referenced for escalations is hardcoded to `amar@swarajyamag.com` (server.ts:131). If escalations need to route elsewhere, that lookup is the place.
