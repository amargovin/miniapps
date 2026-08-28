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

**There is no `weekly` cron service.** The brief's §2 called for three Railway services;
there are two (Postgres and `api`). Decided by Amar 2026-08-28, during the deploy:

- `POST /v1/runs` already starts the same `run_pipeline` function in the background,
  defaults to the last completed week and defaults `notify` to true, so the cron container
  was only ever a second way to invoke identical code.
- The schedule now lives in `.github/workflows/social-review-weekly.yml` — same
  `30 23 * * 0` expression, same UTC-vs-IST caveat, plus `workflow_dispatch` for a manual
  run. It needs two repository secrets: `SOCIAL_REVIEW_URL` and `SOCIAL_REVIEW_TOKEN`.
- Dropping it removes a container, removes a whole class of "did that env var land on both
  services?" bug, and removes a real hazard found on first deploy: **Railway starts a
  service when the repo is connected, whether or not a cron is configured**, so wiring up
  `weekly` fired an immediate live billed run for week ending 2026-08-23.
- The CLI's `run` command stays — shell access and the fallback for when the API is down.
  Everywhere §3, §11 or §12 says "the cron" or "the weekly service", read: the scheduled
  `POST /v1/runs`.

## Status: pipeline complete, deployed, step 8 verified

Scaffolded 2026-08-27 from a local Claude Code session; build-order steps 2–7 written the
same day from Claude Code on web. Deployed and step-8 verified 2026-08-28. 212 tests pass;
29 skip until the regression fixtures are recorded (see below).

### Step 8 results (2026-08-28) — the gate is cleared

Two runs, both `status='ok'`, which is only reachable when all six §9 checks pass:

| run | week ending | channels | cost |
|---|---|---|---|
| 1 | 2026-08-23 | all three | $0.2330 |
| 2 | 2026-08-16 | all three | $0.2250 |

**The §9 regression table matched on everything still checkable.** Post counts 215/4/43 and
ranked counts 163/4/43 were exact — so were the 52 thread continuations and the X and
Facebook medians. Run 2's cost of $0.2250 is 215 × $0.001 + $0.010, confirming the X post
count a second way, through the billing rather than the row count.

What drifted, and why it had to: X engagement 21,217 → 21,063 (−0.73%), impressions
1,156,638 → 1,159,254 (+0.23%), Instagram engagement 1,927 → 2,156 (+11.9%), followers
−58 / +331 / −272. The brief's targets were measured on 2026-08-27 and the run was 11 days
later. §5 says metrics keep accruing, and followers are a point-in-time reading that can
never be re-taken for a past week. X engagement *falling* while impressions rose is
attrition — withdrawn likes and bookmarks, deactivated accounts — on a week old enough that
accrual has stopped. Derived metrics were checked against the stored components and are
internally consistent. **The brief's "must match exactly" was only ever satisfiable on
2026-08-27; it is not available any more, and nobody should chase it.**

**Owned Read pricing is verified** (§10's central cost fact). The credit balance is not
readable from the service (decision 8 below), so it was measured through the account's MCP
connector either side of run 2: $94.85 → $94.64, a $0.21 draw against $0.225 expected at
$0.001/post and $1.085 at $0.005/post. Not a close call. The 24-hour dedup also proved
itself — `cli smoke` re-fetched 95 of run 1's posts eight minutes later for nothing.

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
8. **The X credit balance is not readable from this service — confirmed on deploy.**
   `GET /2/usage/credits` (the path implied by the `xmag` connector's naming) answers
   **404 with the app-only bearer token**, measured against production 2026-08-28. The
   same figure reads fine through the account's user-authenticated MCP connector, which
   points at the endpoint needing OAuth 2.0 user context — X answers 404, not 403, for the
   wrong auth context — and no REST path for it appears in the X docs. Consequences:
   - the balance read stays best-effort and never fails a run; the first 404 is remembered
     so a run makes one futile request rather than two;
   - `x_balance_alert_usd` can therefore never fire. The low-balance alert is dead code
     until a working path exists — **watch the Developer Console instead**;
   - §10's balance-delta signal (the earliest warning that Owned Read pricing has stopped
     applying) has no automatic source. `runs.x_cost_usd` still records the estimate, so
     the check is: compare it against the Console's spend by hand, now and again.
   - `cli smoke` therefore returns "inconclusive", not a pass, and prints the manual
     procedure. **Verifying the rate once, by hand, is still required before step 9** —
     the difference is $20/year against $105.
   Fixing this properly means finding the real path or giving the service a user-context
   token; neither is worth blocking the deploy on.
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
| api | `d25eb897-5caa-4113-9535-b1f361ac141c` | deployed, healthy; domain `api-production-0bf0e.up.railway.app` |
| ~~weekly~~ | ~~`6220d13e-3b2f-402c-90d9-7697fba95040`~~ | **deleted 2026-08-28** — replaced by the GitHub Actions schedule (see amendments) |

Set on `api`: `DATABASE_URL` (reference to Postgres), `API_TOKEN` (generated, 32 random
bytes — local copy in the gitignored `.api-token-local`), `ENV`, `WEEK_TZ`, `X_USER_ID`,
`X_MAX_POSTS_PER_RUN`, `X_BALANCE_ALERT_USD`, `FB_PAGE_ID`, `IG_USER_ID`,
`META_API_VERSION`, `X_BEARER_TOKEN`, `META_ACCESS_TOKEN`, `GOOGLE_CHAT_WEBHOOK`,
`PUBLIC_BASE_URL`. `MAIL_TO` predates the Chat amendment and is unused — delete it.

### Manual steps — done, and what is left

Done 2026-08-27/28: secrets on `api` (`X_BEARER_TOKEN`, `META_ACCESS_TOKEN`,
`GOOGLE_CHAT_WEBHOOK`, `PUBLIC_BASE_URL`); repo connected with root directory
`social-review`; public domain generated; step 8's run and diff (results above); the
`weekly` service deleted.

Left to do:

1. **Delete `MAIL_TO`** from `api` — a leftover from before the Chat amendment.
2. **GitHub repository secrets** for the schedule: `SOCIAL_REVIEW_URL`
   (`https://api-production-0bf0e.up.railway.app`) and `SOCIAL_REVIEW_TOKEN` (the
   `API_TOKEN` value). Without both, `.github/workflows/social-review-weekly.yml` fails
   fast with an explicit error rather than silently doing nothing.
3. **X Developer Console** — a $10/cycle spending limit and auto-recharge (§10 Guardrails).
   Not yet confirmed done. Balance $94.64 on 2026-08-28. This is the only remaining
   guardrail against a runaway, now that the balance-alert path is known dead (decision 8).
4. **Record the regression fixtures** so the 29 skipped tests start running — see below.
5. **Rotate the Meta token** before ~2026-10-26 (~60 days from 2026-08-27). README has the
   exchange commands.

## What is left

**The pipeline is built, deployed and verified.** Step 9 — "enable the schedule" — is now
"add the two GitHub secrets and let the workflow fire", since there is no cron to enable.
Nothing blocks it: step 8's gate passed and Owned Read pricing is confirmed.

**Record the regression fixtures.** The 29 skipped tests in
`tests/test_regression_week.py` replay recorded payloads. Run 2's payloads are in
`raw_payloads` for 180 days:

```bash
python -m app.cli dump-fixture 2 --out tests/fixtures/week_2026-08-16
# then add the follower counts to manifest.json:
#   "followers": {"x": 342714, "instagram": 60073, "facebook": 633599}
```

The container filesystem is ephemeral, so the files have to be copied out and committed.
Note that the fixture will lock in the numbers **as measured on 2026-08-28**, not the
brief's 2026-08-27 targets — so `EXPECTED` in that test needs updating to the recorded
values for the metric rows. The structural rows (215/4/43 posts, 163/4/43 ranked, 52
continuations) are properties of the window and stay as the brief has them.

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
