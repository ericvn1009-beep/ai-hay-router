import { Hono } from "hono";

export function healthRoutes() {
  const r = new Hono();

  r.get("/health", (c) => c.json({ status: "ok" }));

  r.get("/ready", (c) => {
    // Phase 1a: no DB yet; always ready if process is up
    return c.json({ status: "ready" });
  });

  return r;
}
