import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';

import { loadLocalEnv } from '../src/server/db/load-env';
import { hashPassword } from '../src/server/auth/password';
import { users } from '../src/server/db/schema';

// There is no signup route — internal accounts are created deliberately, here.
// Run with: npm run seed:user -- <username>
// Point DATABASE_URL at production to create a real account; it defaults to
// whatever .env.local holds.
async function main() {
  loadLocalEnv();

  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local, or export it to target another environment.');
  }

  const username = process.argv[2]?.trim().toLowerCase();

  if (!username) {
    throw new Error('Usage: npm run seed:user -- <username>');
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const name = (await rl.question(`Display name for "${username}": `)).trim() || username;
  const password = (await rl.question('Password: ')).trim();
  const role = (await rl.question('Role [admin/member] (default member): ')).trim() === 'admin' ? 'admin' : 'member';
  rl.close();

  if (password.length < 8) {
    throw new Error('Choose a password of at least 8 characters.');
  }

  const db = drizzle(neon(url));
  const passwordHash = await hashPassword(password);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);

  if (existing) {
    // Re-running for an existing username resets that account's password —
    // which is also how you recover from a forgotten one, since there is no
    // password-reset flow.
    await db.update(users).set({ passwordHash, name, role, active: true }).where(eq(users.id, existing.id));
    console.log(`Updated existing user "${username}" (password reset, role: ${role}).`);
    return;
  }

  await db.insert(users).values({ username, name, passwordHash, role });
  console.log(`Created user "${username}" (role: ${role}). Sign in at /internal/login.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
