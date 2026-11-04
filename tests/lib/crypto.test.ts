import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/sync/crypto";

const key = randomBytes(32).toString("base64");

describe("token encryption", () => {
  it("round-trips without exposing the token", () => {
    const encrypted = encryptToken("refresh-token", key);
    expect(encrypted).not.toContain("refresh-token");
    expect(decryptToken(encrypted, key)).toBe("refresh-token");
  });

  it("produces different output each time", () => {
    expect(encryptToken("a", key)).not.toBe(encryptToken("a", key));
  });

  it("rejects tampering and the wrong key", () => {
    const encrypted = encryptToken("secret", key);
    const parts = encrypted.split(".");
    const data = Buffer.from(parts[2], "base64");
    data[0] ^= 1;
    parts[2] = data.toString("base64");
    expect(() => decryptToken(parts.join("."), key)).toThrow();
    expect(() => decryptToken(encrypted, randomBytes(32).toString("base64"))).toThrow();
  });

  it("rejects a key of the wrong length", () => {
    expect(() => encryptToken("a", Buffer.from("short").toString("base64"))).toThrow(/32 bytes/);
  });
});
