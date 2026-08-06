import { createMiddleware } from "hono/factory";
import { openaiError } from "../lib/errors.js";

/** Phase 1a: accept fixed AIHAY_DEV_KEY. Replaced by hashed keys in Phase 1b. */
export function createAuthMiddleware(devKey: string) {
  return createMiddleware(async (c, next) => {
    const header = c.req.header("authorization") ?? c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      throw openaiError(401, "Missing or invalid Authorization header", "invalid_api_key");
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token || token !== devKey) {
      throw openaiError(401, "Invalid API key", "invalid_api_key");
    }
    await next();
  });
}
