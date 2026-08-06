/**
 * BYOK envelope encryption (V2.5).
 * AES-256-GCM with a master key from env (or scrypt-derived from pepper in dev).
 * Secrets are only decrypted in-process for the duration of a request.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN = 32;

export type ByokProvider = "openai" | "anthropic" | "xai";

export const BYOK_PROVIDERS: ByokProvider[] = ["openai", "anthropic", "xai"];

export function isByokProvider(p: string): p is ByokProvider {
  return (BYOK_PROVIDERS as string[]).includes(p);
}

/** Map models.yaml credential_ref → BYOK provider id */
export function providerFromCredentialRef(ref: string): ByokProvider | null {
  if (ref === "OPENAI_API_KEY") return "openai";
  if (ref === "ANTHROPIC_API_KEY") return "anthropic";
  if (ref === "XAI_API_KEY") return "xai";
  return null;
}

export interface EncryptedBlob {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * Resolve a 32-byte AES key.
 * Prefers BYOK_MASTER_KEY (base64 or 64-char hex). Falls back to scrypt(pepper).
 */
export function resolveMasterKey(opts: {
  masterKey?: string;
  pepper: string;
}): Buffer {
  const raw = (opts.masterKey ?? "").trim();
  if (raw) {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, "hex");
    }
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === KEY_LEN) return b64;
    // Accept any non-empty string: stretch with SHA-256
    return createHash("sha256").update(raw).digest();
  }
  // Dev fallback — not for production multi-tenant
  return scryptSync(opts.pepper, "aihay-byok-v1", KEY_LEN);
}

export function encryptSecret(plaintext: string, masterKey: Buffer): EncryptedBlob {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, masterKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

export function decryptSecret(blob: EncryptedBlob, masterKey: Buffer): string {
  const decipher = createDecipheriv(ALGO, masterKey, blob.iv);
  decipher.setAuthTag(blob.authTag);
  const plain = Buffer.concat([
    decipher.update(blob.ciphertext),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

/** Last 4 printable chars for UI hint (never full secret). */
export function secretHint(secret: string): string {
  const s = secret.trim();
  if (s.length <= 4) return "****";
  return `…${s.slice(-4)}`;
}

/** Constant-time-ish equality for optional token checks. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
