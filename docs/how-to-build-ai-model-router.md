# How to Start Building Your Own AI Model Router

A practical guide for building a unified API that sits between end users and multiple LLM providers—similar in spirit to OpenRouter + LiteLLM.

---

## 1. Decide what you are building (product shape)

Pick one primary identity for v1. Mixing all three on day one is how projects stall.

| Shape | What users get | Closest product | Hardest parts |
| --- | --- | --- | --- |
| **A. Unified API (aggregator)** | One key, many models; user picks `model` | OpenRouter (core) | Billing, provider adapters, reliability |
| **B. Gateway (ops)** | Fallback, budgets, logs, keys | Portkey / LiteLLM | Config, multi-tenant governance |
| **C. Smart router** | Auto-picks model per prompt | Not Diamond / Martian | Quality evals, not just heuristics |

**Recommended v1:** **A + thin B**

- OpenAI-compatible chat API
- 2–3 providers
- Explicit model names
- Simple fallbacks + usage logs

Leave “AI picks the best model” for v2 after you have real traffic and a quality bar.

---

## 2. Nail the external contract first

Your **product is the API**, not the routing math.

### Expose OpenAI-compatible endpoints

Most clients already work if you implement:

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/chat/completions` | Chat (non-stream + stream) |
| `GET /v1/models` | List models |
| `POST /v1/embeddings` | Optional, later |

Example client call:

```bash
curl https://api.yourrouter.com/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "hi"}],
    "stream": true
  }'
```

### Design choices to lock early

1. **Model IDs** — e.g. `provider/model` (`openai/gpt-4o-mini`, `anthropic/claude-sonnet-4`) or your own aliases (`cheap`, `smart`).
2. **Auth** — API keys you issue (`sk-...`), not raw provider keys (unless you support BYOK later).
3. **Streaming** — SSE (`text/event-stream`) is mandatory for real UX; non-stream only is not enough.
4. **Error shape** — map provider errors to OpenAI-like JSON so SDKs keep working.

If the wire format is clean, users can swap `base_url` and keep the OpenAI SDK.

---

## 3. Minimum architecture (MVP)

```
Client (OpenAI SDK / curl)
        │  sk-user-key
        ▼
┌───────────────────────────────────────┐
│  Your Router API                      │
│  1. Auth + rate limit                 │
│  2. Resolve model → provider adapter  │
│  3. Transform request                 │
│  4. Call upstream                     │
│  5. Normalize response / stream       │
│  6. Log usage + cost                  │
└───────────────────────────────────────┘
        │
   ┌────┼────┐
   ▼    ▼    ▼
OpenAI Anthropic Google (etc.)
```

### Core components

| Component | Responsibility |
| --- | --- |
| **API layer** | HTTP, auth, validation, streaming |
| **Model registry** | model id → provider, upstream model name, pricing, capabilities |
| **Provider adapters** | Translate OpenAI-shaped request ↔ each vendor API |
| **Router policy** | v1: static map; later: fallback, cost, auto |
| **Usage ledger** | tokens in/out, $ estimate, latency, which model ran |
| **Key store** | your user keys + encrypted provider credentials |

### Data you need from day one

- `users` / `api_keys`
- `models` (id, provider, upstream_id, input/output $/1M tokens, supports_tools, max_context)
- `requests` (id, key_id, model, tokens, cost, latency, status, error)
- `provider_credentials` (for your platform keys; BYOK later)

---

## 4. Build order (what to implement first)

Do this sequence; each step is shippable.

### Phase 0 — Learning prototype (1–3 days)

- One process, one endpoint: `POST /v1/chat/completions`
- Hardcode **two** providers (e.g. OpenAI + Anthropic)
- Non-streaming only
- Single hard-coded API key
- Goal: prove request translation + response normalization

### Phase 1 — Real MVP

- Streaming (SSE)
- `GET /v1/models`
- Multi-key auth + basic rate limits
- Model registry (config file or DB)
- Usage logging + simple cost estimate
- Failover: if primary 5xx/timeout → try next model in list
- Deploy somewhere public (Fly, Railway, AWS, Cloudflare Workers, etc.)

### Phase 2 — Productization

- Dashboard: keys, spend, request logs
- Credits / billing (Stripe) **or** BYOK (user’s own provider keys, you charge platform fee)
- Virtual models: `auto`, `cheap`, `balanced`
- Semantic or exact cache (optional)
- Guardrails (max tokens, block lists, PII redaction)

### Phase 3 — Smart routing

- Rules: `if user_tier == free → small models`
- Heuristics: short prompt → cheap model
- Classifier / embeddings for task type
- Preference-trained router (RouteLLM-style) only after you have eval data

**Do not start with Phase 3.** OpenRouter was useful long before Auto mode was smart.

---

## 5. Tech stack recommendations

Pick for **speed of iteration**, not perfect purity.

| Layer | Practical choice | Why |
| --- | --- | --- |
| Language | **TypeScript (Hono/Fastify)** or **Python (FastAPI)** | Great AI ecosystem; Python easier for adapters; TS great if you want edge |
| HTTP | Hono / FastAPI | Fast, simple streaming |
| DB | Postgres | Keys, usage, billing |
| Cache / rate limit | Redis | Limits, optional response cache |
| Config | YAML/JSON model catalog + env secrets | Easy to ship first |
| Deploy | Docker + one cloud | Keep ops boring |

**Optional shortcut:** study or self-host **LiteLLM** as a reference implementation, then replace pieces. Do not build 100 adapters from scratch on day one—start with 2–3.

### Provider adapters (the real work)

Each adapter must handle:

- Auth headers
- Message format differences (system roles, tools, image parts)
- Streaming event mapping
- Token usage fields (or estimate if missing)
- Errors / rate limits / retries

Start with:

1. OpenAI
2. Anthropic
3. One more (Google Gemini **or** a cheap open model host like Groq / Together)

---

## 6. Routing policy for v1 (keep it dumb)

```text
request.model = "openai/gpt-4o-mini"
  → registry lookup
  → adapter = OpenAI
  → upstream_model = "gpt-4o-mini"
  → call; on failure → optional fallback list
```

```text
request.model = "auto"
  → pick from allowlist by: user budget, max cost, latency preference
  → still no ML required
```

Smart routing only pays off when you can measure quality. Until then, **static maps + fallbacks + budgets** beat a half-trained classifier.

---

## 7. Business / product decisions early

These change architecture:

| Decision | Options | Implication |
| --- | --- | --- |
| Who pays providers? | You (resell) vs user BYOK | Resell needs capital + markup; BYOK is simpler legally/cashflow |
| Pricing | Markup %, flat fee, free tier | Need accurate token metering |
| Audience | Devs (API) vs enterprises (VPC) | Hosted multi-tenant vs self-host |
| Differentiation | Cheapest? Fastest? Best DX? Private? | Don’t try to beat OpenRouter on catalog size first |

**Sensible niches for a new router:**

- Vertical models (e.g. coding-only, local + cloud mix)
- Region / data residency
- Transparent cost + open routing rules
- Agent-oriented (tools, multi-step, budget caps)

---

## 8. Week-1 checklist

Concrete goals for the first week:

- [ ] OpenAI-compatible `chat/completions` (stream + non-stream)
- [ ] Two providers wired through one model namespace
- [ ] API key auth
- [ ] Usage log: model, tokens, estimated $
- [ ] One fallback chain
- [ ] `GET /v1/models`
- [ ] README with 5-line OpenAI SDK example
- [ ] Deployed URL + one smoke test

If that works, you have a **router product skeleton**. Everything else is polish and scale.

---

## 9. Common traps

1. **100 providers first** — adapters and edge cases explode; 2–3 is enough.
2. **Smart routing before metering** — you can’t optimize cost you don’t measure.
3. **Ignoring streaming** — most real apps need it.
4. **No request IDs / traces** — debugging multi-provider failures becomes impossible.
5. **Assuming token counts match** — normalize and store raw + estimated.
6. **Building a full dashboard before a stable API** — API first; UI second.

---

## 10. Suggested MVP project layout

```text
router/
  src/
    server.ts          # HTTP server
    auth.ts            # API keys
    registry.ts        # model catalog
    routes/
      chat.ts          # /v1/chat/completions
      models.ts        # /v1/models
    providers/
      openai.ts
      anthropic.ts
      types.ts
    billing/
      usage.ts
  models.yaml          # model → provider map
  README.md
```

Language options:

1. **TypeScript (Hono)** — good for a hosted product API
2. **Python (FastAPI)** — faster to iterate on adapters and routing logic

---

## Related docs in this repo

- [AI Model Routers Research Brief (2026)](./ai-model-routers-2026.md) — market landscape, competitors, strategies, and decision framework

---

*Guide written for builders starting a unified multi-model LLM API. Iterate on the wire format and metering first; add intelligent routing only after you can measure quality and cost.*
