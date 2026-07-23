# AI Model Routers: Research Brief (2026)

An **AI model router** sits between your application and multiple LLM providers and decides **which model should handle each request**. Related terms overlap, but they are not the same.

| Layer | Core job | Typical examples |
| --- | --- | --- |
| **Aggregator / unified API** | One key + API; *you* still pick the model | OpenRouter, Eden AI |
| **Proxy / AI gateway** | Routing rules + failover, caching, keys, budgets, logs | LiteLLM, Portkey, Cloudflare, Helicone, Kong |
| **Smart / intelligent router** | Auto-picks best/cheapest model *per prompt* | Not Diamond, Martian, RouteLLM, Semantic Router |
| **Eval-linked routing** | Model choice driven by measured quality on real traffic | Braintrust, Maxim Bifrost |

In production stacks, mature teams often **compose** layers: a gateway for reliability and governance, plus a smart router for cost/quality selection.

---

## Why routers exist

Frontier models are expensive and uneven: strong at hard reasoning, wasteful on classification, FAQ, or simple transforms. Multi-provider reality also means outages, rate limits, and different pricing/latency profiles.

A router aims to:

1. **Resilience** — failover, load balance, multi-key
2. **Cost** — send easy work to small/cheap models
3. **Quality** — send hard work to frontier models (or the model that actually wins on *your* evals)
4. **Ops** — one API, spend controls, observability, guardrails

Braintrust’s framing of the “three jobs” of routing (resilience / cost / quality) is a useful buying lens.

---

## Routing strategies (what actually moves cost)

Not all “AI routing” is intelligent. Ranked by leverage:

| Strategy | How it works | Typical savings | Notes |
| --- | --- | --- | --- |
| Static / budget switching | Cap spend, switch providers by calendar or budget | ~10–15% | Not prompt-aware |
| Load balancing | Weighted / least-busy across keys or providers | ~15–25% | Reliability > intelligence |
| Intent / complexity classification | Embed or classify prompt → route by task type | ~30–50% | Needs evals or quality drifts |
| Hybrid cache + route | Semantic cache first; route only misses | Up to ~50–65% on repetitive workloads | Great for support/FAQ; weak for unique creative work |
| Preference-trained routers | Learn strong-vs-weak from human prefs (RouteLLM-style) | Often 2×+ cost cut at similar quality in benchmarks | Research-proven for binary pairs |
| Eval / production-score routing | Route using live scores, experiments, online judges | Variable; most durable long-term | Highest setup cost |

**Vendor claims of “50–90% savings” are workload-specific.** Production teams usually see less than marketing benchmarks once quality constraints are real.

---

## Top platforms by category

### 1. Managed multi-model marketplaces (broad access)

#### OpenRouter — default developer marketplace

- **What:** OpenAI-compatible API to **400+ models / 60–70+ providers**; provider ordering, fallbacks, sort by price/latency/throughput.
- **Pricing:** Pay-as-you-go credits; **~5.5% platform fee** on credit purchases (often waived/reduced for BYOK or high tiers depending on plan). Free tier with limited free models.
- **Smart routing:** Auto mode; Not Diamond has powered OpenRouter Auto routing in some configurations.
- **Best for:** Fast multi-model access, prototyping, one bill, provider failover.
- **Weak for:** Deep enterprise governance, self-host, quality eval closed-loop (bring your own).

#### Vercel AI Gateway

- One endpoint, fallbacks, BYOK with **no Vercel markup**, spend visibility; best DX if you’re already on Vercel/AI SDK.
- **Best for:** Next.js / Vercel product teams.
- **Weak for:** Self-host, non-Vercel polyglot stacks.

#### Eden AI

- Broader than LLMs (speech, vision, moderation, etc.); useful if routing spans *modalities*, not just chat.

---

### 2. Production AI gateways (ops + policy)

#### Portkey — enterprise gateway workhorse

- Conditional routing, fallbacks, retries, circuit breakers, load balancing, simple + semantic cache, budgets, rate limits, guardrails, strong observability.
- Open-source gateway core; cloud + hybrid/air-gapped enterprise options.
- **Best for:** Production multi-provider apps that need governance, not just model shopping.
- **Weak for:** “Magic cheapest model” without you writing rules / evals.

#### LiteLLM — open-source standard proxy

- Python SDK + proxy; **100+ providers** in OpenAI format; virtual keys, spend tracking, load balancing, fallbacks, admin UI. Very large community.
- **Best for:** Self-host, zero platform markup, compliance / VPC, full control.
- **Weak for:** You operate HA, upgrades, security; “intelligence” is mostly rules you build (not a trained router). Note: supply-chain/security scrutiny increased after a reported March 2026 incident on the project.

#### Helicone

- Observability-first proxy: logging, analytics, caching; routing secondary. Great “see spend and quality first” layer.

#### Cloudflare AI Gateway

- Edge caching, rate limits, analytics, growing catalog; free core features; low overhead if you’re in the Cloudflare stack.

#### Kong AI Gateway

- Extends Kong API management into LLM traffic (PII, prompt guards, semantic cache, MCP). Best when Kong is already the enterprise edge.

#### TrueFoundry

- Kubernetes/VPC-native enterprise gateway + broader ML platform; virtual models, low gateway overhead claims.

#### Maxim Bifrost

- Go-based open-source gateway; high throughput / low overhead; tight loop with Maxim evals/observability.

#### Braintrust Gateway

- Gateway + evals/traces/online scoring — routing tied to **measured quality**, not just price/failover. Gateway reported free during beta.

#### Requesty, Inworld Router, Unify

- Appear in 2026 comparisons for low-latency gateways, optimization criteria (cost/latency/intelligence), or quality/cost/latency benchmarking routers.

---

### 3. Intelligent / smart routers (model selection per prompt)

These answer: *“Given this prompt, which model?”*

#### Not Diamond

- Recommendation/routing layer that predicts the best model per input; can sit **on top of** gateways (e.g. OpenRouter Auto). Focus on accuracy + cost, including coding-agent cost control.
- **Best for:** Teams that already have a gateway and want intelligent selection without replacing infra.

#### Martian

- Real-time dynamic routing to best/cheapest model; YC-backed; intent-style classification narrative; vendor claims of large cost cuts (treat as directional, not guaranteed).

#### Unify AI

- Benchmark-driven routing across providers for quality / cost / speed.

---

### 4. Cloud-native / hyperscaler routers

| Product | Scope | How it routes |
| --- | --- | --- |
| **Amazon Bedrock Intelligent Prompt Routing** | Within a model family (e.g. Claude Sonnet↔Haiku, Llama sizes) | Predicts which member of the family can hit quality at lower cost; AWS cites up to ~30% savings without accuracy loss (within family). |
| **Microsoft Foundry Model Router** | Trained router model that picks among eligible deployed models | Analyzes complexity / reasoning / task type in real time; respects data zones and access. Deployed as a single chat model. |
| **OpenAI “unified system” (e.g. GPT-5 era)** | Internal product routing | Provider-side routing between fast main and deeper “thinking” paths — not a third-party gateway you control. |

Hyperscaler routers are excellent **inside one cloud / family**; they are not a full multi-vendor marketplace like OpenRouter.

---

### 5. Open-source & research routers

| Project | Role | Notes |
| --- | --- | --- |
| **[RouteLLM](https://github.com/lm-sys/RouteLLM)** (LMSYS) | Train/eval strong-vs-weak routers from preference data | Canonical research stack (ICLR 2025 lineage); reported ~2× cost reduction at similar quality; competitive with early commercial routers on cost efficiency. |
| **[Semantic Router](https://github.com/aurelio-labs/semantic-router)** (Aurelio) | Embedding-based ultra-fast route decisions | Intent/tool/model routing without a full LLM call; also related work in **vLLM Semantic Router**. |
| **LLMRouter** (UIUC et al.) | Library with many router model types | KNN, SVM, MLP, MF, graph, multimodal, agentic, etc. |
| **RoRF** (Not Diamond) | Open pairwise random-forest router | Research/SOTA-style open component. |
| **Pulze KNN router** | Minimal semantic nearest-neighbor ranking | Lightweight Go server. |
| **FrugalGPT, Hybrid LLM, AutoMix, EmbedLLM, …** | Academic cascade / meta-model / embedding routers | Foundational papers in the [awesome-ai-model-routing](https://github.com/Not-Diamond/awesome-ai-model-routing) list. |

---

## Head-to-head: who wins when?

| Need | Strong picks |
| --- | --- |
| One API + max model catalog, minimal ops | **OpenRouter** |
| Self-host, zero markup, full control | **LiteLLM** (ops cost is yours) |
| Production gateway: guardrails, cache, failover, governance | **Portkey** (also TrueFoundry, Kong if enterprise API shop) |
| Edge / free starter gateway | **Cloudflare AI Gateway** |
| Vercel / Next product stack | **Vercel AI Gateway** |
| Auto best/cheapest model per prompt | **Not Diamond**, **Martian**, **Unify**, OpenRouter Auto |
| Route on measured quality + evals | **Braintrust**, **Maxim Bifrost** |
| Observability first | **Helicone**, Portkey |
| AWS-only, within-family cost cut | **Bedrock Intelligent Prompt Routing** |
| Azure OpenAI / Foundry estate | **Microsoft Model Router** |
| Research / train your own router | **RouteLLM**, Semantic Router, LLMRouter |

Consensus across 2026 roundups (Braintrust, Not Diamond, Artifilog, Aiprosol, Requesty, and others): there is **no single winner** — tools optimize different jobs.

---

## Architecture patterns that work in production

```
App / Agent
    │
    ▼
┌─────────────────────────────┐
│  Gateway (LiteLLM/Portkey/  │  ← keys, cache, budgets, failover
│  Cloudflare/Vercel/Kong)    │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Smart router (optional)    │  ← Not Diamond / RouteLLM / rules
│  or provider Auto mode      │
└─────────────┬───────────────┘
              │
     ┌────────┼────────┐
     ▼        ▼        ▼
  Frontier  Mid-tier  Small/local
  models    models    models
              │
              ▼
     Observability + Evals
     (Helicone / Braintrust / Portkey traces)
```

**Important separation:** gateways optimize *ops*; intelligent routers optimize *model choice*; evals prove both aren’t quietly degrading quality.

---

## Pricing / TCO realities (easy to miss)

| Cost driver | Reality |
| --- | --- |
| Platform fee | OpenRouter ~**5.5%** on credits is the classic “convenience tax”; at high volume self-host LiteLLM often wins on pure $. |
| Gateway pricing | Portkey-style per-log / seat plans can dominate at high RPS — model tokens may not be the only bill. |
| Self-host | LiteLLM is “free” software; HA, Redis/Postgres, patches, on-call are not free. |
| Router latency | Classification adds ~ms–tens of ms; usually fine for chat, painful for ultra-low-latency voice/agents unless edge-local. |
| Quality regression | Biggest silent failure mode: cheaper routes that still return 200 OK but worse answers — only evals catch this. |

---

## Decision framework

1. **Prototype / multi-model exploration** → OpenRouter
2. **Shipping product, multi-provider, need reliability** → Portkey *or* LiteLLM (+ Helicone/Braintrust for visibility)
3. **VPC / compliance / high spend** → LiteLLM or Portkey self-host / TrueFoundry / Kong
4. **Want automatic model picking without building classifiers** → Not Diamond / Martian / OpenRouter Auto / Bedrock or Azure routers if single-cloud
5. **Agents with many tool routes (not just models)** → Semantic Router (intent) + gateway (providers)
6. **Optimize spend without quality drop** → intent or preference routers **plus** an eval set that mirrors production

---

## Bottom line

The **top of the market in 2026** clusters into three leaders-of-their-niche:

1. **OpenRouter** — widest managed model marketplace
2. **LiteLLM** — open-source control plane / proxy standard
3. **Portkey** — full production AI gateway (routing + guardrails + observability)

With a second tier of specialists:

- **Not Diamond / Martian** — smart selection
- **Vercel / Cloudflare** — platform-native gateways
- **Braintrust / Maxim** — eval-coupled routing
- **Kong / TrueFoundry** — enterprise platforms
- **Bedrock / Azure Model Router** — hyperscaler-native

Research foundations (**RouteLLM**, FrugalGPT-style cascades, semantic routers) are what commercial “AI routers” productize.

---

## Further reading

- [Best LLM routers and model routing platforms in 2026 (Braintrust)](https://www.braintrust.dev/articles/best-llm-routers-2026)
- [Best AI Model Routers in 2026 (Artifilog)](https://www.artifilog.com/posts/best-ai-model-routers)
- [The Top 10 AI Gateways for the Multi-Model Future (Not Diamond)](https://www.notdiamond.ai/blog/the-top-10-ai-gateways-for-the-multi-model-future-2026)
- [The LLM Gateway & Router Index (Aiprosol)](https://aiprosol.com/llm-gateways)
- [awesome-ai-model-routing](https://github.com/Not-Diamond/awesome-ai-model-routing)
- [RouteLLM (LMSYS)](https://www.lmsys.org/blog/2024-07-01-routellm/)
- [Amazon Bedrock multi-LLM routing strategies](https://aws.amazon.com/blogs/machine-learning/multi-llm-routing-strategies-for-generative-ai-applications-on-aws/)
- [Microsoft Foundry Model Router](https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-router)

---

*Research compiled July 2026. Pricing, model counts, and product features change quickly — verify current details on vendor docs before procurement.*
