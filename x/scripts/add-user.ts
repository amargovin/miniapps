import { sql } from "../src/db.ts";

const HANDLE_REGEX = /^[A-Za-z0-9_]{1,15}$/;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: bun scripts/add-user.ts <handle> [notes]");
    console.error("  Example: bun scripts/add-user.ts elonmusk");
    console.error("  Example: bun scripts/add-user.ts @naval 'Naval Ravikant'");
    process.exit(1);
  }

  // Strip leading @ if present
  const rawHandle = args[0] ?? "";
  const handle = rawHandle.startsWith("@") ? rawHandle.slice(1) : rawHandle;
  const notes = args[1] ?? null;

  // Validate handle format
  if (!HANDLE_REGEX.test(handle)) {
    console.error(
      `Error: "${handle}" is not a valid Twitter handle.`
    );
    console.error("Handles must be 1-15 characters: letters, numbers, underscores only.");
    process.exit(1);
  }

  try {
    const result = await sql<{ id: number; handle: string }[]>`
      INSERT INTO tracked_users (handle, notes)
      VALUES (${handle}, ${notes})
      ON CONFLICT (handle) DO NOTHING
      RETURNING id, handle
    `;

    if (result.length === 0) {
      console.log(`User @${handle} is already being tracked.`);
    } else {
      const row = result[0]!;
      console.log(`Added @${handle} (id: ${row.id}) to tracked users.`);
    }
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
