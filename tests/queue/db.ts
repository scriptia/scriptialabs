// Stand-in for src/server/db/client.ts in the queue tests: the same drizzle `sql` objects the
// app sends over neon-http, executed on a plain Postgres through `pg` (tsconfig.json maps
// `@/server/db/client` here). Only `execute` exists — queue.ts uses nothing else.
import { PgDialect } from 'drizzle-orm/pg-core';
import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 40 });
const dialect = new PgDialect();

export const db = {
  async execute(query: Parameters<PgDialect['sqlToQuery']>[0]) {
    const { sql, params } = dialect.sqlToQuery(query);
    const res = await pool.query(sql, params);
    return { rows: res.rows };
  }
};

export const schema = {};
