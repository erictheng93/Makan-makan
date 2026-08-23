# Spec: Server-backed delivery claims

## Objective

Prevent more than one service-crew device from delivering the same ready order.
Starting delivery must atomically claim a ready order, retain the crew member and
start time after reload, and allow only that crew member to complete the
delivery. Separately, a market-checkout GET must include the checkout-scoped
guest token so an authenticated holder retains private checkout fields.

## Tech Stack

TypeScript, Vue 3, Hono/Cloudflare Workers, Drizzle/D1, and Vitest.

## Commands

- `pnpm --filter @makanmasak/customer-app test`
- `pnpm --filter @makanmasak/admin-dashboard test`
- `pnpm --filter @makanmasak/api test`
- `pnpm --filter @makanmasak/api typecheck`
- `pnpm --filter @makanmasak/admin-dashboard typecheck`
- `pnpm --filter @makanmasak/customer-app typecheck`
- `pnpm run check:migration-dual-track`

## Project Structure

- `packages/database/src/schema/orders.ts`: persisted delivery claim fields.
- `packages/database/migrations_fresh/`: production D1 migration track.
- `apps/api/src/features/orders/`: authorization and atomic claim endpoints.
- `apps/admin-dashboard/src/views/ServiceView.vue`: service-crew presentation.
- `apps/customer-app/src/services/orderApi.ts`: checkout holder request config.

## Code Style

Use typed, parameterized Drizzle updates with the state predicate in the write:

```ts
await db.update(orders).set(values).where(and(eq(orders.id, id), eq(orders.status, "ready")));
```

## Testing Strategy

Add failing regression tests before implementation for checkout GET headers,
delivery claim conflict/ownership, and persisted dashboard state. Run the
affected Vitest suites plus type checks and migration-track validation.

## Boundaries

- Always: use atomic database predicates, preserve restaurant authorization,
  and add regression tests.
- Ask first: new dependencies, CI changes, or changes to payment semantics.
- Never: use browser storage as authorization or remove existing tests.

## Success Criteria

1. A checkout GET includes its own `X-Guest-Token` when present.
2. Only an unclaimed, ready order can be claimed; a competing claim receives a
   conflict response.
3. The claim persists the service crew identity and timestamp, survives reload,
   and is visible to other devices.
4. Only the claimant may transition the claimed order to `delivered`.
5. Completing delivery clears the active claim through the delivered state.

## Open Questions

None. A claim is deliberately modelled independently from the canonical order
status so kitchen, payment, reporting, and platform integrations keep their
existing status vocabulary.
