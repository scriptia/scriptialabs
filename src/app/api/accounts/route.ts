import { NextResponse, type NextRequest } from 'next/server';

import { isAccountProvider } from '@/content/internal';
import { createAccount } from '@/server/accounts/service';
import { requireBearerToken } from '@/server/auth/api-token';
import { listAccounts } from '@/server/queries/accounts';
import { isVaultConfigured } from '@/server/vault/crypto';

export const runtime = 'nodejs';

// The orchestrator CLI's view of the pool (`python -m orchestrator accounts
// list|add`). Behind the runner token: a machine with that token can already
// lease any account and read its secret, so letting it add one is no
// escalation — and it is what makes onboarding a Claude subscription one
// command (`accounts add claude` runs `claude setup-token` and posts here).
//
// GET never returns secrets; POST takes one and seals it.

export async function GET(request: NextRequest) {
  const auth = requireBearerToken(request, 'PIPELINE_RUNNER_TOKEN');
  if (!auth.ok) return auth.response;

  const provider = request.nextUrl.searchParams.get('provider') ?? undefined;
  if (provider && !isAccountProvider(provider)) return NextResponse.json({ ok: false, error: `Unknown provider "${provider}".` }, { status: 422 });

  const accounts = await listAccounts(provider as never);
  return NextResponse.json({
    ok: true,
    accounts: accounts.map((account) => ({
      id: account.id,
      provider: account.provider,
      label: account.label,
      identity: account.identity,
      plan: account.plan,
      status: account.status,
      availability: account.availability,
      activeLeases: account.activeLeases,
      maxConcurrency: account.maxConcurrency,
      limitedUntil: account.limitedUntil?.toISOString() ?? null,
      limitReason: account.limitReason,
      secretHint: account.secretHint,
      quota: account.quota,
      lastUsedAt: account.lastUsedAt?.toISOString() ?? null,
      heldBy: account.heldBy,
      sessions7d: account.sessions7d,
      limits7d: account.limits7d
    }))
  });
}

export async function POST(request: NextRequest) {
  const auth = requireBearerToken(request, 'PIPELINE_RUNNER_TOKEN');
  if (!auth.ok) return auth.response;
  if (!isVaultConfigured()) return NextResponse.json({ ok: false, error: 'ACCOUNT_VAULT_KEY is not configured on this deployment.' }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const result = await createAccount(body as never, null);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 422 });

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
