# How OpenRouter Handles COGS, Multi-Tenant Access & Enterprise Deals

Research note for **AI Hay**: what OpenRouter does publicly about supplier cost, customer billing, BYOK, providers, and enterprise — and what that implies for building a similar gateway.

| | |
| --- | --- |
| **Updated** | 2026-07-28 |
| **Sources** | OpenRouter docs, FAQ, pricing, enterprise page, provider integration docs, ToS (public) |
| **Disclaimer** | OpenRouter does not publish full supplier contracts. Some supplier-side details are inferred from product design + public statements. |

---

## 1. The problem OpenRouter is solving (same as AI Hay)

| Problem | OpenRouter’s product answer |
| --- | --- |
| Many labs, many keys, many bills | **One API + one credit balance** |
| Provider outages / rate limits | **Multi-provider routing + failover** |
| Want cheaper / right-sized models | **Catalog + auto/routing + price-aware provider pick** |
| Enterprise already has cloud capacity | **BYOK / bring your own capacity** |
| Don’t want to own N vendor relationships | **OpenRouter is the single contract** for end customers |

They do **not** market themselves as “we resell OpenAI Enterprise seats.” They market **unified infrastructure**.

---

## 2. Commercial architecture (two money paths)

```text
                    ┌─────────────────────────────┐
                    │  End customer (dev / org)   │
                    │  OpenRouter API key         │
                    └─────────────┬───────────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
   ┌──────────────────────┐              ┌──────────────────────┐
   │ PATH A — Credits     │              │ PATH B — BYOK          │
   │ (OpenRouter PAYG)    │              │ (customer provider key)│
   └──────────┬───────────┘              └──────────┬─────────────┘
              │                                     │
              │ OpenRouter pays                     │ Customer pays lab
              │ upstream providers                  │ OpenRouter takes fee
              ▼                                     ▼
        OpenAI, Anthropic,                     Same providers
        Azure, Vertex, Groq, …                 on customer’s account
```

### Path A — OpenRouter credits (shared capacity)

| Piece | How it works (public) |
| --- | --- |
| Customer buys | **Prepaid credits** (min/max purchase rules; card or crypto; enterprise invoicing) |
| Platform fee | **~5.5%** on card credit purchases (**$0.80 minimum**); crypto ~**5%** |
| Token rates | Stated **pass-through** of provider list prices — **no markup on inference** (FAQ) |
| Who holds lab relationship | **OpenRouter** (they pay providers via auto top-up or invoicing) |
| Rate limits | Managed by OpenRouter on shared endpoints |
| OpenRouter revenue | Credit purchase fee (+ enterprise fee discounts / other negotiated items) |

**COGS implication:** OpenRouter’s cost of goods is **whatever they pay providers** for inference. Their *public* monetization is mostly a **thin platform fee on money in**, not “we got 30% off GPT and keep the spread.” They may still negotiate private volume deals as they scale — that is not fully disclosed.

### Path B — BYOK (bring your own key / capacity)

| Piece | How it works (public) |
| --- | --- |
| Customer stores | Provider keys (OpenAI, Azure, Bedrock, Vertex, …) encrypted in workspace |
| Upstream bill | **Customer’s** provider account |
| OpenRouter fee | **~5% of equivalent OpenRouter list cost**, taken from OpenRouter credits |
| Free tier | First **~1M BYOK requests/month** free of that fee (standard); enterprise raises free tier (e.g. **5M** cited on pricing tables) |
| Rate limits | Customer’s provider limits; can **fall back to OpenRouter shared capacity** when keys fail (configurable) |
| Enterprise pitch | “Use your AWS/GCP/Azure credits” + failover into OpenRouter pool |

**COGS implication for OpenRouter:** near-zero token COGS on BYOK traffic; pure **SaaS/control-plane revenue**.

**COGS implication for the customer:** they keep their own enterprise deals with OpenAI/Azure/GCP; OpenRouter is middleware.

---

## 3. How they structure the *product* (legal/product shape)

From OpenRouter **Terms** and docs:

| Concept | OpenRouter approach |
| --- | --- |
| What the service is | **LLM aggregator** — access third-party model APIs through OpenRouter |
| Downstream use | Customers may incorporate OpenRouter into **their own products** (B2B2C) |
| Model Terms | End users must comply with **each Model Provider’s terms** (linked per model/provider) |
| OpenRouter role | Single contractual/billing layer for the *platform*; **not** claiming to replace provider ToS |
| Data default | **Prompt/completion not logged by default** (metadata yes); opt-in logging exists |
| Privacy controls | **ZDR**, `data_collection`, provider allow/deny — filter which upstreams may receive prompts |

This matches the **Customer Application / multi-tenant gateway** pattern: OpenRouter sells **OpenRouter**, not “your OpenAI org login.”

---

## 4. How they handle upstream supply (COGS / providers)

### 4.1 Marketplace of inference providers

OpenRouter is not only “one OpenAI account.” Publicly:

- **70+ providers**, **400+ models**
- Same logical model (e.g. a Llama or even frontier models) can be served by **multiple hosts**
- Default routing: **price-aware load balancing** + skip recent outages + fallbacks
- Providers **apply** to join the network

### 4.2 Provider onboarding requirements (public)

From provider docs / apply flow:

1. Compatible **list-models** and inference API  
2. **Auto top-up or invoicing** so OpenRouter can pay for traffic automatically  
3. Uptime monitoring; traffic shifted by reliability  
4. Data policy disclosure (for ZDR / training filters)  
5. Technical review + test traffic before full listing  

So OpenRouter’s COGS strategy is partly:

```text
Aggregate many sellers of inference
  → compete on price/latency/uptime for each model
  → route customer traffic to cheapest stable endpoint
```

That is **market-making**, not a single enterprise commit with one lab.

### 4.3 Frontier labs (OpenAI, Anthropic, Google, etc.)

Public materials do **not** spell out:

- Exact OpenAI/Anthropic commit sizes  
- Whether they have private volume discounts  

What we can observe product-wise:

| Signal | Meaning |
| --- | --- |
| Official-ish endpoints appear as providers | OpenRouter has *some* commercial ability to call those APIs at scale |
| Azure / Vertex / Bedrock as first-class routes | Cloud enterprise paths are part of the graph |
| BYOK for those same providers | Customers can inject **their** enterprise capacity |
| Enterprise “fail into our capacity when your limits are hit” | Shared pool is real, finite, managed infrastructure |

**Honest gap:** Supplier-side contracts are private. AI Hay should assume OpenRouter uses a **mix of PAYG + volume deals + multi-host competition**, not pure list arbitrage marketing.

### 4.4 Failure / zero-completion economics

OpenRouter documents **failover** and has historically marketed not charging for failed completions in some cases (“zero completion insurance” in reliability materials). That reduces customer risk and is funded as **platform cost of reliability**, not passed as a separate line item.

---

## 5. How they handle customer-side “enterprise”

### 5.1 Self-serve (default)

- Credits + API keys  
- Activity dashboard  
- Org/workspaces, key limits  
- Privacy preferences  

### 5.2 Enterprise tier (public claims)

| Feature | Role |
| --- | --- |
| Invoicing / bulk credits | Procurement-friendly; **fee discounts** possible |
| Credit lines | Continue if balance goes slightly negative |
| SSO / SAML, admin controls | Org governance |
| Guardrails / spend management | Caps, policies |
| ZDR / EU in-region routing | Compliance productization |
| Higher BYOK free request tiers | Makes BYOK cheaper at scale |
| SLAs / dedicated support / Slack | Ops relationship |
| “No long-term contracts required” (marketing) | Lower friction than classic EA |

Enterprise is sold as **control + compliance + billing**, while still sitting on the same multi-provider network.

### 5.3 Bring your own capacity (enterprise narrative)

Enterprise page pitch:

- Use **your** AWS/GCP/Azure credits (BYOK)  
- Combine **your limits + OpenRouter shared capacity**  
- OpenRouter as **SaaS control plane** when you already own supply  

That is exactly the hybrid AI Hay should expect large customers to demand.

---

## 6. How OpenRouter monetizes vs how it saves COGS

| Mechanism | Who benefits | Type |
| --- | --- | --- |
| 5.5% fee on credits | OpenRouter | **Revenue** |
| Pass-through token rates | Customer transparency | Pricing policy |
| Multi-provider price competition | Customer effective cost; OpenRouter competitiveness | **COGS efficiency via routing** |
| BYOK fee (after free tier) | OpenRouter | **Revenue without token COGS** |
| Enterprise fee discounts | Customer negotiation | Margin trade for volume |
| Provider diversity | Uptime | Product reliability |

**Key insight for AI Hay:**  
OpenRouter’s public story is **not** “we undercut OpenAI list with a secret enterprise deal.”  
It is:

1. **Convenience tax** (platform fee)  
2. **Aggregation** (one integration)  
3. **Routing** (cheapest/stable provider for a model)  
4. **BYOK** (customer’s enterprise COGS stays with them)  

Private volume deals may exist underneath; they are **not** the marketing pitch.

---

## 7. Mapping OpenRouter → AI Hay playbook

| OpenRouter practice | AI Hay takeaway |
| --- | --- |
| Product is the gateway, not lab seats | Sell **AI Hay**, use labs as suppliers |
| Credits + platform fee | Simple PAYG monetization; optional later |
| Stated pass-through tokens | Build trust; compete on product not opaque markup |
| Multi-provider for same model | Don’t rely on one OpenAI commit for all economics |
| Price-weighted routing + failover | Architecture **is** COGS + reliability strategy |
| BYOK with fallback to shared pool | Offer both PAYG and BYOK from early stages |
| Provider marketplace / apply flow | Long-term: onboard hosts, not only frontier labs |
| ZDR / data policy routing | Productize compliance; don’t only negotiate legal PDFs |
| Enterprise = invoice, SSO, limits, SLAs | Layer when SMBs become mid-market |
| Auto top-up / invoice with providers | Automate supplier payment ops early |
| Customer must respect Model Terms | Pass through AUP; enforce abuse to protect shared capacity |

### What AI Hay should **not** copy blindly

| OpenRouter at scale | AI Hay at seed |
| --- | --- |
| 70+ providers day one | Start with 2–3 quality adapters |
| Global edge + huge free model catalog | Focused reliability |
| 5.5% only monetization | May need subscription for runway |
| Opaque supplier contracts | Document your own Order Forms clearly |

---

## 8. Mental model: three layers of “deals”

```text
Layer 1 — Customer ↔ AI Hay / OpenRouter
  Credits, fees, BYOK, enterprise invoice, ZDR toggles

Layer 2 — Gateway ↔ many inference providers
  Routing, failover, price sort, provider SLAs/uptime

Layer 3 — Gateway ↔ frontier lab enterprise (optional)
  Volume commits, Azure/Vertex PT, private rates
  (OpenRouter: not fully public; AI Hay: only after volume)
```

OpenRouter’s strength is **Layer 1 + Layer 2**.  
Layer 3 is scale icing, not the foundation.

---

## 9. Bottom line

| Question | How OpenRouter handles it |
| --- | --- |
| Multi-tenant use of frontier models? | **Their product** issues keys; they call providers (or BYOK) |
| Enterprise API commit as COGS? | **Not marketed as the core model**; shared capacity + multi-provider competition + optional private supplier terms |
| How they make money? | Primarily **fees on credits** and **BYOK fees**, not advertised token markup |
| How customers keep their own OpenAI/Azure deals? | **BYOK** + optional failover to OpenRouter capacity |
| How they get reliability? | Many providers per model + automatic failover |
| How they get effective low cost? | Route to cheaper endpoints; customer chooses cheap models; not pure “secret GPT discount” |
| Enterprise sales? | Invoice, SSO, ZDR, EU region, SLAs, higher BYOK free tier — **still the same network** |

**One sentence for AI Hay:**  
OpenRouter treats enterprise supply as a **multi-provider marketplace + prepaid credits business**, with **BYOK** for customers who already have lab/cloud deals — not as a single wholesale OpenAI resale shop.

---

## References

- [OpenRouter FAQ (pricing & fees)](https://openrouter.ai/docs/faq)  
- [OpenRouter Pricing](https://openrouter.ai/pricing)  
- [BYOK docs](https://openrouter.ai/docs/guides/overview/auth/byok)  
- [Enterprise](https://openrouter.ai/enterprise)  
- [Provider integration / for providers](https://openrouter.ai/docs/guides/community/for-providers)  
- [Provider apply](https://openrouter.ai/providers/apply)  
- [Provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)  
- [ZDR](https://openrouter.ai/docs/guides/features/zdr)  
- [Terms of Service](https://openrouter.ai/terms)  
- [How model routing works (blog)](https://openrouter.ai/blog/insights/model-routing/)  

## Related (AI Hay)

- [OpenAI Enterprise COGS Deals](./openai-enterprise-cogs-deals.md)  
- [Google Enterprise COGS Deals](./google-enterprise-cogs-deals.md)  
- [LLM Reseller Business Model](./llm-reseller-business-model.md)  
- [OpenRouter Overview](../openrouter-overview-2026.md)  
