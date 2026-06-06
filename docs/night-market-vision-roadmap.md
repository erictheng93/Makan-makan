# Night-Market Platform — Vision Gap → Roadmap

> Last updated: 2026-06-06. Source of truth for "how far are we from the
> night-market / commercial-district platform vision, and what's next."

## Vision

A **two-layer marketplace**: an upper **market/district layer** (夜市/商圈) where
users search every shop's products **and services** in an area, and a lower
**shop layer** where they open any shop to **order food (點餐)** or **book a
service (預約服務)**. Current monetization is **stored-value 代幣 + 卷 vouchers**,
not a real payment acquirer; live acquirer integration is explicitly deferred
by product decision on 2026-06-06.

## Where we are (verified 2026-06-06)

| # | Vision pillar | State | Maturity |
|---|---|---|---|
| 1 | Market/district aggregation layer | `markets` + `restaurant_market_memberships` + join-requests, geo + map + platform fee | **8/10 — built** |
| 2 | Cross-shop product/service search | `dish_search_index` + `/discovery/*`, market/district/city/geo filters | **7/10 — built** (prefix match, no FTS/semantic) |
| 3 | Open any shop, browse menu | QR / manual / market-browse entry all wired | **7/10 — built** |
| 4 | Food ordering (點餐) | cart, modifiers, guest order, realtime tracking, multi-vendor market cart | **6/10 — functional MVP** |
| 5a | Pay via 代幣 (stored-value) | full ledger, cash/admin top-up, cross-shop spend (PIN), refund, expiry, accounting, `/api/v1/credits` | **8/10 — shipped and merged to `main`** |
| 5b | Pay via 卷 (voucher) | **shipped 2026-06-03 and merged to `main`**: apply→pay→redeem on market-checkout, anonymous code, tests green | **6/10 — MVP shipped** |
| 6 | Service booking (預約服務) | **MVP shipped 2026-06-03 and merged to `main`**: `service_bookings` schema + service + routes (availability, create, pay-with-代幣, 卷 discount, verify/cancel, staff lifecycle), 9 real-D1 tests | **6/10 — MVP shipped** |
| 7 | Real payment acquirer | provider-agnostic contract complete; no concrete gateway | **deferred by product decision** |

Overall vision completion ≈ **95% for the current no-acquirer scope**. The two
hard blockers from the original review are now resolved for MVP: 代幣+卷 give a
real money loop **without** an acquirer (pillar 7 deferred by design), and
service booking (預約服務) has a working end-to-end flow plus admin operations.
The remaining payment-provider work is tracked in `TODOS.md` and does not block
the current project scope.

## Roadmap

Priority key: **P0** = on the MVP launch critical path · **P1** = needed soon
after · **P2** = scale/polish. Effort: S < 1 day · M ≈ 2–4 days · L ≈ 1–2 weeks.

### P0 — MVP launch path

| Item | Status | Effort | Notes / deps |
|---|---|---|---|
| 卷 voucher MVP (apply→pay→redeem) | ✅ **Done 2026-06-03** | — | `spec 2026-06-03-market-checkout-voucher-redemption` |
| 代幣 credits (issue/topup/spend/refund/expiry) | ✅ **Done and merged** (PR #49) | — | landed in `main` |
| 卷 follow-ups: refund-route wiring + appliedVoucher persist column | ✅ Done | — | refund marks `coupon_usage` refunded; applied voucher persists beyond KV TTL; partial refunds release `used_count` only after the full checkout voucher use is refunded |
| **Service booking system** (預約服務) | ✅ Done | — | customer booking flow, slots capacity API/admin UI, staff lifecycle, employee availability, `service_bookings` employee-overlap DB guard, deposits/prepay, reminders, waitlist, recurrence, ICS |
| Onboarding → market auto-assignment (geo) | ✅ Done | — | new shops with lat/lng are assigned/suggested to nearest active market |

### P1 — soon after launch

| Item | Status | Effort | Notes |
|---|---|---|---|
| Search quality: SQLite FTS5 + fuzzy/typo tolerance | ✅ Done | — | FTS5 trigram hybrid search shipped before semantic layer |
| 代幣 online self-serve top-up via acquirer | ⏸ Deferred | M | current project does not connect a live acquirer; provider-agnostic intent/webhook flow is ready for future use |
| Service booking: staff assignment (link `employee_availability`) | ✅ Done | — | booking can select an employee, validates employee availability, and rejects overlapping active employee bookings at the DB layer |
| Voucher: per-vendor / stacked / voucher+credits combos | ✅ Done | — | platform + vendor vouchers can stack and combine with credits |

### P2 — scale & polish

| Item | Status | Effort | Notes |
|---|---|---|---|
| Real payment acquirer (ECPay / Stripe / LINE Pay) | ⏸ Deferred | L | product decision: no live acquirer in current project; future work tracked in `TODOS.md` |
| Semantic search (embeddings / Vectorize) | ✅ Done | — | Workers AI embeddings + Vectorize recall above FTS5 |
| Multi-tenant auto-provisioning (currently manual trigger) | ✅ Done | — | tenant provisioning includes quotas and rate limits; staging and production set `QUOTA_ENFORCEMENT_MODE=enforce` |
| Booking deposits / prepay, reminders, waitlists | ✅ Done | — | implemented with recurring bookings and ICS export |
| Settlement attribution (platform- vs vendor-funded discounts) | ✅ Done | — | platform vs vendor discount attribution included in settlement/accounting exports |

## Deferred payment-provider TODO

**Pillar 7 — live payment acquirer** is intentionally deferred. Not needed for
the current project scope (代幣 cash/admin top-up + 卷 + pay-at-venue cover it).
Future work requires choosing a provider (ECPay/Stripe/LINE Pay/TapPay/NewebPay)
and supplying production credentials/endpoints. The platform side is
provider-agnostic and ready for that later adapter work. See `TODOS.md` and
`docs/runbooks/market-checkout-provider-adapter-handoff.md`.

## Current closure note

The #1-#19 backlog is complete for the no-live-acquirer project scope. #13 and
#14 remain as deferred TODOs rather than launch blockers: real acquirer
selection, production credentials, provider split, card payments, and
acquirer-backed online self-serve 代幣 top-up can resume from the existing
provider contracts when product scope changes.
