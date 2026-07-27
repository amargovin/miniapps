# xmcpbridge

Hosted MCP proxy for the X API, deployed on Railway. Uses the **Simple route — App-only Bearer**: no OAuth flow, no browser login. The X app's Bearer token lives as a Railway env var (rotate it there anytime); the proxy injects it on every request to `https://api.x.com/mcp` (Streamable HTTP).

Read-only endpoints only; no user context (can't act as you).

## URLs

- Service: `https://xmcpbridge-production.up.railway.app`
- MCP endpoint: `https://xmcpbridge-production.up.railway.app/mcp`
- Health: `https://xmcpbridge-production.up.railway.app/health`

## Railway env vars

| Var | Purpose |
| --- | --- |
| `X_BEARER_TOKEN` | App-only Bearer token from the X Developer Portal (app → Keys and tokens). Update here to rotate. |
| `BRIDGE_SECRET` | Shared secret clients must present. Either `Authorization: Bearer <secret>` header or `?key=<secret>` on the URL. |
| `UPSTREAM_MCP_URL` | Optional, defaults to `https://api.x.com/mcp`. |

Update the token:

```bash
railway variables --set "X_BEARER_TOKEN=NEW_TOKEN"   # from this directory
```

or via the Railway dashboard → xmcpbridge → Variables.

## Connect a client

Claude Code:

```bash
claude mcp add --transport http xapi \
  https://xmcpbridge-production.up.railway.app/mcp \
  --header "Authorization: Bearer BRIDGE_SECRET_HERE"
```

Cursor / Claude Desktop (`mcp.json` style):

```json
{
  "mcpServers": {
    "xapi": {
      "url": "https://xmcpbridge-production.up.railway.app/mcp",
      "headers": { "Authorization": "Bearer BRIDGE_SECRET_HERE" }
    }
  }
}
```

Clients that can't send custom headers (e.g. claude.ai custom connectors, which also strip query strings): put the secret in the path —
`https://xmcpbridge-production.up.railway.app/mcp/BRIDGE_SECRET_HERE`

(`?key=BRIDGE_SECRET_HERE` on `/mcp` also works for clients that preserve query params.)

## Run locally

```bash
X_BEARER_TOKEN=... BRIDGE_SECRET=... bun server.ts
```
