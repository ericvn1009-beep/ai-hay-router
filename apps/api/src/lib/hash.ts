import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_PREFIX = "sk-aihay-";

/** Generate a new API key secret (shown once). */
export function generateApiKeySecret(): { secret: string; prefix: string } {
  const raw = randomBytes(24).toString("base64url");
  const secret = `${KEY_PREFIX}${raw}`;
  const prefix = secret.slice(0, 16);
  return { secret, prefix };
}

/** HMAC-SHA256 of the full secret with server pepper. */
export function hashApiKey(secret: string, pepper: string): string {
  return createHmac("sha256", pepper).update(secret).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function looksLikeAihayKey(token: string): boolean {
  return token.startsWith(KEY_PREFIX) && token.length > KEY_PREFIX.length + 8;
}
