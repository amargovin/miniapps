#!/usr/bin/env bun
/**
 * analyze-customer.ts
 *
 * Given a Freshdesk ticket ID, assemble everything we know about the customer:
 * detect every email address they've used (primary + secondary + harvested from
 * threads + name-matched contacts), pull every ticket they've ever opened, and
 * render a single self-contained HTML report with:
 *   - Detected emails + ticket list
 *   - Claude-written "what happened" narrative
 *   - Claude-written "what the agent should have done" coaching note
 *   - Full chronological message thread across all tickets
 *
 * Usage:  cd freshdesk && bun analyze-customer.ts <ticket_id>
 * Output: ./customer_<ticket_id>.html  (opens in a browser)
 */

const ticketId = parseInt(process.argv[2], 10);
if (!ticketId) {
  console.error("Usage: bun analyze-customer.ts <ticket_id>");
  process.exit(1);
}

const API_KEY = process.env.FRESHDESK_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DOMAIN = process.env.FRESHDESK_DOMAIN || "swarajyasubscriptions";
if (!API_KEY) { console.error("FRESHDESK_API_KEY missing in env"); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error("ANTHROPIC_API_KEY missing in env"); process.exit(1); }

const BASE = `https://${DOMAIN}.freshdesk.com`;
const AUTH = `Basic ${btoa(`${API_KEY}:X`)}`;
const OWN_DOMAINS = ["swarajyamag.com", "kovai.in", "swarajyasubscriptions.freshdesk.com"];

interface FdTicket {
  id: number;
  subject: string;
  status: number;
  created_at: string;
  updated_at: string;
  requester_id: number;
  to_emails?: string[];
  description_text?: string;
  requester?: { id: number; name: string; email: string };
}
interface FdConversation {
  id: number;
  body_text?: string;
  body?: string;
  incoming: boolean;
  private: boolean;
  from_email?: string;
  to_emails?: string[];
  cc_emails?: string[];
  created_at: string;
}
interface FdContact {
  id: number;
  name: string;
  email?: string;
  other_emails?: string[];
}

async function fd<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: AUTH } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

// 1. Seed ticket
console.log(`→ Fetching seed ticket #${ticketId}...`);
const seed = await fd<FdTicket>(`/api/v2/tickets/${ticketId}?include=requester`);
const seedEmail = (seed.requester?.email || "").toLowerCase();
const seedName = seed.requester?.name || "(unknown)";
console.log(`  Customer: ${seedName} <${seedEmail}>`);

// 2. Contact record (secondary emails)
console.log(`→ Loading contact record #${seed.requester_id}...`);
const contact = await fd<FdContact>(`/api/v2/contacts/${seed.requester_id}`);
const contactEmails = new Set<string>();
if (contact.email) contactEmails.add(contact.email.toLowerCase());
for (const e of contact.other_emails || []) contactEmails.add(e.toLowerCase());

// Helper: is this a plausible customer email (not our own, not a no-reply)?
const isCustomer = (e: string) => {
  if (!e.includes("@")) return false;
  if (OWN_DOMAINS.some((d) => e.endsWith("@" + d))) return false;
  if (e.includes("noreply") || e.includes("no-reply") || e.includes("donotreply") || e.includes("mailer-daemon")) return false;
  return true;
};
const isCustomerEmailPrelim = isCustomer;

// 3. Harvest emails from the seed ticket's conversation thread
console.log(`→ Harvesting emails from seed ticket thread...`);
const seedConvs = await fd<FdConversation[]>(`/api/v2/tickets/${ticketId}/conversations`);
const harvested = new Set<string>();
const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const harvest = (s: string | undefined) => {
  if (!s) return;
  for (const m of s.matchAll(emailRe)) harvested.add(m[0].toLowerCase());
};
harvest(seed.description_text);
for (const c of seedConvs || []) {
  harvest(c.body_text || c.body);
  harvest(c.from_email);
  for (const e of c.to_emails || []) harvest(e);
  for (const e of c.cc_emails || []) harvest(e);
}

// 4. For each harvested email, look up its contact record and pull any of THEIR secondary emails too.
// (Freshdesk doesn't support search-by-name, so we discover the customer's other identities transitively
// via harvested emails → their contact records → their other_emails.)
console.log(`→ Resolving harvested emails to contacts for transitive discovery...`);
const transitiveEmails = new Set<string>();
for (const email of harvested) {
  if (!isCustomerEmailPrelim(email)) continue;
  try {
    const r = await fd<FdContact[]>(`/api/v2/contacts?email=${encodeURIComponent(email)}`);
    for (const c of r || []) {
      if (c.email) transitiveEmails.add(c.email.toLowerCase());
      for (const e of c.other_emails || []) transitiveEmails.add(e.toLowerCase());
    }
  } catch {
    // skip — email might not be a registered contact
  }
}

// 5. Compile candidate emails — union of primary, secondary, harvested, and transitively-discovered
const candidates = new Set<string>([
  ...[...contactEmails].filter(isCustomer),
  ...[...harvested].filter(isCustomer),
  ...[...transitiveEmails].filter(isCustomer),
]);
console.log(`→ Candidate customer emails (${candidates.size}):`);
for (const e of candidates) console.log(`    ${e}`);

// 6. For each candidate email, list every ticket where they were the requester.
// Uses /api/v2/tickets?email=X which filters by requester email — paginated.
console.log(`→ Listing tickets for each candidate email...`);
const allTicketIds = new Set<number>([ticketId]);
for (const email of candidates) {
  let total = 0;
  let page = 1;
  try {
    while (page <= 20) {
      const batch = await fd<FdTicket[]>(`/api/v2/tickets?email=${encodeURIComponent(email)}&per_page=100&page=${page}`);
      if (!batch.length) break;
      for (const t of batch) allTicketIds.add(t.id);
      total += batch.length;
      if (batch.length < 100) break;
      page++;
    }
    console.log(`    ${email}: ${total} tickets`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("There is no contact matching the given email")) {
      console.log(`    ${email}: 0 tickets (not a registered contact)`);
    } else {
      console.warn(`    ${email}: list failed — ${msg}`);
    }
  }
}
console.log(`→ ${allTicketIds.size} unique tickets total`);

// 7. Fetch every ticket fully — iterative: load threads, harvest more emails,
// discover more tickets, repeat until no new candidates appear (max 3 passes).
interface FullTicket { ticket: FdTicket; conversations: FdConversation[] }
const tickets: FullTicket[] = [];
const fetchedIds = new Set<number>();

async function loadTickets(ids: Iterable<number>) {
  for (const id of ids) {
    if (fetchedIds.has(id)) continue;
    fetchedIds.add(id);
    try {
      const [t, cs] = await Promise.all([
        fd<FdTicket>(`/api/v2/tickets/${id}?include=requester`),
        fd<FdConversation[]>(`/api/v2/tickets/${id}/conversations`),
      ]);
      tickets.push({ ticket: t, conversations: cs || [] });
    } catch (e) {
      console.warn(`  ticket ${id} fetch failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}

console.log(`→ Loading full thread for each ticket (iterative discovery)...`);
await loadTickets(allTicketIds);

for (let pass = 1; pass <= 3; pass++) {
  const newHarvest = new Set<string>();
  for (const { ticket, conversations } of tickets) {
    harvest(ticket.description_text);
    for (const c of conversations) {
      const before = harvested.size;
      harvest(c.body_text || c.body);
      harvest(c.from_email);
      for (const e of c.to_emails || []) harvest(e);
      for (const e of c.cc_emails || []) harvest(e);
      if (harvested.size > before) {
        for (const e of harvested) if (!candidates.has(e) && isCustomer(e)) newHarvest.add(e);
      }
    }
  }
  // Any genuinely new emails to chase?
  const newCandidates = [...newHarvest].filter((e) => isCustomer(e) && !candidates.has(e));
  if (!newCandidates.length) break;
  console.log(`  pass ${pass}: ${newCandidates.length} new candidate email(s): ${newCandidates.join(", ")}`);

  // Look up their contacts (might surface MORE secondary emails)
  for (const email of newCandidates) {
    candidates.add(email);
    try {
      const r = await fd<FdContact[]>(`/api/v2/contacts?email=${encodeURIComponent(email)}`);
      for (const c of r || []) {
        if (c.email && isCustomer(c.email)) candidates.add(c.email.toLowerCase());
        for (const e of c.other_emails || []) if (isCustomer(e)) candidates.add(e.toLowerCase());
      }
    } catch { /* skip */ }
  }

  // List their tickets and load any new ones
  const newTicketIds = new Set<number>();
  for (const email of newCandidates) {
    let page = 1;
    try {
      while (page <= 20) {
        const batch = await fd<FdTicket[]>(`/api/v2/tickets?email=${encodeURIComponent(email)}&per_page=100&page=${page}`);
        if (!batch.length) break;
        for (const t of batch) if (!allTicketIds.has(t.id)) newTicketIds.add(t.id);
        for (const t of batch) allTicketIds.add(t.id);
        if (batch.length < 100) break;
        page++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("There is no contact matching the given email")) {
        console.log(`    ${email}: 0 tickets (not a registered contact)`);
      } else {
        console.warn(`    ${email}: list failed — ${msg}`);
      }
    }
  }
  if (!newTicketIds.size) break;
  console.log(`    +${newTicketIds.size} new ticket(s) to load`);
  await loadTickets(newTicketIds);
}

tickets.sort((a, b) => new Date(a.ticket.created_at).getTime() - new Date(b.ticket.created_at).getTime());
console.log(`→ Final: ${candidates.size} email(s), ${tickets.length} ticket(s)`);

// 8. Flatten into a chronological message list
type MsgType = "original" | "incoming" | "outgoing" | "private_note";
interface Msg {
  ticket_id: number;
  ticket_subject: string;
  type: MsgType;
  from: string;
  to: string[];
  created_at: string;
  body_text: string;
}
const messages: Msg[] = [];
for (const { ticket, conversations } of tickets) {
  messages.push({
    ticket_id: ticket.id,
    ticket_subject: ticket.subject,
    type: "original",
    from: ticket.requester?.email || "unknown",
    to: ticket.to_emails || [],
    created_at: ticket.created_at,
    body_text: ticket.description_text || "",
  });
  for (const c of conversations) {
    const type: MsgType = c.private ? "private_note" : c.incoming ? "incoming" : "outgoing";
    messages.push({
      ticket_id: ticket.id,
      ticket_subject: ticket.subject,
      type,
      from: c.from_email || (c.incoming ? "(customer)" : "(agent)"),
      to: c.to_emails || [],
      created_at: c.created_at,
      body_text: c.body_text || c.body || "",
    });
  }
}
messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
console.log(`→ ${messages.length} messages across all tickets`);

// 9. Claude narrative + coaching
console.log(`→ Generating narrative + coaching with Claude...`);
const trim = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "...[truncated]" : s);
const claudeContext = messages
  .map(
    (m, i) =>
      `[${i + 1}] ${m.created_at}  #${m.ticket_id} (${m.ticket_subject}) — ${m.type.toUpperCase()}\nFrom: ${m.from}\nTo: ${m.to.join(", ") || "—"}\n${trim(m.body_text, 1800)}`
  )
  .join("\n\n---\n\n");

interface Analysis {
  headline: string;            // 1-sentence summary of the whole situation
  what_happened: string[];     // 4-6 bullets, each 1 sentence, specific (ticket #s, dates)
  what_should_have_happened: string[]; // 3-5 bullets, concrete coaching
  timeline: { date: string; label: string }[]; // key moments only, ~5-8 entries
}

let analysis: Analysis = {
  headline: "(analysis failed)",
  what_happened: ["(narrative generation failed)"],
  what_should_have_happened: ["(coaching generation failed)"],
  timeline: [],
};

const userPrompt = `You are reviewing a customer support history for the editor at Swarajya / Kovai Media. The customer used these emails: ${[...candidates].join(", ")}.

Read the full chronological thread (across ALL their tickets) and produce a JSON object with this shape:

{
  "headline": "One sentence summarizing the whole situation. What is this customer angry/frustrated about, in plain language.",
  "what_happened": [
    "Bullet 1 — one short sentence. Cite ticket # and approximate date.",
    "Bullet 2 — another short sentence.",
    "...4 to 6 bullets total"
  ],
  "what_should_have_happened": [
    "Concrete bullet 1 — specific action that should have been taken differently.",
    "Bullet 2 — what to say or do, not 'be empathetic'.",
    "...3 to 5 bullets"
  ],
  "timeline": [
    { "date": "YYYY-MM-DD", "label": "Short label of a key moment (e.g. 'Customer first complained about X', 'Agent ignored refund request')" },
    "...5 to 8 key moments only — don't list every message, just inflection points"
  ]
}

Rules:
- Each bullet is one sentence, terse and specific. No fluff.
- Cite ticket numbers where relevant.
- Tone: honest, factual. Don't soften failures.
- Output ONLY the JSON object. No markdown fences, no preamble.

Full thread:

${claudeContext}`;

try {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (r.ok) {
    const data = (await r.json()) as { content: { type: string; text: string }[] };
    const text = data.content.find((c) => c.type === "text")?.text || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]) as Partial<Analysis>;
      analysis = {
        headline: parsed.headline || analysis.headline,
        what_happened: Array.isArray(parsed.what_happened) ? parsed.what_happened : analysis.what_happened,
        what_should_have_happened: Array.isArray(parsed.what_should_have_happened) ? parsed.what_should_have_happened : analysis.what_should_have_happened,
        timeline: Array.isArray(parsed.timeline) ? parsed.timeline : analysis.timeline,
      };
    }
  } else {
    console.warn(`  Claude API: ${r.status} ${await r.text()}`);
  }
} catch (e) {
  console.warn(`  Claude call failed: ${e instanceof Error ? e.message : e}`);
}

// 10. Clean message bodies (strip quoted reply chains, image placeholders, blank-line runs)
const cleanBody = (s: string): string => {
  if (!s) return "";
  let out = s;
  out = out.replace(/\[image:[^\]]*\]/gi, "");
  // Strip Gmail-style quoted replies
  out = out.replace(/\n+On .{1,80}? wrote:[\s\S]*$/m, "");
  // Strip Outlook-style headers
  out = out.replace(/\n+-{2,}\s*(Original Message|Forwarded Message)\s*-{2,}[\s\S]*$/im, "");
  out = out.replace(/\n+From: .+\n+Sent: [\s\S]*$/im, "");
  // Strip leading/trailing whitespace
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
};

// 11. Render HTML
console.log(`→ Rendering HTML report...`);
const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ticketRows = tickets.map(({ ticket }) =>
  `<li><a class="link" href="${BASE}/a/tickets/${ticket.id}" target="_blank">#${ticket.id}</a> <span class="muted">${esc(ticket.created_at.slice(0, 10))}</span> · ${esc(ticket.subject || "(no subject)")}</li>`
).join("");

const li = (items: string[]) => items.map((s) => `<li>${esc(s)}</li>`).join("");
const timelineHtml = analysis.timeline.length
  ? `<ol class="timeline">${analysis.timeline.map((t) => `<li><span class="tl-date">${esc(t.date)}</span><span class="tl-label">${esc(t.label)}</span></li>`).join("")}</ol>`
  : "";

const messagesHtml = messages.map((m) => {
  const cleaned = cleanBody(m.body_text);
  const lines = cleaned.split("\n");
  const PREVIEW_LINES = 6;
  const needsFold = lines.length > PREVIEW_LINES + 2 || cleaned.length > 500;
  const preview = needsFold ? lines.slice(0, PREVIEW_LINES).join("\n") : cleaned;
  const rest = needsFold ? lines.slice(PREVIEW_LINES).join("\n") : "";
  const label = m.type === "private_note" ? "private note" : m.type;

  return `
<article class="msg ${m.type}">
  <header class="msg-header">
    <span class="badge ${m.type}">${label}</span>
    <a class="link" href="${BASE}/a/tickets/${m.ticket_id}" target="_blank">#${m.ticket_id}</a>
    <span class="muted">${esc(m.created_at.replace("T", " ").slice(0, 16))}</span>
    <span class="from">${esc(m.from)}</span>
  </header>
  <div class="body">${esc(preview) || "<em class='muted'>(empty)</em>"}${
    needsFold
      ? `<details class="fold"><summary>Show full message (${lines.length} lines)</summary><div class="rest">${esc(rest)}</div></details>`
      : ""
  }</div>
</article>`;
}).join("");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Customer history — #${ticketId}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; max-width: 880px; margin: 1.5rem auto; padding: 0 1.4rem 4rem; color: #1c1c28; background: #f6f6f8; line-height: 1.45; font-size: 14px; }
  h1 { font-size: 1.35rem; margin: 0 0 0.2rem; font-weight: 600; }
  h2 { font-size: 0.95rem; margin: 0 0 0.7rem; color: #1c1c28; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #585866; }
  .subtitle { color: #888894; font-size: 0.82rem; margin-bottom: 1.2rem; }
  .link { color: #4a5db8; text-decoration: none; font-weight: 500; font-family: ui-monospace, SF Mono, monospace; }
  .link:hover { text-decoration: underline; }
  .muted { color: #888894; font-size: 0.82rem; }

  /* Headline */
  .headline { background: #1c1c28; color: #fff; border-radius: 8px; padding: 1.1rem 1.3rem; margin-bottom: 1rem; font-size: 1.05rem; font-weight: 500; line-height: 1.4; }

  /* Cards */
  .card { background: #fff; border: 1px solid #dbdbe1; border-radius: 8px; padding: 0.9rem 1.1rem; margin-bottom: 0.8rem; }
  .card.accent-blue { border-left: 4px solid #4a5db8; }
  .card.accent-amber { border-left: 4px solid #b89530; background: #fdfaef; }
  .card ul { margin: 0; padding-left: 1.3rem; }
  .card li { margin-bottom: 0.4rem; }
  .card li:last-child { margin-bottom: 0; }

  /* Meta */
  .meta { display: grid; grid-template-columns: max-content 1fr; gap: 0.4rem 1rem; font-size: 0.88rem; }
  .meta dt { color: #585866; font-weight: 500; }
  .meta dd { margin: 0; }
  .meta .ticket-list { list-style: none; padding: 0; margin: 0; }
  .meta .ticket-list li { padding: 0.15rem 0; font-size: 0.87rem; }

  /* Timeline */
  .timeline { list-style: none; padding: 0; margin: 0; }
  .timeline li { display: grid; grid-template-columns: 90px 1fr; gap: 0.7rem; padding: 0.35rem 0; border-bottom: 1px dashed #ebebf0; font-size: 0.87rem; align-items: baseline; }
  .timeline li:last-child { border-bottom: none; }
  .tl-date { color: #585866; font-family: ui-monospace, SF Mono, monospace; font-size: 0.78rem; }
  .tl-label { color: #1c1c28; }

  /* Messages */
  .messages-wrap { margin-top: 1rem; }
  .msg { background: #fff; border: 1px solid #dbdbe1; border-radius: 6px; margin-bottom: 0.5rem; border-left: 3px solid #4a5db8; font-size: 0.86rem; }
  .msg.outgoing { border-left-color: #888894; background: #fafafd; }
  .msg.private_note { border-left-color: #b89530; background: #fdfaef; }
  .msg.original { border-left-color: #c73a3a; }
  .msg-header { display: flex; gap: 0.6rem; flex-wrap: wrap; padding: 0.5rem 0.8rem; border-bottom: 1px solid #ebebf0; align-items: center; font-size: 0.78rem; }
  .badge { background: #4a5db8; color: #fff; padding: 0.08rem 0.5rem; border-radius: 99px; font-size: 0.66rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge.outgoing { background: #888894; }
  .badge.private_note { background: #b89530; }
  .badge.original { background: #c73a3a; }
  .msg-header .from { color: #1c1c28; font-weight: 500; }
  .msg .body { padding: 0.6rem 0.8rem; white-space: pre-wrap; word-wrap: break-word; color: #2a2a35; line-height: 1.5; font-size: 0.86rem; }
  .msg .body em.muted { font-style: italic; }
  .fold { margin-top: 0.4rem; }
  .fold summary { cursor: pointer; color: #4a5db8; font-size: 0.78rem; padding: 0.2rem 0; user-select: none; list-style: none; }
  .fold summary::-webkit-details-marker { display: none; }
  .fold summary::before { content: "▸ "; }
  .fold[open] summary::before { content: "▾ "; }
  .fold .rest { white-space: pre-wrap; padding-top: 0.4rem; color: #2a2a35; border-top: 1px dashed #ebebf0; margin-top: 0.4rem; }

  /* Section spacing */
  section { margin-bottom: 1.4rem; }
  section h2 { padding-bottom: 0; }
</style>
</head>
<body>
<h1>Customer history</h1>
<div class="subtitle">Seed: ticket #${ticketId} · ${esc(seedName)} · generated ${new Date().toISOString().slice(0, 10)}</div>

<div class="headline">${esc(analysis.headline)}</div>

<section>
  <div class="card accent-blue">
    <h2>What happened</h2>
    <ul>${li(analysis.what_happened)}</ul>
  </div>
</section>

<section>
  <div class="card accent-amber">
    <h2>What the agent should have done</h2>
    <ul>${li(analysis.what_should_have_happened)}</ul>
  </div>
</section>

${timelineHtml ? `<section>
  <div class="card">
    <h2>Key moments</h2>
    ${timelineHtml}
  </div>
</section>` : ""}

<section>
  <div class="card">
    <h2>Customer profile</h2>
    <dl class="meta">
      <dt>Name</dt><dd>${esc(seedName)}</dd>
      <dt>Emails</dt><dd>${[...candidates].map((e) => `<code>${esc(e)}</code>`).join(", ")}</dd>
      <dt>Tickets (${allTicketIds.size})</dt><dd><ul class="ticket-list">${ticketRows}</ul></dd>
      <dt>Messages</dt><dd>${messages.length}</dd>
    </dl>
  </div>
</section>

<section class="messages-wrap">
  <h2>Full thread (${messages.length})</h2>
  ${messagesHtml}
</section>

</body>
</html>`;

const outPath = `./customer_${ticketId}.html`;
await Bun.write(outPath, html);
console.log(`\n✓ Report saved: ${outPath}`);
console.log(`  Open with:  open ${outPath}`);
