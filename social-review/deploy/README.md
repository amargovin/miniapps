# Deployment assets

## `railway-function-trigger.ts`

The weekly schedule: a **Railway Function** (`function-bun` service, Bun runtime) on the
cron `30 23 * * 0`. It hits the signed trigger URL and exits. That's the whole thing.

One variable:

```bash
python -m app.cli trigger-url      # -> https://<api>/v1/trigger?sig=<hmac>
```

No bearer token, no base URL, no header. The signature is scoped to one action, so the URL
cannot read a deck, list runs, force a re-pull or choose a week — all it can do is start
the run the schedule would have started, which the §10 cost guard then refuses if that week
is already stored. The vendor credentials never leave the api service.

**Regenerate the URL whenever `API_TOKEN` is rotated.** The old one starts returning 404,
which fails the deploy — visible in Railway, rather than a Monday that quietly never comes.

**This file is the source of record.** Railway stores a function's code base64-encoded
inside the service's start command, which is no place for the only copy of anything.
Paste this file into the service's **Source Code** tab after editing it here.

### What it deliberately does not do

An earlier version posted to the Chat room when the api service was unreachable — the one
failure the api service cannot report about itself. It was most of the file. If you want
that back, Railway's own deploy-failure notifications cover the same case for free: the
function exits non-zero, the deployment is marked failed, and Railway tells you. Worth
checking those are switched on for this service.

`python -m app.cli trigger` does the same job from inside a container, as the fallback.
