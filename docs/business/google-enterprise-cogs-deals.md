# Google Gemini Enterprise Deals as COGS for AI Hay

How **AI Hay** can lower what it pays for **Gemini** (and related Google AI APIs) as cost of goods, while powering a multi-tenant gateway.

| | |
| --- | --- |
| **Audience** | AI Hay founders / ops / finance |
| **Scope** | Gemini Developer API + Vertex / Gemini Enterprise Agent Platform as supplier COGS |
| **Not in scope** | Gray key resale; consumer Gemini app subscriptions as wholesale API |
| **Updated** | 2026-07-28 |
| **Disclaimer** | Not legal or procurement advice. Google product names, quotas, and prices change — confirm on official docs and your Cloud contract. |

---

## 1. Goal

```text
SMB / developer
  → AI Hay (your product, your keys to customers)
    → Google Gemini (Developer API and/or Vertex / Agent Platform)
```

- **AI Hay** = Google’s paying customer (Cloud billing and/or AI Studio paid project)
- **End users** = customers of **AI Hay**
- Enterprise / Cloud deals change **COGS, quotas, and compliance**, not the right to flip raw Google keys

For commercial framing, see [LLM Reseller Business Model](./llm-reseller-business-model.md).

---

## 2. Two Google doors (do not confuse them)

Google exposes Gemini through **two main production paths**:

| Path | Also called | Best for |
| --- | --- | --- |
| **Gemini Developer API** | AI Studio / `ai.google.dev` | Fast start, apps, simple production, free + paid tiers |
| **Vertex AI / Gemini Enterprise Agent Platform** | Cloud enterprise generative AI | IAM, VPC, compliance, Provisioned Throughput, sales deals, SLAs |

Google’s own guidance: **most developers should use the Developer API** unless they need **specific enterprise controls**.

**For AI Hay COGS:**

- **Start:** Developer API (paid) for speed and simple token economics  
- **Graduate or dual-run:** Vertex when you need enterprise controls, PT, or Cloud commercial terms  
- **Adapter layer:** support both as `google/*` vs `vertex/*` (or equivalent) in the model registry  

---

## 3. What “enterprise deal” can mean on Google

| Deal type | What you buy | For AI Hay COGS? |
| --- | --- | --- |
| **Gemini free tier** | Limited free quotas | Prototyping only — not multi-tenant production |
| **Gemini Developer API (paid)** | PAYG tokens; higher limits | **Yes — default start** |
| **Vertex / Agent Platform PAYG** | PAYG generative pricing on Cloud | **Yes — production enterprise path** |
| **Provisioned Throughput (PT)** | Reserved capacity (GSUs) | **Yes if traffic is steady** |
| **Volume / custom rate card (sales)** | Negotiated discounts at scale | **Yes after material spend** |
| **Cloud CUDs** | Committed use discounts on eligible Cloud resources | **Partial** — mainly compute/infra SKUs, not a substitute for Gemini token strategy |
| **Google Cloud Partner** | Channel margins when reselling Cloud | **Yes for mid-market invoice motion** |

There is **no** clean path that turns **consumer Gemini app subscriptions** into wholesale API for your customers.

---

## 4. Options ranked for AI Hay

### A. Gemini Developer API (paid) — do this first

**Why**

- Fastest path to production Gemini  
- Published per-model token pricing  
- Free tier for experiments; **paid** for production volume and “not used to improve products” style data posture (confirm current ToS)  
- Prepay credits option exists for Developer API usage (locked to Gemini API — not general Cloud spend)

**Cost levers without a sales deal**

| Lever | Effect | When |
| --- | --- | --- |
| Prefer **Flash / Flash-Lite** | Largest savings | Default routing for easy tasks |
| Context caching | Lower cost on repeated prefixes | Shared system prompts |
| Batch / non-interactive paths | Where offered | Offline jobs |
| Shorter outputs / max tokens | Direct $ cut | Product defaults |
| Hard spend caps + key isolation | Prevent bill shock / leaks | **Mandatory** for multi-tenant (key leaks have caused huge Cloud bills) |

**Quotas:** paid projects get higher rate limits; still monitor RPM/TPM per model. Multi-tenant gateways must **shape traffic** so one SMB cannot exhaust the org quota.

### B. Vertex AI / Gemini Enterprise Agent Platform — PAYG

**Why move (or dual-run) here**

| Need | Vertex / enterprise platform |
| --- | --- |
| VPC / private networking | Stronger |
| IAM, org policy, audit | Stronger |
| Enterprise support / SLA posture | Stronger |
| Provisioned Throughput | Available |
| Data residency / compliance packaging | Stronger |
| Model Garden / multi-model on GCP | Stronger |

**Pricing note:** For ordinary PAYG Gemini traffic, **token rates often track the Developer API closely**. Do **not** assume a fixed “Vertex is always 10–20% more expensive” multiplier — that claim is secondary commentary and can be wrong for a given model/date. Compare **current** price lists. Total **Cloud TCO** can still rise from networking, logging, support plans, etc.

**PayGo tier / spend dynamics:** Cloud generative products often increase throughput capacity as rolling spend grows (confirm current “Standard PayGo” / quota docs for your project).

### C. Provisioned Throughput (PT) — reserved capacity

**What it is**

- Buy dedicated generative capacity measured in **Generative Scale Units (GSUs)** (or current unit name in docs)  
- Designed to reduce contention vs pure on-demand pools  
- Default behavior often **spills over to on-demand PAYG** when PT is exhausted (configurable — can also fail closed to avoid surprise on-demand charges)  
- Terms can include multi-week/month commitments; Google has also moved toward more flexible PT term options (e.g. shorter windows for spikes) — **check live docs**

**When PT is a good COGS tool**

- Predictable, high baseline QPS/TPM across AI Hay tenants  
- Latency/reliability matters more than pure spot cheapness  
- You can measure utilization and right-size GSUs  

**When PT is a bad deal**

- Spiky SMB traffic with low average utilization  
- You reserve for peak and pay for idle capacity all month  

**Rule:** size PT to **baseline**, not peak; peak → PAYG spillover or multi-provider failover.

### D. Google Cloud sales — volume / custom enterprise pricing

**What you negotiate**

- Custom rate cards at high volume  
- Enterprise support packages  
- Commit structures tied to Cloud / generative spend  
- Security addenda, residency, support SLAs  

**When sales engages**

Same as OpenAI: **real trailing spend + forecast + serious production architecture**. “We’re a future OpenRouter” without burn rarely unlocks custom Gemini discounts.

Enterprise docs explicitly mention **volume-based discounts** for large-scale deployments — details are **sales-only**, not public self-serve tiers.

### E. Committed Use Discounts (CUDs) — Cloud infrastructure

**What CUDs are**

- 1- or 3-year commitments for **eligible Google Cloud resources**  
- Resource-based and spend-based flavors  
- Strong savings on **compute** (e.g. flexible CUDs often cited around **~28% / 1yr** and **~46% / 3yr** for eligible compute — confirm live CUD docs)  

**What CUDs are not**

- Not a simple “% off all Gemini tokens” button for Developer API  
- Best thought of as **infra COGS** (if you run GPUs, GKE, data pipelines next to the gateway), not the whole Gemini strategy  

Use CUDs when AI Hay’s **own Cloud footprint** is steady — separate decision from Gemini token COGS.

### F. Google Cloud Partner path

If AI Hay later bills mid-market customers on **GCP invoices** or sells managed Gemini on Cloud:

- **Partner Advantage / Cloud partner** programs  
- Resale and margins follow **Cloud channel rules**  
- Complements Vertex COGS; does not replace building the gateway product  

### G. Hybrid COGS (recommended)

```text
Realtime chat
  → Developer API or Vertex PAYG
  → AI Hay routes Flash-Lite / Flash first; Pro only when needed

Shared system prompts
  → Context cache

Steady multi-tenant baseline
  → Provisioned Throughput (right-sized GSUs)

Spike / overflow
  → PAYG spillover and/or non-Google models (OpenAI, Anthropic, Groq)

Enterprise customer requires VPC / residency
  → Vertex path only for that tenant or globally
```

---

## 5. Developer API vs Vertex — decision guide for AI Hay

| Criterion | Prefer Developer API | Prefer Vertex / Agent Platform |
| --- | --- | --- |
| Time to ship | Yes | |
| Simple token bill | Yes | |
| Free tier experiments | Yes | |
| VPC-SC / private network | | Yes |
| Strict enterprise IAM / org policy | | Yes |
| Provisioned Throughput | Limited / N/A vs Cloud PT | Yes |
| Customer demands “on GCP” | | Yes |
| Partner / Marketplace / MACC-like Cloud motion | | Yes |
| Absolute newest model day-0 | Often | Sometimes lags |

**Many gateways run both** and choose per request or per customer policy.

---

## 6. How to get a good Google / Gemini deal (process)

### Step 1 — Production hygiene (required)

- Separate projects for prod  
- Billing budgets + alerts  
- Never expose provider keys to end users  
- Per-tenant rate limits (protect shared Google quotas)  
- Monitor for key leakage (Gemini/Cloud keys in public repos = catastrophic bills)

### Step 2 — Prove the mix (3–6 months)

Track:

- $ by model (Flash vs Pro)  
- Cache hit rate  
- Error/429 rate  
- p50/p95 latency  
- % of traffic that could stay on Flash  

### Step 3 — Dual-path readiness

- Adapter for Developer API  
- Adapter for Vertex (service account, region, quota project)  
- Registry flags: data residency, “vertex only,” etc.

### Step 4 — Engage Cloud / generative sales when ready

Bring:

1. AI Hay product description (Customer Application / multi-tenant API)  
2. Trailing 90-day Gemini spend  
3. 12-month forecast by model  
4. Whether you need PT, residency, support tier  
5. Commit appetite (baseline only, not 100% of peak)  

### Step 5 — Negotiate the right variables

| Negotiate | Why |
| --- | --- |
| Effective cost on **Flash + Pro** (your volume leaders) | Most spend |
| PT size and term + overage behavior | Avoid idle GSUs or surprise PAYG |
| Quota increases process | Gateway scale |
| Support response for outages | Multi-tenant SLAs you sell |
| Regional deployment costs | Residency customers |
| Flexibility to switch model versions | Google renames/versions often |

### Commit sizing rule (same as OpenAI)

```text
Hard commits / PT ≤ 60–70% of proven baseline
Leave 30–40% for PAYG + multi-provider overflow
```

---

## 7. Stage guide for AI Hay

| Stage | Monthly Gemini-class COGS | Structure | “Good deal” means |
| --- | --- | --- | --- |
| Seed | &lt; $5–10K | Developer API paid + Flash routing + hard budgets | No surprise bills; enough quota |
| Early | $10–50K | Paid API + Vertex pilot if needed | Stable quotas; optional invoice via Cloud |
| Growth | $50–200K | Sales conversation; PT on **baseline** only | Lower unit cost or guaranteed capacity where it pays |
| Scale | $200K+ | Custom rate card + PT + partner motion if selling Cloud | Utilization-aware capacity + multi-region |

---

## 8. Risks specific to Google COGS

| Risk | Mitigation |
| --- | --- |
| Key leak → unbounded Cloud bill | Budgets, alerts, key rotation, never log secrets |
| Free tier / ToS misuse in multi-tenant prod | Use **paid** production projects |
| Quota exhaustion by one tenant | Per-tenant limits, queues, fair scheduling |
| PT idle capacity | Size to baseline; allow controlled PAYG spillover |
| Assuming Vertex always cheaper/expensive | Re-price from current tables quarterly |
| CUDs on wrong SKUs | Only commit after FinOps maps eligible usage |
| Model rename / deprecation | Abstract model IDs in AI Hay registry |

---

## 9. OpenAI vs Google COGS (quick compare for AI Hay)

| | OpenAI | Google Gemini |
| --- | --- | --- |
| Self-serve start | API + usage tiers | Developer API free/paid |
| Big publishable list savings | Batch/Flex/cache/model mix | Flash-tier routing + cache |
| Reserved capacity | Scale / Reserved (enterprise) | **Provisioned Throughput (GSUs)** |
| Cloud commercial wrapper | Azure OpenAI | **Vertex / Agent Platform** |
| Channel resale | Partner Network / Azure CSP | **Google Cloud Partner** |
| Typical enterprise ask | Commit $ + discount | Volume pricing + PT + Cloud terms |

Run **both** as suppliers; let AI Hay routing pick on cost, latency, and customer policy.

---

## 10. Recommended path

```text
Now
 ├─ Gemini Developer API (paid) for production COGS
 ├─ Route Flash / Flash-Lite by default
 ├─ Budgets, tenant limits, cache
 └─ Optional: Vertex project for enterprise-shaped tenants

When Gemini spend is material
 ├─ Cloud/generative sales: volume pricing + PT on baseline
 └─ Keep OpenAI/Anthropic failover

If selling to GCP-native mid-market
 └─ Vertex-first path + Partner / Marketplace later
```

---

## 11. Bottom line

| Question | Answer |
| --- | --- |
| Can AI Hay use Google enterprise deals as COGS? | **Yes** — you are Google’s customer; AI Hay is the product |
| First move? | **Paid Developer API** + smart routing to cheap Gemini tiers |
| When Vertex? | Enterprise controls, PT, residency, GCP procurement |
| Best “discount”? | Often **Flash routing + cache + PT only on baseline** — not a day-one custom rate card |
| Partner path? | For **Cloud invoice resale**, not required for COGS day one |
| Best strategy | Dual door (Developer + Vertex) + architecture savings + commit/PT only on proven load |

---

## References

- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)  
- [Gemini API billing](https://ai.google.dev/gemini-api/docs/billing)  
- [Developer API vs Enterprise Agent Platform](https://ai.google.dev/gemini-api/docs/migrate-to-cloud)  
- [Vertex / Agent Platform generative pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)  
- [Provisioned Throughput](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/provisioned-throughput/use-provisioned-throughput)  
- [Google Cloud CUDs](https://docs.cloud.google.com/docs/cuds)  
- [Google Cloud Partners](https://cloud.google.com/partners)  

## Related

- [OpenAI Enterprise COGS Deals](./openai-enterprise-cogs-deals.md)  
- [LLM Reseller Business Model](./llm-reseller-business-model.md)  
- [AI Hay Product Spec](../design/product-spec.md)  
