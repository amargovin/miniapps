/**
 * EventStream Morning Report — daily WAR + top-articles to a Google Chat space.
 *
 * Runs as a Railway cron job (or any Node 20+ environment with fetch).
 * Calls the EventStream HTTP API, formats a Cards V2 message, posts to the
 * Google Chat incoming webhook.
 *
 * Required env vars:
 *   EVENTSTREAM_BASE_URL    e.g. https://eventstream.swarajyamag.com
 *   EVENTSTREAM_TOKEN       Bearer token (from API_TOKENS env on EventStream)
 *   GCHAT_WEBHOOK_URL       Google Chat space's incoming webhook URL
 *
 * Optional:
 *   REPORT_TIMEZONE         IANA tz for date labels. Default: Asia/Kolkata.
 */

const EVENTSTREAM_BASE_URL = requiredEnv("EVENTSTREAM_BASE_URL").replace(/\/+$/, "");
const EVENTSTREAM_TOKEN = requiredEnv("EVENTSTREAM_TOKEN");
const GCHAT_WEBHOOK_URL = requiredEnv("GCHAT_WEBHOOK_URL");
const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE ?? "Asia/Kolkata";

const GREY = "#5f6368";

// ---------------------------------------------------------------------------
// Types matching the EventStream API responses
// ---------------------------------------------------------------------------

interface WarResponse {
  war_all: number;
  war_subscribers: number;
  war_readers: number;
  range: { from: string; to: string; days: number; as_of: string | null };
}

interface Article {
  story_headline: string;
  story_id?: string;
  story_author?: string;
  unique_reads: number;
}

interface TopArticlesResponse {
  range: { from: string; to: string; days: number };
  articles: Article[];
}

// ---------------------------------------------------------------------------
// EventStream API
// ---------------------------------------------------------------------------

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${EVENTSTREAM_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${EVENTSTREAM_TOKEN}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`EventStream ${path} -> HTTP ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

const fetchWar = (days: number, asOf?: string) => {
  const qs = new URLSearchParams({ days: String(days) });
  if (asOf) qs.set("as_of", asOf);
  return apiGet<WarResponse>(`/api/reports/war?${qs.toString()}`);
};

const fetchTopArticles = async (days: number, limit: number) =>
  (await apiGet<TopArticlesResponse>(`/api/reports/top-articles?days=${days}&limit=${limit}`))
    .articles ?? [];

// ---------------------------------------------------------------------------
// Date helpers (IST-aware)
// ---------------------------------------------------------------------------

/** Now offset by N×24h, returned as an ISO 8601 datetime string in UTC.
 *  This is what we send to /api/reports/war as `as_of` — a precise
 *  moment, no timezone ambiguity, always yields a clean 7×24h window. */
function nowMinus(daysOffset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString();
}

/** YYYY-MM-DD label of an instant rendered in REPORT_TIMEZONE. Used for
 *  the row label in the email — e.g. "8 May" for the IST day that the
 *  moment falls into. */
function tzDateLabel(isoMoment: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoMoment));
}

/** "8 May 2026" style label for the card header. */
function todayLabel(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: REPORT_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const escapeHtml = (s: string): string =>
  (s ?? "").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const fmtNum = (n: number): string => n.toLocaleString("en-IN");

// ---------------------------------------------------------------------------
// Google Chat Cards V2 payload
// ---------------------------------------------------------------------------

function buildChatPayload(
  today: string,
  warRows: Array<[string, WarResponse]>,
  articles: Article[]
) {
  const warLines = warRows.map(
    ([date, w]) =>
      `<b>${date}</b>  ·  <b>${fmtNum(w.war_all)}</b> all  ` +
      `<font color="${GREY}">·  ${fmtNum(w.war_readers)} readers  ` +
      `·  ${fmtNum(w.war_subscribers)} subs</font>`
  );

  const articleBlocks = articles.map((art, i) => {
    const headline = escapeHtml((art.story_headline ?? "").trim());
    const author = escapeHtml(art.story_author ?? "Unknown");
    return (
      `<b>${i + 1}. ${headline}</b><br>` +
      `<font color="${GREY}">by ${author}  ·  ${fmtNum(art.unique_reads ?? 0)} reads</font>`
    );
  });

  return {
    cardsV2: [
      {
        cardId: "morning-report",
        card: {
          header: {
            title: `Reader Report — ${today}`,
            subtitle: "EventStream daily summary",
          },
          sections: [
            {
              header: "Weekly Active Readers (WAR)",
              widgets: [{ textParagraph: { text: warLines.join("<br>") } }],
            },
            {
              header: "Top 5 Articles · last 7 days · by unique readers",
              widgets: [{ textParagraph: { text: articleBlocks.join("<br><br>") } }],
            },
          ],
        },
      },
    ],
  };
}

async function sendChatMessage(payload: object): Promise<void> {
  const res = await fetch(GCHAT_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Chat webhook -> HTTP ${res.status}: ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  // Three precise moments: 48h ago, 24h ago, now. Each gives the API
  // a full ISO datetime so the window is unambiguously 7×24h ending
  // at that instant.
  const moments = [nowMinus(-2), nowMinus(-1), nowMinus(0)];
  const warRows: Array<[string, WarResponse]> = [];
  for (const m of moments) {
    warRows.push([tzDateLabel(m), await fetchWar(7, m)]);
  }
  const articles = await fetchTopArticles(7, 5);

  const payload = buildChatPayload(todayLabel(), warRows, articles);
  await sendChatMessage(payload);

  console.log(
    JSON.stringify({
      status: "ok",
      today: todayLabel(),
      war_today: warRows.at(-1)?.[1],
      top_article: articles[0]?.story_headline ?? null,
    })
  );
}

main().catch((err) => {
  console.error("Morning report failed:", err);
  process.exit(1);
});
