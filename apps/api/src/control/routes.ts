import { Hono } from "hono";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import { BYOK_PROVIDERS, isByokProvider } from "../crypto/byok.js";
import type { BudgetStore } from "../db/budget-types.js";
import type { ProviderSecretStore } from "../db/secret-types.js";
import type { KeyStore, MembershipRole, UsageStore } from "../db/types.js";
import type { TenancyStore } from "../db/tenancy-types.js";
import type { WalletStore } from "../db/wallet-types.js";
import { openaiError } from "../lib/errors.js";
import type { Logger } from "../lib/logger.js";
import { canAdminWorkspace, canInvite, canManageKeys, roleAtLeast } from "../lib/roles.js";
import {
  clearSessionCookieHeader,
  sessionCookieHeader,
  signSession,
} from "../lib/session.js";
import { createSessionAuthMiddleware } from "../middleware/session-auth.js";
import { loginUser, registerUser } from "./auth-service.js";

const SESSION_DAYS = 14;

export function controlRoutes(opts: {
  config: AppConfig;
  keys: KeyStore;
  usage: UsageStore;
  tenancy: TenancyStore;
  budgets: BudgetStore;
  secrets: ProviderSecretStore;
  wallets: WalletStore;
  logger: Logger;
  sessionSecret: string;
}) {
  const r = new Hono();

  // Public control endpoints (full paths so they never steal /v1/*)
  r.get("/control/v1", (c) =>
    c.json({
      name: "AI Hay Control Plane",
      version: "v1",
      endpoints: [
        "POST /control/v1/auth/register",
        "POST /control/v1/auth/login",
        "POST /control/v1/auth/logout",
        "GET /control/v1/me",
        "GET|POST /control/v1/workspaces",
        "GET|POST /control/v1/workspaces/:id/keys",
        "DELETE /control/v1/workspaces/:id/keys/:keyId",
        "GET /control/v1/workspaces/:id/usage",
        "GET /control/v1/workspaces/:id/usage/summary",
        "GET|PUT /control/v1/workspaces/:id/budget",
        "GET /control/v1/workspaces/:id/providers",
        "PUT|DELETE /control/v1/workspaces/:id/providers/:provider/secret",
        "GET /control/v1/workspaces/:id/wallet",
        "POST /control/v1/workspaces/:id/wallet/credit",
        "POST /control/v1/webhooks/credits",
        "GET|POST /control/v1/organizations/:orgId/members",
        "GET /control/v1/workspaces/:id/audit",
      ],
    }),
  );

  /**
   * Billing webhook (Stripe-style simplified):
   * POST { event_id, workspace_id, amount_usd, reason? }
   * Header: X-Credits-Webhook-Secret when STRIPE_WEBHOOK_SECRET is set.
   * Idempotent on event_id.
   */
  r.post("/control/v1/webhooks/credits", async (c) => {
    if (!opts.config.FEATURE_CREDITS) {
      throw openaiError(400, "Credits feature is disabled", "feature_disabled");
    }
    const secret = opts.config.STRIPE_WEBHOOK_SECRET;
    if (secret) {
      const provided = c.req.header("x-credits-webhook-secret") ?? "";
      if (provided !== secret) {
        throw openaiError(401, "Invalid webhook secret", "unauthorized");
      }
    }
    const body = z
      .object({
        event_id: z.string().min(1),
        workspace_id: z.string().uuid(),
        amount_usd: z.number().positive(),
        reason: z.string().optional(),
      })
      .parse(await c.req.json());

    const result = await opts.wallets.credit(body.workspace_id, body.amount_usd, {
      idempotencyKey: body.event_id,
      reason: body.reason ?? "webhook_credit",
    });
    return c.json({
      ok: true,
      replayed: result.replayed,
      balance_usd: result.entry.balanceAfter,
      entry_id: result.entry.id,
    });
  });

  r.post("/control/v1/auth/register", async (c) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().optional(),
      })
      .parse(await c.req.json());

    const result = await registerUser(opts.tenancy, opts.keys, body);
    const token = signSession(
      {
        userId: result.user.id,
        email: result.user.email,
        exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400,
      },
      opts.sessionSecret,
    );
    c.header("Set-Cookie", sessionCookieHeader(token, SESSION_DAYS * 86400));
    return c.json({
      user: result.user,
      organization_id: result.organizationId,
      workspace_id: result.workspaceId,
    });
  });

  r.post("/control/v1/auth/login", async (c) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .parse(await c.req.json());
    const user = await loginUser(opts.tenancy, body);
    const token = signSession(
      {
        userId: user.id,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400,
      },
      opts.sessionSecret,
    );
    c.header("Set-Cookie", sessionCookieHeader(token, SESSION_DAYS * 86400));
    return c.json({ user });
  });

  r.post("/control/v1/auth/logout", (c) => {
    c.header("Set-Cookie", clearSessionCookieHeader());
    return c.json({ ok: true });
  });

  // Session-protected routes mounted ONLY under /control/v1
  const secured = new Hono();
  secured.use(
    "*",
    createSessionAuthMiddleware({
      sessionSecret: opts.sessionSecret,
      tenancy: opts.tenancy,
    }),
  );

  secured.get("/me", async (c) => {
    const user = c.get("controlUser");
    const memberships = await opts.tenancy.listMembershipsForUser(user.id);
    const workspaces = [];
    for (const m of memberships) {
      const ws = await opts.keys.listWorkspaces(m.organizationId);
      for (const w of ws) {
        workspaces.push({
          id: w.id,
          name: w.name,
          slug: w.slug,
          organization_id: m.organizationId,
          role: m.role,
        });
      }
    }
    return c.json({ user, memberships, workspaces });
  });

  secured.get("/workspaces", async (c) => {
    const user = c.get("controlUser");
    const memberships = await opts.tenancy.listMembershipsForUser(user.id);
    const out = [];
    for (const m of memberships) {
      const list = await opts.keys.listWorkspaces(m.organizationId);
      for (const w of list) {
        out.push({
          id: w.id,
          name: w.name,
          slug: w.slug,
          organization_id: w.organizationId,
          role: m.role,
          created_at: w.createdAt,
        });
      }
    }
    return c.json({ data: out });
  });

  secured.post("/workspaces", async (c) => {
    const user = c.get("controlUser");
    const body = z
      .object({
        name: z.string().min(1),
        organization_id: z.string().uuid().optional(),
      })
      .parse(await c.req.json());

    const memberships = await opts.tenancy.listMembershipsForUser(user.id);
    const orgId =
      body.organization_id ??
      memberships.find((m) => roleAtLeast(m.role, "admin"))?.organizationId;
    if (!orgId) {
      throw openaiError(403, "No organization with admin access", "forbidden");
    }
    const m = await opts.tenancy.getMembership(orgId, user.id);
    if (!m || !canAdminWorkspace(m.role)) {
      throw openaiError(403, "Admin role required", "forbidden");
    }
    const ws = await opts.keys.createWorkspace({
      name: body.name,
      organizationId: orgId,
    });
    await opts.tenancy.insertAudit({
      organizationId: orgId,
      workspaceId: ws.id,
      actorUserId: user.id,
      action: "workspace.created",
      resourceType: "workspace",
      resourceId: ws.id,
    });
    return c.json({ workspace: ws }, 201);
  });

  secured.get("/workspaces/:id/keys", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    await requireAccess(opts, user.id, workspaceId, "viewer");
    const keys = await opts.keys.listKeys({ workspaceId });
    return c.json({
      data: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.keyPrefix,
        workspace_id: k.workspaceId,
        revoked: Boolean(k.revokedAt),
        rate_limit_rpm: k.rateLimitRpm,
        created_at: k.createdAt,
      })),
    });
  });

  secured.post("/workspaces/:id/keys", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    const access = await requireAccess(opts, user.id, workspaceId, "member");
    if (!canManageKeys(access.role)) {
      throw openaiError(403, "Member role required to create keys", "forbidden");
    }
    const body = z
      .object({
        name: z.string().min(1),
        rate_limit_rpm: z.number().int().positive().optional(),
      })
      .parse(await c.req.json());

    const created = await opts.keys.createKey({
      name: body.name,
      workspaceId,
      createdByUserId: user.id,
      rateLimitRpm: body.rate_limit_rpm ?? null,
    });
    await opts.tenancy.insertAudit({
      organizationId: access.organizationId,
      workspaceId,
      actorUserId: user.id,
      action: "api_key.created",
      resourceType: "api_key",
      resourceId: created.record.id,
      meta: { name: body.name, prefix: created.record.keyPrefix },
    });
    return c.json(
      {
        id: created.record.id,
        name: created.record.name,
        prefix: created.record.keyPrefix,
        workspace_id: created.record.workspaceId,
        secret: created.secret,
      },
      201,
    );
  });

  secured.delete("/workspaces/:id/keys/:keyId", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    const keyId = c.req.param("keyId");
    const access = await requireAccess(opts, user.id, workspaceId, "member");
    if (!canManageKeys(access.role)) {
      throw openaiError(403, "Member role required to revoke keys", "forbidden");
    }
    const keys = await opts.keys.listKeys({ workspaceId });
    const key = keys.find((k) => k.id === keyId);
    if (!key) throw openaiError(404, "Key not found", "not_found");
    await opts.keys.revokeByPrefix(key.keyPrefix, { workspaceId });
    await opts.tenancy.insertAudit({
      organizationId: access.organizationId,
      workspaceId,
      actorUserId: user.id,
      action: "api_key.revoked",
      resourceType: "api_key",
      resourceId: keyId,
    });
    return c.json({ ok: true });
  });

  secured.get("/workspaces/:id/usage", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    await requireAccess(opts, user.id, workspaceId, "viewer");
    const limit = Number(c.req.query("limit") ?? "50");
    const rows = await opts.usage.listByWorkspace(workspaceId, Math.min(limit, 200));
    return c.json({
      data: rows.map((e) => ({
        request_id: e.requestId,
        model_requested: e.modelRequested,
        model_used: e.modelUsed,
        provider: e.provider,
        prompt_tokens: e.promptTokens,
        completion_tokens: e.completionTokens,
        cost_usd_estimate: e.costUsdEstimate,
        status: e.status,
        latency_ms: e.latencyMs,
        attempt_count: e.attemptCount,
        error_code: e.errorCode,
      })),
    });
  });

  secured.get("/workspaces/:id/usage/summary", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    await requireAccess(opts, user.id, workspaceId, "viewer");
    const rows = await opts.usage.listByWorkspace(workspaceId, 1000);
    const byModel = new Map<string, { requests: number; tokens: number; cost: number }>();
    let totalCost = 0;
    let totalTokens = 0;
    for (const e of rows) {
      const tokens = e.promptTokens + e.completionTokens;
      totalTokens += tokens;
      totalCost += e.costUsdEstimate;
      const cur = byModel.get(e.modelUsed) ?? { requests: 0, tokens: 0, cost: 0 };
      cur.requests += 1;
      cur.tokens += tokens;
      cur.cost += e.costUsdEstimate;
      byModel.set(e.modelUsed, cur);
    }
    return c.json({
      total_requests: rows.length,
      total_tokens: totalTokens,
      total_cost_usd_estimate: totalCost,
      by_model: [...byModel.entries()].map(([model, v]) => ({ model, ...v })),
    });
  });

  secured.get("/organizations/:orgId/members", async (c) => {
    const user = c.get("controlUser");
    const orgId = c.req.param("orgId");
    const m = await opts.tenancy.getMembership(orgId, user.id);
    if (!m) throw openaiError(403, "Not a member of this organization", "forbidden");
    const members = await opts.tenancy.listMembers(orgId);
    return c.json({ data: members });
  });

  secured.post("/organizations/:orgId/members", async (c) => {
    const user = c.get("controlUser");
    const orgId = c.req.param("orgId");
    const m = await opts.tenancy.getMembership(orgId, user.id);
    if (!m || !canInvite(m.role)) {
      throw openaiError(403, "Admin role required to invite", "forbidden");
    }
    const body = z
      .object({
        email: z.string().email(),
        role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
      })
      .parse(await c.req.json());

    const invite = await opts.tenancy.createInvite({
      organizationId: orgId,
      email: body.email,
      role: body.role as MembershipRole,
      invitedByUserId: user.id,
    });
    await opts.tenancy.insertAudit({
      organizationId: orgId,
      actorUserId: user.id,
      action: "invite.created",
      resourceType: "invite",
      resourceId: invite.id,
      meta: { email: body.email, role: body.role },
    });
    opts.logger.info("invite_created", {
      organization_id: orgId,
      email: body.email,
    });
    return c.json(
      {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        token: invite.token,
        note: "Email delivery is not configured; share out of band. User registers with this email to join.",
      },
      201,
    );
  });

  secured.get("/workspaces/:id/audit", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    await requireAccess(opts, user.id, workspaceId, "admin");
    const events = await opts.tenancy.listAudit({ workspaceId, limit: 100 });
    return c.json({ data: events });
  });

  secured.get("/workspaces/:id/budget", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    await requireAccess(opts, user.id, workspaceId, "viewer");
    if (!opts.config.FEATURE_BUDGETS) {
      return c.json({ enabled: false, policy: null, usage: null });
    }
    const policy = await opts.budgets.getPolicy(workspaceId);
    const usage = await opts.budgets.getUsage(workspaceId);
    return c.json({
      enabled: true,
      policy: policy
        ? {
            hard_cost_usd_daily: policy.hardCostUsdDaily,
            soft_cost_usd_daily: policy.softCostUsdDaily,
            hard_tokens_daily: policy.hardTokensDaily,
            soft_tokens_daily: policy.softTokensDaily,
            updated_at: policy.updatedAt,
          }
        : null,
      usage,
    });
  });

  secured.put("/workspaces/:id/budget", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    const access = await requireAccess(opts, user.id, workspaceId, "admin");
    if (!opts.config.FEATURE_BUDGETS) {
      throw openaiError(400, "Budgets feature is disabled", "feature_disabled");
    }
    const body = z
      .object({
        hard_cost_usd_daily: z.number().nonnegative().nullable().optional(),
        soft_cost_usd_daily: z.number().nonnegative().nullable().optional(),
        hard_tokens_daily: z.number().int().nonnegative().nullable().optional(),
        soft_tokens_daily: z.number().int().nonnegative().nullable().optional(),
      })
      .parse(await c.req.json());

    const policy = await opts.budgets.upsertPolicy(workspaceId, {
      hardCostUsdDaily: body.hard_cost_usd_daily,
      softCostUsdDaily: body.soft_cost_usd_daily,
      hardTokensDaily: body.hard_tokens_daily,
      softTokensDaily: body.soft_tokens_daily,
    });
    await opts.tenancy.insertAudit({
      organizationId: access.organizationId,
      workspaceId,
      actorUserId: user.id,
      action: "budget.updated",
      resourceType: "budget_policy",
      resourceId: policy.id,
    });
    return c.json({
      policy: {
        hard_cost_usd_daily: policy.hardCostUsdDaily,
        soft_cost_usd_daily: policy.softCostUsdDaily,
        hard_tokens_daily: policy.hardTokensDaily,
        soft_tokens_daily: policy.softTokensDaily,
        updated_at: policy.updatedAt,
      },
    });
  });

  // V2.5 BYOK — never return secret material after save
  secured.get("/workspaces/:id/providers", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    await requireAccess(opts, user.id, workspaceId, "viewer");
    if (!opts.config.FEATURE_BYOK) {
      return c.json({
        enabled: false,
        providers: BYOK_PROVIDERS.map((p) => ({
          provider: p,
          configured: false,
          key_hint: null,
        })),
      });
    }
    const existing = await opts.secrets.list(workspaceId);
    const byProvider = new Map(existing.map((s) => [s.provider, s]));
    return c.json({
      enabled: true,
      providers: BYOK_PROVIDERS.map((p) => {
        const meta = byProvider.get(p);
        return {
          provider: p,
          configured: Boolean(meta),
          key_hint: meta?.keyHint ?? null,
          updated_at: meta?.updatedAt ?? null,
        };
      }),
    });
  });

  secured.put("/workspaces/:id/providers/:provider/secret", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    const provider = c.req.param("provider");
    const access = await requireAccess(opts, user.id, workspaceId, "admin");
    if (!opts.config.FEATURE_BYOK) {
      throw openaiError(400, "BYOK feature is disabled", "feature_disabled");
    }
    if (!isByokProvider(provider)) {
      throw openaiError(400, `Unknown provider: ${provider}`, "invalid_provider");
    }
    const body = z
      .object({
        api_key: z.string().min(1).max(4096),
      })
      .parse(await c.req.json());

    const meta = await opts.secrets.upsert(
      workspaceId,
      provider,
      body.api_key,
      user.id,
    );
    await opts.tenancy.insertAudit({
      organizationId: access.organizationId,
      workspaceId,
      actorUserId: user.id,
      action: "byok.secret_upserted",
      resourceType: "provider_secret",
      resourceId: meta.id,
      meta: { provider },
    });
    // Never echo api_key
    return c.json({
      provider: meta.provider,
      configured: true,
      key_hint: meta.keyHint,
      updated_at: meta.updatedAt,
    });
  });

  secured.delete("/workspaces/:id/providers/:provider/secret", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    const provider = c.req.param("provider");
    const access = await requireAccess(opts, user.id, workspaceId, "admin");
    if (!opts.config.FEATURE_BYOK) {
      throw openaiError(400, "BYOK feature is disabled", "feature_disabled");
    }
    if (!isByokProvider(provider)) {
      throw openaiError(400, `Unknown provider: ${provider}`, "invalid_provider");
    }
    const ok = await opts.secrets.delete(workspaceId, provider);
    if (ok) {
      await opts.tenancy.insertAudit({
        organizationId: access.organizationId,
        workspaceId,
        actorUserId: user.id,
        action: "byok.secret_deleted",
        resourceType: "provider_secret",
        resourceId: provider,
        meta: { provider },
      });
    }
    return c.json({ ok, provider, configured: false });
  });

  // V2.6 wallets
  secured.get("/workspaces/:id/wallet", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    await requireAccess(opts, user.id, workspaceId, "viewer");
    if (!opts.config.FEATURE_CREDITS) {
      return c.json({ enabled: false, balance_usd: null, ledger: [] });
    }
    const bal = await opts.wallets.getBalance(workspaceId);
    const ledger = await opts.wallets.listLedger(workspaceId, 25);
    return c.json({
      enabled: true,
      balance_usd: bal.balanceUsd,
      updated_at: bal.updatedAt,
      ledger: ledger.map((e) => ({
        id: e.id,
        kind: e.kind,
        amount_usd: e.amountUsd,
        balance_after: e.balanceAfter,
        request_id: e.requestId,
        reason: e.reason,
        created_at: e.createdAt,
      })),
    });
  });

  secured.post("/workspaces/:id/wallet/credit", async (c) => {
    const user = c.get("controlUser");
    const workspaceId = c.req.param("id");
    const access = await requireAccess(opts, user.id, workspaceId, "admin");
    if (!opts.config.FEATURE_CREDITS) {
      throw openaiError(400, "Credits feature is disabled", "feature_disabled");
    }
    const body = z
      .object({
        amount_usd: z.number().positive().max(1_000_000),
        idempotency_key: z.string().min(1).max(128),
        reason: z.string().max(256).optional(),
      })
      .parse(await c.req.json());

    const result = await opts.wallets.credit(workspaceId, body.amount_usd, {
      idempotencyKey: body.idempotency_key,
      reason: body.reason ?? "manual_credit",
    });
    await opts.tenancy.insertAudit({
      organizationId: access.organizationId,
      workspaceId,
      actorUserId: user.id,
      action: "wallet.credited",
      resourceType: "wallet",
      resourceId: workspaceId,
      meta: {
        amount_usd: body.amount_usd,
        replayed: result.replayed,
        idempotency_key: body.idempotency_key,
      },
    });
    return c.json({
      balance_usd: result.entry.balanceAfter,
      replayed: result.replayed,
      entry_id: result.entry.id,
    });
  });

  // Critical: nest under /control/v1 so session middleware never sees /v1 data plane
  r.route("/control/v1", secured);
  return r;
}

async function requireAccess(
  opts: { tenancy: TenancyStore },
  userId: string,
  workspaceId: string,
  minRole: MembershipRole,
) {
  const access = await opts.tenancy.getWorkspaceAccess(userId, workspaceId);
  if (!access || !roleAtLeast(access.role, minRole)) {
    throw openaiError(403, "Insufficient workspace access", "forbidden");
  }
  return access;
}
