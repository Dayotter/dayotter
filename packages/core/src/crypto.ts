import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Constant-time string comparison that never throws on length mismatch. Use for
 * comparing secrets (webhook tokens, HMAC signatures) to avoid timing leaks.
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** SHA-256 hex digest — used to store API keys as irreversible lookup hashes. */
export function sha256hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** HMAC-SHA-256 hex digest — used to sign outbound webhook payloads. */
export function hmacSha256hex(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Cryptographically-random URL-safe token (default 32 bytes → 43 chars). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Authenticated symmetric encryption for OAuth tokens at rest (AES-256-GCM).
 * The key is a 32-byte value, hex-encoded, from the ENCRYPTION_KEY env var.
 * Ciphertext format: base64( iv(12) | authTag(16) | ciphertext ).
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("ENCRYPTION_KEY is not set");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  }
  // Reject the all-zero placeholder shipped in .env.example: an operator who
  // forgot to rotate it would otherwise encrypt every token with a public key.
  if (key.every((b) => b === 0)) {
    throw new Error("ENCRYPTION_KEY is the insecure all-zero placeholder; generate a real key");
  }
  return key;
}

export function encrypt(plaintext: string, key: Buffer = getKey()): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decrypt(payload: string, key: Buffer = getKey()): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Encrypt/decrypt a JSON-serializable value (e.g. an OAuth credential set). */
export function encryptJson(value: unknown, key?: Buffer): string {
  return encrypt(JSON.stringify(value), key);
}

export function decryptJson<T>(payload: string, key?: Buffer): T {
  return JSON.parse(decrypt(payload, key)) as T;
}
