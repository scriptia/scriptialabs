import 'server-only';

import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { accountCredentialTypes, accountProviders, defaultCredentialType, type AccountCredentialType, type AccountProvider } from '@/content/internal';
import { recordAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { providerAccounts } from '@/server/db/schema';
import { sealSecret, secretHint } from '@/server/vault/crypto';

// Writes to the account pool, shared by the panel's Accounts page (server
// actions, admin session) and the orchestrator CLI (`accounts add`, runner
// token). One implementation so a token pasted in the browser and a token
// captured by `claude setup-token` land in the vault identically.

const labelSchema = z
  .string()
  .trim()
  .min(1, 'Give it a short label, e.g. max-3.')
  .max(60)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._@-]*$/, 'Letters, digits, dot, dash, underscore or @.');

export const createAccountSchema = z.object({
  provider: z.enum(accountProviders),
  label: labelSchema,
  identity: z.string().trim().max(200).optional().transform((value) => value || null),
  credentialType: z.enum(accountCredentialTypes).optional(),
  secret: z.string().trim().min(8, 'Paste the token.').max(20000),
  plan: z.string().trim().max(60).optional().transform((value) => value || null),
  maxConcurrency: z.coerce.number().int().min(1).max(100).optional(),
  notes: z.string().trim().max(1000).optional().transform((value) => value || null),
  // Known limits up front, e.g. an EAS plan's builds per month ({limit: 15}).
  quota: z.record(z.string().max(40), z.union([z.number(), z.string().max(100)])).optional()
});

export type CreateAccountInput = z.input<typeof createAccountSchema>;

// Apple is one bundle read by every release at once, not a pooled seat, so it
// must never be "full".
// RevenueCat is not leased at all (the token endpoint hands out access tokens).
const defaultConcurrency: Record<AccountProvider, number> = { claude: 1, eas: 1, supabase: 1, apple: 100, revenuecat: 100 };

/** RevenueCat takes two credential types; which one is plain from the secret itself. */
function credentialTypeFor(provider: AccountProvider, secret: string): AccountCredentialType {
  if (provider === 'revenuecat') return secret.trim().startsWith('{') ? 'oauth_client' : 'access_token';
  return defaultCredentialType[provider];
}

/** Checks the shape of a secret before it is sealed, so a typo fails at paste time, not at 3am. */
function validateSecret(provider: AccountProvider, secret: string): string | null {
  if (provider === 'claude' && !secret.startsWith('sk-ant-')) {
    return 'A Claude token from `claude setup-token` starts with "sk-ant-".';
  }
  if (provider === 'revenuecat') {
    if (secret.startsWith('{')) {
      try {
        const client = JSON.parse(secret) as Record<string, unknown>;
        if (typeof client.clientId !== 'string' || typeof client.refreshToken !== 'string') {
          return 'The RevenueCat OAuth client needs clientId and refreshToken (clientSecret if the client has one).';
        }
      } catch {
        return 'The RevenueCat OAuth client must be JSON: {"clientId","clientSecret","refreshToken"}.';
      }
    } else if (!secret.startsWith('sk_')) {
      return 'A RevenueCat project secret key starts with "sk_" (or paste the OAuth client JSON).';
    }
  }
  if (provider === 'apple') {
    try {
      const bundle = JSON.parse(secret) as Record<string, unknown>;
      if (!bundle.issuerId || !bundle.keyId || !bundle.privateKey) return 'The Apple bundle needs issuerId, keyId and privateKey (.p8 contents).';
    } catch {
      return 'The Apple bundle must be JSON: {"issuerId","keyId","privateKey","teamId",...}.';
    }
  }
  return null;
}

export type AccountWriteResult = { ok: true; id: string } | { ok: false; error: string };

export async function createAccount(input: CreateAccountInput, actorId: string | null): Promise<AccountWriteResult> {
  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Those values are not valid.' };

  const data = parsed.data;
  const secretProblem = validateSecret(data.provider, data.secret);
  if (secretProblem) return { ok: false, error: secretProblem };

  const [existing] = await db
    .select({ id: providerAccounts.id })
    .from(providerAccounts)
    .where(and(eq(providerAccounts.provider, data.provider), eq(providerAccounts.label, data.label)))
    .limit(1);
  if (existing) return { ok: false, error: `There is already a ${data.provider} account called "${data.label}". Rotate its token instead.` };

  const [created] = await db
    .insert(providerAccounts)
    .values({
      provider: data.provider,
      label: data.label,
      identity: data.identity,
      credentialType: data.credentialType ?? credentialTypeFor(data.provider, data.secret),
      secretEncrypted: sealSecret(data.secret),
      secretHint: secretHint(data.secret),
      plan: data.plan,
      maxConcurrency: data.maxConcurrency ?? defaultConcurrency[data.provider],
      quota: data.quota ?? {},
      notes: data.notes,
      createdById: actorId
    })
    .returning({ id: providerAccounts.id });

  await recordAudit({ actorId, entity: 'provider_account', entityId: created.id, action: 'create', diff: { provider: { from: null, to: data.provider }, label: { from: null, to: data.label } } });

  return { ok: true, id: created.id };
}

export async function rotateSecret(id: string, secret: string, actorId: string | null): Promise<AccountWriteResult> {
  const [account] = await db.select({ provider: providerAccounts.provider }).from(providerAccounts).where(eq(providerAccounts.id, id)).limit(1);
  if (!account) return { ok: false, error: 'That account no longer exists.' };

  const trimmed = secret.trim();
  if (trimmed.length < 8) return { ok: false, error: 'Paste the new token.' };
  const problem = validateSecret(account.provider, trimmed);
  if (problem) return { ok: false, error: problem };

  // A new token is a fresh start: a limit recorded against the old one says
  // nothing about the new one (a re-login, a different seat).
  await db
    .update(providerAccounts)
    .set({
      secretEncrypted: sealSecret(trimmed),
      secretHint: secretHint(trimmed),
      ...(account.provider === 'revenuecat' ? { credentialType: credentialTypeFor('revenuecat', trimmed) } : {}),
      limitedUntil: null,
      limitReason: null,
      updatedAt: new Date()
    })
    .where(eq(providerAccounts.id, id));

  await recordAudit({ actorId, entity: 'provider_account', entityId: id, action: 'update', diff: { secret: { from: 'sealed', to: 'rotated' } } });
  return { ok: true, id };
}

export async function setAccountStatus(id: string, status: 'active' | 'disabled', actorId: string | null): Promise<AccountWriteResult> {
  const rows = await db.update(providerAccounts).set({ status, updatedAt: new Date() }).where(eq(providerAccounts.id, id)).returning({ id: providerAccounts.id });
  if (!rows.length) return { ok: false, error: 'That account no longer exists.' };
  await recordAudit({ actorId, entity: 'provider_account', entityId: id, action: 'update', diff: { status: { from: null, to: status } } });
  return { ok: true, id };
}

/**
 * "It is back": a human who knows the window reset early (or who upgraded the
 * plan) clears the limit so the next claim can use it. Does not touch leases.
 */
export async function clearAccountLimit(id: string, actorId: string | null): Promise<AccountWriteResult> {
  const rows = await db
    .update(providerAccounts)
    .set({ limitedUntil: null, limitReason: null, updatedAt: new Date() })
    .where(eq(providerAccounts.id, id))
    .returning({ id: providerAccounts.id });
  if (!rows.length) return { ok: false, error: 'That account no longer exists.' };
  await recordAudit({ actorId, entity: 'provider_account', entityId: id, action: 'update', diff: { limitedUntil: { from: 'set', to: null } } });
  return { ok: true, id };
}

/**
 * Deletes an account that nothing is using. Conditional on `active_leases = 0`
 * in the DELETE itself, so it cannot race a claim that is taking it right now.
 * Past sessions keep their rows with account_id nulled.
 */
export async function deleteAccount(id: string, actorId: string | null): Promise<AccountWriteResult> {
  const rows = await db
    .delete(providerAccounts)
    .where(and(eq(providerAccounts.id, id), sql`${providerAccounts.activeLeases} = 0`))
    .returning({ id: providerAccounts.id, label: providerAccounts.label });

  if (!rows.length) return { ok: false, error: 'That account is in use by a running job (or already gone). Disable it first and delete it once it is free.' };

  await recordAudit({ actorId, entity: 'provider_account', entityId: id, action: 'delete', diff: { label: { from: rows[0].label, to: null } } });
  return { ok: true, id };
}
