import { Hono } from "hono";
import { listModels } from "../registry/resolve.js";
import type { ModelRecord } from "../registry/types.js";

export function modelsRoutes(registry: Map<string, ModelRecord>) {
  const r = new Hono();

  r.get("/v1/models", (c) => {
    const data = listModels(registry).map((m) => ({
      id: m.id,
      object: "model" as const,
      created: 0,
      owned_by: m.provider,
    }));
    return c.json({ object: "list", data });
  });

  return r;
}
