const BASE_URL = "https://api.twitter.com/2";

const TWEET_FIELDS = "id,text,created_at,author_id,entities,public_metrics,lang";
const EXPANSIONS = "author_id";
const USER_FIELDS = "username,name";

export interface XUser {
  id: string;
  name: string;
  username: string;
}

export interface XTweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  lang?: string;
  entities?: Record<string, unknown>;
  public_metrics?: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
}

export interface XApiResponse {
  tweets: XTweet[];
  users: XUser[];
  newestId: string | null;
}

function bearerToken(): string {
  const token = process.env["X_BEARER_TOKEN"];
  if (!token) throw new Error("X_BEARER_TOKEN environment variable is required");
  return token;
}

async function xFetch(path: string, params: Record<string, string>): Promise<Response> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${bearerToken()}`,
      "User-Agent": "x-tweet-tracker/1.0",
    },
  });
}

export async function getUserByUsername(handle: string): Promise<XUser | null> {
  try {
    const res = await xFetch(`/users/by/username/${handle}`, {
      "user.fields": USER_FIELDS,
    });

    if (res.status === 429) {
      console.warn(`[xClient] Rate limited fetching user @${handle}`);
      return null;
    }

    if (!res.ok) {
      console.warn(`[xClient] Error fetching user @${handle}: HTTP ${res.status}`);
      return null;
    }

    const body = (await res.json()) as { data?: XUser };
    return body.data ?? null;
  } catch (err) {
    console.error(`[xClient] Exception fetching user @${handle}:`, err);
    return null;
  }
}

export async function getUserTweets(
  userId: string,
  sinceId: string | null,
  maxResults = 100
): Promise<XApiResponse> {
  const params: Record<string, string> = {
    "tweet.fields": TWEET_FIELDS,
    expansions: EXPANSIONS,
    "user.fields": USER_FIELDS,
    max_results: String(Math.min(maxResults, 100)),
  };

  if (sinceId) {
    params["since_id"] = sinceId;
  }

  try {
    const res = await xFetch(`/users/${userId}/tweets`, params);

    if (res.status === 429) {
      console.warn(`[xClient] Rate limited fetching tweets for user ${userId}`);
      return { tweets: [], users: [], newestId: null };
    }

    if (!res.ok) {
      console.warn(`[xClient] Error fetching tweets for user ${userId}: HTTP ${res.status}`);
      return { tweets: [], users: [], newestId: null };
    }

    const body = (await res.json()) as {
      data?: XTweet[];
      includes?: { users?: XUser[] };
      meta?: { newest_id?: string };
    };

    return {
      tweets: body.data ?? [],
      users: body.includes?.users ?? [],
      newestId: body.meta?.newest_id ?? null,
    };
  } catch (err) {
    console.error(`[xClient] Exception fetching tweets for user ${userId}:`, err);
    return { tweets: [], users: [], newestId: null };
  }
}

export async function searchRecentTweets(
  query: string,
  sinceId: string | null,
  maxResults = 100
): Promise<XApiResponse> {
  const params: Record<string, string> = {
    query,
    "tweet.fields": TWEET_FIELDS,
    expansions: EXPANSIONS,
    "user.fields": USER_FIELDS,
    max_results: String(Math.min(maxResults, 100)),
  };

  if (sinceId) {
    params["since_id"] = sinceId;
  }

  try {
    const res = await xFetch("/tweets/search/recent", params);

    if (res.status === 429) {
      console.warn(`[xClient] Rate limited searching tweets for query: ${query}`);
      return { tweets: [], users: [], newestId: null };
    }

    if (!res.ok) {
      console.warn(`[xClient] Error searching tweets: HTTP ${res.status}`);
      return { tweets: [], users: [], newestId: null };
    }

    const body = (await res.json()) as {
      data?: XTweet[];
      includes?: { users?: XUser[] };
      meta?: { newest_id?: string };
    };

    return {
      tweets: body.data ?? [],
      users: body.includes?.users ?? [],
      newestId: body.meta?.newest_id ?? null,
    };
  } catch (err) {
    console.error(`[xClient] Exception searching tweets for query "${query}":`, err);
    return { tweets: [], users: [], newestId: null };
  }
}
