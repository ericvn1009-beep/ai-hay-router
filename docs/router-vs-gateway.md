# Router vs Gateway

They often sit in the same product, but they solve **different jobs**.

| | **Router** | **Gateway** |
| --- | --- | --- |
| **Core question** | *Which model (or provider) should handle this request?* | *How do we access, secure, and operate all model calls?* |
| **Decision focus** | Selection: best / cheapest / fastest / fallback | Access: one endpoint, auth, policy, observability |
| **Primary output** | A routing choice (model A vs B, host X vs Y) | A controlled path for traffic (proxy + ops features) |
| **Typical intelligence** | Rules, classifiers, price/latency sort, Auto modes | Fallbacks, retries, cache, keys, rate limits, logs |
| **Examples** | Not Diamond, Martian, RouteLLM, OpenRouter Auto | Portkey, LiteLLM, Cloudflare AI Gateway, Kong AI Gateway |
| **You “call” it for…** | Better model fit / lower cost per prompt | Unified API + reliability + governance |

---

## Simple analogy

- **Gateway** = the front door + security desk + mailroom of a building  
  (one entrance, badges, logging, packages don’t get lost)

- **Router** = the dispatcher who decides *which specialist* answers your question  
  (simple FAQ → junior; hard legal question → senior partner)

---

## What each actually does

### Gateway (ops / access layer)

Sits **in front of** providers and usually provides:

- Unified OpenAI-compatible API  
- Auth, API keys, multi-tenant credentials  
- Rate limits, budgets, retries, timeouts  
- Caching (exact or semantic)  
- Logging, tracing, cost dashboards  
- Guardrails (PII, prompt injection, allowlists)  
- Basic failover if a provider is down  

**Success metric:** uptime, control, visibility, compliance — not “smarter answers.”

### Router (selection layer)

Decides **destination** for each request:

- Model routing: GPT vs Claude vs small open model  
- Provider routing: same model on Azure vs Together vs native API  
- Policies: cost cap, latency target, quality tier  
- Optional smart routing: classify prompt → pick model  

**Success metric:** right quality at lower cost / lower latency.

---

## How they relate (most real systems)

```
App
 │
 ▼
┌─────────────┐
│  Gateway    │  ← keys, cache, limits, logs, failover plumbing
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Router     │  ← which model / which provider (optional layer)
└──────┬──────┘
       │
   ┌───┼───┐
   ▼   ▼   ▼
 OpenAI Anthropic Groq …
```

- Some products are **gateway-first** (LiteLLM, Portkey) with light routing rules.  
- Some are **router-first** (Not Diamond) and sit *on* a gateway or direct APIs.  
- **OpenRouter is both**: one managed gateway *plus* model/provider routing (including Auto).

---

## Side-by-side examples

| Scenario | Gateway role | Router role |
| --- | --- | --- |
| User asks a hard coding question | Accept request, auth, log cost | Prefer Claude / GPT frontier |
| User asks “summarize this email” | Same | Prefer cheap/fast model |
| Anthropic returns 429 | Retry / next host | Maybe same model, different provider — or fallback model |
| Need ZDR / no training | Block non-compliant providers | Only choose ZDR-eligible endpoints |
| Same FAQ 1000× | Semantic cache hit, no model call | No routing needed |

---

## One-line difference

- **Gateway** = *how* traffic is managed (access, reliability, ops).  
- **Router** = *where* each request goes (model/provider selection).

If you’re building **ai-hay-router**, v1 is usually a **gateway with simple routing** (unified API + registry + failover). **Smart routing** (auto-pick best model) is a later router layer on top.

---

## Related docs

- [AI Model Routers Research Brief (2026)](./ai-model-routers-2026.md)
- [How to Build Your Own AI Model Router](./how-to-build-ai-model-router.md)
- [OpenRouter Deep Overview (2026)](./openrouter-overview-2026.md)
