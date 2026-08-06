import { Hono } from "hono";

export function healthRoutes(opts?: { ready?: () => Promise<boolean> }) {
  const r = new Hono();

  r.get("/health", (c) => c.json({ status: "ok" }));

  r.get("/ready", async (c) => {
    if (!opts?.ready) {
      return c.json({ status: "ready" });
    }
    try {
      const ok = await opts.ready();
      if (!ok) return c.json({ status: "not_ready" }, 503);
      return c.json({ status: "ready" });
    } catch {
      return c.json({ status: "not_ready" }, 503);
    }
  });

  return r;
}
