# AI Hay Router — Implementation Plan (V3)

| Field | Value |
| --- | --- |
| **Product** | AI Hay Router |
| **Document type** | Implementation plan (V3 program) |
| **Status** | **In progress / largely implemented** in tree (`v0.8.0` target) |
| **Last updated** | 2026-08-07 |
| **Baseline** | Shipped product **`v0.7.0`** ([Implementation Plan V2](./implementation-plan-v2.md) complete) |
| **Source backlog** | [V3 TODO](./v3_todo.md) |
| **Related** | [Architecture](./architecture-v2.md) · [Runbook](../runbook.md) · [Scalability](./scalability.md) · [README](../../README.md) |
| **Code** | `apps/api` + `apps/web` (+ Compose / `deploy/`) |
| **Goal** | Platform admin, ops stack (Prometheus/Grafana), tenant UX polish, detailed token metering — **without** smart/auto routing |

This plan turns [v3_todo.md](./v3_todo.md) into **ordered, demoable phases** with tasks, acceptance criteria, testing expectations, and a definition of done.

**Explicitly excluded from this plan:** smart / auto routing (`aihay/auto`, preference models, eval-linked routing). That remains lowest-priority backlog in v3_todo only — not a V3 program DoD item.

---

## 1. North star (what “V3 program done” means)

When this plan is complete for a typical production profile, operators and tenants can:

1. **Operate the fleet** with Prometheus scraping `GET /metrics` and Grafana dashboards/alerts via Compose (no log-grep required for basic health).  
2. **Administer the whole system** as a platform admin (tenants, keys force-revoke, global usage, wallets/budgets overview, audit) without being a member of every workspace.  
3. **Onboard tenants faster** with Keys usage guide + Models catalog in the dashboard.  
4. **Meter accurately** with multi-type token breakdown (cache, reasoning, multimodal, …) in ledger, cost, usage UI, and client `usage` pass-through where available.  
5. Keep **gateway-only** and **tenant full** profiles working without requiring observability or admin UI.

### 1.1 Success metrics (directional)

| Metric | Target |
| --- | --- |
| OpenAI wire compatibility | Unbroken `POST /v1/chat/completions` / `GET /v1/models` |
| Stream-through | No full-stream buffer; no mid-stream model switch |
| Ops time-to-insight | Grafana answers “API healthy?” / “which provider failing?” without shell |
| Admin isolation | Tenant session **cannot** call `/admin/*` or platform-admin APIs |
| Catalog parity | Dashboard Models matches `GET /v1/models` for same flags |
| Token detail | Cache/reasoning (when provider sends them) stored + visible; coarse path still works |
| Hot path | No session/admin DB on chat path; metrics scrape stays cheap |

---

## 2. Relationship to shipped V2 (`v0.7.0`)

| Shipped (V2 / current) | This plan (V3 program) |
| --- | --- |
| Data plane + adapters + aliases/budgets/BYOK/credits/tools | Unchanged contracts; metering depth expands |
| `GET /metrics` + `request_complete` | + Prometheus + Grafana Compose profile + dashboards |
| Tenant control plane + thin dashboard | + Keys guide, Models page, richer Usage, more polish |
| Workspace roles only | + `platform_admin` + `/admin/v1` (or equivalent) |
| Coarse prompt/completion tokens | + normalized multi-type breakdown |
| No platform console | + admin UI shell |

**Hard compatibility rules (carry forward)**

- Do not break OpenAI Chat Completions shapes.  
- Do not buffer entire streams.  
- Do not mid-stream switch models.  
- Do not require signup for gateway-only self-host.  
- Do not put platform-admin or Grafana auth on the chat hot path.  
- Do not require observability profile for data plane to run.

---

## 3. Scope lock

### 3.1 In scope

| Area | Deliverable |
| --- | --- |
| Ops stack | Compose `observability` profile: Prometheus + Grafana; scrape API metrics; starter dashboard + alert notes |
| Platform admin API | Role, bootstrap, session guard, global tenants/keys/usage/wallets/budgets/audit |
| Platform admin UI | `/admin` (or `apps/admin`) shell: Tenants · Usage · Health · Keys · Wallets · Audit |
| Tenant dashboard | Keys “how to use” guide; Models page; usage breakdown UI; optional members/budgets/Stripe/playground later in phase |
| Metering | Normalized token types; provider parsers; migration; cost; budgets/credits policy; pass-through usage |
| Docs | Runbook + README for observability profile and admin bootstrap |
| Tests | Authz isolation (tenant vs admin); token-detail fixtures; Compose smoke for scrape |

### 3.2 Out of scope (this plan)

| Item | Notes |
| --- | --- |
| **Smart / auto routing** | Explicitly **excluded** — remains in [v3_todo](./v3_todo.md) Priority 4 only |
| Full custom metrics product in Next.js | Thin health + Grafana links only |
| Multi-region active-active | See scalability.md later |
| Full enterprise SAML suite | Optional later; session + platform_admin first |
| Mid-stream failover | Never |
| Replacing Cloudflare / edge monitoring | Origin gateway only |

### 3.3 Decisions locked for this plan

| Decision | Choice |
| --- | --- |
| Primary ops UI | **Grafana** (Prometheus scrape of existing `/metrics`) |
| Compose profile name | **`observability`** (optional; not required for `full` or gateway) |
| Admin API prefix | **`/admin/v1/*`** on `apps/api` (separate from `/control/v1` tenant plane) |
| Admin auth | Same session cookie family **or** dedicated platform session; **role check** mandatory |
| Platform role name | **`platform_admin`** |
| Bootstrap first admin | Env allowlist email and/or one-time CLI (`pnpm admin bootstrap`) |
| Token breakdown storage | Prefer **JSON breakdown column** + keep prompt/completion totals for compatibility |
| Admin UI location | Prefer **`apps/web` routes under `/admin`** first; split `apps/admin` only if needed |
| Smart routing | **Not scheduled** in any phase of this document |

### 3.4 Deployment profiles (extended)

| Profile | Services | Typical use |
| --- | --- | --- |
| **default / gateway** | api, postgres, redis | Data plane |
| **full** | + web | Tenant dashboard |
| **observability** | + prometheus, grafana | Ops (combine: `full,observability`) |
| **admin** | full (+ observability recommended) | Platform admin enabled in config |

---

## 4. Feature flags / config (additions)

| Env / config | Default | Unlocks |
| --- | --- | --- |
| `FEATURE_METRICS` | `true` (existing) | Required for Prometheus scrape |
| `FEATURE_PLATFORM_ADMIN` | `false` | `/admin/v1/*` + admin UI routes |
| `PLATFORM_ADMIN_BOOTSTRAP_EMAIL` | empty | First user with this email becomes platform_admin on register/login (optional) |
| `GRAFANA_URL` | empty | Deep link from admin Health page |
| `PUBLIC_API_BASE_URL` | empty | Keys page examples (`https://api.example.com/v1`) |

Existing commercial/tenant flags unchanged.

---

## 5. Stack / layout additions

```text
ai-hay-router/
  apps/
    api/                    # + /admin/v1, token breakdown metering
    web/                    # + /admin/*, /models, Keys guide, usage detail
  deploy/
    prometheus/
      prometheus.yml
    grafana/
      provisioning/
      dashboards/
  docker-compose.yml        # + profile observability
  docs/design/
    implementation-plan-v3.md   # this file
    v3_todo.md                  # backlog source (smart routing stays there only)
```

---

## 6. Phased plan overview

| Phase | Name | Est. (1 eng) | Depends on | Tag (suggest) |
| --- | --- | --- | --- | --- |
| **V3.0** | Observability Compose (Prometheus + Grafana) | 2–4 days | `v0.7.0` | `v0.8.0` |
| **V3.1** | Platform admin API foundation | 5–8 days | V3.0 optional | `v0.9.0` |
| **V3.2** | Platform admin UI + global ops surfaces | 1–2 weeks | V3.1 | `v0.10.0` |
| **V3.3** | Tenant polish: Keys guide + Models page | 3–5 days | web exists | `v0.10.1` |
| **V3.4** | Detailed token usage types | 5–10 days | metering solid | `v0.11.0` |
| **V3.5** | Further tenant polish (optional track) | 1–2 weeks | V3.3+ | `v0.12.0` |

**Recommended start:** **V3.0** (cheap win, unblocks ops).  
**Critical path for “managed multi-tenant ops”:** V3.1 → V3.2.  
**Critical path for “better self-serve tenants”:** V3.3 → V3.4.  
**V3.0 can parallelize** with V3.3.

**Not in table:** Smart / auto routing.

---

## 7. Phase detail

### V3.0 — Observability Compose (Prometheus + Grafana)

**Goal:** First-class scrape + dashboards without building a custom metrics product.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 3.0.1 | Add `prometheus` service (Compose profile `observability`) | Scrape `http://api:3000/metrics` |
| 3.0.2 | Add `grafana` service | Provision Prometheus datasource; volume for data |
| 3.0.3 | In-repo config: `deploy/prometheus/prometheus.yml` | Interval, job `aihay-api` |
| 3.0.4 | Grafana provisioning + starter dashboard JSON | Rate, 4xx/5xx, p50/p95, upstream attempts, TTFT, tokens, enqueue failures |
| 3.0.5 | Document ports (e.g. Prometheus `9090`, Grafana `3002`) | Avoid clash with API `:3000` / web `:3001` |
| 3.0.6 | Runbook + README: start command, default Grafana login, “don’t tunnel metrics publicly” | |
| 3.0.7 | Optional: blackbox or scrape-fail alert notes | Runbook table is enough for v1 of phase |
| 3.0.8 | Smoke: compose up → Prometheus targets UP → Grafana panel data after traffic | |

#### Acceptance criteria

- [ ] `docker compose --profile observability up -d` starts Prometheus + Grafana.  
- [ ] Prometheus target for API is **UP** when API is healthy and `FEATURE_METRICS=true`.  
- [ ] Grafana datasource works; starter dashboard shows series after sample chat traffic.  
- [ ] Gateway/full profiles still run **without** observability profile.  
- [ ] Tag **`v0.8.0`**.

---

### V3.1 — Platform admin API foundation

**Goal:** Machine-usable admin plane; tenants cannot access it.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 3.1.1 | `platform_admin` flag/role on users (migration) | Separate from workspace membership |
| 3.1.2 | Bootstrap: env email allowlist and/or CLI | One trusted operator |
| 3.1.3 | Middleware: session + platform_admin for `/admin/v1/*` | Reject API keys; reject non-admins with 403 |
| 3.1.4 | List orgs / workspaces / users (pagination, search) | |
| 3.1.5 | Suspend / reinstate workspace or org | Data plane rejects suspended workspace keys |
| 3.1.6 | Force-revoke keys by workspace or prefix | Audited |
| 3.1.7 | Global usage query / rollups | By org, workspace, model, provider |
| 3.1.8 | Global wallet inspect + admin credit/debit | Idempotent; reason required |
| 3.1.9 | Budget inspect/override | Reuse budget store |
| 3.1.10 | BYOK status list (configured yes/no, hint only) | Never return secrets |
| 3.1.11 | Feature-flag / config overview (read-only first) | |
| 3.1.12 | Global audit list + write audit for every admin mutation | |
| 3.1.13 | Tests: tenant cannot access admin; admin can list all workspaces | **Mandatory isolation** |
| 3.1.14 | `FEATURE_PLATFORM_ADMIN` gate + runbook bootstrap | |

#### Acceptance criteria

- [ ] Platform admin can list all workspaces without membership.  
- [ ] Tenant user receives **403** on all `/admin/v1/*`.  
- [ ] Force-revoke is audited and effective on data plane immediately.  
- [ ] Tag **`v0.9.0`**.

---

### V3.2 — Platform admin UI + thin health

**Goal:** Human console for V3.1 APIs; Grafana remains deep metrics.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 3.2.1 | Admin route shell (`/admin` or host split) | Nav: Tenants · Usage · Health · Keys · Wallets · Audit · Settings |
| 3.2.2 | Tenants list UI (orgs/workspaces/users) | Search, pagination |
| 3.2.3 | Suspend / reinstate + force-revoke key actions | Confirm dialogs |
| 3.2.4 | Global usage views | Tables + simple filters; export CSV stretch |
| 3.2.5 | Wallets / budgets admin screens | Credit with reason |
| 3.2.6 | Audit stream UI | Filter by actor/action |
| 3.2.7 | Health page: API `/ready` + link `GRAFANA_URL` | Optional 3–5 KPI tiles only |
| 3.2.8 | Empty states, loading, error banners | Match tenant UI quality |
| 3.2.9 | E2E or integration: admin login path smoke | |

#### Acceptance criteria

- [ ] Admin can perform revoke/suspend from UI with audit entry.  
- [ ] Non-admin visiting `/admin` is denied or redirected.  
- [ ] Health page does not reimplement Grafana explorers.  
- [ ] Tag **`v0.10.0`**.

---

### V3.3 — Tenant polish: Keys guide + Models page

**Goal:** Self-serve first-call success without external docs.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 3.3.1 | Keys page: Quick start + post-create guide | Base URL from `PUBLIC_API_BASE_URL` |
| 3.3.2 | Document Bearer auth; one-time secret note | |
| 3.3.3 | Copy-paste curl (`/v1/models`, chat) + OpenAI SDK snippet | Copy buttons |
| 3.3.4 | Link to runbook (optional) | |
| 3.3.5 | Models page `/models` + nav | Session auth only |
| 3.3.6 | List aliases + canonical models (parity with `GET /v1/models`) | Prefer control or public catalog endpoint that does not need sk- key |
| 3.3.7 | Show provider / resolves_to; capability hints if available | May extend API beyond OpenAI list shape |
| 3.3.8 | Copy model id | |
| 3.3.9 | Cross-link Keys guide ↔ Models | |

#### Catalog API note

Dashboard must not force users to paste `sk-aihay-…` to list models. Options:

- Session-authenticated `GET /control/v1/models` (or `/admin` not required) that reuses registry + flags; or  
- Unauthenticated public `GET /v1/models` is already API-key protected today — **prefer new control catalog** for session.

#### Acceptance criteria

- [ ] New user can create a key and complete first chat using only Keys page guide.  
- [ ] Logged-in user sees full active catalog + aliases without a data-plane API key.  
- [ ] Catalog matches data-plane model list for same feature flags.  
- [ ] Tag **`v0.10.1`**.

---

### V3.4 — Detailed token usage types

**Goal:** Normalized multi-type tokens for cost, budgets, usage UI, and client pass-through.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 3.4.1 | Define normalized breakdown schema | input, output, cached_input, reasoning, image, audio, tool, total |
| 3.4.2 | Provider parsers (OpenAI details, Anthropic cache/extended, xAI) | Unknown fields ignored |
| 3.4.3 | Migration: store breakdown (JSON ± columns); keep prompt/completion totals | |
| 3.4.4 | `request_complete` + metrics (avoid high-cardinality labels) | |
| 3.4.5 | Cost estimator uses token classes when prices differ | Registry price tiers if needed |
| 3.4.6 | Document budgets/credits: billable vs raw totals | |
| 3.4.7 | Control usage API returns breakdown | |
| 3.4.8 | Tenant Usage UI columns / drill-down | |
| 3.4.9 | Pass-through richer OpenAI-compatible `usage` to clients | Don’t strip detail |
| 3.4.10 | Unit tests with provider fixtures | |

#### Acceptance criteria

- [ ] Completion with cache/reasoning details stores and shows them.  
- [ ] Prompt+completion-only providers still work (zeros/null extras).  
- [ ] Cost uses breakdown when token classes have different rates.  
- [ ] Tag **`v0.11.0`**.

---

### V3.5 — Further tenant polish (optional track)

**Goal:** Close remaining tenant self-serve gaps from v3_todo §3.4. Prioritize by product demand; not all required for “V3 program minimum.”

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 3.5.1 | Budgets form in dashboard | Wraps existing control budget API |
| 3.5.2 | Members / invites UI | |
| 3.5.3 | Workspace audit page (tenant-scoped) | |
| 3.5.4 | Workspace switcher | |
| 3.5.5 | Stripe Checkout (or equivalent) top-up | Builds on credits webhook |
| 3.5.6 | Chat playground (optional) | |
| 3.5.7 | Additional providers on demand | Gemini, Groq, … |
| 3.5.8 | Embeddings API (if product asks) | |
| 3.5.9 | Semantic cache (flagged, off by default) | Isolation + correctness first |

#### Acceptance criteria

- [ ] Each shipped item has flag/docs/tests as applicable.  
- [ ] Tag **`v0.12.0`** when a meaningful bundle ships (not every checkbox required).

---

## 8. Testing strategy

| Layer | Focus |
| --- | --- |
| Unit | Token breakdown parsers; admin role checks; catalog mapping |
| Integration | `/admin/v1` 403 for tenants; force-revoke; usage breakdown persistence |
| Compose | Observability profile: Prometheus target UP |
| Regression | Chat stream path unchanged; gateway-only without admin/observability |
| Optional E2E | Admin shell + Keys guide smoke |

**CI minimum**

1. `pnpm typecheck`  
2. `pnpm test`  
3. No mandatory live provider keys  

---

## 9. Definition of Done

### 9.1 Program-level (“V3 plan complete” minimum)

- [ ] **V3.0** shipped (Prometheus + Grafana Compose profile + docs)  
- [ ] **V3.1 + V3.2** shipped (platform admin API + UI with isolation tests)  
- [ ] **V3.3** shipped (Keys guide + Models page)  
- [ ] **V3.4** shipped (detailed token usage)  
- [ ] **V3.5** optional — track separately by demand  
- [ ] **Smart / auto routing not required** and not started under this plan  
- [ ] Runbook updated for observability + admin bootstrap  
- [ ] Data plane OpenAI compatibility + stream-through preserved  

### 9.2 Per-phase DoD

- [ ] Feature flags / config documented  
- [ ] Tests for new security and metering behavior  
- [ ] Backward compatible data plane  
- [ ] Runbook/README delta  
- [ ] Version tag cut  

---

## 10. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Admin API becomes second control plane mess | Strict `/admin/v1` vs `/control/v1` split; shared stores only |
| Grafana ignored / never deployed | V3.0 first; document profile; don’t block gateway |
| Token breakdown schema churn | JSON breakdown + stable totals; version field |
| Cost wrong with new token classes | Explicit billable rules; tests with fixtures |
| Scope creep to auto-router | **Excluded** from this plan; reject in review |
| Hot path regression | No admin session on `/v1/chat`; benchmark smoke if needed |

---

## 11. PR / delivery sequencing (suggested)

| Order | Work |
| --- | --- |
| PR1 | Compose observability profile + prometheus.yml |
| PR2 | Grafana provisioning + starter dashboard + docs |
| PR3 | platform_admin migration + bootstrap + middleware |
| PR4 | Admin list/suspend/revoke/usage APIs + isolation tests |
| PR5 | Admin wallets/budgets/audit APIs |
| PR6 | Admin UI shell + tenants + revoke |
| PR7 | Admin usage/wallets/audit/health pages |
| PR8 | Keys usage guide + PUBLIC_API_BASE_URL |
| PR9 | Models catalog endpoint + Models page |
| PR10 | Token breakdown schema + parsers + migration |
| PR11 | Cost + usage API/UI + pass-through + tests |
| PR12+ | V3.5 items by demand |

---

## 12. Documentation deliverables

| Doc | When |
| --- | --- |
| Runbook: observability profile, ports, Grafana login, scrape | V3.0 |
| Runbook: platform admin bootstrap + security | V3.1 |
| Short admin user guide | V3.2 |
| Keys guide is **in-product** (this plan’s DoD) | V3.3 |
| Token types + billable cost notes | V3.4 |
| Update [v3_todo](./v3_todo.md) checkboxes as phases complete | Continuous |

---

## 13. Explicit non-goals reminder

- No smart/auto routing / `aihay/auto` learning in this plan  
- No mid-stream model switch  
- No prompt storage by default  
- No requiring observability or admin for gateway-only  
- No rebuilding Grafana inside Next.js  

---

## 14. Summary

| Order | Why |
| --- | --- |
| **V3.0 Observability Compose** | Fastest path to real ops visibility |
| **V3.1–V3.2 Platform admin** | Whole-system manageability |
| **V3.3 Keys + Models** | Tenant time-to-first-success |
| **V3.4 Token detail** | Correct cost/usage as providers get richer |
| **V3.5 Optional polish** | Demand-driven |
| **Smart routing** | **Out of plan** — stay on v3_todo lowest priority only |

**Start here:** Phase **V3.0** tasks 3.0.1–3.0.8 → tag `v0.8.0`.

**Source of truth for deferred ideas:** [v3_todo.md](./v3_todo.md) (including smart routing, not scheduled here).
