# AI Hay Router — Product Specification

| Field | Value |
| --- | --- |
| **Product name** | AI Hay Router |
| **Repo** | [ai-hay-router](https://github.com/ericvn1009-beep/ai-hay-router) |
| **Document type** | Product specification (v0.1) |
| **Status** | Draft |
| **Last updated** | 2026-07-27 |
| **Primary language** | TypeScript (Node.js / Bun runtime) |

---

## 1. Executive summary

**AI Hay Router** is a **unified multi-model API** that sits between applications and LLM providers. Developers call one OpenAI-compatible endpoint with one API key; AI Hay routes the request to the right model and provider, handles failover, meters usage, and returns a normalized response (including streaming).

**v1 positioning:** a **gateway with simple routing** (aggregator + reliability + metering), not a research-grade “AI picks the perfect model” system. Smart routing is a later phase.

**One-liner:**  
*One API key. Many models. OpenAI-compatible. Built for developers shipping multi-model apps.*

---

## 2. Problem

### 2.1 Developer pain

| Pain | Today’s cost |
| --- | --- |
| Many providers, many SDKs | Integration time multiplies per lab (OpenAI, Anthropic, Google, open-weight hosts) |
| Separate keys and bills | Ops overhead, no single spend view |
| Provider outages / rate limits | App 500s unless every team builds fallbacks |
| Model churn | New models weekly; hard to try without rewiring |
| Cost vs quality tradeoffs | Paying frontier prices for simple tasks |

### 2.2 Category gap

Existing options force tradeoffs:

| Option | Gap |
| --- | --- |
| **OpenRouter** | Excellent catalog; platform fees; not self-hostable; limited differentiation for custom products |
| **LiteLLM** | Strong open proxy; ops burden; Python-scale limits under heavy streaming |
| **Portkey / enterprise gateways** | Deep governance; heavier and more expensive than many startups need |
| **Direct provider APIs** | Best native features; zero multi-model story |

**AI Hay** targets teams that want **OpenRouter-like DX** with a path to **own the control plane** (self-host or managed), transparent routing, and a product surface built in TypeScript end-to-end.

---

## 3. Goals and non-goals

### 3.1 Goals (v1)

1. **Unified OpenAI-compatible API** for chat completions (stream + non-stream).
2. **Multi-provider access** through a single developer API key.
3. **Model registry** with stable IDs (`provider/model` or AI Hay aliases).
4. **Reliability basics:** timeouts, retries, provider failover, optional model fallback list.
5. **Usage metering:** tokens, estimated cost, latency, which model/provider served the request.
6. **Developer DX:** drop-in OpenAI SDK via `baseURL`, clear errors, docs, playground-quality examples.
7. **Ship in TypeScript** for shared types across API, SDK, and future dashboard.

### 3.2 Non-goals (v1)

| Non-goal | Rationale |
| --- | --- |
| 100+ providers on day one | Adapter quality over catalog vanity |
| Learned/auto model router (SOTA) | Needs evals + traffic; Phase 3 |
| Full enterprise SIEM / complex RBAC | Phase 2+ |
| Training or hosting foundation models | AI Hay is orchestration, not a lab |
| Guaranteed identical quality across hosts of “the same” model | Document variance; allow ignore/only later |
| Beating Go gateways on µs overhead | Inference latency dominates; architecture first |

### 3.3 Success metrics

| Metric | v1 target (directional) |
| --- | --- |
| Time for a dev to first successful call | &lt; 10 minutes with docs + API key |
| Gateway overhead (same region, warm) | p50 **1–15 ms**; not the UX bottleneck |
| Streaming | First token not blocked by full-body buffering |
| Reliability | Automatic retry/failover on provider 5xx / timeout |
| Metering accuracy | Usage log for every completed request with model + token estimates |
| Provider coverage | **≥ 2** production providers (e.g. OpenAI + Anthropic); path to 3rd |

---

## 4. Product principles

1. **The product is the API contract** — wire compatibility beats clever internals.
2. **Gateway first, smart router second** — static maps + failover before ML routing.
3. **Stream-through, never buffer-then-forward** — protect TTFT and memory.
4. **Meter everything** — you can’t optimize cost you don’t measure.
5. **Types as contracts** — shared TypeScript types for requests, streams, usage.
6. **Escape hatches** — explicit model IDs always available; `auto` is optional later.
7. **Honest defaults** — prefer cheapest *stable* route only when policy says so; don’t silently degrade quality without config.

---

## 5. Users and personas

### 5.1 Primary: App / agent developer

- Building chatbots, coding agents, internal tools.
- Wants OpenAI SDK drop-in and ability to switch models by string.
- Cares about: latency, cost, uptime, simple billing.

### 5.2 Secondary: Startup platform engineer

- Needs one key for the company, spend visibility, env separation (dev/prod).
- Cares about: rate limits, logs, fallbacks, self-host option later.

### 5.3 Future: Team admin (Phase 2)

- Issues keys, sets budgets, reviews usage by project.
- Cares about: dashboard, SSO, allowlists.

### 5.4 Not a primary user (v1)

- Enterprise security buyers (deep compliance packs).
- ML researchers training routers (use side-car tools).

---

## 6. Product shape

### 6.1 Category placement

| Layer | AI Hay v1 | Later |
| --- | --- | --- |
| **Aggregator / unified API** | Yes | Yes |
| **Gateway (ops)** | Thin: auth, limits, failover, logs | Full: cache, guardrails, budgets UI |
| **Smart router** | Manual model + simple rules | Auto / classifier / preference models |

AI Hay is both a **gateway you call** and a **router that chooses provider endpoints** for a given model. See [Router vs Gateway](../router-vs-gateway.md).

### 6.2 Deployment modes (roadmap)

| Mode | Description | Phase |
| --- | --- | --- |
| **Managed cloud** | AI Hay-hosted API + credits or usage billing | 1–2 |
| **BYOK** | Customer provider keys; AI Hay fee for routing/control plane | 2 |
| **Self-host** | Docker / compose in customer VPC | 2–3 |

v1 can start as **self-host MVP** or **single-tenant managed** without full marketplace billing.

---

## 7. Core features

### 7.1 Must-have (MVP / Phase 1)

| Feature | Description |
| --- | --- |
| **Chat Completions API** | `POST /v1/chat/completions` OpenAI-compatible |
| **Streaming** | SSE (`stream: true`), stream-through proxy |
| **Models list** | `GET /v1/models` |
| **API keys** | Bearer `sk-...` issued by AI Hay |
| **Model registry** | Config/DB map: AI Hay model id → provider + upstream id + pricing |
| **≥ 2 provider adapters** | e.g. OpenAI + Anthropic |
| **Provider failover** | On 5xx / timeout / rate limit, try next endpoint when configured |
| **Model fallbacks** | Optional `models: []` or config chain |
| **Usage ledger** | request id, key, model, provider, tokens, $ estimate, latency, status |
| **Error normalization** | OpenAI-like error JSON where practical |
| **Health endpoint** | Liveness/readiness for deploy |

### 7.2 Should-have (Phase 2)

| Feature | Description |
| --- | --- |
| **Dashboard** | Keys, usage charts, recent requests |
| **Rate limits & budgets** | Per key / per workspace |
| **Credits or Stripe billing** | Prepaid or usage-based |
| **BYOK** | Customer provider credentials |
| **Semantic or exact cache** | Optional, workload-dependent |
| **Virtual models** | `aihay/cheap`, `aihay/balanced`, `aihay/auto` (rules-based first) |
| **Guardrails** | Max tokens, basic blocklists, optional PII hooks |
| **Third provider** | Gemini and/or Groq / Together |
| **Organizations** | Workspaces, multiple keys |

### 7.3 Could-have (Phase 3)

| Feature | Description |
| --- | --- |
| **Smart Auto routing** | Prompt → model via classifier or preference router |
| **Eval-linked routing** | Route using measured quality scores |
| **Provider sort policies** | price / latency / throughput (OpenRouter-like controls) |
| **ZDR / data policy filters** | Route only to compliant endpoints |
| **Private model endpoints** | Bring your own vLLM / dedicated deploy |
| **Embeddings / images APIs** | Expand beyond chat |
| **Agent SDK** | Higher-level tool loop helpers |
| **Go data plane** | Only if metrics demand extreme RPS efficiency |

---

## 8. API product requirements

### 8.1 Public endpoints (v1)

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/chat/completions` | Chat (stream + non-stream) |
| `GET` | `/v1/models` | List available models |
| `GET` | `/health` | Health check |

Later: `/v1/embeddings`, `/v1/responses` (if aligning with newer OpenAI shapes), management APIs for keys.

### 8.2 Compatibility

- Primary compatibility target: **OpenAI Chat Completions** request/response and streaming chunks.
- Clients must work with:

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.aihay.example/v1",
  apiKey: process.env.AIHAY_API_KEY,
});
```

- AI Hay-specific extensions (provider preferences, fallback arrays) via documented fields or `extra_body`, without breaking standard clients.

### 8.3 Model ID scheme

| Pattern | Example | Notes |
| --- | --- | --- |
| Canonical | `openai/gpt-4o-mini` | Clear provider ownership |
| Alias | `aihay/cheap` | Resolved via registry policy |
| Future auto | `aihay/auto` | Phase 3 |

### 8.4 Auth

- `Authorization: Bearer sk-aihay-...`
- Keys hashed at rest; show secret only once at creation.
- Phase 2: key-level limits, workspace scoping.

### 8.5 Streaming requirements

- SSE format compatible with OpenAI clients.
- **No** full-response buffering before first byte to client.
- Propagate client disconnect / abort to upstream when possible.
- Include usage on final chunk when upstream provides it (or estimate).

---

## 9. Routing specification

### 9.1 Two layers (v1)

```text
Request
  → Model resolution   (which logical model?)
  → Provider selection (which upstream host/credentials?)
  → Adapter call
  → Normalize + stream
```

### 9.2 v1 routing policy (deliberately simple)

1. Resolve `model` (or alias) via **registry**.
2. Select provider endpoint(s) from registry order.
3. Call primary; on retriable failure → next provider or fallback model.
4. Log actual model/provider used.

### 9.3 Explicit non-behavior (v1)

- No silent quality-based model downgrade without user opt-in.
- No training on customer prompts by default (product promise; implement retention policy in ops).

### 9.4 Future provider controls (Phase 3 alignment with market)

Inspired by OpenRouter-style controls (not all required at once):

- `order` / `only` / `ignore`
- sort by price | latency | throughput
- `allow_fallbacks`
- max price caps

---

## 10. Architecture (logical)

```text
┌──────────────────────────────────────────────────────┐
│ Clients: OpenAI SDK · curl · agents · apps           │
└──────────────────────────┬───────────────────────────┘
                           │ HTTPS + Bearer key
                           ▼
┌──────────────────────────────────────────────────────┐
│ AI Hay Router (TypeScript)                           │
│  Auth · rate limit · validate (Zod)                  │
│  Model registry · router policy                      │
│  Provider adapters · stream proxy                    │
│  Usage enqueue · structured logs · traces            │
└───────────────┬──────────────────┬───────────────────┘
                │                  │
                ▼                  ▼
         Postgres/Redis      OpenAI · Anthropic · …
         (keys, usage)       (upstream inference)
```

### 10.1 Core components

| Component | Responsibility |
| --- | --- |
| **API layer** | HTTP, auth, validation, SSE |
| **Registry** | Models, pricing, capabilities, upstream IDs |
| **Router** | Resolve model + provider order + fallbacks |
| **Adapters** | Provider-specific request/response/stream mapping |
| **Metering** | Usage records + cost estimate |
| **Config** | Env secrets, feature flags |

### 10.2 Technology choices (locked for v1)

| Layer | Choice | Rationale |
| --- | --- | --- |
| Language | **TypeScript** | Product velocity, types, edge option; see language comparison |
| Runtime | Node 22+ LTS or Bun | Stable async I/O |
| Framework | Hono or Fastify | Fast HTTP + streaming |
| Validation | Zod | Runtime + type inference |
| DB | Postgres | Keys, usage, registry |
| Cache / limits | Redis | Rate limits, optional cache |
| Deploy | Docker | Portable self-host / cloud |

Details: [Language & Technology Comparison](../language-technology-comparison.md), [TypeScript Performance](../typescript-performance-ai-router.md).

---

## 11. Data model (minimum)

### 11.1 Entities

| Entity | Key fields |
| --- | --- |
| **User / Workspace** | id, name, plan, created_at |
| **ApiKey** | id, workspace_id, hash, prefix, name, rate_limit, revoked_at |
| **Model** | id, provider, upstream_id, input_price, output_price, context_length, supports_tools, active |
| **ProviderCredential** | provider, encrypted secret / platform key ref |
| **UsageEvent** | id, api_key_id, model, provider, prompt_tokens, completion_tokens, cost_usd, latency_ms, status, error_code, created_at |
| **RequestTrace** (optional v1) | request_id, route decisions, attempt list |

### 11.2 Privacy defaults

- Log **metadata** (tokens, model, latency, status) by default.
- Do **not** store full prompts/completions by default.
- Optional opt-in debug logging with retention limits (later).

---

## 12. Non-functional requirements

| Area | Requirement |
| --- | --- |
| **Latency** | Gateway overhead p50 ≤ 15 ms same-region when warm (excluding provider) |
| **Availability** | Design for multi-instance; no single in-memory-only critical state |
| **Security** | TLS in transit; secrets encrypted; keys hashed; least-privilege provider keys |
| **Observability** | request_id on every response; structured logs; optional OpenTelemetry |
| **Scalability** | Horizontal scale of stateless API instances; Redis for distributed limits |
| **Reliability** | Timeouts on all upstream calls; bounded retries; no infinite fallback loops |

---

## 13. Monetization (product options)

Decide explicitly before public launch:

| Model | Description | Phase |
| --- | --- | --- |
| **Self-host free / OSS core** | Open core gateway; paid cloud optional | 1–2 |
| **Managed pass-through + fee** | Platform fee on credits (OpenRouter-like) | 2 |
| **BYOK + control-plane fee** | Customer pays providers; AI Hay charges platform fee after free tier | 2 |
| **Subscription** | Flat fee for seats/keys + included volume | 2 |

**v1 recommendation:** instrument metering first; billing can be manual or self-host-only until product-market fit.

---

## 14. Competitive positioning

| Competitor | AI Hay differentiates by |
| --- | --- |
| OpenRouter | Ownable control plane; transparent policies; no forced marketplace tax long-term |
| LiteLLM | TS product stack; stronger productized DX/dashboard path |
| Portkey | Simpler startup-focused surface; less enterprise config surface at start |
| Direct APIs | Multi-model + failover without multi-SDK glue |

**Positioning statement:**  
*AI Hay Router is the TypeScript-native unified LLM API for teams that want multi-provider access and reliability without surrendering their control plane.*

---

## 15. User journeys

### 15.1 First successful call

1. Developer signs up or runs self-host compose.
2. Creates API key.
3. Copies 5-line OpenAI SDK snippet with AI Hay `baseURL`.
4. Calls `aihay`-listed model; receives streamed tokens.
5. Sees usage in logs/dashboard (dashboard may be CLI/logs in MVP).

### 15.2 Failover

1. Primary provider returns 503.
2. AI Hay retries alternate provider for same logical model (if configured).
3. Client receives successful completion; usage shows actual provider.
4. No uncaught 500 if fallback succeeds.

### 15.3 Model switch

1. Developer changes `model` string only.
2. No code changes to auth or client construction.
3. Registry resolves new upstream adapter.

---

## 16. UX / DX requirements

| Surface | v1 bar |
| --- | --- |
| **Docs** | Quickstart, auth, models, streaming, errors, fallbacks |
| **Error messages** | Actionable (invalid key, unknown model, upstream timeout) |
| **Examples** | curl + TypeScript OpenAI SDK + Python OpenAI SDK |
| **Changelog** | Model add/remove and breaking API notes |
| **Status** | Public status page later; `/health` now |

---

## 17. Roadmap

### Phase 0 — Spike (days)

- Single process, non-stream chat to 2 providers.
- Hard-coded key; prove adapter normalization.

### Phase 1 — MVP (this spec’s core)

- Stream + non-stream chat completions.
- Registry, API keys, usage ledger.
- Failover + model fallbacks.
- Docker deploy + Quickstart docs.

### Phase 2 — Productization

- Dashboard, billing/BYOK, rate limits, budgets.
- Third provider, cache, virtual models.
- Org/workspaces.

### Phase 3 — Intelligence & enterprise

- Auto routing, eval hooks, ZDR filters.
- Private models, advanced guardrails.
- Optional Go hot path if metrics require.

---

## 18. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Provider API drift | Adapter tests; contract types; pin API versions |
| Quality variance across hosts | Prefer official providers first; document variance |
| Streaming bugs | End-to-end stream tests; no full buffer |
| Cost estimation errors | Store raw usage + estimate; reconcile later |
| Scope creep (100 providers) | Hard cap adapters until MVP metrics green |
| Security of keys | Hash AI Hay keys; encrypt provider secrets; rotate |
| Competing with OpenRouter on catalog | Compete on ownability, DX, and policy clarity |

---

## 19. Open questions

| # | Question | Options | Owner |
| --- | --- | --- | --- |
| 1 | Managed cloud first vs self-host OSS first? | Cloud / OSS / both | Product |
| 2 | Credit markup vs subscription vs BYOK-only? | See §13 | Product |
| 3 | Hono (edge-ready) vs Fastify (Node-classic)? | Hono / Fastify | Eng |
| 4 | Brand domain and public API hostname? | TBD | Product |
| 5 | Open-source license for core? | MIT / Apache / BSL | Product/Legal |
| 6 | Default model alias set (`aihay/cheap` etc.)? | Define in registry | Eng |

---

## 20. Out-of-scope checklist (enforce in reviews)

- [ ] No new provider without adapter tests and pricing entry  
- [ ] No smart auto-router before metering + eval plan  
- [ ] No prompt storage by default  
- [ ] No blocking full-body read on streaming path  
- [ ] No multi-region complexity before single-region MVP is stable  

---

## 21. Documentation map

| Doc | Purpose |
| --- | --- |
| **This product spec** | What we build and why |
| [Architecture Design (V1)](./architecture-v1.md) | How V1 is structured (pipeline, data, deploy) |
| [Implementation Plan (V1)](./implementation-plan-v1.md) | How we execute V1 (phases, tasks, DoD) |
| [How to Build](../how-to-build-ai-model-router.md) | Engineering start guide |
| [Router vs Gateway](../router-vs-gateway.md) | Concept clarity |
| [Language comparison](../language-technology-comparison.md) | Why TypeScript |
| [TS performance](../typescript-performance-ai-router.md) | Perf expectations |
| [OpenRouter overview](../openrouter-overview-2026.md) | Market reference |
| [Market research brief](../ai-model-routers-2026.md) | Category landscape |

---

## 22. Approval

| Role | Name | Date | Sign-off |
| --- | --- | --- | --- |
| Product | | | ☐ |
| Engineering | | | ☐ |
| Design / DX | | | ☐ |

---

*AI Hay Router product specification v0.1 — living document. Update when roadmap or API surface changes.*
