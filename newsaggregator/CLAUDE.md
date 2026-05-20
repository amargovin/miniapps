# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

12 of 13 build-brief steps implemented. The only deferred piece is **brief generation** (step 7, brief §8.6) — the Anthropic call that fills `stories.brief` / `angle` / `key_facts`. The dashboard renders cards with "Brief pending" placeholders until that's wired in. Everything else works end-to-end against live RSS feeds, embeddings, clustering, scoring, weight tuning, action buttons, scheduler, prune, and JSON API.

`CLAUDE_CODE_BRIEF.md` is the canonical spec; this file is a navigator on top of it.

## Stack — locked, do not substitute

Python 3.12 · FastAPI + Jinja2 + HTMX · APScheduler (in-process, `AsyncIOScheduler`) · SQLite via stdlib `sqlite3` · `sentence-transformers/all-MiniLM-L6-v2` · `httpx` · `feedparser` · `selectolax` · Anthropic SDK (not yet wired) · Railway with volume mount.

**Explicitly rejected** (do not introduce): Next.js, React, Bun, Node, Postgres, SQLAlchemy/Alembic, Celery, Redis.

## Layout

```
app/
  main.py            # FastAPI app + lifespan (init_schema, scheduler.start)
  config.py          # env-driven config; USER_AGENT_CONTACT defaults to amar@swarajyamag.com
  db.py              # connect() ctx mgr; init_schema applies schema.sql idempotently
  scheduler.py       # APScheduler wiring; DISABLE_SCHEDULER=1 skips it
  jobs.py            # fetch_all, enrich_all, prune_old_data + module-level last_*_at trackers
  queries.py         # read-side SQL: list_top_stories, get_story, source_health, etc.
  sources.py         # YAML loader + Source dataclass + by_id helper
  sources.yaml       # locked source registry (brief §5)
  models.py          # pydantic shapes (StoryWeights, StoryView)
  auth.py            # itsdangerous signed cookie; check_password / is_authed / make_session_value
  fetchers/
    base.py          # FetchedItem, BaseFetcher, canonicalize_url, content_hash
    rss.py           # RSSFetcher with _GNewsResolver (HEAD redirect resolution + cache)
    html.py          # stub
    screenshot.py    # stub
  enrich/
    embed.py         # singleton EmbeddingService, pack/unpack helpers (384-dim float32 BLOBs)
    dedup.py         # _embed_pending() backfill + assign_near_duplicates() at 0.95 cosine
    cluster.py       # candidate centroids @ 0.80 cosine, T1 title override, beat retag
    score.py         # 6 components + Weights.{load,save}, PRESETS, rerank_preview
    # brief.py       # NOT IMPLEMENTED — step 7
  api/routes.py      # /admin/{fetch,enrich,prune}, /api/{stories,weights,sources/health}
  web/
    routes.py        # /, /login, /logout, /settings*, /stories/{id}/action, /partials/stories
    templates/{base,login,dashboard,settings}.html + partials/{story_card,story_grid,weight_preview}.html
    static/{style.css, htmx.min.js}
schema.sql           # DDL: source_state, raw_items, stories, scoring_weights, events_log, gnews_url_cache
tests/               # 28 unit tests covering canonicalize, sources YAML, embed pack, score math
```

`schema.sql` extras beyond brief §4: `stories.brief_generated_at` (for the "skip if brief is fresh" guard in §8.6) and a `gnews_url_cache` table (brief §7 mandates caching resolved URLs).

## Architecture in one screen

Single FastAPI process running three concurrent concerns inside one `AsyncIOScheduler`:

- **Fetcher** (`jobs.fetch_all`, every 15 min) — walks `sources.yaml`, throttles per-source `fetch_interval_min` via `source_state.last_fetched_at`, GETs the feed, parses with feedparser, resolves Google News redirects via the `_GNewsResolver` (cache in `gnews_url_cache`), `content_hash`-dedups, inserts into `raw_items` with `embedding=NULL story_id=NULL`. On 4xx/5xx: `consecutive_failures++`; ≥5 failures → 2× backoff cap 8×.
- **Enricher** (`jobs.enrich_all`, every 30 min) — three phases:
  1. `dedup._embed_pending`: encode any `embedding IS NULL` items in the last `ENRICH_LOOKBACK_HOURS` (72), batch via MiniLM, store packed float32 BLOBs.
  2. `dedup.assign_near_duplicates`: for unassigned items, attach to story_id of any neighbor with cosine ≥ 0.95 in the last 24h.
  3. `cluster.run`: for the rest, find candidate stories with `last_updated_at > -72h` and centroid cosine ≥ 0.80; on match join (recompute centroid as L2-normalized mean, T1 title override), else create new story. Beat retag is a separate post-pass over touched stories.
  4. `score.run`: scores every story updated in last 24h via `Weights.load()` × six components, persists `score` and `score_breakdown` JSON.
  5. (TBD step 7) `brief.run`: top-N by score → Claude → JSON → fill `brief / angle / key_facts`.
- **Web** (`web/routes.py`, `api/routes.py`) — auth-gated by signed cookie everywhere except `/login`, `/static/*`, `/healthz`. Dashboard query goes through `queries.list_top_with_primary_link` (one extra query for source chips per page). Settings page HTMX-fetches `/settings/preview` for live reranks.

`scheduler.start()` also kicks one initial cycle as an asyncio task so first deploy has data fast.

## Key invariants

- Embeddings are L2-normalized at encode time — `EmbeddingService.cosine` is just `np.dot`.
- Centroids are recomputed from member embeddings on each cluster join (not running mean) and stored L2-normalized.
- Recency formula is `exp(-hours / half_life_hours)` — that's a *time constant*, not a true half-life. `recency_score(h=tau) = e^-1 ≈ 0.368`.
- Scoring weights live in a singleton row `id=1` of `scoring_weights`; saving updates in place. Preset names: `news_desk`, `swarajya`, `defaults`.
- Story status transitions through `events_log` action buttons: `new ↔ covering ↔ saved` (Skip → `skipped`); clicking the same button twice toggles back to `new` and logs an `un{action}` event.

## Common commands

```bash
# Local dev
DASHBOARD_PASSWORD=test SESSION_SECRET=$(openssl rand -hex 16) python -m app.main

# Tests (the embedding service really loads — pack tests pull MiniLM ~16s cold)
.venv/bin/python -m pytest -q tests/

# Manual one-off cycle without the scheduler (e.g. iterating on enrich logic)
DISABLE_SCHEDULER=1 .venv/bin/python -c "import asyncio; from app import jobs; asyncio.run(jobs.fetch_all()); asyncio.run(jobs.enrich_all())"

# Trigger fetch via the auth-gated admin endpoint
curl -sS -d 'password=...' http://localhost:8000/login -c c.txt
curl -sS -X POST -b c.txt http://localhost:8000/admin/fetch
```

## Build order (brief §21)

`1 skeleton → 2 auth → 3 RSS fetcher → 4 embed+dedup → 5 cluster → 6 score → ⛔ 7 briefs (not done) → 8 dashboard → 9 settings → 10 scheduler → 11 actions → 12 polish → 13 deploy`. Step 7 is the only gap; everything else has been verified against live data (130+ items, 147 clustered stories, scoring runs end-to-end).

## Things explicitly out of scope (brief §23)

Per-user accounts, email/Slack notifications, full HTML scrapers, X/Twitter, learned ranker, mobile-first layout, non-English feeds, cross-day story tracking. The user has deferred all of these — don't proactively add them.

## Open behaviors to verify in production

- **PIB returns 403** to our `httpx` UA — captured in `source_state.consecutive_failures` and backed off, but the source contributes zero items until it accepts the UA. Worth investigating headers or fallback.
- **Some Tier-3 Google News clusters are large but low-tier**: scoring's source-tier weight intentionally pushes them down. Tune `cluster_size_weight` higher if you want big T3 clusters to surface more.
- The brief's "warn after 14 days no items" check exists but only fires when a fetch returns zero new items — for a permanently-broken source it'll keep silent. Acceptable.
