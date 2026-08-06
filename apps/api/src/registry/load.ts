import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ModelRecord, RegistryFile } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Default path: apps/api/models.yaml relative to this module (src/registry). */
export function defaultRegistryPath(): string {
  return join(__dirname, "../../models.yaml");
}

export function loadRegistryFromYaml(path = defaultRegistryPath()): Map<string, ModelRecord> {
  const text = readFileSync(path, "utf8");
  const models = parseSimpleYamlModels(text);
  const map = new Map<string, ModelRecord>();
  for (const m of models) {
    if (m.active !== false) {
      map.set(m.id, m);
    }
  }
  return map;
}

/**
 * Minimal YAML subset parser for our models.yaml (avoids extra dependency in Phase 0).
 * Expects the structure produced by our seed file.
 */
export function parseSimpleYamlModels(text: string): ModelRecord[] {
  // Prefer JSON if someone converts; else use a lightweight parse via eval-safe approach:
  // Convert YAML-ish seed to JSON using a tiny state machine for our fixed schema.
  const lines = text.split(/\r?\n/);
  const models: ModelRecord[] = [];
  let current: Partial<ModelRecord> | null = null;
  let inEndpoints = false;
  let currentEndpoint: Partial<ModelRecord["endpoints"][0]> | null = null;

  function flushEndpoint() {
    if (current && currentEndpoint?.id && currentEndpoint.base_url && currentEndpoint.credential_ref) {
      if (!current.endpoints) current.endpoints = [];
      current.endpoints.push({
        id: currentEndpoint.id,
        base_url: currentEndpoint.base_url,
        credential_ref: currentEndpoint.credential_ref,
        priority: currentEndpoint.priority ?? 1,
      });
    }
    currentEndpoint = null;
  }

  function flushModel() {
    flushEndpoint();
    if (current?.id && current.provider && current.upstream_id) {
      models.push({
        id: current.id,
        provider: current.provider,
        upstream_id: current.upstream_id,
        context_length: current.context_length ?? 128000,
        supports_tools: current.supports_tools ?? false,
        supports_streaming: current.supports_streaming ?? true,
        input_price_per_mtok: current.input_price_per_mtok ?? 0,
        output_price_per_mtok: current.output_price_per_mtok ?? 0,
        active: current.active ?? true,
        endpoints: current.endpoints ?? [],
        fallback_models: current.fallback_models ?? [],
      });
    }
    current = null;
    inEndpoints = false;
  }

  for (const raw of lines) {
    const line = raw.replace(/\t/g, "  ");
    if (!line.trim() || line.trim().startsWith("#")) continue;

    // Model entries are list items under `models:` with indent typically 2 spaces.
    // Endpoint entries are deeper (4+ spaces) under `endpoints:`.
    const listId = line.match(/^(\s*)-\s+id:\s*(.+)$/);
    if (listId) {
      const indent = listId[1].length;
      const idVal = unquote(listId[2]);
      if (inEndpoints && indent >= 4) {
        flushEndpoint();
        currentEndpoint = { id: idVal };
        continue;
      }
      // New model (shallow list item)
      flushModel();
      current = { id: idVal, endpoints: [], fallback_models: [] };
      inEndpoints = false;
      continue;
    }

    if (!current) continue;

    if (line.match(/^\s+endpoints:\s*$/)) {
      inEndpoints = true;
      continue;
    }

    if (line.match(/^\s+fallback_models:\s*\[\]\s*$/)) {
      current.fallback_models = [];
      inEndpoints = false;
      continue;
    }

    const kv = line.match(/^\s+([a-z_]+):\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = unquote(kv[2]);

    if (inEndpoints && currentEndpoint) {
      if (key === "base_url") currentEndpoint.base_url = val;
      else if (key === "credential_ref") currentEndpoint.credential_ref = val;
      else if (key === "priority") currentEndpoint.priority = Number(val);
      continue;
    }

    switch (key) {
      case "provider":
        current.provider = val;
        break;
      case "upstream_id":
        current.upstream_id = val;
        break;
      case "context_length":
        current.context_length = Number(val);
        break;
      case "supports_tools":
        current.supports_tools = val === "true";
        break;
      case "supports_streaming":
        current.supports_streaming = val === "true";
        break;
      case "input_price_per_mtok":
        current.input_price_per_mtok = Number(val);
        break;
      case "output_price_per_mtok":
        current.output_price_per_mtok = Number(val);
        break;
      case "active":
        current.active = val === "true";
        break;
      default:
        break;
    }
  }

  flushModel();
  return models;
}

function unquote(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/** For tests: load from structured object. */
export function registryFromFile(data: RegistryFile): Map<string, ModelRecord> {
  const map = new Map<string, ModelRecord>();
  for (const m of data.models) {
    if (m.active !== false) map.set(m.id, m);
  }
  return map;
}
