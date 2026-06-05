# Spec: Market Checkout Voucher (卷) Redemption — MVP

## Objective

Let a market-checkout customer pay less by applying a **卷 (voucher / coupon
code)** at checkout, without any real payment acquirer. This delivers the MVP
"用卷消費" loop on top of the existing provider-agnostic market checkout.

Identity model: **anonymous code redemption** (locked decision 2026-06-03). The
market checkout flow is anonymous guest (`phoneLastDigits` + `guestName`, no
`customers.id`), so vouchers are presented as a **code**, reusing the mature
`coupons` / `coupon_usage` tables and `CouponService`. The owned-instance
`user_coupons` wallet is **NOT** used in this MVP.

## Locked Decisions

1. **Scope — platform-wide vouchers only.** Only coupons with
   `coupons.restaurantId IS NULL` are accepted at market checkout. A
   vendor-scoped code is rejected with a clear error (it belongs to a single-shop
   order, not a multi-vendor market basket). Keeps the discount target
   unambiguous across N vendors.
2. **Anonymous.** No owner, no login, no `user_coupons`. Code entry only.
3. **Discount distribution — proportional across child orders.** A platform
   voucher discounts the market **subtotal**; the discount is split across child
   orders by their share of the subtotal (largest child absorbs the rounding
   remainder) so child allocations always sum to the discounted total.
4. **Redemption is recorded only on verified payment success**, one
   `coupon_usage` row per child order (its proportional share), and
   `coupons.used_count` is incremented **once** per checkout. The existing
   `(coupon_id, order_id)` partial-unique index makes redemption idempotent.
5. **Release is pure session state.** Because usage is written only at success,
   abandoning or failing a payment just clears the applied voucher from the
   session — nothing to roll back in the DB.
6. **Funding — vendor-funded proportional (forced by the provider contract).**
   The provider split contract requires child allocations to sum to the
   aggregate charge, so the discount is applied per-child: the amount sent to the
   provider for each child order is reduced by its share. Vendors therefore
   absorb the discount proportionally and the settlement export reflects the
   discounted amounts. The original `orders` rows are left untouched; the
   per-child `coupon_usage` row records the share for audit. (A platform-funded
   model would need a separate platform→vendor top-up ledger entry — out of scope
   for MVP, where no real money flows.)
7. **No acquirer dependency.** Works in `child_transactions` and `credits`
   split modes; needs no external payment provider.

## Data

Reuses existing tables — **no migration**:

- `coupons` (platform-wide rows have `restaurant_id IS NULL`).
- `coupon_usage` (`coupon_id`, `order_id` NOT NULL, `discount_amount(_cents)`,
  `original_amount`, `final_amount`, `status`, partial-unique on
  `(coupon_id, order_id)` where status != cancelled).

Session gains an optional in-memory/KV field (no schema change to the payment
ledger, per provider-contract boundary):

```ts
appliedVoucher?: {
  couponId: number;
  code: string;
  name: string;
  discountCents: number;       // total, clamped to subtotal
  allocations: Array<{ orderId: number; discountCents: number }>;
};
```

Persistence: the applied voucher lives **only in the KV `market_checkout:{id}`
session blob** (4h TTL). The persisted `market_checkout_sessions` DB row stores
discrete columns, not the full session JSON, so the DB fallback in
`readPersistedMarketCheckoutSession` does **not** carry `appliedVoucher`. This is
acceptable for MVP: apply→pay happens inside the KV TTL window; a DB-fallback pay
simply charges full price (no double-charge, no stuck redemption). Persisting to
a dedicated column is a follow-up if early KV eviction proves a problem.

## API

- `POST /api/v1/market-checkouts/:id/voucher` `{ code }` — validate + apply.
  Returns the session with `appliedVoucher`, `subtotalCents`, `discountCents`,
  `payableCents`. Re-applying replaces a prior voucher. Public (matches the
  anonymous pay route).
- `DELETE /api/v1/market-checkouts/:id/voucher` — remove the applied voucher.

Validation (reusing `CouponService.validateCoupon` + explicit platform-wide
guard): exists, active, visible, within `valid_from`/`valid_to`, platform-wide,
`subtotal >= min_order_amount`, `used_count < usage_limit`. Failures return the
unified `ApiError` shape with codes (`VOUCHER_NOT_FOUND`, `VOUCHER_NOT_APPLICABLE`,
`VOUCHER_MIN_ORDER_NOT_MET`, `VOUCHER_EXHAUSTED`, `VOUCHER_EXPIRED`).

## Pay / Redeem / Release wiring

- **Pay route** (`POST /:id/pay`): payable `amountCents = subtotalCents -
  appliedVoucher.discountCents` (floor 0). Provider gateway request and child
  allocations use the per-child discounted amounts.
- **On success** (paid provider response, verified webhook, or reconciliation):
  write `coupon_usage` per child via the shared redemption helper; increment
  `coupons.used_count` once; idempotent on replay.
- **On failure / abandonment**: clear `appliedVoucher` from the session.
- **On refund of a paid checkout**: `MarketCheckoutVoucherService.markRefunded`
  exists and is tested, but wiring it into the multi-branch refund route is a
  **follow-up** (not on the apply→pay→redeem MVP critical path).
- **Async provider success** (webhook / reconciliation paid): redemption
  currently fires only from the synchronous pay route (covers the credits MVP,
  which pays immediately). Hooking `redeem` into the webhook/reconciliation paid
  path is a **follow-up** for future async acquirers — safe because `redeem` is
  idempotent.

## Discount math (reused from CouponsService)

- `percentage`: `round(subtotalCents * value/100)`, capped at
  `max_discount_amount_cents`.
- `fixed`: `discount_value_cents` (or `toCents(discount_value)`).
- Clamp to `subtotalCents`. Proportional per-child:
  `floor(discountCents * childCents / subtotalCents)`, remainder to the largest
  child.

## Verification

- `MarketCheckoutVoucherService` unit tests: discount math (pct, pct-capped,
  fixed, clamp), proportional split + remainder, platform-wide guard.
- Real-D1 integration: apply → pay (credits/child mode) → `coupon_usage` rows +
  `used_count` once; idempotent replay; failure leaves no usage; refund marks
  usage refunded; min-order / exhausted / vendor-scoped rejections.
- Gates: `pnpm --filter @makanmakan/api typecheck`, lint, the market-checkout
  route tests, and the new voucher tests.

## Boundaries

- Never: mark a voucher redeemed before verified payment success.
- Never: accept a vendor-scoped coupon at market checkout in MVP.
- Never: touch `market_checkout_payments` ledger schema or `user_coupons`.
- Ask first: vendor-funded vs platform-funded settlement attribution.
- Ask first: per-vendor vouchers, stacked vouchers, voucher + credits combos.

## Out of scope (MVP)

- `user_coupons` owned-instance wallet & customer login.
- Per-vendor / stacked vouchers.
- Settlement attribution of the discount.
- Voucher issuance UX (admin already creates `coupons`).
