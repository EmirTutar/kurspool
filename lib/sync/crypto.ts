import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function loadKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("SYNC_TOKEN_KEY must decode to 32 bytes");
  return key;
}

/** Encrypts with AES-256-GCM. Output: iv.authTag.ciphertext, each base64. */
export function encryptToken(token: string, base64Key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", loadKey(base64Key), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64")).join(".");
}

export function decryptToken(encrypted: string, base64Key: string): string {
  const [iv, tag, data] = encrypted.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", loadKey(base64Key), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
