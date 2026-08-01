# Spec: Market Multi-Vendor Checkout

## Objective

Users browsing a night market or commercial district should be able to collect
items from multiple vendors without losing previous selections when moving
between vendor menus. This is the first step toward true market checkout.

Phase 1 builds a market basket in the customer app:

- Items added from a shop menu opened from `/markets/:slug` are also saved into
  a market-level basket.
- The basket groups items by vendor and survives navigation between vendors in
  the same market.
- The market detail page shows a basket summary so users can review selected
  vendors and totals.

True one-click joint checkout is not part of Phase 1 because the current order
API and database order model are restaurant-scoped.

Phase 2 adds a market checkout session without changing the `orders` table:

- `POST /api/v1/market-checkouts` accepts a market slug and at least two vendor
  item groups.
- The API validates that every vendor is an active member of the market and
  that each requested item is currently available for that vendor.
- The API creates one existing guest order per vendor and stores a parent
  checkout session in KV for aggregate lookup.
- The customer market basket can submit all vendor groups in one action.

Joint payment remains out of scope for this base checkout session. Provider
split payment orchestration is specified separately in
`docs/superpowers/specs/2026-06-02-market-checkout-provider-contract.md`.

## Tech Stack

- Vue 3 customer app with Pinia stores.
- TypeScript for application logic.
- Vitest for store and view tests.
- Existing single-restaurant `shopCart` remains the source for current vendor
  checkout.
- Market checkout uses the existing guest order creation path for child orders.

## Commands

- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Targeted tests:
  `pnpm --filter customer-app test -- src/tests/stores/market-cart.test.ts src/tests/views/shop-menu-services.test.ts src/tests/views/market-detail-view.test.ts`
- API validation tests:
  `pnpm exec vitest run apps/api/src/features/market-checkouts/schemas/validation.test.ts`

## Project Structure

- `apps/customer-app/src/stores/marketCart.ts` stores market basket state.
- `apps/customer-app/src/views/ShopMenuView.vue` mirrors market-context adds
  into the market basket.
- `apps/customer-app/src/views/MarketDetailView.vue` displays the basket
  summary and submits the market checkout.
- `apps/customer-app/src/tests/stores/market-cart.test.ts` covers persistence
  and vendor grouping.
- `apps/api/src/features/market-checkouts/` owns the public market checkout
  endpoint and request validation.

## Code Style

```ts
marketCartStore.addItem({
  marketSlug,
  marketName,
  restaurantId: props.restaurantId,
  restaurantName: restaurant.value?.name ?? "店鋪",
  item: data.item,
  quantity: data.quantity,
  customizations: data.customizations,
  notes: data.notes,
});
```

Follow existing store conventions: setup-style Pinia stores, typed action
payloads, localStorage validation with Zod, and no new dependencies.

## Testing Strategy

- Unit-test the market basket store for multi-vendor grouping, quantity merges,
  removal, expiry, and localStorage restore.
- Extend customer view tests only where existing mocks can verify integration
  without brittle DOM behavior.
- Phase 1 does not add backend API tests because it does not change order
  submission contracts.
- Phase 2 adds API schema tests and customer view tests for multi-vendor
  submission. Route integration should be broadened when payment/session
  tracking becomes persistent beyond KV.

## Boundaries

- Always: preserve the existing single-vendor shop cart behavior.
- Always: make market basket data market-scoped and vendor-grouped.
- Always: validate localStorage before restoring.
- Ask first: database schema changes for checkout sessions, payments, or child
  order orchestration.
- Ask first: changing `/guest-orders` or `orders.restaurant_id` semantics.
- Never: silently submit one combined order to a single vendor when items came
  from multiple vendors.
- Never: create child orders for restaurants that are not active members of the
  requested market.

## Success Criteria

- Adding an item from a shop menu reached via `/markets/:slug` records it in
  the market basket under the correct vendor.
- Adding the same item/options/notes again merges quantity.
- Navigating back to the market detail shows a grouped basket summary.
- Basket data survives reload and invalid or expired storage is discarded.
- Submitting a market basket with at least two vendors creates one child order
  per vendor through `/api/v1/market-checkouts`.
- A parent checkout session records market identity and child order summaries.
- Existing shop cart tests and market detail tests still pass.

## Open Questions

- Payment model: should users pay once at market level, pay each vendor
  separately, or support both?
- Fulfillment model: should pickup status be tracked per vendor, per market
  session, or both?
