import { sql } from "../src/db.ts";

function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: bun scripts/add-url.ts <url> [notes]");
    console.error("  Example: bun scripts/add-url.ts https://example.com");
    console.error("  Example: bun scripts/add-url.ts https://myproduct.com 'Product launch tracking'");
    process.exit(1);
  }

  const url = args[0] ?? "";
  const notes = args[1] ?? null;

  if (!isValidUrl(url)) {
    console.error(`Error: "${url}" is not a valid HTTP/HTTPS URL.`);
    process.exit(1);
  }

  try {
    const result = await sql<{ id: number; url: string }[]>`
      INSERT INTO url_monitors (url, notes)
      VALUES (${url}, ${notes})
      ON CONFLICT (url) DO NOTHING
      RETURNING id, url
    `;

    if (result.length === 0) {
      console.log(`URL "${url}" is already being monitored.`);
    } else {
      const row = result[0]!;
      console.log(`Added URL monitor (id: ${row.id}): ${row.url}`);
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
