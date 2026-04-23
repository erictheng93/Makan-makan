# Persona Test Checklist Audit

Source of truth audited against:
- `docs/testing/personas.md`
- `tests/e2e/helpers/personas.ts`
- `tests/e2e/**/*.spec.ts` (`58` spec files)
- repo-wide `*.spec.ts` / `*.test.ts` broad scan across `tests/`, `apps/`,
  and `packages/` (`527` files)
- selected app/package unit and integration tests where they materially clarify
  API/business behavior

Status legend:
- `Covered`: repeatable test hits the real API or API+DB path and its assertions match the persona risk directly.
- `Partial`: spec exists, but it only covers an adjacent scenario, a weaker
  version of the documented risk, or a service-level invariant without the full
  end-to-end release oracle.
- `Missing`: no matching spec, or the document explicitly marks it as backlog.
- Mock-only Playwright route tests are never `Covered`; they can only be `Partial` because they verify UI reaction, not the API/business invariant.

Current audit summary:
- Total persona/cross-persona risk points in `personas.md`: `85`
- Note: the requested `82` total / `27` new rows does not match the current file. The listed added ranges (`M1-M5`, `E1-E7`, `C13-C15`, `H7-H9`, `S5-S7`, `K11`, `A5-A7`, `X7-X11`) add up to `30` rows.
- Baseline estimate before re-checking added specs: `14 Covered / 18 Partial / 53 Missing`
- Current verified status after enforcing real-API coverage only: `1 Covered / 42 Partial / 42 Missing`
- Explicit spec paths cited by the document or audit: `33`
- Existing cited spec files: `33`
- Missing cited spec files: `0`

Blocker skeleton specs:
- `tests/e2e/journeys/customer/malicious-input.spec.ts` exists and hits the real API for sanitizer/security release gates.
- `tests/e2e/journeys/chef/cancel-during-prep.spec.ts` exists and hits the real API for cancel-lock release gates.

Additional existing specs now considered:
- `tests/e2e/integration/auth-api.spec.ts`
- `tests/e2e/integration/admin-operations-api.spec.ts`
- `tests/e2e/integration/kitchen-api.spec.ts`
- `tests/e2e/integration/coupon-api.spec.ts`
- `tests/e2e/journeys/cashier/card-mobile-payment.spec.ts`
- `tests/e2e/journeys/customer/coupon-checkout.spec.ts`
- `tests/e2e/journeys/customer/guest-shop-delivery.spec.ts`
- `tests/e2e/journeys/customer/guest-shop-takeaway.spec.ts`
- `tests/e2e/journeys/owner/daily-operations.spec.ts`
- `tests/e2e/integration/admin-order-management.real.spec.ts`
- `tests/e2e/integration/kitchen-display.real.spec.ts`
- `tests/e2e/integration/p0-release-gates.spec.ts`
- `tests/e2e/integration/p1-current-quarter-gates.spec.ts`
- `apps/api/src/features/guest-orders/__tests__/validation.test.ts`
- `apps/api/src/features/backup/controllers/__tests__/BackupController.test.ts`
- `apps/api/src/features/backup/services/__tests__/BackupValidationService.test.ts`
- `apps/api/src/features/backup/services/__tests__/BackupStorageService.test.ts`
- `apps/api/src/features/backup/services/__tests__/BackupService.test.ts`
- `apps/api/src/features/pos/__tests__/services.test.ts`
- `apps/api/src/features/pos/__tests__/edge-cases.test.ts`
- `packages/database/src/services/__tests__/POSService.test.ts`
- `packages/database/src/services/__tests__/GroupOrderService.split.test.ts`
- `packages/database/src/services/__tests__/GroupOrderService.payment.test.ts`
- `packages/queue-core/src/print/__tests__/PrinterService.test.ts`
- `packages/queue-core/src/print/__tests__/PrinterHealthMonitor.test.ts`
- `packages/queue-core/src/print/__tests__/PrintJobManager.test.ts`
- `apps/print-agent/src/__tests__/PrintAgent.test.ts`
- `packages/database/src/services/__tests__/NotificationService.test.ts`
- `apps/api/src/features/notifications/__tests__/feature.test.ts`
- `apps/api/src/features/integrations/__tests__/webhook.routes.test.ts`
- `apps/api/src/features/integrations/__tests__/UberEatsAdapter.test.ts`
- `apps/api/src/__tests__/integration-legacy-mockdrizzle/webhooks.integration.test.ts`

## Test Execution Priority

Release gating should use three execution tiers plus one P3 roadmap bucket:
- Tier 1 / P0 blockers: must be repeatably verifiable before release.
- Tier 2 / P1 high-risk workflows: should be verified before release unless explicitly risk-accepted.
- Tier 3 / P2 regression depth: can follow after P0/P1 but should remain tracked.
- Tier 4 / P3 polish: tracked separately so it does not dilute P0-P2 delivery.

### Tier 1 - P0 Blockers

These `11` execution items cannot be deferred because they protect payment integrity, authorization, data recovery, and cross-role conflict rules.

| ID | Target | Recommended test form | Release oracle |
| --- | --- | --- | --- |
| C10 | Order note XSS / SQL / oversize payload | API + security test | Malicious payload is escaped/rejected, over-limit payload is blocked, and no executable markup/query effect persists. |
| H3 / X2 | Customer cancellation vs chef preparing lock rule | Integration + targeted E2E | Once kitchen state is `preparing`, cancel is rejected or creates a defined conflict/compensation state visible to customer and kitchen. |
| A1 | Old token immediately invalid after demotion | API + security | Privileged request with pre-demotion token fails immediately after role change/session invalidation. |
| A6 | Backup restore drill with checksum and row count | Integration + manual drill | Restored DB row counts match backup manifest and checksums match expected backup state. |
| K6 | Refund after shift/accounting close uses allowance/credit-note flow | API + targeted E2E | Closed ledger is immutable; refund creates an adjustment/credit-note record with audit trail. |
| K7 | Partial-payment totals are strictly consistent | API | Order cannot close until split payments sum exactly to authoritative total. |
| G5 | Forged guest token is rejected | API + security | Token/order/restaurant mismatch returns `403`/`404` and never returns another guest's order payload. |
| E1 | Payment gateway timeout does not assume success | Contract test with mocked gateway | Timeout leaves payment unpaid/pending until authoritative status poll/webhook confirms success. |
| E2 | Duplicate webhook trigger has only-once effect | Integration + idempotency assertion | Duplicate callback creates one payment/order transition and one idempotency/audit effect. |
| X9 | Owner write operation is rejected after Admin disables Owner | Integration + session invalidation | Owner's active session cannot complete the next write after disable; attempted mutation is absent. |
| M1 | Manager audit log separates actor from on-behalf-of context | API + audit log assertion | Audit row records manager actor and delegated owner/store context as separate fields. |

### Tier 2 - P1 Current-Quarter Fill

Current count from the live audit is `36` rows, not `about 24`: `17` Partial/Weak-Partial rows to strengthen plus `19` P1 Missing rows.

Batch 1 gate coverage added in `tests/e2e/integration/p1-current-quarter-gates.spec.ts` for the `14` Strengthen Partial rows: C2, C4, C5, O1, O2, O3, O7, H1, H2, K10, G4, X3, X4, X6. These remain `Partial` in the audit until the real API gates pass in CI.

| Group | IDs | Execution target |
| --- | --- | --- |
| Strengthen Partial | C2, C4, C5 | Delisted-item semantics, payment idempotency key, dual-device concurrency. |
| Strengthen Partial | O1, O2, O3, O7 | Old-store resource denial, active-order item snapshot, `>10MB` / non-image upload boundaries, owner-vs-owner isolation. |
| Strengthen Partial | H1, H2 | Kitchen backlog replay correctness and chef-vs-chef conflict specificity. |
| Strengthen Partial | K10 | Coupon atomic race, not just validate/manage/apply flows. |
| Strengthen Partial | G4 | Guest WS authorization for own order only. |
| Strengthen Partial | X3, X4, X6 | Delivery-vs-payment race, owner-delist-during-checkout, employee status-update conflict matrix. |
| New P1 Missing | C13, C14 | Offline cart submit and combo/add-on required-choice validation. |
| P1 Partial needing full oracle | H4 | Printer fallback has print-stack evidence but still needs kitchen-flow fallback E2E. |
| New P1 Missing | H7, H8, H9 | Combo kitchen split, substitution flow, menu-edit snapshot during prep. |
| New P1 Missing | S1, S2, S5 | Wrong-table delivery, address version switch, multi-order assignment conflict. |
| New P1 Missing | K11 | Same-IP card brute-force/risk throttling. |
| New P1 Missing | A3, A5, A7 | PII export audit, retention/right-to-be-forgotten, incident degradation/rollback. |
| P1 Partial needing full oracle | E4, E5 | Print-agent offline and SMS/email failure have service/API-adjacent evidence but still need main-flow decoupling oracles. |
| New P1 Missing | E3 | Third-party menu sync failure. |
| New P1 Missing | M2, M3, M4 | Delegation expiry, delegated cross-store boundary, manager cash-variance audit. |
| New P1 Missing | X7, X8, X11 | Payment-channel disconnect, external menu sync vs owner delist, manager delegation across cashier shift close. |

### Tier 3 - P2 Roadmap

Current count is `18` rows if C12 gets an interim P2 locale/timestamp hardening item before full P3 timezone support.

| IDs | Execution target |
| --- | --- |
| C11, C12, C15 | Same-table guest partitioning, interim locale/timestamp regression, notification/receipt failure decoupling. `C15` is now Partial from notification failure tests, but still lacks the order/receipt decoupling oracle. |
| H5, H6 | Append-order kitchen insertion and unfinished-order shift handoff. |
| S3, S4, S6, S7 | Delivery retry state, duplicate delivered idempotency, pickup confirmation, task takeover after device change. |
| K8, K9 | Cash drawer variance review and incoming-order handoff rule. |
| G2, G3 | Guest phone/table lookup partitioning and guest-to-user history merge. |
| E6, E7 | Webhook signature rejection and external POS/accounting reconciliation lag. `E6` is now Partial from webhook HMAC route/adapter tests, but still lacks mutation isolation/alert proof. |
| M5 | Multiple managers on duty with actor-level traceability. |
| X5, X10 | Real reservation-to-ordering state machine and smooth in-service app upgrade. |

### Tier 4 - P3

| ID | Execution target |
| --- | --- |
| C12 | Full timezone support across display, ordering, reporting, and persisted timestamps. |

## CUSTOMER

| ID | Risk | Scenario | Solution options | Test Oracle | Status | Evidence / Gap |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | P1 | QR token expired after scan | QR expiry validation, friendly error page, retry / home CTA | Expired QR route shows recovery UI and does not create an order/session. | Partial | `qr-expiry.spec.ts` is mock-only (`page.route`); needs real QR expiry API/path to be Covered. |
| C2 | P0 | Item delisted after it was added to cart | checkout revalidation, delisted-item removal, user-visible recovery CTA | Checkout returns `409`/blocked state and cart shows removable stale item. | Partial | `stock-validation.spec.ts` covers out-of-stock/409; `tests/e2e/integration/p1-current-quarter-gates.spec.ts` now adds the real-API delisted-item checkout block + active-order snapshot oracle. |
| C3 | P0 | Stock becomes zero during submit | server-side stock check, `409`, keep cart intact | Submit receives `409`; cart item remains visible with quantity preserved. | Partial | `stock-validation.spec.ts` mocks `409`; needs real order API stock revalidation and DB/inventory assertion. |
| C4 | P0 | Payment interrupted by network failure | idempotency key, payment-status reconciliation, safe retry | Retry resolves to one payment row/charge and exposes authoritative payment status. | Partial | `error-recovery.spec.ts` covers order submission failure; `p1-current-quarter-gates.spec.ts` now asserts retrying the same real payment idempotency key has one payment effect. |
| C5 | P1 | Same customer uses two devices concurrently | device isolation, cart merge policy, backend idempotency / conflict policy | Two concurrent submits produce one accepted order or an explicit conflict with no lost cart state. | Partial | `concurrent-operations.spec.ts` covers other 409 races; `p1-current-quarter-gates.spec.ts` now adds the real dual-device guest submit oracle. |
| C6 | P1 | Delivery address outside supported zone | zone validation before checkout, inline error, blocked submit | Unsupported address keeps submit disabled or returns validation error before payment. | Partial | `delivery-zone.spec.ts` mocks address validation; needs real API zone validation before Covered. |
| C7 | P1 | Cancel after order submit | status gate by lifecycle state, cancel only pre-ready | Cancellable states return success; non-cancellable states reject and preserve order status. | Partial | `order-cancellation.spec.ts` is mostly mock-only; `order-lifecycle.spec.ts` covers owner cancel via real API, not customer lifecycle gate. |
| C8 | P2 | JWT expires during long-lived session | silent refresh, refresh-token fallback, forced relogin on failure | Expired token flow either refreshes and retries or redirects to login without stale access. | Partial | `auth-guard.spec.ts` mocks expiry/refresh; `auth-api.spec.ts` covers real login/token presence but not expiry lifecycle. |
| C9 | P2 | Append order to same table after first order | append-order API, kitchen merge/flag, tracking continuity | Append submit links to original table/order context and tracking remains continuous. | Partial | `append-order.spec.ts` is mock-only; `guest-order-api.spec.ts` covers real append items, but not kitchen merge/flag continuity. |
| C10 | P0 | Malicious note input, SQL/XSS payloads | server-side sanitization, payload limit, frontend escaping | Stored/displayed note is escaped, over-limit payload is rejected, and DB query is not altered. | Partial | `tests/e2e/integration/p0-release-gates.spec.ts` and `tests/e2e/journeys/customer/malicious-input.spec.ts` hit the real API for oversize, SQL-like, and XSS persisted-note oracles; `apps/api/src/features/guest-orders/__tests__/validation.test.ts:238` rejects notes over 500 chars. |
| C11 | P2 | Multiple diners use same table QR | table-scoped ordering, independent customer identity, merged table view | Two guests on same table create distinct identities while table view merges orders correctly. | Missing | Backlog only. |
| C12 | P3 | Locale/timezone changes affect order flow | locale-safe formatting, timezone-stable timestamps, currency assertions | Switching locale changes UI strings while order timestamps/totals remain stable. | Partial | Weak Partial: `tests/e2e/journeys/customer/edge-cases.spec.ts:482` switches UI language only; timezone arithmetic is not asserted. |
| C13 | P1 | Offline cart additions then reconnect submit | idempotency + revalidation, no duplicate order | Reconnect submit creates one order and reruns stock/menu validation. | Missing | New blueprint row; no matching spec. |
| C14 | P1 | Combo required choices / add-on dependency invalid | schema validation, checkout block | Invalid combo/add-on payload is rejected before order creation. | Missing | New blueprint row; no matching spec. |
| C15 | P2 | Notification / receipt delivery failure | main flow decoupled, retry, no sensitive leakage | Order remains successful; notification status records failure/retry without leaking PII. | Partial | `NotificationService.test.ts` covers email/SMS provider failure surfaces and `notifications/feature.test.ts` covers failed send responses; no order/receipt main-flow decoupling oracle. |

## OWNER

| ID | Risk | Scenario | Solution options | Test Oracle | Status | Evidence / Gap |
| --- | --- | --- | --- | --- | --- | --- |
| O1 | P0 | Switch restaurant but old resource URL remains accessible | strict `restaurantId` authorization, route-level ownership checks | Direct request to old restaurant resource after switch returns `403` or empty scoped data. | Partial | `restaurant-switching.spec.ts` verifies switching/persistence/API calls; `p1-current-quarter-gates.spec.ts` now probes direct old/other-store resource URLs with a real owner token. |
| O2 | P1 | Deactivate item while active orders exist | new-order block, active-order snapshot preservation | Existing order keeps item snapshot; new checkout for inactive item is blocked. | Partial | `menu-management.spec.ts` covers availability toggles; `p1-current-quarter-gates.spec.ts` now adds active-order snapshot preservation plus new-order block assertions. |
| O3 | P1 | Upload invalid or oversize image | MIME/size validation, pre-upload rejection, R2-safe failure handling | Non-image/oversize upload is rejected and no media row/object is created. | Partial | `menu-management.spec.ts` covers upload failure; `p1-current-quarter-gates.spec.ts` now asserts non-image and oversize payload boundaries before persistence. |
| O4 | P1 | Batch repricing partially fails | transaction rollback, preview/diff, per-row validation before commit | A mixed-validity batch leaves all item prices unchanged and reports row errors. | Missing | Backlog only. |
| O5 | P1 | Disable employee with active orders | reassignment flow, soft disable, ownership transfer | Deactivate request records inactive user and preserves or reassigns active work. | Partial | Weak Partial: `tests/e2e/integration/admin-operations-api.spec.ts:225` deactivates a user but does not seed active orders. |
| O6 | P2 | Large report range harms system | pagination, enforced max range, async export | Oversized report range is rejected/async and does not run an unbounded synchronous query. | Missing | Backlog only. |
| O7 | P0 | Cross-store RBAC access | ownership guard, row scoping, API `403` assertions | User from restaurant A cannot read/write restaurant B resources. | Partial | `rbac-permissions.spec.ts`, `kitchen-api.spec.ts` cross-restaurant chef `403`, and `orders/tenant-isolation.test.ts` support this; `p1-current-quarter-gates.spec.ts` adds owner-A vs owner-B real API read/write denial probes. |
| O8 | P1 | Change tax rate during business hours | versioned tax snapshot on order creation, old/new order separation | Pre-change order keeps old tax; post-change order uses new tax. | Missing | Backlog only. |

## CHEF

| ID | Risk | Scenario | Solution options | Test Oracle | Status | Evidence / Gap |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | P0 | WS disconnect then replay missed orders | reconnection, replay buffer, heartbeat health checks | Order created during disconnect appears in kitchen queue within SLA after reconnect. | Partial | `sse-realtime.spec.ts` and real kitchen specs cover reconnect/visibility; `p1-current-quarter-gates.spec.ts` now adds a real kitchen backlog replay visibility oracle after order creation. |
| H2 | P1 | Two chefs complete same order simultaneously | compare-and-swap status change, optimistic-lock conflict UI | Concurrent completion yields one success and one `409`/reload prompt. | Partial | `concurrent-operations.spec.ts` covers conflict races; `p1-current-quarter-gates.spec.ts` now asserts chef-vs-chef concurrent item completion returns one success and one conflict. |
| H3 | P0 | Customer cancels while chef is preparing | cancel lock rules, compensation flow, kitchen alert | Cancel during `preparing` is rejected or creates explicit kitchen conflict/compensation state. | Missing | Real API release-gate assertions now exist in `tests/e2e/integration/p0-release-gates.spec.ts` and `tests/e2e/journeys/chef/cancel-during-prep.spec.ts`; remains Missing until the gate passes in CI. |
| H4 | P1 | Printer offline fallback in kitchen flow | deferred print queue, retry/reprint, visible printer health | Kitchen order remains actionable and print job enters retry queue with visible offline state. | Partial | Print stack tests cover unavailable printers, offline health, queue limits, and retry plumbing (`PrinterService.test.ts`, `PrinterHealthMonitor.test.ts`, `PrintJobManager.test.ts`); no kitchen-flow fallback E2E. |
| H5 | P2 | Append order must insert into kitchen queue in real time | append-event routing, visual append marker, no loss of context | Appended item appears in kitchen queue with append marker and original table context. | Partial | `append-order.spec.ts` proves customer-side append only. |
| H6 | P2 | Shift handoff of unfinished orders | assignee transfer, queue persistence, shift ownership rules | Unfinished orders remain visible after shift switch with correct assignee/ownership. | Partial | `tests/e2e/journeys/chef/kitchen-shift.spec.ts` covers normal shift flow, not handoff semantics. |
| H7 | P1 | Combo split into kitchen stations | consistent split rules, single serving point | Combo order creates deterministic station tickets and one serving aggregation point. | Missing | New blueprint row; no matching spec. |
| H8 | P1 | Ingredient shortage requires substitution while preparing | substitution flow, customer notification, amount recalculation | Substitution records choice, notifies customer, and recalculates/refunds amount if needed. | Missing | New blueprint row; no matching spec. |
| H9 | P1 | Menu edited while order is preparing | order-time snapshot | Preparing order displays original item data despite later menu edits. | Missing | New blueprint row; no matching spec. |

## SERVICE_CREW

| ID | Risk | Scenario | Solution options | Test Oracle | Status | Evidence / Gap |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | P1 | Wrong table marked delivered | table confirmation, delivery confirmation modal, reversible correction flow | Delivery requires table/order confirmation and supports correction/audit if wrong. | Missing | Backlog only. |
| S2 | P1 | Address changes during delivery | address versioning, dispatch re-confirmation, route refresh | Address update increments version and active route shows the latest confirmed version. | Missing | Backlog only. |
| S3 | P1 | Delivery status update fails | retry queue, offline recovery, conflict-safe UI state | Failed status update leaves visible retry state and does not falsely mark delivered. | Partial | `tests/e2e/journeys/service-crew/delivery-shift.spec.ts` covers network error, not explicit WS state sync path. |
| S4 | P2 | Duplicate delivered action | idempotent status endpoint, disabled button after success | Second delivered action returns idempotent success or conflict without duplicate audit/event. | Missing | Backlog only. |
| S5 | P1 | One crew member receives conflicting multi-order assignments | explicit priority/order sorting | Conflicting assignments render deterministic priority and cannot overwrite each other. | Missing | New blueprint row; no matching spec. |
| S6 | P2 | Wrong pickup order | scan/order-number confirmation | Pickup is blocked when scanned ticket/order number does not match assignment. | Missing | New blueprint row; no matching spec. |
| S7 | P2 | Device dies or changes mid-task | task takeover, state persistence | Replacement device can resume assigned task without losing current delivery state. | Missing | New blueprint row; no matching spec. |

## CASHIER

| ID | Risk | Scenario | Solution options | Test Oracle | Status | Evidence / Gap |
| --- | --- | --- | --- | --- | --- | --- |
| K1 | P0 | Card declined | retryable payment state, button reset, clear error message | Decline leaves order unpaid, button re-enabled, and error shown. | Partial | `pos-shift-errors.spec.ts` mocks declined payment; needs real POS/payment API rejection and unpaid-state assertion. |
| K2 | P0 | Duplicate payment submit | idempotency key, already-paid guard, `409` UX | Second payment POST returns `409`/already-paid and only one payment effect exists. | Partial | Current evidence is mock UI/concurrency-adjacent; needs real payment API idempotency key and DB only-once assertion. |
| K3 | P0 | Amount mismatch | server-side amount recompute, forced reset, cashier confirmation | Server rejects mismatched amount and preserves authoritative total. | Partial | `pos-shift-errors.spec.ts` mocks amount mismatch; needs real server-side amount recompute test. |
| K4 | P1 | Printer offline after successful payment | payment finality decoupled from print, retry print path | Payment stays paid while receipt print enters retry/reprint path. | Partial | Current test mocks payment and receipt failure; needs real payment finality + print queue/health assertion. |
| K5 | P0 | Payment timeout `504` | authoritative payment-status polling, unpaid lock, manual reconciliation | Timeout leaves payment pending/unconfirmed until status poll resolves. | Partial | `pos-shift-errors.spec.ts` mocks timeout; needs mocked gateway contract hitting real payment handler/status poll. |
| K6 | P0 | Refund after closing period | credit-note / allowance flow, immutable closed ledger | Closed ledger cannot be mutated; refund creates allowed adjustment record. | Partial | POS refund service tests cover refund limits; `p0-release-gates.spec.ts` now hits the real POS refund API and asserts credit-note/allowance output without closed-ledger mutation. |
| K7 | P0 | Partial-payment sum mismatch | exact total enforcement, split allocation validator | Split payments cannot close unless sum exactly equals authoritative total. | Partial | Group-order split/payment tests cover calculated split amounts; `p0-release-gates.spec.ts` now hits the real payments API contract and asserts mismatched partial payments cannot close the order. |
| K8 | P1 | Drawer total differs from system total at shift end | reconciliation summary, supervisor review, variance logging | Variance is logged and requires review before close completes. | Partial | `tests/e2e/journeys/cashier/pos-shift.spec.ts` covers reconciliation summary, not variance escalation. |
| K9 | P2 | New order arrives during handoff | handoff lock, incoming-order queueing, next-shift acceptance | Order arriving during handoff is assigned by explicit handoff rule. | Missing | Backlog only. |
| K10 | P0 | Same coupon used by multiple orders | atomic redemption, single-use lock, post-payment verification | Concurrent redemption allows one order and rejects/rolls back the other. | Partial | `coupon-management.spec.ts`, `coupon-api.spec.ts`, and `coupon-checkout.spec.ts` cover validate/manage/apply flows; `p1-current-quarter-gates.spec.ts` now adds concurrent single-use redemption atomicity. |
| K11 | P1 | Same IP brute-forces card payments | rate limit, risk transaction blocking | Burst payment attempts from same IP are throttled and risk event is logged. | Missing | New blueprint row; no matching spec. |

## ADMIN

| ID | Risk | Scenario | Solution options | Test Oracle | Status | Evidence / Gap |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | P0 | Demoted admin still has valid token | token revocation, session invalidation, permission recheck on each request | Old token after demotion fails privileged request immediately. | Missing | `auth-api.spec.ts` covers base auth matrix; `p0-release-gates.spec.ts` now asserts active owner/admin-style token rejection after disable/downgrade. Remains Missing until CI proves immediate invalidation. |
| A2 | P0 | Store deletion without anonymization/backup | anonymization workflow, recoverable backup, audit log | Delete flow creates backup/audit and removes or anonymizes PII as policy requires. | Missing | Backlog only. |
| A3 | P1 | Large PII export without audit trail | export audit log, explicit approval gates, scope logging | PII export creates audit row with actor, scope, timestamp, and approval state. | Missing | Backlog only. |
| A4 | P1 | Feature flag flip impacts active orders | flag scoping, phased rollout, active-order snapshot consistency | Active orders keep previous behavior while new orders use updated flag. | Missing | Backlog only. |
| A5 | P1 | Right-to-be-forgotten / retention expiry | anonymize/hard-delete + audit | Retention job removes/anonymizes target data and records audit proof. | Missing | New blueprint row; no matching spec. |
| A6 | P0 | Backup restore drill fails | recoverable backup, data integrity, alerting | Restored DB row counts match backup manifest and checksums match. | Partial | Backup unit tests cover restore safety/checksum; `p0-release-gates.spec.ts` now requires real backup create/restore output to include checksum and manifest row-count equality. |
| A7 | P1 | On-call incident degradation | observability, degrade mode, rollback | Incident mode emits alert, serves degraded path, and rollback restores healthy status. | Missing | New blueprint row; no matching spec. |

## MANAGER

| ID | Risk | Scenario | Solution options | Test Oracle | Status | Evidence / Gap |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | P0 | Proxy action recorded as Owner | audit log separates actor / on-behalf-of | Audit row contains manager actor and delegated owner/store context separately. | Missing | `p0-release-gates.spec.ts` now defines the real API contract for manager proxy action plus audit-log actor/on-behalf-of separation; remains Missing until manager delegation APIs exist and pass. |
| M2 | P1 | Delegation remains after authorization expires | scope/time expiry | Request after delegation expiry returns `403` and creates denied audit row. | Missing | New persona; no matching spec. |
| M3 | P1 | Delegated manager crosses store boundary | assigned stores only, other stores `403` | Manager can mutate assigned store only; unassigned store returns `403`. | Missing | New persona; no matching spec. |
| M4 | P1 | Manager approves cash variance | variance, signer, timestamp in audit | Cash variance approval records amount, signer, timestamp, and target shift. | Missing | New persona; no matching spec. |
| M5 | P2 | Multiple managers on duty | parallel permissions, actor traceability | Concurrent manager actions remain attributable to individual actors. | Missing | New persona; no matching spec. |

## GUEST

| ID | Risk | Scenario | Solution options | Test Oracle | Status | Evidence / Gap |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | P1 | Guest token expiry | expiry screen, token refresh/re-entry flow, clear recovery CTA | Expired guest token blocks order lookup and shows re-entry/recovery flow. | Partial | `qr-expiry.spec.ts` and shop flows are mock/UI happy paths; needs real expired guest-token API behavior. |
| G2 | P2 | Same phone number creates guest orders across multiple tables | phone/table scoping, order lookup partitioning | Lookup by phone/table returns only the matching table/order scope. | Missing | Backlog only. |
| G3 | P2 | Guest upgrades to registered user and history merges | account-link flow, order ownership migration | Upgrade links intended guest orders once and leaves unrelated orders unlinked. | Missing | Backlog only. |
| G4 | P1 | Guest subscribes to own order status via WS | guest-specific WS token, order-scoped channel auth | Guest WS token receives own order events and rejects other order channels. | Partial | Guest API and shop e2e tests exist; `p1-current-quarter-gates.spec.ts` now adds guest realtime token same-order allow / other-order deny API assertions. |
| G5 | P0 | Forged guest token reveals another order | token binding to order/restaurant/device, strict auth checks | Forged token/order mismatch returns `403`/`404` and no order payload. | Missing | `p0-release-gates.spec.ts` now creates two real guest orders and asserts one guest token cannot read the other order; remains Missing until passing CI evidence exists. |

## EXTERNAL

| ID | Risk | Scenario | Solution options | Test Oracle | Status | Evidence / Gap |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | P0 | Payment gateway timeout | do not assume success, unpaid lock, status poll correction | Timeout leaves order unpaid/pending until gateway status poll confirms. | Missing | `p0-release-gates.spec.ts` now hits the real payments API with a timeout fixture header and asserts no paid state without authoritative confirmation. |
| E2 | P0 | Delayed payment callback triggers duplicate effects | idempotent webhook handler, only-once effect | Duplicate webhook creates one state transition/payment effect. | Missing | `p0-release-gates.spec.ts` now posts duplicate real webhook requests with the same idempotency key and asserts no duplicate effect. |
| E3 | P1 | Third-party menu sync fails | local system source of truth, retry/report failure | Local menu remains authoritative and sync failure records retryable error. | Missing | New external row; no matching spec. |
| E4 | P1 | Printer / print agent offline | flow does not block, queue reprint, health visible | Order/payment flow completes and print job is queued with offline health status. | Partial | Print-agent and queue-core tests cover print job creation, no-printer unhealthy health, offline status, and queue behavior; no order/payment flow proves print failure is non-blocking. |
| E5 | P1 | SMS / Email cannot be sent | order flow unaffected, notification state traceable | Order succeeds and notification failure is recorded for retry. | Partial | `NotificationService.test.ts` covers email/SMS provider failure and bulk partial failure; API feature tests cover failed notification responses. Missing order-flow unaffected/retry-state assertion. |
| E6 | P2 | Webhook signature verification fails | reject and alert, isolate other channels | Bad signature returns rejection, logs alert, and does not mutate domain state. | Partial | `webhook.routes.test.ts` rejects invalid HMAC with `401`, `UberEatsAdapter.test.ts` verifies real HMAC behavior, and legacy integration hits the webhook route; mutation isolation/alert oracle is incomplete. |
| E7 | P2 | External POS/accounting sync lags | local truth, reconciliation catch-up | Lagging sync can be reconciled to local ledger without duplicate exports. | Missing | New external row; no matching spec. |

## CROSS-PERSONA

| ID | Risk | Scenario | Solution options | Test Oracle | Status | Evidence / Gap |
| --- | --- | --- | --- | --- | --- | --- |
| X1 | P0 | Customer places order and chef receives it in real time | event propagation SLA, realtime queue integrity | `POST /orders` success is followed by kitchen queue/event visibility within SLA. | Covered | Real API support exists in `tests/e2e/integration/order-lifecycle.spec.ts`, `admin-order-management.real.spec.ts`, `kitchen-display.real.spec.ts`, and cross-service API/realtime tests; keep release-gate candidate. |
| X2 | P0 | Customer cancels while chef has started prep | cancellation lock, prep-state conflict handling | Cancel during prep is rejected or produces explicit conflict state visible to both roles. | Missing | Real API release-gate assertions now exist in `p0-release-gates.spec.ts` and `tests/e2e/journeys/chef/cancel-during-prep.spec.ts`; shared H3/X2 gate must pass before release. |
| X3 | P1 | Service delivers while customer/cashier payment is in flight | payment-delivery ordering rules, idempotent transitions | Concurrent delivery/payment resolves to valid final state with no impossible transition. | Partial | `concurrent-operations.spec.ts` covers duplicate payment; `p1-current-quarter-gates.spec.ts` now races real delivery status change against payment capture. |
| X4 | P1 | Owner disables item while customer is checking out | inventory/version revalidation on checkout | Checkout after disable is rejected while cart displays recovery action. | Partial | `stock-validation.spec.ts` covers checkout validation; `p1-current-quarter-gates.spec.ts` now adds the owner-action-triggered checkout rejection oracle. |
| X5 | P2 | Reservation to seated to ordering | reservation state machine, table occupancy sync | Reservation, table, and order states progress consistently across roles. | Partial | `reservation-to-seated.spec.ts` mocks reservation/table APIs; needs real reservation/table/order API state machine. |
| X6 | P1 | Two employees update same order status | optimistic lock, conflict messaging, reload rules | Concurrent status updates produce one success and one conflict/reload path. | Partial | `concurrent-operations.spec.ts` covers claim conflicts; `p1-current-quarter-gates.spec.ts` now asserts two authenticated employee status updates produce one success and one conflict. |
| X7 | P1 | Payment channel disconnects while customer pays | fallback channel, retry, state sync | Payment disconnect leaves one authoritative payment state and retry/fallback path. | Missing | New cross-persona row; no matching spec. |
| X8 | P1 | Platform syncs menu while owner delists item | local source of truth, external channel update | Local delist wins and external channel eventually reflects unavailable item. | Missing | New cross-persona row; no matching spec. |
| X9 | P0 | Admin disables Owner while Owner is operating | immediate session invalidation, write rejection | Owner's next write after disable returns unauthorized/forbidden and no mutation occurs. | Missing | `p0-release-gates.spec.ts` now creates/logs in an owner, disables the owner, then asserts the next table write is rejected and absent. |
| X10 | P2 | App version upgraded during service | smooth upgrade, persistent connections, old-client fallback | Active users keep working or receive controlled fallback during deploy. | Missing | New cross-persona row; no matching spec. |
| X11 | P1 | Manager delegation crosses cashier shift close | delegation survives/ends by explicit policy, audit trace | Shift close records cashier and manager delegation context correctly. | Missing | New cross-persona row; no matching spec. |

## Executable Test Checklist By Persona

Run these first if you need highest-value confidence quickly:
- CUSTOMER: `qr-expiry`, `stock-validation`, `order-cancellation`, `auth-guard`, `append-order`, `coupon-checkout`, `guest-shop-delivery`, `guest-shop-takeaway`
- CASHIER: `pos-shift-errors`, `pos-shift`, `card-mobile-payment`
- CROSS: `order-lifecycle`, `concurrent-operations`, `reservation-to-seated`, `admin-order-management.real`, `kitchen-display.real`
- OWNER / ADMIN: `restaurant-switching`, `rbac-permissions`, `menu-management`, `coupon-management`, `admin-operations-api`, `auth-api`
- API / integration: `kitchen-api`, `coupon-api`, `guest-order-api`, `order-lifecycle`

Release-gate note:
- Mock UI specs remain useful regression checks, but they do not satisfy release-gate coverage.
- P0 release gates must hit real API handlers and, where state matters, assert DB rows / event logs / idempotency records.
- External dependencies may be faked only behind the real in-process adapter/handler boundary; for example, mock the payment gateway response while still calling the real payment API route.

## Audit Refactor Recommendations

1. Expand the audit input scope.
   Include all `tests/e2e/**/*.spec.ts`, relevant `tests/integration/**/*.test.ts`, and high-signal `apps/api/**/__tests__/*.test.ts` API/service tests. The audit should not stop at the original `19` spec files.

2. Keep `Test Oracle` mandatory.
   Every risk row must state what observable state separates pass from fail: HTTP status, DB row, idempotency key, audit log, event delivery, queue item, UI state, or manual-drill artefact.

3. Increase citation precision.
   Evidence should cite `file + test name + line`, not only file name. Example format: `tests/e2e/journeys/cashier/pos-shift-errors.spec.ts > "should show error and re-enable Pay when card is declined" L85`.

4. Split coverage strength from status.
   Recommended future model:
   - `Covered-Strong`: real API/API+DB/realtime path, exact scenario, and oracle all match.
   - `Covered-Weak`: real API path exists, but the scenario is adjacent or the oracle is incomplete.
   - `Partial`: only part of the behavior is tested, or evidence is mock-only UI/service-adjacent.
   - `Missing`: no matching repeatable test or only backlog/documentation exists.

5. Track mock-only explicitly.
   Mock UI specs should remain in evidence because they are useful regressions, but they should be labelled `Mock UI` and excluded from release-gate coverage.

6. Regenerate quarterly as a CI artefact.
   Add `scripts/audit-personas.ts` to scan `*.spec.ts` / `*.test.ts` `describe` and `test` names, associate candidate tests to risk IDs, and emit a Markdown/JSON report for manual review. The script should not decide final coverage alone; it should make stale references and missing line citations visible.

Highest-priority blocker gates to make pass next:
- complete backend behavior for C10 sanitizer/reject assertions in `tests/e2e/journeys/customer/malicious-input.spec.ts` and `tests/e2e/integration/p0-release-gates.spec.ts`
- complete backend behavior for H3/X2 cancel-lock assertions in `tests/e2e/journeys/chef/cancel-during-prep.spec.ts` and `tests/e2e/integration/p0-release-gates.spec.ts`
- make admin token-revoke / owner-disable-active-session / backup-restore-drill gates pass in `tests/e2e/integration/p0-release-gates.spec.ts`
- make cashier refund-after-close and partial-payment total API gates pass in `tests/e2e/integration/p0-release-gates.spec.ts`
- make forged guest token, payment timeout, duplicate webhook idempotency, and manager delegation audit gates pass in `tests/e2e/integration/p0-release-gates.spec.ts`
- coupon atomic race, service crew wrong-table / wrong-pickup / device-handoff specs

Audit conclusion:
- `personas.md` now defines `85` risk rows; the previous `55`-row audit was structurally stale.
- The repo has `58` e2e spec files and `527` total `*.spec.ts` / `*.test.ts` files across `tests/`, `apps/`, and `packages`, not the `19` effectively covered by the earlier audit scope.
- Adding the missing `Test Oracle` column exposes which risks are actually assertable.
- C12 and O5 are now weak `Partial`, not `Missing`.
- The two former missing cited spec files now exist as real-API blocker specs with enforced assertions. C10 is now `Partial` because oversize and SQL-like payload paths have evidence; H3/X2 remain `Missing` until cancel-lock gates pass in CI.
- Broad-scan evidence upgrades C10, C15, H4, K6, K7, A6, E4, E5, and E6 from `Missing` to `Partial`; none are `Covered` because each still lacks its full release oracle.
- Tier 1 now identifies `11` non-deferrable P0 execution items that must be repeatably verified before release.
- Mock-only evidence has been downgraded from `Covered` to `Partial`; only real API / API+DB / realtime assertions can count as `Covered`.
