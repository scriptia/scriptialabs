'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/server/auth/guard';
import { clearAccountLimit, createAccount, deleteAccount, rotateSecret, setAccountStatus } from '@/server/accounts/service';
import { isVaultConfigured } from '@/server/vault/crypto';

export type AccountActionState = { ok?: boolean; error?: string; id?: string };

const VAULT_MISSING = 'ACCOUNT_VAULT_KEY is not set on this deployment, so secrets cannot be stored. Add it in Vercel (a random string, 32+ characters).';

function done(result: { ok: true; id: string } | { ok: false; error: string }): AccountActionState {
  if (!result.ok) return { error: result.error };
  revalidatePath('/internal/accounts');
  revalidatePath('/internal/runs');
  return { ok: true, id: result.id };
}

export async function addAccount(_state: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const user = await requireAdmin();
  if (!isVaultConfigured()) return { error: VAULT_MISSING };

  return done(
    await createAccount(
      {
        provider: String(formData.get('provider') ?? '') as never,
        label: String(formData.get('label') ?? ''),
        identity: String(formData.get('identity') ?? ''),
        secret: String(formData.get('secret') ?? ''),
        plan: String(formData.get('plan') ?? ''),
        maxConcurrency: formData.get('maxConcurrency') ? Number(formData.get('maxConcurrency')) : undefined,
        notes: String(formData.get('notes') ?? '')
      },
      user.id
    )
  );
}

export async function rotateAccountSecret(_state: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const user = await requireAdmin();
  if (!isVaultConfigured()) return { error: VAULT_MISSING };
  return done(await rotateSecret(String(formData.get('id') ?? ''), String(formData.get('secret') ?? ''), user.id));
}

export async function toggleAccount(formData: FormData): Promise<AccountActionState> {
  const user = await requireAdmin();
  const status = formData.get('status') === 'disabled' ? 'disabled' : 'active';
  return done(await setAccountStatus(String(formData.get('id') ?? ''), status, user.id));
}

export async function clearLimit(formData: FormData): Promise<AccountActionState> {
  const user = await requireAdmin();
  return done(await clearAccountLimit(String(formData.get('id') ?? ''), user.id));
}

export async function removeAccount(formData: FormData): Promise<AccountActionState> {
  const user = await requireAdmin();
  return done(await deleteAccount(String(formData.get('id') ?? ''), user.id));
}
