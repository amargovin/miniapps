# Swarajya MCP

A Model Context Protocol server that lets Claude search, fetch, and reason about articles published on [swarajyamag.com](https://swarajyamag.com). Wraps the public Quintype Story API — read-only, no auth required for the upstream calls.

## Tools

| Tool | What it does |
| --- | --- |
| `swarajya_search_stories` | Faceted search by query, section, author, tag, date, story-template. |
| `swarajya_get_story` | Fetch one article in full. Body is rendered to clean markdown ready to quote or summarize. |
| `swarajya_list_recent_stories` | Latest stories site-wide or scoped to a section. |
| `swarajya_get_collection` | Editorial collections — section landing pages, homepage rails, magazine issues. |
| `swarajya_list_sections` | Canonical section taxonomy (slugs ↔ IDs ↔ names). |
| `swarajya_list_authors` | Author directory with substring filter and pagination. |
| `swarajya_get_author` | Author profile + recent stories. |

All tools accept `response_format`: `"json"` (default, structured) or `"markdown"` (human-readable summary).

## Install locally (Claude Desktop / Cowork)

```bash
cd swarajyaconnector
pip install -r requirements.txt
```

Then drop this into your Claude MCP config (`claude_desktop_config.json` or equivalent):

```json
{
  "mcpServers": {
    "swarajya": {
      "command": "python",
      "args": ["-m", "swarajya_mcp.server"],
      "cwd": "/absolute/path/to/swarajyaconnector",
      "env": { "PYTHONPATH": "/absolute/path/to/swarajyaconnector/src" }
    }
  }
}
```

Restart Claude. The seven tools will appear under the `swarajya` connector.

## Deploy as a hosted endpoint for your team (Railway)

The same codebase runs as a streamable-HTTP MCP server. We deploy on [Railway](https://railway.com) — Docker-native, fast, and the bundled `railway.json` already wires up the healthcheck and start command.

### One-time setup

```bash
# 1. Install the Railway CLI
brew install railway          # or: npm i -g @railway/cli

# 2. Log in and link this folder to a Railway project
railway login
cd /path/to/swarajyaconnector
railway init                  # creates a new project, or `railway link` to attach to an existing one

# 3. Set the shared API key your team will use to authenticate to the connector
railway variables --set "SWARAJYA_MCP_API_KEY=$(openssl rand -hex 32)"

# 4. (Optional) Confirm the rest of the env. Railway injects PORT automatically.
railway variables --set "SWARAJYA_MCP_TRANSPORT=http" \
                  --set "SWARAJYA_MCP_HOST=0.0.0.0"

# 5. Ship it
railway up
```

### Expose a public URL

In the Railway dashboard, open the service → **Settings → Networking → Generate Domain**. You'll get something like `swarajya-mcp-production.up.railway.app`. The MCP endpoint is at `/mcp`; the healthcheck is at `/health`.

### Connect Claude to it

Your team adds it once in Claude → **Settings → Connectors → Add custom connector**:

- **URL**: `https://swarajya-mcp-production.up.railway.app/mcp`
- **Header**: `Authorization: Bearer <SWARAJYA_MCP_API_KEY>`

Everyone shares the same endpoint; the API key gates access. To rotate it: `railway variables --set "SWARAJYA_MCP_API_KEY=..."`.

### Subsequent deploys

```bash
railway up        # whenever you change code — it rebuilds the Docker image and rolls out
railway logs      # tail server logs
railway status    # see the current deployment
```

### Other hosts

The Dockerfile is host-agnostic and runs unchanged on Render, Cloud Run, App Runner, Fly.io, or Kubernetes. The relevant env vars are:

| Var | Default | Purpose |
| --- | --- | --- |
| `SWARAJYA_MCP_TRANSPORT` | `stdio` | Set to `http` for hosted deployment. |
| `SWARAJYA_MCP_HOST` | `127.0.0.1` | Bind address. `0.0.0.0` in containers. |
| `SWARAJYA_MCP_PORT` / `PORT` | `8000` | Listen port. `PORT` is honoured for Railway / Cloud Run / Render. |
| `SWARAJYA_MCP_API_KEY` | _(unset)_ | If set, required on `Authorization: Bearer` or `X-API-Key`. |
| `SWARAJYA_BASE_URL` | `https://swarajyamag.com` | Override only if pointing at staging. |
| `SWARAJYA_TIMEOUT` | `20` | HTTP timeout in seconds. |
| `SWARAJYA_MCP_LOG_LEVEL` | `INFO` | Standard Python logging levels. |

## Smoke test

```bash
python -m swarajya_mcp.server &              # stdio — won't print much
# Or run the included script directly:
python tests/smoke_test.py
```

## Roadmap

v1 (this release) is read-only against the public API. Planned next:

- **v2 — drafts & preview** via the Quintype Bulletin API (needs a Bulletin key). Adds `swarajya_list_drafts`, `swarajya_get_draft`, `swarajya_get_preview_url`.
- **v3 — authoring** via Bulletin: create drafts, edit, attach images, queue for editorial review. Strict guardrails — no auto-publish.

## License

MIT.
