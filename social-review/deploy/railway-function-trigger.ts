// Weekly trigger for swarajya-social-review.
//
// Fires on Railway's cron at 30 23 * * 0 — 23:30 UTC Sunday, which is 05:00 IST Monday.
// That is a SUNDAY expression that fires on Monday in local terms and looks wrong until
// you convert it; do not "simplify" it to a Monday cron, which would run before the IST
// week closes at 18:30 UTC Sunday.
//
// It needs ONE variable: TRIGGER_URL, the signed URL from `python -m app.cli trigger-url`.
// No bearer token, no base URL, no credentials — the signature is scoped to this single
// action, so unlike API_TOKEN the URL cannot read a deck, list runs, force a re-pull or
// choose a week. The pipeline itself runs inside the api service, where the vendor
// credentials already live.
//
// GOOGLE_CHAT_WEBHOOK is optional. Set it and an unreachable api service gets reported to
// the room; leave it unset and that one case is silent.

const url = process.env.TRIGGER_URL ?? "";
const hook = process.env.GOOGLE_CHAT_WEBHOOK ?? "";

// The api service posts its own failure notices. The one thing it cannot report is being
// down, and a silent Monday is the failure mode the brief forbids (§11).
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

if (!url) {
  console.error("TRIGGER_URL is not set");
  await alert("*Swarajya social review — the weekly trigger is misconfigured*\n\n" +
              "`TRIGGER_URL` is not set on the trigger function, so no run was started.");
  process.exit(1);
}

let res: Response;
try {
  res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(60_000) });
} catch (err) {
  console.error("api service unreachable:", err);
  await alert(`*Swarajya social review — no run started this week*\n\n` +
              `The trigger could not reach the api service: \`${err}\`.\n` +
              `Nothing was pulled and no deck was produced.`);
  process.exit(1);
}

const body = await res.text();
console.log(`POST /v1/trigger -> ${res.status} ${body}`);

// 202: the run started, and reports itself to the room from here on.
// 409: the cost guard, or a run already in flight. Both are correct refusals by a healthy
//      service — exiting non-zero would mark the deploy failed over nothing.
if (res.status === 202 || res.status === 409) process.exit(0);

// 404 means the signature no longer matches — almost always because API_TOKEN was rotated
// without regenerating the URL, which would otherwise be a silent stop.
const why = res.status === 404
  ? "The signature was rejected. API_TOKEN was probably rotated — regenerate TRIGGER_URL " +
    "with `python -m app.cli trigger-url`."
  : `\`POST /v1/trigger\` returned ${res.status}: \`${body.slice(0, 300)}\``;
await alert(`*Swarajya social review — the weekly trigger was rejected*\n\n${why}\n` +
            `No run was started.`);
process.exit(1);
