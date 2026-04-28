import Anthropic from "@anthropic-ai/sdk";
import { sql } from "./db.ts";

const anthropic = new Anthropic();

const days = parseInt(process.argv[2] ?? "21", 10);

interface Sharer {
  author_handle: string;
  shares: number;
  total_likes: number;
  last_share: Date;
}

interface Mentioner {
  author_handle: string;
  mentions: number;
  total_likes: number;
  last_mention: Date;
}

interface BothLead {
  author_handle: string;
  mentions: number;
  shares: number;
  total: number;
}

async function analyzeSentiment(samples: string[]): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `Below are sample tweets (mix of url shares and @mentions) from people engaging with Swarajya Magazine (an Indian conservative-leaning publication covering policy, economics, India macro, defence).

Analyze the OVERALL SENTIMENT and BEHAVIOR PATTERNS. Output as HTML using these exact classes — no preamble, no wrapper, just the inner content:

<div class="sentiment-section">
  <h3>Overall sentiment</h3>
  <p>1-2 paragraph summary of the overall sentiment of people engaging with Swarajya — supportive? critical? neutral? Mix? What stands out?</p>
</div>

<div class="sentiment-section">
  <h3>Sharing patterns</h3>
  <ul>
    <li>Pattern observation 1 (e.g. "many shares come from auto-share apps like NaMo App")</li>
    <li>Pattern observation 2</li>
    <li>...</li>
  </ul>
</div>

<div class="sentiment-section">
  <h3>What this means for outreach</h3>
  <p>Practical takeaway for someone trying to convert these engaged users into paid subscribers</p>
</div>

TWEETS:
${samples.join("\n\n---\n\n")}`,
      },
    ],
  });
  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

async function run() {
  console.log(`Generating leads report for last ${days} days...`);

  const sharers = await sql<Sharer[]>`
    SELECT author_handle, count(*)::int as shares,
           coalesce(sum(like_count), 0)::int as total_likes,
           max(created_at) as last_share
    FROM tweets
    WHERE source LIKE 'url:%'
      AND author_handle != 'SwarajyaMag'
      AND created_at > NOW() - ${days + " days"}::INTERVAL
    GROUP BY author_handle
    ORDER BY shares DESC
    LIMIT 30
  `;

  const mentioners = await sql<Mentioner[]>`
    SELECT author_handle, count(*)::int as mentions,
           coalesce(sum(like_count), 0)::int as total_likes,
           max(created_at) as last_mention
    FROM tweets
    WHERE source = 'mention:SwarajyaMag'
      AND created_at > NOW() - ${days + " days"}::INTERVAL
    GROUP BY author_handle
    ORDER BY mentions DESC
    LIMIT 30
  `;

  const both = await sql<BothLead[]>`
    SELECT m.author_handle, m.mentions::int, s.shares::int,
           (m.mentions + s.shares)::int as total
    FROM (
      SELECT author_handle, count(*) as mentions
      FROM tweets WHERE source = 'mention:SwarajyaMag'
        AND created_at > NOW() - ${days + " days"}::INTERVAL
      GROUP BY author_handle
    ) m
    INNER JOIN (
      SELECT author_handle, count(*) as shares
      FROM tweets WHERE source LIKE 'url:%' AND author_handle != 'SwarajyaMag'
        AND created_at > NOW() - ${days + " days"}::INTERVAL
      GROUP BY author_handle
    ) s ON m.author_handle = s.author_handle
    ORDER BY total DESC
    LIMIT 25
  `;

  const totals = await sql<any[]>`
    SELECT
      (SELECT count(*) FROM tweets WHERE source LIKE 'url:%' AND author_handle != 'SwarajyaMag' AND created_at > NOW() - ${days + " days"}::INTERVAL)::int as url_shares,
      (SELECT count(distinct author_handle) FROM tweets WHERE source LIKE 'url:%' AND author_handle != 'SwarajyaMag' AND created_at > NOW() - ${days + " days"}::INTERVAL)::int as unique_sharers,
      (SELECT count(*) FROM tweets WHERE source = 'mention:SwarajyaMag' AND created_at > NOW() - ${days + " days"}::INTERVAL)::int as mentions,
      (SELECT count(distinct author_handle) FROM tweets WHERE source = 'mention:SwarajyaMag' AND created_at > NOW() - ${days + " days"}::INTERVAL)::int as unique_mentioners
  `;
  const t = totals[0];

  // Sample tweets for sentiment analysis (mix of shares and mentions)
  const samples = await sql<{ author_handle: string; text: string }[]>`
    (
      SELECT author_handle, text FROM tweets
      WHERE source LIKE 'url:%' AND author_handle != 'SwarajyaMag'
        AND length(text) > 30
        AND created_at > NOW() - ${days + " days"}::INTERVAL
      ORDER BY like_count DESC LIMIT 30
    )
    UNION ALL
    (
      SELECT author_handle, text FROM tweets
      WHERE source = 'mention:SwarajyaMag'
        AND length(text) > 30
        AND created_at > NOW() - ${days + " days"}::INTERVAL
      ORDER BY like_count DESC LIMIT 30
    )
  `;

  console.log(`Analyzing sentiment from ${samples.length} samples...`);
  const sampleTexts = samples.map((s) => `[@${s.author_handle}]\n${s.text}`);
  const sentimentHtml = await analyzeSentiment(sampleTexts);

  // Build tables
  const sharersTable = sharers
    .map(
      (r, i) => `<tr>
      <td>${i + 1}</td>
      <td><a href="https://x.com/${r.author_handle}" target="_blank">@${r.author_handle}</a></td>
      <td class="num">${r.shares}</td>
      <td class="num">${r.total_likes}</td>
      <td class="date">${r.last_share.toISOString().slice(0, 10)}</td>
    </tr>`
    )
    .join("\n");

  const mentionersTable = mentioners
    .map(
      (r, i) => `<tr>
      <td>${i + 1}</td>
      <td><a href="https://x.com/${r.author_handle}" target="_blank">@${r.author_handle}</a></td>
      <td class="num">${r.mentions}</td>
      <td class="num">${r.total_likes}</td>
      <td class="date">${r.last_mention.toISOString().slice(0, 10)}</td>
    </tr>`
    )
    .join("\n");

  const bothTable = both
    .map(
      (r, i) => `<tr>
      <td>${i + 1}</td>
      <td><a href="https://x.com/${r.author_handle}" target="_blank">@${r.author_handle}</a></td>
      <td class="num">${r.mentions}</td>
      <td class="num">${r.shares}</td>
      <td class="num highlight">${r.total}</td>
    </tr>`
    )
    .join("\n");

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Swarajya Lead Report — ${dateStr}</title>
<style>
  :root {
    --bg: #0d1117;
    --card: #161b22;
    --border: #30363d;
    --text: #e6edf3;
    --muted: #8b949e;
    --accent: #58a6ff;
    --green: #3fb950;
    --orange: #d29922;
    --pink: #f778ba;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    padding: 2rem;
    max-width: 900px;
    margin: 0 auto;
  }
  header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 1.25rem;
    margin-bottom: 2rem;
  }
  header h1 { font-size: 1.4rem; font-weight: 600; color: var(--text); }
  header .meta { color: var(--muted); font-size: 0.85rem; margin-top: 0.25rem; }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
    margin-top: 1rem;
  }
  .stat {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    text-align: center;
  }
  .stat .num { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
  .stat .label {
    font-size: 0.7rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 0.15rem;
  }
  .section {
    margin-bottom: 2.5rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.5rem;
  }
  .section h2 {
    font-size: 1.05rem;
    color: var(--green);
    margin-bottom: 1rem;
    font-weight: 600;
  }
  .section h2.orange { color: var(--orange); }
  .section h2.pink { color: var(--pink); }
  table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  th, td {
    padding: 0.55rem 0.5rem;
    text-align: left;
    border-bottom: 1px solid rgba(48,54,61,0.5);
  }
  th { color: var(--muted); font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.date { color: var(--muted); font-size: 0.8rem; }
  td.highlight { color: var(--orange); font-weight: 600; }
  table a { color: var(--accent); text-decoration: none; }
  table a:hover { text-decoration: underline; }
  .sentiment-section { margin-bottom: 1.5rem; }
  .sentiment-section h3 {
    font-size: 0.95rem;
    color: var(--accent);
    margin-bottom: 0.5rem;
    font-weight: 600;
  }
  .sentiment-section p { font-size: 0.92rem; margin-bottom: 0.5rem; }
  .sentiment-section ul { padding-left: 1.25rem; font-size: 0.92rem; }
  .sentiment-section li { margin-bottom: 0.35rem; }
  footer {
    border-top: 1px solid var(--border);
    padding-top: 1rem;
    margin-top: 1rem;
    color: var(--muted);
    font-size: 0.75rem;
    text-align: center;
  }
</style>
</head>
<body>
<header>
  <h1>Swarajya Lead Report</h1>
  <div class="meta">${dateStr} &middot; Last ${days} days</div>
  <div class="stats">
    <div class="stat"><div class="num">${t.url_shares}</div><div class="label">Article Shares</div></div>
    <div class="stat"><div class="num">${t.unique_sharers}</div><div class="label">Unique Sharers</div></div>
    <div class="stat"><div class="num">${t.mentions}</div><div class="label">@Mentions</div></div>
    <div class="stat"><div class="num">${t.unique_mentioners}</div><div class="label">Unique Mentioners</div></div>
  </div>
</header>

<div class="section">
  <h2 class="orange">Sentiment Analysis</h2>
  ${sentimentHtml}
</div>

<div class="section">
  <h2 class="pink">Highest Intent Leads (Mentioned + Shared)</h2>
  <p style="font-size:0.85rem;color:var(--muted);margin-bottom:0.75rem;">People who both share Swarajya articles AND mention @SwarajyaMag — strongest signal of engagement.</p>
  <table>
    <thead>
      <tr><th>#</th><th>Handle</th><th class="num">Mentions</th><th class="num">Shares</th><th class="num">Total</th></tr>
    </thead>
    <tbody>${bothTable}</tbody>
  </table>
</div>

<div class="section">
  <h2>Top Article Distributors</h2>
  <p style="font-size:0.85rem;color:var(--muted);margin-bottom:0.75rem;">People sharing swarajyamag.com URLs — your unpaid distribution network.</p>
  <table>
    <thead>
      <tr><th>#</th><th>Handle</th><th class="num">Shares</th><th class="num">Total Likes</th><th>Last Share</th></tr>
    </thead>
    <tbody>${sharersTable}</tbody>
  </table>
</div>

<div class="section">
  <h2>Top @SwarajyaMag Mentioners</h2>
  <p style="font-size:0.85rem;color:var(--muted);margin-bottom:0.75rem;">People mentioning @SwarajyaMag (replies, conversations, tagging).</p>
  <table>
    <thead>
      <tr><th>#</th><th>Handle</th><th class="num">Mentions</th><th class="num">Total Likes</th><th>Last Mention</th></tr>
    </thead>
    <tbody>${mentionersTable}</tbody>
  </table>
</div>

<footer>
  Generated from x-tweet-tracker data &middot; ${t.url_shares + t.mentions} total tweets analyzed
</footer>
</body>
</html>`;

  await Bun.write("leads-report.html", html);
  console.log("Written to leads-report.html");
  await sql.end();
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
