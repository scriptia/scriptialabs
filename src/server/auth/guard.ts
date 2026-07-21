import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { SESSION_COOKIE, verifySession, type SessionPayload } from './session';

// The middleware verifies the cookie signature on every /internal request, but
// that alone can't tell us the account was since deactivated or deleted — the
// JWT is valid for 7 days. So server components and actions re-check against the
// database here. One indexed lookup per request; Neon's HTTP driver makes it cheap.
export async function getCurrentUser() {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);

  if (!session) {
    return null;
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);

  if (!user || !user.active) {
    return null;
  }

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/internal/login');
  }

  return user;
}

export type { SessionPayload };
