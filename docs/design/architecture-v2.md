# AI Hay Router — Architecture Design (V2)

| Field | Value |
| --- | --- |
| **Product** | AI Hay Router |
| **Document type** | Architecture design (current product) |
| **Status** | As-built at **`v0.7.0`** |
| **Last updated** | 2026-08-06 |
| **Companions** | [Product Specification](./product-spec.md) · [Implementation Plan](./implementation-plan-v2.md) · [Runbook](../runbook.md) |
| **Primary stack** | TypeScript · Hono · Postgres · Redis · Docker · Next.js dashboard |

This document describes **current architecture**: multi-model gateway + control plane (tenancy, observability, commercial options) with OpenAI-compatible wire contracts and stream-through principles.

**Not in scope:** smart auto-routing (future V3). Fresh installs only — no multi-version upgrade path is maintained.

---

## 1. Product goals

### 1.1 What is delivered today

| Capability | State |
| --- | --- |
| OpenAI-compatible chat + SSE stream-through | Done |
| Providers | OpenAI, Anthropic, xAI (Grok) |
| Auth | CLI / durable hashed keys + optional dev key + session control plane |
| Routing | Registry + aliases + model fallbacks; pre-commit stream failover only |
| Metering | `usage_events` + cost estimate + `credential_mode` |
| Limits | RPM, max_tokens clamp, daily tokens, workspace budgets |
| Deploy | Docker Compose (api + Postgres + Redis + optional web) or memory store |
| Ops | Structured JSON logs, `request_complete`, `/metrics`, `/health` `/ready` |
| Control plane + dashboard | Done |
| BYOK / credits | Done (feature-flagged) |
| Tools / vision | Done (capability matrix + flag) |

### 1.2 Design drivers

1. **Operators need a UI** — keys, usage, BYOK, wallet without SQL.  
2. **Teams need tenancy** — workspaces, roles, audit.  
3. **Commercial clarity** — BYOK and/or prepaid credits.  
4. **Production monitoring** — metrics, alerts, completion logs.  
5. **Richer API surface** — tools/vision, aliases, more providers over time.

### 1.3 V2 one-liner

*Keep the V1 gateway hot path; add a multi-tenant control plane, observability, and commercial attachment points.*

---

## 2. Design intent (V2)

### 2.1 What V2 is

| Layer | V2 behavior |
| --- | --- |
| **Aggregator** | Same OpenAI-compatible chat (+ expanded modalities where adapters support) |
| **Gateway** | V1 + stronger limits, budgets, optional cache, guardrails hooks |
| **Router** | V1 registry + **aliases** (`aihay/cheap` …); still rule-based, not ML |
| **Control plane** | Users, orgs/workspaces, dashboard APIs, key lifecycle UI, usage views |
| **Commercial** | BYOK and/or credits path; metering remains source of truth |
| **Observability** | Structured access logs + metrics + optional OTEL traces |

### 2.2 What V2 is not

| Non-goal | Deferred to |
| --- | --- |
| Preference-trained / classifier auto router | V3 |
| Eval-linked online routing | V3 |
| 100+ provider marketplace | Later |
| Guaranteed quality parity across hosts | Never (document variance) |
| Mid-stream transparent model switch | Never |
| Replacing Go/µs gateways on pure overhead | Only if metrics force a hot-path rewrite |

### 2.3 Principles (inherit V1 + add)

**Still locked from V1**

1. Wire contract is the product.  
2. Stream-through; no buffer-then-forward.  
3. Dual-layer routing (model → provider/endpoint).  
4. Adapters own vendor quirks.  
5. Meter every terminal request.  
6. Stateless API replicas; state in Postgres/Redis.  
7. Stream commit is final for failover.  

**New for V2**

8. **Split control plane vs data plane** — dashboard/auth/billing must not block the chat hot path.  
9. **Tenant isolation by default** — every key, usage row, and config scoped to workspace (and org).  
10. **Observability is first-class** — metrics and completion logs are product requirements, not afterthoughts.  
11. **Commercial pluggability** — ledger supports credits *or* BYOK without rewriting adapters.  
12. **Progressive enhancement of API** — tools/vision/aliases land behind capability flags and adapter support matrices.  

---

## 3. System context (V2)

```text
                    ┌─────────────────────────────────────┐
                    │  Humans                             │
                    │  Dashboard · signup · key UI · usage │
                    └──────────────────┬──────────────────┘
                                       │ HTTPS session / OAuth
                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Control plane (V2)                                              │
│  Users · Orgs · Workspaces · API key mgmt · budgets · billing    │
│  Admin API · Web UI (e.g. Next.js)                               │
└────────────────────────────┬─────────────────────────────────────┘
                             │ shared Postgres (tenant tables)
                             │ publish config / invalidate Redis
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Data plane (V1 evolved) — TypeScript Hono API                   │
│  Auth (key hash) · limits · validate · pipeline · adapters       │
│  Stream SSE · meter · access logs · metrics                      │
└────────────┬───────────────────────────────┬─────────────────────┘
             │                               │
             ▼                               ▼
      Redis (limits,                   Upstream inference
       cache, circuit)                 Platform keys and/or BYOK
      Postgres (usage,                 OpenAI · Anthropic · xAI · …
       keys, tenants)                  (+ customer keys if BYOK)
```

| Actor | V2 relationship |
| --- | --- |
| **App developer** | Uses AI Hay API key; optional dashboard for self-serve keys |
| **Team admin** | Manages workspace members, budgets, allowlists |
| **Operator** | Runs data plane + control plane; watches metrics/alerts |
| **Upstream providers** | Platform account and/or customer BYOK accounts |

---

## 4. Control plane vs data plane

### 4.1 Separation rules

| Concern | Plane | Latency budget |
| --- | --- | --- |
| Chat completions / streams | **Data** | Hot path; p50 overhead still ≤ 15 ms warm |
| Key verify (hash lookup) | **Data** | Cache in Redis; DB on miss |
| Key create / revoke UI | **Control** | Human-scale |
| Usage charts | **Control** | Read from usage ledger / rollups |
| Signup / OAuth | **Control** | Offline to chat path |
| Stripe webhooks | **Control** | Async; updates wallet/credits table |
| Adapter inference | **Data** | Dominated by provider TTFT |

**Rule:** Control-plane outages may block *new* key creation or billing updates; they should **not** stop authenticated chat if key cache + Postgres for keys/usage remain available. Design for degraded mode: chat works if data-plane deps are up.

### 4.2 Suggested deployables (V2)

| Service | Role | Scale |
| --- | --- | --- |
| `api` | Data plane (existing `@aihay/api` evolved) | Horizontal N |
| `web` | Dashboard (SSR/SPA) | Horizontal |
| `admin-api` *or* `api` admin routes | Control-plane HTTP under `/admin` or separate host | Horizontal |
| `worker` | Usage rollups, webhook retries, email | 1–N |
| Postgres | System of record | Managed primary (+ replica later) |
| Redis | Limits, key cache, optional semantic cache | Managed |

V2 may start with **admin routes on the same Hono process** behind a different authn (session cookie / JWT), then split hosts when load or security boundaries require it.

### 4.3 Repo layout evolution (target)

```text
ai-hay-router/
  apps/
    api/          # data plane (V1 codebase continues)
    web/          # dashboard (new)
    worker/       # async jobs (new, optional early)
  packages/
    shared/       # types, zod contracts shared by api + web
  docs/design/
    architecture-v1.md
    architecture-v2.md   # this file
  docker-compose.yml     # + web service
```

---

## 5. Multi-tenant identity model

### 5.1 Entities

```text
User 1──* Membership *──1 Organization 1──* Workspace 1──* ApiKey
                              │                 │
                              │                 └──* UsageEvent
                              └──* BillingAccount / CreditWallet (optional)
```

| Entity | Purpose |
| --- | --- |
| **User** | Human login identity (email/OAuth) |
| **Organization** | Billing boundary, SSO later |
| **Workspace** | Isolation unit for keys, usage, model allowlists |
| **Membership** | Role: `owner` \| `admin` \| `member` \| `viewer` |
| **ApiKey** | Machine identity for data plane (unchanged wire: `sk-aihay-…`) |

V1 single default workspace becomes the **bootstrap workspace** for existing self-host installs (migration: attach to a synthetic org).

### 5.2 Authn modes

| Mode | Who | How |
| --- | --- | --- |
| **Data plane** | Apps | Bearer API key (V1) |
| **Control plane** | Humans | Session cookie or JWT after email/OAuth |
| **CLI (self-host)** | Operator | Still supported: service token or local DB access for break-glass |

### 5.3 Authorization (control plane)

| Action | owner | admin | member | viewer |
| --- | --- | --- | --- | --- |
| Create/revoke keys | ✓ | ✓ | own keys only* | — |
| View usage | ✓ | ✓ | ✓ | ✓ |
| Set budgets | ✓ | ✓ | — | — |
| Manage members | ✓ | ✓ | — | — |
| Billing | ✓ | optional | — | — |

\*Product choice: members may create personal keys scoped to workspace; tighten for enterprise.

---

## 6. Data plane evolution

### 6.1 Hot path (largely V1)

```text
Auth → rate/budget check → validate → resolve model/alias
  → attempt plan → adapter → stream/normalize → meter → access log + metrics
```

### 6.2 New data-plane capabilities (V2)

| Feature | Design notes |
| --- | --- |
| **Aliases** | `aihay/cheap` → registry policy → concrete model id(s) |
| **Tools / vision** | Capability matrix per model; translate in adapters; reject if unsupported |
| **Budgets** | Soft/hard $ or token caps per key/workspace; Redis counters + periodic reconcile from usage |
| **Exact cache** (optional) | Hash(model + messages + params) → Redis; skip upstream on hit; meter as `cache_hit` |
| **Semantic cache** (optional) | Side process embeddings; **not** on default hot path until proven |
| **BYOK** | Per-workspace encrypted provider secrets; credential resolution prefers BYOK then platform |
| **Provider circuit** | Redis unhealthy flag after consecutive 5xx (V1 optional → V2 default) |
| **Guardrails** | Max tokens (V1), blocklists, optional PII redaction plugins **before** adapter |

### 6.3 Credential resolution (platform vs BYOK)

```text
attempt.credential_ref
  → if workspace has BYOK for provider → decrypt workspace secret
  → else platform env / secret manager
  → else fail attempt (missing credential)
```

Platform and BYOK traffic share adapters; only **secret source** changes. Usage rows must record `credential_mode: platform | byok` for COGS and billing.

### 6.4 Content & models

| Surface | V2 target |
| --- | --- |
| Text chat | Required (V1) |
| Tools / function calling | Productized for OpenAI + Anthropic + xAI as adapters allow |
| Vision | Productized where provider supports; document matrix |
| Embeddings API | Stretch V2 / early V3 |
| Virtual models | `aihay/cheap`, `aihay/balanced`; `aihay/auto` stays rules-only until V3 |

---

## 7. Commercial architecture (V2 options)

V1 metering stays the ledger. V2 attaches **money movement**.

```text
                    ┌──────────────┐
                    │  Customer    │
                    └──────┬───────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    Path A: Credits   Path B: BYOK    Path C: Self-host
    (prepaid)         (customer keys) (no AI Hay bill)
           │               │               │
           ▼               ▼               ▼
    AI Hay pays       Customer pays    Customer pays
    providers         providers        providers
    + platform fee    + control fee    + $0 platform
```

| Path | Data plane impact | Control plane impact |
| --- | --- | --- |
| **A Credits** | Reject when wallet insufficient (pre-check + post-meter debit) | Top-ups, Stripe, invoices |
| **B BYOK** | Credential resolution; fee on usage equivalent | Store encrypted keys; fee schedules |
| **C Self-host** | V1-like; optional license key later | Minimal cloud UI |

**Recommendation:** implement **wallet + usage debit** and **BYOK credential store** as separate modules; enable per deployment flag.

OpenRouter-style research (pass-through inference + thin platform fee) remains a **pricing policy**, not a hard architecture constraint.

---

## 8. Observability architecture (V2)

V1 issue: logs + SQL only. V2 makes observability part of the system design.

### 8.1 Three signals

| Signal | V2 requirement |
| --- | --- |
| **Logs** | JSON stdout; **one completion log per request** + existing attempt/error events |
| **Metrics** | Prometheus-compatible `/metrics` or push; RED + business meters |
| **Traces** | OpenTelemetry optional; span per attempt when enabled |

### 8.2 Completion access log (required)

Every terminal chat request emits (no prompt body):

```json
{
  "msg": "request_complete",
  "request_id": "...",
  "workspace_id": "...",
  "api_key_id": "...",
  "route": "/v1/chat/completions",
  "stream": true,
  "model_requested": "...",
  "model_used": "...",
  "provider": "...",
  "status": "success|error|aborted",
  "http_status": 200,
  "latency_ms": 0,
  "ttft_ms": null,
  "attempt_count": 1,
  "prompt_tokens": 0,
  "completion_tokens": 0,
  "cost_usd_estimate": 0,
  "credential_mode": "platform|byok",
  "error_code": null
}
```

### 8.3 Metrics catalog (minimum)

| Metric | Labels (examples) |
| --- | --- |
| `aihay_http_requests_total` | `route`, `status` |
| `aihay_upstream_attempts_total` | `provider`, `result` |
| `aihay_request_duration_ms` | histogram; `route` |
| `aihay_ttft_ms` | histogram; `provider` |
| `aihay_tokens_total` | `direction=prompt\|completion`, `provider` |
| `aihay_cost_usd_total` | `workspace_id` (careful cardinality) or aggregate only |
| `aihay_usage_enqueue_failures_total` | — |

**Cardinality rule:** prefer `workspace_id` only on low-volume metrics or use exemplars; never label by raw API key.

### 8.4 Alerting (ops)

| Alert | Condition |
| --- | --- |
| API down | `/ready` failing |
| Error budget | 5xx or `upstream_unavailable` rate elevated |
| Metering hole | `usage_enqueue_failures` > 0 sustained |
| Dependency | Postgres/Redis down |
| Spend | Workspace hard budget exhausted rate (abuse/leak) |

### 8.5 Privacy

- Default: no prompt/completion storage (V1).  
- V2 optional **debug capture** per workspace with retention TTL and explicit opt-in.  
- Dashboard shows metadata + optional truncated error messages only.

---

## 9. Public API surface (V2)

### 9.1 Data plane (apps)

| Method | Path | V2 notes |
| --- | --- | --- |
| `POST` | `/v1/chat/completions` | V1 + tools/vision when supported |
| `GET` | `/v1/models` | Filter by workspace allowlist |
| `GET` | `/health` `/ready` | Ready checks expanded (redis optional) |
| `GET` | `/metrics` | Ops; may require network policy, not public internet |
| Later | `/v1/embeddings` | Stretch |

### 9.2 Control plane (dashboard / admin)

Illustrative REST (subject to OpenAPI later):

| Area | Examples |
| --- | --- |
| Auth | `POST /auth/signup`, `POST /auth/login`, OAuth callbacks |
| Orgs/workspaces | CRUD + invite |
| Keys | create/list/revoke (returns secret once) |
| Usage | timeseries, by model/key |
| Budgets | get/set |
| BYOK | put/delete provider secrets |
| Billing | portal session, credit balance |

Admin APIs authenticate **users**, not API keys. Data plane remains key-only for machine traffic.

---

## 10. Data model additions (V2)

| Table / store | Purpose |
| --- | --- |
| `users` | Identity |
| `organizations` | Tenant root |
| `memberships` | User↔org roles |
| `workspaces` | Evolved from V1 (multi-row) |
| `api_keys` | + `created_by_user_id`, workspace FK (already) |
| `usage_events` | + `workspace_id` (have), `credential_mode`, `organization_id` |
| `usage_rollups_daily` | Fast dashboard queries |
| `provider_secrets` | Encrypted BYOK material |
| `wallets` / `ledger_entries` | Credits path |
| `budget_policies` | Soft/hard caps |
| `model_allowlists` | Optional per workspace |
| `alias_policies` | Virtual model resolution |
| `audit_events` | Key revoke, member change, BYOK update |

**Encryption:** provider secrets via KMS or app-level envelope encryption; never log plaintext.

---

## 11. Security architecture (V2)

| Topic | V2 approach |
| --- | --- |
| API keys | HMAC-SHA256 + pepper (V1); optional key prefixes per env |
| Human sessions | HTTP-only secure cookies or short-lived JWT + refresh |
| BYOK secrets | Encrypt at rest; decrypt only in data plane memory for request |
| SSRF | Still forbid client-supplied upstream URLs |
| Tenant isolation | Every query scoped by workspace/org; integration tests for cross-tenant |
| Admin surface | Separate hostname recommended (`app.` vs `api.`) |
| Secrets management | Platform provider keys in secret manager, not git |

---

## 12. Wire compatibility & feature flags

### 12.1 Wire compatibility

- `sk-aihay-…` keys and OpenAI Chat Completions shapes are the external contract.  
- Optional response headers / body fields may be added without breaking clients.

### 12.2 Fresh install

1. Configure `.env` from `.env.example`.  
2. Start with Compose or `pnpm dev` (migrations apply on Postgres boot).  
3. Optionally start dashboard (`pnpm dev:web` or Compose profile `full`).  
4. Create keys via CLI, control API, or UI.

### 12.3 Feature flags

| Flag | Typical default | Meaning |
| --- | --- | --- |
| `FEATURE_CONTROL_PLANE` | on | Dashboard + user auth |
| `FEATURE_BYOK` | off | Workspace provider secrets |
| `FEATURE_CREDITS` | off | Wallet enforcement |
| `FEATURE_TOOLS_VISION` | off | Tools + multimodal policy |
| `FEATURE_ALIASES` | on | Virtual models |
| `FEATURE_BUDGETS` | on | Daily budget policies |
| `FEATURE_SEMANTIC_CACHE` | off | Expensive path (if ever enabled) |
| `FEATURE_OTEL` | off | Traces |

---

## 13. Non-functional targets (V2)

| Area | Target |
| --- | --- |
| Gateway overhead | Hold V1: p50 ≤ 15 ms warm same-region |
| Availability | Multi-instance data plane; control plane separately scalable |
| Metering lag | Usage visible in dashboard within seconds (async OK) |
| Dashboard p95 | Interactive &lt; 500 ms for common queries (use rollups) |
| Security | Cross-tenant isolation tests in CI |
| Observability | Metrics + completion logs required for “V2 production” badge |

---

## 14. Implementation phases (V2 roadmap)

Directional; each phase should be shippable.

| Phase | Name | Outcomes |
| --- | --- | --- |
| **V2.0** | Observability hardening | Completion logs, `/metrics`, log field audit, alerts runbook |
| **V2.1** | Tenancy foundation | users/orgs/workspaces migration; multi-workspace keys |
| **V2.2** | Control plane API | Key CRUD HTTP (session auth); usage query API |
| **V2.3** | Dashboard | Minimal web UI: keys + usage charts |
| **V2.4** | Budgets & aliases | Hard/soft caps; `aihay/cheap` etc. |
| **V2.5** | BYOK | Encrypted secrets; credential_mode on usage |
| **V2.6** | Credits / Stripe (optional path) | Wallet debit; top-up |
| **V2.7** | Tools/vision + providers | Capability matrix; Gemini/Groq as demand warrants |
| **V3** | Smart routing | Classifiers / preference models / evals |

**Suggested first code milestone:** **V2.0** (observability) — unblocks production confidence without tenancy complexity.

---

## 15. Risks (V2-specific)

| Risk | Mitigation |
| --- | --- |
| Control plane couples into hot path | Strict separation; cache keys; no session DB on chat |
| Dashboard scope creep | Ship keys + usage first; defer fancy analytics |
| BYOK secret leakage | KMS, audit log, never log secrets |
| Metrics cardinality explosion | Aggregate labels; no per-key Prometheus labels |
| Credits race conditions | Atomic wallet debit; idempotent usage ids |
| Breaking self-host simplicity | Feature flags; Compose profile `full` vs `gateway-only` |
| Tools/vision adapter debt | Support matrix; refuse unsupported with clear 400 |

---

## 16. Open decisions (to resolve during V2)

| # | Decision | Options | Notes |
| --- | --- | --- | --- |
| 1 | Managed cloud vs self-host-first packaging | Cloud / OSS / both | Affects signup priority |
| 2 | Admin API colocated vs separate service | Same process / split | Start colocated |
| 3 | Auth provider | Email magic link / password / OIDC | OIDC helps enterprise |
| 4 | Credits vs BYOK-first monetization | A / B / both | Both modules; flag per deploy |
| 5 | Dashboard framework | Next.js recommended | Aligns with TS monorepo |
| 6 | Metrics path | Prometheus scrape vs vendor agent | Prometheus-first for self-host |
| 7 | Multi-region | Single region V2 | Active-active later |

---

## 17. Documentation map

| Doc | Role |
| --- | --- |
| [Architecture V1](./architecture-v1.md) | As-built gateway; hot path laws |
| **Architecture V2 (this doc)** | Productization target architecture |
| [Product Spec](./product-spec.md) | Product scope; update when V2 features lock |
| [Implementation Plan V1](./implementation-plan-v1.md) | V1 execution (mostly complete) |
| [Implementation Plan V2](./implementation-plan-v2.md) | V2.0–V2.7 tasks, flags, DoD |
| [Scalability](./scalability.md) | RPS stages, edge/multi-region, hot-path split |
| [Runbook](../runbook.md) | Ops today; extend for metrics/dashboard |

---

## 18. Summary

**Architecture V2** keeps the **V1 data plane** (OpenAI-compatible stream-through gateway, adapters, failover rules, metering) and adds:

1. **Control plane** — users, orgs, workspaces, dashboard  
2. **Observability** — completion logs, metrics, alerts  
3. **Commercial hooks** — BYOK + optional credits on the same ledger  
4. **Richer product surface** — aliases, budgets, tools/vision, more providers  

**Smart auto-routing remains V3.**  

Next execution: follow **[Implementation Plan V2](./implementation-plan-v2.md)** starting with **V2.0 Observability**, then tenancy and dashboard.

---

*Architecture V2 — living draft. Update when control-plane boundaries, commercial path, or observability requirements are decided.*
