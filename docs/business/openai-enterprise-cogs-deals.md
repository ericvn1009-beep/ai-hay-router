# OpenAI Enterprise Deals as COGS for AI Hay

How **AI Hay** can lower what it pays for OpenAI models (cost of goods), while powering a multi-tenant gateway product.

| | |
| --- | --- |
| **Audience** | AI Hay founders / ops / finance |
| **Scope** | OpenAI API + Azure OpenAI as supplier COGS |
| **Not in scope** | Reselling OpenAI keys/accounts; ChatGPT seat resale |
| **Updated** | 2026-07-28 |
| **Disclaimer** | Not legal or procurement advice. Prices, tiers, and product names change — confirm on official pages and your Order Form. |

---

## 1. Goal

```text
SMB / developer
  → AI Hay (your product, your keys to customers)
    → OpenAI or Azure OpenAI (your supplier)
```

- **AI Hay** = OpenAI’s (or Microsoft’s) **customer**
- **End users** = customers of **AI Hay**
- Enterprise deals change **COGS and limits**, not the right to flip raw OpenAI access

For legal framing (Customer Application vs key resale), see [LLM Reseller Business Model](./llm-reseller-business-model.md).

---

## 2. What “enterprise deal” can mean

| Deal type | What you buy | For AI Hay COGS? |
| --- | --- | --- |
| **ChatGPT Enterprise** | ChatGPT product seats | **No** — not gateway API capacity |
| **API PAYG + usage tiers** | List token prices; higher limits as you spend | **Yes — start here** |
| **API annual / minimum commitment** | Commit $X; invoicing; possible negotiated rates | **Yes — main sales path** |
| **Scale / Reserved capacity** | Pre-bought throughput (enterprise) | **Yes if traffic is steady** |
| **Azure OpenAI PAYG** | Same model family, Azure bill | **Yes** for compliance / Azure buyers |
| **Azure PTU** | Provisioned throughput on Azure | **Yes if utilization is high** |

---

## 3. Options ranked for AI Hay

### A. Self-serve API (no sales call) — do this first

**Usage tiers** raise rate limits and monthly spend caps as cumulative paid spend grows (Free → Tier 1 … → Tier 5). Early on, **limits** often matter more than a volume discount.

**Cost levers without enterprise:**

| Lever | Effect | When |
| --- | --- | --- |
| Route to cheaper models | Largest savings | Default path for easy tasks |
| Prompt caching | Big cut on repeated prefixes | System prompts, templates |
| Batch API | Often ~50% off (async) | Offline / non-chat jobs |
| Flex (where offered) | Lower cost, variable latency | Non-user-facing |
| Priority | Higher cost | Only when needed |
| Shorter outputs / max tokens | Direct $ cut | Product defaults |

### B. Direct OpenAI sales — usage commitment

**You can negotiate:**

- Annual (or multi-year) **minimum commitment**
- **Invoicing**
- **Volume discount** (unpublished; deal-by-deal)
- Higher limits, support, data terms (e.g. ZDR; regional processing may **add** cost)
- Path to Scale / Reserved products

**Contract realities (Services Agreement patterns):**

- Minimums often **non-cancellable**
- Reducing commitment can **remove discounts**
- Early exit can accelerate unpaid commitment

**Discount folklore (not an official rate card):** third-party deal data has cited roughly **~10–15%** at mid six-figure ACV and **higher** (sometimes ~**30%+**) at **~$500K+** annual spend. Use only as negotiation context.

**Sales takes you seriously when you bring:**

1. Clear product: multi-tenant gateway (Customer Application), not key reseller  
2. Forecast: tokens/$ by model mix and growth  
3. Trailing spend (even modest monthly burn helps)  
4. Abuse controls / AUP architecture  
5. Concrete ask: commit size, discount, invoice terms, limit process  

### C. Scale Tier / Reserved capacity (enterprise)

- Pre-purchase **throughput units** for dedicated model capacity  
- Pay for capacity **even if underused**; overages often fall to PAYG  
- Better **latency/reliability** predictability; SLA-style language on some offerings  
- Aimed at **enterprise** scale — expect high bars (six-figure / heavy production class), not seed-stage defaults  

**Use only** when aggregate tenant traffic is **smooth and high** and you measure utilization.

### D. Azure OpenAI (Microsoft path)

| | Direct OpenAI | Azure OpenAI |
| --- | --- | --- |
| Token list rates | Public OpenAI pricing | Often **match** comparable models |
| Extra TCO | Low | Support, network, logging, private link — total bill can run higher |
| Commit style | OpenAI order form | EA / MCA, **MACC**, **PTU** |
| Model freshness | Often faster | Sometimes lag |
| Buyer fit | API-native teams | Azure invoice / compliance / MACC |

**PTU:** reserve throughput; monthly/yearly reservations improve unit cost only if **utilization is high**.  
**MACC:** multi-year Azure spend commit; Azure OpenAI can draw down eligible Azure consumption.

**Pick Azure** when procurement/compliance matter more than absolute cheapest tokens.

### E. Hybrid (recommended steady state)

```text
User-facing chat     → Standard (or Priority only if needed)
                         + AI Hay routes to mini/flash when possible
Repeat prefixes      → Prompt cache
Batch / evals        → Batch / Flex
Steady high TPM core → Scale or PTU only after proof
Spillover            → Anthropic / Gemini / others (multi-model hedge)
```

---

## 4. How to get a good deal (process)

### Step 1 — 3–6 months of clean operations

- Per-tenant caps, AUP, kill switches  
- Metrics: spend by model, cache hit rate, batch %, p95 latency, errors  
- Need a real monthly burn and growth story  

### Step 2 — Climb self-serve tiers

Don’t sit rate-limited while waiting for enterprise.

### Step 3 — Package the sales ask

| Item | Content |
| --- | --- |
| Who | AI Hay — multi-model API gateway for SMBs |
| Legal | Customer Application; no key resale |
| Forecast | 12-month tokens and $ by model |
| Commit scenarios | e.g. $150K / $300K / $500K annual |
| Needs | Discount, invoice NET terms, limit increases, ZDR if required |
| Offer | Predictable volume, multi-year option, case study |

### Step 4 — Negotiate the right variables

| Negotiate | Why |
| --- | --- |
| Effective $/1M on top models | Where money is |
| Ramp / true-up on commit | SMB demand is lumpy |
| Overage price | Spikes above commit |
| Discount across model mix | Avoid single-SKU lock |
| Price protection if list drops | Common LLM risk |
| Invoice + credit terms | Your cashflow |
| Fast path to raise limits | Gateway ops |

### Step 5 — Timing

Fiscal year-end can help; **your volume** matters more.

### Rule of thumb for commit size

```text
Commit ≤ 60–70% of trailing 3-month average (annualized)
Keep 30–40% as PAYG buffer
```

Never commit 100% of optimistic forecast.

---

## 5. Stage guide for AI Hay

| Stage | Monthly OpenAI-class COGS | Structure | “Good deal” means |
| --- | --- | --- | --- |
| Seed | &lt; $5–10K | PAYG + tiers + routing + cache | Headroom, not % off |
| Early | $10–50K | PAYG + sales for limits/invoice | Higher TPM, invoice |
| Growth | $50–200K | Commit on **baseline only** | Discount on base; overage PAYG |
| Scale | $200K+ | Commit + selective Scale/PTU | Lower unit cost **and** high utilization |

---

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| Tenant spike | Caps, queues, model downgrade |
| Bad tenant → account action | KYC, AUP, filters, suspend |
| Public price cut mid-commit | Price protection; shorter first term |
| Idle reserved capacity | Reserve only measured steady load |
| Azure TCO surprise | Model full bill, not token sticker only |
| Single-provider lock-in | Multi-model routing from day one |

---

## 7. Recommended path

```text
Now
 ├─ Direct OpenAI PAYG + climb tiers
 ├─ Routing, cache, batch, tenant limits
 └─ Optional Azure OpenAI pilot

When spend is real
 ├─ OpenAI sales: invoice + commit on baseline
 └─ Keep multi-provider failover

Steady + latency-critical
 └─ Scale (OpenAI) or PTU (Azure) on hot path only

Azure-heavy customers
 └─ Azure OpenAI + later CSP / Marketplace motion
```

---

## 8. Bottom line

| Question | Answer |
| --- | --- |
| Enterprise API commit as COGS? | **Yes** — AI Hay is the customer; product in front |
| First move? | **No** — tiers + routing + cache + batch first |
| Big discounts? | **Sales-led commits** at material volume (unpublished) |
| Scale/PTU? | Steady high throughput, not spiky day one |
| Azure? | Commercial/compliance path; not always cheaper tokens |
| Best strategy | Architecture savings always + commit only on proven baseline + multi-provider hedge |

---

## References

- [OpenAI API Pricing](https://openai.com/api/pricing/)  
- [OpenAI Services Agreement](https://openai.com/policies/services-agreement/)  
- [OpenAI Scale Tier](https://openai.com/api-scale-tier/)  
- [OpenAI rate limits / usage tiers](https://developers.openai.com/api/docs/guides/rate-limits)  
- [Contact OpenAI sales](https://openai.com/contact-sales/)  
- [Azure OpenAI pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/)  
- [Microsoft MACC overview](https://learn.microsoft.com/en-us/marketplace/azure-consumption-commitment-benefit)  

## Related

- [LLM Reseller Business Model](./llm-reseller-business-model.md)  
- [Google / Gemini Enterprise COGS Deals](./google-enterprise-cogs-deals.md)  
- [AI Hay Product Spec](../design/product-spec.md)  
