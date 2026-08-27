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

## Status: pipeline complete, not yet deployed

Scaffolded 2026-08-27 from a local Claude Code session; build-order steps 2–7 written the
same day from Claude Code on web (branch `claude/social-review-dev-8ep7e4`). **Steps 8 and
9 remain, and both need the Railway dashboard.** 205 tests pass; 29 skip until the
regression fixtures are recorded (see below).

### What exists and works

| Module | Brief | Notes |
|---|---|---|
| `app/config.py` | §4 | every env var declared; boot fails without the required ones |
| `app/schema.sql`, `app/seeds.sql` | §5 | verbatim, plus `idempotency_keys` (see amendments) |
| `app/db.py` | §2 | connection + apply-schema-on-boot |
| `app/window.py` | §3 | IST window, `week_ending` validation, the §8 date wording |
| `app/titles.py` | §7 | deterministic titles, 58-char cap + a rendered-width trim |
| `app/x_client.py` | §4, §10 | pagination, thread reconstruction, 402/429/5xx retries, cost; refuses to build a `/followers` URL |
| `app/meta_client.py` | §4 | cursor pagination, exclusive `until`, NULL-not-zero, independent aggregate |
| `app/aggregate.py` | §6 | the metric definitions and the appendix rows |
| `app/findings.py` | §8 | the summary and all four candidates, incl. duplicate-story detection |
| `app/verify.py` | §9 | the six checks |
| `app/render.py` | §8 | the four-slide deck, ported from `reference/` |
| `app/notify.py`, `app/signing.py` | §4 amended | `Notifier` protocol, `GoogleChatNotifier`, HMAC deck links |
| `app/store.py` | §5 | all SQL; one write transaction per run; 180-day payload retention |
| `app/pipeline.py` | §2 | the pipeline as one library function; advisory lock, cost guards, dry run, channel subsets |
| `app/cli.py`, `app/api.py` | §2.1, §11 | both entrypoints over that function; every route implemented |
| `app/smoke.py` | §10 | the Owned Read pricing proof; `python -m app.cli smoke` |
| `tests/` | — | 205 tests, no network needed; `.github/workflows/social-review-tests.yml` runs them |

### Decisions taken while building (extensions to the brief, not departures from it)

1. **`in_reply_to_user_id` added to `tweet.fields`.** §4's parameter list is given as
   "exactly" that set, but the thread rule in the same section is stated in terms of
   `in_reply_to_user_id`, which is not in it. Reads are billed per resource returned, not
   per field, so requesting it costs nothing and the rule is implemented as written.
2. **Titles are capped at 58 characters *and* at the appendix column's rendered width.**
   Helvetica is proportional: 58 capitals are half again as wide as 58 lowercase letters,
   enough to wrap the narrower column on its own and break §9 check 5. The character cap
   is applied exactly as §7 specifies; the width trim is what makes the guarantee hold.
3. **"Store NULL, not 0" is implemented against the data, not hardcoded to the two known
   fields.** Any field that is 0 (or absent) on *every* post in the window is stored NULL
   and noted as unreported. That covers IG `shares` and FB `comments` as §4 requires, and
   stops mislabelling them the moment a token scope starts returning real numbers.
4. **`idempotency_keys` table, beyond §5.** `Idempotency-Key` has to survive a process
   restart or a client-side timeout could still start a second billed run.
5. **Slide 1 carries a change column after all four pairs**, per §8, including median —
   `reference/build_short.py` omitted the median one, and §8 wins.
6. **A cross-`week_tz` delta is refused, not computed.** §3 says so; the deck prints `n/c`
   and a line explaining that the two windows are not the same seven days. The seeded
   2026-08-09 row is UTC, so the first comparison against it shows no deltas — that is
   correct, not a bug. `render.VERIFIED_EQUIVALENT_WEEKS` is where a verified-equivalent
   week would be added.
7. **A channel that was requested and failed is *not* filled in from a stored row.** A
   channel subset re-pull (the §11 402-recovery recipe) does keep the other channels'
   stored rows, but a deck saying "X unavailable" must not also show an X row. This matters
   more than it looks: the seeded rows include the 2026-08-16 week, so a substitution there
   would have been invisible.
8. **X credit balance comes from `GET /2/usage/credits`.** The response shape
   (`data.total_balance`) was confirmed against the live account through the `xmag`
   connector; the path itself is inferred from that connector's naming and is **not yet
   verified against the REST API directly**. A missing or 404 endpoint is tolerated: the
   balance is reported as unknown and the smoke test says "inconclusive" rather than
   failing an otherwise good run. Confirm it on first deploy.
9. **`python -m app.cli dump-fixture <run_id>`** writes a run's stored `raw_payloads` to
   disk as the §9 regression fixture. The measured numbers in §9 cannot be checked against
   hand-written payloads — that would test the fixture, not the pull — so the fixture is
   recorded from the step-8 run. Until it exists, `tests/test_regression_week.py` skips
   with the exact commands in the skip message.

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
   expires ~60 days and must be rotated in both places; README has the exchange commands),
   plus `GOOGLE_CHAT_WEBHOOK` (create an incoming webhook in the target Chat room) and
   `PUBLIC_BASE_URL` (the api service's domain, once generated).
2. **Connect GitHub** — in the dashboard, point both `api` and `weekly` at
   `amargovin/miniapps`, **root directory `social-review`**. (CLI alternative while
   iterating: `railway up --service api` from this folder.)
3. **weekly service settings** — custom start command `python -m app.cli run`, and cron
   schedule `30 23 * * 0` (23:30 UTC Sunday == 05:00 IST Monday — see §3; do NOT
   "simplify" it to a Monday cron). **Do not enable the cron until step 8's regression
   check passes** (§12).
4. **api service settings** — generate a public domain when first deployed.
5. **X Developer Console** — set a $10/cycle spending limit and auto-recharge before the
   first deploy that talks to X (§10 Guardrails). Balance was $95.25 on 2026-08-27.

## What to build next — build-order steps 8 and 9 only

Everything before them is written and tested. Both remaining steps need the deploy, so
they cannot be done from a code session alone.

**Step 8 — deploy, then one manual run and the regression diff.**

```bash
# 1. after the services are connected and the secrets are set
curl -s $BASE/readyz                              # must be 200, no missing_env

# 2. prove Owned Read pricing BEFORE anything larger (§10). ~$0.10, writes nothing.
railway run --service api python -m app.cli smoke  # must print OK, not "inconclusive"

# 3. the regression run
curl -sX POST $BASE/v1/runs -H "Authorization: Bearer $API_TOKEN" \
     -H 'Content-Type: application/json' \
     -d '{"week_ending":"2026-08-16","force":true,"notify":false}'
curl -s $BASE/v1/runs/<id> -H "Authorization: Bearer $API_TOKEN"
```

Diff the result against the §9 table — 215/4/43 posts, 21,217/1,927/641 engagement,
1,156,638 impressions, 98.7/481.8/14.9 per post, 55/345/13 median, 1.83% engagement rate,
262 posts and 23,785 engagement combined, 52 continuations, 36 duplicate stories over 72
posts with 2,037 in the smaller copy. **It must match exactly.** Note the deck will show
`n/c` in every change column, because the only prior row is the UTC-week 2026-08-09 seed —
that is decision 6 above working, not a fault.

Then freeze the payloads so the arithmetic is checked on every push from then on:

```bash
railway run --service api python -m app.cli dump-fixture <id> \
  --out tests/fixtures/week_2026-08-16
# add the three follower counts to manifest.json — see tests/fixtures/README.md
```

**Step 9 — only then enable the cron schedule.**

## Things that will bite if forgotten

- **Never call `GET /2/users/{id}/followers`** — $342/run vs $0.010 for the
  `user.fields=public_metrics` lookup. Add the test §10 demands.
- Meta `until` is **exclusive** Unix time; the old connector's docs said inclusive and
  silently dropped a Sunday's posts.
- NULL vs 0 is semantic everywhere: unavailable metrics are NULL, never 0 (§4, §9 check 6).
- Retries on the same UTC day are ~free (X dedup); re-pulls on a later day are billed in
  full — hence the `force` guards.
- Week = Monday–Sunday **IST**; compute with `zoneinfo`, never a fixed +05:30 offset.
- All writes for one run in one transaction; upserts, not inserts. The `runs` row is the
  one deliberate exception: it is committed before the pull so a crash leaves an
  inspectable record instead of nothing.
- The seeded historical rows include the **2026-08-16** week, so a test or a run touching
  that week is never working against an empty table. `has_api_rows` ignores
  `source='imported'` rows on purpose — the cost guard is about paying twice for the same
  pull, and imported history never was paid for.
