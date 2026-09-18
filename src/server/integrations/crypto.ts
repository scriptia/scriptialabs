import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// AES-256-GCM, keyed from a passphrase env var via scrypt rather than
// requiring an exact 32-byte key on disk — one fewer way to misconfigure the
// only secret protecting App Store Connect private keys at rest.
function key() {
  const passphrase = process.env.APP_STORE_CONNECT_ENCRYPTION_KEY;

  if (!passphrase || passphrase.length < 16) {
    throw new Error('APP_STORE_CONNECT_ENCRYPTION_KEY must be set to a random string of at least 16 characters.');
  }

  return scryptSync(passphrase, 'app-store-connect-configs', 32);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((part) => part.toString('base64')).join(':');
}

export function decryptSecret(ciphertext: string): string {
  const [ivB64, authTagB64, dataB64] = ciphertext.split(':');

  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Malformed ciphertext.');
  }

  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));

  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
