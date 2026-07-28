# LLM Reseller Business Model Research

## Buying large packages from frontier providers and reselling to SMBs

| Field | Value |
| --- | --- |
| **Document** | Business model research |
| **Focus** | ChatGPT / OpenAI, Gemini / Google, multi-provider resale |
| **Audience** | AI Hay Router product & business strategy |
| **Status** | Research draft + **fact-check pass** |
| **Last updated** | 2026-07-28 |
| **Fact-check pass** | 2026-07-28 (primary terms + pricing pages re-checked) |
| **Disclaimer** | Not legal advice. Provider terms change frequently; verify with counsel and official partner contracts before committing capital. |

---

## Fact-check log (2026-07-28)

Second-pass verification of claims in this document against primary or high-quality sources. Use this section as the confidence layer; corrected text is reflected in the body below.

| Claim (v1 draft) | Verdict | Evidence / correction |
| --- | --- | --- |
| Enterprise volume discounts often **~10–35%** | **Partially verified — soft** | OpenAI publicly lists “volume discounts” on Enterprise; **no official public discount schedule**. Third-party deal intelligence (e.g. Vendr-style peer sets) has cited bands ~10–15% at mid six figures and higher at ~$500K+ — **anecdotal/negotiated, not a guarantee**. Body now labels this clearly. |
| Labs **prohibit pure resale** of API access | **Mostly verified — nuance added** | OpenAI Services Agreement (effective 2026-01-01): **may not resell or lease Account / End User Account**; **may not buy, sell, or transfer API keys**. Consumer ToU also restricts selling/distributing Services. **However**, OSA §2.2 **explicitly allows** integrating the API into **Customer Applications** and making them available to **End Users**. So: **key/account resale banned**; **product/SaaS that uses the API is contemplated**. |
| Multi-tenant gateway needs special approval | **Overstated → corrected** | If Hay is a genuine **Customer Application** (own ToS, own keys to end users, metering), OpenAI’s OSA contemplates End Users. Risk rises for **thin key proxy / account leasing**. Still: you remain liable for End User misuse; counsel still required. OpenRouter-class pure marketplaces may rely on **commercial arrangements** not fully public. |
| ChatGPT seats ≠ API | **Verified** | Separate products, pricing pages, and contracts (ChatGPT Business/Enterprise vs API usage). |
| Cannot turn one ChatGPT Enterprise contract into multi-tenant API | **Verified (practical + ToS)** | ChatGPT is not wholesale API capacity; account resale/lease restricted; consumer/team pooling for third-party API is a classic enforcement target industry-wide. |
| OpenAI Partner Network tiers Select / Advanced / Elite | **Verified** | Official announcement (2026-06-14): three tiers; co-sell/enablement focus — **not** automatic token wholesale. |
| “Customer’s reseller” in OpenAI payment terms | **Verified** | OSA §6: pay OpenAI **or Customer’s reseller** — implies **authorized** resellers exist; not DIY gray market. |
| Batch / Flex ~**50%** off | **Directional — verify live pricing** | Widely documented OpenAI discount modes for non-real-time / flex capacity; **exact % and model availability change**. Body says “check current Pricing Page” rather than hardcoding forever. |
| Priority pricing costs more | **Directional** | OpenAI has sold higher-price priority/throughput tiers; confirm current names/rates on Pricing Page. |
| Prompt caching large savings | **Verified as concept** | OpenAI documents cached-input discounts; percentages vary by model/era. |
| Gemini: free/paid API + enterprise volume via Cloud | **Verified** | Official Gemini API pricing distinguishes free/paid; enterprise materials cite volume discounts / provisioned throughput on Cloud/Agent Platform paths. |
| Vertex **10–20%** more expensive than AI Studio | **Weak — downgraded** | **Not an official Google multiplier.** Historical community comparisons sometimes showed differences; other sources say rates can **match**. Body no longer treats 10–20% as fact. |
| Google Cloud Partner path for legitimate resale | **Verified as category** | Partner Advantage / Cloud partner programs exist; exact AI margin schedules are partner-private. |
| Anthropic restricts resale; consumer plans ≠ API | **Mostly verified** | Industry reporting + enforcement against Pro/Max/OAuth used as third-party API. Commercial/API use for **customer-facing products** is often allowed under commercial terms; **subscription pooling is not**. Avoid overstating “all wrappers banned.” |
| Microsoft CSP is real cloud resale | **Verified** | Official Microsoft CSP / Partner Center: partners resell Microsoft cloud, including paths involving Azure AI services (product matrix evolves). |
| Azure OpenAI / Foundry under Microsoft commercial relationship | **Verified as architecture** | Models available via Microsoft cloud commercial terms, not the same as openai.com gray key resale. |
| OpenRouter **5.5%** fee on credit purchases; pass-through tokens | **Verified** | Official OpenRouter pricing + FAQ (card 5.5% min ~$0.80; crypto 5%; BYOK fee after free tier). Note: some third-party posts claim markups on specific routes — treat **catalog pass-through** as OpenRouter’s stated policy, monitor exceptions. |
| OpenRouter “CapitalG / unicorn” scale | **Removed as load-bearing claim** | Fundraising coverage exists in press; **not required** for the business thesis. Body focuses on fee model, not valuation. |
| Illustrative unit economics ($1 → $0.80 wholesale → SMB ≥ list) | **Illustrative only — not data** | Teaching model; opex bands are estimates. Labeled as such. |
| “Service bureau” language | **Softened** | Not always the providers’ exact legal phrase; kept as plain-English risk category. |

**Overall fact-check conclusion:**  
The **strategic thesis holds**: pure token arbitrage is hard; ChatGPT ≠ API; cloud partner channels are the classic reseller path; software + control plane is the cleanest Hay model.  
The main **correction** is legal nuance: OpenAI **does** allow API use inside **Customer Applications for End Users**; what it clearly forbids is **reselling/leasing accounts and trading API keys**.

---

## 1. Executive summary

The idea—“buy a big enterprise deal from OpenAI, Google, etc., then resell tokens cheaper to SMBs”—is **intuitively attractive** and **partially real**, but it is **not a simple wholesale → retail arbitrage** like bulk buying software seats.

| Reality check | Detail | Confidence |
| --- | --- | --- |
| **Volume discounts exist** | Enterprise / committed-use deals are negotiated; **discounts are real but unpublished**. Third-party deal chatter often cites roughly **low-teens to mid-thirties percent** off at high ACV — **not a published rate card**. | Medium |
| **Account/key resale restricted** | OpenAI (and peers) restrict **reselling/leasing accounts** and **buying/selling API keys**. Pure “here’s GPT access on my key” shops are high risk. | High |
| **Product/SaaS using models is normal** | OpenAI OSA grants rights to put the API in **Customer Applications** for **End Users**. Value-added products are the intended commercial pattern. | High |
| **ChatGPT seats ≠ API tokens** | ChatGPT Business/Enterprise = product seats; API = usage infrastructure. Different contracts and channels. | High |
| **Legitimate channel paths** | Microsoft CSP / cloud partners, Google Cloud partners, AWS partners, authorized OpenAI resellers/partners, cloud private offers. | High |
| **SMB “cheaper than list” is hard on pure tokens** | After platform cost, support, risk, and margin, undefeated undercutting of public list is rare; **effective cost** wins via routing/cache/bundles. | High (logic) |
| **For AI Hay Router** | Best fit: **multi-model control plane / Customer Application** (+ optional marketplace fees), not ChatGPT pooling or raw key resale. | High |

**Bottom line:** Treat this as a **channel + product business** (partner status where needed, contracts, metering, support), not a pure commodity flip of tokens.

---

## 2. What “reseller” can mean (four distinct models)

People mix these up. Economics and legality differ sharply.

| Model | What you sell | How you buy | SMB value | Legal posture |
| --- | --- | --- | --- | --- |
| **A. Pure token / key arbitrage** | Raw model API under *your* shared key; little product | Big prepaid / enterprise commit | “Cheaper than list” | **High risk** — key transfer & account lease restrictions |
| **B. Value-added SaaS** | Your product (CRM AI, support bot, vertical app); models are COGS | API at your cost | Outcome, not raw API | **Standard Customer Application** pattern |
| **C. Authorized channel / CSP** | Licensed cloud AI under partner programs | Partner program margins / private offers | Invoice, local support, bundle | **Intended classic resale path** |
| **D. Multi-model gateway / marketplace** | Unified API, billing, routing, failover | PAYG + optional commits + BYOK | One bill, many models, DX | **OK if framed as your service/app**; pure pass-through still carries policy & liability load; large marketplaces often have private commercial terms |

**AI Hay Router** maps primarily to **D + B** (gateway product users call). **A** alone is a trap. **C** is optional for invoice-heavy mid-market.

---

## 3. Provider-by-provider landscape

### 3.1 OpenAI — ChatGPT vs API

#### ChatGPT (Business / Enterprise) — product seats

| Topic | Findings | Confidence |
| --- | --- | --- |
| **What it is** | Hosted ChatGPT for teams/enterprises (workspace, admin, security). **Not** wholesale API capacity for arbitrary third-party apps. | High |
| **Pricing shape** | Published Business tiers; **Enterprise = custom** (invoicing; OpenAI markets volume discounts). | High |
| **Discount depth** | **Not public.** Third-party negotiation datasets have reported ~10–15% at mid enterprise ACV and higher at very large commits — use only as **negotiation folklore**, not planning certainty. | Low–medium |
| **Resale** | OSA: **no resell/lease of Account or End User Account**. Industry practice: no simple “buy Enterprise seats → expose as public API.” Partners co-sell **solutions**, not gray seat pools. | High |
| **2026 Partner Network** | Official program (Select / Advanced / Elite), co-sell, specializations (API, agents, Codex, etc.). **Solution partnership**, not automatic token wholesale. | High |
| **Authorized resellers** | OSA payment language contemplates **Customer’s reseller** — i.e. formal channel, not DIY. | High |

**Implication:** Reselling **ChatGPT seats** only via **authorized** paths or as **implementation services** on the customer’s own tenant. Do **not** convert one Enterprise ChatGPT contract into a multi-tenant public API.

#### OpenAI API — developer infrastructure

| Topic | Findings | Confidence |
| --- | --- | --- |
| **List pricing** | Public per-token Pricing Page; changes often (OSA: price changes effective after notice window). | High |
| **Built-in cost levers (not “reseller deals”)** | Batch / flex-style discounted capacity, prompt caching, and higher-priced priority tiers appear in OpenAI’s commercial pricing toolkit — **confirm current names and % on the live Pricing Page**. | Medium (details drift) |
| **Enterprise volume** | Minimum commitments, invoicing, negotiated rates — sales-led; reducing commitment can remove discounts (OSA renewal language). | High |
| **What you may do** | OSA §2.2: use API in **Customer Applications** and make them available to **End Users**. | High |
| **What you may not do** | Resell/lease Account or End User Account; **buy/sell/transfer API keys**; share login credentials across users. | High |
| **Outputs** | As between Customer and OpenAI, Customer owns Output (with standard disclaimers). Ownership of output ≠ right to resell *access*. | High |
| **Liability** | Customer responsible for End User activity under its Account / Application. | High |

**OpenAI takeaway (fact-checked):**

- **Wholesale ChatGPT → cheap multi-tenant API** → **not viable**.  
- **API inside Hay as Customer Application** → **contemplated by OSA**, if you are not leasing OpenAI accounts/keys.  
- **Enterprise commit → lower COGS** → possible via sales, **unpublished discounts**.  
- Prefer **product value + Partner Network/co-sell** over arbitrage narrative.

---

### 3.2 Google — Gemini (AI Studio / API vs Vertex / Cloud)

| Channel | Role | SMB reseller angle | Confidence |
| --- | --- | --- | --- |
| **Gemini Developer API (AI Studio)** | Fast start, published token prices, free/paid tiers | Weak pure-reseller path; rate limits; dev-oriented | High |
| **Vertex / Gemini Enterprise Agent Platform** | Production controls, IAM/VPC-style enterprise features, provisioned throughput, sales motion | Real enterprise procurement | High |
| **Google Cloud Partner programs** | Integrators/resellers in GCP ecosystem | Legitimate **cloud** resale / managed service path | High (program exists; margins private) |

**Pricing notes (fact-checked):**

- Public Gemini API: tiered $/1M tokens by model; free tiers restricted — **check live tables**.  
- **Do not assume** Vertex is always “10–20% more expensive” than AI Studio; that figure was **secondary commentary** and may be outdated or model-specific. Compare **current** price lists.  
- Enterprise volume discounts / committed constructs are **sales-negotiated**, not a self-serve wholesale storefront for new resellers.  
- **Provisioned throughput** = reserved capacity/availability economics, not pure opportunistic cheap tokens.

**Google takeaway:**  
Best reseller-like structure remains **Cloud partner + enterprise Gemini path**, not gray AI Studio key shops.

---

### 3.3 Anthropic — Claude

| Topic | Findings | Confidence |
| --- | --- | --- |
| **Commercial / API use for products** | Anthropic commercial posture generally allows building products for your customers **on API/commercial plans** (confirm current Commercial Terms). | Medium–high |
| **Resale / redistribution risk** | Secondary legal analyses emphasize limits on **reselling the service** and on using credentials to funnel raw access; **thin wrappers** face scrutiny. | Medium (prefer primary counsel review) |
| **Consumer Pro/Max / OAuth as API** | Strong enforcement narrative: **subscriptions are not wholesale API** for third-party tools. | High (behavior + reporting) |
| **Cloud channels** | Claude on **Bedrock**, **Vertex**, etc. — procurement can follow cloud partner norms. | High |

**Anthropic takeaway:**  
Do **not** build on pooled consumer plans. Use **API/commercial or cloud marketplace**, with a real product layer.

---

### 3.4 Microsoft — classic reseller channel

| Program | Relevance | Confidence |
| --- | --- | --- |
| **Microsoft AI Cloud Partner Program** | Entry for partners building/selling with Microsoft AI | High |
| **Cloud Solution Provider (CSP)** | Real **resale** of Microsoft cloud (direct/indirect models) | High |
| **Azure OpenAI / Microsoft Foundry models** | OpenAI and other models under **Microsoft** commercial relationship | High |
| **Startup credits** | Bootstrap COGS (e.g. Azure credits including AI models) — **not** a permanent margin model | High as category |

**Caveat:** CSP catalog, incentives, and which AI SKUs are resellable **change**. “CSP” ≠ automatic right to resell every OpenAI.com API feature one-for-one.

**Microsoft takeaway:**  
Closest traditional “buy and resell to SMBs with invoices” motion is **Microsoft partner/CSP + Azure AI**, not openai.com gray markets.

---

### 3.5 AWS Bedrock & multi-cloud

- Bedrock hosts multiple model providers under **AWS billing**.  
- Large customers use **Enterprise Discount Programs (EDP)** / private pricing — **not public**.  
- SMB motion: AWS partner/MSP structure, or Bedrock as **COGS inside your SaaS**.  
Confidence: **High** on structure; **Low** on specific discount %.

---

### 3.6 Marketplace aggregators (reference economics)

| Player | Model (verified) | Lesson for Hay |
| --- | --- | --- |
| **OpenRouter** | Unified API; stated **pass-through** provider token rates; **~5.5%** platform fee on card credit purchases (min fee applies); crypto ~5%; BYOK has separate fee after free tier | Customers often pay for **convenience**, not pure undercutting |
| **Portkey-class gateways** | Software / control-plane monetization | Monetize product, not only token spread |
| **Cloud marketplaces** | Private offers, channel margins | Formal discounting + compliance |

Confidence on OpenRouter fee structure: **High** (official pricing/FAQ as of fact-check date).

---

## 4. Unit economics: can you beat public list for SMBs?

### 4.1 Illustrative cost stack (API resale)

**Illustrative only — not empirical market data.**

Assume you negotiate **20% off** list on a large annual commit (discount **not guaranteed**), then resell to SMBs:

| Line item | Example |
| --- | --- |
| Provider list cost | $1.00 |
| Your wholesale (−20%) | $0.80 |
| Payment processing / bad debt / support | $0.03–0.08 (estimate) |
| Platform (gateway, logging, abuse) | $0.05–0.15 (estimate) |
| Target gross margin | 15–30% of sell price (business choice) |
| **Required SMB price** | Often **≈ list or above** unless ultra-lean |

**Insight (logic-tested, still valid):** Volume discount can be real, but **opex + risk + margin** often erase “always cheaper than provider.com” on pure tokens—especially after **lab price cuts** mid-contract.

### 4.2 When SMB price *can* look better

| Lever | How | Confidence |
| --- | --- | --- |
| **Routing** | Cheap/small models for most traffic; frontier only when needed | High (product strategy) |
| **Caching** | Provider prompt cache + optional semantic cache | High |
| **Batch / non-real-time tiers** | Where provider offers discounted async capacity | Medium (availability drifts) |
| **Bundles** | Gateway + caps + multi-model = better **TCO** even at list tokens | High |
| **Local invoice / tax / currency** | Material for non-US SMBs | High |
| **Pooled reliability** | Higher effective limits — careful multi-tenant risk | Medium |

**Winning pitch:** lower **total cost of production AI**, not “laundered Enterprise ChatGPT.”

### 4.3 Capital and commitment risk

| Risk | Description | Confidence |
| --- | --- | --- |
| **Minimum commit** | You may owe the provider if demand undershoots (OSA: minimums non-cancellable except limited cases) | High |
| **Prepay / credits** | Cash tied up; refunds often limited | High |
| **Price war** | Public cuts make fixed commits look expensive | High |
| **Model deprecation** | Marketing SKU disappears | High |
| **Concentration** | One provider ban/outage | High |

---

## 5. Legal & compliance (critical)

> **Not legal advice.** Re-read current Terms, Usage Policies, Order Forms, and DPAs with counsel.

### 5.1 OpenAI-specific (primary source)

From the **OpenAI Services Agreement** (effective **2026-01-01**, retrieved fact-check pass):

| Rule | Plain English for Hay |
| --- | --- |
| Right to build **Customer Applications** for **End Users** | A real product/gateway with your users is the intended pattern |
| No **resell/lease** of Account or End User Account | Don’t rent ChatGPT/API logins |
| No **buy/sell/transfer of API keys** | Don’t traffic keys |
| No shared logins across people | Per-user provisioning where End User Accounts exist |
| Customer liable for End Users | Abuse by SMB customers hits *your* account |
| Output ownership → Customer | Still not a license to resell OpenAI the service |
| Supported countries / trade controls | Geo and sanctions compliance on you |

### 5.2 Cross-lab themes (secondary + pattern)

| Theme | Implication | Confidence |
| --- | --- | --- |
| Consumer plan ≠ API wholesale | No ChatGPT Plus / Claude Pro pooling | High |
| Acceptable use inherited | SMB spam can ban your upstream | High |
| Competing model training limits | Standard restriction on using outputs to train competitors (with narrow exceptions) | High |
| Thin pure proxy scrutiny | Higher policy/liability risk than vertical SaaS | Medium–high |

### 5.3 Gray patterns that get people burned

1. One API key shared across many external customers with no real application layer  
2. Selling “unlimited GPT” from a single ChatGPT Team/Enterprise login  
3. Scraping consumer UIs  
4. Claiming “official OpenAI reseller” without Partner/reseller status  
5. Skipping privacy/subprocessor disclosures to SMB customers  

### 5.4 Cleaner patterns

1. **Customer Application:** End users use *Hay*; Hay is the lab’s Customer.  
2. **BYOK:** SMB keys; Hay charges software/control-plane fees.  
3. **Authorized cloud partner / CSP / private offer.**  
4. **Documented Partner Network / reseller enrollment** before using “official” language.  
5. **Written order forms** for multi-tenant inference if your counsel wants extra certainty at scale.

---

## 6. SMB buyer needs (what you actually sell)

| Need | Product implication |
| --- | --- |
| Predictable bills | Credits, hard caps, alerts |
| Simple start | One key, OpenAI-compatible API |
| Not locked to one lab | Multi-model |
| Support | Onboarding, docs, tiers |
| Safety | Rate limits, key isolation, basic guardrails |
| Invoice / VAT | Especially non-US |
| Avoid platform engineering | Managed gateway |

**“Compatible cost”** = competitive with DIY provider APIs **plus** value of not self-hosting LiteLLM/ops.

---

## 7. Business model options for AI Hay Router

### Option 1 — Marketplace pass-through (OpenRouter-like)

| | |
| --- | --- |
| **Buy** | PAYG + selective commits where volume concentrates |
| **Sell** | Credits near provider list + **platform fee** (OpenRouter reference: **~5.5%** on card top-ups — *their* model, not a legal requirement for you) |
| **Pros** | Lower commit risk |
| **Cons** | Fee-sensitive buyers; pure price race |

### Option 2 — Wholesale commit + retail credits

| | |
| --- | --- |
| **Buy** | Annual commits (OpenAI / Vertex / Azure OpenAI) at negotiated discount |
| **Sell** | SMB credits at list−X% or bundles |
| **Pros** | Unit-cost edge **if** volume hits |
| **Cons** | Capital, inventory risk; still must avoid key/account resale framing |

**Only with legal green light + conservative forecasts.**

### Option 3 — Software margin primary (**recommended core**)

| | |
| --- | --- |
| **Buy** | API as COGS |
| **Sell** | Subscription for gateway + near-pass-through usage |
| **Pros** | Aligns with OSA Customer Application pattern; defensible |
| **Cons** | Must ship real product value |

### Option 4 — Cloud partner / CSP hybrid

| | |
| --- | --- |
| **Buy/resell** | Azure / GCP / AWS AI via partner programs |
| **Sell** | Managed stack + Hay router |
| **Pros** | Classic invoicing channel |
| **Cons** | Certifications, slower sales motion |

### Option 5 — Vertical bundles

| | |
| --- | --- |
| **Sell** | Fixed monthly “AI for X industry” |
| **COGS** | Routed models underneath |
| **Pros** | SMB-friendly packaging |
| **Cons** | Support-heavy |

---

## 8. Strategic recommendation for Hay

### Do

1. Position as **multi-model control plane / Customer Application**, not unofficial wholesale.  
2. Use **formal channels** when reselling cloud SKUs (CSP / Cloud partners).  
3. Monetize **software + reliability + routing** first; token spread second.  
4. Use **routing, cache, batch, BYOK** for cost wins that don’t require gray markets.  
5. **Isolate tenants** (virtual keys, caps, abuse controls).  
6. Negotiate **commits only after organic volume**.  
7. Keep **ChatGPT seat services** separate from **API gateway** messaging.

### Don’t

1. Pool ChatGPT Business/Enterprise or Claude consumer plans as hidden API.  
2. Buy/sell/transfer provider API keys.  
3. Promise permanent “below list” without contract + buffer.  
4. Claim official reseller status without enrollment.  
5. Skip counsel on multi-tenant liability and privacy.

### Suggested phased commercial path

| Phase | Commercial move |
| --- | --- |
| **0–1** | PAYG upstream; Hay subscription and/or small platform fee; BYOK |
| **2** | One cloud partner path (Azure or GCP) for invoiceable deals |
| **2–3** | Commits only on stable demand models |
| **3** | OpenAI Partner Network / co-sell where eligible |

---

## 9. Competitive dynamics

| Force | Effect |
| --- | --- |
| Lab public price cuts | Compress wholesale advantage |
| OpenRouter-class fees | Benchmark for convenience pricing (~mid-single-digit % on credits) |
| Cheap/fast open-weight hosts | Bypass frontier for many tasks |
| Direct enterprise sales by labs | You get long-tail SMBs |
| Enforcement against key/account abuse | Gray pure-resellers get cut off |

**Durable moat:** product workflow, routing, trust, regional presence — not the discount spreadsheet alone.

---

## 10. Risk register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| ToS / account termination | Critical | Customer Application design; no key resale; counsel |
| Commit undershoot | High | Ramp commits; PAYG baseline |
| Provider price cuts | High | Short commits; multi-provider; software fees |
| SMB abuse | High | Limits, KYC for high volume, suspend |
| Support cost | Medium | Self-serve + tiers |
| FX / tax / stored-value credits | Medium | Payments counsel; Stripe Tax etc. |
| Output liability | Medium | ToS, AUP, human-in-loop guidance |
| Single-provider outage | Medium | Multi-model failover |

---

## 11. Open questions for founders

1. Target geo (US / EU / SEA) — residency and partner path.  
2. SMB vs mid-market ACV — is CSP motion worth it?  
3. Commit inventory risk tolerance.  
4. OSS core vs proprietary commercial.  
5. Separate SKU for ChatGPT implementation services?  
6. Stored-value credit regulations in target markets.

---

## 12. Bottom line

| Question | Fact-checked answer |
| --- | --- |
| Can you buy big packages from ChatGPT/OpenAI, Gemini, etc.? | **Yes, as enterprise/cloud/partner commits** — not by pooling consumer/team ChatGPT as API. |
| Can you resell to SMBs cheaper? | **Sometimes on effective cost** (routing/cache/bundle). **Hard as pure list arbitrage.** |
| Is pure token/key resale clean? | **No** — OpenAI explicitly bans account lease and API key trading. |
| Is a multi-model gateway illegal by default? | **Not automatically** — OpenAI contemplates **Customer Applications for End Users**; design, liability, and AUP still matter. |
| What works for Hay? | **Control plane + unified access + software margin**, optional commits and cloud partner motion. |

**One sentence:**  
The viable 2026 “reseller” story is **trusted multi-model access and control for SMBs**, using partner programs and volume deals to improve COGS—not smuggling Enterprise ChatGPT or trading API keys.

---

## 13. Primary references (fact-check anchors)

- [OpenAI Services Agreement](https://openai.com/policies/services-agreement/) (esp. §§2.2, 3.1, 3.3, 6; End User / Customer Application definitions)  
- [OpenAI API Pricing](https://openai.com/api/pricing/)  
- [OpenAI Partner Network announcement](https://openai.com/index/introducing-openai-partner-network/)  
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)  
- [Google Cloud Partners](https://cloud.google.com/partners)  
- [Microsoft CSP](https://partner.microsoft.com/partnership/cloud-solution-provider)  
- [OpenRouter Pricing](https://openrouter.ai/pricing) / [OpenRouter FAQ](https://openrouter.ai/docs/faq)  

Secondary (discount folklore / enforcement stories — use with caution):

- Enterprise deal benchmark vendors (e.g. Vendr-style OpenAI peer data)  
- Industry legal blogs on wrapper/resale trends (Anthropic/OpenAI)  

---

## Related docs

- [AI Hay Router Product Spec](../design/product-spec.md)  
- [OpenRouter Overview](../openrouter-overview-2026.md)  
- [How to Build an AI Model Router](../how-to-build-ai-model-router.md)  
- [AI Model Routers Research Brief](../ai-model-routers-2026.md)  
