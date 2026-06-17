#!/usr/bin/env bun
/**
 * Helpdesk Triage Web App
 *
 * Single-file Bun server that serves a one-page web app for LibreDesk conversation triage.
 * Three API proxy routes keep keys server-side. All HTML/CSS/JS inline.
 *
 * ENV: LIBREDESK_API_KEY, LIBREDESK_API_SECRET, LIBREDESK_URL, ANTHROPIC_API_KEY, USERS
 * Run: bun run server.ts
 */

// ── ENV ──────────────────────────────────────────────────────────────────────

const LIBREDESK_API_KEY = process.env.LIBREDESK_API_KEY;
const LIBREDESK_API_SECRET = process.env.LIBREDESK_API_SECRET;
const LIBREDESK_URL = (process.env.LIBREDESK_URL || "").replace(/\/+$/, "");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const USERS_RAW = process.env.USERS || "";

// Parse USERS env: "amar:pass1,raghu:pass2" → Map
const USERS = new Map<string, string>();
for (const pair of USERS_RAW.split(",")) {
  const [user, pass] = pair.split(":");
  if (user && pass) USERS.set(user.trim().toLowerCase(), pass.trim());
}

const AUTH_HEADER = `token ${LIBREDESK_API_KEY}:${LIBREDESK_API_SECRET}`;
const MAX_RETRIES = 3;
const CONCURRENCY = 5;
const PORT = parseInt(process.env.PORT || "3847", 10);

// Check env vars - warn but don't exit (allows health checks during deploy)
function checkEnvVars(): string[] {
  const missing: string[] = [];
  if (!LIBREDESK_API_KEY) missing.push("LIBREDESK_API_KEY");
  if (!LIBREDESK_API_SECRET) missing.push("LIBREDESK_API_SECRET");
  if (!LIBREDESK_URL) missing.push("LIBREDESK_URL");
  if (!ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (USERS.size === 0) missing.push("USERS");
  return missing;
}

const missingEnvVars = checkEnvVars();
if (missingEnvVars.length) {
  console.warn(`⚠️  Missing env vars: ${missingEnvVars.join(", ")} - app will return 503 until configured`);
}

// ── Sessions ─────────────────────────────────────────────────────────────────

const sessions = new Map<string, number>(); // token → created_at

function createSession(): string {
  const token = crypto.randomUUID();
  sessions.set(token, Date.now());
  return token;
}

function validSession(req: Request): boolean {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return false;
  return sessions.has(match[1]);
}

// ── LibreDesk API helper ─────────────────────────────────────────────────────

async function ldApi<T>(method: string, path: string, body?: unknown, retries = 0): Promise<T> {
  const url = `${LIBREDESK_URL}${path}`;
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", Authorization: AUTH_HEADER },
  };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(url, opts);

  if (resp.status === 429) {
    if (retries >= MAX_RETRIES) throw new Error(`Rate limited after ${MAX_RETRIES} retries: ${method} ${path}`);
    const retryAfter = parseInt(resp.headers.get("retry-after") || "30", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return ldApi(method, path, body, retries + 1);
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API ${method} ${path}: ${resp.status} ${text}`);
  }

  const text = await resp.text();
  if (!text) return {} as T;
  const json = JSON.parse(text);

  // LibreDesk wraps responses in {status: "success", data: ...}
  if (json && typeof json === "object" && "data" in json) return json.data as T;
  return json as T;
}

/** Extract array from potentially wrapped API list response */
function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.data)) return d.data as T[];
    if (Array.isArray(d.results)) return d.results as T[];
  }
  return [];
}

/** Bounded concurrency executor */
async function parallel<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

// ── Agent lookup (for conversation reassignment) ────────────────────────────

let cachedAmarAgentId: number | null = null;

async function getAmarAgentId(): Promise<number> {
  if (cachedAmarAgentId) return cachedAmarAgentId;
  const raw = await ldApi<unknown>("GET", `/api/v1/agents`);
  const agents = extractList<{ id: number; email?: string }>(raw);
  const amar = agents.find((a) => a.email === "amar@swarajyamag.com");
  if (!amar) throw new Error("Agent amar@swarajyamag.com not found in LibreDesk");
  cachedAmarAgentId = amar.id;
  return cachedAmarAgentId;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface LDConversation {
  id: number;
  uuid: string;
  reference_number?: string;
  subject: string;
  status: string;
  priority: string | null;
  contact: {
    uuid?: string;
    email?: string;
    first_name: string;
    last_name: string;
  };
  tags: string[] | null;
  created_at: string;
  assigned_user_id?: number;
  last_message?: string;
}

interface LDMessage {
  uuid: string;
  content: string;
  text_content?: string;
  content_type: string;
  type: string;
  private: boolean;
  sender_type: string;
  meta: {
    to?: string[];
    cc?: string[];
    from?: string[];
  };
  created_at: string;
}

interface TriageTicket {
  id: string; // UUID for API calls
  reference_number: string; // For display
  subject: string;
  from_email: string;
  from_name: string;
  to_emails: string[];
  cc_emails: string[];
  excerpt: string;
  tags: string[];
  created_at: string;
}

type ActionType = "escalate_both" | "escalate_amar" | "forward_drafts" | "close" | "leave";

interface TriageResult {
  id: string;
  action: ActionType;
  tag: string;
  rule: string;
  reason: string;
}

interface TriageAction {
  id: string;
  action: ActionType;
  tag?: string;
  tags?: string[];
}

interface ActionResult {
  id: string;
  action: string;
  status: "OK" | "FAIL" | "SKIP";
  detail: string;
}

// ── Route handlers ───────────────────────────────────────────────────────────

async function handleLogin(req: Request): Promise<Response> {
  try {
    const { username, password } = (await req.json()) as { username: string; password: string };
    const user = username?.trim().toLowerCase();
    const storedPass = USERS.get(user);
    if (!storedPass || storedPass !== password) {
      return Response.json({ error: "Invalid username or password" }, { status: 401 });
    }
    const token = createSession();
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `session=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=86400`,
      },
    });
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
}

async function handleFetchTickets(req: Request): Promise<Response> {
  if (!validSession(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const perPage = 50;

  try {
    // Fetch conversations
    const raw = await ldApi<unknown>("GET", `/api/v1/conversations/all?page=${page}&page_size=${perPage}`);
    const conversations = extractList<LDConversation>(raw);

    const unchecked = conversations.filter(
      (c) => c.status.toLowerCase() === "open" && !(c.tags || []).includes("Checked")
    );

    // Fetch first message for each unchecked conversation (for email/to/cc/body)
    const triageTickets = await parallel(unchecked, CONCURRENCY, async (conv): Promise<TriageTicket> => {
      let excerpt = "";
      let toEmails: string[] = [];
      let ccEmails: string[] = [];
      let fromEmail = "unknown";

      try {
        const msgRaw = await ldApi<unknown>("GET", `/api/v1/conversations/${conv.uuid}/messages`);
        const messages = extractList<LDMessage>(msgRaw);
        const firstMsg = messages[0];
        if (firstMsg) {
          const body = firstMsg.text_content || firstMsg.content || "";
          excerpt = body.replace(/<[^>]+>/g, "").slice(0, 200).replace(/[\r\n]+/g, " ").trim();
          toEmails = firstMsg.meta?.to || [];
          ccEmails = firstMsg.meta?.cc || [];
          fromEmail = firstMsg.meta?.from?.[0] || "unknown";
        }
      } catch {
        // Fallback: use last_message from list
        if (conv.last_message) {
          excerpt = conv.last_message.slice(0, 200).replace(/[\r\n]+/g, " ").trim();
        }
      }

      const contact = conv.contact || ({} as any);
      return {
        id: conv.uuid,
        reference_number: conv.reference_number || String(conv.id),
        subject: conv.subject || "",
        from_email: fromEmail,
        from_name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
        to_emails: toEmails,
        cc_emails: ccEmails,
        excerpt,
        tags: conv.tags || [],
        created_at: conv.created_at || "",
      };
    });

    const hasMore = conversations.length === perPage;

    return Response.json({
      page,
      per_page: perPage,
      fetched: conversations.length,
      open_on_page: conversations.filter((c) => c.status.toLowerCase() === "open").length,
      unchecked: triageTickets.length,
      has_more: hasMore,
      tickets: triageTickets,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

async function handleTriage(req: Request): Promise<Response> {
  if (!validSession(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { tickets } = (await req.json()) as { tickets: TriageTicket[] };
    if (!tickets || !tickets.length) {
      return Response.json({ error: "No tickets provided" }, { status: 400 });
    }

    // Batch into groups of 30
    const batches: TriageTicket[][] = [];
    for (let i = 0; i < tickets.length; i += 30) {
      batches.push(tickets.slice(i, i + 30));
    }

    const allResults: TriageResult[] = [];

    for (const batch of batches) {
      const ticketData = batch.map((t) => ({
        id: t.id,
        subject: t.subject,
        from_email: t.from_email,
        from_name: t.from_name,
        to_emails: t.to_emails,
        excerpt: t.excerpt,
      }));

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: TRIAGE_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Classify these tickets:\n\n${JSON.stringify(ticketData, null, 2)}`,
            },
          ],
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Anthropic API: ${resp.status} ${errText}`);
      }

      const data = (await resp.json()) as { content: { type: string; text: string }[] };
      const text = data.content.find((c) => c.type === "text")?.text || "[]";

      // Extract JSON from response (might be wrapped in markdown code block)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Claude returned no JSON array");

      const results: TriageResult[] = JSON.parse(jsonMatch[0]);
      allResults.push(...results);
    }

    return Response.json({ results: allResults });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

async function handleExecute(req: Request): Promise<Response> {
  if (!validSession(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { actions } = (await req.json()) as { actions: TriageAction[] };
    if (!actions || !actions.length) {
      return Response.json({ error: "No actions provided" }, { status: 400 });
    }

    const results = await parallel(actions, CONCURRENCY, async ({ id, action, tag, tags }): Promise<ActionResult> => {
      try {
        /** Build final tag list: existing + category tag + "Checked" */
        function buildTags(existing: string[]): string[] {
          const s = new Set(existing);
          if (tag) s.add(tag);
          s.add("Checked");
          return [...s];
        }

        if (action === "leave") {
          // Still apply the category tag even when leaving for review
          if (tag) {
            const conv = await ldApi<LDConversation>("GET", `/api/v1/conversations/${id}`);
            const newTags = [...new Set([...(conv.tags || []), tag])];
            await ldApi("POST", `/api/v1/conversations/${id}/tags`, { tags: newTags });
          }
          return { id, action, status: "SKIP", detail: "Left for human review" + (tag ? ` (tagged: ${tag})` : "") };
        }

        if (action === "escalate_both" || action === "escalate_amar") {
          // Fetch conversation details
          const conv = await ldApi<LDConversation>("GET", `/api/v1/conversations/${id}`);
          const newTags = buildTags(tags || conv.tags || []);

          // Fetch first incoming message for content
          let rawDescription = "(no content)";
          try {
            const msgRaw = await ldApi<unknown>("GET", `/api/v1/conversations/${id}/messages?type=incoming`);
            const messages = extractList<LDMessage>(msgRaw);
            if (messages[0]) {
              rawDescription = messages[0].content || "(no content)";
            }
          } catch {}

          // Strip HTML and clean
          const cleanDescription = rawDescription
            .replace(/<[^>]+>/g, "")
            .replace(/\[image:[^\]]*\]/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/^[\s>*-]+$/gm, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .slice(0, 1500);

          const ticketUrl = `${LIBREDESK_URL}/conversations/${id}`;
          const contact = conv.contact || ({} as any);
          const requesterEmail = contact.email || "unknown";
          const requesterName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
          const fromLine = requesterName ? `${requesterName} <${requesterEmail}>` : requesterEmail;

          const forwardBody = `This ticket has been forwarded for review.

Ticket URL: ${ticketUrl}
From: ${fromLine}
Subject: ${conv.subject || ""}

--- Original Message ---

${cleanDescription}`;

          // Add private note
          await ldApi("POST", `/api/v1/conversations/${id}/messages`, {
            content: forwardBody,
            private: true,
            content_type: "text",
          });

          // Assign to amar
          const amarId = await getAmarAgentId();
          await ldApi("PUT", `/api/v1/conversations/${id}/assignee/user`, { user_id: amarId });

          // Add "Checked" tag
          await ldApi("POST", `/api/v1/conversations/${id}/tags`, { tags: newTags });

          return { id, action, status: "OK", detail: "Forwarded + tagged + assigned" };
        } else if (action === "forward_drafts") {
          // Fetch conversation details
          const conv = await ldApi<LDConversation>("GET", `/api/v1/conversations/${id}`);
          const newTags = buildTags(tags || conv.tags || []);

          // Fetch first incoming message for content
          let rawDescription = "(no content)";
          try {
            const msgRaw = await ldApi<unknown>("GET", `/api/v1/conversations/${id}/messages?type=incoming`);
            const messages = extractList<LDMessage>(msgRaw);
            if (messages[0]) {
              rawDescription = messages[0].content || "(no content)";
            }
          } catch {}

          // Strip HTML and clean
          const cleanDescription = rawDescription
            .replace(/<[^>]+>/g, "")
            .replace(/\[image:[^\]]*\]/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/^[\s>*-]+$/gm, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .slice(0, 3000);

          const contact = conv.contact || ({} as any);
          const requesterEmail = contact.email || "unknown";
          const requesterName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
          const fromLine = requesterName ? `${requesterName} <${requesterEmail}>` : requesterEmail;
          const ticketUrl = `${LIBREDESK_URL}/conversations/${id}`;

          const forwardBody = `Article draft submitted for publication.

From: ${fromLine}
Subject: ${conv.subject || ""}
Ticket: ${ticketUrl}

--- Draft Content ---

${cleanDescription}`;

          // Add private note with draft content
          await ldApi("POST", `/api/v1/conversations/${id}/messages`, {
            content: forwardBody,
            private: true,
            content_type: "text",
          });

          // Send acknowledgment reply to requester
          await ldApi("POST", `/api/v1/conversations/${id}/messages`, {
            content:
              "Thank you for sending your draft to Swarajya. We truly appreciate you taking the time to write and share your work with us.\n\nPlease know that every submission is read by a member of our editorial team. Due to the volume of drafts we receive, it may take us some time to get back to you. We request your patience. If you do not hear from us, it may be assumed that we are unable to use the draft at this time.\n\nWe will be closing this conversation as part of our workflow. If you have any questions or would like to share additional details about your submission, please feel free to write to us again.\n\nWarm regards,\nTeam Swarajya",
            private: false,
            content_type: "text",
          });

          // Assign to amar
          const amarId = await getAmarAgentId();
          await ldApi("PUT", `/api/v1/conversations/${id}/assignee/user`, { user_id: amarId });

          // Add "Checked" tag
          await ldApi("POST", `/api/v1/conversations/${id}/tags`, { tags: newTags });

          return { id, action, status: "OK", detail: "Forwarded to amar@ + replied to requester + reassigned" };
        } else if (action === "close") {
          let existingTags: string[];
          if (tags) {
            existingTags = tags;
          } else {
            const conv = await ldApi<LDConversation>("GET", `/api/v1/conversations/${id}`);
            existingTags = conv.tags || [];
          }
          const newTags = buildTags(existingTags);

          // Close conversation
          await ldApi("PUT", `/api/v1/conversations/${id}/status`, { status: "closed" });
          // Add "Checked" tag
          await ldApi("POST", `/api/v1/conversations/${id}/tags`, { tags: newTags });

          return { id, action, status: "OK", detail: "Tagged + closed" };
        } else {
          return { id, action, status: "FAIL", detail: `Unknown action: ${action}` };
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { id, action, status: "FAIL", detail: msg };
      }
    });

    return Response.json({ results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// ── Claude system prompt (loaded from external file) ─────────────────────────

const TRIAGE_SYSTEM_PROMPT = await Bun.file("./triage-rules.md").text();

// ── Frontend HTML ────────────────────────────────────────────────────────────

function loginPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Helpdesk Triage - Login</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0f; color: #e0e0e0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .login-box { background: #14141f; border: 1px solid #2a2a3a; border-radius: 12px; padding: 2.5rem; width: 360px; }
  h1 { font-size: 1.4rem; margin-bottom: 1.5rem; color: #fff; text-align: center; }
  label { display: block; font-size: 0.85rem; color: #888; margin-bottom: 0.4rem; }
  input { width: 100%; padding: 0.7rem 0.9rem; background: #1a1a2e; border: 1px solid #333; border-radius: 6px; color: #e0e0e0; font-size: 0.95rem; outline: none; margin-bottom: 1rem; }
  input:focus { border-color: #5b6ef5; }
  button { width: 100%; padding: 0.7rem; background: #5b6ef5; color: #fff; border: none; border-radius: 6px; font-size: 0.95rem; cursor: pointer; font-weight: 500; }
  button:hover { background: #4a5de0; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .error { color: #f55b5b; font-size: 0.85rem; margin-top: 0.8rem; text-align: center; display: none; }
</style>
</head>
<body>
<div class="login-box">
  <h1>Helpdesk Triage</h1>
  <form id="loginForm">
    <label for="username">Username</label>
    <input type="text" id="username" name="username" autocomplete="username" autofocus required>
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autocomplete="current-password" required>
    <button type="submit" id="loginBtn">Log in</button>
    <div class="error" id="loginError"></div>
  </form>
</div>
<script>
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginError');
  btn.disabled = true;
  err.style.display = 'none';
  try {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
      })
    });
    if (resp.ok) { window.location.reload(); }
    else { err.textContent = 'Invalid username or password'; err.style.display = 'block'; }
  } catch { err.textContent = 'Connection error'; err.style.display = 'block'; }
  btn.disabled = false;
});
</script>
</body>
</html>`;
}

function appPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Helpdesk Triage</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0f; color: #e0e0e0; min-height: 100vh; padding: 1.5rem; }

  /* Layout */
  .container { max-width: 960px; margin: 0 auto; }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
  header h1 { font-size: 1.4rem; color: #fff; }

  /* Phases */
  .phase { background: #14141f; border: 1px solid #2a2a3a; border-radius: 10px; padding: 1.25rem 1.5rem; margin-bottom: 1rem; }
  .phase-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
  .phase-header h2 { font-size: 1.05rem; color: #fff; }
  .phase-header .badge { background: #2a2a3a; color: #aaa; padding: 0.15rem 0.6rem; border-radius: 99px; font-size: 0.8rem; }

  /* Buttons */
  .btn { padding: 0.55rem 1.1rem; border: none; border-radius: 6px; font-size: 0.88rem; cursor: pointer; font-weight: 500; transition: background 0.15s; }
  .btn-primary { background: #5b6ef5; color: #fff; }
  .btn-primary:hover { background: #4a5de0; }
  .btn-danger { background: #e04545; color: #fff; }
  .btn-danger:hover { background: #c73a3a; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Status */
  .status { font-size: 0.85rem; color: #888; margin-top: 0.5rem; }
  .status.error { color: #f55b5b; }

  /* Ticket groups */
  .group { margin-top: 1rem; }
  .group-title { font-size: 0.95rem; font-weight: 600; padding: 0.5rem 0.7rem; border-radius: 6px 6px 0 0; }
  .group-close { background: #1a2e1a; color: #5bc75b; border-left: 3px solid #3a8a3a; }
  .group-escalate-both { background: #2e1a1a; color: #f55b5b; border-left: 3px solid #c73a3a; }
  .group-escalate-amar { background: #2e2a1a; color: #f5b85b; border-left: 3px solid #c79a3a; }
  .group-forward-drafts { background: #1a2e2e; color: #5bc7c7; border-left: 3px solid #3a8a8a; }
  .group-leave { background: #1a1a2e; color: #8888cc; border-left: 3px solid #5555aa; }

  .ticket-card { background: #1a1a28; border: 1px solid #2a2a3a; border-top: none; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; }
  .ticket-card:last-child { border-radius: 0 0 6px 6px; }
  .ticket-row { display: flex; align-items: center; gap: 0.75rem; width: 100%; }
  .ticket-id { color: #6b8aff; font-family: monospace; flex-shrink: 0; min-width: 70px; text-decoration: none; }
  .ticket-id:hover { color: #8aa4ff; text-decoration: underline; }
  .ticket-subject { flex: 1; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ticket-sender { flex: 1; color: #888; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 70px; }
  .ticket-sender strong { color: #aaa; font-weight: 500; }
  .ticket-reason { color: #999; font-size: 0.8rem; flex-shrink: 0; max-width: 180px; text-align: right; }
  .ticket-action-select { background: #14141f; border: 1px solid #333; color: #ccc; padding: 0.25rem 0.4rem; border-radius: 4px; font-size: 0.8rem; }

  /* Progress bar */
  .progress-bar { width: 100%; height: 4px; background: #2a2a3a; border-radius: 2px; margin-top: 0.5rem; overflow: hidden; }
  .progress-fill { height: 100%; background: #5b6ef5; transition: width 0.3s; border-radius: 2px; }

  /* Summary bar */
  .summary { display: flex; gap: 1rem; font-size: 0.85rem; margin-top: 0.75rem; flex-wrap: wrap; }
  .summary span { padding: 0.2rem 0.6rem; border-radius: 4px; }
  .s-close { background: #1a2e1a; color: #5bc75b; }
  .s-esc-both { background: #2e1a1a; color: #f55b5b; }
  .s-esc-amar { background: #2e2a1a; color: #f5b85b; }
  .s-fwd-drafts { background: #1a2e2e; color: #5bc7c7; }
  .s-leave { background: #1a1a2e; color: #8888cc; }

  /* Execution results */
  .result-ok { color: #5bc75b; }
  .result-fail { color: #f55b5b; }
  .result-skip { color: #8888cc; }
  .exec-results { margin-top: 0.5rem; font-size: 0.85rem; }
  .exec-results div { padding: 0.2rem 0; font-family: monospace; }

  /* Tooltip */
  .ticket-card[title] { cursor: help; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>Helpdesk Triage</h1>
    <span style="color:#666; font-size:0.8rem;">Swarajya / Kovai Media</span>
  </header>

  <!-- Phase 1: Fetch -->
  <div class="phase" id="fetchPhase">
    <div class="phase-header">
      <h2>1. Fetch Tickets</h2>
      <span class="badge" id="fetchBadge">&mdash;</span>
    </div>
    <button class="btn btn-primary" id="fetchBtn" onclick="startFetch()">Fetch Open Tickets</button>
    <div class="progress-bar" id="fetchProgress" style="display:none"><div class="progress-fill" id="fetchFill"></div></div>
    <div class="status" id="fetchStatus"></div>
  </div>

  <!-- Phase 2: Classify -->
  <div class="phase" id="classifyPhase" style="opacity:0.4; pointer-events:none;">
    <div class="phase-header">
      <h2>2. Classify</h2>
      <span class="badge" id="classifyBadge">&mdash;</span>
    </div>
    <button class="btn btn-primary" id="classifyBtn" onclick="startClassify()">Classify with Claude</button>
    <div class="status" id="classifyStatus"></div>
    <div id="classifyResults"></div>
    <div class="summary" id="classifySummary" style="display:none"></div>
  </div>

  <!-- Phase 3: Execute -->
  <div class="phase" id="executePhase" style="opacity:0.4; pointer-events:none;">
    <div class="phase-header">
      <h2>3. Execute</h2>
      <span class="badge" id="executeBadge">&mdash;</span>
    </div>
    <button class="btn btn-danger" id="executeBtn" onclick="startExecute()">Execute Actions</button>
    <div class="status" id="executeStatus"></div>
    <div class="exec-results" id="executeResults"></div>
  </div>
</div>

<script>
// ── Config ──
const LIBREDESK_BASE = '${LIBREDESK_URL}';

// ── State ──
let allTickets = [];      // TriageTicket[]
let triageResults = [];   // {id, action, rule, reason}[]

// Map ticket id (UUID) → TriageTicket for quick lookup
function ticketMap() {
  const m = {};
  allTickets.forEach(t => m[t.id] = t);
  return m;
}

// ── Phase 1: Fetch ──
async function startFetch() {
  const btn = document.getElementById('fetchBtn');
  const status = document.getElementById('fetchStatus');
  const badge = document.getElementById('fetchBadge');
  const progressBar = document.getElementById('fetchProgress');
  const progressFill = document.getElementById('fetchFill');

  btn.disabled = true;
  allTickets = [];
  status.className = 'status';
  progressBar.style.display = 'block';
  progressFill.style.width = '0%';

  let page = 1;
  let consecutiveEmpty = 0;
  const maxEmptyPages = 3;

  try {
    while (true) {
      status.textContent = 'Fetching page ' + page + '...';
      progressFill.style.width = Math.min(page * 10, 90) + '%';

      const resp = await fetch('/api/tickets?page=' + page);
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Fetch failed');
      }

      const data = await resp.json();

      if (data.unchecked === 0) {
        consecutiveEmpty++;
      } else {
        consecutiveEmpty = 0;
        allTickets.push(...data.tickets);
      }

      badge.textContent = allTickets.length;
      status.textContent = 'Page ' + page + ': ' + data.unchecked + ' unchecked (total: ' + allTickets.length + ')';

      if (!data.has_more || consecutiveEmpty >= maxEmptyPages) break;
      page++;
    }

    progressFill.style.width = '100%';

    if (allTickets.length === 0) {
      status.textContent = 'No unchecked open tickets found.';
    } else {
      status.textContent = 'Fetched ' + allTickets.length + ' unchecked tickets across ' + page + ' pages.';
      // Enable phase 2
      document.getElementById('classifyPhase').style.opacity = '1';
      document.getElementById('classifyPhase').style.pointerEvents = 'auto';
    }
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
    status.className = 'status error';
  }

  btn.disabled = false;
}

// ── Phase 2: Classify ──
async function startClassify() {
  const btn = document.getElementById('classifyBtn');
  const status = document.getElementById('classifyStatus');
  const badge = document.getElementById('classifyBadge');
  const resultsDiv = document.getElementById('classifyResults');
  const summaryDiv = document.getElementById('classifySummary');

  btn.disabled = true;
  resultsDiv.innerHTML = '';
  summaryDiv.style.display = 'none';
  status.className = 'status';
  status.textContent = 'Sending ' + allTickets.length + ' tickets to Claude...';

  try {
    const resp = await fetch('/api/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickets: allTickets })
    });

    if (!resp.ok) {
      const data = await resp.json();
      throw new Error(data.error || 'Triage failed');
    }

    const data = await resp.json();
    triageResults = data.results;
    badge.textContent = triageResults.length;
    status.textContent = 'Classified ' + triageResults.length + ' tickets.';

    renderClassifications();

    // Enable phase 3
    document.getElementById('executePhase').style.opacity = '1';
    document.getElementById('executePhase').style.pointerEvents = 'auto';
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
    status.className = 'status error';
  }

  btn.disabled = false;
}

function renderClassifications() {
  const resultsDiv = document.getElementById('classifyResults');
  const summaryDiv = document.getElementById('classifySummary');
  const tm = ticketMap();

  const groups = {
    close: triageResults.filter(r => r.action === 'close'),
    escalate_both: triageResults.filter(r => r.action === 'escalate_both'),
    escalate_amar: triageResults.filter(r => r.action === 'escalate_amar'),
    forward_drafts: triageResults.filter(r => r.action === 'forward_drafts'),
    leave: triageResults.filter(r => r.action === 'leave'),
  };

  let html = '';

  const groupConfig = [
    { key: 'close', label: 'Close', css: 'group-close' },
    { key: 'escalate_both', label: 'Escalate Both', css: 'group-escalate-both' },
    { key: 'escalate_amar', label: 'Escalate Amar', css: 'group-escalate-amar' },
    { key: 'forward_drafts', label: 'Forward to Drafts', css: 'group-forward-drafts' },
    { key: 'leave', label: 'Leave', css: 'group-leave' },
  ];

  for (const gc of groupConfig) {
    const items = groups[gc.key];
    if (!items.length) continue;

    html += '<div class="group">';
    html += '<div class="group-title ' + gc.css + '">' + gc.label + ' (' + items.length + ')</div>';

    for (const r of items) {
      const t = tm[r.id] || {};
      const displayId = t.reference_number || r.id.slice(0, 8);
      const subj = (t.subject || '').slice(0, 50);
      const fromName = t.from_name || '';
      const fromEmail = t.from_email || 'unknown';
      const senderDisplay = fromName ? fromName + ' <' + fromEmail + '>' : fromEmail;
      const title = [
        'To: ' + ((t.to_emails || []).join(', ') || '\\u2014'),
        'Rule: ' + (r.rule || ''),
        '',
        (t.excerpt || ''),
      ].join('\\n');

      html += '<div class="ticket-card" title="' + escHtml(title) + '">';
      html += '<div class="ticket-row">';
      html += '<a class="ticket-id" href="' + LIBREDESK_BASE + '/conversations/' + r.id + '" target="_blank">#' + escHtml(displayId) + '</a>';
      html += '<span class="ticket-subject">' + escHtml(subj) + '</span>';
      html += '<span class="ticket-reason">' + (r.tag ? '<small style="color:#6b8aff">[' + escHtml(r.tag) + ']</small> ' : '') + escHtml(r.reason) + '</span>';
      html += '<select class="ticket-action-select" data-id="' + r.id + '" onchange="updateAction(this.getAttribute(\\'data-id\\'), this.value)">';
      html += optionHtml('close', r.action);
      html += optionHtml('escalate_both', r.action);
      html += optionHtml('escalate_amar', r.action);
      html += optionHtml('forward_drafts', r.action);
      html += optionHtml('leave', r.action);
      html += '</select>';
      html += '</div>';
      html += '<div class="ticket-sender"><strong>From:</strong> ' + escHtml(senderDisplay) + '</div>';
      html += '</div>';
    }

    html += '</div>';
  }

  resultsDiv.innerHTML = html;

  // Summary
  summaryDiv.style.display = 'flex';
  summaryDiv.innerHTML =
    '<span class="s-close">' + groups.close.length + ' close</span>' +
    '<span class="s-esc-both">' + groups.escalate_both.length + ' escalate both</span>' +
    '<span class="s-esc-amar">' + groups.escalate_amar.length + ' escalate amar</span>' +
    '<span class="s-fwd-drafts">' + groups.forward_drafts.length + ' drafts</span>' +
    '<span class="s-leave">' + groups.leave.length + ' leave</span>';
}

function optionHtml(value, selected) {
  const labels = { close: 'Close', escalate_both: 'Escalate Both', escalate_amar: 'Escalate Amar', forward_drafts: 'Forward to Drafts', leave: 'Leave' };
  return '<option value="' + value + '"' + (value === selected ? ' selected' : '') + '>' + labels[value] + '</option>';
}

function updateAction(id, newAction) {
  const r = triageResults.find(r => r.id === id);
  if (r) {
    r.action = newAction;
    renderClassifications();
  }
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Phase 3: Execute ──
async function startExecute() {
  const btn = document.getElementById('executeBtn');
  const status = document.getElementById('executeStatus');
  const badge = document.getElementById('executeBadge');
  const resultsDiv = document.getElementById('executeResults');
  const tm = ticketMap();

  btn.disabled = true;
  resultsDiv.innerHTML = '';
  status.className = 'status';

  // Build actions with tags from fetched tickets
  const actions = triageResults.map(r => {
    const t = tm[r.id];
    return { id: r.id, action: r.action, tag: r.tag, tags: t ? t.tags : undefined };
  });

  const actionable = actions.filter(a => a.action !== 'leave');
  const skipped = actions.filter(a => a.action === 'leave');

  status.textContent = 'Executing ' + actionable.length + ' actions (' + skipped.length + ' left for review)...';

  try {
    const resp = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions })
    });

    if (!resp.ok) {
      const data = await resp.json();
      throw new Error(data.error || 'Execute failed');
    }

    const data = await resp.json();
    badge.textContent = data.results.length;

    let okCount = 0, failCount = 0, skipCount = 0;
    let html = '';

    for (const r of data.results) {
      const t = tm[r.id] || {};
      const displayId = t.reference_number || r.id.slice(0, 8);
      const cls = r.status === 'OK' ? 'result-ok' : r.status === 'SKIP' ? 'result-skip' : 'result-fail';
      html += '<div class="' + cls + '">#' + escHtml(displayId) + ' ' + r.action + ': ' + r.status + ' \\u2014 ' + r.detail + '</div>';
      if (r.status === 'OK') okCount++;
      else if (r.status === 'SKIP') skipCount++;
      else failCount++;
    }

    resultsDiv.innerHTML = html;
    status.textContent = 'Done. ' + okCount + ' OK, ' + failCount + ' failed, ' + skipCount + ' skipped.';
    if (failCount > 0) status.className = 'status error';
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
    status.className = 'status error';
  }

  btn.disabled = false;
}
</script>
</body>
</html>`;
}

// ── Server ───────────────────────────────────────────────────────────────────

Bun.serve({
  port: PORT,
  idleTimeout: 120, // 2 minutes for Claude API calls
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Health check (no auth required) - returns missing env vars for debugging
    if (path === "/health") {
      const missing = checkEnvVars();
      return Response.json({
        status: missing.length ? "degraded" : "ok",
        missing: missing.length ? missing : undefined
      });
    }

    // Check env vars before processing any other request
    const missing = checkEnvVars();
    if (missing.length) {
      return Response.json(
        { error: "Server not configured", missing },
        { status: 503 }
      );
    }

    // API routes
    if (path === "/api/login" && req.method === "POST") return handleLogin(req);
    if (path === "/api/tickets" && req.method === "GET") return handleFetchTickets(req);
    if (path === "/api/triage" && req.method === "POST") return handleTriage(req);
    if (path === "/api/execute" && req.method === "POST") return handleExecute(req);

    // Main page
    if (path === "/") {
      const html = validSession(req) ? appPage() : loginPage();
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Helpdesk Triage running on http://localhost:${PORT}`);
