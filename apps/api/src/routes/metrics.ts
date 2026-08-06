import { Hono } from "hono";
import type { Metrics } from "../observability/metrics.js";
import { renderMetrics } from "../observability/metrics.js";

export function metricsRoutes(metrics: Metrics | null) {
  const r = new Hono();

  r.get("/metrics", async (c) => {
    if (!metrics) {
      return c.text("# metrics disabled\n", 404);
    }
    const body = await renderMetrics(metrics);
    return c.text(body, 200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    });
  });

  return r;
}
