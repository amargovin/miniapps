
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.
- Use `postgres` npm package for Postgres (not `pg`, not `Bun.sql`).

## What This App Is

X Tweet Tracker — a daily cron service that collects tweets from tracked X (Twitter) users, monitors who shares swarajyamag.com links, and who mentions @SwarajyaMag. Data stored in Railway Postgres.

**Owner**: Amar, editor at Swarajya Magazine (swarajyamag.com). Uses this to:
1. Track what specific domain experts are tweeting (supply chain, energy, defence, India macro)
2. Find who's sharing/mentioning Swarajya content (potential subscription leads)
3. Generate story ideas for in-depth reporting based on what tracked users are discussing

## Architecture

- **Runtime**: Bun
- **Database**: PostgreSQL hosted on Railway (accessible from local machine)
- **X API**: v2 pay-as-you-go, Bearer Token auth, read-only
- **AI**: Anthropic Claude API (Sonnet) for story idea synthesis
- **Deployment**: Railway cron service, runs daily at 5am IST (23:30 UTC)
- **Railway project**: `1db03f5c-c650-4b43-b9f1-c6a2780b7899`, service: `x-tracker`
- **GitHub**: `amargovin/miniapps` (monorepo, this app is in `x/` folder)

## Commands

```bash
bun start              # Run the full pipeline: fetch tweets, URL mentions, @mentions
bun digest             # Generate daily-digest.html — original tweets from all tracked users
bun stories            # Generate story-ideas.html — AI-synthesized story pitches (last 7 days)
bun stories 336        # Story ideas from last 14 days
bun stories 48         # Story ideas from last 2 days
bun add-user <handle>  # Add a user to track (e.g. bun add-user @elonmusk)
bun add-url <url>      # Add a URL to monitor (e.g. bun add-url https://example.com)
bun list               # Show tracked users, URL monitors, poll state
```

## What the cron collects daily

1. **User timelines** — new tweets from all active users in `tracked_users` table
2. **URL monitor** — tweets containing `url:"https://swarajyamag.com"` via X search API (7-day window)
3. **Mention monitor** — tweets mentioning `@SwarajyaMag` (excluding self-tweets and RTs), hardcoded in `src/poll.ts`

Uses `since_id` tracking in `poll_state` table to only fetch new tweets each run. Never re-reads.

## Currently tracking (as of April 2026)

Users: @Normal_2610, @prasannavishy, @Tushar15, @Fintech03
URL monitor: https://swarajyamag.com
Mention monitor: @SwarajyaMag

Users are stored in DB — adding via `bun add-user` is enough, no redeploy needed.

## Database tables

- `tracked_users` — handles to track, twitter_id cache, active flag
- `tweets` — all captured tweets with full metadata, entities (URLs), engagement stats, raw JSON
- `url_monitors` — URLs to search for
- `poll_state` — since_id watermarks per source (user/url/mention)
- `schema_migrations` — applied migration tracking

## Key files

- `src/index.ts` — entry point, validates env, runs migrations + all polling, exits
- `src/db.ts` — Postgres client, all DB helpers (upsert with ON CONFLICT DO NOTHING)
- `src/xClient.ts` — X API v2 fetch wrapper, graceful 429 handling, never throws
- `src/poll.ts` — polling orchestration: user timelines, URL search, mention search
- `src/migrate.ts` — SQL migration runner
- `src/briefing.ts` — daily digest HTML generator (original tweets, sorted by engagement)
- `src/stories.ts` — story ideas generator (Claude-powered, with source links)
- `scripts/add-user.ts`, `scripts/add-url.ts`, `scripts/list.ts` — CLI utilities

## Environment variables (.env)

```
X_BEARER_TOKEN=...      # X API v2 Bearer Token (read-only)
DATABASE_URL=...        # Railway Postgres connection string
ANTHROPIC_API_KEY=...   # For story ideas generation (Claude Sonnet)
```

## Deploying to Railway

```bash
railway login
railway link -p 1db03f5c-c650-4b43-b9f1-c6a2780b7899
railway service x-tracker
railway up --detach --service x-tracker
```

Set `X_BEARER_TOKEN` and `DATABASE_URL` in Railway env vars. `ANTHROPIC_API_KEY` not needed on Railway (stories run locally).

## Cost

- X API: ~$0.005 per tweet read. Daily cost depends on how many new tweets tracked users post. Typically $0.10-$0.30/day for 4 users + URL/mention monitoring.
- Claude API: ~$0.02-0.03 per `bun stories` run.
- Railway: ~$10/month (app + Postgres).

## Future ideas discussed

- Lead scoring + outreach list for Swarajya subscription sales (who shares/mentions most)
- X Articles posting via API — not possible as of 2026, only via web UI
- Long tweets (25K chars) via `POST /2/tweets` — possible alternative for article sharing
