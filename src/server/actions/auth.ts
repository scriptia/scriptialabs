'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { verifyPassword } from '@/server/auth/password';
import { SESSION_COOKIE, sessionCookieOptions, signSession } from '@/server/auth/session';
import { credentialsSchema } from '@/server/validation/bets';
import { recordAudit } from '@/server/audit';

export type LoginState = { error?: string };

// Only ever redirect to a path inside the panel — a `next` param is attacker-
// controllable and would otherwise be an open redirect off the domain.
function safeNext(value: FormDataEntryValue | null) {
  const candidate = typeof value === 'string' ? value : '';

  return candidate.startsWith('/internal') && !candidate.startsWith('//') ? candidate : '/internal';
}

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password')
  });

  if (!parsed.success) {
    return { error: 'Enter a username and password.' };
  }

  const [user] = await db.select().from(users).where(eq(users.username, parsed.data.username.toLowerCase())).limit(1);

  // Same message whether the user doesn't exist, is deactivated, or the password
  // is wrong — no point telling an attacker which usernames are real.
  const invalid = { error: 'Incorrect username or password.' };

  if (!user || !user.active) {
    return invalid;
  }

  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return invalid;
  }

  const token = await signSession({ userId: user.id, username: user.username, name: user.name, role: user.role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions);

  await recordAudit({ actorId: user.id, entity: 'session', entityId: user.id, action: 'create' });

  redirect(safeNext(formData.get('next')));
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);

  redirect('/internal/login');
}
