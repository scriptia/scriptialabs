import { jwtVerify, SignJWT } from 'jose';

export const SESSION_COOKIE = 'scriptia_internal_session';

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: string;
  username: string;
  name: string;
  role: 'admin' | 'member';
};

// jose rather than jsonwebtoken: middleware runs on the Edge runtime, which has
// WebCrypto but not node:crypto. This module is therefore imported by both the
// middleware and Node-runtime server actions, so it must stay Edge-safe — do not
// add node:* imports here (password hashing lives in ./password.ts for this reason).
function secret() {
  const value = process.env.INTERNAL_SESSION_SECRET;

  if (!value || value.length < 32) {
    throw new Error('INTERNAL_SESSION_SECRET must be set to a random string of at least 32 characters.');
  }

  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret());
    const { userId, username, name, role } = payload as Partial<SessionPayload>;

    if (typeof userId !== 'string' || typeof username !== 'string' || typeof name !== 'string') {
      return null;
    }

    return { userId, username, name, role: role === 'admin' ? 'admin' : 'member' };
  } catch {
    // Expired, tampered, or signed with a rotated secret — all mean "logged out".
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS
} as const;
