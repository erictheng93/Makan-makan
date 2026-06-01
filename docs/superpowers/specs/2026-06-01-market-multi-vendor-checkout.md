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

## Tech Stack

- Vue 3 customer app with Pinia stores.
- TypeScript for application logic.
- Vitest for store and view tests.
- Existing single-restaurant `shopCart` remains the source for current vendor
  checkout.

## Commands

- Typecheck: `rtk pnpm typecheck`
- Lint: `rtk pnpm lint`
- Targeted tests:
  `rtk pnpm --filter customer-app test -- src/tests/stores/market-cart.test.ts src/tests/views/shop-menu-services.test.ts src/tests/views/market-detail-view.test.ts`

## Project Structure

- `apps/customer-app/src/stores/marketCart.ts` stores market basket state.
- `apps/customer-app/src/views/ShopMenuView.vue` mirrors market-context adds
  into the market basket.
- `apps/customer-app/src/views/MarketDetailView.vue` displays the basket
  summary.
- `apps/customer-app/src/tests/stores/market-cart.test.ts` covers persistence
  and vendor grouping.

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

## Boundaries

- Always: preserve the existing single-vendor shop cart behavior.
- Always: make market basket data market-scoped and vendor-grouped.
- Always: validate localStorage before restoring.
- Ask first: database schema changes for checkout sessions, payments, or child
  order orchestration.
- Ask first: changing `/guest-orders` or `orders.restaurant_id` semantics.
- Never: silently submit one combined order to a single vendor when items came
  from multiple vendors.

## Success Criteria

- Adding an item from a shop menu reached via `/markets/:slug` records it in
  the market basket under the correct vendor.
- Adding the same item/options/notes again merges quantity.
- Navigating back to the market detail shows a grouped basket summary.
- Basket data survives reload and invalid or expired storage is discarded.
- Existing shop cart tests and market detail tests still pass.

## Open Questions

- Phase 2 backend model: should market checkout create a parent market checkout
  session with multiple child orders, or extend group orders to support multiple
  restaurants?
- Payment model: should users pay once at market level, pay each vendor
  separately, or support both?
- Fulfillment model: should pickup status be tracked per vendor, per market
  session, or both?
