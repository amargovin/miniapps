// xmcpbridge — hosted MCP proxy for the X API (Streamable HTTP, app-only Bearer)
//
// Simple route: no OAuth flow, no browser login, no token refresh.
// The X app-only Bearer token lives in an env var on Railway (rotate it there),
// and this proxy injects it on every request to https://api.x.com/mcp.
// Read-only endpoints; no user context.
//
// Env:
//   X_BEARER_TOKEN     X app's App-only Bearer token (required)
//   BRIDGE_SECRET      shared secret clients must present (required) — either
//                      "Authorization: Bearer <secret>" or "?key=<secret>" on the URL
//   UPSTREAM_MCP_URL   default https://api.x.com/mcp
//   PORT               default 3000

const UPSTREAM = process.env.UPSTREAM_MCP_URL || "https://api.x.com/mcp";
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN || "";
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || "";
const PORT = Number(process.env.PORT) || 3000;

const PASS_REQ_HEADERS = ["content-type", "accept", "mcp-session-id", "mcp-protocol-version", "last-event-id"];
const PASS_RES_HEADERS = ["content-type", "mcp-session-id", "mcp-protocol-version"];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function bridgeAuthed(req: Request): boolean {
  if (!BRIDGE_SECRET) return false;
  const h = req.headers.get("authorization") || "";
  if (h === `Bearer ${BRIDGE_SECRET}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("key") === BRIDGE_SECRET) return true;
  return url.pathname === `/mcp/${BRIDGE_SECRET}`;
}

async function proxyMcp(req: Request): Promise<Response> {
  if (!X_BEARER_TOKEN) return json(503, { error: "X_BEARER_TOKEN not set on the server" });

  const headers = new Headers();
  for (const h of PASS_REQ_HEADERS) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("Authorization", `Bearer ${X_BEARER_TOKEN}`);

  const upstream = await fetch(UPSTREAM, {
    method: req.method,
    headers,
    body: req.method === "POST" ? await req.arrayBuffer() : undefined,
    redirect: "manual",
  });

  const resHeaders = new Headers();
  for (const h of PASS_RES_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) resHeaders.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}

Bun.serve({
  port: PORT,
  idleTimeout: 240, // long-lived SSE streams
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const authed = bridgeAuthed(req);
    console.error(
      `[req] ${req.method} ${path.startsWith("/mcp/") ? "/mcp/<path-secret>" : path}${url.search ? "?..." : ""} authed=${authed} auth-header=${!!req.headers.get("authorization")}`
    );

    if (path === "/" || path === "/health") {
      return json(200, {
        ok: true,
        service: "xmcpbridge",
        mode: "app-only bearer",
        upstream: UPSTREAM,
        configured: { x_bearer_token: !!X_BEARER_TOKEN, bridge_secret: !!BRIDGE_SECRET },
      });
    }

    // Only the MCP endpoint requires auth; everything else (incl. OAuth
    // discovery probes like /.well-known/* and /register) gets a plain 404
    // so clients treat this as a no-auth server rather than attempting
    // dynamic client registration.
    if (path === "/mcp" || path.startsWith("/mcp/")) {
      if (!authed) return json(401, { error: "unauthorized — send Authorization: Bearer <BRIDGE_SECRET>, ?key=<BRIDGE_SECRET>, or use /mcp/<BRIDGE_SECRET>" });
      return proxyMcp(req);
    }

    return json(404, { error: "not found", routes: ["/health", "/mcp"] });
  },
});

console.error(`[bridge] xmcpbridge (app-only) listening on :${PORT} → ${UPSTREAM}`);
