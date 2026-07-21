import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const KEY_LENGTH = 64;

// scrypt from node:crypto rather than bcrypt/argon2: no native build step, no
// extra dependency, and it is a memory-hard KDF — appropriate for a handful of
// internal accounts. Format is `scrypt$<saltHex>$<hashHex>` so the algorithm is
// recorded alongside the hash and can be migrated later without ambiguity.
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);

  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, saltHex, hashHex] = stored.split('$');

  if (algorithm !== 'scrypt' || !saltHex || !hashHex) {
    return false;
  }

  const expected = Buffer.from(hashHex, 'hex');

  if (expected.length !== KEY_LENGTH) {
    return false;
  }

  const derived = await scrypt(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH);

  return timingSafeEqual(derived, expected);
}
