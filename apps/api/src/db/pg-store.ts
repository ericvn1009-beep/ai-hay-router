import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { generateApiKeySecret, hashApiKey } from "../lib/hash.js";
import type {
  ApiKeyRecord,
  CreateKeyInput,
  CreateKeyResult,
  KeyStore,
  UsageEventInput,
  UsageStore,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createPgPool(databaseUrl: string): Promise<pg.Pool> {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  return pool;
}

export async function migrate(pool: pg.Pool): Promise<void> {
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
}

function mapKey(row: pg.QueryResultRow): ApiKeyRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    keyHash: row.key_hash,
    rateLimitRpm: row.rate_limit_rpm,
    dailyTokenLimit: row.daily_token_limit != null ? Number(row.daily_token_limit) : null,
    dailyCostUsdLimit:
      row.daily_cost_usd_limit != null ? Number(row.daily_cost_usd_limit) : null,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

export function createPgStores(pool: pg.Pool, pepper: string): {
  keys: KeyStore;
  usage: UsageStore;
} {
  const keys: KeyStore = {
    async ensureDefaultWorkspace() {
      const existing = await pool.query(
        `SELECT id FROM workspaces WHERE name = $1 LIMIT 1`,
        ["default"],
      );
      if (existing.rows[0]) return existing.rows[0].id as string;
      const id = randomUUID();
      await pool.query(`INSERT INTO workspaces (id, name) VALUES ($1, $2)`, [
        id,
        "default",
      ]);
      return id;
    },

    async createKey(input: CreateKeyInput): Promise<CreateKeyResult> {
      const workspaceId = await this.ensureDefaultWorkspace();
      const { secret, prefix } = generateApiKeySecret();
      const id = randomUUID();
      const keyHash = hashApiKey(secret, pepper);
      const res = await pool.query(
        `INSERT INTO api_keys (
          id, workspace_id, name, key_prefix, key_hash,
          rate_limit_rpm, daily_token_limit, daily_cost_usd_limit
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`,
        [
          id,
          workspaceId,
          input.name,
          prefix,
          keyHash,
          input.rateLimitRpm ?? null,
          input.dailyTokenLimit ?? null,
          input.dailyCostUsdLimit ?? null,
        ],
      );
      return { record: mapKey(res.rows[0]), secret };
    },

    async listKeys() {
      const res = await pool.query(
        `SELECT * FROM api_keys ORDER BY created_at DESC`,
      );
      return res.rows.map(mapKey);
    },

    async revokeByPrefix(prefix: string) {
      const res = await pool.query(
        `UPDATE api_keys SET revoked_at = now()
         WHERE revoked_at IS NULL AND (key_prefix LIKE $1 OR $2 LIKE key_prefix || '%')`,
        [`${prefix}%`, prefix],
      );
      return (res.rowCount ?? 0) > 0;
    },

    async findByHash(keyHash: string) {
      const res = await pool.query(
        `SELECT * FROM api_keys WHERE key_hash = $1 LIMIT 1`,
        [keyHash],
      );
      if (!res.rows[0]) return null;
      return mapKey(res.rows[0]);
    },
  };

  const usage: UsageStore = {
    async insert(event: UsageEventInput) {
      await pool.query(
        `INSERT INTO usage_events (
          id, request_id, api_key_id, workspace_id,
          model_requested, model_used, provider, endpoint_id,
          prompt_tokens, completion_tokens, cost_usd_estimate, usage_estimated,
          latency_ms, ttft_ms, status, error_code, attempt_count
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
        )`,
        [
          randomUUID(),
          event.requestId,
          event.apiKeyId,
          event.workspaceId,
          event.modelRequested,
          event.modelUsed,
          event.provider,
          event.endpointId,
          event.promptTokens,
          event.completionTokens,
          event.costUsdEstimate,
          event.usageEstimated,
          event.latencyMs,
          event.ttftMs,
          event.status,
          event.errorCode,
          event.attemptCount,
        ],
      );
    },
  };

  return { keys, usage };
}
