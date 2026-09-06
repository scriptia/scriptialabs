import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

import { loadLocalEnv } from '../../src/server/db/load-env';

// One-off: `researching` was removed from betStatuses, so any row still holding
// it is a status the application no longer has a label, a tone or a board column
// for. Those bets would render as a blank badge in a column that does not exist.
//
// They go back to `backlog`, which is where a product-agent run now leaves its
// bet for the run's whole life. If one of them has in fact been published, the
// ingest already set it to `ready` and it is not in this set.
//
// Raw SQL rather than the Drizzle `bets` table: `status` is typed as `BetStatus`
// and `'researching'` is no longer a member of that union, so the query would
// not compile against the schema.
//
// Run with: npx tsx scripts/backfill/drop-researching.ts
// DATABASE_URL defaults to whatever .env.local holds; export it to target
// another environment.
async function main() {
  loadLocalEnv();

  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local, or export it to target another environment.');
  }

  const db = drizzle(neon(url));

  const moved = await db.execute(sql`
    UPDATE bets
    SET status = 'backlog', updated_at = now()
    WHERE status = 'researching'
    RETURNING slug
  `);

  const rows = (moved as unknown as { rows?: Array<{ slug: string }> }).rows ?? (moved as unknown as Array<{ slug: string }>);
  const slugs = Array.isArray(rows) ? rows.map((row) => row.slug) : [];

  if (slugs.length === 0) {
    console.log('No bets were in `researching`. Nothing to do.');
    return;
  }

  console.log(`Moved ${slugs.length} bet(s) from researching to backlog:`);
  for (const slug of slugs) {
    console.log(`  /${slug}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
