import { randomUUID } from "node:crypto";
import pg from "pg";
import { generateApiKeySecret, hashApiKey } from "../lib/hash.js";
import { runMigrations } from "./migrate.js";
import type {
  ApiKeyRecord,
  CreateKeyInput,
  CreateKeyResult,
  KeyStore,
  UsageEventInput,
  UsageStore,
  Workspace,
} from "./types.js";

export async function createPgPool(databaseUrl: string): Promise<pg.Pool> {
  return new pg.Pool({ connectionString: databaseUrl });
}

export async function migrate(pool: pg.Pool): Promise<string[]> {
  return runMigrations(pool);
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
    createdByUserId: row.created_by_user_id ?? null,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

function mapWorkspace(row: pg.QueryResultRow): Workspace {
  return {
    id: row.id,
    organizationId: row.organization_id ?? null,
    name: row.name,
    slug: row.slug ?? null,
    createdAt: row.created_at,
    suspendedAt: row.suspended_at ?? null,
  };
}

export function createPgStores(pool: pg.Pool, pepper: string): {
  keys: KeyStore;
  usage: UsageStore;
} {
  const keys: KeyStore = {
    async ensureTenancyBootstrap() {
      const existing = await pool.query(
        `SELECT w.id AS workspace_id, w.organization_id
         FROM workspaces w
         WHERE w.name = 'default' OR w.slug = 'default'
         ORDER BY w.created_at ASC
         LIMIT 1`,
      );
      if (existing.rows[0]?.workspace_id && existing.rows[0]?.organization_id) {
        return {
          organizationId: existing.rows[0].organization_id as string,
          workspaceId: existing.rows[0].workspace_id as string,
        };
      }

      if (existing.rows[0]?.workspace_id && !existing.rows[0]?.organization_id) {
        const orgId = randomUUID();
        const slug = `org-${orgId.replace(/-/g, "").slice(0, 12)}`;
        await pool.query(
          `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)`,
          [orgId, "default org", slug],
        );
        await pool.query(
          `UPDATE workspaces SET organization_id = $1, slug = coalesce(slug, 'default') WHERE id = $2`,
          [orgId, existing.rows[0].workspace_id],
        );
        return {
          organizationId: orgId,
          workspaceId: existing.rows[0].workspace_id as string,
        };
      }

      const organizationId = randomUUID();
      const workspaceId = randomUUID();
      const orgSlug = `org-${organizationId.replace(/-/g, "").slice(0, 12)}`;
      await pool.query(
        `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)`,
        [organizationId, "default org", orgSlug],
      );
      await pool.query(
        `INSERT INTO workspaces (id, name, organization_id, slug) VALUES ($1, $2, $3, $4)`,
        [workspaceId, "default", organizationId, "default"],
      );
      return { organizationId, workspaceId };
    },

    async ensureDefaultWorkspace() {
      const { workspaceId } = await this.ensureTenancyBootstrap();
      return workspaceId;
    },

    async createWorkspace(opts) {
      const boot = await this.ensureTenancyBootstrap();
      const organizationId = opts.organizationId ?? boot.organizationId;
      const id = randomUUID();
      const slug = opts.slug ?? `ws-${id.replace(/-/g, "").slice(0, 12)}`;
      const res = await pool.query(
        `INSERT INTO workspaces (id, name, organization_id, slug)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, opts.name, organizationId, slug],
      );
      return mapWorkspace(res.rows[0]);
    },

    async listWorkspaces(organizationId?: string) {
      if (organizationId) {
        const res = await pool.query(
          `SELECT * FROM workspaces WHERE organization_id = $1 ORDER BY created_at ASC`,
          [organizationId],
        );
        return res.rows.map(mapWorkspace);
      }
      const res = await pool.query(`SELECT * FROM workspaces ORDER BY created_at ASC`);
      return res.rows.map(mapWorkspace);
    },

    async getWorkspace(workspaceId: string) {
      const res = await pool.query(`SELECT * FROM workspaces WHERE id = $1`, [workspaceId]);
      if (!res.rows[0]) return null;
      return mapWorkspace(res.rows[0]);
    },

    async setWorkspaceSuspended(workspaceId: string, suspended: boolean) {
      const res = await pool.query(
        `UPDATE workspaces SET suspended_at = $2 WHERE id = $1 RETURNING *`,
        [workspaceId, suspended ? new Date() : null],
      );
      if (!res.rows[0]) return null;
      return mapWorkspace(res.rows[0]);
    },

    async createKey(input: CreateKeyInput): Promise<CreateKeyResult> {
      const workspaceId = input.workspaceId ?? (await this.ensureDefaultWorkspace());
      const ws = await this.getWorkspace(workspaceId);
      if (!ws) throw new Error(`Unknown workspace: ${workspaceId}`);

      const { secret, prefix } = generateApiKeySecret();
      const id = randomUUID();
      const keyHash = hashApiKey(secret, pepper);
      const res = await pool.query(
        `INSERT INTO api_keys (
          id, workspace_id, name, key_prefix, key_hash,
          rate_limit_rpm, daily_token_limit, daily_cost_usd_limit, created_by_user_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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
          input.createdByUserId ?? null,
        ],
      );
      return { record: mapKey(res.rows[0]), secret };
    },

    async listKeys(opts) {
      if (opts?.workspaceId) {
        const res = await pool.query(
          `SELECT * FROM api_keys WHERE workspace_id = $1 ORDER BY created_at DESC`,
          [opts.workspaceId],
        );
        return res.rows.map(mapKey);
      }
      const res = await pool.query(`SELECT * FROM api_keys ORDER BY created_at DESC`);
      return res.rows.map(mapKey);
    },

    async revokeByPrefix(prefix: string, opts) {
      if (opts?.workspaceId) {
        const res = await pool.query(
          `UPDATE api_keys SET revoked_at = now()
           WHERE revoked_at IS NULL
             AND workspace_id = $3
             AND (key_prefix LIKE $1 OR $2 LIKE key_prefix || '%')`,
          [`${prefix}%`, prefix, opts.workspaceId],
        );
        return (res.rowCount ?? 0) > 0;
      }
      const res = await pool.query(
        `UPDATE api_keys SET revoked_at = now()
         WHERE revoked_at IS NULL AND (key_prefix LIKE $1 OR $2 LIKE key_prefix || '%')`,
        [`${prefix}%`, prefix],
      );
      return (res.rowCount ?? 0) > 0;
    },

    async findByHash(keyHash: string) {
      const res = await pool.query(`SELECT * FROM api_keys WHERE key_hash = $1 LIMIT 1`, [
        keyHash,
      ]);
      if (!res.rows[0]) return null;
      return mapKey(res.rows[0]);
    },
  };

  const usage: UsageStore = {
    async insert(event: UsageEventInput) {
      let organizationId = event.organizationId ?? null;
      if (!organizationId) {
        const ws = await pool.query(
          `SELECT organization_id FROM workspaces WHERE id = $1`,
          [event.workspaceId],
        );
        organizationId = (ws.rows[0]?.organization_id as string | undefined) ?? null;
      }
      await pool.query(
        `INSERT INTO usage_events (
          id, request_id, api_key_id, workspace_id, organization_id,
          model_requested, model_used, provider, endpoint_id,
          prompt_tokens, completion_tokens, cost_usd_estimate, usage_estimated,
          latency_ms, ttft_ms, status, error_code, attempt_count, credential_mode,
          token_breakdown
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
        )`,
        [
          randomUUID(),
          event.requestId,
          event.apiKeyId,
          event.workspaceId,
          organizationId,
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
          event.credentialMode ?? null,
          event.tokenBreakdown ? JSON.stringify(event.tokenBreakdown) : null,
        ],
      );
    },

    async listByWorkspace(workspaceId: string, limit = 100) {
      const res = await pool.query(
        `SELECT * FROM usage_events
         WHERE workspace_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [workspaceId, limit],
      );
      return res.rows.map(
        (row): UsageEventInput => ({
          requestId: row.request_id,
          apiKeyId: row.api_key_id,
          workspaceId: row.workspace_id,
          organizationId: row.organization_id,
          modelRequested: row.model_requested,
          modelUsed: row.model_used,
          provider: row.provider,
          endpointId: row.endpoint_id,
          promptTokens: row.prompt_tokens,
          completionTokens: row.completion_tokens,
          costUsdEstimate: Number(row.cost_usd_estimate),
          usageEstimated: row.usage_estimated,
          latencyMs: row.latency_ms,
          ttftMs: row.ttft_ms,
          status: row.status,
          errorCode: row.error_code,
          attemptCount: row.attempt_count,
          credentialMode: row.credential_mode ?? null,
          tokenBreakdown: row.token_breakdown ?? null,
        }),
      );
    },
  };

  return { keys, usage };
}
