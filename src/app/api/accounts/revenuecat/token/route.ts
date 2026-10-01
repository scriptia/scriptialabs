import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { RevenueCatTokenError, revenuecatTokenForRun } from '@/server/accounts/revenuecat';
import { revenuecatTokenRequestSchema } from '@/server/validation/pipeline-runs';

export const runtime = 'nodejs';

/**
 * The build's monetization stage asks for RevenueCat API access.
 *
 * A per-app project key labelled with the app's slug wins (a human chose that
 * project); otherwise the OAuth client's access token, refreshed here when it
 * is near expiry — at most once across every caller, since RevenueCat refresh
 * tokens are single-use (server/accounts/revenuecat.ts). The refresh token
 * itself never leaves the panel.
 *
 * 200 {accessToken, mode: 'oauth'|'project', projectId} | 204 (no RevenueCat
 * account applies: the stage skips RevenueCat, billing stays off) | 409 (run
 * lease gone) | 502/503 (RevenueCat refused or another refresh is in flight).
 */
export async function POST(request: NextRequest) {
  const auth = requireBearerToken(request, 'PIPELINE_RUNNER_TOKEN');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = revenuecatTokenRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const { runId, runnerId, leaseToken } = parsed.data;
  try {
    const result = await revenuecatTokenForRun({ runId, holder: { runnerId, leaseToken } });
    if (!result.runValid) return NextResponse.json({ ok: false, error: 'The run lease is no longer valid.' }, { status: 409 });
    if (!result.token) return new NextResponse(null, { status: 204, headers: { 'X-Idle-Reason': 'no_revenuecat_account' } });
    const { accessToken, mode, projectId, label } = result.token;
    return NextResponse.json({ ok: true, accessToken, mode, projectId, label }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof RevenueCatTokenError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
