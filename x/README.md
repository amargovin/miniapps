# X Tweet Tracker

A Bun-based daily cron service that collects tweets from X (Twitter) and stores them in PostgreSQL for editorial research and subscription lead generation at Swarajya Magazine.

## What this app does

This app runs once a day at 5am IST on Railway and collects three streams of data:

### 1. User timelines
Tracks specific X users (domain experts) and stores every new tweet they post. Currently tracking:
- @Normal_2610 — India macro, supply chain, energy
- @prasannavishy — Markets, India economy
- @Tushar15 — Politics, current affairs
- @Fintech03 — Finance, manufacturing

Users are stored in the `tracked_users` table. Adding a new user via `bun add-user @handle` is enough — no redeploy needed.

### 2. URL share monitoring
Searches X for tweets containing the URL `https://swarajyamag.com` (excluding retweets). Captures who is distributing Swarajya articles on the platform.

This is configured in the `url_monitors` table. To add another URL: `bun add-url https://example.com`.

### 3. @SwarajyaMag mention monitoring
Searches X for tweets that mention `@SwarajyaMag` (excluding self-tweets and retweets). Captures who is engaging in conversations about Swarajya — replies, tags, references.

The mention target is hardcoded in `src/poll.ts`. Currently only @SwarajyaMag.

## How "since_id" tracking works

To avoid re-reading tweets and keep API costs low, the app tracks a `since_id` watermark per source in the `poll_state` table. Each daily run only fetches tweets newer than the last seen ID. Once a tweet is captured, it is never fetched again.

This means:
- First run for a new user fetches up to 100 historical tweets
- Subsequent daily runs only pull what was posted since the last run
- Daily API cost is roughly proportional to tweet volume, not tracked-user count

## The daily flow on Railway

```
5am IST cron fires
  ↓
Run migrations (idempotent)
  ↓
For each tracked user:
  - Resolve handle → twitter_id (cached after first lookup)
  - Fetch tweets newer than since_id
  - Upsert into tweets table (ON CONFLICT DO NOTHING)
  - Update since_id watermark
  ↓
For each URL monitor:
  - Search recent tweets matching url:"<URL>" -is:retweet
  - Upsert results
  - Update since_id
  ↓
For each mention target:
  - Search recent tweets matching @<handle> -from:<handle> -is:retweet
  - Upsert results
  - Update since_id
  ↓
Exit cleanly (Railway re-fires next day)
```

## Local commands (run from your machine, hits Railway Postgres)

```bash
bun start              # Manually trigger a fetch run (same as Railway cron)
bun digest             # Daily digest HTML — original tweets from all tracked users
bun stories            # AI-synthesized story ideas (last 7 days, 15-20 pitches)
bun stories 336        # Story ideas from last 14 days
bun leads              # Swarajya lead report — sharers, mentioners, sentiment (21 days)
bun list               # Print tracked users, URL monitors, poll state
bun add-user @handle   # Add a user to track
bun add-url <url>      # Add a URL to monitor
```

All HTML outputs are written to the project root and gitignored.

## Database schema

| Table | Purpose |
|---|---|
| `tracked_users` | Handles to track, twitter_id cache, active flag |
| `tweets` | All captured tweets with full metadata, entities, engagement, raw JSON. `source` column distinguishes streams: `user:<handle>`, `url:<url>`, `mention:<handle>` |
| `url_monitors` | URLs being searched for |
| `poll_state` | `since_id` watermarks per source — the bookmark that prevents re-reading |
| `schema_migrations` | Tracks applied SQL migrations |

The `tweets` table stores the full X API response in `raw` (JSONB) plus parsed entities, so any field can be extracted later without re-fetching.

## What we use the data for

### Editorial story ideas (`bun stories`)
Pulls original tweets (no replies, no retweets) from all tracked users in the last N days. Sends them to Claude (Sonnet) which extracts 15-20 in-depth reporting story pitches — each with a hook, key data points from tweets, investigation questions, and source links back to the original tweet. Useful for editorial research.

### Daily digest (`bun digest`)
Pulls original tweets from all tracked users in the last 24h, sorts by engagement, splits into "Original Thoughts" vs "Sharing & Commenting" (tweets with external article links). Each tweet links back to the X post. No AI synthesis — just clean reading.

### Subscription lead intelligence (`bun leads`)
Identifies people most engaged with Swarajya for paid subscription outreach:
- **Top article distributors** — who shares swarajyamag.com URLs most
- **Top mentioners** — who mentions @SwarajyaMag in conversations
- **Highest intent leads** — people doing both (strongest signal)
- **Sentiment analysis** — Claude analyzes a sample of tweets to characterize how people are engaging (supportive? critical? auto-share bots?)

Goal: Build a ranked outreach list of warm leads. Engagement is done manually — no automated DMs/replies (X spam-flags those).

## Why this works for the Swarajya use case

The X API gives you **two clean signals** of audience engagement that are otherwise invisible:

1. **People sharing your content** — they've already read you and found value
2. **People mentioning you** — they're in your conversation orbit

These are warmer than cold prospects. Tracked over weeks, they form a ranked list of advocates who are most likely to convert to paid subscriptions if approached thoughtfully.

The tracked-user timelines serve a separate purpose: editorial research. Domain experts surface stories, data points, and arguments that wouldn't appear in mainstream news for days or weeks.

## Cost

- **X API** (pay-as-you-go): ~$0.005 per tweet read. Typical daily cost: $0.10–$0.30 for current setup.
- **Claude API** (Sonnet): ~$0.02–$0.03 per `bun stories` or `bun leads` run.
- **Railway**: ~$10/month (app + Postgres).

Total: roughly $20-30/month all-in.

## Architecture decisions

- **Bun runtime** — fast, native TypeScript, simple deploys
- **Postgres on Railway** — accessible from local machine for ad-hoc queries
- **`postgres` npm package** (not `pg`, not `Bun.sql`) — works cleanly with Bun
- **Read-only X Bearer Token** — no posting, no DMs, no write permissions needed
- **No web UI** — data lives in DB, queried locally via scripts or Postgres clients
- **Cron exits cleanly** — Railway fires it again the next day, no long-running process
- **`ON CONFLICT DO NOTHING`** for tweets — idempotent, safe to re-run anytime

## Future possibilities

- Schedule weekly `bun leads` and `bun stories` runs as additional Railway crons
- Email/Slack the digest instead of reading locally
- OAuth 2.0 setup to access bookmarks or post tweets (would require new auth flow)
- Scoring leads by influence (likes, follower count) to prioritize outreach
- Cross-user signal — when multiple tracked users tweet the same topic, surface as breaking signal
