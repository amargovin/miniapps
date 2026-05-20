# news-suggestor

A news aggregation suggestor agent for an Indian publication (Swarajya). Fetches ~22 RSS / Google News feeds on a 15–60 min cadence, deduplicates and clusters items into distinct stories with sentence-transformer embeddings, ranks them with a tunable six-component scoring formula, generates Claude-written briefs for the top 100, and serves a password-protected dashboard plus a settings page for live weight tuning. One Python service, one SQLite file, runs on Railway.

## Quick start (local dev)

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env  # then fill in DASHBOARD_PASSWORD, SESSION_SECRET, ANTHROPIC_API_KEY
python -m app.main
```

Then open http://localhost:8000 and log in with the password you set.

The MiniLM embedding model (~90 MB) downloads on first run into `~/.cache/huggingface/`; subsequent starts are fast.

## Environment variables

| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `ANTHROPIC_API_KEY` | optional | — | Only needed once brief generation is wired in. Without it, cards show RSS titles + scores; clustering/scoring still work. |
| `DASHBOARD_PASSWORD` | yes | — | Single shared password for the dashboard (3–5 person team) |
| `SESSION_SECRET` | yes | — | Random 32+ chars; signs the session cookie |
| `CLAUDE_MODEL` | no | `claude-haiku-4-5-20251001` | Override to upgrade to Sonnet etc. |
| `DATABASE_PATH` | no | `data/app.db` | Mount a Railway volume to this path in prod |
| `EMBEDDING_MODEL` | no | `sentence-transformers/all-MiniLM-L6-v2` | — |
| `LOG_LEVEL` | no | `INFO` | — |
| `DISABLE_SCHEDULER` | no | unset | Set `1` for tests / one-off scripts |
| `USER_AGENT_CONTACT` | no | `amar@swarajyamag.com` | Operator email in the outbound `User-Agent` |
| `FETCH_TIMEOUT_SECONDS` | no | `20` | Per-request httpx timeout |
| `ENRICH_LOOKBACK_HOURS` | no | `72` | Window the enricher considers |
| `DEDUP_SIMILARITY_THRESHOLD` | no | `0.95` | Cosine threshold for near-dup pass |
| `CLUSTER_SIMILARITY_THRESHOLD` | no | `0.80` | Cosine threshold for joining a story |
| `TOP_N_FOR_BRIEFS` | no | `100` | How many stories get Claude briefs per cycle |

## Deploying to Railway

1. Push this repo to GitHub.
2. New Railway project → "Deploy from GitHub repo" → select this repo.
3. Add a **Volume** mounted at `/app/data`. SQLite + the embedding model cache live here.
4. Set env vars (`ANTHROPIC_API_KEY`, `DASHBOARD_PASSWORD`, `SESSION_SECRET` minimum).
5. Railway auto-detects the Dockerfile and deploys.
6. Health check at `/healthz` returns `{"ok": true, last_fetch, last_enrich, stories_count, ...}`.

The first deploy kicks an immediate fetch+enrich cycle so you don't stare at an empty dashboard.

## Adding a new source

Edit `app/sources.yaml`, then redeploy. Each entry needs `id`, `type` (`rss` for v1), `url`, `beats` (any of `politics economy tech infra`), `tier` (1/2/3), `fetch_interval_min`. The fetcher loads this file on every cycle, so changes pick up at the next scheduler tick after restart.

`html` and `screenshot` types exist as stubs and log a warning + skip; per-site scrapers aren't built in v1.

## Tuning the weights

`/settings` has six sliders (beat fit, source tier, recency decay, cluster size, novelty, gap bonus) plus the recency time-constant (hours) and cluster-size cap. The form HTMX-fetches a live "top-20 under current sliders" preview as you drag, with no save.

Two presets are wired in:

- **News desk** — `{beat_fit: 0.30, source_tier: 0.30, recency: 0.20, cluster_size: 0.20, novelty: 0.00, gap_bonus: 0.00}`
- **Swarajya angle** — `{beat_fit: 0.25, source_tier: 0.20, recency: 0.15, cluster_size: 0.10, novelty: 0.10, gap_bonus: 0.20}`

Click **Save** to persist; the next enrich cycle (within 30 min) picks up the new weights.

## Reading the dashboard

Each card shows, top to bottom:
- Rank, score (hover for the six-component breakdown), beat tag, highest-tier source badge, outlet count
- Title — links to the highest-tier source's article
- Brief — Claude-generated 2–3 sentence factual summary (or "Brief pending" until `ANTHROPIC_API_KEY` is set)
- Key facts — 3–5 dense bullets with timestamps/numbers where the source provides them
- Suggested angle — one-sentence editorial framing (italic)
- Timestamp chain — first seen / last updated / outlets covered
- Source chips — one per outlet, links to that outlet's piece (T1 sources have a green border)
- Action buttons — **Covering / Skip / Save** record an event in `events_log` and update the card's status

Top-bar filters: beat tabs, time window (24h/48h/7d), score threshold, full-text search across titles + briefs.

## Logs

Stdout, structured one-line records (Railway captures them automatically). `INFO` for normal cycle output; `WARNING` for source failures or fallback briefs; `ERROR` for unhandled exceptions.

## Estimated cost

At default settings (~100 briefs per cycle, 3 cycles/day on Haiku), ~$30/month. Sonnet is ~5x more.

## Known limitations (v1)

- `HTMLScraper` and `ScreenshotFetcher` are stubs — sources of those types are skipped with a warning.
- Single shared password; no per-user accounts.
- No notifications (email/Slack/Telegram).
- No X/Twitter integration.
- No learned ranker — clicks land in `events_log` for future training only.
- Desktop-first; mobile is functional but not polished.
- English-only feeds.
- No cross-day story-evolution tracking.
