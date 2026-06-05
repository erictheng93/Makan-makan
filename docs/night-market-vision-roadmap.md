# Night-Market Platform — Vision Gap → Roadmap

> Last updated: 2026-06-03. Source of truth for "how far are we from the
> night-market / commercial-district platform vision, and what's next."

## Vision

A **two-layer marketplace**: an upper **market/district layer** (夜市/商圈) where
users search every shop's products **and services** in an area, and a lower
**shop layer** where they open any shop to **order food (點餐)** or **book a
service (預約服務)**. MVP monetization is **stored-value 代幣 + 卷 vouchers**, not a
real payment acquirer.

## Where we are (verified 2026-06-03)

| # | Vision pillar | State | Maturity |
|---|---|---|---|
| 1 | Market/district aggregation layer | `markets` + `restaurant_market_memberships` + join-requests, geo + map + platform fee | **8/10 — built** |
| 2 | Cross-shop product/service search | `dish_search_index` + `/discovery/*`, market/district/city/geo filters | **7/10 — built** (prefix match, no FTS/semantic) |
| 3 | Open any shop, browse menu | QR / manual / market-browse entry all wired | **7/10 — built** |
| 4 | Food ordering (點餐) | cart, modifiers, guest order, realtime tracking, multi-vendor market cart | **6/10 — functional MVP** |
| 5a | Pay via 代幣 (stored-value) | full ledger, cash/admin top-up, cross-shop spend (PIN), refund, expiry, accounting, `/api/v1/credits` | **8/10 — shipped (PR #49, unmerged)** |
| 5b | Pay via 卷 (voucher) | **shipped 2026-06-03**: apply→pay→redeem on market-checkout, anonymous code, tests green | **6/10 — MVP shipped (unmerged)** |
| 6 | Service booking (預約服務) | **MVP shipped 2026-06-03**: `service_bookings` schema + service + routes (availability, create, pay-with-代幣, 卷 discount, verify/cancel, staff lifecycle), 9 real-D1 tests | **6/10 — MVP shipped (unmerged)** |
| 7 | Real payment acquirer | provider-agnostic contract complete; no concrete gateway | **blocked on business decision** |

Overall vision completion ≈ **75%**. The two hard blockers from the original
review are now both resolved for MVP: 代幣+卷 give a real money loop **without** an
acquirer (pillar 7 deferred by design), and service booking (預約服務) now has a
working backend. Remaining P0 is mostly wiring (merge, onboarding geo) and
customer-app UI for the new flows.

## Roadmap

Priority key: **P0** = on the MVP launch critical path · **P1** = needed soon
after · **P2** = scale/polish. Effort: S < 1 day · M ≈ 2–4 days · L ≈ 1–2 weeks.

### P0 — MVP launch path

| Item | Status | Effort | Notes / deps |
|---|---|---|---|
| 卷 voucher MVP (apply→pay→redeem) | ✅ **Done 2026-06-03** | — | `spec 2026-06-03-market-checkout-voucher-redemption` |
| 代幣 credits (issue/topup/spend/refund/expiry) | ✅ **Done** (PR #49) | — | merge PR #49 to land |
| **Merge PR #49** (credits + voucher) to `main` | ⬜ Not started | S | gate: full CI-equivalent local run |
| 卷 follow-ups: refund-route wiring + appliedVoucher persist column | ⬜ Not started | S | non-critical; documented in voucher spec |
| **Service booking system** (預約服務) | ✅ **MVP shipped 2026-06-03** | — | schema+service+routes+9 real-D1 tests; day-1 代幣/卷 payment. Follow-ups: `/slots` routes, staff assignment, route tests, customer-app UI |
| Onboarding → market auto-assignment (geo) | ⬜ Not started | M | onboarding captures lat/lng but market is hand-assigned by operator |

### P1 — soon after launch

| Item | Status | Effort | Notes |
|---|---|---|---|
| Search quality: SQLite FTS5 + fuzzy/typo tolerance | ⬜ Not started | M | current prefix-match caps "search the whole market" |
| 代幣 online self-serve top-up via acquirer | ⬜ Blocked | M | needs pillar 7 decision; cash top-up works meanwhile |
| Service booking: staff assignment (link `employee_availability`) | ⬜ Not started | M | column reserved in service-booking spec |
| Voucher: per-vendor / stacked / voucher+credits combos | ⬜ Not started | M | MVP is platform-wide single voucher only |

### P2 — scale & polish

| Item | Status | Effort | Notes |
|---|---|---|---|
| Real payment acquirer (ECPay / Stripe / LINE Pay) | ⬜ Blocked | L | **business decision** + credentials; contract already built (`market-checkout-provider-adapter-handoff`) |
| Semantic search (embeddings / Vectorize) | ⬜ Not started | L | beyond FTS5 |
| Multi-tenant auto-provisioning (currently manual trigger) | ⬜ Not started | L | management-api |
| Booking deposits / prepay, reminders, waitlists | ⬜ Not started | M | service-booking out-of-scope items |
| Settlement attribution (platform- vs vendor-funded discounts) | ⬜ Not started | M | voucher MVP is vendor-funded-proportional |

## The one standing business decision

**Pillar 7 — which real payment acquirer.** Not needed for MVP (代幣 cash top-up +
卷 + pay-at-venue cover it), but it gates: online self-serve top-up, card-paying
customers, and provider-split market payments. The platform side is *done* and
provider-agnostic; choosing a provider (ECPay/Stripe/LINE Pay/TapPay/NewebPay) +
supplying credentials is the only blocker. See
`docs/runbooks/market-checkout-provider-adapter-handoff.md`.

## Suggested next 2 weeks

1. Merge PR #49 + land the new voucher / service-booking work to `main`. **(S)**
2. Customer-app UI for the new flows: 卷 entry at market checkout, and the service
   booking flow (availability → book → pay with 代幣). **(M)**
3. Onboarding → market geo auto-assignment. **(M)**
4. Service-booking `/slots` capacity-management routes + admin UI. **(S–M)**

Everything above pillar 7 needs **no** business decision and **no** acquirer.

> Note: an untracked `0061_dish_search_fts5.sql` (trigram FTS, P1 search upgrade)
> is in the working tree. The real-integration test harness now tolerates it
> (`listUserTables` excludes FTS shadow tables). Decide whether to commit it as
> part of the search-quality (P1) work.
