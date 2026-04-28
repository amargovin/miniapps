import Anthropic from "@anthropic-ai/sdk";
import { sql } from "./db.ts";

const anthropic = new Anthropic();

const hours = parseInt(process.argv[2] ?? "168", 10); // default 7 days

async function run() {
  console.log(`Pulling original tweets from last ${hours}h...`);

  const tweets = await sql`
    SELECT tweet_id, author_handle, text, like_count, retweet_count, created_at, entities
    FROM tweets
    WHERE source LIKE 'user:%'
      AND text NOT LIKE '@%'
      AND text NOT LIKE 'RT @%'
      AND length(text) > 80
      AND created_at > NOW() - ${hours + " hours"}::INTERVAL
    ORDER BY like_count DESC
  `;

  if (tweets.length === 0) {
    console.log("No tweets found.");
    await sql.end();
    return;
  }

  console.log(`Found ${tweets.length} original tweets. Analyzing...`);

  const digest = tweets
    .map((t) => {
      const urls = (t.entities as any)?.urls as Array<Record<string, string>> | undefined;
      const links = (urls ?? [])
        .filter((u) => {
          const expanded = u["expanded_url"] ?? u["url"] ?? "";
          return !expanded.includes("/photo/") && !expanded.includes("/video/");
        })
        .map((u) => {
          const url = u["expanded_url"] ?? u["unwound_url"] ?? u["url"];
          const label = u["title"] ?? u["display_url"] ?? url;
          return `${url} (${label})`;
        });
      const linkStr = links.length > 0 ? `\nLinks:\n${links.map(l => `  - ${l}`).join("\n")}` : "";
      const tweetLink = `https://x.com/${t.author_handle}/status/${(t as any).tweet_id}`;
      return `[@${t.author_handle}, ${t.like_count} likes] ${tweetLink}\n${t.text}${linkStr}`;
    })
    .join("\n\n---\n\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 10000,
    messages: [
      {
        role: "user",
        content: `You are a senior editorial researcher at Swarajya, an Indian magazine known for in-depth reporting on supply chains, technology, energy, defence, economics, and policy.

Below are original tweets from people we track — domain experts who tweet about India's industrial economy. Your job is to extract **story ideas for in-depth reporting or analysis pieces**.

TWEETS:
${digest}

For each story idea, output this exact HTML structure. No preamble, no wrapper:

<div class="story">
  <h3>Story headline</h3>
  <div class="hook">One-paragraph pitch — what's the story, why now, why does it matter to Swarajya's audience</div>
  <div class="datapoints">
    <strong>Key data points from tweets:</strong>
    <ul><li>Specific numbers, claims, or facts that anchor this story</li></ul>
  </div>
  <div class="questions">
    <strong>Questions to investigate:</strong>
    <ul><li>What a reporter should dig into</li></ul>
  </div>
  <div class="refs">Links shared: <a href="...">label</a></div>
  <div class="sources">Sources: @handle1, @handle2 — who surfaced this</div>
</div>

Rules:
- Extract 15-20 story ideas. Aim for breadth — each distinct topic or claim worth investigating should be its own story idea.
- Each story must be anchored in SPECIFIC data points or claims from the tweets — not generic topics.
- Merge tweets from different users about the same theme into one story idea.
- Prioritize stories where multiple users are discussing the same issue (cross-signal).
- Prioritize tweets with high engagement — that's audience validation.
- Skip stock tips, fund movements, and individual company promotions unless they reveal a broader systemic story.
- The tone should be editorial — these are pitches from a researcher to an editor-in-chief.
- IMPORTANT: Each tweet has a direct link (x.com/handle/status/...) and may have additional links the author shared. In the refs div, ALWAYS include:
  1. The tweet links (x.com URLs) for the tweets that informed this story — so the editor can read the original
  2. Any external links (articles, reports, buymeacoffee, substack, etc.) the author shared
  Use <a href="..." target="_blank"> tags with readable labels.
- Every story MUST have a refs div with at least the source tweet links.
- Output ONLY the HTML divs.`,
      },
    ],
  });

  const block = message.content[0];
  const insights = block.type === "text" ? block.text : "";

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const days = Math.round(hours / 24);
  const handles = [...new Set(tweets.map((t) => t.author_handle))].map((h) => `@${h}`).join(", ");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Story Ideas — ${dateStr}</title>
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
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.7;
    padding: 2rem;
    max-width: 800px;
    margin: 0 auto;
  }
  header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 1rem;
    margin-bottom: 2rem;
  }
  header h1 { font-size: 1.3rem; font-weight: 600; color: var(--text); }
  header .meta { color: var(--muted); font-size: 0.85rem; margin-top: 0.25rem; }
  .story {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.5rem;
    margin-bottom: 1.25rem;
  }
  .story:hover { border-color: rgba(88,166,255,0.3); }
  .story h3 {
    font-size: 1.05rem;
    color: var(--green);
    margin-bottom: 0.75rem;
    font-weight: 600;
  }
  .story .hook {
    font-size: 0.92rem;
    color: var(--text);
    margin-bottom: 0.75rem;
  }
  .story .datapoints,
  .story .questions {
    margin-bottom: 0.75rem;
  }
  .story .datapoints strong,
  .story .questions strong {
    font-size: 0.8rem;
    color: var(--orange);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .story ul {
    margin: 0.35rem 0 0 1.25rem;
    font-size: 0.88rem;
    color: var(--text);
  }
  .story li { margin-bottom: 0.25rem; }
  .story .refs {
    font-size: 0.82rem;
    color: var(--muted);
    margin-bottom: 0.5rem;
  }
  .story .refs a { color: var(--accent); text-decoration: none; }
  .story .refs a:hover { text-decoration: underline; }
  .story .sources {
    font-size: 0.78rem;
    color: var(--muted);
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
  }
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
  <h1>Story Ideas</h1>
  <div class="meta">${dateStr} &middot; Last ${days} days &middot; ${tweets.length} tweets analyzed &middot; ${handles}</div>
</header>

${insights}

<footer>Generated from ${tweets.length} original tweets by ${handles}</footer>
</body>
</html>`;

  const outPath = "story-ideas.html";
  await Bun.write(outPath, html);
  console.log(`Written to ${outPath}`);
  await sql.end();
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
