# Build brief — Swarajya weekly social review service on Railway

Hand this whole file to Claude Code. It is a build specification, not a sketch: where it
gives a number, that number has been measured against the live APIs and should be treated
as a regression target rather than an example.

---

## 1. What this is

A small, scheduled Python service that, once a week, pulls every post Swarajya published
across three social channels in the previous seven days, reconciles the pull against each
API's own aggregate counts, stores the per-post rows and a per-week rollup in Postgres,
renders a four-slide PDF, and emails it.

It replaces a manual process. The PDF format, the reconciliation rules and the metric
definitions below are all settled — do not redesign them.

There is a token-authenticated HTTP API (§2.1) for triggering runs by hand, re-rendering a
stored week, downloading a deck and inspecting what a run did.

**Explicitly out of scope:** a browser UI or dashboard of any kind, user accounts,
multi-tenancy, posting to any channel, and any write operation against any social API. The
HTTP API is an operator control surface for one person holding one bearer token, not a
product — build it accordingly. This service is read-only against the outside world.

---

## 2. Runtime shape

Three Railway services in one project, all sharing the same Postgres and the same
application package. The scheduled job and the HTTP API are two entrypoints over one
codebase — write the pipeline once as a library function and have both call it.

1. **`db`** — Railway Postgres (managed). Always on.
2. **`weekly`** — the scheduled runner, configured with a Railway **cron schedule** so the
   container starts, runs to completion, and exits. It must not run a web server or its own
   scheduler loop; Railway starts it. Entrypoint: `python -m app.cli run`.
3. **`api`** — an always-on FastAPI service for manual runs, re-renders, downloads and
   inspection. Entrypoint: `uvicorn app.api:app --host 0.0.0.0 --port $PORT`.

A CLI stays available for everything the API does (`python -m app.cli ...`), invoked with
`railway run`. It is the fallback when the API is down and the path used inside `weekly`.

Python 3.12. Dependencies: `fastapi`, `uvicorn[standard]`, `httpx`, `psycopg[binary]`,
`reportlab`, `pypdf`, `tenacity`, `pydantic`, `pydantic-settings`, `structlog`. No ORM —
this is a handful of tables and plain SQL is clearer here. No Alembic; use a single
idempotent `schema.sql` applied on every boot with `CREATE TABLE IF NOT EXISTS`.

### 2.1 The API contract

Base path `/v1`. JSON in, JSON out. Times are ISO-8601 with offset. Dates are `YYYY-MM-DD`
and always refer to a **week-ending Sunday in `WEEK_TZ`**.

**Authentication.** Every `/v1` route requires `Authorization: Bearer $API_TOKEN`, compared
with `secrets.compare_digest`. `API_TOKEN` is a Railway env var; generate at least 32 random
bytes. Return `401` with no detail on mismatch. `/healthz` and `/readyz` are unauthenticated.
Disable `/docs` and `/openapi.json` unless `ENV=dev`. There is no browser client, so set no
CORS headers at all.

**A run takes minutes, so no endpoint may block on one.** `POST /v1/runs` records the run,
starts it in the background, and returns `202` immediately with a `run_id` to poll.

**Only one run at a time, across all three services.** Take a Postgres session-level
advisory lock (`pg_try_advisory_lock` on a constant key) at the top of the pipeline. If it
cannot be acquired, return `409 Conflict` with the id of the run currently holding it. This
is what stops a manual run and the Monday cron colliding and double-billing.

| Method & path | Auth | Does |
|---|---|---|
| `GET /healthz` | no | Liveness. `200` with `{"status":"ok"}`. No DB call. |
| `GET /readyz` | no | `SELECT 1` against Postgres, and assert every required env var is present (presence only — never call a vendor API from a health check). `503` on failure. |
| `POST /v1/runs` | yes | Start a full pull-and-render. Body below. `202` + `{run_id, status:"queued", estimated_cost_usd}`. |
| `GET /v1/runs/{run_id}` | yes | Full run record: status, phase, window bounds, per-channel post counts, reconciliation results, cost, verification outcomes, whether a PDF exists, error detail if failed. |
| `GET /v1/runs?limit=20&status=` | yes | Recent runs, newest first. |
| `GET /v1/runs/{run_id}/pdf` | yes | The rendered PDF, `application/pdf`, `Content-Disposition: attachment`. `404` if the run produced none. |
| `POST /v1/runs/{run_id}/email` | yes | Re-send an existing run's PDF. Makes no vendor API calls and costs nothing. Optional body `{"to": "..."}` to override the recipient. |
| `POST /v1/render` | yes | Re-render the PDF for a stored week **from Postgres only, with zero vendor API calls**. Body `{"week_ending": "..."}`. This is the normal way to iterate on layout. Returns the PDF. |
| `GET /v1/weeks` | yes | Every row in `weekly_totals`, newest first. |
| `GET /v1/weeks/{week_ending}` | yes | That week's three channel rollups plus the run that produced them. |
| `GET /v1/weeks/{week_ending}/posts?channel=x` | yes | The stored per-post rows. Paginated, default 100. |
| `POST /v1/backfill` | yes | Body `{from, to, confirm_cost_usd}`. Without `confirm_cost_usd` it returns `409` and the projected cost; the caller must echo that number back to proceed. Runs the weeks sequentially. |
| `GET /v1/usage` | yes | X credit balance, month-to-date post reads and spend, and the balance delta of the last run. |

`POST /v1/runs` body:

```json
{
  "week_ending": "2026-08-23",   // optional; defaults to the most recent completed week in WEEK_TZ
  "force": false,                // required true to re-pull a week already stored with source='api'
  "channels": ["x","instagram","facebook"],  // optional subset, e.g. re-pull X only after a 402
  "send_email": true,
  "dry_run": false               // fetch and reconcile, write nothing, send nothing, still report cost
}
```

Behaviour that matters:

- **Idempotency.** `POST /v1/runs` for a week that already has `source='api'` rows returns
  `409` with the existing `run_id` unless `force: true`. This is a cost guard, not a
  correctness one — see §10.
- **Idempotency-Key.** Accept an optional `Idempotency-Key` header; a repeat within 24 hours
  returns the original `run_id` rather than starting a second run. Retrying a request that
  timed out client-side must not double-bill.
- **`week_ending` must be a Sunday** in `WEEK_TZ` and must not be in the future. Reject with
  `422` and a message naming the nearest valid Sunday, rather than silently rounding.
- **Rate limit** `POST` routes to something trivially low — 10/hour is generous. An
  in-process token bucket is fine; there is one caller.
- **Errors** are `{"error": {"code": "...", "message": "...", "run_id": ...}}` with a stable
  machine-readable `code`. Never leak a token or a full traceback in a response body.

### 2.2 Cost note on the extra service

`api` is always-on, so it adds a second continuously-running container alongside Postgres.
Keep it to the smallest viable footprint — it is idle almost all the time. Expect the
Railway bill to land around **$5–10/month** rather than inside the $5 Hobby credit; that is
the price of the manual-run endpoint and it is worth it.

---

## 3. Schedule and the reporting week — settled, do not re-derive

**The reporting week is Monday 00:00:00 to Sunday 23:59:59 India Standard Time (UTC+05:30).**
`WEEK_TZ=Asia/Kolkata`. This is a decision, not a default to be reconsidered — but keep it
in config rather than hardcoded so the value is visible and testable.

The week therefore closes at **18:30 UTC on Sunday**. Railway cron is evaluated in UTC, so
the schedule is:

```
30 23 * * 0        # 23:30 UTC Sunday  ==  05:00 IST Monday
```

That leaves a **5.5-hour margin** between the window closing and the run starting. Do not
"simplify" this to a Monday-morning UTC cron: with an IST week, `30 23 * * 0` is a Sunday
expression that fires on Monday in local terms, and it looks wrong until you convert it.
Put that comment next to the cron line.

Compute the window with `zoneinfo`, never with a fixed `timedelta(hours=5, minutes=30)`.
India does not observe DST today, but hardcoding the offset means the bug is silent if that
ever changes, and it makes the code untestable against any other timezone.

```python
from zoneinfo import ZoneInfo
tz    = ZoneInfo(settings.week_tz)
end   = datetime.combine(week_ending + timedelta(days=1), time.min, tz)  # exclusive
start = end - timedelta(days=7)
```

`week_ending` is the Sunday's date in `WEEK_TZ`. Store `window_start` / `window_end` as
`timestamptz` and log them as an explicit ISO-8601 interval at the start of every run.
Both social APIs take UTC instants, so convert at the edge and keep everything internal in
the aware datetime.

**Impression accrual.** Sunday's posts will have had between 5.5 and 29.5 hours to accrue
impressions when the run fires, against 6–7 days for Monday's. The bias is real but
identical every week, so it cancels in the week-on-week trend, which is the whole reason
the schedule is fixed. State it if a Sunday looks weak; never correct for it.

### Consistency with the two stored historical weeks

The seeded rows were computed on **UTC** weeks. For the week ending 2026-08-16 the two
definitions were checked against the live data and return **exactly the same 262 posts**:

- the IST week adds 2026-08-09T18:30Z–2026-08-10T00:00Z, where X returned 0 posts and
  Facebook's latest 9 August post was 12:08Z, so nothing falls in it;
- the IST week drops 2026-08-16T18:30Z–2026-08-17T00:00Z, where the dataset holds 0 posts
  on any channel.

That is structural rather than lucky: the 5.5-hour shift only moves 18:30–24:00 UTC, which
is 00:00–05:30 IST, and Swarajya's earliest observed post in the week was 08:00 IST. The
switch is therefore low-risk — but it is verified for one week, not guaranteed for all, so
implement the boundary properly and let the reconciliation checks catch any drift.

Stamp `week_tz` on every `weekly_totals` row regardless, and refuse to compute a
week-on-week delta across rows whose `week_tz` differs unless the row is explicitly marked
as verified-equivalent.

---

## 4. Credentials and how each API is reached

The current manual process runs through MCP connectors. **Those are not available inside a
Railway container.** This service talks to the vendor APIs directly. Set all of these as
Railway environment variables; none may be committed.

### X (Twitter) API v2 — @SwarajyaMag

- `X_BEARER_TOKEN` — OAuth 2.0 App-Only bearer **from the developer app owned by
  @SwarajyaMag itself**. This is not interchangeable with any other app's token, and the
  difference is a 5x cost multiplier — see the Owned Reads warning in §10 before you create
  a new app for this service.
- `X_USER_ID=2451476942` (constant; do not look it up every run, see cost section).

Endpoints used, and only these:

| Purpose | Endpoint | Notes |
|---|---|---|
| Follower count | `GET /2/users/2451476942?user.fields=public_metrics` | one user resource per run |
| Timeline | `GET /2/users/2451476942/tweets` | paginated, see below |

Timeline request parameters, exactly:

```
exclude=retweets,replies
max_results=100
start_time=<window start, RFC3339 Z>
end_time=<window end exclusive, RFC3339 Z>
tweet.fields=id,text,created_at,public_metrics,referenced_tweets
expansions=referenced_tweets.id
```

Paginate on `meta.next_token` until it is absent. **After every page, assert
`len(data) == meta.result_count`** and abort the run on mismatch. Also compare each page's
`meta.newest_id` against the previous page's `meta.oldest_id` and de-duplicate by post id
regardless — pages are normally adjacent, but verify rather than assume.

Known API behaviours you must handle, all observed in production:

- **`exclude=replies` does not drop self-thread continuations.** They arrive as ordinary
  posts. A post is a thread continuation when it has a `referenced_tweets` entry of type
  `replied_to` **and** `in_reply_to_user_id == X_USER_ID`. Store this as `is_head=false`.
  Everything else is `is_head=true`. Rankings use heads only; totals use every row.
- **`conversation_id` is not returned even when requested** by some gateways. Do not depend
  on it. Reconstruct threads by walking `referenced_tweets[].id` back to a post with no
  self-reply parent.
- **A thread head can be deleted while its continuations survive.** In the week ending
  2026-08-16 there are 11 continuations whose head (`2087867158684664227`) returns 404.
  Their engagement belongs in the totals; they can never be ranked. Handle this, log it as
  a data note, and do not treat it as a failed pull.
- **Long-form posts are truncated to roughly 280 characters** in the `text` field. Titles
  derived from `text` will end mid-sentence for essay posts. Store the raw text; generate a
  display title separately (see §7).
- **HTTP 402 `credits depleted`** happens. Treat it as retryable: back off and retry for up
  to 30 minutes total (`tenacity`, exponential, jitter). If it still fails, complete the run
  for the Meta channels, mark the X channel `unavailable` in the run record, and say so on
  the PDF — never write a zero, never carry forward last week's number.
- Retry 429 and 5xx with exponential backoff honouring `x-rate-limit-reset` when present.

### Meta Graph API — Facebook Page + Instagram Business

- `META_ACCESS_TOKEN` — long-lived Page access token with `pages_read_engagement`,
  `pages_show_list`, `instagram_basic`, `instagram_manage_insights`.
- `FB_PAGE_ID=670321879700525`
- `IG_USER_ID=17841400214702908`
- `META_API_VERSION=v21.0` (make it configurable; Meta deprecates versions on a schedule).

Fetch, with cursor pagination on `paging.next` until exhausted:

- `GET /{FB_PAGE_ID}/posts?fields=id,message,created_time,permalink_url,likes.summary(true),comments.summary(true),shares&since=&until=`
- `GET /{IG_USER_ID}/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&since=&until=`
- `GET /{FB_PAGE_ID}?fields=followers_count` and
  `GET /{IG_USER_ID}?fields=followers_count,media_count`

**Meta's `since`/`until` are Unix timestamps and `until` is exclusive.** The MCP connector
this replaces documented `until` as inclusive and it is not — that bug silently dropped all
eight of one Sunday's Facebook posts from a completed report. Compute `until` as the first
instant *after* the window and write a unit test that asserts a post timestamped in the
final second of the window is included.

Meta returns **no impressions** on these endpoints. Instagram and Facebook therefore have
no reach and no engagement rate. Do not substitute, estimate, or leave the column at 0 —
store `NULL` and render `n/a`.

Two fields have returned 0 on every post across multiple weeks: **Instagram `shares`**
(the field does not exist on the media edge) and **Facebook `comments`** via this token
scope. Store them as `NULL`, not 0, and label them "unreported" wherever they surface.

### Email delivery

- `RESEND_API_KEY` (Resend is the least friction; SendGrid or plain SMTP is fine —
  put it behind a `Mailer` protocol with one implementation so it can be swapped).
- `MAIL_TO=amar@swarajyamag.com`
- `MAIL_FROM=<a verified sender on your domain>`

Send the PDF as an attachment. Subject:
`Swarajya social review — week ending Sunday 16 August 2026` (real date, spelled out).
Body: the three-to-four sentence findings summary described in §8, as plain text and HTML.

---

## 5. Postgres schema

```sql
CREATE TABLE IF NOT EXISTS runs (
  id              BIGSERIAL PRIMARY KEY,
  week_ending     DATE        NOT NULL,
  week_tz         TEXT        NOT NULL,
  window_start    TIMESTAMPTZ NOT NULL,
  window_end      TIMESTAMPTZ NOT NULL,   -- exclusive
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  status          TEXT        NOT NULL,   -- running | ok | partial | failed
  channels_ok     TEXT[]      NOT NULL DEFAULT '{}',
  channels_failed TEXT[]      NOT NULL DEFAULT '{}',
  notes           JSONB       NOT NULL DEFAULT '[]',
  x_cost_usd      NUMERIC(10,4)
);

CREATE TABLE IF NOT EXISTS posts_x (
  post_id      TEXT PRIMARY KEY,
  week_ending  DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL,
  text         TEXT        NOT NULL,
  title        TEXT,                      -- display title, see §7
  likes        INT NOT NULL, reposts INT NOT NULL, replies INT NOT NULL,
  quotes       INT NOT NULL, bookmarks INT NOT NULL, impressions INT NOT NULL,
  is_head      BOOLEAN NOT NULL,
  thread_root  TEXT,                      -- head post id; may point outside the window
  engagement   INT GENERATED ALWAYS AS (likes+reposts+replies+quotes+bookmarks) STORED,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_x_week ON posts_x(week_ending);

CREATE TABLE IF NOT EXISTS posts_meta (
  platform     TEXT NOT NULL,             -- 'facebook' | 'instagram'
  post_id      TEXT NOT NULL,
  week_ending  DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL,
  message      TEXT,
  title        TEXT,
  permalink    TEXT,
  media_type   TEXT,                      -- IG only: REEL / CAROUSEL_ALBUM / IMAGE / VIDEO
  likes        INT, comments INT, shares INT,   -- NULL means unreported, never 0
  engagement   INT GENERATED ALWAYS AS
                 (COALESCE(likes,0)+COALESCE(comments,0)+COALESCE(shares,0)) STORED,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (platform, post_id)
);
CREATE INDEX IF NOT EXISTS posts_meta_week ON posts_meta(week_ending, platform);

CREATE TABLE IF NOT EXISTS weekly_totals (
  week_ending                  DATE NOT NULL,
  channel                      TEXT NOT NULL,   -- x | instagram | facebook
  week_tz                      TEXT NOT NULL,
  followers                    INT,
  posts                        INT  NOT NULL,
  ranked_posts                 INT,             -- heads only; X
  engagement                   INT  NOT NULL,
  impressions                  BIGINT,          -- NULL where unavailable
  engagement_per_post          NUMERIC(10,1) NOT NULL,
  engagement_per_1k_followers  NUMERIC(10,1),
  median_engagement            INT,
  engagement_rate_pct          NUMERIC(6,2),    -- NULL where no reach
  source                       TEXT NOT NULL DEFAULT 'api',  -- 'api' | 'imported'
  PRIMARY KEY (week_ending, channel)
);

CREATE TABLE IF NOT EXISTS reports (
  week_ending  DATE PRIMARY KEY,
  run_id       BIGINT REFERENCES runs(id) ON DELETE SET NULL,
  filename     TEXT        NOT NULL,
  pdf          BYTEA       NOT NULL,
  slide_count  INT         NOT NULL,
  link_count   INT         NOT NULL,
  rendered_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- a rendered deck is ~30 KB, so a year of history is under 2 MB; keep them all

-- keep the exact bytes we were given, so any number can be re-derived later
CREATE TABLE IF NOT EXISTS raw_payloads (
  id          BIGSERIAL PRIMARY KEY,
  run_id      BIGINT REFERENCES runs(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,               -- x_timeline_p1, fb_posts_p2, ...
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload     JSONB NOT NULL
);
```

Rules:

- All writes for one run happen in **one transaction**. A failed run leaves no partial week.
- `posts_x` / `posts_meta` upsert on primary key (`ON CONFLICT ... DO UPDATE`) so a re-run
  of the same week corrects rows instead of duplicating them. Metrics keep accruing after
  publication, so a re-run legitimately produces higher numbers — that is expected.
- `weekly_totals` upserts on `(week_ending, channel)` for the same reason.
- Retain `raw_payloads` for 180 days; add a delete in the same transaction.

**Seed these historical rows** (`source='imported'`) so the first live run has a
comparison. Both were computed on UTC weeks. Tag `week_tz` exactly as shown: the
2026-08-16 week was verified to contain the identical post set under both definitions
(see §3) and so may be treated as IST; the 2026-08-09 week was not and must stay `UTC`.

```
week_ending, channel,   week_tz,       followers, posts, ranked, engagement, impressions, per_post, per_1k, median, er_pct
2026-08-09,  x,         UTC,           342501,    312,   NULL,   29123,      1706991,     93.3,     85.0,   36,     1.71
2026-08-09,  instagram, UTC,           59626,     7,     NULL,   1399,       NULL,        199.9,    23.5,   166,    NULL
2026-08-09,  facebook,  UTC,           634246,    55,    NULL,   843,        NULL,        15.3,     1.3,    NULL,   NULL
2026-08-16,  x,         Asia/Kolkata,  342772,    215,   163,    21217,      1156638,     98.7,     61.9,   55,     1.83
2026-08-16,  instagram, Asia/Kolkata,  59742,     4,     4,      1927,       NULL,        481.8,    32.3,   345,    NULL
2026-08-16,  facebook,  Asia/Kolkata,  633871,    43,    43,     641,        NULL,        14.9,     1.0,    13,     NULL
```

The first comparison the service renders — week ending 2026-08-23 against week ending
2026-08-16 — is therefore a like-for-like IST comparison. Any comparison reaching back to
2026-08-09 crosses a `week_tz` boundary *and* an ambiguous source window, and must carry
both caveats.

Note on the `2026-08-09` row: its source deck labelled the window "2–9 August 2026", and
**both 2 and 9 August 2026 were Sundays**, so that label is either eight days or the seven
days Monday 3 – Sunday 9 and the source does not say which. Store it, and have the renderer
carry a footnote saying so whenever that row is used in a comparison. Do not silently
present it as a clean seven-day baseline.

---

## 6. Metric definitions — implement exactly

- **Engagement, X** = `likes + reposts + replies + quotes + bookmarks`
- **Engagement, Meta** = `likes + comments + shares` (NULLs treated as 0 for the sum, but
  reported as unavailable)
- `engagement_per_post = engagement / posts` — **every** post, thread continuations included
- `engagement_per_1k_followers = engagement / (followers / 1000)`
- `engagement_rate_pct = 100 * engagement / impressions` — X only
- **Median** across all posts in the channel, not just heads
- **Ranked posts** (for the appendix and any "per ranked post" figure) are thread heads and
  standalone posts. A thread is one item, credited with its head post's metrics.

Cross-channel comparison is engagement-only, because Meta exposes no reach. X's engagement
includes two interaction types Meta does not (quotes, bookmarks), which inflates X slightly.
State that once in the output; do not hedge every figure with it.

---

## 7. Display titles

The appendix needs a scannable 6–10 word label per post, not the post text. Generate one
deterministically and store it in `title`:

1. Strip URLs, then leading emoji and bullet glyphs.
2. Collapse whitespace, take the first sentence or first 11 words, whichever is shorter.
3. Cap at 58 characters, trimming on a word boundary and appending `…`.
4. Append ` (thread)` when the post is a head with at least one continuation.

The 58-character cap is not cosmetic: in the PDF a title that wraps to a second line
creates a **second link annotation**, which breaks the link-count check in §9.

---

## 8. The deliverable — a four-slide PDF, and never more than five

I am supplying two files alongside this brief: **`build_deck.py`** (the existing renderer,
for its styles, palette, table helper and page furniture) and **`build_short.py`** (the
four-slide layout). Port them; keep the visual system identical. Landscape 16:9,
13.333in × 7.5in, ReportLab.

**Slide 1 — WEEK ON WEEK.** One table. A row per channel plus an "All channels" row.
Paired columns for posts, engagement, engagement per post and median, each column headed by
the Sunday its week ends on — `Posts w/e 9 Aug`, `Posts w/e 16 Aug` — with a change column
after each pair. Below the table: X reach and engagement rate prior→current; a line stating
reach is X-only because Meta returns no impressions; the ambiguity footnote from §5 where
it applies; and a closing line that where posting volume swung sharply, engagement per post
is the honest comparison and the totals are not.

**Slides 2–4 — appendices**, in the order X, Instagram, Facebook. Top 25 by engagement, or
all posts where the channel published fewer. Every title is a hyperlink to the post.

**Nothing else.** No title slide, no findings panels, no recommendations slide, no gaps
slide, no charts. Everything that is not the comparison table or a post list goes in the
email body.

**Date rule, applied everywhere without exception.** Never write a bare range like
"2–9 August". Always name the Sunday a week ends on — "week ending Sunday 16 August 2026" —
and state the window's first and last day in full at least once per document: "the seven
full days Monday 10 August to Sunday 16 August 2026, India Standard Time" — and always
name the timezone, because the historical rows are on a different one. Label every comparison
column with its week-ending date. This is a standing requirement, not a preference.

Filename: `swarajya_social_review_<week_ending YYYY-MM-DD>.pdf`.

**Email body** — three or four sentences, generated from the data, not templated prose:
what moved against the prior week; whether a volume swing rather than a performance change
explains it; and any distribution failure. Compute these candidates every week and mention
whichever fire:

- a story that led one channel and never ran on another;
- the same story posted twice on X inside a few hours, splitting its own engagement
  (36 stories were double-posted in the week ending 2026-08-16 — detect by normalising the
  first 60 characters of post text, lowercased and stripped of punctuation and URLs, among
  heads only, and report the count, the posts involved, and the engagement in the second copy);
- median against mean, as a concentration signal;
- replies and comments as a share of engagement.

---

## 9. Verification — the run fails if any of these fail

Implement as an explicit `verify()` step before the email is sent. A failure aborts delivery
and sends an alert email instead, with the failing check named.

1. **X pagination:** every page's row count equals its `meta.result_count`.
2. **Meta reconciliation:** the summed likes / comments / shares / post-count in
   `posts_meta` match a second, independently-fetched aggregate for the same window, at
   both all-platform and per-platform scope. This check has caught a real eight-post
   undercount; do not drop it as redundant.
3. **Window coverage:** at least one post exists dated on the window's final day *in
   `WEEK_TZ`*, or an explicit note is recorded saying the channel genuinely published
   nothing that day. Unit-test both IST edges directly: a post at 2026-08-16T18:29:59Z is
   inside the week ending 2026-08-16 and one at 2026-08-16T18:30:00Z is outside it.
4. **PDF page count equals the intended slide count** (4). A spill means a table overflowed.
5. **PDF link-annotation count equals the number of appendix rows** (25 + 25 + 4 = 54 for a
   full three-channel week). More means a title wrapped; fewer means a link was dropped.
6. **No fabricated zeros:** assert no channel row has `impressions = 0`; unavailable must
   be NULL.

Regression test, run in CI against a recorded fixture of the real payloads — these are the
measured values for the week ending 2026-08-16 and the implementation must reproduce them
exactly:

| | X | Instagram | Facebook |
|---|---|---|---|
| posts | 215 | 4 | 43 |
| ranked posts | 163 | 4 | 43 |
| engagement | 21,217 | 1,927 | 641 |
| impressions | 1,156,638 | NULL | NULL |
| per post | 98.7 | 481.8 | 14.9 |
| median | 55 | 345 | 13 |
| engagement rate | 1.83% | NULL | NULL |
| followers | 342,772 | 59,742 | 633,871 |

Combined: 262 posts, 23,785 engagement. Thread continuations: 52. Duplicate stories on X:
36, covering 72 posts, with 2,037 engagement in the smaller copy. X engagement components:
likes 16,597, reposts 3,009, bookmarks 1,275, replies 213, quotes 123.

---

## 10. Cost control

Rates below are from X's official pricing page and were confirmed against this account's
live balance on 27 August 2026: a call returning 97 posts drew exactly $0.10, i.e.
**$0.001 per post**. Expansion objects in `includes` were not billed separately.

**Reads are billed per resource returned, not per request.** Page size therefore changes
nothing; volume is the only lever.

### Owned Reads — the single most important cost fact here

`GET /2/users/{id}/tweets` is priced at **$0.001 per post instead of $0.005**, but only
"when `{id}` matches the authenticated user and that user is the owner of the developer
app". Read that condition literally:

> **If you register a brand-new developer app for this service under a different account,
> the same reads bill at $0.005 and the annual cost goes from roughly $20 to roughly $105.**

So: use a token from the developer app that @SwarajyaMag owns. Then prove it, do not assume
it — the first deployment must fetch the credit balance, pull one page, fetch the balance
again, and assert the delta is within 10% of `posts_returned * 0.001`. Fail the deploy loud
if it lands near `posts_returned * 0.005`. Put this in the smoke test, not in a comment.

### Endpoint choices that matter

| Need | Use | Cost | Do **not** use |
|---|---|---|---|
| The week's posts | `GET /2/users/{id}/tweets` | $0.001/post (owned) | — |
| Follower count | `GET /2/users/{id}?user.fields=public_metrics` | $0.010, one user resource | `GET /2/users/{id}/followers` — that is an Owned Read at **$0.001 per follower**, which on 342,772 followers is **$342 a run** |
| The user id | nothing — it is the constant `2451476942` | $0 | `GET /2/users/by/username/...`, a $0.010 user read every week for a value that never changes |

The follower-count row is not hypothetical: both endpoints look like reasonable ways to get
a follower number and one of them costs four hundred times the other. Add a test asserting
the client never constructs a `/followers` URL.

### Deduplication changes the retry story

Resources are **deduplicated within a 24-hour UTC day window** — being charged for a post
once means re-requesting it later the same UTC day is free. Consequences to build around:

- Retrying a failed run on the same UTC day is **effectively free**. Retry freely within the
  day; do not suppress retries to save money.
- Re-running the same week on a **later** day is charged in full. Guard it: if
  `weekly_totals` already has `source='api'` rows for the target `week_ending`, require an
  explicit `force: true` (API) or `--force` (CLI), and return `409` otherwise.
- `POST /v1/render` and `POST /v1/runs/{id}/email` touch no vendor API and cost nothing.
  Iterate on layout and re-send decks through those, never by re-running a pull.
- The step-7 manual run and the first scheduled run, if they fall on the same UTC day, cost
  once between them.
- Dedup is documented as a **soft guarantee**, so treat it as a discount you may not get,
  never as a licence for an unbounded retry loop.

### Guardrails

- Set a **spending limit** in the Developer Console — $10 per billing cycle is roughly 5x
  expected spend and will stop any runaway before it matters. Do this before the first
  deploy, not after an incident.
- Configure **auto-recharge** with a recharge amount comfortably above one week's spend
  (e.g. $25 with a $10 trigger). Note the documented safeguard: auto-recharge fires at most
  once per 5 minutes and is paused at a zero or negative balance, so a drained account still
  needs a manual top-up.
- `X_MAX_POSTS_PER_RUN` (default 1,500) — abort rather than paginate indefinitely if a bug
  turns a week into an unbounded crawl.
- Record estimated spend on `runs.x_cost_usd` as
  `posts_returned * 0.001 + user_reads * 0.010`, and log the actual balance delta beside it.
  A widening gap between the two is the earliest signal that Owned Read pricing has stopped
  applying.
- Track consumption with `GET /2/usage/tweets`, which returns daily post-consumption counts.
  Alert if the remaining credit balance falls below `X_BALANCE_ALERT_USD` (default 20).

### Expected spend

At 350–400 posts a week: **$0.36–$0.41 per run, $1.56–$1.78 a month, $19–$21 a year.**
That is roughly 1,700 post-reads a month against a documented cap of 3,000,000 per billing
cycle, so volume headroom is irrelevant. Meta's Graph API costs nothing at this volume.
The xAI credit rebate starts at $200 cumulative spend per cycle, so it will never apply
here — ignore it.

## 11. Operations

- Structured JSON logs via `structlog`; one line per phase with the resolved window, page
  counts, reconciliation results and cost.
- On any unhandled exception: mark the run `failed`, roll back the transaction, and email
  a short failure notice with the traceback's final frame. Silence on a Monday morning must
  never be the failure mode.
- Manual work goes through the API; the CLI mirrors it for when the API is unreachable:

  ```bash
  # re-run last week after fixing something, paying for the pull again
  curl -sX POST $BASE/v1/runs -H "Authorization: Bearer $API_TOKEN" \
       -H 'Content-Type: application/json' \
       -d '{"week_ending":"2026-08-23","force":true}'

  # poll it
  curl -s $BASE/v1/runs/42 -H "Authorization: Bearer $API_TOKEN"

  # re-render the deck from stored rows — no vendor calls, no cost
  curl -sX POST $BASE/v1/render -H "Authorization: Bearer $API_TOKEN" \
       -H 'Content-Type: application/json' \
       -d '{"week_ending":"2026-08-16"}' -o deck.pdf

  # X came back after a 402; pull just that channel and re-render
  curl -sX POST $BASE/v1/runs -H "Authorization: Bearer $API_TOKEN" \
       -H 'Content-Type: application/json' \
       -d '{"week_ending":"2026-08-23","force":true,"channels":["x"]}'
  ```

  CLI equivalents: `python -m app.cli run --week-ending ... [--force] [--channels x]`,
  `python -m app.cli render --week-ending ...`,
  `python -m app.cli backfill --from ... --to ...` (prints the projected X cost and
  requires confirmation).
- Pin dependencies. Commit a `Dockerfile` or `nixpacks.toml` and a `railway.json`.
- README covering: the env vars, how to rotate the Meta long-lived token before it expires,
  how to change the schedule, and the `WEEK_TZ` decision from §3.

---

## 12. Build order

1. Repo skeleton, config via `pydantic-settings`, `schema.sql`, Postgres connection, seeds.
2. X client with pagination, thread detection and the retry policy. Unit tests against
   recorded fixtures.
3. Meta client with cursor pagination and the exclusive-`until` test.
4. Aggregation and the `verify()` checks.
5. PDF renderer ported from the two supplied scripts; verify page and link counts.
6. Mailer.
7. CLI entrypoints, then the `api` service over the same pipeline function: auth, the
   advisory lock, background execution, and the routes in §2.1. Test `409` on a concurrent
   run and `409`-without-`force` on an already-stored week — those two are the cost guards
   and they are the ones worth having tests for.
8. Deploy all three services, set the cron, then run once manually via
   `POST /v1/runs {"week_ending":"2026-08-16","force":true,"send_email":false}` and diff
   the result against the regression table in §9.
9. Only then enable the schedule.

Do not skip step 7. The regression table exists so the first automated Monday is not the
first time anyone checks the arithmetic.
