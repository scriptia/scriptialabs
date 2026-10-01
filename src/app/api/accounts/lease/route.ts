import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { pipelineRunEvents } from '@/server/db/schema';
import { leaseAccount, peekAccount, type LeasedAccount } from '@/server/pipeline/queue';
import { accountLeaseRequestSchema } from '@/server/validation/pipeline-runs';
import { openSecret } from '@/server/vault/crypto';

export const runtime = 'nodejs';

/**
 * A platform stage asks for an account: the release stage for an EAS account,
 * the backend stage for a Supabase org, either for the Apple bundle.
 *
 * Only a run holding a valid lease can ask (fenced in the same statement as the
 * lease insert), and the account lease lives and dies with that run lease — the
 * same heartbeat extends it, the same complete/pause/reaper releases it.
 *
 * `prefer` is the account the app is already linked to: an EAS switch costs a
 * version bump and a new projectId, so staying put wins whenever it can.
 *
 * 200 {account} | 204 + X-Next-Account-At (none free) | 409 (lease gone).
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

  const parsed = accountLeaseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const { runId, provider, prefer, exclude, readOnly } = parsed.data;
  const holder = { runnerId: parsed.data.runnerId, leaseToken: parsed.data.leaseToken };

  let account: LeasedAccount;
  if (readOnly) {
    if (!prefer) return NextResponse.json({ ok: false, error: 'readOnly needs the account id in `prefer`.' }, { status: 422 });
    const peeked = await peekAccount({ runId, holder, provider, accountId: prefer });
    if (!peeked) return NextResponse.json({ ok: false, error: 'No such active account, or the run lease is no longer valid.' }, { status: 409 });
    account = peeked;
  } else {
    const result = await leaseAccount({ runId, holder, provider, prefer, exclude });

    if (!result.account) {
      if (!result.runValid) return NextResponse.json({ ok: false, error: 'The run lease is no longer valid.' }, { status: 409 });
      const headers = new Headers({ 'X-Idle-Reason': 'no_accounts' });
      if (result.nextAt) headers.set('X-Next-Account-At', result.nextAt.toISOString());
      return new NextResponse(null, { status: 204, headers });
    }

    account = result.account;
  }
  let secret: string;
  try {
    secret = openSecret(account.secretEncrypted);
  } catch {
    return NextResponse.json({ ok: false, error: `Account "${account.label}" could not be decrypted. Check ACCOUNT_VAULT_KEY.` }, { status: 500 });
  }

  // Apple is a shared bundle read on every release; logging each read would
  // drown the timeline. Pool accounts are worth a line: they explain a switch.
  if (provider !== 'apple' && !readOnly) {
    await db.insert(pipelineRunEvents).values({
      runId,
      level: 'info',
      message: `Leased ${provider} account "${account.label}"${prefer && prefer !== account.id ? ' (the linked one was unavailable)' : ''}.`,
      data: { accountId: account.id, provider }
    });
  }

  return NextResponse.json(
    {
      ok: true,
      account: {
        id: account.id,
        provider,
        label: account.label,
        identity: account.identity,
        credentialType: account.credentialType,
        plan: account.plan,
        quota: account.quota,
        secret
      }
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
