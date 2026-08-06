# AI Hay Router — V3 TODO

| Field | Value |
| --- | --- |
| **Product** | AI Hay Router |
| **Document type** | Forward backlog (V3) |
| **Status** | Open — not scheduled |
| **Baseline** | Shipped product **`v0.7.0`** (gateway + tenant control plane + thin dashboard) |
| **Last updated** | 2026-08-06 (Keys guide + Models page backlog) |
| **Related** | [Runbook](../runbook.md) · [Architecture](./architecture-v2.md) · [README](../../README.md) |

Work **not** in the current product surface. Order below is intentional priority for planning; nothing here is committed until an implementation plan is cut.

---

## Priority 1 — Platform administrator UI (system-wide)

**Gap:** Today only a **tenant** dashboard exists (keys / usage / BYOK / wallet per workspace). There is **no** superuser console to manage and monitor the **whole** deployment.

### 1.1 Platform admin identity & access

- [ ] Define `platform_admin` (or equivalent) role, separate from workspace roles  
- [ ] Bootstrap / invite first platform admin (env bootstrap or one-time CLI)  
- [ ] Guard all admin APIs: session + role check; never accept tenant API keys  
- [ ] Audit every admin mutation  

### 1.2 Tenant & identity management (global)

- [ ] List organizations, workspaces, users (search, pagination, filters)  
- [ ] Suspend / reinstate org or workspace  
- [ ] Force-revoke API keys across a workspace or by prefix (admin)  
- [ ] View memberships / roles; optional force-remove member  
- [ ] Global audit stream (all workspaces, filter by actor / action)  

### 1.3 Commercial / limits (global)

- [ ] Cross-tenant usage and cost rollups (by org, workspace, model, provider)  
- [ ] Inspect and override workspace budgets  
- [ ] Inspect wallets; admin credit / debit with reason + idempotency  
- [ ] BYOK configuration status per workspace (never show secret material)  
- [ ] Feature-flag / policy overview (read-only or controlled write)  

### 1.4 Admin UI shell (`apps/web` or `apps/admin`)

- [ ] Separate route prefix and/or host (`/admin` or `admin.` subdomain)  
- [ ] Nav: Tenants · Usage · Health · Keys · Wallets · Audit · Settings  
- [ ] Empty states, pagination, export CSV for usage  

**Acceptance (draft)**

- [ ] Platform admin can list all workspaces without being a member of each  
- [ ] Tenant user **cannot** access any `/admin` or platform-admin API  
- [ ] Admin force-revoke is audited and effective on data plane immediately  

---

## Priority 2 — System monitoring & ops UI

**Gap:** Ops today is raw `GET /metrics` + JSON logs + SQL. No in-product board for health of the gateway fleet.

### 2.1 Live ops board

- [ ] Request rate, error rate (4xx/5xx), p50/p95 latency from Prometheus series  
- [ ] Upstream provider health: attempts by `provider` × `result` (success / retriable / error / missing_credential)  
- [ ] TTFT and token throughput sparklines  
- [ ] Usage enqueue failure counter / metering health  
- [ ] Instance list / readiness if multi-replica  

### 2.2 Telemetry plumbing (as needed)

- [ ] Document Grafana starter dashboard (optional, file-based)  
- [ ] Optional admin UI that scrapes or queries metrics (or embeds Grafana)  
- [ ] Log search UX for `request_complete` by `request_id` / workspace (if log backend exists)  
- [ ] Suggested alert rules shipped as code (runbook-aligned)  

### 2.3 Provider / registry ops

- [ ] Model registry viewer (capability matrix: tools / vision / prices)  
- [ ] Alias map viewer  
- [ ] Optional hot-reload or admin edit of non-secret registry fields  

**Acceptance (draft)**

- [ ] Operator can answer “is the gateway healthy?” without shell access  
- [ ] Operator can see which provider is failing without grepping logs  

---

## Priority 3 — Smart / auto routing (classic V3)

Deferred product: learned or eval-linked routing. Do **not** start until metering + admin observability are trustworthy.

- [ ] Eval harness and offline datasets  
- [ ] Rules engine expansion (beyond static aliases)  
- [ ] Optional classifier / preference model path (async or tiny side path)  
- [ ] `aihay/auto` virtual model with explicit policy docs  
- [ ] No mid-stream switch; hold stream-through laws  
- [ ] Cost/latency tradeoff policies per workspace  
- [ ] Scalability review (routing CPU off hot path) — see [scalability.md](./scalability.md)  

---

## Priority 4 — Product polish (after admin baseline)

### 4.1 API Keys page — “How to use your API key” guide

**Gap:** Dashboard `/keys` can create/revoke keys but does not explain how to call the gateway.

- [ ] On **API Keys** page, add an in-UI usage guide (collapsible panel or callout after create + always visible “Quick start”)  
- [ ] Show **base URL** for this deployment (e.g. `https://api.ericvn.dev/v1` or env-derived public URL)  
- [ ] Document auth header: `Authorization: Bearer sk-aihay-…`  
- [ ] Copy-paste **curl** example (`/v1/models`, `/v1/chat/completions`)  
- [ ] Copy-paste **OpenAI SDK** snippet (`baseURL` + `apiKey`)  
- [ ] Note: secret shown **once** at create; revoke if lost  
- [ ] Optional: one-click copy for base URL / examples  
- [ ] Optional: link to full runbook from the guide  

**Acceptance (draft)**

- [ ] New user can create a key and complete a first successful chat call using only the Keys page guide (no external docs required)  

### 4.2 Models page — list available models for API keys

**Gap:** Dashboard has no catalog of models clients can call with workspace API keys; users must hit `GET /v1/models` or read docs.

- [ ] Add dashboard **Models** page (`/models`) in nav (Keys · Models · Usage · …)  
- [ ] List all models available to data-plane API keys (same surface as `GET /v1/models`)  
- [ ] Show **aliases** (`aihay/*`) with `resolves_to` / root target  
- [ ] Show **canonical** models with provider / `owned_by`  
- [ ] Display capability hints when available (tools, vision, streaming) — may need richer control or public catalog API beyond OpenAI list shape  
- [ ] Copy model id for use in `model:` field  
- [ ] Short note: use with Bearer API key against data plane base URL (cross-link Keys page guide)  
- [ ] Auth: session-only for dashboard; do not require a user to paste their `sk-aihay-…` to view the catalog  

**Acceptance (draft)**

- [ ] Logged-in user can open Models and see every active registry id + alias without calling the data plane with an API key  
- [ ] Catalog matches `GET /v1/models` for the same deployment flags (e.g. aliases on/off)  

### 4.3 Other tenant UI polish

- [ ] Tenant UI: budgets form, members/invites, audit page, workspace switcher  
- [ ] Stripe Checkout (or equivalent) for self-serve credit top-up  
- [ ] Chat playground in dashboard (optional)  
- [ ] Additional providers on demand (Gemini, Groq, …)  
- [ ] Embeddings API (if product asks)  
- [ ] Semantic cache (flagged; off by default)  

---

## Explicit non-goals (still)

- Mid-stream model failover after first SSE byte  
- Storing prompts by default  
- Requiring signup for pure gateway-only self-host  
- Shipping auto-router without eval story  

---

## Suggested next planning step

1. Turn **Priority 1 + 2** into `docs/design/architecture-v3-admin.md` (or expand this file) with API sketch:  
   `GET/POST /admin/v1/...`  
2. Then `implementation-plan-v3.md` with phases (e.g. **V3.0 Admin API**, **V3.1 Admin UI**, **V3.2 Ops board**, **V3.x Smart routing**).  

Until then, whole-system ops remains: **Prometheus `/metrics` + logs + SQL + runbook** (see [Runbook](../runbook.md)).
