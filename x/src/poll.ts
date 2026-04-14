import {
  getTrackedUsers,
  getUrlMonitors,
  getSinceId,
  setSinceId,
  upsertTweet,
  upsertUserTwitterId,
  updateUserLastFetched,
  type TweetRow,
} from "./db.ts";
import {
  getUserByUsername,
  getUserTweets,
  searchRecentTweets,
  type XTweet,
  type XUser,
} from "./xClient.ts";

function mapTweet(
  tweet: XTweet,
  authorHandle: string,
  source: string
): TweetRow {
  const metrics = tweet.public_metrics ?? {
    retweet_count: 0,
    like_count: 0,
    reply_count: 0,
    quote_count: 0,
  };

  return {
    tweet_id: tweet.id,
    author_id: tweet.author_id,
    author_handle: authorHandle,
    text: tweet.text,
    created_at: new Date(tweet.created_at),
    lang: tweet.lang ?? null,
    retweet_count: metrics.retweet_count,
    like_count: metrics.like_count,
    reply_count: metrics.reply_count,
    quote_count: metrics.quote_count,
    entities: tweet.entities ?? null,
    raw: tweet as unknown as Record<string, unknown>,
    source,
  };
}

function resolveHandle(authorId: string, users: XUser[]): string {
  return users.find((u) => u.id === authorId)?.username ?? authorId;
}

export async function pollUserTimelines(): Promise<void> {
  const users = await getTrackedUsers();
  console.log(`[poll] Polling timelines for ${users.length} tracked user(s)`);

  for (const user of users) {
    try {
      let twitterId = user.twitter_id;

      // Resolve twitter_id if not yet stored
      if (!twitterId) {
        console.log(`[poll] Resolving Twitter ID for @${user.handle}`);
        const apiUser = await getUserByUsername(user.handle);
        await Bun.sleep(500);

        if (!apiUser) {
          console.warn(`[poll] Could not resolve Twitter ID for @${user.handle}, skipping`);
          continue;
        }

        twitterId = apiUser.id;
        await upsertUserTwitterId(user.handle, twitterId);
        console.log(`[poll] Resolved @${user.handle} → ${twitterId}`);
      }

      const sinceId = await getSinceId("user", twitterId);
      console.log(
        `[poll] Fetching tweets for @${user.handle} (since_id: ${sinceId ?? "none"})`
      );

      const { tweets, users: includes, newestId } = await getUserTweets(
        twitterId,
        sinceId
      );

      await Bun.sleep(500);

      if (tweets.length === 0) {
        console.log(`[poll] No new tweets for @${user.handle}`);
        await updateUserLastFetched(user.handle);
        continue;
      }

      console.log(`[poll] Got ${tweets.length} tweet(s) for @${user.handle}`);

      for (const tweet of tweets) {
        const handle = resolveHandle(tweet.author_id, includes);
        const row = mapTweet(tweet, handle, `user:${user.handle}`);
        await upsertTweet(row);
      }

      if (newestId) {
        await setSinceId("user", twitterId, newestId);
      }

      await updateUserLastFetched(user.handle);
    } catch (err) {
      console.error(`[poll] Error processing user @${user.handle}:`, err);
    }
  }
}

export async function pollUrlMonitors(): Promise<void> {
  const monitors = await getUrlMonitors();
  console.log(`[poll] Polling ${monitors.length} URL monitor(s)`);

  for (const monitor of monitors) {
    try {
      const query = `url:"${monitor.url}" -is:retweet`;
      const sinceId = await getSinceId("url", monitor.url);

      console.log(`[poll] Searching for URL: ${monitor.url} (since_id: ${sinceId ?? "none"})`);

      const { tweets, users: includes, newestId } = await searchRecentTweets(
        query,
        sinceId
      );

      await Bun.sleep(500);

      if (tweets.length === 0) {
        console.log(`[poll] No new tweets mentioning: ${monitor.url}`);
        continue;
      }

      console.log(`[poll] Got ${tweets.length} tweet(s) mentioning: ${monitor.url}`);

      for (const tweet of tweets) {
        const handle = resolveHandle(tweet.author_id, includes);
        const row = mapTweet(tweet, handle, `url:${monitor.url}`);
        await upsertTweet(row);
      }

      if (newestId) {
        await setSinceId("url", monitor.url, newestId);
      }
    } catch (err) {
      console.error(`[poll] Error processing URL monitor ${monitor.url}:`, err);
    }
  }
}

export async function pollMentionMonitors(): Promise<void> {
  // Hardcoded for now — could move to a DB table later
  const handles = ["SwarajyaMag"];
  console.log(`[poll] Polling ${handles.length} mention monitor(s)`);

  for (const handle of handles) {
    try {
      const query = `@${handle} -from:${handle} -is:retweet`;
      const sinceId = await getSinceId("mention", handle);

      console.log(`[poll] Searching for mentions of @${handle} (since_id: ${sinceId ?? "none"})`);

      const { tweets, users: includes, newestId } = await searchRecentTweets(
        query,
        sinceId
      );

      await Bun.sleep(500);

      if (tweets.length === 0) {
        console.log(`[poll] No new mentions of @${handle}`);
        continue;
      }

      console.log(`[poll] Got ${tweets.length} tweet(s) mentioning @${handle}`);

      for (const tweet of tweets) {
        const authorHandle = resolveHandle(tweet.author_id, includes);
        const row = mapTweet(tweet, authorHandle, `mention:${handle}`);
        await upsertTweet(row);
      }

      if (newestId) {
        await setSinceId("mention", handle, newestId);
      }
    } catch (err) {
      console.error(`[poll] Error processing mention monitor @${handle}:`, err);
    }
  }
}
