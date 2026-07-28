# LLM Reseller Business Model Research

## Buying large packages from frontier providers and reselling to SMBs

| Field | Value |
| --- | --- |
| **Document** | Business model research |
| **Focus** | ChatGPT / OpenAI, Gemini / Google, multi-provider resale |
| **Audience** | AI Hay Router product & business strategy |
| **Status** | Research draft |
| **Last updated** | 2026-07-28 |
| **Disclaimer** | Not legal advice. Provider terms change frequently; verify with counsel and official partner contracts before committing capital. |

---

## 1. Executive summary

The idea—“buy a big enterprise deal from OpenAI, Google, etc., then resell tokens cheaper to SMBs”—is **intuitively attractive** and **partially real**, but it is **not a simple wholesale → retail arbitrage** like bulk buying software seats.

| Reality check | Detail |
| --- | --- |
| **Volume discounts exist** | Enterprise / committed-use deals often land **~10–35%** off list at meaningful annual spend (varies by provider and negotiation). |
| **Raw API resale is restricted** | Major labs generally **prohibit pure resale / service-bureau redistribution** of API access without explicit approval. |
| **ChatGPT seats ≠ API tokens** | ChatGPT Business/Enterprise is a **product subscription**; API is **usage-priced infrastructure**. Different contracts, channels, and rules. |
| **Legitimate paths exist** | (1) Authorized partner / CSP channels, (2) **value-added SaaS** (your app embeds models), (3) **marketplace / gateway** with commercial agreements (OpenRouter-class), (4) cloud marketplaces (Azure, GCP, AWS). |
| **SMB “cheaper than list” is hard** | Your edge is often **billing simplicity + multi-model + support**, not forever undercutting public API list after your fee and risk. |
| **For AI Hay Router** | Best fit is **authorized multi-model control plane + optional pass-through pricing**, not unauthorized key sharing or ChatGPT-subscription pooling. |

**Bottom line:** Treat this as a **channel + product business** (partner status, contracts, metering, support), not a pure commodity flip of tokens.

---

## 2. What “reseller” can mean (four distinct models)

People mix these up. Economics and legality differ sharply.

| Model | What you sell | How you buy | SMB value | Legal posture |
| --- | --- | --- | --- | --- |
| **A. Pure token arbitrage** | Raw OpenAI/Gemini API access under *your* key | Big prepaid / enterprise commit | “Cheaper than list” | **High risk** — often against ToS unless explicitly allowed |
| **B. Value-added SaaS** | Your product (CRM AI, support bot, vertical app); models are COGS | API at your cost | Outcome, not raw API | **Standard** — you are an ISV end customer of the lab |
| **C. Authorized channel / CSP** | Licensed cloud AI (e.g. Azure OpenAI, Microsoft 365 Copilot-adjacent paths) | Partner program margins | Invoice, local support, bundle | **Intended path** for classic resale |
| **D. Multi-model gateway / marketplace** | Unified API, billing, routing, failover | Mix of wholesale commits + PAYG + BYOK | One bill, many models, DX | Requires **commercial terms** with providers; OpenRouter-class |

**AI Hay Router** naturally maps to **D**, with elements of **B** if you ship vertical features. **A** alone is a trap.

---

## 3. Provider-by-provider landscape

### 3.1 OpenAI — ChatGPT vs API

#### ChatGPT (Business / Enterprise) — product seats

| Topic | Findings |
| --- | --- |
| **What it is** | Hosted ChatGPT product for teams/enterprises (workspace, admin, security), **not** unlimited wholesale API for your customers’ apps. |
| **Pricing shape** | Published Business tiers; **Enterprise = custom** (invoicing, volume discounts). |
| **Discounts** | Public/market signals: enterprise deals often **~10–20%+** off; peer-deal datasets cite bands roughly **10–15%** at ~$50–100K ACV and **up to ~35%** at **$500K+** annual spend (third-party benchmarks; not guarantees). |
| **Resale** | Community and historical channel guidance: **no simple “buy ChatGPT seats and resell as API.”** OpenAI sells ChatGPT primarily direct; partners historically co-sell **solutions**, not gray-market seat pooling. |
| **2026 Partner Network** | OpenAI launched a formal **Partner Network** (tiers: Select / Advanced / Elite) with co-sell, specializations (API, agents, Codex, etc.), and large enablement investment. This is **solution / practice partnership**, not automatic wholesale token dumping. |
| **Services Agreement note** | Business agreements reference payment to **OpenAI or Customer’s reseller** where applicable—resellers exist in **authorized** commercial structures, not DIY key resale. |

**Implication for SMBs:**  
Reselling **ChatGPT seats** only works if you are an **authorized path** (or you sell **services/implementation** around customer-owned ChatGPT). You generally **cannot** turn one Enterprise ChatGPT contract into a multi-tenant API for hundreds of unrelated SMBs.

#### OpenAI API — developer infrastructure

| Topic | Findings |
| --- | --- |
| **List pricing** | Public per-token rates; changes often. |
| **Built-in “discounts” (not reseller)** | **Batch / Flex** style tiers historically ~**50%** for non-real-time; **prompt caching** large savings on repeated prefixes; **Priority** tiers cost *more* for latency. These cut *your* COGS without being a partner deal. |
| **Enterprise volume** | Minimum commitments, invoicing, negotiated rates—sales-led. |
| **Resale of API access** | Industry legal analyses: terms typically **restrict resale/redistribution of the service / API access** as a pure pass-through. Building a **SaaS that uses** the API is different from **selling the API itself**. |
| **Outputs** | Customers generally **own model outputs** for commercial use under standard business terms (with liability limits)—that is **not** the same as reselling *access*. |

**OpenAI takeaway:**  
- **Wholesale ChatGPT → cheap multi-tenant API** ≈ **not viable**.  
- **Enterprise API commit → power your gateway for many end customers** ≈ only with **clear contractual right** to serve third parties and acceptable use; often structured as **you = customer**, end users = *your* users under *your* ToS—still scrutinized if you are a thin wrapper.  
- Prefer **Partner Network / co-sell** + **product value** over arbitrage narrative.

---

### 3.2 Google — Gemini (AI Studio / API vs Vertex / Cloud)

| Channel | Role | SMB reseller angle |
| --- | --- | --- |
| **Gemini Developer API (AI Studio)** | Fast start, published token prices, free/paid tiers | Poor pure-reseller path; rate limits and consumer/dev orientation |
| **Vertex AI / Gemini Enterprise Agent Platform** | Production, IAM, VPC, SLA, **volume-based discounts**, provisioned throughput | Real enterprise procurement; sales + commit |
| **Google Cloud Partner Advantage** | Integrators/resellers in GCP ecosystem | **Legitimate** path to resell cloud + AI with partner margins and customer billing constructs |

**Pricing notes (directional):**

- Public Gemini API: tiered $/1M tokens by model (Flash cheap → Pro expensive); free tiers restricted.
- Vertex often **premium vs AI Studio** (~industry commentary **10–20%** higher) for enterprise controls.
- **Enterprise / volume discounts** and **committed use** via Cloud sales—not a self-serve “buy $1M tokens at 40% off” button for new resellers.
- **Provisioned throughput**: pay for reserved capacity (availability), not just cheaper opportunistic tokens.

**Google takeaway:**  
Best reseller-like structure is **Google Cloud partner + Vertex** for SMBs already in (or willing to join) GCP billing—not scraping AI Studio keys into a gray API shop.

---

### 3.3 Anthropic — Claude

| Topic | Findings |
| --- | --- |
| **API commercial terms** | Strong restrictions on **resale of the Services** except as **expressly approved**; industry writeups group Anthropic with OpenAI/Google on **anti–thin-wrapper / anti-redistribution** themes. |
| **Consumer / Code subscriptions** | Explicit enforcement against using **Pro/Max/OAuth-style access** as a cheap API for third-party tools—**subscription ≠ wholesale API**. |
| **Cloud channels** | Claude also via **Amazon Bedrock**, **Google Vertex**—procurement may follow cloud partner norms. |

**Anthropic takeaway:**  
Do **not** build a business on pooling Claude consumer plans. Enterprise API or cloud marketplace, with approval for multi-tenant offering, is the serious path.

---

### 3.4 Microsoft — often the *real* classic reseller channel

| Program | Relevance |
| --- | --- |
| **Microsoft AI Cloud Partner Program** | Entry point for partners building/selling with Microsoft AI. |
| **Cloud Solution Provider (CSP)** | **Actual resale** of Microsoft cloud: bill customers, margins, distributors (indirect providers). |
| **Azure OpenAI / Microsoft Foundry models** | OpenAI models (and others) under **Microsoft commercial relationship**—enterprise procurement, data residency, invoicing. |
| **Startup credits** | e.g. Azure credits including Azure OpenAI-class models—helps **bootstrap COGS**, not a permanent margin model. |

**Microsoft takeaway:**  
If the goal is “buy big, resell to SMBs with invoices and support,” **Microsoft CSP + Azure OpenAI** is closer to traditional software resale than OpenAI.com direct API gray markets.

---

### 3.5 AWS Bedrock & multi-cloud

- **Bedrock**: many models (including Anthropic, etc.) under AWS billing; partners use **AWS Partner Network**, private pricing, EDPs (Enterprise Discount Programs) for large commits.
- SMB resale often means: **you are an AWS partner / MSP**, customer lands in an AWS account structure you manage, or you consume Bedrock as COGS inside your SaaS.

---

### 3.6 Marketplace aggregators (reference economics)

| Player | Model | Lesson for Hay |
| --- | --- | --- |
| **OpenRouter** | Unified API; pass-through provider rates; **~5.5% platform fee** on credit purchases; BYOK with fees after free tier | Customers pay for **convenience**, not always “below list.” CapitalG-scale business validates **marketplace**, not illegal arbitrage. |
| **Portkey / gateways** | Control plane fees + observability | Monetize **software**, not token spread alone. |
| **Cloud marketplaces** | Private offers, channel margins | Formal discounting and compliance. |

---

## 4. Unit economics: can you beat public list for SMBs?

### 4.1 Illustrative cost stack (API resale)

Assume you negotiate **20% off** OpenAI list on a **$500K/year** commit, then resell to SMBs.

| Line item | Example |
| --- | --- |
| Provider list cost | $1.00 |
| Your wholesale (−20%) | $0.80 |
| Payment processing / bad debt / support | $0.03–0.08 |
| Platform (gateway, logging, abuse) | $0.05–0.15 |
| Target gross margin | 15–30% of sell price |
| **Required SMB price** | Often **≈ $1.00–1.20** (at or **above** list) unless you run ultra-lean |

**Insight:** Volume discount is real, but **opex + risk + margin** often erase the ability to advertise “always cheaper than OpenAI.com” on pure tokens—especially after **price cuts by labs** (frequent) compress your negotiated advantage mid-contract.

### 4.2 When SMB price *can* look better

| Lever | How |
| --- | --- |
| **Routing** | Flash/mini for 70% of traffic; frontier only when needed → **effective** cost << all-frontier list |
| **Caching** | Prompt cache / semantic cache on repetitive SMB workloads (support, FAQ) |
| **Batch** | Non-real-time jobs at Batch/Flex-class discounts |
| **Bundles** | Include gateway, keys, spend caps, multi-model in one bill—**TCO** win even if token list matches |
| **Local currency / invoicing / tax handling** | Valuable in non-US SMB markets |
| **Pooled rate limits / higher tiers** | Reliability premium (careful: still multi-tenant risk) |

**The winning “compatible cost” story for SMBs is usually:**  
*“Lower total cost of getting production AI working”*—not *“we launder Enterprise ChatGPT into cheap GPT-4.”*

### 4.3 Capital and commitment risk

| Risk | Description |
| --- | --- |
| **Minimum commit** | You owe the provider even if SMB demand undershoots |
| **Prepay / credits** | Cash tied up; refunds limited (see marketplace norms) |
| **Price war** | Lab drops public prices 50%; your fixed commit looks expensive |
| **Model deprecation** | You marketed Model X; provider sunsets it |
| **Concentration** | One provider outage or ToS enforcement kills revenue |

SMBs want flexibility; **your** wholesale deal wants **predictable volume**. That mismatch is the core financial risk.

---

## 5. Legal & compliance (critical)

> **This is not legal advice.** Have counsel review each provider’s current Terms, Usage Policies, and any Order Form.

### 5.1 Common restrictions across labs

| Theme | Typical implication |
| --- | --- |
| **No resale of the service** | Cannot sell “OpenAI API access” as a commodity without approval |
| **No service bureau / unrestricted third-party use** | Multi-tenant gateway may need explicit rights or must be framed as *your* application service |
| **No competing model training** on outputs/data | Standard |
| **No abuse of consumer plans as API** | ChatGPT Plus / Claude Pro / etc. **≠** wholesale |
| **Acceptable use & geo / sanctions** | You inherit enforcement; SMBs can get *you* banned |
| **Data processing** | DPAs, residency, training opt-out—enterprise customers care |

### 5.2 Gray patterns that get people burned

1. One API key shared across many external customers with no app logic  
2. Selling “unlimited GPT” from a single ChatGPT Team/Enterprise login  
3. Scraping consumer UIs  
4. Claiming “official OpenAI reseller” without Partner status  
5. Ignoring subprocessor / privacy disclosures to SMB end customers  

### 5.3 Cleaner patterns

1. **ISV SaaS:** End users use *Hay product*; Hay is OpenAI/Google’s customer.  
2. **BYOK:** SMB uses their own keys; Hay charges software fee (aligns with OpenRouter BYOK).  
3. **Authorized partner:** CSP / Cloud Partner / OpenAI Partner Network with written resale rights.  
4. **Cloud marketplace private offer:** Discounted Azure/GCP/AWS AI for named customers.  
5. **Written amendment** allowing multi-tenant inference serving under your brand.

---

## 6. SMB buyer needs (what you actually sell)

SMBs rarely want “a cheaper raw token pipe” alone. They want:

| Need | Product implication |
| --- | --- |
| Predictable bills | Credits, hard caps, alerts |
| Simple start | One key, OpenAI-compatible API |
| Not locked to one lab | Multi-model (Hay strength) |
| Someone to call | Support, onboarding |
| Safety | Rate limits, basic guardrails, key isolation |
| Invoice / VAT | Especially non-US |
| Avoid hiring AI platform eng | Managed gateway |

**Price “compatibility”** = competitive with DIY OpenAI **plus** value of not running LiteLLM themselves.

---

## 7. Business model options for AI Hay Router

### Option 1 — Marketplace pass-through (OpenRouter-like)

| | |
| --- | --- |
| **Buy** | PAYG + selective commits where volume concentrates |
| **Sell** | Credits at provider list + **platform fee (e.g. 5–15%)** or small markup |
| **SMB pitch** | One API, many models, reliability—not always cheapest token |
| **Pros** | Scales with usage; lower commit risk |
| **Cons** | Fee-sensitive customers; race to zero on pure price |

### Option 2 — Wholesale commit + retail credits (classic reseller thesis)

| | |
| --- | --- |
| **Buy** | Annual commits on OpenAI / Vertex / Azure OpenAI at discount |
| **Sell** | SMB credits at list−X% or flat bundles |
| **Pros** | Real unit-cost advantage if volume materializes |
| **Cons** | Capital, ToS, inventory risk; thin margin after ops |

**Only pursue with legal green light + conservative volume forecasting.**

### Option 3 — Software margin primary (recommended core)

| | |
| --- | --- |
| **Buy** | API as COGS (mix PAYG + modest commits) |
| **Sell** | Subscription for gateway seats/projects + usage at near-pass-through |
| **SMB pitch** | Control plane: keys, routing, budgets, multi-model |
| **Pros** | Aligns with ToS; defensible; matches TypeScript product strategy |
| **Cons** | Must build real product value |

### Option 4 — Cloud partner / CSP hybrid

| | |
| --- | --- |
| **Buy/resell** | Azure OpenAI / GCP via partner programs |
| **Sell** | Managed AI stack + Hay router on top |
| **Pros** | Legitimate channel margins; enterprise-ready invoicing |
| **Cons** | Partner certifications, slower motion, cloud lock-in perception |

### Option 5 — Vertical bundles

| | |
| --- | --- |
| **Sell** | “AI for clinics / retail / local services” fixed monthly |
| **COGS** | Routed models under the hood |
| **Pros** | SMB understands price; less token education |
| **Cons** | Support-heavy; domain expertise required |

---

## 8. Strategic recommendation for Hay

### Do

1. **Position as multi-model control plane** for SMBs and mid-market, not “unofficial OpenAI wholesale.”  
2. **Use formal channels** where resale matters: Microsoft CSP / Azure OpenAI, Google Cloud partners, AWS, and—if eligible—**OpenAI Partner Network**.  
3. **Monetize software + reliability + routing** first; treat token spread as secondary.  
4. **Exploit cost levers that don’t require gray markets:** routing to cheap models, cache, batch, BYOK.  
5. **Isolate tenants:** per-customer keys/virtual keys, spend caps, abuse monitoring (protect your upstream accounts).  
6. **Negotiate commits only after organic volume** justifies them (avoid day-one $500K take-or-pay).  
7. **Separate ChatGPT seat business from API gateway business** in messaging and contracts.

### Don’t

1. Pool ChatGPT Business/Enterprise or Claude Pro as a hidden API.  
2. Promise permanent “below OpenAI list” without contract + buffer for price cuts.  
3. Claim official reseller status without enrollment.  
4. Skip counsel on multi-tenant inference + data processing terms.  
5. Put all margin hope on one frontier lab’s discount.

### Suggested phased commercial path

| Phase | Commercial move |
| --- | --- |
| **0–1** | PAYG upstream; sell Hay access (subscription and/or small platform fee); BYOK option |
| **2** | Join **1 cloud partner path** (Azure or GCP) for invoiceable mid-market deals |
| **2–3** | Negotiate **provider commits** only on models with stable demand; keep multi-provider |
| **3** | Explore **OpenAI Partner Network** co-sell for larger accounts; private offers |

---

## 9. Competitive dynamics

| Force | Effect on reseller margins |
| --- | --- |
| Labs cut public prices | Compresses wholesale advantage mid-contract |
| OpenRouter / gateways | Benchmark convenience pricing (~mid-single-digit % fees) |
| Open-weight + Groq/Together/etc. | SMBs can bypass frontier for many tasks |
| Direct enterprise sales by labs | Cream-skim large accounts; you get long-tail SMBs |
| Enforcement of anti-resale terms | Gray pure-resellers get cut off abruptly |

**Durable moat:** workflow, routing intelligence, trust, regional presence, vertical templates—not the discount spreadsheet.

---

## 10. Risk register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| ToS / account termination | Critical | Authorized use; value-added product; counsel |
| Commit undershoot | High | Ramp commits; flexible PAYG baseline |
| Provider price cuts | High | Short commits; multi-provider; software fees |
| SMB abuse / spam | High | Strict rate limits, KYC for high volume, auto-suspend |
| Support cost explosion | Medium | Self-serve docs, tiers, community |
| FX / tax complexity | Medium | Stripe Tax / local entity strategy |
| Liability for model outputs | Medium | ToS pass-through, acceptable use, optional insurance |
| Single-provider outage | Medium | Multi-model failover (product strength) |

---

## 11. Open questions for founders

1. Target geo (US vs EU vs SEA)—drives partner path and data residency.  
2. SMB vs mid-market ACV target—defines whether CSP motion is worth it.  
3. Willingness to hold **inventory risk** (commits) vs pure marketplace fee.  
4. Open-source core vs proprietary commercial gateway.  
5. Whether to pursue **ChatGPT implementation services** as a separate SKU from the API router.  
6. Legal entity and payment licenses if selling stored value (credits).

---

## 12. Bottom line

| Question | Answer |
| --- | --- |
| Can you buy big packages from ChatGPT/OpenAI, Gemini, etc.? | **Yes, as enterprise/partner/cloud commits**—not as unlimited consumer plan pooling. |
| Can you resell to SMBs cheaper? | **Sometimes on effective cost** (routing/cache/bundle); **hard on pure list arbitrage** after fees and risk. |
| Is pure token resale a clean business? | **Usually no**—ToS and economics fight you. |
| What works? | **Authorized channels + multi-model gateway product + software margin**, with optional volume commits once demand is proven. |
| Fit for AI Hay Router? | **Strong**—if Hay sells **control plane and unified access**, using wholesale discounts as COGS optimization, not as the whole company story. |

**One sentence:**  
The viable “reseller” model in 2026 is **becoming a trusted multi-model AI access and control layer for SMBs**, using partner programs and volume deals to improve COGS—not smuggling Enterprise ChatGPT into a discount API.

---

## 13. Primary references (start here)

- [OpenAI API Pricing](https://openai.com/api/pricing/)  
- [OpenAI Services Agreement](https://openai.com/policies/services-agreement/)  
- [OpenAI Partner Network announcement](https://openai.com/index/introducing-openai-partner-network/)  
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)  
- [Google Cloud Partners](https://cloud.google.com/partners)  
- [Microsoft CSP / Partner](https://partner.microsoft.com/partnership/cloud-solution-provider)  
- [OpenRouter pricing](https://openrouter.ai/pricing) (marketplace fee reference model)  
- Industry analyses on API resale restrictions (OpenAI / Anthropic terms roundups, 2025–2026)

---

## Related docs

- [AI Hay Router Product Spec](../design/product-spec.md)  
- [OpenRouter Overview](../openrouter-overview-2026.md)  
- [How to Build an AI Model Router](../how-to-build-ai-model-router.md)  
- [AI Model Routers Research Brief](../ai-model-routers-2026.md)  
