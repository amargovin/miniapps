// Weekly trigger for swarajya-social-review.
//
// Cron 30 23 * * 0 — 23:30 UTC Sunday, which is 05:00 IST Monday. A Sunday expression that
// fires on Monday in local terms; do not "simplify" it to a Monday cron or it runs before
// the IST week closes at 18:30 UTC Sunday.
//
// TRIGGER_URL is the only variable: `python -m app.cli trigger-url`.

const res = await fetch(process.env.TRIGGER_URL!, { method: "POST" });
console.log(res.status, await res.text());

// 202 started the run; 409 is the cost guard refusing a week already stored. Both are a
// healthy service. Anything else — including the 404 you get after rotating API_TOKEN
// without regenerating the URL — fails the deploy, so it shows up in Railway rather than
// as a missing Monday.
if (res.status !== 202 && res.status !== 409) process.exit(1);
