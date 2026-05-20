import Anthropic from "@anthropic-ai/sdk";

const BASE_URL = "https://api.twitter.com/2";
const TWEET_FIELDS = "id,text,created_at,author_id,entities,public_metrics,lang,referenced_tweets";
const USER_FIELDS = "username,name";

interface XUser { id: string; name: string; username: string }
interface XTweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  lang?: string;
  entities?: Record<string, unknown>;
  public_metrics?: { retweet_count: number; like_count: number; reply_count: number; quote_count: number };
  referenced_tweets?: Array<{ type: string; id: string }>;
}

const handleArg = process.argv[2];
const days = parseInt(process.argv[3] ?? "15", 10);

if (!handleArg) {
  console.error("Usage: bun scripts/analyze-user.ts <handle> [days=15]");
  process.exit(1);
}
const handle = handleArg.replace(/^@/, "");

function bearer(): string {
  const token = process.env["X_BEARER_TOKEN"];
  if (!token) throw new Error("X_BEARER_TOKEN required");
  return token;
}

async function xFetch(path: string, params: Record<string, string>): Promise<Response> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetch(url.toString(), {
    headers: { Authorization: `Bearer ${bearer()}`, "User-Agent": "x-tweet-tracker/1.0" },
  });
}

async function resolveUser(h: string): Promise<XUser | null> {
  const res = await xFetch(`/users/by/username/${h}`, { "user.fields": USER_FIELDS });
  if (!res.ok) {
    console.error(`Failed to resolve @${h}: HTTP ${res.status} ${await res.text()}`);
    return null;
  }
  const body = (await res.json()) as { data?: XUser };
  return body.data ?? null;
}

async function fetchTweetsSince(userId: string, startTime: string): Promise<XTweet[]> {
  const all: XTweet[] = [];
  let nextToken: string | undefined;
  let page = 0;
  while (true) {
    page++;
    const params: Record<string, string> = {
      "tweet.fields": TWEET_FIELDS,
      max_results: "100",
      start_time: startTime,
      exclude: "retweets",
    };
    if (nextToken) params["pagination_token"] = nextToken;

    const res = await xFetch(`/users/${userId}/tweets`, params);
    if (!res.ok) {
      console.error(`Tweet fetch page ${page} failed: HTTP ${res.status} ${await res.text()}`);
      break;
    }
    const body = (await res.json()) as {
      data?: XTweet[];
      meta?: { next_token?: string; result_count?: number };
    };
    const got = body.data ?? [];
    all.push(...got);
    console.log(`  page ${page}: ${got.length} tweets`);
    nextToken = body.meta?.next_token;
    if (!nextToken || got.length === 0) break;
    if (page >= 10) { console.warn("  hit page cap (10), stopping"); break; }
  }
  return all;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function run() {
  console.log(`Resolving @${handle}...`);
  const user = await resolveUser(handle);
  if (!user) { console.error("User not found."); process.exit(1); }
  console.log(`  → ${user.name} (id=${user.id})`);

  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  console.log(`Fetching tweets since ${startIso}...`);
  const tweets = await fetchTweetsSince(user.id, startIso);
  console.log(`Total fetched: ${tweets.length}`);

  if (tweets.length === 0) {
    console.log("No tweets in window.");
    return;
  }

  // Sort newest first
  tweets.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const original = tweets.filter((t) => {
    if (t.text.startsWith("RT @")) return false;
    const refs = t.referenced_tweets ?? [];
    if (refs.some((r) => r.type === "retweeted")) return false;
    return true;
  });
  const replies = original.filter((t) => t.text.startsWith("@"));
  const standalone = original.filter((t) => !t.text.startsWith("@"));

  const totalLikes = tweets.reduce((s, t) => s + (t.public_metrics?.like_count ?? 0), 0);
  const totalRTs = tweets.reduce((s, t) => s + (t.public_metrics?.retweet_count ?? 0), 0);
  const totalReplies = tweets.reduce((s, t) => s + (t.public_metrics?.reply_count ?? 0), 0);

  const digest = tweets
    .map((t) => {
      const m = t.public_metrics;
      const stats = m ? `[${m.like_count}♥ ${m.retweet_count}↻ ${m.reply_count}💬]` : "";
      const link = `https://x.com/${user.username}/status/${t.id}`;
      const urls = (t.entities as any)?.urls as Array<Record<string, string>> | undefined;
      const links = (urls ?? [])
        .filter((u) => {
          const exp = u["expanded_url"] ?? u["url"] ?? "";
          return !exp.includes("/photo/") && !exp.includes("/video/") && !exp.includes("/status/");
        })
        .map((u) => `${u["expanded_url"] ?? u["url"]} (${u["title"] ?? u["display_url"] ?? ""})`);
      const linkStr = links.length ? `\nLinks: ${links.join(" | ")}` : "";
      return `${t.created_at} ${stats} ${link}\n${t.text}${linkStr}`;
    })
    .join("\n\n---\n\n");

  console.log(`Analyzing with Claude (${tweets.length} tweets, ${digest.length} chars)...`);
  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: `You are a senior editorial researcher at Swarajya, an Indian magazine focused on policy, economics, defence, supply chains, and current affairs.

Below are the last ${days} days of tweets from @${user.username} (${user.name}) — ${tweets.length} tweets total. Your job is to produce a focused editorial analysis of what this person has been tweeting about.

TWEETS:
${digest}

Produce HTML output with these sections (no preamble, no wrapper, just the divs):

<div class="section">
  <h2>Top-line summary</h2>
  <p>2-3 sentence summary of what this person has been tweeting about and the dominant tone.</p>
</div>

<div class="section">
  <h2>Main themes</h2>
  <p>For each major theme (aim for 4-7), a sub-block:</p>
  <div class="theme">
    <h3>Theme name</h3>
    <p>2-3 sentences describing what they're saying and the angle they take.</p>
    <div class="evidence">
      <strong>Anchor tweets:</strong>
      <ul><li><a href="https://x.com/...">date — short quote or paraphrase</a></li></ul>
    </div>
  </div>
</div>

<div class="section">
  <h2>Notable claims & data points</h2>
  <ul>
    <li>Specific factual claim, number, or assertion — with link to source tweet</li>
  </ul>
</div>

<div class="section">
  <h2>Who/what they engage with</h2>
  <p>Other handles, publications, or institutions they've quoted, replied to, or argued against. Patterns of who they amplify vs. critique.</p>
</div>

<div class="section">
  <h2>Highest-engagement tweets</h2>
  <ul>
    <li><a href="...">date · likes/RTs · short summary</a></li>
  </ul>
  <p>Pick the 5 tweets with highest engagement.</p>
</div>

<div class="section">
  <h2>Story angles for Swarajya</h2>
  <ul>
    <li>2-4 specific story ideas a Swarajya reporter could pursue based on what's surfaced here.</li>
  </ul>
</div>

Rules:
- Be specific and ground every claim in the tweets shown. Use direct links (https://x.com/${user.username}/status/...).
- Prioritize substance over volume — skip throwaway tweets.
- If they're tweeting in a non-English language, note it but still summarize the substance.
- Output ONLY the HTML divs, no markdown, no \`\`\`, no commentary.`,
      },
    ],
  });

  const block = message.content[0];
  const insights = block.type === "text" ? block.text : "";

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata",
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>@${user.username} — last ${days} days</title>
<style>
  :root {
    --bg: #0d1117; --card: #161b22; --border: #30363d;
    --text: #e6edf3; --muted: #8b949e;
    --accent: #58a6ff; --green: #3fb950; --orange: #d29922;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg); color: var(--text); line-height: 1.7;
    padding: 2rem; max-width: 820px; margin: 0 auto;
  }
  header { border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 2rem; }
  header h1 { font-size: 1.4rem; font-weight: 600; }
  header .meta { color: var(--muted); font-size: 0.85rem; margin-top: 0.4rem; }
  .stats { display: flex; gap: 1.5rem; margin-top: 0.75rem; font-size: 0.82rem; color: var(--muted); }
  .stats span strong { color: var(--text); }
  .section {
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    padding: 1.5rem; margin-bottom: 1.25rem;
  }
  .section h2 {
    font-size: 1.05rem; color: var(--green); margin-bottom: 0.75rem; font-weight: 600;
  }
  .section h3 {
    font-size: 0.95rem; color: var(--orange); margin: 0.75rem 0 0.4rem; font-weight: 600;
  }
  .section p { font-size: 0.92rem; margin-bottom: 0.5rem; }
  .section ul { margin: 0.4rem 0 0.6rem 1.25rem; font-size: 0.9rem; }
  .section li { margin-bottom: 0.3rem; }
  .section a { color: var(--accent); text-decoration: none; }
  .section a:hover { text-decoration: underline; }
  .theme { padding: 0.75rem 0; border-top: 1px dashed var(--border); }
  .theme:first-of-type { border-top: 0; padding-top: 0.25rem; }
  .evidence strong { font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
  footer {
    border-top: 1px solid var(--border); padding-top: 1rem; margin-top: 1rem;
    color: var(--muted); font-size: 0.75rem; text-align: center;
  }
</style>
</head>
<body>
<header>
  <h1>@${escapeHtml(user.username)} — ${escapeHtml(user.name)}</h1>
  <div class="meta">${dateStr} &middot; Last ${days} days</div>
  <div class="stats">
    <span><strong>${tweets.length}</strong> tweets</span>
    <span><strong>${standalone.length}</strong> originals</span>
    <span><strong>${replies.length}</strong> replies</span>
    <span><strong>${totalLikes}</strong> likes</span>
    <span><strong>${totalRTs}</strong> RTs</span>
    <span><strong>${totalReplies}</strong> replies received</span>
  </div>
</header>

${insights}

<footer>Generated from ${tweets.length} tweets fetched directly from X API. No DB writes.</footer>
</body>
</html>`;

  const outPath = `analysis-${user.username}.html`;
  await Bun.write(outPath, html);
  console.log(`Written to ${outPath}`);
}

run().catch((err) => { console.error("Fatal:", err); process.exit(1); });
