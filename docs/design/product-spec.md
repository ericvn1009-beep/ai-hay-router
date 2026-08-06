# AI Hay Router — Product Specification

| Field | Value |
| --- | --- |
| **Product name** | AI Hay Router |
| **Repo** | [ai-hay-router](https://github.com/ericvn1009-beep/ai-hay-router) |
| **Document type** | Product specification (v0.1) |
| **Status** | Ready to build (synced with Architecture + Implementation Plan) |
| **Last updated** | 2026-08-05 |
| **Primary language** | TypeScript (Node.js 22+; Bun optional later) |
| **Companions** | [Architecture V1](./architecture-v1.md) · [Implementation Plan V1](./implementation-plan-v1.md) |

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

1. **Unified OpenAI-compatible API** for chat completions (stream + non-stream), **text chat first**.
2. **Multi-provider access** through a single developer API key (CLI-issued; no signup in V1).
3. **Model registry** with stable canonical IDs (`provider/model`). Aliases are optional later.
4. **Reliability basics:** timeouts, retries, optional multi-endpoint failover, **model fallback** lists.
5. **Usage metering:** tokens, estimated cost, latency, which model/provider served the request.
6. **Developer DX:** drop-in OpenAI SDK via `baseURL`, clear errors, docs + examples.
7. **Ship in TypeScript** for shared types across API, SDK, and future dashboard.
8. **Self-host MVP:** Docker Compose deploy is the primary V1 distribution.

### 3.2 Non-goals (v1)

| Non-goal | Rationale |
| --- | --- |
| 100+ providers on day one | Adapter quality over catalog vanity |
| Learned/auto model router (SOTA) | Needs evals + traffic; Phase 3 |
| User signup / accounts / OAuth | Self-host V1 uses CLI-issued API keys only; accounts are Phase 2 (managed multi-tenant) |
| Dashboard UI | Phase 2 |
| Billing / credits / Stripe | Meter first; bill later |
| Tools, vision, multimodal as V1 DoD | Text chat only; reject unsupported parts with clear 400 (stretch: OpenAI tools passthrough) |
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
- Cares about: latency, cost, uptime; billing only when using managed cloud later.

### 5.2 Secondary: Startup platform engineer / operator

- Deploys AI Hay (Compose), mints keys via CLI, sets provider env secrets.
- Needs spend visibility via usage ledger, env separation (dev/prod keys), logs, fallbacks.
- Cares about: rate limits, revoke, self-host ops.

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
| **Self-host MVP** | Docker Compose; platform provider keys in env; CLI API keys | **1 (V1)** |
| **Single-tenant managed** | AI Hay operates one stack for a customer; still no public signup | 1–2 |
| **Managed multi-tenant cloud** | Public signup, credits/billing, dashboard | 2 |
| **BYOK** | Customer provider keys; AI Hay fee for routing/control plane | 2 |
| **Hardened self-host product** | Polished docs, HA recipes, optional air-gap | 2–3 |

**V1 primary distribution:** self-host Docker Compose. No multi-tenant account system in V1.

---

## 7. Core features

### 7.1 Must-have (MVP / Phase 1)

| Feature | Description |
| --- | --- |
| **Chat Completions API** | `POST /v1/chat/completions` OpenAI-compatible (**text chat**) |
| **Streaming** | SSE (`stream: true`), stream-through proxy |
| **Models list** | `GET /v1/models` |
| **API keys** | Bearer `sk-aihay-...`; **CLI mint/list/revoke** (no signup UI) |
| **Model registry** | Config/YAML: canonical id → provider + upstream id + pricing |
| **≥ 2 provider adapters** | OpenAI + Anthropic |
| **Model fallbacks** | Primary reliability path: `models: []` or registry `fallback_models` |
| **Provider multi-endpoint** | Structure for ordered endpoints / secondary keys (demo if configured) |
| **Basic rate limits** | Per-key RPM (abuse floor) |
| **Spend floor** | Default/clamp `max_tokens`; optional per-key daily token or $ soft cap |
| **Usage ledger** | request id, key, model, provider, tokens, $ estimate, latency, status |
| **Error normalization** | OpenAI-like error JSON where practical |
| **Health endpoints** | `GET /health` (liveness), `GET /ready` (deps) |
| **Docker Compose** | api + Postgres + Redis |

### 7.2 Should-have (Phase 2)

| Feature | Description |
| --- | --- |
| **Dashboard** | Keys, usage charts, recent requests |
| **User accounts / signup** | Email/OAuth, sessions for managed multi-tenant |
| **Budgets & spend policies** | Per key / workspace hard/soft $ caps (beyond V1 floor) |
| **Credits or Stripe billing** | Prepaid or usage-based |
| **BYOK** | Customer provider credentials |
| **Semantic or exact cache** | Optional, workload-dependent |
| **Virtual models / aliases** | `aihay/cheap`, `aihay/balanced`, `aihay/auto` (rules-based first) |
| **Guardrails** | Blocklists, optional PII hooks |
| **Third provider** | Gemini and/or Groq / Together |
| **Organizations** | Multi-workspace, invites, roles |
| **Tools / vision (productized)** | Full multi-provider tool + multimodal support |

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
| `POST` | `/v1/chat/completions` | Chat (stream + non-stream), text |
| `GET` | `/v1/models` | List available models |
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness (DB / critical deps) |

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

| Pattern | Example | V1 |
| --- | --- | --- |
| Canonical | `openai/gpt-4o-mini` | **Required** — registry key |
| Canonical | `anthropic/claude-…` | **Required** |
| Alias | `aihay/cheap` | **Out of V1 DoD** (Phase 2) |
| Auto | `aihay/auto` | Phase 3 — return clear 400 if requested in V1 |

### 8.4 Auth

- `Authorization: Bearer sk-aihay-...`
- Keys **created via CLI** (or admin script); secret shown only once; **hash at rest** (HMAC-SHA256 + server pepper).
- No user accounts, email, or password in V1.
- V1: per-key RPM + spend floor (max_tokens / optional daily cap).
- Phase 2: signup, dashboard key UI, workspace scoping, budgets UI.

### 8.5 Streaming requirements

- SSE format compatible with OpenAI clients.
- **No** full-response buffering before first byte to client.
- Propagate client disconnect / abort to upstream when possible.
- Include usage on final chunk when upstream provides it (or estimate).

### 8.6 Content surface (V1)

| Capability | V1 |
| --- | --- |
| Text messages | Supported |
| Streaming | Supported |
| Tools / function calling | **Out of DoD** (reject or document as non-goal); optional OpenAI-only stretch |
| Vision / image parts | **Out** — clear 400 |
| JSON mode / `response_format` | Passthrough if easy; else document unsupported |

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

1. Resolve `model` via **registry** (canonical id only for V1 DoD).
2. Build attempt plan: ordered endpoints for that model, then optional **model fallback** list.
3. Call attempts in order on retriable failure (5xx / timeout / 429).
4. Log actual model/provider used.

**Primary reliability demo for V1:** model fallback (e.g. OpenAI model → Anthropic model), not multi-host copies of the same frontier model.

### 9.3 Streaming and failover (locked)

| Mode | Failover rule |
| --- | --- |
| **Non-stream** | Try attempts `1..N` until success or exhausted |
| **Stream** | Try attempts only **until first successful upstream response is committed** to the client (before/at first client byte). **No** mid-stream model/provider switch. Mid-stream upstream death → terminal error + meter partial |

### 9.4 Explicit non-behavior (v1)

- No silent quality-based model downgrade without user opt-in (`models[]` / registry fallback only).
- No training on customer prompts by default (product promise; implement retention policy in ops).
- No transparent retry after the SSE stream has started.

### 9.5 Future provider controls (Phase 3 alignment with market)

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
│  Auth · RPM / spend floor · validate (Zod)           │
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
| Runtime | **Node 22+ LTS** (Bun optional later) | Stable async I/O |
| Framework | **Hono** | Lightweight, streaming-friendly, edge-portable |
| Validation | Zod | Runtime + type inference |
| DB | Postgres | Keys, usage, registry |
| Cache / limits | Redis | Rate limits, auth cache |
| Deploy | **Docker Compose** | Primary V1 distribution |

Details: [Architecture V1](./architecture-v1.md), [Language & Technology Comparison](../language-technology-comparison.md), [TypeScript Performance](../typescript-performance-ai-router.md).

---

## 11. Data model (minimum)

### 11.1 Entities (V1)

| Entity | Key fields | V1 notes |
| --- | --- | --- |
| **Workspace** | id, name, created_at | Single default workspace; **no User table** |
| **ApiKey** | id, workspace_id, hash, prefix, name, rate_limit_rpm, daily cap fields, revoked_at | CLI-issued identity |
| **Model** | id, provider, upstream_id, prices, context_length, active | YAML registry OK; DB optional |
| **ProviderCredential** | env refs in V1 | Platform `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` |
| **UsageEvent** | request_id, api_key_id, models, provider, tokens, cost, latency, status, attempt_count | One row per **terminal request** |
| **User** | — | **Phase 2** (managed cloud) |
| **RequestTrace** (optional) | request_id, attempt list | No prompts |

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

### 15.1 First successful call (V1)

1. Operator runs self-host Compose (`docker compose up`) with provider env keys.
2. Mints API key via CLI: `pnpm aihay keys create --name local-dev` (no signup).
3. Copies OpenAI SDK snippet with AI Hay `baseURL` + `AIHAY_API_KEY`.
4. Calls a registry model (e.g. `openai/gpt-4o-mini`); receives streamed tokens.
5. Sees usage in `usage_events` / structured logs (no dashboard in V1).

### 15.2 Failover / fallback

1. Primary attempt fails with retriable error **before** stream is committed (or on non-stream).
2. AI Hay tries next endpoint and/or **fallback model** from plan.
3. Client receives successful completion; usage shows **actual** model/provider.
4. If failure is mid-stream after commit → error terminal (no silent model switch).

### 15.3 Model switch

1. Developer changes `model` string only.
2. No code changes to auth or client construction.
3. Registry resolves new upstream adapter.

---

## 16. UX / DX requirements

| Surface | v1 bar |
| --- | --- |
| **Docs** | Quickstart (Compose → CLI key → call), models, streaming, errors, fallbacks, privacy |
| **Error messages** | Actionable (invalid key, unknown model, upstream timeout, unsupported content) |
| **Examples** | curl + TypeScript OpenAI SDK (**required**); Python OpenAI SDK (**nice-to-have**) |
| **Changelog** | Model add/remove and breaking API notes |
| **Status** | `/health` + `/ready` now; public status page later |

---

## 17. Roadmap

### Phase 0 — Spike (days)

- Single process, non-stream chat to 2 providers.
- Hard-coded key; prove adapter normalization.

### Phase 1 — MVP (this spec’s core)

- Stream + non-stream **text** chat completions.
- Registry, CLI API keys, usage ledger, basic RPM + spend floor.
- Model fallbacks (+ multi-endpoint structure); pre-commit stream failover only.
- Docker Compose + Quickstart docs.
- Tag: **`v0.1.0`**.

### Phase 2 — Productization

- Dashboard, signup/accounts, billing/BYOK, budgets UI.
- Third provider, cache, aliases / virtual models.
- Org/workspaces; productized tools/vision.

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

## 19. Decisions locked (V1) vs still open

### 19.1 Locked for V1

| # | Decision | Choice |
| --- | --- | --- |
| 1 | Distribution | Self-host Docker Compose primary |
| 2 | Identity | ApiKey + default Workspace; CLI mint/revoke; **no signup** |
| 3 | Framework | **Hono** + Node 22+ |
| 4 | Rate limits | Basic per-key **RPM** in V1; budgets UI Phase 2 |
| 5 | Aliases | Out of V1 DoD |
| 6 | Content | Text chat; tools/vision out of DoD |
| 7 | Failover | Pre-first-byte for stream; model fallback is primary demo |
| 8 | Key hash | HMAC-SHA256 + server pepper |
| 9 | First release tag | `v0.1.0` |

### 19.2 Still open (do not block V1 build)

| # | Question | Options | Owner |
| --- | --- | --- | --- |
| 1 | Managed multi-tenant after MVP vs OSS packaging emphasis? | Cloud / OSS / both | Product |
| 2 | Credit markup vs subscription vs BYOK-only? | See §13 | Product |
| 3 | Brand domain and public API hostname? | TBD | Product |
| 4 | Open-source license for core? | MIT / Apache / BSL | Product/Legal |
| 5 | Default alias set when Phase 2 aliases ship? | Define in registry | Eng |

---

## 20. Out-of-scope checklist (enforce in reviews)

- [ ] No new provider without adapter tests and pricing entry  
- [ ] No smart auto-router before metering + eval plan  
- [ ] No prompt storage by default  
- [ ] No blocking full-body read on streaming path  
- [ ] No multi-region complexity before single-region MVP is stable  
- [ ] No user signup / dashboard / billing in V1 PRs  
- [ ] No mid-stream model switch “failover”  
- [ ] No tools/vision as required V1 DoD without explicit stretch approval  
- [ ] No aliases required for V1 DoD  

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
