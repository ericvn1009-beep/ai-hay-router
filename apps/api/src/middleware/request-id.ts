import { createMiddleware } from "hono/factory";
import { randomUUID } from "node:crypto";

export const requestIdMiddleware = createMiddleware(async (c, next) => {
  const incoming = c.req.header("x-request-id");
  const requestId = incoming && incoming.trim() ? incoming.trim() : randomUUID();
  c.set("requestId", requestId);
  await next();
  c.header("x-request-id", requestId);
});

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}
