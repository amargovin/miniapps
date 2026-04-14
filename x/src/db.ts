import postgres from "postgres";

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const sql = postgres(process.env["DATABASE_URL"], {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

export interface TweetRow {
  tweet_id: string;
  author_id: string;
  author_handle: string;
  text: string;
  created_at: Date;
  lang: string | null;
  retweet_count: number;
  like_count: number;
  reply_count: number;
  quote_count: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entities: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
  source: string;
}

export interface TrackedUser {
  id: number;
  handle: string;
  twitter_id: string | null;
  active: boolean;
  added_at: Date;
  last_fetched_at: Date | null;
  notes: string | null;
}

export interface UrlMonitor {
  id: number;
  url: string;
  active: boolean;
  added_at: Date;
  notes: string | null;
}

export interface PollState {
  id: number;
  source_type: string;
  source_key: string;
  since_id: string | null;
  last_polled_at: Date | null;
}

export async function upsertTweet(tweet: TweetRow): Promise<void> {
  await sql`
    INSERT INTO tweets (
      tweet_id, author_id, author_handle, text, created_at,
      lang, retweet_count, like_count, reply_count, quote_count,
      entities, raw, source
    ) VALUES (
      ${tweet.tweet_id},
      ${tweet.author_id},
      ${tweet.author_handle},
      ${tweet.text},
      ${tweet.created_at},
      ${tweet.lang},
      ${tweet.retweet_count},
      ${tweet.like_count},
      ${tweet.reply_count},
      ${tweet.quote_count},
      ${tweet.entities ? sql.json(tweet.entities) : null},
      ${sql.json(tweet.raw)},
      ${tweet.source}
    )
    ON CONFLICT (tweet_id) DO NOTHING
  `;
}

export async function getSinceId(
  sourceType: string,
  sourceKey: string
): Promise<string | null> {
  const rows = await sql<{ since_id: string | null }[]>`
    SELECT since_id
    FROM poll_state
    WHERE source_type = ${sourceType}
      AND source_key = ${sourceKey}
    LIMIT 1
  `;
  return rows[0]?.since_id ?? null;
}

export async function setSinceId(
  sourceType: string,
  sourceKey: string,
  sinceId: string
): Promise<void> {
  await sql`
    INSERT INTO poll_state (source_type, source_key, since_id, last_polled_at)
    VALUES (${sourceType}, ${sourceKey}, ${sinceId}, NOW())
    ON CONFLICT (source_type, source_key) DO UPDATE
      SET since_id = EXCLUDED.since_id,
          last_polled_at = EXCLUDED.last_polled_at
  `;
}

export async function getTrackedUsers(): Promise<TrackedUser[]> {
  return sql<TrackedUser[]>`
    SELECT id, handle, twitter_id, active, added_at, last_fetched_at, notes
    FROM tracked_users
    WHERE active = TRUE
    ORDER BY id
  `;
}

export async function getUrlMonitors(): Promise<UrlMonitor[]> {
  return sql<UrlMonitor[]>`
    SELECT id, url, active, added_at, notes
    FROM url_monitors
    WHERE active = TRUE
    ORDER BY id
  `;
}

export async function upsertUserTwitterId(
  handle: string,
  twitterId: string
): Promise<void> {
  await sql`
    UPDATE tracked_users
    SET twitter_id = ${twitterId}
    WHERE handle = ${handle}
  `;
}

export async function updateUserLastFetched(handle: string): Promise<void> {
  await sql`
    UPDATE tracked_users
    SET last_fetched_at = NOW()
    WHERE handle = ${handle}
  `;
}
