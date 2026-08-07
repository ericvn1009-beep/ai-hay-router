import { Hono } from "hono";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { BudgetStore } from "../db/budget-types.js";
import type { ProviderSecretStore } from "../db/secret-types.js";
import type { KeyStore, UsageStore } from "../db/types.js";
import type { TenancyStore } from "../db/tenancy-types.js";
import type { WalletStore } from "../db/wallet-types.js";
import { openaiError } from "../lib/errors.js";
import type { Logger } from "../lib/logger.js";
import { createSessionAuthMiddleware } from "../middleware/session-auth.js";

export function adminRoutes(opts: {
  config: AppConfig;
  keys: KeyStore;
  usage: UsageStore;
  tenancy: TenancyStore;
  budgets: BudgetStore;
  secrets: ProviderSecretStore;
  wallets: WalletStore;
  logger: Logger;
  sessionSecret: string;
  readyCheckDb?: () => Promise<boolean>;
}) {
  const r = new Hono();

  r.get("/admin/v1", (c) =>
    c.json({
      name: "AI Hay Platform Admin",
      version: "v1",
      enabled: opts.config.FEATURE_PLATFORM_ADMIN,
      endpoints: [
        "GET /admin/v1/me",
        "GET /admin/v1/workspaces",
        "GET /admin/v1/users",
        "GET /admin/v1/organizations",
        "POST /admin/v1/workspaces/:id/suspend",
        "POST /admin/v1/workspaces/:id/unsuspend",
        "POST /admin/v1/workspaces/:id/keys/:keyId/revoke",
        "GET /admin/v1/usage",
        "GET /admin/v1/audit",
        "GET /admin/v1/health",
      ],
    }),
  );

  if (!opts.config.FEATURE_PLATFORM_ADMIN) {
    return r;
  }

  const secured = new Hono();
  secured.use(
    "*",
    createSessionAuthMiddleware({
      tenancy: opts.tenancy,
      sessionSecret: opts.sessionSecret,
    }),
  );

  secured.use("*", async (c, next) => {
    const user = c.get("controlUser");
    const full = await opts.tenancy.findUserById(user.id);
    if (!full?.platformAdmin) {
      throw openaiError(403, "Platform admin required", "forbidden");
    }
    await next();
  });

  secured.get("/me", async (c) => {
    const user = c.get("controlUser");
    const full = await opts.tenancy.findUserById(user.id);
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: full?.name ?? null,
        platform_admin: true,
      },
    });
  });

  secured.get("/health", async (c) => {
    let dbOk = true;
    try {
      if (opts.readyCheckDb) dbOk = await opts.readyCheckDb();
    } catch {
      dbOk = false;
    }
    return c.json({
      api: "ok",
      database: dbOk ? "ok" : "error",
      grafana_url: opts.config.GRAFANA_URL || null,
      public_api_base_url: opts.config.PUBLIC_API_BASE_URL || null,
    });
  });

  secured.get("/workspaces", async (c) => {
    const orgs = await opts.tenancy.listOrganizations(200);
    const all = await opts.keys.listWorkspaces();
    return c.json({
      data: all.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        organization_id: w.organizationId,
        suspended_at: w.suspendedAt ?? null,
        created_at: w.createdAt,
      })),
      organizations: orgs,
    });
  });

  secured.get("/users", async (c) => {
    const users = await opts.tenancy.listUsers(200);
    return c.json({
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        platform_admin: u.platformAdmin,
        created_at: u.createdAt,
      })),
    });
  });

  secured.get("/organizations", async (c) => {
    const orgs = await opts.tenancy.listOrganizations(200);
    return c.json({ data: orgs });
  });

  secured.post("/workspaces/:id/suspend", async (c) => {
    const user = c.get("controlUser");
    const id = c.req.param("id");
    const ws = await opts.tenancy.setWorkspaceSuspended(id, true);
    if (!ws) throw openaiError(404, "Workspace not found", "not_found");
    await opts.tenancy.insertAudit({
      workspaceId: id,
      organizationId: ws.organizationId,
      actorUserId: user.id,
      action: "admin.workspace_suspended",
      resourceType: "workspace",
      resourceId: id,
    });
    return c.json({ ok: true, suspended_at: ws.suspendedAt });
  });

  secured.post("/workspaces/:id/unsuspend", async (c) => {
    const user = c.get("controlUser");
    const id = c.req.param("id");
    const ws = await opts.tenancy.setWorkspaceSuspended(id, false);
    if (!ws) throw openaiError(404, "Workspace not found", "not_found");
    await opts.tenancy.insertAudit({
      workspaceId: id,
      organizationId: ws.organizationId,
      actorUserId: user.id,
      action: "admin.workspace_unsuspended",
      resourceType: "workspace",
      resourceId: id,
    });
    return c.json({ ok: true, suspended_at: null });
  });

  secured.post("/workspaces/:id/keys/:keyId/revoke", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    const keyId = c.req.param("keyId");
    const keys = await opts.keys.listKeys({ workspaceId });
    const key = keys.find((k) => k.id === keyId);
    if (!key) throw openaiError(404, "Key not found", "not_found");
    await opts.keys.revokeByPrefix(key.keyPrefix, { workspaceId });
    await opts.tenancy.insertAudit({
      workspaceId,
      actorUserId: user.id,
      action: "admin.key_force_revoked",
      resourceType: "api_key",
      resourceId: keyId,
      meta: { prefix: key.keyPrefix },
    });
    return c.json({ ok: true });
  });

  secured.get("/workspaces/:id/keys", async (c) => {
    const workspaceId = c.req.param("id");
    const keys = await opts.keys.listKeys({ workspaceId });
    return c.json({
      data: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.keyPrefix,
        revoked: Boolean(k.revokedAt),
        created_at: k.createdAt,
      })),
    });
  });

  secured.get("/usage", async (c) => {
    const workspaces = await opts.keys.listWorkspaces();
    const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
    const rows = [];
    for (const w of workspaces.slice(0, 50)) {
      const part = await opts.usage.listByWorkspace(w.id, Math.ceil(limit / 5));
      for (const e of part) {
        rows.push({
          workspace_id: e.workspaceId,
          request_id: e.requestId,
          model_used: e.modelUsed,
          provider: e.provider,
          prompt_tokens: e.promptTokens,
          completion_tokens: e.completionTokens,
          cost_usd_estimate: e.costUsdEstimate,
          status: e.status,
          token_breakdown: e.tokenBreakdown ?? null,
        });
      }
    }
    rows.sort(() => 0);
    return c.json({ data: rows.slice(0, limit) });
  });

  secured.get("/audit", async (c) => {
    const events = await opts.tenancy.listAudit({ global: true, limit: 100 });
    return c.json({ data: events });
  });

  secured.get("/workspaces/:id/wallet", async (c) => {
    const id = c.req.param("id");
    if (!opts.config.FEATURE_CREDITS) {
      return c.json({ enabled: false, balance_usd: null });
    }
    const bal = await opts.wallets.getBalance(id);
    return c.json({ enabled: true, balance_usd: bal.balanceUsd, updated_at: bal.updatedAt });
  });

  secured.post("/workspaces/:id/wallet/credit", async (c) => {
    const user = c.get("controlUser");
    const id = c.req.param("id");
    if (!opts.config.FEATURE_CREDITS) {
      throw openaiError(400, "Credits disabled", "feature_disabled");
    }
    const body = z
      .object({
        amount_usd: z.number().positive(),
        idempotency_key: z.string().min(1),
        reason: z.string().optional(),
      })
      .parse(await c.req.json());
    const result = await opts.wallets.credit(id, body.amount_usd, {
      idempotencyKey: body.idempotency_key,
      reason: body.reason ?? "admin_credit",
    });
    await opts.tenancy.insertAudit({
      workspaceId: id,
      actorUserId: user.id,
      action: "admin.wallet_credited",
      resourceType: "wallet",
      resourceId: id,
      meta: { amount_usd: body.amount_usd, replayed: result.replayed },
    });
    return c.json({
      balance_usd: result.entry.balanceAfter,
      replayed: result.replayed,
    });
  });

  r.route("/admin/v1", secured);
  return r;
}
