'use server';

import { eq } from 'drizzle-orm';

import { recordAudit } from '@/server/audit';
import { requireUser } from '@/server/auth/guard';
import { db } from '@/server/db/client';
import { appDeployments } from '@/server/db/schema';
import { openSecret } from '@/server/vault/crypto';

export type RevealState = { error?: string; secret?: string };

/**
 * The app's RevenueCat webhook secret, for an admin who runs the backend
 * themselves (deferred target): it goes into their Supabase as
 * REVENUECAT_WEBHOOK_SECRET, then Publish verifies the chain and turns billing
 * on. Every reveal is audited.
 */
export async function revealWebhookSecret(_state: RevealState, formData: FormData): Promise<RevealState> {
  const user = await requireUser();
  if (user.role !== 'admin') return { error: 'Only admins can reveal secrets.' };

  const betId = String(formData.get('betId') ?? '');
  if (!betId) return { error: 'Missing bet reference.' };

  const [row] = await db
    .select({ sealed: appDeployments.revenuecatWebhookSecretEncrypted })
    .from(appDeployments)
    .where(eq(appDeployments.betId, betId))
    .limit(1);
  if (!row?.sealed) return { error: 'No webhook secret yet: the monetization stage creates it once the backend URL is known.' };

  let secret: string;
  try {
    secret = openSecret(row.sealed);
  } catch {
    return { error: 'The secret could not be decrypted (ACCOUNT_VAULT_KEY changed). Run Publish to rotate it.' };
  }
  await recordAudit({ actorId: user.id, entity: 'app_deployment', entityId: betId, action: 'update', diff: { revenuecatWebhookSecret: { from: 'sealed', to: 'revealed' } } });
  return { secret };
}
