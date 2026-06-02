# Market Checkout Payment Readiness

This runbook tracks the staged work required to make market checkout payments
ready before a specific payment provider is selected.

## Goal

Prepare the market checkout payment path so a future provider adapter can be
connected by implementing the provider HTTP contract, provider-specific customer
confirmation, and provider-specific webhook translation only. The platform must
avoid hard-coding Stripe, TapPay, ECPay, NewebPay, LINE Pay, or any other
gateway before that decision is made.

## Current Provider-Agnostic Contract

The authoritative contract is
`docs/superpowers/specs/2026-06-02-market-checkout-provider-contract.md`.

Already scaffolded provider-agnostic surfaces:

- API gateway contract for aggregate market checkout payments.
- Parent market checkout payment ledger rows.
- Child order allocation validation.
- Provider `nextAction` handling for redirect, client secret, and SDK
  confirmation flows.
- Generic webhook endpoint and status reconciliation service.
- Provider refund endpoint contract.
- Admin provider readiness and connectivity checks.
- Admin settlement, vendor payout, and accounting CSV exports.

## Phase 1 - Provider Contract Hardening

Purpose: make the existing provider-agnostic contract strict enough that a
future adapter cannot return ambiguous or unusable payment actions.

Deliverables:

- Reject provider split `redirect` actions without `redirectUrl`.
- Reject provider split `client_secret` actions without `clientSecret`.
- Reject provider split `sdk_confirmation` actions without a provider payload.
- Keep the mock provider fixture aligned with required adapter operations.
- Keep the provider contract spec and this runbook aligned.

Verification:

```bash
rtk pnpm exec vitest run apps/api/src/features/market-checkouts/services/MarketCheckoutPaymentProvider.test.ts
```

Exit criteria:

- Provider gateway parsing fails closed for malformed payment actions.
- Valid paid and pending mock provider responses still pass.

## Phase 2 - Checkout Payment Flow Verification

Purpose: prove the full customer-facing payment path stays provider-agnostic.

Deliverables:

- Route tests for `/api/v1/market-checkouts/:id/pay` covering paid,
  `requires_action`, failed, and retry behavior.
- Customer tracking tests proving redirect actions open in the current tab and
  client-secret / SDK actions remain pending.
- Guest-token recovery remains available after provider redirect return.

Current coverage:

- API route tests cover paid child transactions, provider split gateway
  failures, provider split `requires_action` pending payments, partial failures,
  and retrying unpaid vendors only.
- Customer tracking tests cover provider redirect, return-after-webhook-paid,
  client-secret pending, SDK-confirmation pending, and recovered child order
  guest-token access.

Verification:

```bash
rtk pnpm exec vitest run apps/api/src/features/market-checkouts/routes/index.test.ts
rtk pnpm exec vitest run apps/customer-app/src/tests/views/market-checkout-tracking-view.test.ts
```

Exit criteria:

- No customer flow requires a provider SDK before provider selection.
- Pending provider payments are not marked paid until webhook or reconciliation
  proves payment state.

## Phase 3 - Webhook And Reconciliation Readiness

Purpose: make delayed, failed, duplicated, and refunded provider callbacks safe.

Deliverables:

- Generic HMAC, Stripe-compatible, and LINE Pay-compatible webhook signature
  verification tests.
- Duplicate provider event IDs remain idempotent.
- Manual reconciliation and cron reconciliation update ledger, persisted
  session, cached checkout, and admin index consistently.
- Provider split refund results can remain pending without incorrectly marking
  the checkout refunded.

Current coverage:

- Webhook service tests cover Stripe-compatible signatures, generic HMAC
  signatures, LINE Pay-compatible signatures, audit-log event deduplication, and
  unsigned events failing before audit, ledger, session, or cache mutation.
- Route tests cover manual reconciliation from the provider status endpoint and
  pending provider split refunds remaining paid until the provider reports a
  completed refund.
- Worker tests cover stale pending payment lookup, stale pending refund lookup,
  and skipped batches when provider status lookup is not configured.

Verification:

```bash
rtk pnpm exec vitest run apps/api/src/features/market-checkouts/services/MarketCheckoutPaymentWebhookService.test.ts
rtk pnpm exec vitest run apps/api/src/workers/market-checkout-reconciliation.test.ts
```

Exit criteria:

- A provider adapter can rely on one reconciliation path for webhook, manual
  lookup, and cron lookup.
- Invalid or unsigned provider callbacks fail before mutating payment state.

## Phase 4 - Admin Operations And Accounting

Purpose: give platform operations enough visibility before the payment provider
is chosen.

Deliverables:

- Provider readiness shows gateway, webhook secret, status URL, refund URL,
  request signing, and health URL state.
- Connectivity check exposes pass, fail, and skipped states.
- Admin can filter by provider operation alerts.
- Admin can export checkout, vendor settlement, and accounting ledger CSVs.

Current coverage:

- API route tests cover child-transaction mode, missing provider split gateway,
  partially configured provider split mode, ready provider split mode, and
  health URL connectivity checks.
- API route tests cover operation-alert filtering, checkout CSV export, vendor
  settlement summary/export, and accounting ledger export with payment clearing,
  vendor payable, platform fee revenue, refund clearing, and payment reversal
  journal lines.
- Admin dashboard tests cover provider readiness display, missing configuration
  labels, provider connectivity checks, operation-alert filters, vendor
  settlement totals, checkout detail provider alerts, reconciliation action, and
  all three export actions.

Verification:

```bash
rtk pnpm exec vitest run apps/admin-dashboard/src/views/PlatformMarketCheckoutsView.test.ts
rtk pnpm exec vitest run apps/api/src/features/market-checkouts/routes/index.test.ts
```

Exit criteria:

- Operations can see whether provider split is ready before enabling it.
- Accounting exports include payment, refund, platform fee, and vendor payable
  journal lines.

## Phase 5 - Provider Adapter Selection

Purpose: connect the selected gateway without changing the market checkout core
flow.

Provider adapter must implement:

- `create_payment`: create one aggregate market checkout payment intent.
- `status_lookup`: query provider state for delayed or missing webhooks.
- `webhook_verification`: verify provider-specific callback signatures and
  translate payloads into the generic market checkout webhook status model.
- `refund`: request or translate aggregate market checkout refunds.

Provider adapter must supply:

- Hosted redirect, client secret, or SDK confirmation contract.
- Production env values for split URL, status URL, refund URL, webhook secret,
  bearer token if required, request signing secret, and optional health URL.
- Test fixtures for paid, failed, pending, refunded, and partial-refund events.

Current readiness:

- The adapter handoff is documented in
  `docs/runbooks/market-checkout-provider-adapter-handoff.md`.
- Existing mock provider fixtures define the baseline request, paid response,
  pending response, paid status lookup, refund request, refund response, paid
  webhook payload, and generic HMAC signature helper.
- Provider selection can now focus on adapter endpoint implementation,
  provider-specific customer confirmation, and webhook payload translation.

Verification after provider selection:

```bash
rtk pnpm exec vitest run apps/api/src/features/market-checkouts/services/MarketCheckoutPaymentProvider.test.ts
rtk pnpm exec vitest run apps/api/src/features/market-checkouts/services/MarketCheckoutPaymentWebhookService.test.ts
rtk pnpm exec vitest run apps/api/src/features/market-checkouts/routes/index.test.ts
rtk pnpm exec vitest run apps/customer-app/src/tests/views/market-checkout-tracking-view.test.ts
rtk pnpm exec vitest run apps/admin-dashboard/src/views/PlatformMarketCheckoutsView.test.ts
```

Exit criteria:

- The adapter passes the provider-agnostic contract before any production
  provider split traffic is enabled.
- Provider-specific code is isolated to adapter, customer confirmation, and
  webhook translation surfaces.
