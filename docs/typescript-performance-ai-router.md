# TypeScript Performance for an AI Model Router

## The short answer

For an **AI router/gateway**, TypeScript is **usually fast enough** because the system is **I/O-bound**, not CPU-bound. Upstream model time (hundreds of ms to many seconds) dwarfs a well-built Node/TS proxy hop (typically **~1–15 ms** of gateway overhead).

TypeScript is **not** the absolute fastest language for gateways. At extreme RPS, **Go/Rust** win on overhead, memory, and tail latency. For **ai-hay-router** (product + unified API + multi-provider routing), TS performance is a **non-blocker** if you design for streaming and avoid classic Node pitfalls.

---

## 1. What “performance” means for an AI router

Your latency budget is almost never “JSON parse speed.” It looks like this:

| Segment | Typical order of magnitude | Who owns it |
| --- | --- | --- |
| Client → your gateway (network) | 5–80 ms | Geography / edge |
| Auth, rate limit, registry lookup | 0.1–5 ms | Your code + Redis/DB |
| Request transform (OpenAI → provider) | 0.05–2 ms | Your code |
| Gateway → provider (network) | 10–100+ ms | Region / provider |
| **Model TTFT** | **100 ms–several s** | Provider |
| Streaming tokens | 10–50+ ms/token | Provider |
| Response transform + stream proxy | sub-ms–few ms/chunk | Your code |

**Implication:** Even a “slow” gateway at **10–20 ms overhead** is often **&lt;5%** of end-to-end latency when TTFT is 500 ms–2 s. Industry writeups note that even ~8 ms gateway overhead is usually **&lt;1%** of total latency for chat completions.

Where gateway language **does** matter:

1. **TTFT inflation** — extra hops before first token
2. **Stream cadence** — janky token delivery feels worse than slightly higher total time
3. **Agent fan-out** — 5 sequential LLM calls → 5× gateway overhead
4. **High RPS + concurrency** — memory, p99, stability under load
5. **CPU-heavy middleware** — embeddings for semantic cache, heavy JSON rewriting, regex PII on large prompts

---

## 2. TypeScript runtime reality (Node / Bun / edge)

TypeScript compiles to JavaScript. Performance = **runtime + how you write the proxy**, not the type checker.

### Strengths for a router

| Strength | Why it helps an AI router |
| --- | --- |
| **Async I/O event loop** | Thousands of concurrent upstream streams without one thread per request |
| **Native streaming** | `ReadableStream`, async iterators, SSE — core product path |
| **JSON throughput** | Request/response shaping is mostly JSON; V8 is strong here |
| **Ecosystem for HTTP products** | Fastify/Hono, Redis clients, OTEL, Stripe, edge deploys |
| **Edge runtimes** | Cloudflare Workers / similar: low cold start, global PoPs (Portkey explicitly favored TS for edge + async) |

Portkey publicly argued for TypeScript over Python for their AI gateway: typing, async, edge support, and production claims around **single-digit ms** class latencies at scale (vendor claims; treat as directional).

### Weaknesses vs Go/Rust

| Weakness | Practical impact |
| --- | --- |
| Higher memory per connection | More cost at 5k–50k concurrent streams |
| GC pauses | Rare p99 spikes if you allocate heavily per chunk |
| Single-threaded JS per process | Need multi-process / multi-instance for multi-core CPU |
| CPU-bound work hurts everyone | Semantic embedding, big body transforms, crypto at huge volume |
| Not µs-class overhead | Go gateways advertise **~11 µs** overhead; TS is usually **ms-class** under real middleware |

Independent-style comparisons (vendor-influenced, use carefully) often order roughly:

| Stack | Rough gateway overhead / character |
| --- | --- |
| Go (e.g. Bifrost) | Microseconds–sub-ms; very high RPS, low memory |
| Rust | Similar / sometimes better tail at extreme load |
| **TypeScript (Portkey-class)** | **~few–low tens of ms** with real features |
| Python (LiteLLM-class) | Fine at low–mid RPS; degrades under heavy concurrent streaming |

Node vs Python for generic I/O: Node often wins raw req/s and WebSocket/SSE concurrency; Python is competitive on some streaming paths but tends to use more resources at high concurrent stream counts.

---

## 3. Where an AI router spends CPU in TypeScript

### Cheap (TS is fine)

- Auth header check + API key hash lookup (Redis/memory)
- Model registry map lookup
- Forward body with minimal transform
- Pipe upstream SSE → client SSE with small transforms
- Simple fallbacks / retries
- Structured logging of metadata (not full prompts)

### Medium (watch p99)

- Full JSON parse/stringify of large multimodal payloads
- Tool-schema normalization across providers
- Retry storms under provider outages
- Per-request DB writes for usage (sync path)
- Complex rate limiting without Redis pipelining

### Expensive (don’t do this naively in the hot path)

- Embedding every prompt for semantic cache **inline** on the request thread without batching
- LLM-as-judge routing before every call
- Heavy PII redaction on multi-MB contexts
- Synchronous disk logging of full prompts
- Buffering entire streams into memory before forwarding

**Rule:** Hot path should be **stream-through**, not **buffer-then-forward**.

---

## 4. Streaming is the real performance problem

Chat UX cares about:

1. **TTFT** (time to first token)
2. **Inter-token latency stability** (smooth cadence)
3. **Cancel/abort** behavior

TypeScript does this well **if**:

```text
client ←── pipe/transform chunks ──→ provider
         (no full-body buffer)
```

Anti-patterns that kill “TS performance” in practice:

| Anti-pattern | Effect |
| --- | --- |
| `await response.text()` then re-stream | Doubles memory; destroys TTFT |
| Parse every SSE line into rich objects | GC pressure, token jitter |
| `JSON.parse` entire history every retry | CPU spikes on long contexts |
| One giant middleware stack allocating per chunk | p99 stream stalls |
| Blocking CPU work on the event loop | All concurrent streams pause |

Go’s marketing edge is often **smoother cadence under load** and lower memory per stream—not that Node can’t stream.

---

## 5. Latency budget: what “good” looks like for TS

Target architecture for a production-grade TS router:

| Metric | Healthy target (self-hosted, same region) |
| --- | --- |
| Pure proxy overhead (auth + forward, warm) | **1–5 ms** p50 |
| With Redis rate limit + usage enqueue | **2–10 ms** p50 |
| p99 under moderate load | **&lt;20–30 ms** gateway-only |
| Added TTFT vs direct-to-provider | Ideally **&lt;15–30 ms** same region |

If your gateway adds **100+ ms** before first byte, the problem is almost always **architecture** (cold starts, remote DB on hot path, multi-hop regions, buffering)—not “TypeScript is slow.”

Managed marketplaces (extra network hop) often add **tens of ms** regardless of language. Language overhead is secondary to **topology**.

---

## 6. Throughput & scaling model

### Vertical

- Node: scale with **multiple processes** (cluster) or multiple containers
- One process handles high concurrency of streams well
- CPU-heavy middleware needs more instances sooner than Go

### Horizontal

- Stateless gateway instances behind LB
- Redis for rate limits / distributed counters
- Async usage writes (queue), not sync Postgres on every token

### Capacity intuition (order-of-magnitude)

For a lean TS proxy (not full enterprise suite):

- **Hundreds–low thousands RPS** of LLM calls is realistic with proper sizing (LLM RPS is low compared to CRUD APIs because each request holds a long stream)
- Bottleneck often becomes **open connections**, **upstream rate limits**, and **memory per stream**, not JSON parse rate

LLM gateways are “few RPS, long-lived streams” more than “50k tiny JSON POSTs/s.” That favors **async I/O languages** (TS/Go) over thread-per-request models.

---

## 7. TypeScript vs alternatives **for this product**

| Language | Gateway overhead | Concurrency / memory | Fit for ai-hay-router |
| --- | --- | --- | --- |
| **TypeScript** | Low-ms with care | Very good I/O; higher mem than Go | **Best default for product + DX + edge** |
| **Go** | Best-in-class µs–sub-ms | Excellent | Best when infra cost / extreme RPS dominates |
| **Rust** | Top tier | Excellent, harder to hire/iterate | Hot path rewrite later if needed |
| **Python** | Higher under load (LiteLLM lessons) | Weaker for mass concurrent streams | Great for adapters research / ML routing side-car |

**Pragmatic pattern used in industry:**

```text
TS control plane + API product  (ship features)
        │
        optional later
        ▼
Go/Rust data plane             (if metrics force it)
```

You almost never need that split on day one.

---

## 8. Design choices that dominate language choice

These matter more than “TS vs Go” for your router:

1. **Colocate gateway with users or providers** (region strategy)
2. **Connection pooling / keep-alive** to providers
3. **Stream-through SSE** (no full buffer)
4. **Hot path in memory** (API key + model map); cold path for analytics
5. **Fail fast** on timeouts; don’t pile retries that amplify load
6. **Backpressure** — if client is slow, don’t unbounded-buffer provider tokens
7. **Avoid giant dependency graphs** in the request path (heavy ORMs, huge middleware)
8. **Prefer Bun or Node 22+ LTS**, Fastify/Hono over unoptimized Express stacks
9. **Edge only if** your work fits Workers limits (CPU time, body size, streaming constraints)

---

## 9. When TypeScript performance is *not* enough

Consider Go/Rust (or a hybrid) when you measure:

| Signal | Threshold (illustrative) |
| --- | --- |
| Gateway-only p99 | Regularly **&gt;50 ms** after optimization |
| Concurrent streams per box | Memory cost dominates infra bill |
| Agent chains | 10–50 model calls/request and overhead compounds badly |
| Semantic cache / embedding | Need inline vector work at high QPS |
| Multi-tenant noisy neighbor | Need stricter isolation / scheduling |

Until then, **rewrite is premature optimization**.

---

## 10. Bottom line for **ai-hay-router**

| Question | Answer |
| --- | --- |
| Is TypeScript “slow” for an AI router? | **No** for normal product traffic; I/O-bound path suits it |
| Will users feel TS vs Go? | Usually **no** — they feel provider TTFT and stream quality |
| Main TS risks? | Buffering streams, hot-path DB, GC from per-chunk allocations, single-region hops |
| Main TS advantages? | Ship faster, shared types, edge, one language for API/SDK/UI |
| Absolute ceiling? | Go/Rust win at **extreme** RPS/memory efficiency |
| Recommendation | **Ship TS gateway**; treat performance as **architecture + streaming discipline**; revisit language only with p99/RPS metrics |

**One sentence:**  
TypeScript is fast enough for an AI router because **inference latency dominates**; your job is to keep gateway overhead in the **low milliseconds**, stream tokens without buffering, and scale horizontally—not to chase microsecond benchmarks until you have the traffic that justifies them.

---

## Related docs

- [AI Model Routers Research Brief (2026)](./ai-model-routers-2026.md)
- [How to Build Your Own AI Model Router](./how-to-build-ai-model-router.md)
- [OpenRouter Deep Overview (2026)](./openrouter-overview-2026.md)
- [Router vs Gateway](./router-vs-gateway.md)
