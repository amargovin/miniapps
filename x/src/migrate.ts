import { sql } from "./db.ts";
import { readdirSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "migrations");

export async function runMigrations(): Promise<void> {
  // Ensure schema_migrations table exists
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         SERIAL PRIMARY KEY,
      filename   TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Get already-applied migrations
  const applied = await sql<{ filename: string }[]>`
    SELECT filename FROM schema_migrations ORDER BY filename
  `;
  const appliedSet = new Set(applied.map((r) => r.filename));

  // Read migration files, sorted alphabetically
  let files: string[];
  try {
    files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch (err) {
    console.error("[migrate] Could not read migrations directory:", err);
    throw err;
  }

  if (files.length === 0) {
    console.log("[migrate] No migration files found");
    return;
  }

  let applied_count = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`[migrate] Skipping already-applied: ${file}`);
      continue;
    }

    const filePath = join(MIGRATIONS_DIR, file);
    console.log(`[migrate] Applying migration: ${file}`);

    const content = await Bun.file(filePath).text();

    // Execute within a transaction
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`
        INSERT INTO schema_migrations (filename) VALUES (${file})
      `;
    });

    console.log(`[migrate] Applied: ${file}`);
    applied_count++;
  }

  if (applied_count === 0) {
    console.log("[migrate] All migrations already applied, nothing to do");
  } else {
    console.log(`[migrate] Applied ${applied_count} migration(s) successfully`);
  }
}
