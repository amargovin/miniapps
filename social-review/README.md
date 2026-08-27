# swarajya-social-review

Weekly social performance review for Swarajya: pulls every post from X, Instagram and
Facebook for the previous week (Monday–Sunday, Asia/Kolkata), reconciles counts, stores
per-post rows and weekly rollups in Postgres, renders a four-slide PDF and posts the
findings summary + a signed deck link to a Google Chat room.
Runs on Railway: managed Postgres + an always-on FastAPI operator service (`api`) + a
cron-scheduled runner (`weekly`).

- **Spec:** `RAILWAY_BRIEF.md` (authoritative — metric definitions, API contract, cost
  rules, verification checks)
- **Current status & next steps:** `CLAUDE.md`
- **Env vars:** see `.env.example`; production values live as Railway variables

## Quick reference

```bash
# local dev
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # fill in
.venv/bin/python -m app.cli init-db
.venv/bin/uvicorn app.api:app --reload

# operator API (see RAILWAY_BRIEF.md §2.1 / §11 for the full contract)
curl -s $BASE/healthz
curl -sX POST $BASE/v1/runs -H "Authorization: Bearer $API_TOKEN" \
     -H 'Content-Type: application/json' -d '{"week_ending":"2026-08-23"}'
```

## Operational notes (to be completed as the service is built — brief §11)

- **Meta token rotation:** the long-lived Page token expires (~60 days). Rotate by
  regenerating via Graph API explorer / `oauth/access_token` exchange and updating
  `META_ACCESS_TOKEN` on both Railway services. TODO: document exact commands.
- **Changing the schedule:** Railway dashboard → `weekly` service → Settings → Cron
  Schedule. Cron is evaluated in UTC; the reporting week is IST (`WEEK_TZ`). Current
  schedule `30 23 * * 0` = 05:00 IST Monday, 5.5h after the week closes.
- **Why `WEEK_TZ=Asia/Kolkata`:** settled decision, see brief §3. Historical rows carry
  their own `week_tz`; cross-timezone comparisons must carry caveats.
