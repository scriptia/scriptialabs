import { defineConfig } from 'drizzle-kit';

import { loadLocalEnv } from './src/server/db/load-env';

// drizzle-kit and the seed script run outside Next.js, so the .env.local that
// `next dev` loads automatically is not loaded for them. This reads it once,
// here, rather than adding dotenv as a dependency. In CI or against production
// DATABASE_URL is already a real environment variable and this is a no-op.
loadLocalEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ''
  },
  strict: true,
  verbose: true
});
