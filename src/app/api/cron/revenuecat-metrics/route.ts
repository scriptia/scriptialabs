import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

import { collectRevenueSnapshots } from '@/server/revenuecat/metrics';

// Called daily by Vercel Cron (see vercel.json): one RevenueCat overview per app
// into revenue_snapshots, for the Monetization card. Same auth as the other crons.
export const runtime = 'nodejs';
export const maxDuration = 300;

function tokenMatches(supplied: string, expected: string) {
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update(expected).digest();

  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return NextResponse.json({ ok: false, error: 'Cron is not configured on this deployment.' }, { status: 503 });
  }

  const header = request.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!supplied || !tokenMatches(supplied, expected)) {
    return NextResponse.json({ ok: false, error: 'Invalid or missing bearer token.' }, { status: 401 });
  }

  const outcomes = await collectRevenueSnapshots();
  return NextResponse.json({ ok: true, apps: outcomes.length, saved: outcomes.filter((o) => o.ok).length, failures: outcomes.filter((o) => !o.ok) });
}
