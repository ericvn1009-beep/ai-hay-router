import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { TenancyStore } from "../db/tenancy-types.js";
import type { User } from "../db/types.js";
import { openaiError } from "../lib/errors.js";
import { sessionCookieName, verifySession } from "../lib/session.js";

declare module "hono" {
  interface ContextVariableMap {
    controlUser: User;
  }
}

export function createSessionAuthMiddleware(opts: {
  sessionSecret: string;
  tenancy: TenancyStore;
}) {
  return createMiddleware(async (c, next) => {
    const token =
      getCookie(c, sessionCookieName()) ??
      bearerToken(c.req.header("authorization"));
    if (!token) {
      throw openaiError(401, "Not authenticated", "unauthenticated");
    }
    // Reject data-plane API keys on control plane
    if (token.startsWith("sk-aihay-")) {
      throw openaiError(
        401,
        "API keys cannot access the control plane; use a session cookie or login",
        "unauthenticated",
      );
    }
    const payload = verifySession(token, opts.sessionSecret);
    if (!payload) {
      throw openaiError(401, "Invalid or expired session", "unauthenticated");
    }
    const user = await opts.tenancy.findUserById(payload.userId);
    if (!user) {
      throw openaiError(401, "User not found", "unauthenticated");
    }
    c.set("controlUser", user);
    await next();
  });
}

function bearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length).trim() || undefined;
}
