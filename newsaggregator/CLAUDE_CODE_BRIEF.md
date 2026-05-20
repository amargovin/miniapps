# News Suggestor Agent — Build Brief for Claude Code

You are building a news aggregation suggestor agent for an Indian publication (Swarajya). The agent fetches news from a curated list of RSS feeds, deduplicates and clusters articles into distinct stories, ranks them, and presents the top 100 stories of the day on a password-protected dashboard. A configurable scoring system lets the user tune how stories are ranked.

This brief is the source of truth. Read it end to end before writing code. If anything is ambiguous, ask before guessing.

---

## 1. What you are building

A single web service deployed to Railway, with three responsibilities running inside it:

1. A **scheduled fetcher** that pulls 17 RSS feeds plus several Google News RSS queries every 15–60 minutes
2. A **scheduled enricher** that deduplicates, clusters by semantic similarity, scores, and generates briefs using the Anthropic API
3. A **password-protected web dashboard** showing the top 100 ranked stories, plus a settings page for tuning scoring weights

The user is a small team (3–5 people) at a national publication. They want to see, at any given moment, the top ~100 stories a national daily would publish, focused on national politics, economic policy, tech policy, and infrastructure/rail.

## 2. Stack — locked, do not change

| Layer | Choice |
|---|---|
| Runtime | Python 3.12 |
| Web framework | FastAPI |
| Templating | Jinja2 (FastAPI's `Jinja2Templates`) |
| Frontend interactivity | HTMX (single `<script>` tag) |
| Scheduler | APScheduler, in-process |
| Database | SQLite, raw SQL via `sqlite3` stdlib (no ORM, no Alembic) |
| Persistence | Railway volume mount |
| Auth | Single shared password from env var, signed cookie via `itsdangerous` |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` (local, CPU) |
| HTTP client | `httpx` (async) |
| RSS parsing | `feedparser` |
| HTML scraping | `selectolax` |
| LLM API | Anthropic via official SDK (`anthropic` package) |
| Deployment | Railway, single service, auto-deploy from GitHub `main` |

**Do not introduce**: Next.js, React, Bun, Node, Postgres, SQLAlchemy, Celery, Redis. Every one of those was deliberately rejected.

## 3. Repo layout

```
news-suggestor/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app + APScheduler startup
│   ├── config.py                  # env vars, defaults
│   ├── db.py                      # sqlite3 connection + helpers
│   ├── auth.py                    # password check, session cookie
│   ├── models.py                  # Pydantic models for type clarity
│   ├── fetchers/
│   │   ├── __init__.py
│   │   ├── base.py                # FetchedItem dataclass, base class
│   │   ├── rss.py                 # RSSFetcher
│   │   ├── html.py                # HTMLScraper (placeholder for v1)
│   │   └── screenshot.py          # ScreenshotFetcher (stub for v1)
│   ├── enrich/
│   │   ├── __init__.py
│   │   ├── embed.py               # MiniLM wrapper
│   │   ├── dedup.py               # exact + near-dup removal
│   │   ├── cluster.py             # assign items to stories
│   │   ├── score.py               # weighted scoring
│   │   └── brief.py               # Anthropic API calls for briefs
│   ├── jobs.py                    # fetch_all() and enrich_all() entry points
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py              # JSON endpoints
│   ├── web/
│   │   ├── __init__.py
│   │   ├── routes.py              # HTML routes
│   │   ├── templates/
│   │   │   ├── base.html
│   │   │   ├── dashboard.html
│   │   │   ├── settings.html
│   │   │   ├── login.html
│   │   │   └── partials/
│   │   │       ├── story_card.html
│   │   │       └── weight_preview.html
│   │   └── static/
│   │       ├── htmx.min.js        # vendored, latest stable
│   │       ├── style.css
│   │       └── app.js             # ~50 lines, glue only
│   └── sources.yaml               # the source registry
├── data/                          # sqlite + model cache, mounted as volume
│   └── .gitkeep
├── schema.sql                     # DDL, applied on startup if missing
├── Dockerfile
├── railway.json
├── pyproject.toml
├── .env.example
├── .gitignore
└── README.md
```

## 4. Database schema (`schema.sql`)

Apply this on app startup with `executescript` if tables don't exist. Use `IF NOT EXISTS` everywhere.

```sql
-- Sources are loaded from sources.yaml on startup, not stored long-term in DB,
-- but we cache last_fetched_at and last_ok_at per source to throttle politely.
CREATE TABLE IF NOT EXISTS source_state (
    source_id        TEXT PRIMARY KEY,         -- slug from sources.yaml
    last_fetched_at  TIMESTAMP,
    last_ok_at       TIMESTAMP,
    last_error       TEXT,
    consecutive_failures INTEGER DEFAULT 0
);

-- Every individual item we've seen, before clustering.
CREATE TABLE IF NOT EXISTS raw_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id       TEXT NOT NULL,
    url             TEXT NOT NULL UNIQUE,
    canonical_url   TEXT,
    title           TEXT NOT NULL,
    body            TEXT,                      -- summary or full content if available
    author          TEXT,
    published_at    TIMESTAMP,                 -- from feed; may be approximate
    fetched_at      TIMESTAMP NOT NULL,
    content_hash    TEXT NOT NULL,             -- sha256 of normalized title+body
    embedding       BLOB,                      -- 384 float32, packed
    story_id        INTEGER,                   -- nullable; assigned by enricher
    FOREIGN KEY (story_id) REFERENCES stories(id)
);

CREATE INDEX IF NOT EXISTS idx_raw_items_story ON raw_items(story_id);
CREATE INDEX IF NOT EXISTS idx_raw_items_fetched ON raw_items(fetched_at);
CREATE INDEX IF NOT EXISTS idx_raw_items_hash ON raw_items(content_hash);

-- Clustered stories. One story = one news event covered by 1+ outlets.
CREATE TABLE IF NOT EXISTS stories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_title TEXT NOT NULL,
    brief           TEXT,                      -- 2-3 sentence Claude-generated summary
    angle           TEXT,                      -- suggested editorial angle
    key_facts       TEXT,                      -- JSON array of fact strings with timestamps
    beat            TEXT,                      -- politics | economy | tech | infra | other
    score           REAL NOT NULL DEFAULT 0,
    score_breakdown TEXT,                      -- JSON {beat_fit, source_tier, recency, cluster_size, novelty, gap_bonus}
    centroid        BLOB,                      -- mean embedding of member items
    member_count    INTEGER NOT NULL DEFAULT 1,
    sources_covered TEXT,                      -- JSON array of source_ids
    first_seen_at   TIMESTAMP NOT NULL,
    last_updated_at TIMESTAMP NOT NULL,
    status          TEXT NOT NULL DEFAULT 'new'  -- new | covering | skipped | saved
);

CREATE INDEX IF NOT EXISTS idx_stories_score ON stories(score DESC);
CREATE INDEX IF NOT EXISTS idx_stories_updated ON stories(last_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_beat ON stories(beat);

-- Configurable scoring weights. Single row, id=1.
CREATE TABLE IF NOT EXISTS scoring_weights (
    id                       INTEGER PRIMARY KEY CHECK (id = 1),
    beat_fit_weight          REAL NOT NULL DEFAULT 0.30,
    source_tier_weight       REAL NOT NULL DEFAULT 0.25,
    recency_decay_weight     REAL NOT NULL DEFAULT 0.20,
    cluster_size_weight      REAL NOT NULL DEFAULT 0.20,
    novelty_weight           REAL NOT NULL DEFAULT 0.05,
    gap_bonus_weight         REAL NOT NULL DEFAULT 0.00,
    recency_half_life_hours  REAL NOT NULL DEFAULT 24,
    cluster_size_cap         INTEGER NOT NULL DEFAULT 10,
    updated_at               TIMESTAMP NOT NULL
);

-- Seed the single row on first startup if missing.
INSERT OR IGNORE INTO scoring_weights (id, updated_at) VALUES (1, CURRENT_TIMESTAMP);

-- Action log. Used today to record clicks (covering/skip/save). May be used
-- later to train a learned ranker; not used for ranking in MVP.
CREATE TABLE IF NOT EXISTS events_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id    INTEGER NOT NULL,
    action      TEXT NOT NULL,             -- covering | skip | save | unsave
    user_label  TEXT,                      -- which user (from session); optional
    at          TIMESTAMP NOT NULL,
    FOREIGN KEY (story_id) REFERENCES stories(id)
);

CREATE INDEX IF NOT EXISTS idx_events_story ON events_log(story_id);
```

Notes for the implementer:
- Embeddings are stored as packed `float32` bytes (`np.float32` array → `tobytes()`); decode with `np.frombuffer(blob, dtype=np.float32)`.
- `centroid` on `stories` is recomputed each time a new item joins the cluster: simple mean of member embeddings, then L2-normalize.
- `score_breakdown` lets the dashboard show why a story ranked where it did — useful for debugging weights.

## 5. The source registry (`app/sources.yaml`)

The locked list. Do not edit without explicit instruction.

```yaml
# Tier 1 — primary/official sources
- id: rbi_press
  name: RBI Press Releases
  type: rss
  url: https://www.rbi.org.in/pressreleases_rss.xml
  beats: [economy]
  tier: 1
  fetch_interval_min: 15

- id: rbi_notifications
  name: RBI Notifications
  type: rss
  url: https://www.rbi.org.in/notifications_rss.xml
  beats: [economy]
  tier: 1
  fetch_interval_min: 15

- id: sebi_master
  name: SEBI Master Feed
  type: rss
  url: https://www.sebi.gov.in/sebirss.xml
  beats: [economy]
  tier: 1
  fetch_interval_min: 15

- id: pib_press
  name: PIB Press Releases (English)
  type: rss
  url: https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3
  beats: [politics, economy, tech, infra]
  tier: 1
  fetch_interval_min: 15

- id: livelaw
  name: LiveLaw
  type: rss
  url: https://www.livelaw.in/feed
  beats: [politics]
  tier: 1
  fetch_interval_min: 15
  notes: Verify in production; sitemap shows recent activity.

# Tier 2 — mainstream news
- id: ie_national
  name: Indian Express National
  type: rss
  url: https://indianexpress.com/section/india/feed/
  beats: [politics]
  tier: 2
  fetch_interval_min: 15

- id: ie_business
  name: Indian Express Business
  type: rss
  url: https://indianexpress.com/section/business/feed/
  beats: [economy]
  tier: 2
  fetch_interval_min: 15

- id: mint_politics
  name: Mint Politics
  type: rss
  url: https://www.livemint.com/rss/politics
  beats: [politics]
  tier: 2
  fetch_interval_min: 15

- id: mint_industry
  name: Mint Industry
  type: rss
  url: https://www.livemint.com/rss/industry
  beats: [economy, infra]
  tier: 2
  fetch_interval_min: 15

- id: bs_india
  name: Business Standard India News
  type: rss
  url: https://www.business-standard.com/rss/india-news-216.rss
  beats: [politics]
  tier: 2
  fetch_interval_min: 15

- id: bs_economy
  name: Business Standard Economy
  type: rss
  url: https://www.business-standard.com/rss/economy-102.rss
  beats: [economy]
  tier: 2
  fetch_interval_min: 15

- id: hindu_national
  name: The Hindu National
  type: rss
  url: https://www.thehindu.com/news/national/feeder/default.rss
  beats: [politics]
  tier: 2
  fetch_interval_min: 15

- id: hindu_businessline
  name: The Hindu BusinessLine
  type: rss
  url: https://www.thehindubusinessline.com/feeder/default.rss
  beats: [economy, infra]
  tier: 2
  fetch_interval_min: 15

- id: theprint_politics
  name: ThePrint Politics
  type: rss
  url: https://theprint.in/category/politics/feed/
  beats: [politics]
  tier: 2
  fetch_interval_min: 15

- id: moneycontrol_business
  name: MoneyControl Business
  type: rss
  url: https://www.moneycontrol.com/rss/business.xml
  beats: [economy]
  tier: 2
  fetch_interval_min: 15

# Tier 3 — specialists
- id: metro_rail_guy
  name: The Metro Rail Guy
  type: rss
  url: https://themetrorailguy.com/feed/
  beats: [infra]
  tier: 3
  fetch_interval_min: 60

- id: urban_transport_news
  name: Urban Transport News
  type: rss
  url: https://urbantransportnews.com/rss
  beats: [infra]
  tier: 3
  fetch_interval_min: 60

# Google News RSS queries — fill gaps for sources without their own feeds.
# Locale tail is appended in code, not stored here.
- id: gnews_dpdp
  name: Google News — DPDP / MeitY / data protection
  type: rss
  url: https://news.google.com/rss/search?q=MeitY+OR+DPDP+OR+%22data+protection%22&hl=en-IN&gl=IN&ceid=IN:en
  beats: [tech]
  tier: 3
  fetch_interval_min: 30

- id: gnews_trai
  name: Google News — TRAI consultations
  type: rss
  url: https://news.google.com/rss/search?q=%22TRAI+consultation%22+OR+%22TRAI+recommendation%22&hl=en-IN&gl=IN&ceid=IN:en
  beats: [tech]
  tier: 3
  fetch_interval_min: 30

- id: gnews_metro
  name: Google News — Metro projects
  type: rss
  url: https://news.google.com/rss/search?q=DMRC+OR+%22Mumbai+metro%22+OR+%22Bengaluru+metro%22+OR+%22Chennai+metro%22&hl=en-IN&gl=IN&ceid=IN:en
  beats: [infra]
  tier: 3
  fetch_interval_min: 30

- id: gnews_highways
  name: Google News — NHAI / DFCCIL / NHSRCL
  type: rss
  url: https://news.google.com/rss/search?q=NHAI+OR+DFCCIL+OR+NHSRCL+OR+NCRTC&hl=en-IN&gl=IN&ceid=IN:en
  beats: [infra]
  tier: 3
  fetch_interval_min: 30

- id: gnews_supreme_court
  name: Google News — Supreme Court constitutional
  type: rss
  url: https://news.google.com/rss/search?q=%22Supreme+Court%22+constitutional+OR+%22constitution+bench%22&hl=en-IN&gl=IN&ceid=IN:en
  beats: [politics]
  tier: 2
  fetch_interval_min: 30
```

## 6. Environment variables (`.env.example`)

```
# Required
ANTHROPIC_API_KEY=sk-ant-xxx
DASHBOARD_PASSWORD=changeme
SESSION_SECRET=generate-a-random-32-char-string

# Optional — sane defaults if missing
CLAUDE_MODEL=claude-haiku-4-5-20251001
DATABASE_PATH=data/app.db
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
LOG_LEVEL=INFO

# Tunables (mostly leave alone)
FETCH_TIMEOUT_SECONDS=20
ENRICH_LOOKBACK_HOURS=72
DEDUP_SIMILARITY_THRESHOLD=0.95
CLUSTER_SIMILARITY_THRESHOLD=0.80
TOP_N_FOR_BRIEFS=100
```

## 7. Fetcher behavior

### `app/fetchers/base.py`

```python
@dataclass
class FetchedItem:
    source_id: str
    url: str
    title: str
    body: str | None
    author: str | None
    published_at: datetime | None
    fetched_at: datetime
```

A fetcher takes a source dict (from `sources.yaml`) and returns `list[FetchedItem]`. Errors should be caught and logged, never bubble up to crash the whole fetch cycle.

### `RSSFetcher` requirements

- Use `httpx.AsyncClient` with `timeout=20`, custom User-Agent: `news-suggestor/0.1 (contact: <REPLACE_ME>)`. Document this so the user can put their email in.
- Parse with `feedparser`.
- Date parsing: prefer `entry.published_parsed`, fall back to `entry.updated_parsed`, fall back to `fetched_at`.
- Some feeds give only summaries. Use `entry.summary` or `entry.content[0].value` if present. Do not follow redirects to fetch full body in v1; we work with whatever the feed gives.
- URL canonicalization: strip UTM params, lowercase host, remove fragment.
- For Google News RSS: the `<link>` element is a Google redirect. Resolve it to the canonical publisher URL by issuing a HEAD request and following the location header. Cache resolved URLs to avoid re-resolving.

### `HTMLScraper`

Stub for v1. Implement the class skeleton so we can drop in scrapers later, but do not write per-site scrapers. Log a warning if any source has `type: html` and skip.

### `ScreenshotFetcher`

Stub. Class skeleton only.

### Politeness and throttling

- Respect `fetch_interval_min` per source. Read `source_state.last_fetched_at` and skip if not yet due.
- On 4xx/5xx errors, increment `consecutive_failures`. After 5 consecutive failures, double the interval temporarily (passive back-off). Reset on success.
- Log a warning if a source hasn't returned a new item in 14 days.

### Storing items

- Compute `content_hash = sha256(normalize(title) + "\n" + normalize(body or ""))`. `normalize` is lowercase + collapse whitespace.
- Skip if `content_hash` already exists in `raw_items` (covers exact dupes and re-syndications).
- Compute embedding via `EmbeddingService.encode(title + " " + (body or ""))`. Store packed float32.
- Insert. Do **not** assign `story_id` here; that's the enricher's job.

## 8. Enricher behavior

`enrich_all()` runs every 30 minutes. Steps:

### 8.1 Pull pending items

```sql
SELECT * FROM raw_items 
WHERE story_id IS NULL 
  AND fetched_at > datetime('now', '-72 hours')
ORDER BY fetched_at ASC
```

### 8.2 Near-duplicate removal

For each pending item, compute cosine similarity against all `raw_items` from the last 24h (excluding self). If max similarity ≥ `DEDUP_SIMILARITY_THRESHOLD` (0.95), set `story_id` to the matched item's `story_id` (if any, else queue for clustering with that item) and skip clustering.

This catches syndicated wire copy — e.g., the same PTI story appearing on multiple outlets with minor edits.

### 8.3 Clustering

For remaining items, find candidate stories: those with `last_updated_at > 72h ago` and centroid cosine similarity ≥ `CLUSTER_SIMILARITY_THRESHOLD` (0.80) to the item's embedding.

- If a match is found: assign `story_id`, recompute the story's centroid (mean of all member embeddings, L2-normalized), increment `member_count`, append `source_id` to `sources_covered`, update `last_updated_at`.
- If no match: create a new story with this item as its first member. `canonical_title` is the item's title. `centroid` is the item's embedding.

When a new item joins an existing story, **prefer the higher-tier source's title as canonical_title**. If the new item's source is Tier 1 and the story's current canonical title came from a Tier 2 source, replace it.

### 8.4 Beat tagging

For each story (new or updated), determine its `beat`:

- Take the union of `beats` from all member items' source configs.
- If only one beat present, use it.
- If multiple, use the most-represented one. Tie-break by Tier 1 source's beat if any.
- If unclear, set `beat = 'other'`.

Optional v2: LLM beat classifier. Not in MVP.

### 8.5 Scoring

For every story touched in this enrich cycle (and any story in the last 24h, to refresh recency), compute:

```
score = w_beat_fit       * beat_fit_score(story)
      + w_source_tier    * source_tier_score(story)
      + w_recency        * recency_score(story, half_life_hours)
      + w_cluster_size   * cluster_size_score(story, cluster_size_cap)
      + w_novelty        * novelty_score(story)
      + w_gap_bonus      * gap_bonus_score(story)
```

Where:

- `beat_fit_score`: 1.0 if beat in {politics, economy, tech, infra}, else 0.3
- `source_tier_score`: based on highest-tier source in cluster: T1 → 1.0, T2 → 0.7, T3 → 0.4
- `recency_score`: `exp(-hours_since_last_update / half_life_hours)`, clamped 0–1
- `cluster_size_score`: `log(1 + member_count) / log(1 + cluster_size_cap)`, clamped 0–1
- `novelty_score`: `1 - max_similarity_to_stories_from_yesterday`, clamped 0–1. If no stories from yesterday, 1.0.
- `gap_bonus_score`: 1.0 if `member_count <= 2` AND highest source tier ≤ 2, else 0. Designed so it does nothing when `gap_bonus_weight = 0` (the default).

Save `score` and `score_breakdown` (JSON of the six component scores) on the story row.

### 8.6 Brief generation

Take the top 100 stories by score (after this cycle's update). For each:

- If the story already has a `brief` and `last_updated_at` hasn't changed since the brief was generated, skip.
- Otherwise call Claude with the prompt below to generate `brief`, `angle`, `key_facts`.

Use `claude-haiku-4-5-20251001` by default; override via `CLAUDE_MODEL` env var. Use the **batch API** for non-realtime briefing if request volume justifies it (≥50 stories changed). Otherwise serial async calls with concurrency cap of 5.

#### Brief prompt template

```
You are a wire-desk editor at an Indian national daily. Generate a brief for one news story below. The brief will be used by editors to decide whether to publish. Be factual, neutral, and dense.

STORY TITLE: {canonical_title}
BEAT: {beat}
SOURCES COVERING IT ({n}): {comma_separated_source_names}

ARTICLES (most recent first):
---
{for each member item, last 5 max:
SOURCE: {source_name} | PUBLISHED: {published_at_iso}
TITLE: {title}
BODY: {body or '(no body)'}
---
}

Return STRICT JSON with exactly these keys:
{
  "brief": "2-3 sentence summary, ~60 words. Lead with the news.",
  "angle": "One-sentence editorial angle a national daily would emphasize.",
  "key_facts": [
    "Fact 1 with date/time/number where possible.",
    "Fact 2.",
    "Fact 3."
  ]
}

Rules:
- 3 to 5 key facts, each ≤25 words.
- Include specific timestamps wherever the source provides them (e.g., "Cabinet approved on 8 May 2026").
- Do not editorialize in `brief` or `key_facts`. The `angle` field is the only place for editorial framing.
- Do not invent facts not present in the source articles.
- Output JSON only. No code fences, no preamble.
```

Parse the JSON. On parse failure, log the raw response and store a fallback brief: first 60 words of the highest-tier source's body. Do not crash.

## 9. Scheduling

In `app/main.py`, on app startup:

```python
scheduler = AsyncIOScheduler()
scheduler.add_job(fetch_all, "interval", minutes=15, id="fetch", max_instances=1)
scheduler.add_job(enrich_all, "interval", minutes=30, id="enrich", max_instances=1)
scheduler.add_job(prune_old_data, "cron", hour=3, id="prune")  # daily 3 AM
scheduler.start()

# Run once on startup so first deploy has data quickly
asyncio.create_task(run_initial_cycle())
```

`prune_old_data`: delete `raw_items` older than 30 days that aren't attached to a story still in the top 1000 by score; delete `stories` not updated in 30 days.

## 10. Auth

`DASHBOARD_PASSWORD` and `SESSION_SECRET` from env. All routes except `/login`, `/static/*`, and `/healthz` require a valid session cookie.

```python
# app/auth.py
from itsdangerous import URLSafeSerializer, BadSignature
import hmac, os
from fastapi import Request, HTTPException, status
from fastapi.responses import RedirectResponse

PASSWORD = os.environ["DASHBOARD_PASSWORD"]
SECRET = os.environ["SESSION_SECRET"]
serializer = URLSafeSerializer(SECRET, salt="news-suggestor-auth")

def check_password(pw: str) -> bool:
    return hmac.compare_digest(pw, PASSWORD)

def make_session_value() -> str:
    return serializer.dumps({"authed": True})

async def verify_session(request: Request):
    cookie = request.cookies.get("session")
    if not cookie:
        raise HTTPException(status_code=303, headers={"Location": "/login"})
    try:
        data = serializer.loads(cookie)
        if not data.get("authed"):
            raise HTTPException(status_code=303, headers={"Location": "/login"})
    except BadSignature:
        raise HTTPException(status_code=303, headers={"Location": "/login"})
```

Login route: form with single password field. On success, set cookie with `httponly=True, samesite="lax"`, expiry 30 days. Redirect to `/`.

Logout route: clear cookie, redirect to `/login`.

## 11. Routes

### Web routes (`app/web/routes.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Dashboard (top 100 stories) |
| GET | `/settings` | Scoring weights settings page |
| POST | `/settings` | Save weights, redirect with success |
| POST | `/settings/preview` | HTMX endpoint, returns reranked top 20 fragment |
| POST | `/settings/preset/{name}` | Apply preset ("news_desk" or "swarajya"), HTMX refresh |
| POST | `/stories/{id}/action` | Record covering/skip/save, HTMX returns updated card |
| GET | `/login` | Login form |
| POST | `/login` | Process login |
| POST | `/logout` | Clear session |
| GET | `/healthz` | Public, returns `{"ok": true}` |

### API routes (`app/api/routes.py`)

JSON endpoints, same auth as web routes:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/stories?beat=&limit=&since=` | List stories ranked by score |
| GET | `/api/stories/{id}` | Single story with all member items |
| GET | `/api/weights` | Current scoring weights |
| GET | `/api/sources/health` | Per-source: last_fetched, last_ok, errors |

These exist for future programmatic use and for the dashboard's HTMX calls.

## 12. Dashboard UI (`dashboard.html`)

Simple, dense, server-rendered. Layout:

**Top bar**:
- App name on left
- Beat tabs: All / Politics / Economy / Tech / Infra (links with `?beat=...`)
- Date filter: "Last 24h" / "Last 48h" / "Last 7 days"
- Score threshold slider (HTMX-fetches without page reload)
- Search box (filters by title/brief substring, HTMX)
- Right: settings icon, logout

**Main grid** — flex column, ~100 cards, each:
- Header row: rank number · score badge · beat tag · "T1/T2/T3" highest tier badge
- Title (bold, links to canonical URL of highest-tier source)
- Brief (2–3 sentences)
- Key facts list (bullet points, dense)
- Suggested angle (italic, dimmer)
- Timestamp chain: "First seen 09:14 IST · Updated 11:30 · {n} outlets covered"
- Source list: small chips per outlet, each linking to that outlet's article
- Action buttons: [Covering] [Skip] [Save] — POST to `/stories/{id}/action`, HTMX-replaces card with new state

**Right rail** (small, optional for v1):
- "New since your last visit: N" counter
- Beat distribution mini-bar
- Source health: any source with no items in 24h flagged red

### Settings page (`settings.html`)

Form with sliders for each weight (0.00 to 1.00, step 0.01):
- Beat fit
- Source tier
- Recency decay
- Cluster size
- Novelty
- Gap bonus

Plus number inputs for:
- Recency half-life (hours)
- Cluster size cap

Below the form, a **"Live preview"** section showing the top 20 stories under the *current unsaved* values. Each slider has `hx-post="/settings/preview" hx-trigger="change delay:300ms" hx-target="#preview"`.

Two preset buttons:
- **News desk**: `{beat_fit: 0.30, source_tier: 0.30, recency: 0.20, cluster_size: 0.20, novelty: 0.00, gap_bonus: 0.00}`
- **Swarajya angle**: `{beat_fit: 0.25, source_tier: 0.20, recency: 0.15, cluster_size: 0.10, novelty: 0.10, gap_bonus: 0.20}`

Save button persists to DB. Reset-to-defaults button restores the seed defaults.

A note at the top: "Weights take effect on the next enrich cycle (within 30 minutes). Save and check back."

## 13. Embeddings

```python
# app/enrich/embed.py
from sentence_transformers import SentenceTransformer
import numpy as np

class EmbeddingService:
    def __init__(self, model_name: str):
        self.model = SentenceTransformer(model_name)  # downloads to ./data/models/

    def encode(self, text: str) -> np.ndarray:
        v = self.model.encode(text, normalize_embeddings=True)
        return v.astype(np.float32)

    def cosine(self, a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b))   # already L2-normalized
```

Pre-download the model in the Dockerfile to avoid cold-start delay:

```dockerfile
RUN python -c "from sentence_transformers import SentenceTransformer; \
               SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"
```

Model goes into `~/.cache/huggingface/`. Either bake into image or persist on volume — bake into image for simpler deploys.

## 14. Anthropic API integration

Use `claude-haiku-4-5-20251001` by default. The code should respect the `CLAUDE_MODEL` env var.

```python
from anthropic import AsyncAnthropic
client = AsyncAnthropic()  # picks up ANTHROPIC_API_KEY automatically

async def call_brief(prompt: str) -> dict:
    resp = await client.messages.create(
        model=os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5-20251001"),
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    text = resp.content[0].text.strip()
    return json.loads(text)   # let JSONDecodeError bubble; caller handles fallback
```

Concurrency: use `asyncio.Semaphore(5)` around the brief call to respect rate limits. Retry 3x with exponential backoff on `APIError` / `RateLimitError`.

Cost note in README: at ~100 briefs per cycle × 3 cycles/day on Haiku, expect roughly USD 30/month. Sonnet is ~5x more.

## 15. Dockerfile

```dockerfile
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e .

# Pre-download embedding model
RUN python -c "from sentence_transformers import SentenceTransformer; \
               SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

COPY . .
RUN mkdir -p data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 16. `railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/healthz",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

The user will create a Railway volume mounted at `/app/data` for SQLite persistence. Document this in README.

## 17. `pyproject.toml` dependencies

```toml
[project]
name = "news-suggestor"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "jinja2>=3.1",
    "python-multipart>=0.0.20",
    "itsdangerous>=2.2",
    "apscheduler>=3.10",
    "feedparser>=6.0",
    "httpx>=0.28",
    "selectolax>=0.3",
    "sentence-transformers>=3.3",
    "numpy>=2.0",
    "anthropic>=0.40",
    "pyyaml>=6.0",
    "python-dateutil>=2.9",
    "rapidfuzz>=3.10",
]
```

## 18. README must cover

- What the app does, in one paragraph
- One-line install for local dev: `pip install -e . && python -m app.main`
- Required env vars table
- How to deploy to Railway: connect repo, set env vars, mount volume at `/app/data`
- How to add a new source (edit `sources.yaml`, restart)
- How to tune weights (the settings page)
- How to read the dashboard (what each card field means)
- Where logs go
- Estimated monthly cost
- Known limitations: HTMLScraper not implemented, ScreenshotFetcher not implemented, no learning ranker, single password for all users

## 19. Logging and observability

Use Python's `logging` module. Configure at app startup:

- `INFO`: each fetch cycle start/end with item count, each enrich cycle, brief generation completions, weight changes
- `WARNING`: source failures, parse errors, fallback briefs used
- `ERROR`: unhandled exceptions, missing env vars, DB errors

Log to stdout (Railway captures it). No file logging.

A `/healthz` endpoint returns `{"ok": true, "last_fetch": "...", "last_enrich": "...", "stories_count": N}` for Railway health checks.

## 20. Testing expectations

- Unit-test the scoring functions (deterministic math)
- Unit-test URL canonicalization
- Unit-test the JSON parsing in brief.py with sample malformed responses
- Integration-test the full fetch → store → enrich cycle with 3 mocked feeds
- Do NOT mock the embedding model in tests; it runs cheap on CPU and real behavior matters

Use `pytest` and `pytest-asyncio`.

## 21. Build order

Implement in this sequence so each step is testable:

1. **Skeleton**: repo layout, `pyproject.toml`, `Dockerfile`, `schema.sql`, `db.py`, `config.py`, basic FastAPI app with `/healthz`
2. **Auth**: login/logout/session, basic templates, base layout
3. **Sources + RSS fetcher**: load `sources.yaml`, implement `RSSFetcher`, write `fetch_all()`, no scheduler yet — just a manual trigger
4. **Embeddings + dedup**: encode incoming items, exact-hash dedup, near-dup similarity check
5. **Clustering**: build the cluster assignment logic, populate `stories`
6. **Scoring**: implement the formula, store breakdown
7. **Brief generation**: Anthropic integration, top-100 selection, prompt + JSON parsing + fallback
8. **Dashboard**: render top 100 with cards, beat filter, search
9. **Settings page**: sliders, live preview, presets, save
10. **Scheduler**: wire up APScheduler for periodic fetch + enrich
11. **Action buttons**: covering/skip/save, events_log
12. **Polish**: `/healthz` details, source health page, prune job, logs cleanup
13. **Deploy**: push to GitHub, Railway connect, volume, env vars, smoke test

## 22. Things to ask the user about before implementing

- The contact email for the User-Agent string
- Whether to use Anthropic batch API for briefs (cheaper but adds 1–24h latency) or sync calls
- Whether to set up a basic uptime monitor (UptimeRobot ping on `/healthz`)

## 23. Things explicitly out of scope for v1

- Per-user accounts (single shared password is fine)
- Email/Slack/Telegram notifications
- HTMLScraper and ScreenshotFetcher implementations (stubs only)
- Twitter/X integration
- Learning ranker that uses click data
- Mobile-responsive design (desktop-first, basic mobile is enough)
- Multi-language sources (English-only)
- Trend detection / story-evolution tracking across days

The user knows about all of these and wants them deferred.

---

End of brief. Ask before deviating from anything specified here.
