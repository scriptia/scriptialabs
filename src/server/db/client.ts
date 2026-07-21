import 'server-only';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

type Database = ReturnType<typeof createClient>;

function createClient() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is not set. Add the Neon integration on Vercel, or copy .env.example to .env.local for local development.');
  }

  // The neon-http driver speaks HTTP rather than TCP, so it works in serverless
  // functions without connection pooling and without holding a socket open
  // between invocations — which is what keeps this inside the free tier.
  // One statement per round trip: it does not support interactive transactions.
  return drizzle(neon(url), { schema });
}

let instance: Database | null = null;

function client() {
  instance ??= createClient();

  return instance;
}

// Lazily constructed behind a proxy so importing this module never reads the
// environment. `next build` imports every route module to collect page data,
// and a build machine without DATABASE_URL should still produce a working
// bundle — the panel's pages are all dynamic and only connect at request time.
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = client();
    const value = Reflect.get(instance, property) as unknown;

    // Bind to the real client, not the proxy — drizzle's query builders rely on
    // `this` and would otherwise re-enter this trap for every internal access.
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export { schema };
