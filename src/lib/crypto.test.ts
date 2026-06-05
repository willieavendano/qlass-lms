import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "./crypto";

beforeAll(() => {
  // 32 bytes, base64
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("crypto", () => {
  it("round-trips a secret", () => {
    const plain = "sk-test-1234567890";
    const enc = encryptSecret(plain);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("produces different ciphertext each call (random IV)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("throws on tampered ciphertext", () => {
    const enc = encryptSecret("hello");
    const tampered = enc.slice(0, -2) + (enc.endsWith("a") ? "b" : "a");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
