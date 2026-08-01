# Market Checkout Provider Adapter Handoff

Use this handoff when a payment provider is selected for market checkout
provider split mode. The market checkout core is provider-agnostic; provider
work should stay inside adapter endpoints, provider-specific customer
confirmation, and provider-specific webhook translation.

## Scope

Provider adapter implementation owns:

- Creating one aggregate payment intent for a market checkout.
- Returning one provider-agnostic `nextAction` when customer confirmation is
  required.
- Looking up provider status for manual and automatic reconciliation.
- Verifying provider callbacks and translating them into the generic webhook
  status model.
- Requesting or translating aggregate refunds.

Provider adapter implementation must not:

- Mark market checkouts paid without a paid provider response, verified webhook,
  or reconciliation response.
- Mutate child order payment state directly outside the market checkout payment
  path.
- Add provider SDK dependencies to the customer app before the selected provider
  requires `client_secret` or `sdk_confirmation` handling.
- Change market checkout ledger schema unless the existing provider payload
  fields cannot represent the provider state.

## Required Endpoints

### Create Payment

Configure with `MARKET_CHECKOUT_PROVIDER_SPLIT_URL`.

The endpoint receives the provider split gateway request documented in
`docs/superpowers/specs/2026-06-02-market-checkout-provider-contract.md`.

The adapter must:

- Treat `idempotencyKey` as stable for retries.
- Authorize exactly `amountCents`.
- Preserve `checkoutId`, `marketSlug`, and allocation metadata for later
  webhook or status lookup.
- Return `status: "paid"` only when the provider has authorized or captured the
  aggregate payment.
- Return `status: "requires_action"` or `status: "pending"` when customer or
  provider-side confirmation is still incomplete.

### Status Lookup

Configure with `MARKET_CHECKOUT_PROVIDER_STATUS_URL`.

The adapter must return one of:

- `pending`
- `paid`
- `failed`
- `refunded`
- `partial_refunded`

This response powers manual admin reconciliation and the automatic stale pending
payment worker. It should include `eventId`, `eventType`, and
`providerPayload` whenever the provider exposes enough detail.

### Refund

Configure with `MARKET_CHECKOUT_PROVIDER_REFUND_URL`.

The adapter must:

- Treat refund `idempotencyKey` as stable for the same refund attempt.
- Return `pending` when refund completion is delayed.
- Return `refunded` or `partial_refunded` only when provider refund state proves
  the refund amount.
- Return `failed` with provider diagnostics in `providerPayload` when the
  provider rejects the refund.

### Health Check

Configure with `MARKET_CHECKOUT_PROVIDER_SPLIT_HEALTH_URL`.

The health endpoint should return `2xx` plus optional:

```json
{
  "message": "Provider gateway ready",
  "capabilities": ["aggregate_authorization", "provider_allocations"]
}
```

## Required Environment Values

Production provider split mode requires:

```env
MARKET_CHECKOUT_SPLIT_MODE=provider_split
MARKET_CHECKOUT_PROVIDER_SPLIT_URL=
MARKET_CHECKOUT_PROVIDER_STATUS_URL=
MARKET_CHECKOUT_PROVIDER_REFUND_URL=
MARKET_CHECKOUT_WEBHOOK_SECRET=
```

Strongly recommended before production traffic:

```env
MARKET_CHECKOUT_PROVIDER_SPLIT_TOKEN=
MARKET_CHECKOUT_PROVIDER_SPLIT_SIGNING_SECRET=
MARKET_CHECKOUT_PROVIDER_SPLIT_HEALTH_URL=
```

## Customer Confirmation Contract

The adapter may return exactly one of these `nextAction` types:

- `redirect`: include non-empty `redirectUrl`; the customer app opens it in the
  current tab.
- `client_secret`: include non-empty `clientSecret`; provider-specific payment
  element work can be added after provider selection.
- `sdk_confirmation`: include object `providerPayload`; provider-specific SDK
  confirmation work can be added after provider selection.

Invalid or unsupported `nextAction` payloads are rejected before the checkout is
persisted as a pending provider payment.

## Webhook Translation

Provider callbacks must translate into the generic webhook status model:

- paid: `market_checkout.payment_paid`
- failed: `market_checkout.payment_failed`
- refunded: `market_checkout.payment_refunded`
- partial refund: `market_checkout.payment_partial_refunded`

Callbacks must include at least one stable identifier:

- `marketCheckoutPaymentId`
- `marketCheckoutId`
- provider transaction ID

Unsigned callbacks fail before audit, ledger, session, or cache mutation.
Duplicate provider event IDs are idempotent through the payment audit log.

## Required Test Fixtures

Before enabling production traffic, add provider-specific fixtures for:

- Immediate paid payment response.
- Pending redirect payment response.
- `client_secret` or `sdk_confirmation` response if the selected provider needs
  it.
- Paid webhook event.
- Failed webhook event.
- Pending status lookup response.
- Paid status lookup response.
- Refunded status lookup response.
- Pending refund response.
- Completed refund response.

Keep the generic mock fixtures in
`apps/api/src/features/market-checkouts/testing/mockMarketCheckoutProviderContract.ts`
as the baseline contract.

## Acceptance Gates

Run these commands after the adapter is wired:

```bash
pnpm exec vitest run apps/api/src/features/market-checkouts/services/MarketCheckoutPaymentProvider.test.ts
pnpm exec vitest run apps/api/src/features/market-checkouts/services/MarketCheckoutPaymentWebhookService.test.ts
pnpm exec vitest run apps/api/src/workers/market-checkout-reconciliation.test.ts
pnpm exec vitest run apps/api/src/features/market-checkouts/routes/index.test.ts
pnpm exec vitest run apps/customer-app/src/tests/views/market-checkout-tracking-view.test.ts
pnpm exec vitest run apps/admin-dashboard/src/views/PlatformMarketCheckoutsView.test.ts
```

Production enablement is allowed only when:

- Admin provider status reports `ready`.
- Provider connectivity check passes or the missing health URL is an explicit
  launch decision.
- Create payment, status lookup, webhook verification, and refund fixtures pass.
- Pending payment paths stay pending until webhook or reconciliation proves the
  final state.
- Accounting export includes payment clearing, vendor payable, platform fee, and
  refund journal lines for provider split payments.
