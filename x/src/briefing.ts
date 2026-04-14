import { sql } from "./db.ts";

interface BriefingTweet {
  tweet_id: string;
  author_handle: string;
  text: string;
  created_at: Date;
  retweet_count: number;
  like_count: number;
  reply_count: number;
  entities: Record<string, unknown> | null;
}

function extractLinks(tweet: BriefingTweet): { url: string; label: string }[] {
  if (!tweet.entities) return [];
  const urls = tweet.entities["urls"] as Array<Record<string, string>> | undefined;
  if (!urls) return [];
  return urls
    .filter((u) => {
      const expanded = u["expanded_url"] ?? "";
      return !expanded.includes("/photo/") && !expanded.includes("/video/");
    })
    .map((u) => ({
      url: u["expanded_url"] ?? u["url"],
      label: u["title"] ?? u["display_url"] ?? u["expanded_url"] ?? u["url"],
    }));
}

function hasExternalLink(tweet: BriefingTweet): boolean {
  const links = extractLinks(tweet);
  return links.some(
    (l) => !l.url.includes("twitter.com") && !l.url.includes("x.com")
  );
}

function isQuoteTweet(tweet: BriefingTweet): boolean {
  const links = extractLinks(tweet);
  return links.some(
    (l) =>
      (l.url.includes("twitter.com/") || l.url.includes("x.com/")) &&
      l.url.includes("/status/")
  );
}

function tweetUrl(tweet: BriefingTweet): string {
  return `https://x.com/${tweet.author_handle}/status/${tweet.tweet_id}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function engagement(t: BriefingTweet): number {
  return t.like_count + t.retweet_count * 2 + t.reply_count;
}

function renderTweet(t: BriefingTweet): string {
  const links = extractLinks(t);
  const linksHtml =
    links.length > 0
      ? `<div class="links">${links.map((l) => `<a href="${l.url}" target="_blank">${l.label}</a>`).join(" &middot; ")}</div>`
      : "";
  const engHtml =
    t.like_count > 0 || t.retweet_count > 0
      ? `<div class="engagement">${t.like_count > 0 ? `<span>&#10084; ${t.like_count}</span>` : ""}${t.retweet_count > 0 ? `<span>&#128257; ${t.retweet_count}</span>` : ""}${t.reply_count > 0 ? `<span>&#128172; ${t.reply_count}</span>` : ""}</div>`
      : "";
  const cleanText = t.text.replace(/https:\/\/t\.co\/\w+/g, "").trim();

  return `<div class="tweet">
    <div class="tweet-header">
      <span class="handle">@${t.author_handle}</span>
      <span class="time">${formatTime(t.created_at)}</span>
      <a href="${tweetUrl(t)}" target="_blank" class="tweet-link">&#8599;</a>
    </div>
    <div class="text">${cleanText}</div>
    ${linksHtml}
    ${engHtml}
  </div>`;
}

export async function generateDailyDigest(hoursBack = 24): Promise<string> {
  const tweets = await sql<BriefingTweet[]>`
    SELECT tweet_id, author_handle, text, created_at,
           retweet_count, like_count, reply_count, entities
    FROM tweets
    WHERE created_at > NOW() - ${hoursBack + " hours"}::INTERVAL
      AND text NOT LIKE '@%'
    ORDER BY created_at DESC
  `;

  if (tweets.length === 0) {
    return emptyPage(hoursBack);
  }

  // Split into categories
  const withArticles: BriefingTweet[] = [];
  const originalThoughts: BriefingTweet[] = [];

  for (const t of tweets) {
    if (hasExternalLink(t)) {
      withArticles.push(t);
    } else {
      originalThoughts.push(t);
    }
  }

  // Sort each by engagement
  originalThoughts.sort((a, b) => engagement(b) - engagement(a));
  withArticles.sort((a, b) => engagement(b) - engagement(a));

  // Build sections
  const originalsHtml = originalThoughts.map(renderTweet).join("\n");
  const articlesHtml = withArticles.map(renderTweet).join("\n");

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const handles = [...new Set(tweets.map((t) => t.author_handle))]
    .map((h) => `@${h}`)
    .join(", ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Daily Digest — ${dateStr}</title>
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
    max-width: 760px;
    margin: 0 auto;
  }
  header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 1rem;
    margin-bottom: 2rem;
  }
  header h1 { font-size: 1.3rem; font-weight: 600; color: var(--text); }
  header .meta { color: var(--muted); font-size: 0.85rem; margin-top: 0.25rem; }
  .section { margin-bottom: 2.5rem; }
  .section h2 {
    font-size: 1rem;
    margin-bottom: 0.75rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .section h2 .count {
    background: var(--card);
    border: 1px solid var(--border);
    font-size: 0.7rem;
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
    color: var(--muted);
    font-weight: 500;
  }
  .section.original h2 { color: var(--green); }
  .section.articles h2 { color: var(--orange); }
  .tweet {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: 0.5rem;
  }
  .tweet:hover { border-color: rgba(88,166,255,0.3); }
  .tweet-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }
  .tweet-header .handle {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--accent);
  }
  .tweet-header .time {
    font-size: 0.7rem;
    color: var(--muted);
  }
  .tweet-header .tweet-link {
    margin-left: auto;
    color: var(--muted);
    text-decoration: none;
    font-size: 0.85rem;
    opacity: 0.5;
    transition: opacity 0.2s;
  }
  .tweet-header .tweet-link:hover { opacity: 1; color: var(--accent); }
  .tweet .text { font-size: 0.9rem; white-space: pre-wrap; word-wrap: break-word; }
  .tweet .links {
    margin-top: 0.5rem;
    font-size: 0.8rem;
  }
  .tweet .links a { color: var(--accent); text-decoration: none; }
  .tweet .links a:hover { text-decoration: underline; }
  .tweet .engagement {
    display: flex;
    gap: 1rem;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--muted);
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
  <h1>Daily Digest</h1>
  <div class="meta">${dateStr} &middot; ${tweets.length} original tweets &middot; ${handles}</div>
</header>

${originalThoughts.length > 0 ? `
<div class="section original">
  <h2>Original Thoughts <span class="count">${originalThoughts.length}</span></h2>
  ${originalsHtml}
</div>
` : ""}

${withArticles.length > 0 ? `
<div class="section articles">
  <h2>Sharing &amp; Commenting <span class="count">${withArticles.length}</span></h2>
  ${articlesHtml}
</div>
` : ""}

<footer>${tweets.length} original tweets from ${new Set(tweets.map((t) => t.author_handle)).size} account(s) &middot; sorted by engagement</footer>
</body>
</html>`;
}

function emptyPage(hoursBack: number): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Daily Digest</title>
<style>body{background:#0d1117;color:#8b949e;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;}
</style></head><body><p>No original tweets in the last ${hoursBack} hours.</p></body></html>`;
}

// CLI
const hours = parseInt(process.argv[2] ?? "24", 10);
console.log(`Generating daily digest (last ${hours}h)...`);
const html = await generateDailyDigest(hours);
const outPath = "daily-digest.html";
await Bun.write(outPath, html);
console.log(`Written to ${outPath}`);
await sql.end();
