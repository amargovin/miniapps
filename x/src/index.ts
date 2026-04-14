import { sql } from "./db.ts";
import { runMigrations } from "./migrate.ts";
import { pollUserTimelines, pollUrlMonitors, pollMentionMonitors } from "./poll.ts";

function validateEnv(): void {
  const required = ["X_BEARER_TOKEN", "DATABASE_URL"] as const;
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

async function main(): Promise<void> {
  console.log("[main] X Tweet Tracker starting...");

  // Validate required environment variables
  validateEnv();
  console.log("[main] Environment validated");

  // Run database migrations
  console.log("[main] Running migrations...");
  await runMigrations();

  // Poll user timelines
  console.log("[main] Polling user timelines...");
  await pollUserTimelines();

  // Poll URL monitors
  console.log("[main] Polling URL monitors...");
  await pollUrlMonitors();

  // Poll mention monitors
  console.log("[main] Polling mention monitors...");
  await pollMentionMonitors();

  // Close database connection
  await sql.end();
  console.log("[main] Done. Exiting.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[main] Fatal error:", err);
  process.exit(1);
});
