import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

// Shared bearer-token check for API routes called by processes outside the
// browser — same reasoning as ADR-011's ingest route, generalized: Claude
// Code Skills and BRAND-AGENT cannot hold a session cookie, so /internal's
// middleware-enforced login (which doesn't even see these routes — the
// matcher in src/middleware.ts excludes /api entirely) is not an option here.
// See ADR-012.

// Hash both sides before comparing: timingSafeEqual throws on length
// mismatch, and the length of the supplied token is itself a small leak.
function tokenMatches(supplied: string, expected: string) {
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update(expected).digest();

  return timingSafeEqual(a, b);
}

export type BearerCheck = { ok: true } | { ok: false; response: NextResponse };

// An unset token env var means the surface is not configured on this
// deployment — 503, not 401, so a first deploy fails loudly rather than
// looking like a caller error. Same distinction as the ingest route.
export function requireBearerToken(request: NextRequest, envVarName: string): BearerCheck {
  const expected = process.env[envVarName];

  if (!expected) {
    return { ok: false, response: NextResponse.json({ ok: false, error: `${envVarName} is not configured on this deployment.` }, { status: 503 }) };
  }

  const header = request.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!supplied || !tokenMatches(supplied, expected)) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'Invalid or missing bearer token.' }, { status: 401 }) };
  }

  return { ok: true };
}
