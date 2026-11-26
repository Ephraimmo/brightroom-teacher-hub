# 10. Infrastructure and operating cost model

Estimates are monthly, in US dollars because most providers bill in dollars, converted at an **assumed R18 per US$**. Prices are list prices found in November 2026 and **must be re-checked before budgeting**. Several came from third-party summaries, and providers change rates without much notice. People costs (support, sales, content, development) are not included and will be larger than everything below.

## Assumptions

- **Live lesson usage.** An online learner attends **12 live hours a month**, which is **720 participant-minutes**. Teachers and classroom PCs add about 5%. Learners who are physically in the room usually watch the projector rather than joining on a device.
- **Recordings.** About **30%** of lesson hours are recorded, at roughly **0.5 GB per hour**, and kept for one term.
- **AI.** Each AI-using learner costs **$0.20–$1.00 a month** under a capped allowance, and about 40% of learners use it.
- **SMS** is used only for critical messages, about 3 per learner per month at roughly R0.20–R0.25 each. Everything else goes by in-app notification and email.

## Three scenarios

| Monthly cost (US$)                            | **A: Pilot**<br/>300 learners, 100 online | **B: Growth**<br/>5,000 learners, 2,000 online | **C: Scale**<br/>50,000 learners, 20,000 online         |
| --------------------------------------------- | ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------- |
| Live video minutes                            | ~76,000                                   | ~1.5 million                                   | ~15 million                                             |
| **LiveKit Cloud**                             | $50 (Ship plan, 150k minutes included)    | ~$505 (Scale plan, 1.5M included)              | ~$5,950 at list price (enterprise pricing likely lower) |
| _Agora, for comparison_                       | _~$265_                                   | _~$6,000_                                      | _~$60,000_                                              |
| Database, auth, storage (Lovable Cloud)       | $25–50                                    | $150–400                                       | $800–2,000                                              |
| Lovable subscription                          | $25–50                                    | $50                                            | $50–100                                                 |
| Recording storage (R2) + recording processing | $10–50                                    | $170–470                                       | $1,700–4,700                                            |
| Email                                         | $0 (free tier)                            | $20                                            | $90–200                                                 |
| SMS (optional)                                | ~$8                                       | ~$210                                          | ~$1,700                                                 |
| AI (capped allowance)                         | $50–300                                   | $400–2,000                                     | $4,000–20,000                                           |
| OCR and document conversion                   | $5–20                                     | $30–100                                        | $200–500                                                |
| Monitoring                                    | $0 (free tiers)                           | $30–50                                         | $100–300                                                |
| **Total**                                     | **≈ $175–530**<br/>R3,200–9,500           | **≈ $1,600–3,800**<br/>R29,000–68,000          | **≈ $14,500–35,500**<br/>R260,000–640,000               |
| **Per learner**                               | $0.60–1.75 (R11–32)                       | $0.32–0.76 (R6–14)                             | $0.29–0.71 (R5–13)                                      |

**What drives the ranges:**

- **AI usage** is the biggest variable. The allowance tied to each plan is how we keep it predictable.
- **Video** is the second-biggest cost. Data-saver mode, cameras off by default and LiveKit's per-minute price keep it modest.
- **Agora would multiply the video line by roughly ten.** That is why LiveKit is the recommendation, subject to a real-classroom audio test.

### Costs to confirm with providers

- **LiveKit** may also charge for bandwidth and for recording processing. Run its pricing calculator with the Phase 2 trial data.
- **Lovable Cloud** bills in credits rather than dollars. The database line uses equivalent Supabase pricing (Pro plan from $25, 8 GB database and 250 GB transfer included) as a benchmark.
- **tldraw**, if chosen for the whiteboard, needs a commercial licence; ask for a quote. Excalidraw is free.

## Payment fees (scale with revenue)

PayFast list rates, excluding 15% VAT:

| Method                        | Fee               | On a R300 monthly subscription (incl. VAT) |
| ----------------------------- | ----------------- | ------------------------------------------ |
| Card                          | 3.2% + R2.00      | ≈ R13.34 (4.4%)                            |
| Instant EFT                   | 2% (min R2.00)    | ≈ R6.90 (2.3%)                             |
| Manual EFT (proof of payment) | Bank charges only | Admin time to verify                       |

PayFast says its fees can be negotiated as volume grows. As a sense of scale: at **R300 per learner** and **5,000 paying learners**, monthly revenue is **R1.5 million**. In that case infrastructure is about 2–5% of revenue and payment fees about 2–4%.

## One-off costs

| Item                                      | Indicative cost | Notes                                                                                                                                                                                                        |
| ----------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hybrid classroom kit, per room            | R5,000–13,000   | Conference speakerphone (R2,500–6,000), 1080p webcam (R1,000–2,500), pen tablet (R1,000–3,000), cabling. Assumes an existing PC and projector. Large rooms may need a ceiling or array microphone (R15,000+) |
| POPIA legal review, privacy notice, terms | Get quotes      | Needed before real learner data                                                                                                                                                                              |
| Penetration test                          | Get quotes      | Phase 7                                                                                                                                                                                                      |
| Whiteboard licence (if tldraw)            | Get quote       | Phase 2 decision                                                                                                                                                                                             |
| Domain and email sending domain           | Small           |                                                                                                                                                                                                              |

## Cost controls built into the design

- **Data-saver mode:** audio and board only, about a tenth of the data. Learners' cameras are off unless needed.
- **Recordings** need opt-in per lesson and have a retention limit per institution.
- **AI allowance** is set per plan. When it runs out, the learner sees a friendly message, not an unexpected bill.
- **SMS** is reserved for critical alerts. WhatsApp templates are used only where they are cheaper or more effective.
- **Summary tables** keep dashboards fast without large database servers.
- **At scale:** negotiate LiveKit enterprise pricing, or self-host LiveKit (it's open source) if the numbers favour it.

## Sources (checked 26 November 2026)

- LiveKit: [pricing](https://www.livekit.com/pricing), [billing docs](https://docs.livekit.io/deploy/admin/billing/), [regions](https://docs.livekit.io/deploy/admin/regions/region-pinning), [third-party plan summary](https://apicostcalc.com/livekit.html)
- Agora: [video calling pricing](https://www.agora.io/en/pricing/video-calling), [pricing docs](https://docs.agora.io/en/video-calling/overview/pricing)
- PayFast: [fees](https://payfast.io/fees)
- Supabase: [pricing](https://supabase.com/pricing), [billing](https://supabase.com/docs/guides/platform/org-based-billing)
- Lovable: [usage and costs](https://docs.lovable.dev/features/usage-and-costs), [pricing](https://lovable.dev/pricing)
- SMS: [Clickatell SA](https://clickatell.com/promotions/bulk-sms-south-africa), [ITWeb price comparison](https://www.itweb.co.za/article/new-price-comparison-reveals-sas-cheapest-bulk-sms-provider/xA9POvNE6a9qo4J8)
