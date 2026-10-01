import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// The account pool's vault: every Claude token, EXPO_TOKEN, Supabase access
// token and the App Store Connect key live in provider_accounts encrypted with
// this. Same construction as server/integrations/crypto.ts (AES-256-GCM, key
// derived from a passphrase with scrypt), deliberately a DIFFERENT env var and
// salt: the pool holds credentials that can spend money and publish apps, and
// rotating it must not force re-entering every App Store Connect config — nor
// the other way round.
function key() {
  const passphrase = process.env.ACCOUNT_VAULT_KEY;

  if (!passphrase || passphrase.length < 32) {
    throw new Error('ACCOUNT_VAULT_KEY must be set to a random string of at least 32 characters.');
  }

  return scryptSync(passphrase, 'idion-provider-accounts', 32);
}

export function isVaultConfigured(): boolean {
  return Boolean(process.env.ACCOUNT_VAULT_KEY && process.env.ACCOUNT_VAULT_KEY.length >= 32);
}

export function sealSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((part) => part.toString('base64')).join(':');
}

export function openSecret(ciphertext: string): string {
  const [ivB64, authTagB64, dataB64] = ciphertext.split(':');

  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Malformed ciphertext.');
  }

  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));

  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

/** "…a1b2" — enough to tell two tokens apart in a table, never enough to use one. */
export function secretHint(plaintext: string): string {
  const trimmed = plaintext.trim();
  return trimmed.length <= 8 ? '…' : `…${trimmed.slice(-4)}`;
}
