# AI Hay Router — Implementation Plan (V1)

| Field | Value |
| --- | --- |
| **Product** | AI Hay Router |
| **Document type** | Implementation plan (V1) |
| **Status** | Draft |
| **Last updated** | 2026-08-05 |
| **Based on** | [Product Spec](./product-spec.md) · [Architecture V1](./architecture-v1.md) |
| **Goal** | Ship a self-hostable OpenAI-compatible multi-model gateway with keys, metering, failover, and docs |

This plan is the **engineering execution path** for V1. It turns architecture into ordered work, acceptance criteria, and a definition of done. It deliberately **excludes** account signup, dashboard, billing, BYOK, and smart auto-routing.

---

## 1. Outcome (what “V1 done” means)

A developer can:

1. `docker compose up` with provider env keys  
2. Mint an AI Hay API key via CLI (no user account / signup)  
3. Call chat completions with the OpenAI SDK (`baseURL` + `AIHAY_API_KEY`)  
4. Stream tokens without full-body buffering  
5. Survive primary provider failure via failover/fallback  
6. See usage (tokens, $ estimate, model, provider, latency) in the ledger  

**Success metrics (from product spec):**

| Metric | Target |
| --- | --- |
| Time to first successful call | &lt; 10 minutes with docs |
| Gateway overhead p50 (warm, same region) | ≤ 15 ms (excluding provider) |
| Streaming | First token not blocked by full-body buffer |
| Reliability | Retry/failover on 5xx / timeout |
| Metering | Usage row for every terminal request |
| Providers | ≥ 2 production adapters (OpenAI + Anthropic) |

---

## 2. Scope lock

### 2.1 In scope (build this)

| Area | Deliverable |
| --- | --- |
| API | `POST /v1/chat/completions` (stream + non-stream) |
| API | `GET /v1/models` |
| API | `GET /health`, `GET /ready` |
| Auth | Bearer `sk-aihay-…` keys; hash at rest; CLI mint/list/revoke |
| Registry | YAML (+ optional DB) model → provider → upstream id + pricing |
| Adapters | OpenAI, Anthropic |
| Router | Ordered provider attempts + optional model fallbacks |
| Metering | `usage_events` with cost estimate |
| Deploy | Docker Compose (api + Postgres + Redis) |
| DX | Quickstart (curl + TS OpenAI SDK); env example |
| Tests | Unit + adapter contract + stream E2E smoke |

### 2.2 Out of scope (do not build in V1)

| Item | Why deferred |
| --- | --- |
| User signup / login / OAuth / sessions | Not required for self-host V1; keys via CLI |
| Dashboard UI | Phase 2 |
| Stripe / credits / prepaid balance | Meter first |
| BYOK (customer provider keys) | Phase 2 |
| Orgs, invites, RBAC, SSO | Phase 2 |
| Smart / auto model routing | Phase 3; needs evals |
| Semantic cache | Phase 2 |
| Embeddings / images APIs | Phase 3 |
| 3rd+ providers beyond path is clear | After MVP green |
| Multi-region HA | After single-region stable |

### 2.3 Auth product decision (locked for this plan)

| Decision | Choice |
| --- | --- |
| Account management | **No** for V1 |
| How keys are created | **CLI / admin script** against Postgres |
| Runtime identity | `api_keys` row only (optional single default workspace) |
| Provider credentials | Platform env vars (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) |

---

## 3. Recommended stack (locked)

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict) |
| Runtime | Node 22+ LTS |
| HTTP | Hono |
| Validation | Zod |
| DB | Postgres + Drizzle (or Kysely) |
| Cache / limits | Redis |
| HTTP client | `fetch` (undici) |
| Tests | Vitest |
| Package manager | pnpm |
| Deploy | Docker + Compose |

---

## 4. Repo / project layout (create in Phase 0–1)

```text
ai-hay-router/
  apps/api/
    src/
      server.ts
      app.ts
      config.ts
      middleware/
        request-id.ts
        auth.ts
        rate-limit.ts
        error-handler.ts
      routes/
        chat-completions.ts
        models.ts
        health.ts
      pipeline/
        handle-chat.ts
        attempt-plan.ts
        execute-attempt.ts
      registry/
        types.ts
        load.ts
        resolve.ts
      providers/
        types.ts
        openai/
        anthropic/
        stream/
      metering/
        usage.ts
        cost.ts
      db/
        client.ts
        schema.ts
        keys.ts
        usage.ts
      lib/
        hash.ts
        logger.ts
    models.yaml
    Dockerfile
  packages/cli/                 # or scripts/ under apps/api
    src/keys.ts                 # keys create | list | revoke
  docker-compose.yml
  .env.example
  package.json                  # pnpm workspace root
  README.md                     # product + quickstart (expand)
  docs/                         # existing research/design
```

Monorepo is optional; a single `apps/api` with `pnpm aihay-keys` script is acceptable if faster.

---

## 5. Phased plan

Work is ordered so each phase is **demoable**. Do not start Phase 1b before 1a streaming works.

| Phase | Name | Calendar (1 eng, rough) | Depends on |
| --- | --- | --- | --- |
| **0** | Spike | 1–3 days | — |
| **1a** | Wire API + streaming | 3–5 days | 0 |
| **1b** | Control plane (keys, registry, usage) | 3–5 days | 1a |
| **1c** | Reliability (failover, timeouts) | 2–4 days | 1b |
| **1d** | Ship (Docker, CLI polish, docs, smoke) | 2–3 days | 1c |
| **1e** | Hardening (tests, perf checks, polish) | 2–3 days | 1d |

**Total directional estimate:** ~2–4 weeks for one full-time engineer to a shippable MVP (provider API access available).

---

### Phase 0 — Spike (prove adapters)

**Goal:** Prove OpenAI-shaped request → two providers → normalized response. No production auth, no stream yet.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 0.1 | Init TS project (pnpm, strict, Vitest, tsx) | ESLint optional |
| 0.2 | Define shared types: messages, chat request/response | Align with OpenAI shapes |
| 0.3 | Implement OpenAI adapter (non-stream only) | `fetch` to Chat Completions |
| 0.4 | Implement Anthropic adapter (non-stream only) | Message/system translation |
| 0.5 | Hard-coded single route or script: call both | Env: provider keys |
| 0.6 | Document adapter quirks discovered | Tools/system/usage fields |

#### Acceptance criteria

- [ ] Script/route returns OpenAI-like JSON from **OpenAI** for a hello prompt  
- [ ] Same for **Anthropic** after normalization  
- [ ] Token usage present or estimated with a flag  
- [ ] No dashboard, no DB required  

#### Exit demo

```bash
pnpm spike:chat --provider openai --model gpt-4o-mini
pnpm spike:chat --provider anthropic --model claude-3-5-haiku-latest
```

---

### Phase 1a — Wire API + streaming

**Goal:** Real HTTP API; OpenAI SDK works for stream and non-stream against a temporary auth stub.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 1a.1 | Hono app: mount routes, CORS minimal, JSON errors | |
| 1a.2 | `request_id` middleware + `x-request-id` header | UUID |
| 1a.3 | Zod validate `POST /v1/chat/completions` body | model, messages, stream, … |
| 1a.4 | Auth stub: accept fixed env `AIHAY_DEV_KEY` or any `sk-` in dev | Replace in 1b |
| 1a.5 | Stream-through SSE for OpenAI adapter | **No** full buffer |
| 1a.6 | Stream-through SSE for Anthropic → OpenAI chunk shape | Map events |
| 1a.7 | Client abort → `AbortSignal` to upstream | |
| 1a.8 | `GET /v1/models` from in-memory/YAML list | Static OK |
| 1a.9 | `GET /health` | 200 ok |
| 1a.10 | Error normalizer (400/401/429/502 OpenAI-like) | |
| 1a.11 | Manual test with official `openai` npm package | stream true/false |

#### Acceptance criteria

- [ ] Non-stream chat works for both providers via unified model ids  
- [ ] Stream: client receives first chunk without waiting for full completion  
- [ ] OpenAI Node SDK drop-in works with `baseURL`  
- [ ] Disconnect mid-stream cancels upstream (verified in logs/tests)  
- [ ] Unknown model / bad body returns structured error  

#### Exit demo

```ts
const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: process.env.AIHAY_DEV_KEY,
});
const stream = await client.chat.completions.create({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "hi" }],
  stream: true,
});
for await (const chunk of stream) process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
```

---

### Phase 1b — Control plane (keys, registry, usage)

**Goal:** Multi-key auth, durable registry, usage ledger. Still no user accounts.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 1b.1 | Postgres schema: `workspaces`, `api_keys`, `usage_events` | Migrations via Drizzle |
| 1b.2 | Seed default workspace on migrate | Single-tenant V1 |
| 1b.3 | Key hashing (`pepper` + HMAC-SHA256 or argon2id) | Secret shown once |
| 1b.4 | CLI: `keys create --name` / `list` / `revoke` | Prints `sk-aihay-…` once |
| 1b.5 | Auth middleware: Bearer → hash → lookup; Redis cache TTL | Revoke invalidates |
| 1b.6 | Replace dev-key stub with real key verification | Keep override only in test |
| 1b.7 | Registry loader: `models.yaml` → resolve(model) | Pricing + endpoints |
| 1b.8 | Cost estimator from registry prices | |
| 1b.9 | Usage write path (async enqueue preferred) | Never block first stream byte |
| 1b.10 | Basic per-key RPM limit via Redis | Fail open with low default if Redis down (document choice) |
| 1b.11 | Response headers: `x-aihay-model`, `x-aihay-provider` | |

#### Acceptance criteria

- [ ] Created key works; revoked key returns 401  
- [ ] Second key isolates usage rows by `api_key_id`  
- [ ] Every successful/failed terminal chat produces a `usage_events` row  
- [ ] Cost estimate populated when prices exist  
- [ ] No email/password/signup code in the tree  

#### Data model minimum (implement as designed)

- `workspaces` — one default  
- `api_keys` — hash, prefix, name, rpm, revoked_at  
- `usage_events` — request_id, key, models, provider, tokens, cost, latency, status  

#### CLI UX (V1 onboarding)

```bash
# After compose up + migrate
pnpm aihay keys create --name local-dev
# sk-aihay-...  (copy now; not shown again)

pnpm aihay keys list
pnpm aihay keys revoke --prefix sk-aihay-abcd
```

---

### Phase 1c — Reliability (failover & timeouts)

**Goal:** Request survives primary failure when fallbacks are configured.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 1c.1 | `attempt-plan` builder from registry + optional `models[]` | Bounded max attempts (default 3, hard 5) |
| 1c.2 | Per-attempt timeout + global request deadline | Config env |
| 1c.3 | Classify errors: retriable vs fatal | 429/5xx/timeout vs 400/401 |
| 1c.4 | Provider failover (same model, next endpoint) | Even if only one OpenAI endpoint, structure ready |
| 1c.5 | Model fallback chain | Registry `fallback_models` and/or request `models[]` |
| 1c.6 | Optional attempt trace (no prompts) | Log or `request_traces` table |
| 1c.7 | Optional circuit: mark endpoint unhealthy in Redis ~30s | Nice-to-have |
| 1c.8 | Chaos test: mock primary 503 → secondary succeeds | Automated |

#### Acceptance criteria

- [ ] With primary forced to fail, client still gets 200 when fallback works  
- [ ] Usage shows **actual** model/provider used  
- [ ] Exhausted attempts → 502 `upstream_unavailable`  
- [ ] No infinite retry loops  

---

### Phase 1d — Ship (Docker, docs, smoke)

**Goal:** Someone else can run V1 from clean machine using docs only.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 1d.1 | `Dockerfile` multi-stage for api | Non-root user |
| 1d.2 | `docker-compose.yml`: api, postgres, redis | Healthchecks |
| 1d.3 | `.env.example` with all required vars | No real secrets |
| 1d.4 | Migrate on startup or documented migrate step | Prefer explicit migrate job |
| 1d.5 | `/ready` checks Postgres (and Redis if required) | |
| 1d.6 | Root README quickstart: compose → keys create → SDK snippet | &lt; 10 min path |
| 1d.7 | Document model IDs, errors, fallbacks, privacy defaults | Link design docs |
| 1d.8 | Smoke script: health + non-stream + stream | CI-friendly |
| 1d.9 | Pin Node version (`.nvmrc` / engines) | |

#### Acceptance criteria

- [ ] Clean checkout + compose + key create + one chat = success  
- [ ] Smoke script exits 0 against local stack  
- [ ] Quickstart uses `AIHAY_API_KEY` (brand-aligned)  

---

### Phase 1e — Hardening

**Goal:** Confidence to put real traffic on self-host deploy.

#### Tasks

| ID | Task | Notes |
| --- | --- | --- |
| 1e.1 | Adapter contract tests (fixtures for stream events) | No live keys required for unit tests |
| 1e.2 | Integration tests with recorded/mock upstream | |
| 1e.3 | Live optional tests gated by env keys | Nightly or manual |
| 1e.4 | Structured JSON logging audit (no secrets/prompts) | |
| 1e.5 | Rough latency check: gateway overhead budget | Log timings; no full load suite required |
| 1e.6 | Capability gates (tools/vision unsupported → 400) | Per registry flags |
| 1e.7 | Security pass: SSRF (no client base_url), key never logged | |
| 1e.8 | Changelog entry for V1.0.0-mvp | |

#### Acceptance criteria

- [ ] CI green on unit + mock integration  
- [ ] Checklist in §8 all checked  
- [ ] Known limitations documented (no signup, no billing, 2 providers)  

---

## 6. Work breakdown by component

| Component | Primary phases | Key files |
| --- | --- | --- |
| HTTP edge | 1a, 1d | `app.ts`, `routes/*`, `middleware/*` |
| Adapters | 0, 1a, 1e | `providers/openai`, `providers/anthropic` |
| Pipeline | 1a, 1c | `pipeline/*` |
| Registry | 1b | `registry/*`, `models.yaml` |
| Auth / keys | 1b | `middleware/auth.ts`, `db/keys.ts`, CLI |
| Metering | 1b | `metering/*`, `db/usage.ts` |
| Rate limit | 1b | `middleware/rate-limit.ts` |
| Deploy | 1d | `Dockerfile`, `docker-compose.yml` |
| Docs | 1d | root `README.md`, env example |

---

## 7. Testing plan

| Layer | What | When |
| --- | --- | --- |
| Unit | Zod schemas, cost math, hash, attempt-plan, error classify | From 0 |
| Adapter unit | Fixture SSE/JSON → OpenAI shape | 1a–1e |
| Integration | App + mock providers (MSW/nock/undici mock) | 1b+ |
| E2E smoke | Live optional against real APIs | 1d+ |
| Manual | OpenAI SDK stream, abort, failover chaos | Each phase exit |

**Minimum CI for V1 merge to main:**

1. `pnpm typecheck`  
2. `pnpm test` (no live network)  
3. Lint (if configured)  

---

## 8. Definition of Done (V1 checklist)

### Product

- [ ] Chat completions non-stream  
- [ ] Chat completions stream (SSE, stream-through)  
- [ ] `GET /v1/models`  
- [ ] `GET /health` (+ `/ready`)  
- [ ] API keys via CLI (create/list/revoke) — **no account system**  
- [ ] Usage ledger with cost estimate  
- [ ] OpenAI + Anthropic adapters  
- [ ] Failover and/or model fallbacks working  
- [ ] Docker Compose deploy  
- [ ] Quickstart docs &lt; 10 minutes  

### Engineering

- [ ] Typed pipeline + Zod validation  
- [ ] Keys hashed at rest  
- [ ] No prompt/completion storage by default  
- [ ] `request_id` on all responses  
- [ ] Bounded retries  
- [ ] Automated tests for adapters + attempt plan  
- [ ] Smoke script  

### Explicitly not done (and documented as such)

- [ ] No signup / user accounts  
- [ ] No dashboard  
- [ ] No billing  
- [ ] No BYOK  
- [ ] No smart auto routing  

---

## 9. Week-by-week sketch (single engineer)

| Week | Focus | Demo at end of week |
| --- | --- | --- |
| **Week 1** | Phase 0 + 1a | OpenAI SDK streams from local Hono via both providers |
| **Week 2** | Phase 1b + start 1c | Real keys + usage rows; start failover |
| **Week 3** | Phase 1c + 1d | Compose up; chaos failover; public quickstart |
| **Week 4** | Phase 1e + buffer | CI green; polish; tag `v0.1.0` or `v1.0.0-mvp` |

Compress to ~2 weeks if adapters are simpler and one engineer stays focused; expand if streaming edge cases dominate.

---

## 10. Risks & mitigations (execution)

| Risk | Mitigation in this plan |
| --- | --- |
| Anthropic stream mapping eats time | Spike mapping in Phase 0/1a; fixture tests early |
| Scope creep (signup, dashboard) | §2.2 out of scope; reject in review |
| Sync DB on hot path | Auth cache in Redis; async usage writes |
| Provider key / cost surprises during dev | Cap test models; use cheap models in smoke |
| “Just one more provider” | Hard stop at 2 until DoD met |
| Buffering bugs | Explicit code review rule: no `response.text()` on stream path |

---

## 11. Dependencies & prerequisites

| Prerequisite | Owner |
| --- | --- |
| OpenAI API key for platform testing | Eng |
| Anthropic API key for platform testing | Eng |
| Docker + Node 22 on dev machines | Eng |
| Decisions locked: Hono, no signup in V1, CLI keys | Product/Eng (this plan) |

Still open product questions (do **not** block V1 implementation):

- Managed cloud vs OSS-first packaging  
- Long-term license  
- Public hostname / brand domain  
- Billing model after metering exists  

---

## 12. Suggested first PR sequence

Ship as small PRs, not one mega-merge:

| PR | Content |
| --- | --- |
| PR1 | Repo scaffold, tooling, empty Hono server, health |
| PR2 | Shared types + OpenAI non-stream adapter + spike |
| PR3 | Anthropic non-stream adapter |
| PR4 | Chat route non-stream + Zod + error shape |
| PR5 | Streaming both adapters + abort |
| PR6 | Postgres schema + keys CLI + auth middleware |
| PR7 | Registry YAML + models route + cost + usage |
| PR8 | Attempt plan + failover + tests |
| PR9 | Docker Compose + quickstart README + smoke |
| PR10 | Hardening, CI, tag MVP |

---

## 13. Post-V1 (not scheduled here)

After V1 DoD:

| Next | Trigger |
| --- | --- |
| Rate limit / budget polish | Abuse or multi-dev self-host |
| Third provider (Gemini or Groq) | Customer ask or cost strategy |
| Simple aliases (`aihay/cheap`) | Registry policy only |
| Dashboard + signup | Decision to run multi-tenant managed cloud |
| BYOK + billing | Monetization decision |
| Smart routing | Enough traffic + eval harness |

---

## 14. Documentation map

| Doc | Role |
| --- | --- |
| [Product Specification](./product-spec.md) | What / why |
| [Architecture Design (V1)](./architecture-v1.md) | System structure |
| **This plan** | How we execute V1 |
| [How to Build](../how-to-build-ai-model-router.md) | General builder guide |
| Research under `docs/` | Market context |

---

## 15. Summary

**V1 implementation = gateway core first:**

1. Adapters (OpenAI + Anthropic)  
2. Stream-through OpenAI-compatible API  
3. CLI-issued API keys (no accounts)  
4. Registry + usage metering  
5. Failover  
6. Docker + quickstart  

Do not block V1 on user management, billing, or smart routing. Measure everything; productize accounts only when multi-tenant self-serve is the distribution model.

---

*Implementation plan V1 — living document. Update checkboxes and estimates as phases complete.*
