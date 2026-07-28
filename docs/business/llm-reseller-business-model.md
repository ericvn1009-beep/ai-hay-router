# LLM Reseller Business Model

Buying large packages from frontier providers (OpenAI, Gemini, etc.) and reselling to SMBs.

| | |
| --- | --- |
| **Status** | Draft |
| **Updated** | 2026-07-28 |
| **Note** | Not legal advice. Terms and prices change — confirm with counsel and official docs before committing capital. |

---

## 1. Short answer

The idea sounds simple: **get a big enterprise discount, resell cheaper to SMBs.**

In practice:

| Works | Does not work |
| --- | --- |
| Volume/enterprise deals can lower your cost | There is no public “wholesale token store” with fixed 30% off |
| Selling a **product** that uses models (gateway, app, vertical SaaS) | Turning one ChatGPT Team/Enterprise login into a public multi-tenant API |
| Cloud partner / CSP channels (Microsoft, Google, AWS) | Buying/selling API keys or leasing provider accounts |
| Winning on **total cost** (routing, cache, one bill, support) | Promising permanent prices below public list forever |

**For AI Hay Router:** sell a **multi-model control plane** (one API, keys, routing, metering). Use big provider deals later to improve COGS — not as the whole business.

---

## 2. ChatGPT vs API (do not mix these)

| | **ChatGPT Business / Enterprise** | **OpenAI API** |
| --- | --- | --- |
| What it is | Hosted chat product (seats, workspace) | Usage-priced infrastructure (tokens) |
| How you buy | Seat / enterprise contract | PAYG or enterprise commit |
| Can SMBs use it via your gray API? | **No** — not wholesale API capacity | Only through **your product**, under your account rules |

Same idea for **Claude Pro/Max** and other consumer plans: **subscription ≠ cheap API for your customers.**

---

## 3. What “reseller” actually means

| Model | You sell | Risk | Fit for Hay |
| --- | --- | --- | --- |
| **A. Key / account flip** | Raw access on your shared key | **High** — keys/accounts must not be sold or leased | Avoid |
| **B. Value-added product** | Your app; models are cost of goods | Normal | Good |
| **C. Cloud partner / CSP** | Azure / GCP / AWS AI with invoices | Lower if enrolled | Good for mid-market |
| **D. Multi-model gateway** | One API, billing, routing, failover | OK if it’s **your service**, not key trading | **Primary** |

Hay = **D + B**. Optional **C** for companies that want cloud invoices.

---

## 4. Provider snapshot

### OpenAI

- **Enterprise** can include volume discounts and invoicing — rates are **negotiated**, not published.
- You **may** put the API inside **your application** for your end users.
- You **may not** resell/lease OpenAI accounts or buy/sell/transfer API keys.
- **Partner Network** (Select / Advanced / Elite) is for co-selling solutions — not free wholesale tokens.
- Extra savings without a “reseller deal”: cheaper models, prompt caching, batch/async tiers where available (check current pricing page).

### Google Gemini

- **Developer API** = self-serve, public prices, free/paid limits.
- **Vertex / enterprise Cloud path** = production controls, commits, provisioned throughput, sales deals.
- Real “resell to SMBs with invoices” motion usually means **Google Cloud partner**, not gray AI Studio keys.

### Anthropic Claude

- Build products on **API / commercial** plans.
- Do **not** pool consumer Pro/Max as a hidden API.
- Also available via **Bedrock / Vertex** (cloud billing).

### Microsoft (best classic resale path)

- **CSP / partner programs** let you resell Microsoft cloud.
- **Azure OpenAI / Foundry models** sit under Microsoft commercial terms.
- Closer to traditional software resale than openai.com gray markets.

### OpenRouter (reference, not a partner program)

- One API, many models.
- Charges a **platform fee on credits** (~5.5% card; crypto lower) and states **pass-through** token rates.
- Shows the market: customers pay for **convenience**, not only “below list.”

---

## 5. Can you be cheaper for SMBs?

### Pure token math (simple example)

Suppose you get **20% off** list (not guaranteed):

```text
List cost to you if no deal     $1.00
Your wholesale                  $0.80
+ payments, support, abuse      ~$0.05–0.10
+ gateway ops                   ~$0.05–0.15
+ your margin                   15–30%
-----------------------------------------
SMB price often ≈ list or higher
```

So **discount alone rarely funds a permanent “cheaper than OpenAI.com” pitch.**

### Where SMBs really save

| Lever | Why it helps |
| --- | --- |
| **Routing** | Small/cheap models for most calls; frontier only when needed |
| **Caching** | Repeat prompts cost less |
| **One bill / multi-model** | Less engineering and vendor sprawl |
| **Spend caps** | Avoid bill shock |
| **Local invoice / support** | Matters outside the US |

Sell **lower total cost of getting AI into production**, not laundered Enterprise ChatGPT.

### Money risk of big packages

- Minimum commits: you pay even if SMB demand is low  
- Labs cut public prices → your fixed deal looks expensive  
- One account ban or outage can stop revenue  

**Rule:** grow volume on PAYG first; negotiate commits later.

---

## 6. Clean vs dirty patterns

### Do

1. Hay is the product; providers are suppliers.  
2. Issue **Hay API keys** to customers (not shared OpenAI logins).  
3. Optional **BYOK** (customer’s own provider keys + Hay fee).  
4. Join **CSP / Cloud partner** when you need formal resale invoices.  
5. Meter usage, set caps, block abuse.  
6. Monetize **subscription + platform fee**; treat token spread as secondary.

### Don’t

1. Pool ChatGPT / Claude consumer or team plans as an API.  
2. Buy, sell, or transfer provider API keys.  
3. Claim “official OpenAI reseller” without real partner status.  
4. Promise forever-below-list pricing.  
5. Skip basic privacy and acceptable-use terms for end users.

---

## 7. Recommended path for AI Hay Router

| Phase | What to do |
| --- | --- |
| **1** | PAYG upstream. Sell Hay access (plan and/or small fee). Support BYOK. |
| **2** | Add one cloud partner path (Azure or GCP) for invoice-heavy customers. |
| **3** | Negotiate provider commits only where usage is stable. Multi-provider always. |

**Positioning:**  
*Trusted multi-model API and control plane for SMBs — not unofficial wholesale GPT.*

---

## 8. Bottom line

| Question | Answer |
| --- | --- |
| Big packages from OpenAI / Gemini? | Yes, via **enterprise/cloud deals** — not consumer plan pooling. |
| Resell cheaper to SMBs? | On **effective cost** (routing, cache, bundle) — hard as pure list arbitrage. |
| Pure key resale? | **No.** |
| Gateway product using models? | **Yes** — normal if it’s your service and you follow provider rules. |
| Best Hay model? | **Software + unified access**; discounts only to improve COGS later. |

---

## References

- [OpenAI Services Agreement](https://openai.com/policies/services-agreement/)  
- [OpenAI API Pricing](https://openai.com/api/pricing/)  
- [OpenAI Partner Network](https://openai.com/index/introducing-openai-partner-network/)  
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)  
- [Google Cloud Partners](https://cloud.google.com/partners)  
- [Microsoft CSP](https://partner.microsoft.com/partnership/cloud-solution-provider)  
- [OpenRouter Pricing](https://openrouter.ai/pricing)  

## Related

- [Product Spec](../design/product-spec.md)  
- [OpenRouter Overview](../openrouter-overview-2026.md)  
- [How to Build a Router](../how-to-build-ai-model-router.md)  
