# Swarajya MCP

A content intelligence layer over Swarajya's Quintype archive. The primary
surface is a **remote MCP server** that clients add by URL as a connector in
their own Claude / ChatGPT / Cursor; a secondary REST surface serves the
Swarajya website. All answers are grounded **only** in published Swarajya
content, with citations and story-level access control.

See `Swarajya_MCP_Production_Specification.md` for the full spec and `CLAUDE.md`
for architecture notes.

## Architecture

```
Core orchestrator (Quintype retrieval → access control → context curation)
  ├── MCP adapter   (FastMCP, Streamable HTTP)   tools: search_swarajya / ask_swarajya
  └── REST adapter  (FastAPI, POST /api/v1/ask)  the Swarajya website
```

- **MCP tools** return cited *source material*; the connecting client's model
  writes the answer (no server-side LLM call).
- **REST `/api/v1/ask`** synthesizes server-side with Claude (the website has no
  model of its own) and returns `{ synthesis, sources[] }`.

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set ANTHROPIC_API_KEY for the /ask synthesis path
uvicorn app.main:app --reload
```

- MCP endpoint:  `http://localhost:8000/mcp`
- REST ask:      `POST http://localhost:8000/api/v1/ask`  (`{"query": "...", "limit": 6}`)
- Health:        `GET http://localhost:8000/health`

### Auth (Phase 1)

Generate a token and store its **hash** (never the token) in `.env`:

```bash
TOKEN=$(openssl rand -hex 32); echo "give clients: $TOKEN"
printf '%s' "$TOKEN" | shasum -a 256     # put the digest in API_TOKEN_SHA256
```

Clients then send `Authorization: Bearer $TOKEN`. Leaving `API_TOKEN_SHA256`
empty disables auth (local dev only).

> Phase-1 scaffold caveats: the spec (§8) calls for DB-backed clients +
> bcrypt/Argon2 + an admin UI, and end-user MCP connectors really want
> **OAuth 2.1**. The env-based bearer list stands in for both — replace before
> exposing publicly.

### Connecting from Claude

A remote connector needs a public HTTPS URL — for local testing, expose
`localhost:8000` via a tunnel (e.g. `cloudflared` / `ngrok`) and add the
`https://<tunnel>/mcp` URL as a custom connector. Confirm the current connector
auth flow against MCP + Claude docs before relying on bearer-token auth.

## Test

```bash
pip install pytest pytest-asyncio
pytest
```

## Deploy on Railway

The project `mcp` already exists and this directory is linked to it. Steps to go live:

```bash
# 1. Add a Postgres database (ephemeral SQLite would lose grants on every deploy)
railway add --database postgres

# 2. Set env vars (or use the Railway dashboard → Variables)
#    DATABASE_URL: reference the Postgres service; the app normalizes the driver.
railway variables --set "DATABASE_URL=\${{Postgres.DATABASE_URL}}"
railway variables --set "ANTHROPIC_API_KEY=sk-ant-..."     # your ROTATED key
railway variables --set "ADMIN_API_KEY=$(openssl rand -hex 24)"
railway variables --set "DISABLE_AUTH=false"

# 3. Deploy
railway up

# 4. Give it a public HTTPS URL, then set PUBLIC_BASE_URL to match
railway domain
railway variables --set "PUBLIC_BASE_URL=https://<your-domain>"   # rebuilds subscriber URLs correctly
```

Notes:
- Start command (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`) and Python 3.12 are pinned in `railway.json` / `.python-version`.
- Tables auto-create on first boot (`init_db()`); for schema *changes* on an existing DB, add Alembic (create_all won't alter existing tables).
- The rate limiter and MCP session state are in-process — keep `numReplicas: 1`. Multiple replicas would need Redis for shared rate limiting.
- Verify exact CLI flags with `railway <cmd> --help` (the CLI evolves).
