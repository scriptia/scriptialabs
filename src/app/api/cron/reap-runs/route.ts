import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

import { reapExpiredRuns } from '@/server/pipeline/reap';

export const runtime = 'nodejs';

// The BACKSTOP, not the mechanism.
//
// Reaping happens lazily where it matters — POST /api/runs/claim and the panel's
// Runs list, both in server/pipeline/reap.ts — so a wedged run is freed within
// one runner poll (~20s) rather than waiting for a schedule. This daily pass
// exists only for the case where nobody polls and nobody looks.
//
// Daily because Vercel's Hobby plan caps cron at once per day and rejects a
// deployment whose expression would run more often. That constraint is what
// pushed the reaping to the call sites, which turned out to be the better design
// anyway: freeing a slot when someone wants it beats a timer that is usually
// early or late.

// Same inline check as the overdue-tasks cron: this is a Vercel Cron caller, not
// one of the token-holding agents, so it does not use requireBearerToken.
function tokenMatches(supplied: string, expected: string) {
  return timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(expected).digest());
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET is not configured on this deployment.' }, { status: 503 });
  }

  const header = request.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!supplied || !tokenMatches(supplied, expected)) {
    return NextResponse.json({ ok: false, error: 'Invalid or missing bearer token.' }, { status: 401 });
  }

  const result = await reapExpiredRuns();

  return NextResponse.json({ ok: true, ...result });
}
