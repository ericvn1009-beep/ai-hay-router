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
| **Volume discounts exist** | Enterprise / committed-use deals can reduce cost. Depth is **negotiated and usually unpublished**. Third-party deal chatter sometimes cites roughly **~10–35%** off at meaningful annual spend — use only as a planning range, not a guaranteed rate card. |
| **Account and key resale is restricted** | Major labs restrict **reselling or leasing accounts** and **buying/selling/transferring API keys**. Pure “here is GPT on my key” shops are high risk. |
| **Product use of the API is normal** | OpenAI’s business terms allow putting the API inside a **Customer Application** and making it available to **End Users**. A real multi-model gateway/product is a different (and cleaner) pattern than key trading. |
| **ChatGPT seats ≠ API tokens** | ChatGPT Business/Enterprise is a **product subscription**; API is **usage-priced infrastructure**. Different contracts, channels, and rules. |
| **Legitimate paths exist** | (1) Authorized partner / CSP channels, (2) **value-added SaaS** (your app embeds models), (3) **marketplace / gateway** as *your* service (OpenRouter-class), (4) cloud marketplaces (Azure, GCP, AWS). |
| **SMB “cheaper than list” is hard** | Your edge is often **billing simplicity + multi-model + support + smart routing**, not forever undercutting public API list after your fee and risk. |
| **For AI Hay Router** | Best fit is a **multi-model control plane** (your product) with optional pass-through pricing and later volume commits — not unauthorized key sharing or ChatGPT-subscription pooling. |

**Bottom line:** Treat this as a **channel + product business** (partner status where needed, contracts, metering, support), not a pure commodity flip of tokens.

---

## 2. What “reseller” can mean (four distinct models)

People mix these up. Economics and legality differ sharply.

| Model | What you sell | How you buy | SMB value | Legal posture |
| --- | --- | --- | --- | --- |
| **A. Pure token / key arbitrage** | Raw OpenAI/Gemini API access under *your* shared key | Big prepaid / enterprise commit | “Cheaper than list” | **High risk** — account lease and API key transfer are restricted |
| **B. Value-added SaaS** | Your product (CRM AI, support bot, vertical app); models are COGS | API at your cost | Outcome, not raw API | **Standard** — you are an ISV / application customer of the lab |
| **C. Authorized channel / CSP** | Licensed cloud AI (e.g. Azure OpenAI) | Partner program margins | Invoice, local support, bundle | **Intended path** for classic resale |
| **D. Multi-model gateway / marketplace** | Unified API, billing, routing, failover | Mix of wholesale commits + PAYG + BYOK | One bill, many models, DX | Viable when framed as **your service/application**; large marketplaces may also hold private commercial terms with providers |

**AI Hay Router** naturally maps to **D**, with elements of **B** if you ship vertical features. **A** alone is a trap.

---

## 3. Provider-by-provider landscape

### 3.1 OpenAI — ChatGPT vs API

#### ChatGPT (Business / Enterprise) — product seats

| Topic | Findings |
| --- | --- |
| **What it is** | Hosted ChatGPT product for teams/enterprises (workspace, admin, security), **not** unlimited wholesale API for your customers’ apps. |
| **Pricing shape** | Published Business tiers; **Enterprise = custom** (invoicing, volume discounts). |
| **Discounts** | OpenAI markets volume discounts for Enterprise. Exact bands are **not public**. Peer-deal datasets and negotiation reports have cited roughly **10–15%** at mid six-figure ACV and **higher** (sometimes into the **~30%+** range) at very large annual spend — **anecdotal, not guaranteed**. |
| **Resale** | Business terms restrict **reselling or leasing accounts**. There is **no simple path** to “buy ChatGPT seats and resell as API.” Partners historically co-sell **solutions**, not gray-market seat pooling. |
| **2026 Partner Network** | OpenAI launched a formal **Partner Network** (tiers: Select / Advanced / Elite) with co-sell, specializations (API, agents, Codex, etc.), and large enablement investment. This is **solution / practice partnership**, not automatic wholesale token dumping. |
| **Services Agreement note** | Business agreements reference payment to **OpenAI or Customer’s reseller** where applicable — **authorized** resellers exist; that is not DIY key resale. |

**Implication for SMBs:**  
Reselling **ChatGPT seats** only works if you are on an **authorized path** (or you sell **services/implementation** around customer-owned ChatGPT). You generally **cannot** turn one Enterprise ChatGPT contract into a multi-tenant public API for hundreds of unrelated SMBs.

#### OpenAI API — developer infrastructure

| Topic | Findings |
| --- | --- |
| **List pricing** | Public per-token rates; changes often. |
| **Built-in cost levers (not reseller deals)** | Non-real-time / batch-style and flex-style capacity, **prompt caching**, and higher-priced priority/throughput tiers appear in OpenAI’s pricing toolkit. **Exact names and percentages change** — confirm on the live [Pricing Page](https://openai.com/api/pricing/). These cut *your* COGS without being a partner deal. |
| **Enterprise volume** | Minimum commitments, invoicing, negotiated rates — sales-led. Reducing commit can reduce or remove discounts. |
| **What is allowed** | Integrating the API into a **Customer Application** and making that application available to **End Users** is contemplated in OpenAI’s Services Agreement. |
| **What is restricted** | Reselling or leasing **Account** or **End User Account** access; **buying, selling, or transferring API keys**; sharing login credentials across users. |
| **Thin proxy vs product** | A genuine product (your keys to end users, your ToS, metering, routing) fits the Customer Application pattern better than “shared OpenAI key as a commodity.” You remain responsible for End User activity and acceptable use. |
| **Outputs** | Under standard business terms, customers generally **own model outputs** (with liability limits) — that is **not** the same as reselling *access*. |

**OpenAI takeaway:**  
- **Wholesale ChatGPT → cheap multi-tenant API** ≈ **not viable**.  
- **API inside Hay as your product for end users** ≈ **normal commercial pattern**, if you are not leasing accounts or trading keys.  
- **Enterprise API commit → lower COGS** ≈ possible via sales; discounts are real but unpublished.  
- Prefer **Partner Network / co-sell** + **product value** over pure arbitrage narrative.

---

### 3.2 Google — Gemini (AI Studio / API vs Vertex / Cloud)

| Channel | Role | SMB reseller angle |
| --- | --- | --- |
| **Gemini Developer API (AI Studio)** | Fast start, published token prices, free/paid tiers | Poor pure-reseller path; rate limits and consumer/dev orientation |
| **Vertex AI / Gemini Enterprise Agent Platform** | Production, IAM, VPC-style controls, SLA options, **volume-based discounts**, provisioned throughput | Real enterprise procurement; sales + commit |
| **Google Cloud Partner Advantage** | Integrators/resellers in GCP ecosystem | **Legitimate** path to resell cloud + AI with partner margins and customer billing constructs |

**Pricing notes (directional):**

- Public Gemini API: tiered $/1M tokens by model (Flash cheap → Pro expensive); free tiers restricted — check live tables.
- **Do not assume a fixed “Vertex is always 10–20% more expensive than AI Studio” markup.** Relative prices have varied by model and over time; compare current price lists.
- **Enterprise / volume discounts** and committed-use constructs via Cloud sales — not a self-serve “buy $1M tokens at 40% off” button for new resellers.
- **Provisioned throughput**: pay for reserved capacity (availability), not just cheaper opportunistic tokens.

**Google takeaway:**  
Best reseller-like structure is **Google Cloud partner + enterprise Gemini path** for SMBs already in (or willing to join) GCP billing — not scraping AI Studio keys into a gray API shop.

---

### 3.3 Anthropic — Claude

| Topic | Findings |
| --- | --- |
| **API / commercial use for products** | Commercial and API plans are the right surface for building products your customers use. Confirm current Commercial Terms with counsel. |
| **Resale / thin pass-through** | Industry analyses emphasize limits on **reselling the service** and funneling raw access with your credentials. Thin “API shops” face more scrutiny than vertical products. |
| **Consumer / Code subscriptions** | Strong enforcement against using **Pro/Max/OAuth-style access** as a cheap API for third-party tools — **subscription ≠ wholesale API**. |
| **Cloud channels** | Claude also via **Amazon Bedrock**, **Google Vertex** — procurement may follow cloud partner norms. |

**Anthropic takeaway:**  
Do **not** build a business on pooling Claude consumer plans. Enterprise API or cloud marketplace, with a real product layer, is the serious path.

---

### 3.4 Microsoft — often the *real* classic reseller channel

| Program | Relevance |
| --- | --- |
| **Microsoft AI Cloud Partner Program** | Entry point for partners building/selling with Microsoft AI. |
| **Cloud Solution Provider (CSP)** | **Actual resale** of Microsoft cloud: bill customers, margins, distributors (indirect providers). |
| **Azure OpenAI / Microsoft Foundry models** | OpenAI models (and others) under **Microsoft commercial relationship** — enterprise procurement, data residency, invoicing. |
| **Startup credits** | e.g. Azure credits including Azure OpenAI-class models — helps **bootstrap COGS**, not a permanent margin model. |

**Caveat:** Which AI SKUs are resellable through CSP, and at what margin, **changes**. Confirm current Partner Center catalog.

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
| **OpenRouter** | Unified API; stated **pass-through** provider token rates; **~5.5% platform fee** on credit card purchases (minimum fee applies); crypto ~5%; BYOK fees after a free tier | Customers pay for **convenience**, not always “below list.” |
| **Portkey / gateways** | Control plane fees + observability | Monetize **software**, not token spread alone. |
| **Cloud marketplaces** | Private offers, channel margins | Formal discounting and compliance. |

---

## 4. Unit economics: can you beat public list for SMBs?

### 4.1 Illustrative cost stack (API resale)

**Illustrative only — not empirical market data.**

Assume you negotiate **20% off** OpenAI list on a large annual commit (discount **not guaranteed**), then resell to SMBs.

| Line item | Example |
| --- | --- |
| Provider list cost | $1.00 |
| Your wholesale (−20%) | $0.80 |
| Payment processing / bad debt / support | $0.03–0.08 |
| Platform (gateway, logging, abuse) | $0.05–0.15 |
| Target gross margin | 15–30% of sell price |
| **Required SMB price** | Often **≈ $1.00–1.20** (at or **above** list) unless you run ultra-lean |

**Insight:** Volume discount can be real, but **opex + risk + margin** often erase the ability to advertise “always cheaper than OpenAI.com” on pure tokens — especially after **price cuts by labs** (frequent) compress your negotiated advantage mid-contract.

### 4.2 When SMB price *can* look better

| Lever | How |
| --- | --- |
| **Routing** | Flash/mini for most traffic; frontier only when needed → **effective** cost ≪ all-frontier list |
| **Caching** | Prompt cache / semantic cache on repetitive SMB workloads (support, FAQ) |
| **Batch / non-real-time tiers** | Where the provider offers discounted async capacity (check current pricing) |
| **Bundles** | Include gateway, keys, spend caps, multi-model in one bill — **TCO** win even if token list matches |
| **Local currency / invoicing / tax handling** | Valuable in non-US SMB markets |
| **Pooled reliability** | Higher effective limits as a managed service — careful multi-tenant abuse risk |

**The winning “compatible cost” story for SMBs is usually:**  
*“Lower total cost of getting production AI working”* — not *“we launder Enterprise ChatGPT into cheap GPT.”*

### 4.3 Capital and commitment risk

| Risk | Description |
| --- | --- |
| **Minimum commit** | You owe the provider even if SMB demand undershoots (minimums are often non-cancellable except limited cases). |
| **Prepay / credits** | Cash tied up; refunds limited. |
| **Price war** | Lab drops public prices; your fixed commit looks expensive. |
| **Model deprecation** | You marketed Model X; provider sunsets it. |
| **Concentration** | One provider outage or account enforcement kills revenue. |

SMBs want flexibility; **your** wholesale deal wants **predictable volume**. That mismatch is the core financial risk.

---

## 5. Legal & compliance (critical)

> **This is not legal advice.** Have counsel review each provider’s current Terms, Usage Policies, and any Order Form.

### 5.1 OpenAI (primary rules to design around)

| Rule | Plain English for Hay |
| --- | --- |
| Customer Applications for End Users | A real product/gateway with your users is the intended pattern |
| No resell/lease of Account or End User Account | Don’t rent ChatGPT or API logins |
| No buy/sell/transfer of API keys | Don’t traffic keys |
| No shared logins across people | Provision identities properly |
| Customer liable for End Users | SMB abuse hits *your* upstream account |
| Output ownership | Still not a license to resell OpenAI *the service* |
| Supported countries / trade controls | Geo and sanctions compliance on you |

### 5.2 Common restrictions across labs

| Theme | Typical implication |
| --- | --- |
| **No account / key commodity resale** | Cannot sell “provider access” as a raw key shop |
| **Thin pass-through scrutiny** | Pure proxy with little product surface carries more policy and liability risk than a full application |
| **No competing model training** on outputs/data (with narrow exceptions) | Standard |
| **No abuse of consumer plans as API** | ChatGPT Plus / Claude Pro / etc. **≠** wholesale |
| **Acceptable use & geo / sanctions** | You inherit enforcement; SMBs can get *you* banned |
| **Data processing** | DPAs, residency, training opt-out — enterprise customers care |

### 5.3 Gray patterns that get people burned

1. One API key shared across many external customers with no real application layer  
2. Selling “unlimited GPT” from a single ChatGPT Team/Enterprise login  
3. Scraping consumer UIs  
4. Claiming “official OpenAI reseller” without Partner or reseller status  
5. Ignoring subprocessor / privacy disclosures to SMB end customers  

### 5.4 Cleaner patterns

1. **ISV / Customer Application:** End users use *Hay product*; Hay is OpenAI/Google’s customer.  
2. **BYOK:** SMB uses their own keys; Hay charges software fee (aligns with OpenRouter BYOK).  
3. **Authorized partner:** CSP / Cloud Partner / OpenAI Partner Network with written channel rights.  
4. **Cloud marketplace private offer:** Discounted Azure/GCP/AWS AI for named customers.  
5. **Written order form / amendment** if counsel wants extra certainty for large multi-tenant inference.

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
| **Sell** | Credits at provider list + **platform fee** (OpenRouter reference: ~**5.5%** on card credit purchases — *their* model, not a requirement for you) |
| **SMB pitch** | One API, many models, reliability — not always cheapest token |
| **Pros** | Scales with usage; lower commit risk |
| **Cons** | Fee-sensitive customers; race to zero on pure price |

### Option 2 — Wholesale commit + retail credits (classic reseller thesis)

| | |
| --- | --- |
| **Buy** | Annual commits on OpenAI / Vertex / Azure OpenAI at discount |
| **Sell** | SMB credits at list−X% or flat bundles |
| **Pros** | Real unit-cost advantage if volume materializes |
| **Cons** | Capital, inventory risk; still must avoid key/account resale framing |

**Only pursue with legal green light + conservative volume forecasting.**

### Option 3 — Software margin primary (recommended core)

| | |
| --- | --- |
| **Buy** | API as COGS (mix PAYG + modest commits) |
| **Sell** | Subscription for gateway seats/projects + usage at near-pass-through |
| **SMB pitch** | Control plane: keys, routing, budgets, multi-model |
| **Pros** | Aligns with Customer Application pattern; defensible; matches TypeScript product strategy |
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
2. **Use formal channels** where classic resale matters: Microsoft CSP / Azure OpenAI, Google Cloud partners, AWS, and — if eligible — **OpenAI Partner Network**.  
3. **Monetize software + reliability + routing** first; treat token spread as secondary.  
4. **Exploit cost levers that don’t require gray markets:** routing to cheap models, cache, batch, BYOK.  
5. **Isolate tenants:** per-customer keys/virtual keys, spend caps, abuse monitoring (protect your upstream accounts).  
6. **Negotiate commits only after organic volume** justifies them (avoid day-one take-or-pay).  
7. **Separate ChatGPT seat business from API gateway business** in messaging and contracts.

### Don’t

1. Pool ChatGPT Business/Enterprise or Claude Pro as a hidden API.  
2. Buy, sell, or transfer provider API keys.  
3. Promise permanent “below OpenAI list” without contract + buffer for price cuts.  
4. Claim official reseller status without enrollment.  
5. Skip counsel on multi-tenant liability, acceptable use, and data processing.

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
| OpenRouter / gateways | Benchmark convenience pricing (~mid-single-digit % fees on credits) |
| Open-weight + Groq/Together/etc. | SMBs can bypass frontier for many tasks |
| Direct enterprise sales by labs | Cream-skim large accounts; you get long-tail SMBs |
| Enforcement against key/account abuse | Gray pure-resellers get cut off abruptly |

**Durable moat:** workflow, routing intelligence, trust, regional presence, vertical templates — not the discount spreadsheet.

---

## 10. Risk register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| ToS / account termination | Critical | Real product design; no key resale; counsel |
| Commit undershoot | High | Ramp commits; flexible PAYG baseline |
| Provider price cuts | High | Short commits; multi-provider; software fees |
| SMB abuse / spam | High | Strict rate limits, KYC for high volume, auto-suspend |
| Support cost explosion | Medium | Self-serve docs, tiers, community |
| FX / tax complexity | Medium | Stripe Tax / local entity strategy |
| Liability for model outputs | Medium | ToS pass-through, acceptable use, optional insurance |
| Single-provider outage | Medium | Multi-model failover (product strength) |

---

## 11. Open questions for founders

1. Target geo (US vs EU vs SEA) — drives partner path and data residency.  
2. SMB vs mid-market ACV target — defines whether CSP motion is worth it.  
3. Willingness to hold **inventory risk** (commits) vs pure marketplace fee.  
4. Open-source core vs proprietary commercial gateway.  
5. Whether to pursue **ChatGPT implementation services** as a separate SKU from the API router.  
6. Legal entity and payment licenses if selling stored value (credits).

---

## 12. Bottom line

| Question | Answer |
| --- | --- |
| Can you buy big packages from ChatGPT/OpenAI, Gemini, etc.? | **Yes, as enterprise/partner/cloud commits** — not as unlimited consumer plan pooling. |
| Can you resell to SMBs cheaper? | **Sometimes on effective cost** (routing/cache/bundle); **hard on pure list arbitrage** after fees and risk. |
| Is pure token/key resale a clean business? | **No** — account lease and API key trading are restricted. |
| Is a multi-model gateway illegal by default? | **Not automatically** — OpenAI contemplates Customer Applications for End Users; design, liability, and acceptable use still matter. |
| What works? | **Authorized channels + multi-model gateway product + software margin**, with optional volume commits once demand is proven. |
| Fit for AI Hay Router? | **Strong** — if Hay sells **control plane and unified access**, using wholesale discounts as COGS optimization, not as the whole company story. |

**One sentence:**  
The viable “reseller” model in 2026 is **becoming a trusted multi-model AI access and control layer for SMBs**, using partner programs and volume deals to improve COGS — not smuggling Enterprise ChatGPT into a discount API or trading provider keys.

---

## 13. Primary references (start here)

- [OpenAI API Pricing](https://openai.com/api/pricing/)  
- [OpenAI Services Agreement](https://openai.com/policies/services-agreement/)  
- [OpenAI Partner Network announcement](https://openai.com/index/introducing-openai-partner-network/)  
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)  
- [Google Cloud Partners](https://cloud.google.com/partners)  
- [Microsoft CSP / Partner](https://partner.microsoft.com/partnership/cloud-solution-provider)  
- [OpenRouter pricing](https://openrouter.ai/pricing) (marketplace fee reference model)  

---

## Related docs

- [AI Hay Router Product Spec](../design/product-spec.md)  
- [OpenRouter Overview](../openrouter-overview-2026.md)  
- [How to Build an AI Model Router](../how-to-build-ai-model-router.md)  
- [AI Model Routers Research Brief](../ai-model-routers-2026.md)  
