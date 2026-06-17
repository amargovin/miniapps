---
name: XAPI
description: Access the X (Twitter) API v2 for read-only operations - look up users, fetch user timelines, search recent tweets (7-day window), find URL shares and mentions. USE WHEN user wants to query X/Twitter data, fetch tweets from a handle, search tweets by URL or mention, look up an X user, or build any X-data feature.
---

# X (Twitter) API v2 — Read-Only Access

Use this when you need to pull data from X. Auth is Bearer Token, scope is read-only, billing is pay-as-you-go (~$0.005 per tweet read — be conservative).

## Auth

Bearer Token lives in `~/.claude/.env` as `X_BEARER_TOKEN`. Load it before any call:

```bash
set -a; source ~/.claude/.env; set +a
```

Every request sends:
```
Authorization: Bearer $X_BEARER_TOKEN
```

Base URL: `https://api.twitter.com/2`

## The three endpoints you actually need

### 1. Look up a user by handle

```bash
curl -s "https://api.twitter.com/2/users/by/username/elonmusk?user.fields=username,name" \
  -H "Authorization: Bearer $X_BEARER_TOKEN"
```

Returns `{ data: { id, name, username } }`. The `id` is what every other endpoint needs — cache it, don't re-resolve.

### 2. Fetch a user's recent tweets

```bash
curl -s "https://api.twitter.com/2/users/$USER_ID/tweets?max_results=100&tweet.fields=id,text,created_at,author_id,entities,public_metrics,lang&expansions=author_id&user.fields=username,name&since_id=$SINCE_ID" \
  -H "Authorization: Bearer $X_BEARER_TOKEN"
```

- `max_results`: 5–100
- `since_id` (optional): only return tweets newer than this — use this to avoid re-paying for tweets you've already seen
- Response: `{ data: [tweets], includes: { users: [...] }, meta: { newest_id } }`

### 3. Search recent tweets (last 7 days only)

```bash
curl -s --get "https://api.twitter.com/2/tweets/search/recent" \
  --data-urlencode 'query=url:"https://swarajyamag.com" -is:retweet' \
  --data-urlencode "tweet.fields=id,text,created_at,author_id,entities,public_metrics,lang" \
  --data-urlencode "expansions=author_id" \
  --data-urlencode "user.fields=username,name" \
  --data-urlencode "max_results=100" \
  -H "Authorization: Bearer $X_BEARER_TOKEN"
```

The recent-search endpoint **only goes back 7 days**. For older data you need the full-archive endpoint (academic/enterprise tier — not on this token).

#### Useful query operators

| Operator | Example | Meaning |
|---|---|---|
| `from:` | `from:elonmusk` | Tweets by a user |
| `to:` | `to:elonmusk` | Replies to a user |
| `@handle` | `@SwarajyaMag` | Mentions of a user |
| `url:` | `url:"https://swarajyamag.com"` | Tweets containing this URL (use quotes) |
| `-is:retweet` | `@x -is:retweet` | Exclude retweets |
| `-is:reply` | `from:x -is:reply` | Exclude replies (original tweets only) |
| `-from:x` | `@x -from:x` | Exclude self-tweets when watching mentions |
| `lang:` | `lang:en` | Filter by language |

Combine: `@SwarajyaMag -from:SwarajyaMag -is:retweet` = real mentions, not self-tweets or RTs.

## Response shape (tweets)

```json
{
  "data": [
    {
      "id": "1234567890",
      "text": "...",
      "created_at": "2026-06-17T10:00:00.000Z",
      "author_id": "44196397",
      "lang": "en",
      "entities": { "urls": [...], "mentions": [...], "hashtags": [...] },
      "public_metrics": { "retweet_count": 0, "reply_count": 0, "like_count": 0, "quote_count": 0 }
    }
  ],
  "includes": { "users": [{ "id": "44196397", "name": "...", "username": "..." }] },
  "meta": { "newest_id": "1234567890", "oldest_id": "...", "result_count": 1, "next_token": "..." }
}
```

`includes.users` lets you map `author_id` → handle/name without a separate lookup.

## Operational rules

- **Pay-as-you-go: ~$0.005/tweet read.** Always pass `since_id` on repeat polls. Set `max_results` to the smallest value that gets the job done.
- **Rate limits return HTTP 429.** Don't loop and retry — log it, return empty, move on. The reference implementation in `/Users/amar/Desktop/apps/x/src/xClient.ts` shows the graceful pattern (warn + return empty, never throw).
- **Read-only token.** No posting, no DMs, no follows, no deletes are possible with this Bearer Token. If the user asks to send a tweet, tell them this token can't.
- **No streaming on this tier.** Poll, don't subscribe.
- **Search window = 7 days.** Anything older requires the full-archive endpoint (not available on this token).
- **Pagination via `next_token`.** Pass `next_token=...` to walk results. Only paginate when the user explicitly wants more than the first batch — each page costs money.

## Reference implementation

A production polling client lives at `/Users/amar/Desktop/apps/x/src/xClient.ts` (Bun + TypeScript). Read it before building your own — it already handles 429s, since_id, expansions, and the response shape. If the user is working in that project, prefer extending that file over writing new code.

## Quick test (verify token works)

```bash
set -a; source ~/.claude/.env; set +a
curl -s "https://api.twitter.com/2/users/by/username/jack" \
  -H "Authorization: Bearer $X_BEARER_TOKEN" | jq .
```

Should return Jack Dorsey's user object. If you get `{"title":"Unauthorized",...}` the token is wrong; if you get `{"errors":[...]}` the request is malformed.
