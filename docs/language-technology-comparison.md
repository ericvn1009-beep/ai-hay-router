# Language & Technology Options for an AI Model Router

A decision guide for **ai-hay-router**: which language and runtime should power a unified multi-model API (gateway + routing). This compares realistic options, their tradeoffs, and why **TypeScript is the recommended winner for v1**.

---

## 1. What you are optimizing for

An AI router/gateway is not a training cluster and not a CRUD app. The workload looks like:

| Characteristic | Implication |
| --- | --- |
| **I/O-bound** | Most time is waiting on OpenAI/Anthropic/etc., not local CPU |
| **Long-lived streams** | SSE / token streaming, abort, backpressure |
| **OpenAI-compatible API** | Stable JSON contracts, SDK drop-in |
| **Many adapters** | Provider quirks, tools, multimodal |
| **Product surface** | Keys, billing, dashboard, docs, public SDK |
| **Multi-tenant ops** | Auth, rate limits, usage metering, fallbacks |

**Success metrics for language choice:**

1. Time to ship a reliable unified API  
2. Streaming quality (TTFT, cadence)  
3. Maintainability of adapters + types  
4. Hiring / team velocity  
5. Enough performance that **inference latency still dominates**  
6. Path to scale (horizontal instances, later hot-path rewrite if needed)

---

## 2. Options at a glance

| Option | Role | Best known in this space | Verdict for ai-hay-router v1 |
| --- | --- | --- | --- |
| **TypeScript (Node / Bun / edge)** | Full gateway + product | Portkey gateway, many Workers proxies | **Winner** |
| **Python (FastAPI + uvicorn)** | Gateway / proxy | LiteLLM | Strong runner-up for ML-heavy teams |
| **Go** | High-performance data plane | Bifrost, many infra proxies | Best pure-perf alternative |
| **Rust** | Extreme performance / safety | Some AI gateways, Helicone parts | Overkill for v1 |
| **Java / Kotlin** | Enterprise gateways | Traditional API gateways | Heavy for a startup router |
| **Edge-only (Workers + Hono TS)** | Global edge proxy | Cloudflare AI Gateway pattern | Great deploy target *with* TS |
| **Hybrid (TS + Go/Python)** | Split control / data / ML | Common at scale | Phase 2+ architecture |

---

## 3. Detailed comparison

### 3.1 TypeScript (Node.js, Bun, or edge runtimes)

**What it is:** Typed JavaScript on V8 (Node/Bun) or edge isolates (Cloudflare Workers, etc.). Frameworks: **Hono**, **Fastify**, NestJS.

#### Pros

| Pro | Why it matters for a router |
| --- | --- |
| **Product velocity** | One language for API, dashboard, and official SDK |
| **OpenAI ecosystem fit** | Most clients, examples, and agent tools are JS/TS-first |
| **Excellent async I/O** | Natural fit for concurrent upstream streams |
| **Streaming support** | Mature `ReadableStream` / SSE patterns |
| **Types as contracts** | Shared types for chat, tools, usage, stream events across adapters |
| **Edge deployable** | Global low-latency PoPs without rewriting the stack |
| **Hiring & packages** | Huge ecosystem (auth, Redis, Stripe, OTEL, Zod) |
| **Proven in category** | Production AI gateways ship TS successfully (e.g. Portkey’s public TS choice) |

#### Cons

| Con | Mitigation |
| --- | --- |
| Not µs-class overhead vs Go/Rust | Keep hot path lean; overhead still ≪ model TTFT |
| Higher memory per connection than Go | Horizontal scale; watch concurrent stream count |
| GC can affect p99 if you allocate per token | Stream-through; avoid heavy per-chunk objects |
| Single-threaded event loop per process | Multi-process / multi-container |
| CPU-heavy ML (embeddings, training) is awkward | Side-car Python later if needed |

#### Best stack shape

```text
TypeScript
├── Hono or Fastify     # /v1/chat/completions + SSE
├── Zod                 # runtime request validation
├── Postgres            # keys, usage, models
├── Redis               # rate limits, cache
└── Next.js (optional)  # admin / keys UI
```

#### When to pick it

Default for **ai-hay-router**: unified API product, multi-provider adapters, dashboard, and public developer DX.

---

### 3.2 Python (FastAPI, Starlette, LiteLLM-style)

**What it is:** Dominant AI/ML language. Async gateways via FastAPI + httpx/anyio.

#### Pros

| Pro | Why it matters |
| --- | --- |
| **AI/ML ecosystem** | Evals, embeddings, RouteLLM-style routers, notebooks |
| **Fast adapter prototyping** | Many official SDKs and examples in Python |
| **Team familiarity** | Common if founders are ML-first |
| **LiteLLM existence** | You can learn from (or embed) a huge adapter catalog |
| **Good enough at low–mid traffic** | Fine for early product and internal tools |

#### Cons

| Con | Why it hurts a public router |
| --- | --- |
| **Weaker high-concurrency streaming** | GIL / runtime overhead under many long streams |
| **Higher infra cost at scale** | Memory and p99 often worse than Go/TS under load |
| **Edge story weaker** | Not the natural Cloudflare Workers language |
| **Split stack for product UI** | Dashboard/SDK often still need TypeScript |
| **Category lessons** | High-scale gateways often migrate *away* from pure Python hot paths |

#### When to pick it

- Core value is **smart routing research** (classifiers, preference models)  
- Team is Python-only and traffic will stay modest  
- You intentionally wrap/extend LiteLLM rather than build greenfield  

#### Role in a TS-first shop

Ideal as a **side-car**: offline evals, embedding workers, experimental auto-router—not the public edge gateway.

---

### 3.3 Go

**What it is:** Compiled language with goroutines; common for proxies and cloud infra. Example: **Bifrost** (claims ~11 µs overhead at high RPS).

#### Pros

| Pro | Why it matters |
| --- | --- |
| **Best raw gateway performance** | Low overhead, low memory, smooth stream cadence under load |
| **Superb concurrency model** | Thousands of streams with small footprint |
| **Simple static binaries** | Easy deploy, small ops surface |
| **Predictable latency** | Less GC drama than managed runtimes if written carefully |
| **Industry “data plane” default** | Envoys, sidecars, high-QPS proxies |

#### Cons

| Con | Why it hurts early product |
| --- | --- |
| **Slower product iteration** | More verbose for JSON-heavy adapter work and rapid API churn |
| **Weaker shared web product stack** | Admin UI and TS SDK are separate languages |
| **Generics/ergonomics** | Fine, but not as nice as TS for complex OpenAPI-shaped trees |
| **Hiring for full-stack AI product** | Harder to use one team for gateway + dashboard + SDK |
| **Overkill while inference dominates** | Extra perf often invisible to end users at early scale |

#### When to pick it

- You already know traffic will be **very high RPS**  
- Gateway overhead / infra $ is the main constraint  
- You’re building **infra-first**, not marketplace-product-first  
- As a **later rewrite** of the hot proxy path behind a TS control plane  

---

### 3.4 Rust

**What it is:** Maximum control over performance and safety. Some observability/gateway components use Rust.

#### Pros

| Pro | Why it matters |
| --- | --- |
| **Top-tier latency & efficiency** | Excellent for extreme scale |
| **Memory safety without GC** | Predictable multi-tenant isolation stories |
| **Strong for security-sensitive proxies** | Parsing, isolation, safety guarantees |

#### Cons

| Con | Why it hurts v1 |
| --- | --- |
| **Slowest iteration** | Adapter surface area + streaming edge cases take longer |
| **Steep hiring curve** | Expensive team for a startup router |
| **Ecosystem friction** | Async HTTP is mature but less “product-shaped” than Node |
| **Premature for most AI routers** | Inference still dominates until huge scale |

#### When to pick it

- Regulated / ultra-high-scale infra with dedicated systems engineers  
- Rewriting a proven hot path after metrics demand it  
- **Not** the default for greenfield product MVP  

---

### 3.5 Java / Kotlin (JVM)

**What it is:** Enterprise API gateways, Spring WebFlux, Netty-style stacks.

#### Pros

| Pro | Why it matters |
| --- | --- |
| **Mature enterprise ops** | Observability, threading, corporate standards |
| **Strong typing & tooling** | Large-org maintainability |
| **High throughput possible** | JVM can be very fast when tuned |

#### Cons

| Con | Why it hurts this product |
| --- | --- |
| **Heavy operational footprint** | Memory, cold start, complexity |
| **Poor fit for indie/startup AI DX** | Ecosystem gravity is elsewhere for LLM apps |
| **Slower to match AI-native patterns** | Streaming + provider SDKs less central than TS/Python |
| **Edge deploy awkward** | Not Workers-native |

#### When to pick it

Only if the org standard **mandates** JVM and the router must live inside existing Java platform engineering.

---

### 3.6 Edge-first TypeScript (Cloudflare Workers, etc.)

**What it is:** Not a different language—**TypeScript on edge isolates**, often with Hono.

#### Pros

| Pro | Why it matters |
| --- | --- |
| **Global low latency** | Gateway close to users |
| **Tiny cold starts** | Good for bursty API traffic |
| **Ops-light** | No servers to babysit early on |
| **Natural cache/rate-limit primitives** | KV, Durable Objects patterns |

#### Cons

| Con | Mitigation |
| --- | --- |
| CPU/time/body limits | Keep adapters thin; heavy work in origin |
| Long streams / complex state | Design for constraints; may need dual deploy |
| Vendor lock-in risk | Abstract “runtime” behind interfaces |

#### When to pick it

As a **deployment target** for the TS gateway (or a thin edge proxy in front of a regional origin)—not as a separate language decision.

---

### 3.7 Hybrid architectures

```text
┌─────────────────────────────────────────┐
│  TypeScript control plane               │
│  API, auth, billing, dashboard, SDK     │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌───────────────┐   ┌───────────────────┐
│ Go/Rust proxy │   │ Python ML workers │
│ hot data plane│   │ embeddings/router │
└───────────────┘   └───────────────────┘
```

#### Pros

- Best tool per layer  
- Scale the expensive path without rewriting the product  

#### Cons

- Operational complexity  
- Dual deploy, dual observability  
- Only worth it **after** metrics justify it  

---

## 4. Scorecard (ai-hay-router priorities)

Weights reflect a **productized unified API** (not a research paper, not a hyperscale proxy only).

| Criterion (weight) | TypeScript | Python | Go | Rust | JVM |
| --- | --- | --- | --- | --- | --- |
| Ship unified OpenAI API fast (20%) | **5** | 4 | 3 | 2 | 3 |
| Streaming / concurrent I/O (15%) | **4** | 3 | **5** | **5** | 4 |
| Adapter & type maintainability (15%) | **5** | 4 | 3 | 3 | 4 |
| One language for API + UI + SDK (15%) | **5** | 2 | 2 | 1 | 2 |
| Raw gateway overhead at extreme RPS (10%) | 3 | 2 | **5** | **5** | 4 |
| Edge / global deploy (10%) | **5** | 2 | 3 | 2 | 1 |
| ML / smart-routing research (10%) | 2 | **5** | 2 | 2 | 2 |
| Hiring for small AI product team (5%) | **5** | 4 | 3 | 2 | 3 |
| **Weighted feel** | **Winner** | Strong if ML-first | Perf king | Future hot path | Enterprise only |

Scores are relative judgments for this product class, not lab microbenchmarks.

---

## 5. Why TypeScript is the winner

### 5.1 The product is an API business, not an ML kernel

**ai-hay-router** wins by:

- One OpenAI-compatible endpoint  
- Multi-provider adapters  
- Keys, credits, usage  
- Developer experience  

TypeScript is the language of **API products + web clients + agent tooling**. Go wins proxies; Python wins research; **TS wins the full product loop**.

### 5.2 Performance is “good enough” where it counts

For chat/completions:

- Model TTFT is often **100 ms–seconds**  
- A disciplined TS gateway adds **~1–15 ms**  
- Users feel provider speed and stream smoothness, not µs of language overhead  

Chasing Go/Rust on day one optimizes the wrong bottleneck.

### 5.3 Types reduce multi-provider bugs

Adapters must normalize:

- Messages, tools, multimodal parts  
- Stream events  
- Usage and errors  

Shared TypeScript types (plus Zod at the boundary) catch contract drift early—critical when you add OpenAI → Anthropic → Gemini → Groq.

### 5.4 One stack for the whole company surface

| Surface | Language with TS choice |
| --- | --- |
| Gateway | TypeScript |
| Dashboard | TypeScript |
| Public SDK | TypeScript |
| Edge proxy | TypeScript |
| Docs site / playground | TypeScript |

Python/Go force **polyglot** from week one for the same coverage.

### 5.5 Edge and platform optionality

TS runs on:

- Node / Bun VMs  
- Serverless functions  
- Cloudflare Workers / similar  

That matches “put the router near users” without a rewrite.

### 5.6 Category proof, not theory

- Production AI gateways have chosen **TypeScript** for product + edge reasons  
- High-scale **Go** gateways prove what’s possible later if needed  
- **Python** LiteLLM proves adapters are easy—and also that pure Python can struggle as a high-RPS data plane  

TS sits in the sweet spot: **ship like a product, perform like a competent proxy**.

### 5.7 Escape hatches stay open

Choosing TypeScript does **not** lock you out of performance or ML:

| Later need | Path |
| --- | --- |
| Extreme RPS / memory | Extract Go/Rust data plane; keep TS control plane |
| Smart routing / embeddings | Python workers or external router API |
| Global latency | Deploy same TS service to edge/multi-region |

You optimize when metrics demand it—not before.

---

## 6. Decision tree

```text
Is your v1 success "apps set baseURL and it works"?
├── Yes → TypeScript (Hono/Fastify)
│         └── Need global edge day one? → Workers/Hono variant
│
Is your v1 success "SOTA learned router / heavy evals"?
├── Yes → Python core (or Python side-car + TS API)
│
Is your v1 success "cheapest infra at 10k+ sustained RPS"?
├── Yes → Go (or Rust) data plane
│
Mandated enterprise JVM platform?
└── Yes → Kotlin/Java (rare for this product)
```

**Default path for this repo:**  
**TypeScript gateway → measure → optional Go hot path / Python ML workers.**

---

## 7. Recommended technology set (with TypeScript as core)

| Layer | Choice | Notes |
| --- | --- | --- |
| Language | **TypeScript** | Source of truth |
| Runtime | Node 22+ LTS or Bun | Prefer current LTS for ops predictability |
| HTTP framework | **Hono** or **Fastify** | Hono if edge; Fastify if classic Node |
| Validation | **Zod** | Runtime + type inference |
| DB | Postgres | Keys, models, usage |
| Cache / limits | Redis | Rate limits, optional response cache |
| Observability | OpenTelemetry | Traces across providers |
| Admin UI | Next.js | Same language |
| Package layout | Monorepo (`server`, `sdk`, `web`, `schema`) | Share chat/completion types |
| Deploy | Docker + one cloud; optional Workers edge | Start simple |

Explicitly **defer**: Rust rewrite, multi-language service mesh, embedding-in-hot-path semantic cache.

---

## 8. Common objections

| Objection | Response |
| --- | --- |
| “Go is faster.” | True at extreme scale. Irrelevant until inference no longer dominates and metrics show gateway p99/cost pain. |
| “Python is the AI language.” | For models and research, yes. For a multi-tenant streaming API product, TS is a better primary. Use Python beside it. |
| “LiteLLM already exists in Python.” | Great reference. Cloning its mistakes (hot-path bloat, scale limits) is optional. |
| “Types slow us down.” | Types slow wrong APIs; they speed multi-provider refactors. Zod keeps runtime honest. |
| “We’ll need ML routing.” | Add a worker. Don’t make the public edge gateway a research notebook. |

---

## 9. Bottom line

| Rank | Option | One-line |
| --- | --- | --- |
| **1. TypeScript** | **Winner** | Best balance of product speed, streaming I/O, types, edge, and “fast enough” performance |
| 2. Go | Perf alternative | Choose when infra efficiency is the product |
| 3. Python | ML alternative | Choose when smart routing research is the product |
| 4. Rust | Specialist | Later hot path or extreme constraints |
| 5. JVM | Enterprise default | Only under platform mandate |

**Why TypeScript wins for ai-hay-router:**  
you are building a **developer-facing multi-model control plane**. That problem is dominated by **API design, adapters, streaming, and product surface**, not by squeezing the last microsecond out of a proxy. TypeScript is the language that ships that system end-to-end—while staying well within the latency budget set by the models themselves.

---

## Related docs

- [How to Build Your Own AI Model Router](./how-to-build-ai-model-router.md)
- [TypeScript Performance for an AI Model Router](./typescript-performance-ai-router.md)
- [Router vs Gateway](./router-vs-gateway.md)
- [OpenRouter Deep Overview (2026)](./openrouter-overview-2026.md)
- [AI Model Routers Research Brief (2026)](./ai-model-routers-2026.md)
