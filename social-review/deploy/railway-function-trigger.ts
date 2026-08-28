// Weekly trigger for swarajya-social-review.
//
// Fires on Railway's cron at 30 23 * * 0 — 23:30 UTC Sunday, which is 05:00 IST Monday.
// That is a SUNDAY expression that fires on Monday in local terms and looks wrong until
// you convert it; do not "simplify" it to a Monday cron, which would run before the IST
// week closes at 18:30 UTC Sunday.
//
// This does not compute anything. POST /v1/runs starts the pipeline inside the api
// service and returns 202 immediately, so all this needs is the base URL and the bearer
// token — no X, Meta or Chat credentials for the report itself.

const base = (process.env.TARGET_URL ?? "").replace(/\/+$/, "");
const token = process.env.API_TOKEN ?? "";
const hook = process.env.GOOGLE_CHAT_WEBHOOK ?? "";

// The api service posts its own failure notices to the room. The one thing it cannot
// report is being unreachable, so that case is alerted from here — otherwise a dead api
// service is a silent Monday, which is the failure mode the brief forbids.
async function alert(text: string): Promise<void> {
  if (!hook) return;
  try {
    await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    console.error("could not post the alert either:", err);
  }
}

if (!base || !token) {
  const missing = [!base && "TARGET_URL", !token && "API_TOKEN"].filter(Boolean).join(", ");
  console.error(`missing ${missing}`);
  await alert(`*Swarajya social review — the weekly trigger is misconfigured*\n\n` +
              `\`${missing}\` is not set on the trigger function, so no run was started.`);
  process.exit(1);
}

// A retry must not start a second, billed run. Scoped to the date so a genuine next week
// is never mistaken for a replay.
const key = `railway-fn-${new Date().toISOString().slice(0, 10)}`;

// Empty body: defaults to the most recent completed week in WEEK_TZ, with notify on.
let res: Response;
try {
  res = await fetch(`${base}/v1/runs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: "{}",
    signal: AbortSignal.timeout(60_000),
  });
} catch (err) {
  console.error("api service unreachable:", err);
  await alert(`*Swarajya social review — no run started this week*\n\n` +
              `The trigger could not reach the api service at ${base}: \`${err}\`.\n` +
              `Nothing was pulled and no deck was produced.`);
  process.exit(1);
}

const body = await res.text();
console.log(`POST ${base}/v1/runs -> ${res.status} ${body}`);

// 202: the run started, and reports itself to the room from here on.
// 409: the cost guard, or a run already in flight. Both are correct refusals by a healthy
//      service — exiting non-zero would mark the deploy failed over nothing.
if (res.status === 202 || res.status === 409) process.exit(0);

await alert(`*Swarajya social review — the weekly trigger was rejected*\n\n` +
            `\`POST /v1/runs\` returned ${res.status}: \`${body.slice(0, 300)}\`\n` +
            `No run was started.`);
process.exit(1);
