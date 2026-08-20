import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.AI_SETTINGS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "AI_SETTINGS_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to .env.local / your host's env vars."
    );
  }
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) {
    throw new Error(
      `AI_SETTINGS_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Generate one with \`openssl rand -base64 32\`.`
    );
  }
  return key;
}

/**
 * Encrypts an API key for storage. The ciphertext and auth tag are
 * combined into one base64 string; the IV is returned separately
 * (stored in its own column) since it must be unique per encryption,
 * not secret.
 */
export function encryptApiKey(plaintext: string): { ciphertext: string; iv: string } {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([encrypted, authTag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptApiKey(ciphertext: string, iv: string): string {
  const key = getKey();
  const combined = Buffer.from(ciphertext, "base64");
  const authTag = combined.subarray(combined.length - 16);
  const encrypted = combined.subarray(0, combined.length - 16);

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function last4(apiKey: string): string {
  return apiKey.slice(-4);
}
