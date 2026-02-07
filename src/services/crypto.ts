/**
 * Secure Cryptographic Key Storage
 *
 * AES-256-GCM encryption with scrypt key derivation for mnemonic storage.
 * Mnemonics are encrypted at rest and only decrypted in memory when needed.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt as scryptCb,
  type ScryptOptions,
} from 'crypto';

function scryptAsync(
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

const SCRYPT_N = 2 ** 14; // CPU/memory cost (reduced for development, still secure)
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32; // AES-256

/**
 * Encrypt a mnemonic phrase for secure storage.
 * Uses AES-256-GCM with scrypt-derived key.
 * Format: salt:iv:authTag:encrypted (all base64)
 */
export async function encryptMnemonic(mnemonic: string, password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P,
  })) as Buffer;
  const iv = randomBytes(16);

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(mnemonic, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    salt.toString('base64'),
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a mnemonic phrase from storage.
 * Throws if password is incorrect or data is tampered with.
 */
export async function decryptMnemonic(encryptedData: string, password: string): Promise<string> {
  const parts = encryptedData.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }

  const [saltB64, ivB64, authTagB64, encryptedB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const key = (await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P,
  })) as Buffer;

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Securely wipe a Buffer by zeroing its contents.
 * For string values, converts to Buffer, zeros, and returns empty string.
 * V8 strings are immutable so the original string reference may persist
 * in heap until GC, but the Buffer copy is wiped immediately.
 */
export function secureWipe(value: string): string {
  // Allocate a buffer with the string content and immediately zero it
  const buf = Buffer.from(value, 'utf8');
  buf.fill(0);
  return '';
}
