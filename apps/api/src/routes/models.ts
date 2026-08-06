import { Hono } from "hono";
import type { AppConfig } from "../config.js";
import { DEFAULT_ALIASES } from "../registry/aliases.js";
import { listModels } from "../registry/resolve.js";
import type { ModelRecord } from "../registry/types.js";

export function modelsRoutes(
  registry: Map<string, ModelRecord>,
  config?: AppConfig,
) {
  const r = new Hono();

  r.get("/v1/models", (c) => {
    const models = listModels(registry, {
      aliasesEnabled: config?.FEATURE_ALIASES ?? false,
      aliases: DEFAULT_ALIASES,
    });
    const data = models.map((m) => {
      if ("virtual" in m && m.virtual) {
        return {
          id: m.id,
          object: "model" as const,
          created: 0,
          owned_by: "aihay",
          // non-standard hint for clients that care
          root: m.resolves_to,
        };
      }
      return {
        id: m.id,
        object: "model" as const,
        created: 0,
        owned_by: m.provider,
      };
    });
    return c.json({ object: "list", data });
  });

  return r;
}
