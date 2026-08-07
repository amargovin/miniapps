# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current State

**Phase 1 complete + a Phase-3 observability/quota slice, all verified live** against production Quintype + Claude, deployed on Railway. Built: MCP server (`search_swarajya`/`ask_swarajya` over Streamable HTTP), REST `/api/v1/ask` with grounded Opus synthesis, story-level access control, DB-backed client/token store with bcrypt + admin console (spec §8), per-client rate limiting, structured access logging, **per-request usage metering (`usage_events`) + a usage dashboard + full grant CRUD + monthly-request quota enforcement** (spec §13 Phase 3). Not started: Phase 2 (entities, related-stories, dedup), Phase 3 remainder (collections, OAuth, `/briefing`). Source of truth: `Swarajya_MCP_Production_Specification.md`.

**IndiaBUILD federation (built).** When `INDIABUILD_MCP_URL` is set (full connector URL *including* its secret path — treat the value like a token), the connector re-exports IndiaBUILD's read-only tools (`indiabuild_*`: sectors, capabilities, builders, policies, investors, collections). The server acts as an MCP *client* of that URL (`app/clients/indiabuild.py`, per-call sessions — anyio scoping rules out a shared long-lived one; tools in `app/mcp/indiabuild_tools.py`, registered conditionally in `app/mcp/server.py`), so it inherits IndiaBUILD's suggest-only boundary by construction and never holds its API token. IndiaBUILD's suggestion tools (`propose_topic`/`suggest_page_edit`) are deliberately NOT re-exported. Unset = pure Swarajya surface. Grounding rule unchanged: indiabuild data is tool-surface only, never blended into `ask` synthesis.

Usage nuance: server-side LLM tokens are metered only on synthesis paths (REST `/ask`, `ask_swarajya`-with-synthesis); raw-source MCP calls meter requests/sources only (the LLM tokens are on the caller's account). Quota unit is **requests/calendar-month**, enforced in the gateway (429 `monthly_quota_exceeded`); blocked requests are not metered.

### Commands

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set ANTHROPIC_API_KEY + ADMIN_API_KEY
uvicorn app.main:app --reload   # MCP at /mcp, REST at /api/v1/ask, admin at /admin
pytest                          # needs: pip install pytest pytest-asyncio
pytest tests/test_auth.py -q    # single file
```

Endpoints: `/mcp` (connector URL), `POST /api/v1/ask`, `GET /admin` (admin console, `X-Admin-Key`), `GET /health`. Set `DISABLE_AUTH=true` for local testing without tokens.

### Deployment (Railway)

Live on Railway project **`mcp`** (service `mcp` + a `Postgres` service): `https://mcp-production-2fe5.up.railway.app`. Deployed via `railway up` (Nixpacks, Python 3.12). Config: `railway.json` (start command, 1 replica), env vars set on the service (`DATABASE_URL=${{Postgres.DATABASE_URL}}`, `ANTHROPIC_API_KEY`, `ADMIN_API_KEY`, `PUBLIC_BASE_URL`, `DISABLE_AUTH=false`). `app/db.py` normalizes Railway's `postgresql://` → `postgresql+asyncpg://`.

**Gotcha that bit us:** MCP's DNS-rebinding protection rejects a proxy's Host header with **421 "Invalid Host header"**. `app/mcp/server.py` disables it by default (public token-authed server behind a proxy); set `MCP_ALLOWED_HOSTS` to re-enable host-locking. Keep `numReplicas: 1` (in-process rate limiter + MCP session state).

## What This Is

**Swarajya MCP** is a content intelligence layer over Swarajya's Quintype-powered content archive. The primary surface is a **remote Model Context Protocol (MCP) server**: clients add it by URL as a connector in their own Claude (Desktop / claude.ai / Code), ChatGPT, Cursor, etc., and their model calls its tools. A secondary REST surface serves the Swarajya website. Everything is grounded **exclusively in published Swarajya content** with mandatory citations and access control.

This is the actual MCP wire protocol — the server side of MCP — **not** the Anthropic API and **not** a plain REST API. Build it with the MCP server SDK (`mcp` / `FastMCP`), not by hand.

It is explicitly a full-scale product, not an MVP, to be delivered in three phases (see spec §13).

## Architecture (the core idea)

A **pure orchestrator** (smart, not a thin search proxy) sits behind **two transport adapters**. The orchestrator does retrieval + access control + context curation and is reused by both:

```
Core orchestrator (Quintype retrieval → access control → context curation)   ← transport-agnostic library
  ├── MCP adapter   (FastMCP, Streamable HTTP over HTTPS)   tools: search_swarajya / ask_swarajya
  └── REST adapter  (FastAPI, POST /api/v1/ask)             the Swarajya website
```

Retrieval flow inside the orchestrator:

```
query → /api/v1/advanced-search (Quintype)   # primary retrieval
      → /api/v1/stories/{id} (Quintype)       # enrich top N, read access level
      → [Phase 2+] entities, related-stories, collections
      → curate access-controlled, cited context
```

**Where synthesis happens differs by surface — this is a deliberate split:**
- **MCP tools** return curated, access-controlled **source material with citations**. The connecting client's own model writes the answer. No server-side LLM call (cheaper, more idiomatic for MCP). An optional `ask_swarajya` tool *can* return full synthesis if a connector wants it.
- **REST `/api/v1/ask`** returns **finished synthesis** — there is no client model on the website, so the server calls Claude itself (see Stack). This is the path that needs the grounding system prompt and the `{ synthesis, sources[] }` shape.

### Layout (as built)

```
app/
  main.py            # FastAPI app: lifespan (DB init + MCP session mgr), gateway, mounts
  config.py          # env-driven Settings (pydantic-settings)
  schemas.py         # Source, Ask*, admin DTOs
  util.py            # strip_html, ms_to_date, utcnow (naive UTC helper)
  auth.py            # GatewayMiddleware: bearer auth + rate limit + access log (pure ASGI)
  ratelimit.py       # per-client fixed-window limiter (in-process; Redis = scale path)
  security.py        # token gen/parse + bcrypt hashing
  db.py / models.py  # async SQLAlchemy engine + Client/ClientToken tables
  clients/
    quintype.py      # advanced_search + get_story
    llm.py           # Anthropic synthesis — REST path only
  services/
    orchestrator.py  # CORE, transport-agnostic: retrieve → access-control → curate → synthesize
    tokens.py        # client/token store ops (create/verify/revoke/deactivate)
  mcp/server.py      # FastMCP tools (Streamable HTTP)
  routers/
    ask.py           # REST /api/v1/ask + /health
    admin.py         # /admin console + /admin/api/* (X-Admin-Key)
  runtime.py         # process-wide singletons (settings, orchestrator)
prompts/synthesis_system.txt
tests/
```

Keep the orchestrator free of any FastAPI/MCP imports — both adapters call into it, neither owns it. The gateway is **pure ASGI** (not `BaseHTTPMiddleware`) so it never buffers the MCP SSE stream.

## Two non-negotiable constraints

1. **Grounding + citations.** LLM output must be grounded strictly in the retrieved articles — never general knowledge. Every claim cites a source (Headline + Date + URL). The system prompt lives in `prompts/synthesis_system.txt` and is versioned.

2. **Story-level access control.** Always honor Quintype's `access` field / `AccesstypeStoryAttributes`. Never return full content or synthesis from premium stories to clients not entitled to them. This applies regardless of authentication.

## Quintype API — authoritative reference

The definitive reference for every endpoint, parameter, and response schema is the live Swagger 2.0 spec:

**`https://quintype-demo.quintype.io/swagger.json`**

Consult it directly rather than guessing at parameters or response shapes. Primary endpoints: `advanced-search` (search), `stories/{id}` and `stories-by-slug` (retrieval), plus `related-stories`, `entities`/`entity/{id}`, and `collections/{slug}` for later phases.

## Stack

- **MCP server: `mcp` (official Python SDK) / `FastMCP`** — this is the primary surface. Serve over the **Streamable HTTP** transport (the current remote-MCP standard; `stdio` is local-only, HTTP+SSE is superseded) at an HTTPS URL clients add as a connector. FastMCP can run standalone or mount into the FastAPI app — mount it (single deploy, single auth layer) since the website REST surface also exists.
- **HTTP app: FastAPI + Uvicorn (async)**, Pydantic v2, `httpx` (async HTTP) — hosts the website's `POST /api/v1/ask` and the mounted MCP endpoint. Good fit for the async I/O fan-out to Quintype.
- **LLM: only on the REST synthesis path.** Anthropic Claude via the `anthropic` SDK, default model **`claude-opus-4-8`** (1M context fits more retrieved stories; strong at cited synthesis), env-configurable (`LLM_MODEL`). MCP tools that return raw sources need no server-side LLM call. Read the `claude-api` skill before writing LLM code — model IDs/API shapes drift (Opus 4.8: `thinking: {type: "adaptive"}`, never `budget_tokens`; sampling params 400).
- All external services, models, and limits are **environment-driven only** (spec §7, but use `LLM_MODEL=claude-opus-4-8`, not the spec's stale `claude-3-5-sonnet`). No hardcoded config.

## Auth model (Phase 1)

**Built (spec §8).** DB-backed `clients` + `client_tokens` (SQLAlchemy async; SQLite default, Postgres via `DATABASE_URL`). Tokens are `swj_<token_id>.<secret>`: `token_id` is the indexed plaintext lookup key, `secret` is bcrypt-hashed (the secret is never stored). This reconciles "strong hashing" with O(1) lookup — bcrypt's per-row salt makes the hash non-indexable, so we index the id and bcrypt-verify the secret. bcrypt rounds=10 is deliberate (secret is 256-bit random; one verify/request keeps revocation immediate with no token cache). The `/admin` console + `/admin/api/*` (gated by `ADMIN_API_KEY`) create clients, issue tokens (shown once), revoke, deactivate. Per-client rate limiting (`ratelimit.py`) keys off the verified client.

**Per-subscriber URLs (interim, built).** Because Claude.ai/ChatGPT connector UIs won't let a user paste an `Authorization` header (both require OAuth or nothing — verified July 2026), the gateway also accepts the token in the **path**: `/s/<token>/mcp` (or `/s/<token>/api/v1/ask`). It verifies the token, then rewrites the scope to strip the prefix so routing continues. Grants carry a `kind` (`generic`/`email`/`domain`) + `subject` — e.g. a `domain` grant for `varaheanalytics.com` is one shared URL for that org. Each grant has `allow_premium`; the verified grant is put in a `ContextVar` (`app/context.py`) that the stateless MCP tools read (`allow_premium()`), so premium entitlement flows into access control per subscriber. In URL-only mode `subject` is recorded intent (the URL is the credential); it becomes *enforced* against a verified email once OAuth lands.

**Provisioning webhook (built).** `POST /provision/groups` mints a group + access URL(s) in one machine-to-machine call — for a billing system / CRM / the Swarajya PRO sales flow to hit right after a purchase, instead of an admin clicking the console. Auth is a **separate bearer token** from env (`PROVISION_API_KEY`, sent as `Authorization: Bearer <key>`; distinct from `ADMIN_API_KEY` and from client tokens). It lives at `/provision/*` — deliberately outside `/api` and `/mcp` so the client `GatewayMiddleware` leaves it alone; it does its own auth (`app/routers/provision.py`). Body: `group` (name) **or** `group_id` (extend an existing group), optional `seats` (URLs to mint), `label`, `contact_email`, `rate_limit_per_minute`, `monthly_request_quota`, `expires_in_days`. Returns `{group_id, access_url, access_urls[], ...}`.

**Still open — OAuth for consumer connectors.** For non-technical subscribers adding the server in the **Claude.ai / ChatGPT** app UIs, **OAuth 2.1 is mandatory** (static bearer/path tokens are the interim, and only truly clean for Claude Code / API / programmatic clients). Planned provider: **Auth0** (social + email-link + lazy-migrated Firebase passwords), with **Substream** entitlement stamped as a `premium` claim → maps to the same `allow_premium`. Firebase (their current login: social, email-link, password) gets consolidated into Auth0 (no passwords-only-blocker; verify Substream keys by email vs Firebase UID). This is the main Phase-1.5 follow-up.

## When implementing

- Read the relevant section of `Swarajya_MCP_Production_Specification.md` before building a feature — it defines phase boundaries and success criteria.
- Build Phase 1 (core `ask` + auth + grounding) before adding Phase 2 intelligence (entities, related stories). Don't pull forward later-phase complexity.
