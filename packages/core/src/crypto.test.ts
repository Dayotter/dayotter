import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  decrypt,
  decryptJson,
  encrypt,
  encryptJson,
  hashAccessCode,
  sha256hex,
  verifyAccessCode,
} from "./crypto";

const key = randomBytes(32);

describe("access codes (scrypt KDF)", () => {
  it("verifies the right code and rejects a wrong one", () => {
    const stored = hashAccessCode("open-sesame");
    expect(verifyAccessCode("open-sesame", stored)).toBe(true);
    expect(verifyAccessCode("wrong", stored)).toBe(false);
  });

  it("is salted: the same code hashes differently each time", () => {
    expect(hashAccessCode("1234")).not.toBe(hashAccessCode("1234"));
    expect(hashAccessCode("1234").startsWith("scrypt$")).toBe(true);
  });

  it("still verifies a legacy unsalted SHA-256 hash (upgrade-on-next-set)", () => {
    const legacy = sha256hex("legacy-code");
    expect(verifyAccessCode("legacy-code", legacy)).toBe(true);
    expect(verifyAccessCode("nope", legacy)).toBe(false);
  });

  it("rejects a malformed scrypt value", () => {
    expect(verifyAccessCode("x", "scrypt$")).toBe(false);
    expect(verifyAccessCode("x", "scrypt$deadbeef")).toBe(false);
  });
});

describe("crypto", () => {
  it("round-trips a string", () => {
    const secret = "refresh-token-abc123";
    expect(decrypt(encrypt(secret, key), key)).toBe(secret);
  });

  it("round-trips JSON credentials", () => {
    const creds = { accessToken: "a", refreshToken: "b", expiresAt: 1234567890 };
    expect(decryptJson(encryptJson(creds, key), key)).toEqual(creds);
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encrypt("same", key)).not.toBe(encrypt("same", key));
  });

  it("fails to decrypt with the wrong key", () => {
    const wrong = randomBytes(32);
    expect(() => decrypt(encrypt("x", key), wrong)).toThrow();
  });

  it("throws on tampered ciphertext (auth tag)", () => {
    const ct = encrypt("x", key);
    const tampered = `${ct.slice(0, -4)}AAAA`;
    expect(() => decrypt(tampered, key)).toThrow();
  });
});

describe("getKey (via ENCRYPTION_KEY env)", () => {
  const saved = process.env.ENCRYPTION_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = saved;
  });

  it("throws when ENCRYPTION_KEY is unset", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/not set/i);
  });

  it("throws when the key isn't 32 bytes", () => {
    process.env.ENCRYPTION_KEY = "abcd"; // 2 bytes
    expect(() => encrypt("x")).toThrow(/32 bytes/i);
  });

  it("rejects the insecure all-zero placeholder key", () => {
    process.env.ENCRYPTION_KEY = "0".repeat(64);
    expect(() => encrypt("x")).toThrow(/placeholder/i);
  });

  it("accepts a real 64-hex key", () => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
    expect(() => encrypt("x")).not.toThrow();
  });
});
