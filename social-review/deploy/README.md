# Deployment assets

## `railway-function-trigger.ts`

The weekly schedule. It runs as a **Railway Function** (`function-bun` service,
`ghcr.io/railwayapp/function-bun`) on the cron `30 23 * * 0`, and does one thing: POST
`/v1/runs` on the api service, which starts the pipeline in the background and returns 202.

**This file is the source of record.** A Railway Function stores its code base64-encoded
inside the service's start command, which is no place for the only copy of anything — it is
invisible to code review, to `grep`, and to anyone reading the repo. Edit it here, then push
the change to Railway:

```bash
base64 -w0 deploy/railway-function-trigger.ts
# set the service's start command to:  ./run.sh <that string>
```

Or paste the file into the service's **Source Code** tab in the Railway canvas, which is the
same thing with fewer steps. Either way, update this file too.

### Why a function rather than a service running `app.cli`

It needs no image build, no repo checkout and no Python. More to the point it holds only
`TARGET_URL`, `API_TOKEN` and `GOOGLE_CHAT_WEBHOOK` — all three as Railway references to the
`api` service, so no credential is duplicated and a rotation propagates by itself. The
vendor credentials stay where the work happens.

`python -m app.cli trigger` does the same job and is kept as the fallback for when the
function is unavailable, or for triggering from a shell.

### What it does and does not treat as failure

- **202** — the run started. It reports itself to the Chat room from there on.
- **409** — the cost guard, or a run already in flight. Both are correct refusals by a
  healthy service, so the function exits 0. Exiting non-zero here is what previously had
  Railway reporting a healthy system as a crash loop.
- **Anything else, or unreachable** — exits 1 *and posts to the Chat room*. The api service
  posts its own failure notices, but the one thing it cannot report is being down, and a
  silent Monday is the failure mode the brief explicitly forbids (§11).
