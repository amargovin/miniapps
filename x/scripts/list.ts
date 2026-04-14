import { sql } from "../src/db.ts";

function formatDate(d: Date | null): string {
  if (!d) return "never";
  return new Date(d).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

async function main(): Promise<void> {
  try {
    // Tracked users
    const users = await sql<{
      id: number;
      handle: string;
      twitter_id: string | null;
      active: boolean;
      added_at: Date;
      last_fetched_at: Date | null;
      notes: string | null;
    }[]>`
      SELECT id, handle, twitter_id, active, added_at, last_fetched_at, notes
      FROM tracked_users
      ORDER BY id
    `;

    console.log("\n=== TRACKED USERS ===");
    if (users.length === 0) {
      console.log("  (none)");
    } else {
      for (const u of users) {
        const status = u.active ? "active" : "inactive";
        const twitterId = u.twitter_id ?? "unresolved";
        const lastFetched = formatDate(u.last_fetched_at);
        const notes = u.notes ? ` — ${u.notes}` : "";
        console.log(
          `  [${u.id}] @${u.handle} (${status}, twitter_id: ${twitterId})${notes}`
        );
        console.log(`       added: ${formatDate(u.added_at)} | last_fetched: ${lastFetched}`);
      }
    }

    // URL monitors
    const monitors = await sql<{
      id: number;
      url: string;
      active: boolean;
      added_at: Date;
      notes: string | null;
    }[]>`
      SELECT id, url, active, added_at, notes
      FROM url_monitors
      ORDER BY id
    `;

    console.log("\n=== URL MONITORS ===");
    if (monitors.length === 0) {
      console.log("  (none)");
    } else {
      for (const m of monitors) {
        const status = m.active ? "active" : "inactive";
        const notes = m.notes ? ` — ${m.notes}` : "";
        console.log(`  [${m.id}] ${m.url} (${status})${notes}`);
        console.log(`       added: ${formatDate(m.added_at)}`);
      }
    }

    // Poll state
    const pollState = await sql<{
      id: number;
      source_type: string;
      source_key: string;
      since_id: string | null;
      last_polled_at: Date | null;
    }[]>`
      SELECT id, source_type, source_key, since_id, last_polled_at
      FROM poll_state
      ORDER BY source_type, source_key
    `;

    console.log("\n=== POLL STATE ===");
    if (pollState.length === 0) {
      console.log("  (none — no polls have run yet)");
    } else {
      for (const p of pollState) {
        const sinceId = p.since_id ?? "none";
        const lastPolled = formatDate(p.last_polled_at);
        console.log(
          `  [${p.id}] ${p.source_type}:${p.source_key}`
        );
        console.log(`       since_id: ${sinceId} | last_polled: ${lastPolled}`);
      }
    }

    // Tweet count summary
    const tweetCounts = await sql<{ source: string; count: string }[]>`
      SELECT source, COUNT(*) as count
      FROM tweets
      GROUP BY source
      ORDER BY source
    `;

    console.log("\n=== TWEET COUNTS BY SOURCE ===");
    if (tweetCounts.length === 0) {
      console.log("  (no tweets stored yet)");
    } else {
      for (const tc of tweetCounts) {
        console.log(`  ${tc.source}: ${tc.count} tweet(s)`);
      }
    }

    console.log("");
  } catch (err) {
    console.error("Database error:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
