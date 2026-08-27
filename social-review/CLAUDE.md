# social-review — Swarajya weekly social review service

Scheduled Python service: once a week, pull every Swarajya post from X, Instagram and
Facebook for the previous IST week, reconcile against the APIs' own aggregates, store in
Postgres, render a four-slide PDF, post it to a Google Chat room.

**`RAILWAY_BRIEF.md` in this folder is the full build specification and it is
authoritative — except where amended below.** Numbers in it are measured regression
targets, not examples. Read it before writing any code. This file is only the map: what
exists, what's provisioned, and what to do next.

## Amendments to the brief (decided by Amar after the brief was written)

**Delivery is a Google Chat room, not email.** Everywhere the brief says email
(§4 "Email delivery", §8 "Email body", §9 alert email, §11 failure notice), read:

- No Resend / SendGrid / SMTP, no `RESEND_API_KEY`, `MAIL_TO`, `MAIL_FROM`. Instead
  `GOOGLE_CHAT_WEBHOOK` — an incoming webhook on the target room.
- Incoming webhooks **cannot attach files**, so the weekly message is: the three-to-four
  sentence findings summary from §8 as message text (Chat supports basic formatting),
  the subject line from §4 as its first line ("Swarajya social review — week ending
  Sunday 16 August 2026"), and a **signed link to the PDF**:
  `GET /v1/decks/{week_ending}.pdf?sig=<hmac_sha256(API_TOKEN, week_ending) hex>` served
  by the `api` service — no bearer header, so it opens straight from Chat. Compare with
  `hmac.compare_digest`; 404 on bad signature. `PUBLIC_BASE_URL` env var supplies the
  link base.
- Keep the delivery behind the same protocol the brief calls `Mailer` — call it
  `Notifier`, one `GoogleChatNotifier` implementation, so email can be added back later.
- Verification failures (§9) and unhandled exceptions (§11) post to the same webhook
  with the failing check / final traceback frame. Silence on a Monday morning must
  still never be the failure mode.
- `POST /v1/runs/{run_id}/email` in §2.1 is now `POST /v1/runs/{run_id}/notify`
  (re-posts summary + link to the room; still costs nothing). The `send_email` field in
  the `POST /v1/runs` body is now `notify` (same semantics, default true).
- `MAIL_TO` is still set on the Railway services from before this amendment; it is
  unused — ignore or delete it.

## Status: scaffold only — no pipeline code exists yet

Scaffolded 2026-08-27 from a local Claude Code session. Development continues from
Claude Code on web against this repo (`amargovin/miniapps`, subfolder `social-review/`).

### What exists and works

- `app/config.py` — pydantic-settings, every env var declared, fails boot if secrets missing
- `app/schema.sql` — verbatim from brief §5; `app/seeds.sql` — the two historical weeks,
  idempotent
- `app/db.py` — connection + apply-schema-on-boot
- `app/cli.py` — `init-db` works; `run` / `render` / `backfill` are stubs
- `app/api.py` — FastAPI with working bearer auth (`secrets.compare_digest`), `/healthz`,
  `/readyz`, docs disabled outside `ENV=dev`, no CORS; every `/v1` route is a 501 stub
- `Dockerfile` (one image, two entrypoints), `railway.json`, `requirements.txt` (pinned
  2026-08-27)
- `reference/` — the old manual process's renderer (`build_deck.py`), the four-slide
  layout to port (`build_short.py`) and metric scripts; see `reference/README.md`

### Railway — already provisioned

Project **swarajya-social-review**, id `61e38253-cba0-4578-b173-37b8fe9a0dea`, workspace
"amargovin's Projects", environment `production`.

| Service | id | Notes |
|---|---|---|
| Postgres | `fa69c9a1-8f52-4ee3-bf42-d7381700e99c` | managed, always on |
| api | `d25eb897-5caa-4113-9535-b1f361ac141c` | empty service, vars set |
| weekly | `6220d13e-3b2f-402c-90d9-7697fba95040` | empty service, vars set |

Already set on both `api` and `weekly`: `DATABASE_URL` (reference to Postgres),
`API_TOKEN` (generated, 32 random bytes — local copy in the gitignored
`.api-token-local`), `ENV`, `WEEK_TZ`, `X_USER_ID`, `X_MAX_POSTS_PER_RUN`,
`X_BALANCE_ALERT_USD`, `FB_PAGE_ID`, `IG_USER_ID`, `META_API_VERSION`, `MAIL_TO`.

### Manual steps still needed (dashboard / Amar)

1. **Secrets** — set on both `api` and `weekly`: ~~`X_BEARER_TOKEN`, `META_ACCESS_TOKEN`~~
   (done 2026-08-27, copied from xmcpbridge / mcp-social-analytics — note the Meta token
   expires ~60 days and must be rotated in both places), plus `GOOGLE_CHAT_WEBHOOK`
   (create an incoming webhook in the target Chat room) and `PUBLIC_BASE_URL` (the api
   service's domain, once generated).
2. **Connect GitHub** — in the dashboard, point both `api` and `weekly` at
   `amargovin/miniapps`, **root directory `social-review`**. (CLI alternative while
   iterating: `railway up --service api` from this folder.)
3. **weekly service settings** — custom start command `python -m app.cli run`, and cron
   schedule `30 23 * * 0` (23:30 UTC Sunday == 05:00 IST Monday — see §3; do NOT
   "simplify" it to a Monday cron). **Do not enable the cron until build-order step 8's
   regression check passes** (§12).
4. **api service settings** — generate a public domain when first deployed.
5. **X Developer Console** — set a $10/cycle spending limit and auto-recharge before the
   first deploy that talks to X (§10 Guardrails).

## What to build next

Follow the build order in §12 of the brief exactly. Summary:

1. ~~Repo skeleton, config, schema, seeds~~ (done — but wire `init-db` into deploy/boot ✔ api does it on startup)
2. X client: pagination, thread detection, retry policy (§4). Unit tests on recorded fixtures.
3. Meta client: cursor pagination, **exclusive-`until`** test (§4 — a real bug lived here).
4. Aggregation (§6, exact definitions) + `verify()` checks (§9).
5. PDF renderer: port `reference/build_short.py` (four-slide layout) with
   `reference/build_deck.py`'s visual system into one module, layout per §8, page-count
   and link-count verification.
6. Notifier behind a protocol (`GoogleChatNotifier` — see amendments above) + the
   signed deck-link route.
7. Pipeline as one library function; CLI and API both call it. Advisory lock, background
   runs, Idempotency-Key, the two `409` cost guards — **write tests for those two**.
8. Deploy, then one manual run for week-ending 2026-08-16 with `force:true,
   notify:false`, diff against the §9 regression table (215/4/43 posts,
   21,217/1,927/641 engagement, etc. — must match exactly).
9. Only then enable the cron schedule.

## Things that will bite if forgotten

- **Never call `GET /2/users/{id}/followers`** — $342/run vs $0.010 for the
  `user.fields=public_metrics` lookup. Add the test §10 demands.
- Meta `until` is **exclusive** Unix time; the old connector's docs said inclusive and
  silently dropped a Sunday's posts.
- NULL vs 0 is semantic everywhere: unavailable metrics are NULL, never 0 (§4, §9 check 6).
- Retries on the same UTC day are ~free (X dedup); re-pulls on a later day are billed in
  full — hence the `force` guards.
- Week = Monday–Sunday **IST**; compute with `zoneinfo`, never a fixed +05:30 offset.
- All writes for one run in one transaction; upserts, not inserts.
