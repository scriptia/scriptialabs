import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Minimal .env.local reader for the tools that run outside Next.js — drizzle.config.ts
// and scripts/seed-user.ts. Next.js loads .env.local itself for dev/build, so this is
// never used at runtime; it exists only so `npm run db:push` and `npm run seed:user`
// see the same DATABASE_URL the app does, without pulling in dotenv.
//
// Already-set variables always win, so exporting DATABASE_URL for a one-off run
// against production overrides the local file rather than being silently ignored.
export function loadLocalEnv(files = ['.env.local', '.env']) {
  for (const file of files) {
    const path = resolve(process.cwd(), file);

    if (!existsSync(path)) {
      continue;
    }

    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separator = trimmed.indexOf('=');

      if (separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      const raw = trimmed.slice(separator + 1).trim();
      const value = raw.replace(/^(['"])(.*)\1$/, '$2');

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
