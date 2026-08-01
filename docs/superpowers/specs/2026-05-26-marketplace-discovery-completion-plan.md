# Marketplace Discovery Completion Plan

**Date**: 2026-05-26
**Status**: Active phased implementation
**Author**: Codex
**Related spec**:
[`2026-05-25-night-market-discovery-design.md`](./2026-05-25-night-market-discovery-design.md)

## Objective

Complete the night market / commercial district marketplace experience so a
customer can enter a market, search its available products or services, open any
vendor, and start the supported vendor flow directly from that context.

The current implementation already has market entities, public market APIs,
market-scoped backend discovery filters, customer market pages, basic platform
market management, vendor contact profiles, and real integration coverage. The
remaining work is to turn those primitives into a scalable marketplace product.

## Commands

- Focused API verification:
  `pnpm exec vitest run --config apps/api/vitest.real-integration.config.ts apps/api/src/__tests__/integration/markets.real.integration.test.ts`
- Customer app focused tests:
  `pnpm exec vitest run apps/customer-app/src/tests`
- Customer app typecheck:
  `pnpm --filter @makanmakan/customer-app typecheck`
- Full pre-PR gates:
  `pnpm lint && pnpm typecheck && pnpm test`

## Project Structure

- Customer marketplace UI: `apps/customer-app/src/views/MarketDetailView.vue`
  and `apps/customer-app/src/components/markets/`
- Customer API clients and state: `apps/customer-app/src/services/` and
  `apps/customer-app/src/stores/`
- Public marketplace APIs: `apps/api/src/features/markets/` and
  `apps/api/src/features/discovery/`
- Platform management: `apps/management-portal/src/views/MarketsView.vue`
- Shop-owner management: `apps/admin-dashboard/src/views/SettingsView.vue`
- Database schema: `packages/database/src/schema/markets.ts` and
  `packages/database/src/schema/discovery.ts`

## Phases

### Phase 1: Market-Scoped Product Search

Customer market detail pages must allow searching products/services inside the
selected market, not only vendors. This phase uses the existing
`GET /api/v1/discovery/search?marketId=...` backend path.

Success criteria:

- Market detail shows a product/service search field scoped to the selected
  market.
- Searching calls discovery with `q`, `marketId`, `takeaway`, `page`, and
  `limit`.
- Results render as existing dish result cards with select and takeaway actions.
- Empty, loading, and error states are visible and do not interfere with vendor
  browsing.
- Focused customer tests prove the API call and result rendering.

### Phase 2: Onboarding and Vendor Data Completeness

Shop onboarding/settings must collect the fields needed for marketplace quality:
GPS, city/district, public contact channels, FAQ, shop mode, takeaway support,
and market membership request status.

Success criteria:

- Owners can see all current market memberships and pending requests.
- Owners can request market membership without knowing internal IDs.
- Missing marketplace-critical fields are highlighted in settings/onboarding.
- Discovery index updates after location, takeaway, shop mode, or membership
  changes.

### Phase 3: Platform Operations

Platform staff must manage markets and vendors without manual IDs or database
knowledge.

Success criteria:

- Platform market editor supports searching/selecting vendors by name.
- Join requests have an approval/reject workflow.
- Market images, tags, opening hours, and active state are editable.
- Bulk import/update exists for market and vendor membership data.

### Phase 4: Marketplace Catalog Generalization

The catalog must support non-food goods and services while preserving menu item
compatibility.

Success criteria:

- Search result types distinguish menu items, products, and services.
- Item records support category, tags, price display, availability, and vendor
  service path.
- Existing restaurant menu search remains compatible.

### Phase 5: Search Quality and Scale

Search must remain useful as markets, vendors, and items grow.

Success criteria:

- Market-scoped search supports sorting by relevance, distance, open status,
  popularity, and price.
- Search supports synonyms and common zh-TW query variants.
- Index updates are observable and recoverable.
- Performance is measured with realistic market-size fixtures.

### Phase 6: Map, Boundaries, and Local Discovery

Markets should have usable spatial context beyond a single centroid.

Success criteria:

- Markets can define optional polygon/GeoJSON boundaries.
- Vendor stall/location labels can be displayed on market detail pages.
- Nearby search handles centroid and boundary matches consistently.

## Boundaries

- Always: build phase by phase with focused tests before broad refactors.
- Always: keep existing QR/shop ordering flow compatible.
- Ask first: introduce new infrastructure, new paid services, or a new search
  engine.
- Never: replace existing restaurant/menu flows while adding marketplace flows.

