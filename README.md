# ai-hay-router

**AI Hay Router** — a unified multi-model LLM API (gateway + simple routing).  
V1 target: OpenAI-compatible chat, CLI-issued keys, OpenAI + Anthropic adapters, metering, model fallbacks, Docker Compose self-host.

## Status

| Phase | Status |
| --- | --- |
| Design docs | Done |
| **Phase 0** — adapters spike | **In progress / scaffolded** |
| **Phase 1a** — Hono API + streaming | **Scaffolded** (dev key auth) |
| Phase 1b+ — keys, metering, Docker | Not started |

## Dev quickstart (local)

```bash
# requires Node 22+ and pnpm
pnpm install
cp .env.example .env   # set OPENAI_API_KEY / ANTHROPIC_API_KEY for live calls

# unit tests (no network)
pnpm test

# spike a single provider (needs live key)
pnpm spike:chat --provider openai --model gpt-4o-mini

# run API (Phase 1a: Authorization: Bearer $AIHAY_DEV_KEY)
pnpm dev
```

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/v1/models \
  -H "Authorization: Bearer sk-aihay-dev-local"

curl -s http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-aihay-dev-local" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role":"user","content":"hi"}],
    "stream": false
  }'
```

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: process.env.AIHAY_DEV_KEY ?? "sk-aihay-dev-local",
});
```

## Design (start here)

| Doc | Role |
| --- | --- |
| [Product Specification](./docs/design/product-spec.md) | What we build and why |
| [Architecture Design (V1)](./docs/design/architecture-v1.md) | How the system is structured |
| [Implementation Plan (V1)](./docs/design/implementation-plan-v1.md) | Phases, tasks, DoD → tag `v0.1.0` |

### V1 decisions (locked)

- **Self-host** Docker Compose (no multi-tenant signup)
- **CLI API keys** only (`sk-aihay-…`); no user accounts
- **Hono** + TypeScript + Node 22 + Postgres + Redis
- **Text chat** first; tools/vision out of DoD
- **Model fallback** for reliability; stream failover **pre-first-byte only**
- **Meter** every terminal request; billing later

## Business

- [LLM Reseller Business Model Research](./docs/business/llm-reseller-business-model.md)
- [OpenAI Enterprise Deals as COGS](./docs/business/openai-enterprise-cogs-deals.md)
- [Google Gemini Enterprise Deals as COGS](./docs/business/google-enterprise-cogs-deals.md)
- [How OpenRouter Handles COGS & Commercial Model](./docs/business/openrouter-cogs-commercial-model.md)

## Research

- [AI Model Routers Research Brief (2026)](./docs/ai-model-routers-2026.md)
- [How to Build Your Own AI Model Router](./docs/how-to-build-ai-model-router.md)
- [OpenRouter Deep Overview (2026)](./docs/openrouter-overview-2026.md)
- [Router vs Gateway](./docs/router-vs-gateway.md)
- [TypeScript Performance for an AI Model Router](./docs/typescript-performance-ai-router.md)
- [Language & Technology Comparison](./docs/language-technology-comparison.md)
