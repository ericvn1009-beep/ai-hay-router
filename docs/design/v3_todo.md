# AI Hay Router — V3 TODO

| Field | Value |
| --- | --- |
| **Product** | AI Hay Router |
| **Document type** | Forward backlog (V3) |
| **Status** | Open — not scheduled |
| **Baseline** | Shipped product **`v0.7.0`** (gateway + tenant control plane + thin dashboard) |
| **Last updated** | 2026-08-06 (detailed token usage types) |
| **Related** | [Runbook](../runbook.md) · [Architecture](./architecture-v2.md) · [README](../../README.md) |

Work **not** in the current product surface. Order below is intentional priority for planning; nothing here is committed until an implementation plan is cut.

**Priority order (highest → lowest):** platform admin → ops monitor → product polish → **smart / auto routing last**.

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

**Gap:** Ops today is raw `GET /metrics` + JSON logs + SQL. No first-class board for fleet health.

**Approach (decided):** use **Prometheus + Grafana in Docker Compose** as the primary ops path (not a full custom chart product inside admin UI). Optional thin admin “health” strip / deep-links later; tenant Usage stays separate.

### 2.1 Docker Compose — Prometheus + Grafana

Add observability services (prefer a Compose **profile**, e.g. `observability`, so default gateway stays light):

- [ ] **`prometheus` container** — scrape AI Hay `GET /metrics` (service discovery: `http://api:3000/metrics`)  
- [ ] **`grafana` container** — provision Prometheus datasource; persist dashboards volume  
- [ ] Config files in-repo (e.g. `deploy/prometheus/prometheus.yml`, `deploy/grafana/…`)  
- [ ] Document ports (typical: Prometheus `:9090`, Grafana `:3002` or `:3000` only if not conflicting with API)  
- [ ] Document start: `docker compose --profile observability up -d` (and combine with `full` when needed)  
- [ ] Keep `FEATURE_METRICS=true` on API; do not expose Prometheus/Grafana on public tunnels by default  
- [ ] Update runbook / README with scrape target, login (Grafana default admin), and “protect metrics at edge”  

### 2.2 Grafana dashboards & alerts (on top of Compose)

- [ ] Starter dashboard JSON: request rate, error rate (4xx/5xx), p50/p95 latency  
- [ ] Upstream provider health: `aihay_upstream_attempts_total{provider,result}`  
- [ ] TTFT (`aihay_ttft_ms`) and token throughput (`aihay_tokens_total`)  
- [ ] Metering health: `aihay_usage_enqueue_failures_total`  
- [ ] Suggested Grafana/Alertmanager alert rules (API down via blackbox or scrape fail; high 5xx; enqueue failures)  
- [ ] Multi-replica note: scrape all API instances when scaled  

### 2.3 Admin UI (thin — not a Grafana replacement)

- [ ] Optional platform-admin **Health** page: `/ready` status + link “Open Grafana”  
- [ ] Optional 3–5 summary KPIs only if needed for non-SRE admins  
- [ ] Do **not** rebuild multi-range explorers / alert rule UIs in Next.js  

### 2.4 Provider / registry ops (optional)

- [ ] Model registry viewer (capability matrix: tools / vision / prices)  
- [ ] Alias map viewer  
- [ ] Optional hot-reload or admin edit of non-secret registry fields  

### 2.5 Logs (later)

- [ ] Log search UX for `request_complete` by `request_id` / workspace (if log backend exists)  

**Acceptance (draft)**

- [ ] `docker compose --profile observability up` brings up Prometheus scraping the API and Grafana with a working datasource  
- [ ] Operator can answer “is the gateway healthy?” and “which provider is failing?” from Grafana without grepping logs  
- [ ] Prometheus/Grafana are not required for gateway-only or tenant dashboard profiles 

---

## Priority 3 — Product polish (tenant dashboard & commercial UX)

### 3.1 API Keys page — “How to use your API key” guide

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

### 3.2 Models page — list available models for API keys

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

### 3.3 Detailed token usage types (metering + API + UI)

**Gap:** Ledger and metrics only store coarse **prompt_tokens** + **completion_tokens**. Providers increasingly return richer usage (cache, reasoning, audio, image, tool, etc.). Cost and budgets stay inaccurate without a breakdown.

**Today:** `usage_events.prompt_tokens` / `completion_tokens`; Prometheus `aihay_tokens_total{direction=prompt|completion}`.

- [ ] Define a **normalized usage breakdown** model (provider-agnostic), e.g.:  
  - input / output (existing)  
  - **cached_input** (prompt cache read/write if reported)  
  - **reasoning** / “thinking” output tokens  
  - **image** / multimodal input tokens (when counted separately)  
  - **audio** input/output (if ever supported)  
  - **tool** / function-related tokens if exposed  
  - **total** (canonical sum; never double-count)  
- [ ] Parse provider-specific usage shapes (OpenAI `prompt_tokens_details` / `completion_tokens_details`, Anthropic cache + extended fields, xAI equivalents) into the normalized model  
- [ ] Persist breakdown on **usage_events** (JSON column and/or explicit columns; migration)  
- [ ] Emit richer **request_complete** fields and Prometheus labels/series (without label cardinality explosion)  
- [ ] Cost estimator: price **cached** vs uncached input; reasoning/output rates when registry has tiers  
- [ ] Budgets / credits: document whether hard caps use **billable total** or raw total tokens  
- [ ] Control API + tenant **Usage** UI: show breakdown columns / drill-down per request  
- [ ] Platform admin / Grafana: optional rollups by token type  
- [ ] Pass-through OpenAI-compatible `usage` object to clients when possible (don’t strip detail)  
- [ ] Tests: fixtures per provider for detailed usage; unknown fields ignored safely  

**Acceptance (draft)**

- [ ] A completion that returns cache/reasoning details stores them and shows them in usage API/UI  
- [ ] Models that only return prompt+completion keep working (null/zero extras)  
- [ ] Cost estimate uses breakdown when prices differ by token class  

### 3.4 Other tenant UI polish

- [ ] Tenant UI: budgets form, members/invites, audit page, workspace switcher  
- [ ] Stripe Checkout (or equivalent) for self-serve credit top-up  
- [ ] Chat playground in dashboard (optional)  
- [ ] Additional providers on demand (Gemini, Groq, …)  
- [ ] Embeddings API (if product asks)  
- [ ] Semantic cache (flagged; off by default)  

---

## Priority 4 — Smart / auto routing (**lowest**)

Deferred product: learned or eval-linked routing. **Last** after admin, ops, and tenant polish. Do **not** start until metering + admin observability are trustworthy and product priority is explicit.

- [ ] Eval harness and offline datasets  
- [ ] Rules engine expansion (beyond static aliases)  
- [ ] Optional classifier / preference model path (async or tiny side path)  
- [ ] `aihay/auto` virtual model with explicit policy docs  
- [ ] No mid-stream switch; hold stream-through laws  
- [ ] Cost/latency tradeoff policies per workspace  
- [ ] Scalability review (routing CPU off hot path) — see [scalability.md](./scalability.md)  

---

## Explicit non-goals (still)

- Mid-stream model failover after first SSE byte  
- Storing prompts by default  
- Requiring signup for pure gateway-only self-host  
- Shipping auto-router without eval story  

---

## Suggested next planning step

1. **Priority 2.1 first (cheap win):** Compose profile with Prometheus + Grafana + scrape config + starter dashboard.  
2. Turn **Priority 1** into `docs/design/architecture-v3-admin.md` with API sketch: `GET/POST /admin/v1/...`  
3. Then `implementation-plan-v3.md` with phases (e.g. **V3.0 Observability Compose**, **V3.1 Admin API/UI**, **V3.2 Tenant polish**, **V3.x Smart routing last**).  

Until then, whole-system ops remains: **raw `GET /metrics` + logs + SQL + runbook** (see [Runbook](../runbook.md)).
