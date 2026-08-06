# AI Hay Router — Implementation Plan (V2)

| Field | Value |
| --- | --- |
| **Product** | AI Hay Router |
| **Document type** | Implementation plan (V2) |
| **Status** | **Shipped** — product surface complete at **`v0.7.0`** (fresh installs only; no upgrade path maintained) |
| **Last updated** | 2026-08-06 |
| **Based on** | [Architecture](./architecture-v2.md) · [Product Spec](./product-spec.md) |
| **Code** | `apps/api` + `apps/web` (current gateway + control plane) |
| **Goal** | Record of phases that built the current product; ops live in [Runbook](../runbook.md) |

This plan turns Architecture V2 into **ordered, demoable phases** with tasks, acceptance criteria, testing expectations, and a definition of done. It deliberately **excludes** smart/auto routing (V3).

---

## 1. North star (what “V2 done” means)

When V2 is complete for a given deployment profile, operators and teams can:

1. Run the **same data plane** as V1 (chat stream, fallbacks, adapters) with **stronger observability**.  
2. Optionally enable a **control plane**: signup/login, orgs/workspaces, key UI, usage charts.  
3. Enforce **budgets** and resolve **aliases** (`aihay/cheap`, …).  
4. Optionally use **BYOK** and/or **credits** without rewriting adapters.  
5. Use **tools/vision** where the capability matrix allows.  
6. Feature flags tune surface area without rewrites.

### 1.1 Success metrics (directional)

| Metric | V2 target |
| --- | --- |
| V1 wire compatibility | Existing OpenAI SDK clients keep working |
| Gateway overhead | Hold p50 ≤ 15 ms warm same-region (data plane) |
| Observability | Completion log + scrapeable metrics on every deploy profile labeled “production” |
| Tenancy | No cross-workspace key/usage leakage (CI tests) |
| Dashboard time-to-key | &lt; 5 minutes from signup to first successful call (managed profile) |
| Self-host simplicity | `gateway-only` Compose profile still runs without web/auth |
| Metering | Every terminal request still produces a ledger row; dashboards use rollups |

---

## 2. Relationship to V1

| V1 (done / baseline) | V2 (this plan) |
| --- | --- |
| Data plane gateway | Evolves in place (`apps/api`) |
| CLI keys, memory/Postgres | + HTTP key mgmt, multi-workspace |
| JSON logs, usage SQL | + completion logs, `/metrics`, alerts |
| Platform env provider keys | + BYOK secrets, credential_mode |
| Text-only content policy | + tools/vision matrix |
| Single default workspace | + orgs, users, memberships |
| No dashboard | + `apps/web` |
| No billing | + optional wallet/credits |

**Hard compatibility rules**

- Do not break `POST /v1/chat/completions` OpenAI shapes.  
- Do not buffer entire streams.  
- Do not mid-stream switch models.  
- Do not require signup for self-host gateway-only mode.  
- Do not put session/OAuth DB on the chat hot path.

---

## 3. Scope lock

### 3.1 In scope (V2 program)

| Area | Deliverable |
| --- | --- |
| Observability | `request_complete` log; Prometheus `/metrics`; runbook alerts; usage enqueue failure metric |
| Tenancy | `users`, `organizations`, `memberships`, multi-`workspaces` |
| Control plane API | Session/JWT auth; key CRUD; usage query; budgets CRUD |
| Dashboard | Minimal UI: auth, keys, usage |
| Routing product | Aliases; workspace allowlists (optional) |
| Limits | Soft/hard budgets ($ and/or tokens) beyond V1 RPM/daily |
| Commercial | BYOK store + resolution; optional credits/wallet |
| API richness | Tools/vision per adapter matrix; ≥1 additional provider if demanded |
| Deploy | Compose profiles: `gateway` vs `full`; feature flags |
| Tests | Unit + integration + tenant isolation + migration tests |
| Docs | Runbook V2 ops; OpenAPI for control plane (stretch) |

### 3.2 Out of scope (V2)

| Item | Deferred to |
| --- | --- |
| Learned/auto model router, eval-linked routing | **V3** |
| Semantic cache as default hot path | Later / optional flag only if isolated |
| Multi-region active-active | Later |
| Full enterprise SSO pack (SAML suite) | Later (OIDC first is enough) |
| Embeddings/images as DoD | Stretch; not blocking V2 program done |
| Go data plane rewrite | Only if metrics force it |
| Mid-stream failover | Never |

### 3.3 Decisions locked for this plan

| Decision | Choice |
| --- | --- |
| Data plane language | **TypeScript + Hono** (continue) |
| Control plane UI | **Next.js** (App Router) in `apps/web` |
| Shared types | `packages/shared` when web lands; duplicate types OK in V2.0–V2.1 |
| Admin API location | **Colocated on `api`** under `/control/v1/*` first; split host later if needed |
| Human auth (first) | **Email + password or magic link**; OIDC as V2.3+ stretch |
| Metrics | **Prometheus text exposition** at `GET /metrics` |
| Feature flags | Env booleans (see §5) |
| First engineering milestone | **V2.0 Observability** before tenancy UI |
| Commercial modules | **BYOK and credits are independent flags** |
| Self-host default | **Gateway-only** still first-class |

### 3.4 Deployment profiles

| Profile | Services | Flags (typical) |
| --- | --- | --- |
| **gateway-only** | api, postgres, redis | Control plane off; CLI keys |
| **full** | api, web, postgres, redis, (worker) | Control plane on |
| **full + commercial** | full + Stripe secrets | `CREDITS` and/or `BYOK` on |

---

## 4. Feature flags (implementation contract)

| Env flag | Default | Unlocks |
| --- | --- | --- |
| `FEATURE_COMPLETION_LOGS` | `true` after V2.0 | `request_complete` logs |
| `FEATURE_METRICS` | `true` after V2.0 | `/metrics` |
| `FEATURE_CONTROL_PLANE` | `false` | `/control/v1/*` + require user auth tables |
| `FEATURE_DASHBOARD` | `false` | Expect `web` service |
| `FEATURE_ALIASES` | `false` | `aihay/*` resolution |
| `FEATURE_BUDGETS` | `false` | Hard/soft $ caps enforcement |
| `FEATURE_BYOK` | `false` | Workspace provider secrets |
| `FEATURE_CREDITS` | `false` | Wallet pre-check + debit |
| `FEATURE_TOOLS_VISION` | `false` | Relax V1 content reject when model supports |
| `FEATURE_OTEL` | `false` | Trace export |
| `FEATURE_SEMANTIC_CACHE` | `false` | Off by default forever unless proven |

Flags must be read in `config.ts` and tested in both on/off states for critical paths.

---

## 5. Stack additions (V2)

| Layer | V1 | V2 add |
| --- | --- | --- |
| Data plane | Hono, Zod, pg, ioredis | prom-client (or equivalent), optional OTEL SDK |
| Migrations | Raw `schema.sql` | Versioned migrations (Drizzle Kit or node-pg-migrate) — **pick in V2.1 and stick** |
| Control plane | — | Session store (Redis or signed cookies), password hash (argon2id for humans) |
| Web | — | Next.js, TanStack Query optional |
| Worker | optional fire-and-forget | Dedicated `apps/worker` for rollups/webhooks when credits land |
| Secrets | env | Envelope encryption for BYOK (libsodium / KMS interface) |

**Recommendation:** introduce **versioned SQL migrations** in V2.1 before multi-table tenancy; stop hand-editing only `schema.sql` for prod.

---

## 6. Repo layout evolution

```text
ai-hay-router/
  apps/
    api/                 # data plane + colocated /control (continues)
    web/                 # V2.3 dashboard
    worker/              # V2.6+ async (optional earlier for rollups)
  packages/
    shared/              # zod types, API client types (from V2.2/V2.3)
  docs/design/
    architecture-v2.md
    implementation-plan-v2.md   # this file
  docker-compose.yml
  docker-compose.full.yml       # or compose profiles
```

Do **not** split the monorepo. Keep adapters and pipeline in `apps/api`.

---

## 7. Phased plan overview

| Phase | Name | Est. (1 eng) | Depends on | Tag (suggest) |
| --- | --- | --- | --- | --- |
| **V2.0** | Observability hardening | 3–5 days | V1 | `v0.2.0` |
| **V2.1** | Tenancy foundation | 5–8 days | V2.0 | `v0.2.1` |
| **V2.2** | Control plane API | 5–8 days | V2.1 | `v0.3.0` |
| **V2.3** | Dashboard MVP | 1–2 weeks | V2.2 | `v0.4.0` |
| **V2.4** | Budgets & aliases | 4–7 days | V2.2 | `v0.4.1` |
| **V2.5** | BYOK | 5–8 days | V2.2 | `v0.5.0` |
| **V2.6** | Credits / Stripe | 1–2 weeks | V2.2, metering solid | `v0.6.0` |
| **V2.7** | Tools/vision + providers | 1–2 weeks | V2.0+ | `v0.7.0` |
| **V3** | Smart routing | separate program | V2 metering + evals | later |

Phases **V2.4 / V2.5 / V2.6 / V2.7** can partially parallelize after V2.2 if staffing &gt; 1.

**Critical path for “managed product”:** V2.0 → V2.1 → V2.2 → V2.3.  
**Critical path for “production self-host”:** V2.0 (+ keep gateway-only).

---

## 8. Phase detail

### V2.0 — Observability hardening

**Goal:** Every production deploy can answer *what happened to this request?* and *is the service healthy?* without SQL archaeology.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 2.0.1 | Define `RequestCompleteEvent` type (no prompt fields) | Match Architecture V2 §8.2 |
| 2.0.2 | Emit `request_complete` on all chat terminal paths | success, error, aborted, validation failures (where key known) |
| 2.0.3 | Add `service`, `instance_id` (or hostname) to logger base fields | Multi-replica ready |
| 2.0.4 | Prometheus registry + `GET /metrics` | Prefer unauthenticated internal; document network policy |
| 2.0.5 | Instruments: HTTP count/duration, upstream attempts, TTFT, tokens, usage failures | Avoid high-cardinality labels |
| 2.0.6 | Metric on `usage_insert_failed` | Counter |
| 2.0.7 | Optional: attempt span hooks behind `FEATURE_OTEL` stub | No-op exporter OK |
| 2.0.8 | Runbook: log catalog, metrics list, alert rules | Update `docs/runbook.md` |
| 2.0.9 | Unit tests for event shape; integration test metrics endpoint scrapes | |
| 2.0.10 | Compose sample Grafana/Prometheus **optional** compose profile | Nice-to-have |

#### Acceptance criteria

- [x] Every authenticated chat completion produces exactly one `request_complete` log line (or documented exception: unauthenticated 401 before key).  
- [x] `/metrics` returns Prometheus text with core series present after traffic.  
- [x] No prompt/completion content in logs (event schema is metadata-only).  
- [x] Runbook documents three alerts: ready fail, 5xx rate, usage enqueue failures.  
- [x] Unit + integration tests for completion log + metrics.  
- [x] Tag **`v0.2.0`** (package version).

#### Exit demo

```bash
docker compose up -d
# traffic
curl -s localhost:3000/metrics | head
docker compose logs api 2>&1 | grep request_complete
```

---

### V2.1 — Tenancy foundation

**Goal:** Multi-workspace data model; CLI-operable keys and workspaces.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 2.1.1 | Choose migration tool; add `apps/api/migrations/` | Freeze process in CONTRIBUTING/runbook |
| 2.1.2 | Tables: `users`, `organizations`, `memberships`; evolve `workspaces` | |
| 2.1.3 | Migration: create default org + workspace; attach existing `api_keys` | Idempotent |
| 2.1.4 | `api_keys.created_by_user_id` nullable | CLI-created keys remain valid |
| 2.1.5 | `usage_events.organization_id` (+ backfill) | |
| 2.1.6 | Enforce workspace scope in all key/usage queries | |
| 2.1.7 | CLI `keys` accepts `--workspace` optional | Default workspace if omitted |
| 2.1.8 | Integration tests: two workspaces cannot read each other’s keys/usage | **Required** |
| 2.1.9 | Document tenancy ops in runbook | |

#### Acceptance criteria

- [x] Fresh install applies ordered SQL migrations + bootstrap.  
- [x] Existing `sk-aihay-…` keys still authenticate.  
- [x] Cross-tenant isolation tests pass (memory multi-workspace).  
- [x] Memory store supports multi-workspace (createWorkspace / scoped list/revoke).  
- [x] CLI `--workspace` + `keys workspaces` / `workspace-create`.  
- [x] Tag **`v0.2.1`** (package version).

---

### V2.2 — Control plane API

**Goal:** Humans can manage keys and view usage via HTTP without SQL/CLI (CLI remains).

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 2.2.1 | `FEATURE_CONTROL_PLANE` gate | |
| 2.2.2 | Human auth: register/login/logout (password **or** magic link — pick one for MVP) | argon2id if passwords |
| 2.2.3 | Session strategy: signed cookie **or** JWT access + refresh | Prefer HTTP-only cookie for web |
| 2.2.4 | Bootstrap: first user becomes org owner + default workspace | |
| 2.2.5 | Routes under `/control/v1/...` | Separate from `/v1` data plane |
| 2.2.6 | Keys API: create (return secret once), list, revoke | Authz by membership role |
| 2.2.7 | Usage API: list recent + aggregate by day/model | Use SQL aggregates; rollup table optional |
| 2.2.8 | Workspaces API: list/create (owner/admin) | |
| 2.2.9 | Members API: invite by email (DB invite row; email send can be stub/log) | |
| 2.2.10 | Audit log rows for key create/revoke | |
| 2.2.11 | OpenAPI stub or markdown endpoint list | |
| 2.2.12 | Tests: authz matrix (viewer cannot create keys, etc.) | |

#### Acceptance criteria

- [x] Data plane `/v1/*` still key-only; no session required.  
- [x] Control plane rejects API keys as auth (session cookie / separate scheme).  
- [x] Create key via control API → use key on data plane successfully.  
- [x] Role tests green (viewer cannot create keys).  
- [x] Tag **`v0.3.0`**.

#### Suggested control routes (initial)

| Method | Path |
| --- | --- |
| `POST` | `/control/v1/auth/register` |
| `POST` | `/control/v1/auth/login` |
| `POST` | `/control/v1/auth/logout` |
| `GET` | `/control/v1/me` |
| `GET/POST` | `/control/v1/workspaces` |
| `GET/POST` | `/control/v1/workspaces/:id/keys` |
| `DELETE` | `/control/v1/workspaces/:id/keys/:keyId` |
| `GET` | `/control/v1/workspaces/:id/usage` |
| `GET` | `/control/v1/workspaces/:id/usage/summary` |

---

### V2.3 — Dashboard MVP

**Goal:** Browser UX for the control plane; self-serve path for managed profile.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 2.3.1 | Scaffold `apps/web` (Next.js) in monorepo | |
| 2.3.2 | Auth pages: register/login | |
| 2.3.3 | Keys page: create/list/revoke + copy secret once UX | |
| 2.3.4 | Usage page: table + simple chart (daily tokens/cost) | |
| 2.3.5 | Env: `NEXT_PUBLIC_API_BASE` / server proxy to api | Prefer BFF proxy to avoid CORS pain |
| 2.3.6 | Compose profile `full` includes `web` | |
| 2.3.7 | E2E smoke: Playwright or scripted curl+cookie optional | At least manual checklist in runbook |
| 2.3.8 | README: managed vs gateway-only quickstarts | |

#### Acceptance criteria

- [x] New user can register → create key via dashboard (`apps/web`).  
- [x] Gateway-only profile still documented (`docker compose up` without `--profile full`).  
- [x] Secrets only shown once in UI; BFF proxies control plane (no secrets in client env).  
- [x] Tag **`v0.4.0`**.

---

### V2.4 — Budgets & aliases

**Goal:** Policy layer for cost control and virtual models.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 2.4.1 | `budget_policies` table (workspace/key scope, soft/hard, window) | |
| 2.4.2 | Redis counters + reconcile job from usage | Worker or on-request approx |
| 2.4.3 | Enforce hard budget → `429` with clear code | |
| 2.4.4 | Control API + dashboard budget form | |
| 2.4.5 | Alias registry: `aihay/cheap`, `aihay/balanced` in YAML or DB | |
| 2.4.6 | Resolve aliases before attempt plan; log `model_requested` vs `model_used` | |
| 2.4.7 | `FEATURE_ALIASES` / `FEATURE_BUDGETS` | |
| 2.4.8 | Tests: alias resolution; hard budget blocks; soft budget warns (log only) | |

#### Acceptance criteria

- [x] Alias works end-to-end with OpenAI SDK model string.  
- [x] Hard budget prevents further spend until reset/increase.  
- [x] V1 clients using canonical ids unaffected.  
- [x] Tag **`v0.4.1`**.

**Shipped:** `FEATURE_ALIASES` / `FEATURE_BUDGETS`; default aliases (`aihay/cheap|balanced|smart|fast`); `budget_policies` + memory/pg stores; hard → 429 `budget_exceeded`; soft → log warn; control `GET|PUT /workspaces/:id/budget`; alias expansion in `/v1/models` + resolve before attempt plan.

---

### V2.5 — BYOK

**Goal:** Workspace-supplied provider credentials; platform keys remain fallback.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 2.5.1 | `provider_secrets` encrypted columns | Envelope encryption; master key from env/KMS |
| 2.5.2 | Control API: put/delete secret per provider | Never return secret material after save |
| 2.5.3 | Data plane credential resolution order | BYOK → platform → fail |
| 2.5.4 | `credential_mode` on usage + completion log | |
| 2.5.5 | Dashboard BYOK settings page | |
| 2.5.6 | Audit events for secret changes | |
| 2.5.7 | Tests: BYOK used when present; fallback to platform; isolation across workspaces | |
| 2.5.8 | Runbook: rotation, loss of master key implications | |

#### Acceptance criteria

- [x] Workspace A BYOK cannot be used by workspace B.  
- [x] Removing BYOK falls back to platform if configured.  
- [x] Secrets never appear in logs/metrics.  
- [x] Tag **`v0.5.0`**.

**Shipped:** AES-256-GCM + `BYOK_MASTER_KEY`; `provider_secrets` migration 005; memory/pg stores; resolve order BYOK→platform; `credential_mode` on usage + completion logs; control `GET /providers` + `PUT|DELETE .../secret`; dashboard `/byok`; `FEATURE_BYOK` default off; runbook rotation notes.

---

### V2.6 — Credits / Stripe (optional commercial path)

**Goal:** Prepaid wallet for managed multi-tenant without requiring BYOK.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 2.6.1 | `wallets` + `ledger_entries` | Double-entry or append-only credit/debit |
| 2.6.2 | Pre-check balance (estimate) + post-debit actual cost | Idempotent on `request_id` |
| 2.6.3 | Stripe Checkout / Customer Portal integration | Webhooks → worker |
| 2.6.4 | `apps/worker` for webhooks + reconciliation | |
| 2.6.5 | Fail closed when `FEATURE_CREDITS` and balance insufficient | `402` or `429` with code `insufficient_credits` |
| 2.6.6 | Dashboard: balance + top-up |
| 2.6.7 | Tests: concurrent debit safety; webhook idempotency | |
| 2.6.8 | Legal/ops: refunds out of band initially | Document |

#### Acceptance criteria

- [x] Zero-balance workspace cannot incur platform-path inference.  
- [x] BYOK path can bypass credits if product policy says so (flag).  
- [x] Webhook replays do not double-credit.  
- [x] Tag **`v0.6.0`** (shipped with `v0.7.0` cumulative).

**Shipped:** `wallets` + `ledger_entries`; memory/pg stores; pre-check → 402 `insufficient_credits`; post-debit idempotent on `request_id`; `CREDITS_BYOK_BYPASS`; control wallet + credit; `POST /webhooks/credits` idempotent on `event_id`; dashboard `/wallet`.

---

### V2.7 — Tools / vision + providers

**Goal:** Expand API surface carefully with an explicit capability matrix.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 2.7.1 | Capability flags on registry (`supports_tools`, `supports_vision`) | |
| 2.7.2 | Relax `schemas.ts` when `FEATURE_TOOLS_VISION` and model supports | |
| 2.7.3 | OpenAI tools/vision passthrough tests | |
| 2.7.4 | Anthropic tools/vision mapping tests | Hardest |
| 2.7.5 | xAI tools/vision as provider allows | |
| 2.7.6 | Optional: Gemini or Groq adapter | Demand-driven |
| 2.7.7 | Docs: support matrix table in README/runbook | |
| 2.7.8 | Contract tests + golden fixtures for tool streams | |

#### Acceptance criteria

- [x] Unsupported combo still returns clear `400`.  
- [x] Supported tool round-trip works on ≥1 provider in CI (mock) and ≥1 live optional.  
- [x] Text-only clients unchanged.  
- [x] Tag **`v0.7.0`**.

**Shipped:** `supports_tools` / `supports_vision` on registry; `FEATURE_TOOLS_VISION`; schema gates; OpenAI tools/vision passthrough; Anthropic tool + image mapping; capability matrix in models.yaml + runbook.

---

## 9. Testing strategy (V2)

Inherit V1 rules (unit from day one; no mandatory live CI). Additions:

| Layer | V2 focus |
| --- | --- |
| Unit | Flags, alias resolve, budget math, wallet debit, encryption helpers |
| Integration | Control authz matrix; chat still works with keys; metrics scrape |
| Tenant isolation | **Mandatory** from V2.1 |
| Migration | Fresh DB applies ordered migrations |
| E2E | Dashboard path (Playwright) from V2.3 optional but recommended |
| Load (optional) | Completion log + metrics overhead &lt; noise |

**CI minimum**

1. `pnpm typecheck`  
2. `pnpm test` (no live network)  
3. Migration dry-run on ephemeral Postgres in CI (from V2.1)  
4. Lint when configured  

---

## 10. Definition of Done

### 10.1 Program-level “V2 complete” (all phases)

- [ ] V2.0–V2.3 done (observability + tenancy + control API + dashboard)  
- [ ] At least one of V2.4 budgets/aliases **or** V2.5 BYOK **or** V2.6 credits shipped to match business choice  
- [ ] Gateway profile (API without web) still green  
- [ ] Cross-tenant tests green  
- [ ] Runbook updated for full profile  
- [ ] No smart-router scope creep  

### 10.2 Per-phase DoD (apply every phase)

- [ ] Feature flag documented  
- [ ] Unit/integration tests for new behavior  
- [ ] Backward compatible data plane  
- [ ] Runbook/README delta  
- [ ] Tag cut  

---

## 11. Suggested first PR sequence (V2.0 → V2.3)

| PR | Content |
| --- | --- |
| PR1 | `RequestCompleteEvent` + emit on chat paths |
| PR2 | Prometheus `/metrics` + core instruments |
| PR3 | Logger base fields + runbook observability section |
| PR4 | Migration framework + V2.1 tenant tables + backfill |
| PR5 | Workspace-scoped queries + isolation tests |
| PR6 | Control auth register/login/session |
| PR7 | Control keys + usage APIs |
| PR8 | `apps/web` scaffold + auth pages |
| PR9 | Keys + usage UI |
| PR10 | Compose `full` profile + docs |

Then branch for V2.4 / V2.5 / V2.6 by product priority.

---

## 12. Risks & mitigations (execution)

| Risk | Mitigation |
| --- | --- |
| Tenancy before observability | **V2.0 first** — production pain is blindness |
| Dashboard before APIs | Control API (V2.2) before UI (V2.3) |
| Credits before metering trust | Credits only after usage accuracy confidence |
| BYOK crypto mistakes | Minimal API surface; security review; never log secrets |
| Migration footguns | Expand/contract migrations; backup instructions |
| Flag matrix explosion | Default off; test critical pairs only |
| Scope creep to auto-router | Explicit V3; reject in review |
| Hot path regression | Benchmark smoke; no session DB on `/v1/chat` |

---

## 13. Dependencies & prerequisites

| Prerequisite | Owner |
| --- | --- |
| V1 gateway stable on Compose | Eng (current) |
| Product pick: password vs magic link | Product (before V2.2) |
| Product pick: credits vs BYOK priority | Product (before V2.5/V2.6) |
| Stripe account (if credits) | Business |
| Domain + TLS for full profile | Ops |
| KMS or master key management (BYOK) | Ops |

Still open (do not block V2.0):

- Managed cloud GTM  
- OSS license  
- OIDC provider choice  
- Exact alias catalog  

---

## 14. Documentation deliverables (V2)

| Doc | When |
| --- | --- |
| Runbook observability + alerts | V2.0 |
| Runbook (current ops) | Always |
| Control API reference | V2.2 |
| Dashboard user guide (short) | V2.3 |
| BYOK security notes | V2.5 |
| Billing ops notes | V2.6 |
| Capability matrix (tools/vision) | V2.7 |
| Implementation Plan V3 (smart routing) | After V2 eval story exists |

---

## 15. Explicit non-goals reminder

- No mid-stream model switch  
- No prompt storage by default  
- No requiring signup for gateway-only  
- No 100 providers  
- No preference-model auto router in V2  

---

## 16. Summary

**Implementation Plan V2** productizes AI Hay **on top of** the working V1 gateway:

| Order | Why |
| --- | --- |
| **V2.0 Observability** | See production before adding surface area |
| **V2.1 Tenancy** | Data model for multi-player |
| **V2.2 Control API** | Machine-usable admin surface |
| **V2.3 Dashboard** | Human self-serve |
| **V2.4–V2.7** | Budgets/aliases, BYOK, credits, tools — by business priority |

**Current:** all phases through V2.7 shipped at tag **`v0.7.0`**. Operate via [Runbook](../runbook.md) and [README](../../README.md).

---

*Implementation plan V2 — living document. Update estimates and checkboxes as phases complete; spawn Implementation Plan V3 only when smart routing has an eval design.*
