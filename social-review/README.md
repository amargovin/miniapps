# swarajya-social-review

Weekly social performance review for Swarajya: pulls every post from X, Instagram and
Facebook for the previous week (Monday–Sunday, Asia/Kolkata), reconciles counts against
each API's own aggregates, stores per-post rows and weekly rollups in Postgres, renders a
four-slide PDF and posts the findings summary plus a signed deck link to a Google Chat
room.

Runs on Railway: managed Postgres + an always-on FastAPI operator service (`api`) + a
cron-scheduled runner (`weekly`). Both services run the same image and call the same
pipeline function, so the Monday morning run and a manual run cannot drift apart.

- **Spec:** `RAILWAY_BRIEF.md` — authoritative for metric definitions, the API contract,
  cost rules and the verification checks. Its numbers are measured regression targets.
- **Current status, amendments and next steps:** `CLAUDE.md`
- **Env vars:** `.env.example`; production values are Railway variables.

## Layout

| Module | What it does |
|---|---|
| `app/window.py` | the IST reporting week (§3): window bounds, `week_ending` validation, date wording |
| `app/x_client.py` | X API v2 (§4): timeline pagination, thread reconstruction, retries, cost |
| `app/meta_client.py` | Meta Graph (§4): FB Page + IG Business, exclusive `until`, NULL-not-zero |
| `app/titles.py` | deterministic display titles (§7) |
| `app/aggregate.py` | the metric definitions (§6) and the appendix rows |
| `app/findings.py` | the findings summary and its candidates (§8) |
| `app/verify.py` | the six checks that fail a run (§9) |
| `app/render.py` | the four-slide deck (§8) |
| `app/notify.py`, `app/signing.py` | Google Chat delivery and the signed deck links |
| `app/store.py` | all SQL, including the single write transaction (§5) |
| `app/pipeline.py` | the pipeline as one library function; CLI and API both call it |
| `app/api.py`, `app/cli.py` | the two entrypoints (§2.1, §11) |
| `app/smoke.py` | the deploy check that Owned Read pricing applies (§10) |

## Local development

```bash
python3.12 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env                       # fill in
.venv/bin/python -m app.cli init-db
.venv/bin/uvicorn app.api:app --reload     # ENV=dev also enables /docs
```

### Tests

```bash
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/social_review_test \
  .venv/bin/python -m pytest
```

Everything runs without network access. The database tests skip with a message when
`TEST_DATABASE_URL` (or `DATABASE_URL`) points at no reachable Postgres. The §9 regression
tests skip until the recorded payload fixtures exist — see `tests/fixtures/README.md`.

## Operator commands

The HTTP API is the normal route; the CLI mirrors it for when the API is unreachable
(`railway run python -m app.cli ...`).

```bash
# run last week again after fixing something — this pays for the pull again
curl -sX POST $BASE/v1/runs -H "Authorization: Bearer $API_TOKEN" \
     -H 'Content-Type: application/json' -d '{"week_ending":"2026-08-23","force":true}'

# poll it
curl -s $BASE/v1/runs/42 -H "Authorization: Bearer $API_TOKEN"

# re-render the deck from stored rows — no vendor calls, no cost
curl -sX POST $BASE/v1/render -H "Authorization: Bearer $API_TOKEN" \
     -H 'Content-Type: application/json' -d '{"week_ending":"2026-08-16"}' -o deck.pdf

# X came back after a 402: pull just that channel, keeping the stored Meta rows
curl -sX POST $BASE/v1/runs -H "Authorization: Bearer $API_TOKEN" \
     -H 'Content-Type: application/json' \
     -d '{"week_ending":"2026-08-23","force":true,"channels":["x"]}'

# re-post a run's summary and deck link to the Chat room — costs nothing
curl -sX POST $BASE/v1/runs/42/notify -H "Authorization: Bearer $API_TOKEN"

# credit balance, consumption, last run's cost
curl -s $BASE/v1/usage -H "Authorization: Bearer $API_TOKEN"
```

CLI equivalents: `run [--week-ending ... --force --channels x --no-notify --dry-run]`,
`render --week-ending ...`, `notify <run_id>`, `backfill --from ... --to ...
[--confirm-cost-usd ...]`, `usage`, `smoke`, `dump-fixture <run_id>`, `init-db`.

Iterate on layout through `render`, never by re-running a pull: a re-pull on a later UTC
day is billed in full, and a re-render costs nothing.

## Env vars

Every variable is declared in `app/config.py`, which refuses to boot without the required
ones, and `/readyz` asserts their presence (presence only — it never calls a vendor API).

| Var | Notes |
|---|---|
| `DATABASE_URL` | Railway reference to the Postgres service |
| `API_TOKEN` | ≥32 random bytes; bearer for every `/v1` route, and the HMAC key for deck links |
| `ENV` | `dev` enables `/docs` and `/openapi.json`; anything else disables them |
| `WEEK_TZ` | `Asia/Kolkata` — see below |
| `X_BEARER_TOKEN` | **must** come from the developer app @SwarajyaMag owns — see Owned Reads below |
| `X_USER_ID` | `2451476942`, a constant; never looked up |
| `X_MAX_POSTS_PER_RUN` | default 1500; aborts rather than crawling indefinitely |
| `X_BALANCE_ALERT_USD` | default 20; posts an alert to the room below this |
| `META_ACCESS_TOKEN` | long-lived Page token; expires ~60 days — see rotation below |
| `FB_PAGE_ID`, `IG_USER_ID` | `670321879700525`, `17841400214702908` |
| `META_API_VERSION` | `v21.0`; configurable because Meta deprecates versions on a schedule |
| `GOOGLE_CHAT_WEBHOOK` | incoming webhook on the target room |
| `PUBLIC_BASE_URL` | the `api` service's domain, for the signed deck links |

## Operational notes

### Rotating the Meta long-lived token (~every 60 days)

The Page token expires and there is no warning in any response — the pull simply starts
returning `Meta Graph 400` and the run posts a failure notice. Rotate before it does:

1. In [Graph API Explorer](https://developers.facebook.com/tools/explorer/), select the
   app, then **User Token** with `pages_read_engagement`, `pages_show_list`,
   `instagram_basic`, `instagram_manage_insights`. Generate it.
2. Exchange the short-lived user token for a long-lived one:
   ```bash
   curl -s "https://graph.facebook.com/v21.0/oauth/access_token\
   ?grant_type=fb_exchange_token&client_id=$APP_ID&client_secret=$APP_SECRET\
   &fb_exchange_token=$SHORT_LIVED_USER_TOKEN"
   ```
3. Get the Page token, which inherits the long-lived expiry:
   ```bash
   curl -s "https://graph.facebook.com/v21.0/me/accounts?access_token=$LONG_LIVED_USER_TOKEN"
   ```
   Take `data[].access_token` for page `670321879700525`.
4. Check what you got before deploying it:
   ```bash
   curl -s "https://graph.facebook.com/debug_token?input_token=$NEW\
   &access_token=$LONG_LIVED_USER_TOKEN"
   ```
   Confirm `expires_at`, and that `scopes` contains all four permissions.
5. Set `META_ACCESS_TOKEN` on **both** the `api` and `weekly` services, then confirm with
   `GET /readyz` and a `--dry-run` run.

The same token serves Facebook and Instagram; the Instagram Business account is reached
through the Page.

### Changing the schedule

Railway dashboard → `weekly` service → Settings → Cron Schedule. Cron is evaluated in
**UTC** while the reporting week is **IST**, so the schedule is:

```
30 23 * * 0        # 23:30 UTC Sunday == 05:00 IST Monday
```

That is a Sunday expression that fires on Monday in local terms, and it looks wrong until
you convert it. Do not "simplify" it to a Monday UTC cron: that would run before the week
closes. The 5.5-hour margin between the window closing (18:30 UTC Sunday) and the run is
deliberate.

### Why `WEEK_TZ=Asia/Kolkata`

A settled decision (brief §3), not a default: the audience and the newsroom are both in
India, so a Monday–Sunday IST week is the week people mean. It is config rather than a
constant so the value is visible and testable.

Consequences worth knowing:

- Windows are computed with `zoneinfo`, never a fixed +05:30 offset. India does not
  observe DST today, but hardcoding the offset would make that bug silent if it ever
  changed.
- Sunday's posts have had 5.5–29.5 hours to accrue impressions when the run fires, against
  6–7 days for Monday's. The bias is real, identical every week, and therefore cancels in
  the week-on-week trend. State it if a Sunday looks weak; never correct for it.
- Every `weekly_totals` row is stamped with its own `week_tz`. A week-on-week delta across
  rows whose `week_tz` differs is **refused**, not computed — the deck prints `n/c` and
  says why. The seeded 2026-08-09 row is on UTC weeks and its source window is ambiguous,
  so any comparison reaching back to it carries both caveats.

### Cost: the two facts that matter

- `GET /2/users/{id}/tweets` is $0.001 per post **only** when the token comes from the
  developer app @SwarajyaMag owns; otherwise it is $0.005, and nothing in any response
  says which rate applied — $20/year against $105. `python -m app.cli smoke` checks it,
  but **it cannot conclude on its own**: the credit balance endpoint answers 404 under the
  app-only bearer token (see CLAUDE.md decision 8), so `smoke` reports "inconclusive" and
  prints a manual procedure. Do that once before enabling the cron: note the balance in the
  Developer Console, pull a week not already fetched today, check the drop against the two
  figures `smoke` gives you. It must be a *fresh* week — reads are deduplicated within a
  UTC day, so a same-day re-pull is free and the balance will not move at all.
- The low-balance alert (`X_BALANCE_ALERT_USD`) depends on that same endpoint, so it never
  fires. Watch the Console balance instead until a working path is found.
- `GET /2/users/{id}/followers` is billed **per follower** — about $342 a run here, against
  $0.010 for the `user.fields=public_metrics` lookup. `app/x_client.py` refuses to build
  that path at all, and a test asserts it.

Reads are deduplicated within a UTC day, so retrying a failed run the same day is
effectively free; re-running a week on a later day is billed in full, which is what
`force` guards.
