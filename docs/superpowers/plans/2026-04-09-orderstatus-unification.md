# OrderStatus Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisites before execution:** Plan must be reviewed via `superpowers:plan-eng-review` and `superpowers:plan-ceo-review` (per Issue #9 AC). Phase 0.5 is a hard gate requiring explicit user decision before Phase 1+ can proceed.

> Current note (2026-04-29): this plan is retained for history. The major
> numeric-enum to string-union migration has been implemented; new work should
> focus on small consistency cleanups rather than re-running these phases.

**Goal:** Unify the three divergent `OrderStatus` type definitions across `shared-types`, `database`, and `realtime` into a single canonical string-union type, eliminate the bidirectional numeric↔string mapping layer in `OrdersService`, and roll the change out across 11 Cloudflare deployment targets without breaking open browser tabs, hibernated Durable Object sessions, or cached kitchen-display data.

**Architecture:** The DB schema (`ORDER_STATUS` in `packages/database/src/schema/orders.ts`) is already the canonical source of truth — 8 string values (`pending/confirmed/preparing/ready/delivered/paid/cancelled/refunded`). The numeric enum in `packages/shared-types/src/order.ts` and the divergent string enum in `apps/realtime/src/advanced-realtime-session.ts` are both wrong and must be migrated to match the DB. The migration is staged: API (dual-emit) → realtime (with DO state versioning) → frontends (with bundle version check + forced reload). Each stage is independently rollback-able.

**Tech Stack:** TypeScript (strict), Vue 3 (customer-app, kitchen-display, admin-dashboard, management-portal, onboarding-app), Cloudflare Workers (api, realtime), Durable Objects (realtime session persistence), Drizzle ORM + D1 (database), pnpm + Turborepo, Vitest (unit), Playwright (E2E), Wrangler (deploy).

---

## Canonical Decisions (confirmed in Phase 0.5 — see investigation doc)

The following assumptions are baked into Phase 1+ tasks. They are proposed defaults; Phase 0.5 presents them to the user for explicit approval before Phase 1 executes. If the user rejects a default, Phase 1+ tasks must be re-planned against the new decision.

1. **Canonical states (8):** `pending`, `confirmed`, `preparing`, `ready`, `delivered`, `paid`, `cancelled`, `refunded` — matches DB schema exactly.
2. **Drop `serving` from realtime `OrderLifecycleState`:** it is a UI display state, not a persistent order status. The UI can derive "currently serving" from `status === 'ready'` + a crew assignment.
3. **Replace `completed` with `delivered` in realtime:** DB is authoritative; `completed` was a realtime-local naming drift.
4. **Add `refunded` to shared-types:** currently missing.
5. **`paid` remains a distinct status:** not a payment flag. Matches DB + existing business logic.
6. **Wire format is string throughout:** numeric wire format is fully deprecated. No dual-format emit except in the time-boxed transition window (Phase 6.3).

---

## Phase 0: Complete the Surface Audit — Produces AC1 Investigation Doc

**Phase goal:** Extend the partial findings in Issue #9 into a complete file-level inventory and produce the investigation doc at `docs/investigations/2026-04-09-orderstatus-surface-audit.md`. This is the AC1 deliverable.

**Why this is a phase, not a prerequisite:** The provisional scope estimate in Issue #9 is 80–120 files. Every Phase 3+ task depends on knowing the actual sweep list. Investigation is part of execution, not before it.

---

### Task 1: Create the investigation doc skeleton

**Files:**
- Create: `docs/investigations/2026-04-09-orderstatus-surface-audit.md`

- [ ] **Step 1: Create the file with section skeleton**

```markdown
# OrderStatus Surface Audit

**Date:** 2026-04-09
**Related issue:** #9
**Status:** In progress

## Summary

(Filled in at end of Phase 0)

## 1. Type Definitions Inventory

### 1.1 packages/shared-types/src/order.ts
### 1.2 packages/database/src/schema/orders.ts
### 1.3 apps/realtime/src/advanced-realtime-session.ts

## 2. File-Level Reference Inventory

### 2.1 apps/api
### 2.2 apps/realtime
### 2.3 apps/customer-app
### 2.4 apps/kitchen-display
### 2.5 apps/admin-dashboard
### 2.6 apps/management-portal
### 2.7 apps/onboarding-app
### 2.8 packages/testing-utils
### 2.9 packages/shared-types
### 2.10 packages/database
### 2.11 tests/e2e

## 3. Hardcoded Numeric Literal Sites

## 4. Runtime `typeof status === "number"` Guards

## 5. Dead Code

## 6. Bidirectional Mapping Surface

### 6.1 OrdersService.normalizeStatus
### 6.2 OrdersService.getAllowedStatusTransitions — caller audit

## 7. External Wire Consumers

## 8. Durable Object Hibernated State

## 9. Client-Side Caches

### 9.1 kitchen-display localStorage
### 9.2 Browser bundle caching

## 10. Canonical State Decision (for Phase 0.5)

## 11. Migration Risk Register
```

- [ ] **Step 2: Commit the skeleton**

```bash
git add docs/investigations/2026-04-09-orderstatus-surface-audit.md
git commit -m "docs(investigation): seed OrderStatus surface audit skeleton"
```

---

### Task 2: Populate Section 1 (Type Definitions)

**Files:**
- Modify: `docs/investigations/2026-04-09-orderstatus-surface-audit.md` (Section 1)
- Read: `packages/shared-types/src/order.ts:95-103`
- Read: `packages/database/src/schema/orders.ts:14-26`
- Read: `apps/realtime/src/advanced-realtime-session.ts:113-125` (current line may differ — search for `OrderLifecycleState`)

- [ ] **Step 1: Read all three definitions and copy their exact source into Section 1.X**

For each of the three locations, the entry in the doc must contain:
- Exact file path + line range
- Verbatim source
- Shape (numeric enum / string enum / string const + type)
- Value count
- Divergence notes (what's different from DB source of truth)

- [ ] **Step 2: Commit**

```bash
git add docs/investigations/2026-04-09-orderstatus-surface-audit.md
git commit -m "docs(investigation): document the three OrderStatus type definitions"
```

---

### Task 3: Inventory `apps/admin-dashboard` references

Issue #9 notes 167 references in this app, not yet itemized. This is the largest unknown.

**Files:**
- Modify: `docs/investigations/2026-04-09-orderstatus-surface-audit.md` (Section 2.5)

- [ ] **Step 1: Run the file inventory**

```bash
rg -l 'OrderStatus|order_status|orderStatus' apps/admin-dashboard > /tmp/admin-dashboard-files.txt
wc -l /tmp/admin-dashboard-files.txt
```

Expected: a list of files. Write the count to Section 2.5.

- [ ] **Step 2: Classify each file**

For each file, determine whether it imports the shared-types enum, uses hardcoded numeric literals, uses string literals, or calls into a service method that returns status. Document in Section 2.5 as a table:

```markdown
| File | Import source | Usage pattern | Notes |
|------|---------------|---------------|-------|
| apps/admin-dashboard/src/... | shared-types OrderStatus | enum access | ... |
```

- [ ] **Step 3: Flag risky sites**

Any file that uses `=== 0`, `=== 1`, etc. with `.status` anywhere nearby goes in Section 3.

- [ ] **Step 4: Commit**

```bash
git add docs/investigations/2026-04-09-orderstatus-surface-audit.md
git commit -m "docs(investigation): inventory admin-dashboard OrderStatus surface"
```

---

### Task 4: Inventory remaining apps

**Files:**
- Modify: `docs/investigations/2026-04-09-orderstatus-surface-audit.md` (Sections 2.1-2.11, excluding 2.5 which Task 3 covered)

- [ ] **Step 1: Run the inventory for each unsurveyed app**

```bash
for app in apps/api apps/realtime apps/customer-app apps/kitchen-display apps/management-portal apps/onboarding-app packages/testing-utils packages/shared-types packages/database tests/e2e; do
  echo "=== $app ==="
  rg -l 'OrderStatus|order_status|orderStatus' "$app" 2>/dev/null | wc -l
done
```

- [ ] **Step 2: For each app, classify file usage and write into the corresponding section**

Use the same table format as Task 3.

- [ ] **Step 3: Produce a total count**

At the end of Section 2, add:

```markdown
**Total files referencing OrderStatus across the monorepo:** N
**Of which contain hardcoded numeric literal comparisons:** M
**Of which use runtime `typeof === "number"` guards:** K
```

- [ ] **Step 4: Commit**

```bash
git add docs/investigations/2026-04-09-orderstatus-surface-audit.md
git commit -m "docs(investigation): complete per-app OrderStatus inventory"
```

---

### Task 5: Populate Section 3 (Hardcoded Numeric Literals) and Section 4 (Runtime Guards)

Issue #9 identified 9+ sites for Section 3 and 4 sites for Section 4. Expand to full coverage.

**Files:**
- Modify: `docs/investigations/2026-04-09-orderstatus-surface-audit.md` (Sections 3, 4)

- [ ] **Step 1: Find all hardcoded numeric comparisons**

```bash
rg -n '\.status\s*===?\s*[0-9]' apps/ packages/ tests/
rg -n 'status\s*===?\s*OrderStatus\.' apps/ packages/ tests/
```

- [ ] **Step 2: For each match, document in Section 3**

```markdown
| File:line | Code | Canonical replacement |
|-----------|------|----------------------|
| apps/customer-app/src/components/OrderItemCard.vue:71 | `v-if="item.status === 1"` | `v-if="item.status === 'confirmed'"` |
```

- [ ] **Step 3: Find all runtime typeof guards**

```bash
rg -n 'typeof.*\.?status.*===\s*["'\'']number["'\'']' apps/ packages/
rg -n 'typeof.*\.?status.*===\s*["'\'']string["'\'']' apps/ packages/
```

- [ ] **Step 4: Document each guard in Section 4 with context**

Each entry must explain why the guard exists (read 5 lines before/after) and whether it is safe to delete after unification.

- [ ] **Step 5: Commit**

```bash
git add docs/investigations/2026-04-09-orderstatus-surface-audit.md
git commit -m "docs(investigation): catalog numeric literal sites and runtime guards"
```

---

### Task 6: Populate Section 6 (Bidirectional Mapping — caller audit)

Issue #9 called out `OrdersService.getAllowedStatusTransitions` as currently emitting numeric `OrderStatus` values. All callers must be identified.

**Files:**
- Modify: `docs/investigations/2026-04-09-orderstatus-surface-audit.md` (Sections 6.1, 6.2)
- Read: `apps/api/src/features/orders/services/OrdersService.ts` (around lines 1227-1285)

- [ ] **Step 1: Document normalizeStatus source**

Paste the exact source of `normalizeStatus` (lines 1227-1243) into Section 6.1 and annotate:
- What inputs it accepts
- Whether the numeric→string map is complete (it is missing `refunded`)
- Every call site of `normalizeStatus` (`rg 'normalizeStatus' apps/api`)

- [ ] **Step 2: Find all callers of getAllowedStatusTransitions**

```bash
rg -n 'getAllowedStatusTransitions' apps/ packages/ tests/
```

For each caller:
- File:line
- What the caller does with the returned `OrderStatus[]`
- Whether the caller exposes it over the wire (API response, frontend render, log, etc.)
- Whether the caller would break if the return type changed from numeric enum to string union

- [ ] **Step 3: Document in Section 6.2**

```markdown
### 6.2 getAllowedStatusTransitions — caller audit

**Definition:** `apps/api/src/features/orders/services/OrdersService.ts:1271-1285`

**Callers:**
| File:line | What it does | Wire exposure | Migration impact |
|-----------|--------------|---------------|------------------|
| ... | ... | ... | ... |
```

- [ ] **Step 4: Commit**

```bash
git add docs/investigations/2026-04-09-orderstatus-surface-audit.md
git commit -m "docs(investigation): audit OrdersService bidirectional mapping surface"
```

---

### Task 7: Populate Section 7 (External Wire Consumers)

PR #7 checked this superficially. Double-check that no mobile/partner SDK depends on the numeric wire format.

**Files:**
- Modify: `docs/investigations/2026-04-09-orderstatus-surface-audit.md` (Section 7)

- [ ] **Step 1: Check for mobile/partner SDK directories**

```bash
ls apps/
ls packages/
rg -l 'sdk|mobile|partner' --files | head -30
```

- [ ] **Step 2: Check for API documentation that specifies wire format**

```bash
rg -l 'OrderStatus|status.*pending|status.*0' docs/ --type md
```

Read any OpenAPI/Swagger specs, Postman collections, contract test fixtures, and public API reference docs. Document what wire format they specify.

- [ ] **Step 3: Check contract tests**

```bash
ls scripts/ | grep -i contract
cat scripts/contract-check* 2>/dev/null
```

If contract tests exist, document whether they pin numeric or string format.

- [ ] **Step 4: Write Section 7**

```markdown
## 7. External Wire Consumers

**SDK directories checked:** ...
**API docs checked:** ...
**Contract tests checked:** ...

**Finding:** [No external consumer depends on numeric wire format] OR [CONSUMER X depends on numeric format — migration must handle]
```

- [ ] **Step 5: Commit**

```bash
git add docs/investigations/2026-04-09-orderstatus-surface-audit.md
git commit -m "docs(investigation): external wire consumer audit"
```

---

### Task 8: Populate Section 8 (Durable Object Hibernated State)

**Files:**
- Modify: `docs/investigations/2026-04-09-orderstatus-surface-audit.md` (Section 8)
- Read: `apps/realtime/src/advanced-realtime-session.ts` (search for `ctx.storage.put` and `ctx.storage.get`, and the `OrderState` interface)

- [ ] **Step 1: Document the persisted shape**

Find every `ctx.storage.put` call that writes order or group-order state. For each:
- File:line
- Key pattern (e.g. `order:${orderId}`)
- What TypeScript type is being serialized
- Whether the type currently contains `OrderLifecycleState` values

- [ ] **Step 2: Document hibernation lifecycle**

From `advanced-realtime-session.ts`, document:
- When state is loaded (`loadPersistedState` or similar)
- How long a hibernated session can live before being woken up
- What happens when a session wakes up with a schema version it doesn't recognize

- [ ] **Step 3: Propose a migration strategy in Section 8**

Write a concrete proposal with three options ranked:

```markdown
### Option A: Lazy migration on wakeup
(pros / cons / risk)

### Option B: Explicit sweep via cron worker
(pros / cons / risk)

### Option C: Versioned schema with dual-read
(pros / cons / risk)

**Recommendation:** [one of A/B/C] because [reasoning]
```

The chosen option becomes a hard decision at Phase 0.5.

- [ ] **Step 4: Commit**

```bash
git add docs/investigations/2026-04-09-orderstatus-surface-audit.md
git commit -m "docs(investigation): DO hibernated state schema + migration options"
```

---

### Task 9: Populate Section 9 (Client-Side Caches) and Section 11 (Risk Register)

**Files:**
- Modify: `docs/investigations/2026-04-09-orderstatus-surface-audit.md` (Sections 9.1, 9.2, 11)
- Read: `apps/kitchen-display/src/services/offlineService.ts` around line 485

- [ ] **Step 1: Document kitchen-display localStorage validator**

Read the offlineService code around line 485 and document:
- Exact validator code
- What triggers a cache invalidation
- How many entries a typical kitchen-display user has cached
- Worst-case invalidation storm size (unit/day/peak)

- [ ] **Step 2: Investigate browser bundle caching**

Check:
- `apps/customer-app/vite.config.ts` — is there a cache-busting hash on bundle filenames?
- `apps/customer-app/public/manifest.json` or similar — is there a PWA service worker that aggressively caches?
- Does the customer-app use localStorage/IndexedDB to persist order data? If yes, is there a version field?

Document findings in Section 9.2.

- [ ] **Step 3: Write Section 11 (Risk Register)**

Consolidate all risks identified in sections 1-9:

```markdown
## 11. Migration Risk Register

| Risk | Likelihood | Impact | Mitigation (Phase) | Rollback trigger |
|------|------------|--------|---------------------|------------------|
| DO hibernated state has old enum shape | high | broadcast emits wrong values | Phase 4 (lazy migration) | Realtime error rate > 1% |
| Open customer-app tab on old bundle | certain (restaurant context) | UI shows "unknown status" | Phase 6.3 (forced reload signal) | Support ticket > 5/hr |
| kitchen-display cache invalidation storm | certain | one-time cache rebuild per kitchen-display user | Phase 6.2 (staggered deploy) | N/A — expected |
| API emits mixed wire format during staged deploy | medium | downstream validator rejects | Phase 6.1 (dual-emit window) | API 5xx > 0.5% |
| Contract tests pinning numeric format fail in CI | medium | blocks deploy | Phase 2 (update contracts first) | N/A — blocks before deploy |
| ... | | | | |
```

- [ ] **Step 4: Commit**

```bash
git add docs/investigations/2026-04-09-orderstatus-surface-audit.md
git commit -m "docs(investigation): client caches + consolidated risk register"
```

---

### Task 10: Write the Summary section and mark the investigation doc complete

**Files:**
- Modify: `docs/investigations/2026-04-09-orderstatus-surface-audit.md` (Summary, Section 10)

- [ ] **Step 1: Write the Summary**

```markdown
## Summary

**Total surface area:** N files across 11 apps/packages.
**Hardcoded numeric sites:** M (listed in §3).
**Runtime guards to remove:** K (listed in §4).
**Dead code to delete:** [list].
**DO migration strategy:** [A/B/C from §8] — requires Phase 0.5 approval.
**External consumer risk:** [none / specific finding].
**Estimated execution effort:** [phases 1-8 of the implementation plan].
```

- [ ] **Step 2: Write Section 10 (Canonical State Decision proposal)**

```markdown
## 10. Canonical State Decision (for Phase 0.5)

**Proposed canonical set (8 states):** `pending`, `confirmed`, `preparing`, `ready`, `delivered`, `paid`, `cancelled`, `refunded`

**Rationale:** matches DB schema (`packages/database/src/schema/orders.ts:14`).

**Realtime divergence resolution:**
- Drop `serving` — UI-derivable from `ready` + crew assignment
- Replace `completed` with `delivered` — DB authoritative

**shared-types changes:**
- Add `REFUNDED = 'refunded'` (currently missing — see §1.1)

**Decisions requiring user approval in Phase 0.5:**
1. Confirm the 8-state canonical set
2. Confirm dropping `serving` is acceptable from a product/UI standpoint
3. Confirm the DO migration strategy recommended in §8
```

- [ ] **Step 3: Update frontmatter Status to "Complete — awaiting Phase 0.5 decision"**

- [ ] **Step 4: Commit**

```bash
git add docs/investigations/2026-04-09-orderstatus-surface-audit.md
git commit -m "docs(investigation): summary + canonical state proposal — Phase 0 complete"
```

**Phase 0 gate:** Before proceeding to Phase 0.5, verify:
- [ ] Section 10 lists exactly the decisions requiring user input
- [ ] Section 8 recommends ONE DO migration option
- [ ] Section 11 risk register has at least one rollback trigger per high-impact risk

---

## Phase 0.5: Domain Decision Checkpoint (HARD GATE — requires user input)

**Phase goal:** Obtain explicit user approval on canonical states, `serving` removal, and DO migration strategy before ANY code changes. Issue #9 explicitly lists these as non-goals for the investigation ticket — they are planning-session outputs.

---

### Task 11: Present findings and request decision

**Files:** none (conversational task)

- [ ] **Step 1: Read the investigation doc back verbatim to the user**

Use `Read` tool to load `docs/investigations/2026-04-09-orderstatus-surface-audit.md` Section 10 and present it.

- [ ] **Step 2: Ask the three questions explicitly**

Use `AskUserQuestion` (or equivalent) with:

1. **Q1 — Canonical state set:** "Do you approve the 8-state canonical set `pending/confirmed/preparing/ready/delivered/paid/cancelled/refunded`? If no, specify the desired set."
2. **Q2 — `serving` removal:** "The current realtime `OrderLifecycleState` includes `serving`, which is not in the DB schema. Proposal: drop it and derive 'currently serving' in the UI from `status === 'ready'` + crew assignment. Do you approve?"
3. **Q3 — DO migration strategy:** "The recommended migration for hibernated Durable Object state is [A/B/C from §8]. Do you approve, or prefer a different option?"

- [ ] **Step 3: Record decisions in the investigation doc**

Append a new section:

```markdown
## 12. Phase 0.5 Decisions (User Approved)

**Date:** YYYY-MM-DD
**Approver:** [user name]

1. **Canonical state set:** [approved as proposed | modified to: ...]
2. **`serving` removal:** [approved | rejected — alternative: ...]
3. **DO migration strategy:** [approved option X | modified: ...]
```

- [ ] **Step 4: If ANY decision differs from the proposal, HALT this plan**

If the user changes the canonical state set, Phase 1+ tasks contain code that assumes the proposed set. Those tasks must be re-planned. Do not attempt to patch them inline — return to `superpowers:writing-plans` for a revised plan.

If all decisions match the proposal, proceed.

- [ ] **Step 5: Commit**

```bash
git add docs/investigations/2026-04-09-orderstatus-surface-audit.md
git commit -m "docs(investigation): Phase 0.5 decisions recorded"
```

---

## Phase 1: Regression Test Harness (TDD — failing tests committed first)

**Phase goal:** Before any production code changes, write a parametrized regression test covering all 8 canonical states across the API filter path (the path that broke in PR #7). This test exists to fail loudly if ANY status value silently returns zero rows again.

---

### Task 12: Write the parametrized status filter regression test

**Files:**
- Create: `apps/api/src/features/orders/__tests__/status-filter-regression.test.ts`
- Test: `apps/api/src/features/orders/__tests__/status-filter-regression.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/features/orders/__tests__/status-filter-regression.test.ts
//
// Regression guard for the PR #7 bug: OrderQueryFilters.status was typed as
// numeric enum while the DB stores strings, so ?status=pending silently
// returned zero rows. This test enumerates all 8 canonical states and
// asserts that each one returns the seeded row.
//
// This test MUST stay parametrized over the full CANONICAL_ORDER_STATUSES
// array. If a new state is added to the schema, the array below must grow.

import { describe, it, expect, beforeEach } from "vitest";
import {
  envFactory,
  orderFactory,
  resetAllFactories,
} from "@makanmasak/testing-utils";
import { OrdersService } from "../services/OrdersService";

const CANONICAL_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "paid",
  "cancelled",
  "refunded",
] as const;

describe("OrdersService.listOrders — status filter regression (Issue #9)", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  it.each(CANONICAL_ORDER_STATUSES)(
    "returns the row when filtering by status=%s",
    async (status) => {
      const env = envFactory.build();
      const service = new OrdersService(env);
      const seeded = orderFactory.build({
        overrides: { status, restaurantId: "r1" },
      });
      // Insert seeded order via the service's own create path to exercise
      // the same serialization the API uses.
      await service.createOrder(seeded);

      const result = await service.listOrders({
        restaurantId: "r1",
        status,
      });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(status);
    },
  );

  it("returns the row when filtering by a multi-status array", async () => {
    const env = envFactory.build();
    const service = new OrdersService(env);
    await service.createOrder(
      orderFactory.build({
        overrides: { status: "pending", restaurantId: "r1" },
      }),
    );
    await service.createOrder(
      orderFactory.build({
        overrides: { status: "confirmed", restaurantId: "r1" },
      }),
    );

    const result = await service.listOrders({
      restaurantId: "r1",
      status: ["pending", "confirmed"],
    });

    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/api && pnpm vitest run src/features/orders/__tests__/status-filter-regression.test.ts
```

Expected: FAIL — either with a TypeScript error on `status: "refunded"` (shared-types enum doesn't have REFUNDED yet) OR a runtime failure from `OrdersService.listOrders` not accepting a string status. Either failure mode proves the test is discriminating.

- [ ] **Step 3: If the test unexpectedly passes, the regression is not reproduced — STOP and investigate**

A passing test at this stage means either (a) the PR #7 partial fix already covered all 8 states, or (b) the test is not actually exercising the filter path. Both cases require re-scoping the plan.

- [ ] **Step 4: Commit the failing test**

```bash
git add apps/api/src/features/orders/__tests__/status-filter-regression.test.ts
git commit -m "test(orders): add parametrized status filter regression (Issue #9, failing)"
```

The failing test acts as a signal flare: every subsequent task in Phase 2-3 brings us closer to green, and no task can land until this test passes or a specific exemption is documented.

---

## Phase 2: Canonical Type + OrdersService Cleanup

**Phase goal:** Replace the numeric enum in shared-types with a string union that matches the DB. Remove all code in OrdersService that exists to bridge the numeric↔string gap.

---

### Task 13: Rewrite `shared-types` OrderStatus as string union

**Files:**
- Modify: `packages/shared-types/src/order.ts:95-103`

- [ ] **Step 1: Replace the enum definition**

```typescript
// packages/shared-types/src/order.ts
//
// Canonical OrderStatus — matches the DB schema in
// packages/database/src/schema/orders.ts exactly. Do not re-introduce
// a numeric variant. See docs/investigations/2026-04-09-orderstatus-surface-audit.md
// for the full history of why this was a string union.

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "paid",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
```

Delete the old `enum OrderStatus { PENDING = 0, ... }` block entirely. Do NOT add a backward-compat shim.

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | tee /tmp/typecheck-task13.log
```

Expected: 30-100+ errors cascading through every consumer that does `OrderStatus.PENDING` or `=== OrderStatus.X`. This is intentional — each error marks a site that needs updating.

- [ ] **Step 3: Save the error list**

```bash
grep -E "error TS" /tmp/typecheck-task13.log | sort -u > /tmp/task13-errors.txt
wc -l /tmp/task13-errors.txt
```

The error list is the worklist for Tasks 14-20. Do not continue until every error is addressed.

- [ ] **Step 4: Commit the breaking change**

```bash
git add packages/shared-types/src/order.ts
git commit -m "refactor(shared-types)!: rewrite OrderStatus as string union matching DB

BREAKING CHANGE: OrderStatus is no longer a numeric enum.
OrderStatus.PENDING (=== 0) is now just 'pending' (a string literal).
Callers must use the string values directly. See Issue #9 for the
migration plan and docs/investigations/2026-04-09-orderstatus-surface-audit.md
for the full surface audit."
```

**Gate:** `pnpm typecheck` is expected to fail after this commit. Tasks 14-20 restore it.

---

### Task 14: Remove `OrdersService.normalizeStatus`

**Files:**
- Modify: `apps/api/src/features/orders/services/OrdersService.ts:1227-1243`

- [ ] **Step 1: Remove the method**

Delete the entire `normalizeStatus` method (lines 1227-1243 in current HEAD; use `rg normalizeStatus` to locate in case line numbers drifted).

- [ ] **Step 2: Find all callers and inline**

```bash
rg -n 'normalizeStatus\(' apps/api/src/
```

For each caller, replace `this.normalizeStatus(x)` with `x` directly. The string union type means no normalization is needed.

Exception: if a caller takes input from a field that might still be a number at runtime (e.g. an older-schema cache), document this case in the investigation doc Section 5 and add a `z.enum(ORDER_STATUSES).parse(x)` guard instead.

- [ ] **Step 3: Run the feature test suite**

```bash
cd apps/api && pnpm vitest run src/features/orders
```

Expected: the Phase 1 regression test still fails (we haven't fixed the filter path yet), but no new failures should appear.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/features/orders/services/OrdersService.ts
git commit -m "refactor(api/orders): remove normalizeStatus — string union is canonical"
```

---

### Task 15: Fix `OrdersService.getAllowedStatusTransitions`

**Files:**
- Modify: `apps/api/src/features/orders/services/OrdersService.ts:1271-1285`
- Modify: every caller identified in Phase 0 Task 6 Section 6.2

- [ ] **Step 1: Rewrite the method to return string union**

```typescript
// Inside OrdersService
private getAllowedStatusTransitions(userRole: UserRole): OrderStatus[] {
  return (ROLE_STATUS_PERMISSIONS[userRole] ?? []) as OrderStatus[];
}
```

Delete the `statusStringToEnum` local Record and the `.map(...).filter(...)` chain.

- [ ] **Step 2: Update each caller from Section 6.2**

The caller list is in the investigation doc. For each:
- If the caller was treating the returned values as numbers, fix to strings
- If the caller was emitting over the wire, the wire format now changes — verify the API contract test was updated in Task 12

- [ ] **Step 3: Run the API test suite**

```bash
cd apps/api && pnpm vitest run
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/features/orders/services/OrdersService.ts
# plus each modified caller file
git commit -m "refactor(api/orders): return string union from getAllowedStatusTransitions"
```

---

### Task 16: Remove `validateStatusTransition` dual-form handling

**Files:**
- Modify: `apps/api/src/features/orders/services/OrdersService.ts:1245-1269`

- [ ] **Step 1: Rewrite to accept string union only**

```typescript
private validateStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus,
  userRole?: UserRole,
): void {
  if (!ORDER_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus)) {
    throw conflict(
      `Invalid status transition from ${currentStatus} to ${newStatus}`,
      "INVALID_STATUS_TRANSITION",
    );
  }

  if (
    userRole !== undefined &&
    !ROLE_STATUS_PERMISSIONS[userRole]?.includes(newStatus)
  ) {
    throw forbidden(
      `Insufficient permissions for status transition to ${newStatus}`,
      "FORBIDDEN",
    );
  }
}
```

Delete the `| number | string` union from parameters and the `normalizeStatus` calls.

- [ ] **Step 2: Run the tests**

```bash
cd apps/api && pnpm vitest run src/features/orders
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/orders/services/OrdersService.ts
git commit -m "refactor(api/orders): validateStatusTransition accepts string union only"
```

---

### Task 17: Fix `KitchenService` dual-form handling

**Files:**
- Modify: `apps/api/src/features/kitchen/services/KitchenService.ts` (lines around 157, 178)

- [ ] **Step 1: Read the current code**

```bash
rg -n -C3 'typeof.*status' apps/api/src/features/kitchen/services/KitchenService.ts
```

- [ ] **Step 2: Remove the typeof guards and trust the string type**

Each guard in KitchenService was a defensive measure against the dual numeric/string wire format. With the canonical type change, the guards become dead code.

- [ ] **Step 3: Run the kitchen tests**

```bash
cd apps/api && pnpm vitest run src/features/kitchen
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/features/kitchen/services/KitchenService.ts
git commit -m "refactor(api/kitchen): remove runtime type guards — string union is canonical"
```

---

### Task 18: Delete dead code in customer-app orderApi

**Files:**
- Modify: `apps/customer-app/src/services/orderApi.ts:180-223`
- Delete or update: the test file that was the only caller of `getTableOrderHistory`

- [ ] **Step 1: Confirm the method is unused in production**

```bash
rg -n 'getTableOrderHistory' apps/customer-app/src --glob '!**/*.test.ts' --glob '!**/*.spec.ts'
```

If only the test file references it, proceed to delete. If any production code uses it, STOP and document in the investigation doc.

- [ ] **Step 2: Delete the method**

Remove lines 180-223 in `apps/customer-app/src/services/orderApi.ts`.

- [ ] **Step 3: Delete or update the test**

```bash
rg -l 'getTableOrderHistory' apps/customer-app/src --glob '**/*.test.ts'
```

For each test file, either delete the test block entirely (if the whole file is dedicated to it) or remove just the relevant describe/it.

- [ ] **Step 4: Run the customer-app test suite**

```bash
cd apps/customer-app && pnpm vitest run
```

- [ ] **Step 5: Commit**

```bash
git add apps/customer-app/src/services/orderApi.ts
git add apps/customer-app/src # for the test updates
git commit -m "refactor(customer-app): delete unused getTableOrderHistory (dead code)"
```

---

### Task 19: Run the Phase 1 regression test — it should now pass

**Files:** none

- [ ] **Step 1: Run the regression test**

```bash
cd apps/api && pnpm vitest run src/features/orders/__tests__/status-filter-regression.test.ts
```

Expected: all 8 parametrized cases PASS, plus the multi-status case.

- [ ] **Step 2: If any case fails, STOP and debug**

A failing case means one of Tasks 13-17 missed a mapping. Go back and find it. Do not advance to Phase 3 with red regression tests.

- [ ] **Step 3: Run the full API test suite**

```bash
cd apps/api && pnpm typecheck && pnpm vitest run
```

Both must be green. Commit if any fixups were needed in this task.

---

## Phase 3: Realtime Durable Object Migration

**Phase goal:** Unify `OrderLifecycleState` in the realtime Durable Object with the canonical 8 states. Add DO state schema versioning and implement the migration approach chosen in Phase 0.5.

**Dependency:** Phase 0.5 Task 11 Step 3 must have recorded the approved DO migration strategy. This phase assumes Option A (lazy migration on wakeup) was chosen — if a different option was chosen, re-plan Phase 3 tasks against it.

---

### Task 20: Add DO state schema version field

**Files:**
- Modify: `apps/realtime/src/advanced-realtime-session.ts` (SessionState interface + persistState + loadPersistedState)

- [ ] **Step 1: Add a version constant and field**

Near the top of `advanced-realtime-session.ts` (with the other type definitions):

```typescript
/**
 * Schema version for persisted Durable Object state. Increment whenever
 * the shape of SessionState (or any transitive type it contains) changes
 * in a non-backward-compatible way.
 *
 * Version history:
 *   1 - pre-unification: OrderLifecycleState as string enum with `serving`
 *       and `completed` values; no version field in persisted state.
 *   2 - OrderStatus unification (Issue #9): canonical 8-state set.
 */
const CURRENT_DO_STATE_VERSION = 2;

interface PersistedSessionHeader {
  version: number;
  writtenAt: number;
}
```

Add `version: number` to `SessionState`:

```typescript
interface SessionState {
  version: number;
  activeConnections: Map<string, ConnectionInfo>;
  // ... existing fields
}
```

In the constructor, set `version: CURRENT_DO_STATE_VERSION`.

- [ ] **Step 2: Update persistState to write the version header**

```typescript
private async persistConnectionState(): Promise<void> {
  await this.ctx.storage.put("session_version", {
    version: CURRENT_DO_STATE_VERSION,
    writtenAt: Date.now(),
  } satisfies PersistedSessionHeader);
  // ... existing persist logic
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/realtime && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/realtime/src/advanced-realtime-session.ts
git commit -m "feat(realtime): add DO state schema version field (pre-migration scaffold)"
```

---

### Task 21: Implement lazy migration on wakeup

**Files:**
- Modify: `apps/realtime/src/advanced-realtime-session.ts` (loadPersistedState)

- [ ] **Step 1: Add the migration logic**

In `loadPersistedState`, detect old-version state and migrate:

```typescript
private async loadPersistedState(): Promise<void> {
  try {
    const header = await this.ctx.storage.get<PersistedSessionHeader>(
      "session_version",
    );
    const persistedVersion = header?.version ?? 1;

    if (persistedVersion < CURRENT_DO_STATE_VERSION) {
      console.log(
        `DO state migration: ${persistedVersion} → ${CURRENT_DO_STATE_VERSION}`,
      );
      await this.migrateDOState(persistedVersion);
    }

    // ... existing load logic
  } catch (error) {
    console.error("Failed to load persisted state:", error);
    this.recordError(error, { operation: "load_state" });
  }
}

private async migrateDOState(fromVersion: number): Promise<void> {
  if (fromVersion < 2) {
    // v1 → v2: OrderLifecycleState value rename
    // - serving → delivered (drop serving entirely; prior serving rows become delivered)
    // - completed → delivered
    const legacyMap: Record<string, OrderStatus> = {
      serving: "delivered",
      completed: "delivered",
      pending: "pending",
      confirmed: "confirmed",
      preparing: "preparing",
      ready: "ready",
      cancelled: "cancelled",
    };

    const orderStates = await this.ctx.storage.list({ prefix: "order:" });
    for (const [key, raw] of orderStates) {
      const legacy = raw as { currentState: string };
      const newState = legacyMap[legacy.currentState];
      if (!newState) {
        console.warn(
          `DO migration: unknown legacy state ${legacy.currentState} for key ${key} — leaving as-is`,
        );
        continue;
      }
      await this.ctx.storage.put(key, {
        ...(raw as object),
        currentState: newState,
      });
    }

    await this.ctx.storage.put("session_version", {
      version: 2,
      writtenAt: Date.now(),
    } satisfies PersistedSessionHeader);
  }
}
```

- [ ] **Step 2: Write a migration test**

Create `apps/realtime/src/__tests__/do-state-migration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
// The test needs a mock DurableObjectStorage. If apps/realtime has no
// existing test harness, use @cloudflare/vitest-pool-workers miniflare
// integration per the existing test infrastructure (check
// packages/testing-utils for an existing pattern).

describe("AdvancedRealtimeSession DO state migration", () => {
  it("migrates v1 serving → v2 delivered", async () => {
    const storage = createMockStorage();
    await storage.put("order:o1", { currentState: "serving", id: "o1" });

    const session = new AdvancedRealtimeSession(
      { storage } as unknown as DurableObjectState,
      {} as Env,
    );
    await (
      session as unknown as { loadPersistedState(): Promise<void> }
    ).loadPersistedState();

    const migrated = await storage.get("order:o1");
    expect(migrated).toMatchObject({ currentState: "delivered" });
  });

  it("migrates v1 completed → v2 delivered", async () => {
    // similar
  });

  it("preserves states that already match canonical", async () => {
    // pending → pending, etc.
  });

  it("writes a v2 header after migration", async () => {
    // ...
  });

  it("does nothing when state is already v2", async () => {
    // ...
  });
});
```

Note: `apps/realtime/package.json` does not currently have a `test` script. Task 21 Step 2 requires adding one. See Step 3.

- [ ] **Step 3: Add a vitest config and test script to realtime**

```bash
cd apps/realtime
# Add to package.json scripts: "test": "vitest run"
# Create vitest.config.ts if it doesn't exist
```

If the realtime package has no existing test infrastructure, this task grows — add a `vitest.config.ts` that uses `@cloudflare/vitest-pool-workers` and configure it to load `wrangler.toml` bindings. Reference another Workers app's config (e.g. `apps/api/vitest.config.ts`).

- [ ] **Step 4: Run the migration test**

```bash
cd apps/realtime && pnpm test do-state-migration
```

All 5 cases must pass.

- [ ] **Step 5: Commit**

```bash
git add apps/realtime/
git commit -m "feat(realtime): lazy DO state migration v1→v2 on wakeup (Issue #9)"
```

---

### Task 22: Unify `OrderLifecycleState` with canonical set

**Files:**
- Modify: `apps/realtime/src/advanced-realtime-session.ts` (around line 120)

- [ ] **Step 1: Replace the enum**

```typescript
// Before: enum OrderLifecycleState with 7 divergent values
// After: import from shared-types
import type { OrderStatus } from "@makanmasak/shared-types";

// Delete the local OrderLifecycleState enum entirely.
// Replace every usage of OrderLifecycleState.X with the string literal "x".
```

- [ ] **Step 2: Fix the transition matrix**

The file contains `stateTransitions: Map<OrderLifecycleState, OrderLifecycleState[]>`. Rewrite:

```typescript
private stateTransitions: Map<OrderStatus, OrderStatus[]> = new Map([
  ["pending", ["confirmed", "cancelled"]],
  ["confirmed", ["preparing", "cancelled"]],
  ["preparing", ["ready", "cancelled"]],
  ["ready", ["delivered", "cancelled"]],
  ["delivered", ["paid", "refunded"]],
  ["paid", ["refunded"]],
  ["cancelled", []],
  ["refunded", []],
]);
```

Note: the exact transition matrix above must be reconciled with the one already in `apps/api/src/shared/constants/index.ts` (`ORDER_STATUS_TRANSITIONS`). They MUST be identical — if they diverge, API and realtime will reject different transitions.

- [ ] **Step 3: Extract the matrix to a shared location**

To prevent future divergence, move the transition matrix out of both files:

```typescript
// packages/shared-types/src/order-transitions.ts
import type { OrderStatus } from "./order";

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  delivered: ["paid", "refunded"],
  paid: ["refunded"],
  cancelled: [],
  refunded: [],
};
```

Import from both `apps/api/src/shared/constants/index.ts` and `apps/realtime/src/advanced-realtime-session.ts`.

- [ ] **Step 4: Typecheck + test**

```bash
pnpm typecheck
cd apps/realtime && pnpm test
cd ../api && pnpm vitest run src/features/orders
```

All three green.

- [ ] **Step 5: Commit**

```bash
git add apps/realtime/src/advanced-realtime-session.ts
git add packages/shared-types/src/order-transitions.ts
git add apps/api/src/shared/constants/
git commit -m "refactor(realtime): unify OrderLifecycleState with canonical OrderStatus

Extracts ORDER_STATUS_TRANSITIONS to shared-types so api and realtime
share one source of truth for the state machine."
```

---

## Phase 4: Frontend App Sweeps

**Phase goal:** Remove all hardcoded numeric literal comparisons, enum-access sites, and runtime guards from the 5 frontend apps. Each app is a separate task to allow for independent review and rollback.

**Worklist:** the file-by-file lists produced in Phase 0 Tasks 3-5 (investigation doc Sections 2.3-2.7, 3, 4). Before starting Phase 4, re-read those sections to load them into context.

---

### Task 23: customer-app sweep

**Files:**
- Modify: files listed in investigation doc §2.3 (expected: OrderItemCard.vue, OrderTrackingView.vue, OrderHistoryView.vue, plus any others found in Phase 0)

- [ ] **Step 1: Re-read the investigation doc Section 2.3 and Section 3 rows tagged `customer-app`**

- [ ] **Step 2: For each site, apply the replacement from the Section 3 table**

Example replacements (Issue #9 named these explicitly):

```vue
<!-- apps/customer-app/src/components/OrderItemCard.vue:71 -->
<!-- Before: v-if="item.status === 1" -->
<!-- After:  v-if="item.status === 'confirmed'" -->

<!-- apps/customer-app/src/views/OrderTrackingView.vue:424 -->
<!-- Before: status === 0 || status === 1 -->
<!-- After:  status === 'pending' || status === 'confirmed' -->

<!-- apps/customer-app/src/views/OrderTrackingView.vue:474 -->
<!-- Before: status === 6 -->
<!-- After:  status === 'cancelled' -->

<!-- apps/customer-app/src/views/OrderHistoryView.vue:215 -->
<!-- Before: order.status === 0 -->
<!-- After:  order.status === 'pending' -->
```

- [ ] **Step 3: Typecheck + unit test**

```bash
cd apps/customer-app && pnpm typecheck && pnpm test
```

- [ ] **Step 4: Visual regression check**

```bash
cd apps/customer-app && pnpm test:visual
```

If any baseline fails and the diff is cosmetic (e.g. the status badge now reads "confirmed" instead of a numeric icon code), update the baseline per the existing visual regression workflow.

- [ ] **Step 5: Commit**

```bash
git add apps/customer-app
git commit -m "refactor(customer-app): replace numeric OrderStatus literals with string values"
```

---

### Task 24: kitchen-display sweep — numeric literals

**Files:**
- Modify: files listed in investigation doc §2.4 and §3 (expected: stores/orders.ts, components/workflow/WorkflowAutomation.vue, components/orders/OrderFilters.vue, composables/useAudioNotifications.ts)

- [ ] **Step 1: Re-read the investigation doc**

- [ ] **Step 2: Apply the replacements**

Example (from Issue #9):

```typescript
// apps/kitchen-display/src/stores/orders.ts:31
// Before: return order.status === 1
// After:  return order.status === 'confirmed'

// apps/kitchen-display/src/stores/orders.ts:35
// Before: return order.status === 2
// After:  return order.status === 'preparing'

// apps/kitchen-display/src/stores/orders.ts:39
// Before: return order.status === 3
// After:  return order.status === 'ready'
```

- [ ] **Step 3: Typecheck + unit test**

```bash
cd apps/kitchen-display && pnpm typecheck && pnpm test
```

- [ ] **Step 4: Commit (partial — cache validator still to do in Task 25)**

```bash
git add apps/kitchen-display
git commit -m "refactor(kitchen-display): replace numeric OrderStatus literals with string values"
```

---

### Task 25: kitchen-display offlineService cache validator

**Files:**
- Modify: `apps/kitchen-display/src/services/offlineService.ts` (around line 485)

This is delicate: changing the validator causes a cache invalidation storm for every kitchen-display user on first load after deploy. The storm is unavoidable — the goal is to make it safe.

- [ ] **Step 1: Read the validator and its callers**

```bash
rg -n -C5 'typeof.*status.*===.*number' apps/kitchen-display/src/services/offlineService.ts
rg -n 'offlineService' apps/kitchen-display/src
```

Understand what the validator is protecting against and what happens when it returns false.

- [ ] **Step 2: Rewrite the validator**

```typescript
// Before:
// isValid(order: unknown): boolean {
//   const status = (order as { status?: unknown }).status;
//   return typeof status === "number";
// }

// After: validate against the canonical string union
import { ORDER_STATUSES } from "@makanmasak/shared-types";

isValid(order: unknown): boolean {
  if (typeof order !== "object" || order === null) return false;
  const status = (order as { status?: unknown }).status;
  return typeof status === "string" && (ORDER_STATUSES as readonly string[]).includes(status);
}
```

- [ ] **Step 3: Add a cache version bump**

The old cache entries have `status: number`. The new validator rejects them. To avoid a silent rejection storm, explicitly bump the cache version key:

```typescript
// Near the top of offlineService.ts
const CACHE_SCHEMA_VERSION = 2; // bumped for OrderStatus unification (Issue #9)

// In the init / load path:
const storedVersion = localStorage.getItem("cache_schema_version");
if (storedVersion !== String(CACHE_SCHEMA_VERSION)) {
  // Wipe old cache; it's incompatible.
  localStorage.removeItem("cached_orders"); // exact key name TBD from code
  localStorage.setItem("cache_schema_version", String(CACHE_SCHEMA_VERSION));
}
```

- [ ] **Step 4: Write a test for the version bump**

```typescript
// apps/kitchen-display/src/services/__tests__/offlineService.test.ts
describe("offlineService cache version bump", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("wipes cache when stored version differs from current", () => {
    localStorage.setItem("cache_schema_version", "1");
    localStorage.setItem("cached_orders", JSON.stringify([{ status: 1 }]));

    // Simulate service init
    new OfflineService();

    expect(localStorage.getItem("cached_orders")).toBeNull();
    expect(localStorage.getItem("cache_schema_version")).toBe("2");
  });

  it("preserves cache when version matches", () => {
    localStorage.setItem("cache_schema_version", "2");
    const orders = [{ status: "pending" }];
    localStorage.setItem("cached_orders", JSON.stringify(orders));

    new OfflineService();

    expect(localStorage.getItem("cached_orders")).toBe(JSON.stringify(orders));
  });
});
```

- [ ] **Step 5: Run the test**

```bash
cd apps/kitchen-display && pnpm test offlineService
```

- [ ] **Step 6: Commit**

```bash
git add apps/kitchen-display/src/services/offlineService.ts
git add apps/kitchen-display/src/services/__tests__/offlineService.test.ts
git commit -m "refactor(kitchen-display): bump offline cache schema to v2 (Issue #9)

Old cache entries with numeric status are incompatible with the unified
string type. The explicit version bump wipes them on first load after
deploy, avoiding silent validator rejections."
```

---

### Task 26: admin-dashboard sweep

**Files:**
- Modify: files listed in investigation doc §2.5 (expected to be the largest sweep — 167 references per Issue #9 provisional count)

- [ ] **Step 1: Re-read investigation doc §2.5**

- [ ] **Step 2: Work through the file list in 3 batches**

Break the sweep into 3 commits for reviewability. Suggested batches:
1. Stores (Pinia state modules referencing status)
2. Views/Pages (top-level route components)
3. Leaf components (cards, badges, tables)

- [ ] **Step 3: For each file, apply replacements**

Same pattern as Tasks 23-24: numeric literal → string literal, enum access → string value.

- [ ] **Step 4: Typecheck + test after each batch**

```bash
cd apps/admin-dashboard && pnpm typecheck && pnpm test
```

- [ ] **Step 5: Commit each batch separately**

```bash
git commit -m "refactor(admin-dashboard): OrderStatus sweep batch 1/3 — stores"
# ... batch 2, batch 3
```

---

### Task 27: management-portal + onboarding-app sweep

**Files:**
- Modify: files listed in investigation doc §2.6, §2.7

- [ ] **Step 1: Re-read the investigation sections**

- [ ] **Step 2: Apply replacements in each app**

If the reference count is small (per Phase 0 Task 4 Step 3 count), combine both apps into one commit. If large, split.

- [ ] **Step 3: Typecheck + test both**

```bash
cd apps/management-portal && pnpm typecheck && pnpm test
cd ../onboarding-app && pnpm typecheck && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add apps/management-portal apps/onboarding-app
git commit -m "refactor(management-portal, onboarding-app): OrderStatus sweep"
```

---

### Task 28: packages/testing-utils order factory

**Files:**
- Modify: `packages/testing-utils/src/factories/order.ts` (or equivalent — confirm in Phase 0 Task 4)

- [ ] **Step 1: Verify the factory's current status field shape**

```bash
rg -n 'status' packages/testing-utils/src/factories/order.ts
```

- [ ] **Step 2: Update to emit canonical strings**

If the factory currently emits `status: 1` or `status: OrderStatus.PENDING`, change to `status: "pending"`. Update the helper methods (e.g. `orderFactory.buildPending()`) to match.

- [ ] **Step 3: Run factory tests**

```bash
cd packages/testing-utils && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add packages/testing-utils
git commit -m "refactor(testing-utils): order factory emits canonical string status"
```

---

### Task 29: Full monorepo typecheck + test sweep

**Files:** none

- [ ] **Step 1: Run the whole monorepo**

```bash
pnpm typecheck 2>&1 | tee /tmp/phase4-final-typecheck.log
```

Expected: 0 errors. If any errors remain, they identify files the Phase 0 survey missed. Add them to the investigation doc Section 2 and fix inline.

- [ ] **Step 2: Run the unit test suite**

```bash
pnpm test
```

Expected: 0 failures.

- [ ] **Step 3: Run the visual regression suite**

```bash
pnpm test:visual
```

Any baseline drift should be reviewed — if it's just status text (e.g. "1" → "confirmed"), accept and update. If it's layout drift, STOP and investigate.

- [ ] **Step 4: Run E2E tests**

```bash
pnpm test:e2e
```

Expected: all green, especially the order lifecycle journeys.

- [ ] **Step 5: If any of Steps 1-4 fail, do not advance to Phase 5**

Fix inline and repeat. Green monorepo is the Phase 4 exit gate.

---

## Phase 5: API Contract Tests + Dual-Emit Window

**Phase goal:** Update contract tests to lock in the new string wire format. Add a time-boxed dual-emit window so staged deploys don't break mid-flight clients.

---

### Task 30: Update API contract tests

**Files:**
- Modify: `scripts/contract-check.*` or equivalent (find via Phase 0 Task 7)
- Modify: any `docs/api/*.json` OpenAPI specs

- [ ] **Step 1: Find the contract test harness**

```bash
ls scripts/ | grep -i contract
cat package.json | grep -A2 '"contract'
```

- [ ] **Step 2: Update fixtures**

Any fixture that pins `"status": 1` or `"status": "1"` or `"status": OrderStatus.PENDING` must become `"status": "pending"` etc.

- [ ] **Step 3: Run the contract suite**

```bash
pnpm contract:check
```

- [ ] **Step 4: Commit**

```bash
git add scripts/ docs/api/
git commit -m "test(contract): update fixtures to canonical string OrderStatus"
```

---

### Task 31: Implement dual-emit transition window in API

**Why:** During the staged deploy (Phase 6), there will be a window where some frontend bundles are still on the old numeric format while the API is on the new string format. A crafted response middleware can emit BOTH formats in the same response for the duration of the window, then be removed.

**Files:**
- Create: `apps/api/src/shared/middleware/order-status-dual-emit.ts`
- Modify: `apps/api/src/features/orders/routes/index.ts`

- [ ] **Step 1: Write the middleware**

```typescript
// apps/api/src/shared/middleware/order-status-dual-emit.ts
//
// TEMPORARY — remove after migration window closes (see Phase 7 Task 37).
// During the OrderStatus unification rollout, emit both string and legacy
// numeric values on every order payload so that old-bundle clients can
// still read the numeric path while new-bundle clients read strings.
//
// Remove: after all deployment targets have been on the new bundle for
// at least 48 hours AND the status_legacy_field_reads metric is zero.

import type { MiddlewareHandler } from "hono";
import type { OrderStatus } from "@makanmasak/shared-types";

const STRING_TO_LEGACY_NUMBER: Record<OrderStatus, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  delivered: 4,
  paid: 5,
  cancelled: 6,
  refunded: 7, // was missing in old enum; new code assigns 7
};

export const orderStatusDualEmit: MiddlewareHandler = async (c, next) => {
  await next();

  const body = await c.res.clone().json().catch(() => null);
  if (!body || typeof body !== "object") return;

  decorateOrderNodes(body);

  c.res = new Response(JSON.stringify(body), {
    status: c.res.status,
    headers: c.res.headers,
  });
};

function decorateOrderNodes(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(decorateOrderNodes);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const obj = node as Record<string, unknown>;
  if (typeof obj.status === "string" && obj.status in STRING_TO_LEGACY_NUMBER) {
    obj.statusLegacyNumeric = STRING_TO_LEGACY_NUMBER[obj.status as OrderStatus];
  }
  for (const value of Object.values(obj)) {
    decorateOrderNodes(value);
  }
}
```

- [ ] **Step 2: Wire into the orders routes**

```typescript
// apps/api/src/features/orders/routes/index.ts
import { orderStatusDualEmit } from "../../../shared/middleware/order-status-dual-emit";

app.use("/orders/*", orderStatusDualEmit);
```

Add a FEATURE FLAG guard so the middleware can be disabled without a redeploy:

```typescript
if (c.env.ORDER_STATUS_DUAL_EMIT === "true") {
  app.use("/orders/*", orderStatusDualEmit);
}
```

- [ ] **Step 3: Add the env var to wrangler.toml for staging and production**

```toml
[vars]
ORDER_STATUS_DUAL_EMIT = "true"
```

- [ ] **Step 4: Write an integration test for dual-emit**

```typescript
// apps/api/src/features/orders/__tests__/dual-emit.test.ts
import { describe, it, expect } from "vitest";

describe("order-status-dual-emit middleware", () => {
  it("adds statusLegacyNumeric to order responses when flag is on", async () => {
    const res = await fetch("/api/v1/orders/123"); // mock
    const body = await res.json();
    expect(body.status).toBe("pending");
    expect(body.statusLegacyNumeric).toBe(0);
  });

  it("is a no-op when flag is off", async () => {
    // set env var to "false", re-init, assert no statusLegacyNumeric field
  });
});
```

- [ ] **Step 5: Run the test**

```bash
cd apps/api && pnpm vitest run src/features/orders/__tests__/dual-emit.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/shared/middleware/order-status-dual-emit.ts
git add apps/api/src/features/orders/routes/index.ts
git add apps/api/src/features/orders/__tests__/dual-emit.test.ts
git add apps/api/wrangler.toml
git commit -m "feat(api): add temporary dual-emit middleware for OrderStatus migration

Behind ORDER_STATUS_DUAL_EMIT feature flag. Adds statusLegacyNumeric
to order responses during the rollout window so old-bundle clients
can continue reading numeric status. Remove per Phase 7 Task 37."
```

---

## Phase 6: Staged Deployment

**Phase goal:** Roll out the change across staging first, then production, in a specific order (API → realtime → frontends) that minimizes the mixed-version window. Each stage has explicit rollback criteria.

---

### Task 32: Stage 1 — deploy API to staging

**Files:** none (deploy operation)

- [ ] **Step 1: Verify ORDER_STATUS_DUAL_EMIT is set in staging wrangler config**

```bash
cat apps/api/wrangler.toml | grep ORDER_STATUS_DUAL_EMIT
```

- [ ] **Step 2: Deploy**

```bash
cd apps/api && pnpm deploy:staging
```

- [ ] **Step 3: Smoke test all 8 status values against the staging API**

```bash
STAGING_API=https://staging.api.example.com # replace with actual URL
for status in pending confirmed preparing ready delivered paid cancelled refunded; do
  curl -s "$STAGING_API/v1/orders?status=$status&restaurantId=test" \
    -H "Authorization: Bearer $STAGING_TOKEN" | jq '.data | length'
done
```

Expected: non-negative row count for each (exact count depends on staging seed data).

- [ ] **Step 4: Verify dual-emit middleware is active**

```bash
curl -s "$STAGING_API/v1/orders/1" -H "Authorization: Bearer $STAGING_TOKEN" | jq '{status, statusLegacyNumeric}'
```

Expected: both fields present.

- [ ] **Step 5: Rollback criteria**

If ANY of the following in the first 10 minutes:
- 5xx rate > 0.5%
- p99 response time regresses > 20%
- Any smoke test returns 400/500

Run `cd apps/api && pnpm wrangler rollback` (or the equivalent for your wrangler version — verify in Phase 0 Task 9).

---

### Task 33: Stage 2 — deploy realtime to staging

**Files:** none

- [ ] **Step 1: Deploy**

```bash
cd apps/realtime && pnpm deploy:staging
```

- [ ] **Step 2: Trigger the DO migration by waking a hibernated session**

The migration path only runs on wakeup. Force it:

```bash
# Connect a WebSocket to a known session that was created before the deploy
wscat -c wss://production.realtime.example.com/session/test
```

Monitor the session's logs:

```bash
cd apps/realtime && pnpm wrangler tail --format pretty --env production
```

Look for the `DO state migration: 1 → 2` log line.

- [ ] **Step 3: Verify migrated state**

Using the DO storage inspector or an admin endpoint, verify that a pre-migration session's `currentState` values have been transformed from `serving`/`completed` to `delivered`.

- [ ] **Step 4: Rollback criteria**

If the migration errors (check `pnpm wrangler tail` for error logs):
- Any `migrateDOState` exception
- Any session failing to load persisted state
- Realtime WebSocket error rate > 1%

Rollback via `pnpm wrangler rollback` in `apps/realtime`.

---

### Task 34: Stage 3 — deploy frontends to staging

**Files:** none

- [ ] **Step 1: Deploy all frontend Pages projects**

```bash
for app in customer-app kitchen-display admin-dashboard management-portal onboarding-app; do
  (cd "apps/$app" && pnpm deploy:staging) || echo "FAILED: $app"
done
```

- [ ] **Step 2: Smoke test each app's status-rendering paths**

Use the browse/Playwright MCP to load each staging URL and verify:
- Order cards render with the correct status label
- Status filter dropdowns work
- No console errors about "unknown status" or undefined

- [ ] **Step 3: Verify kitchen-display cache version bump fired**

Open kitchen-display staging in a fresh browser tab. Check DevTools:

```js
localStorage.getItem("cache_schema_version") // expected: "2"
localStorage.getItem("cached_orders") // expected: null or v2 entries
```

- [ ] **Step 4: Run E2E against staging**

```bash
STAGING=true pnpm test:e2e
```

- [ ] **Step 5: Rollback criteria per app**

Any of:
- Visual regression on a status-rendering component
- Console error > 1% of page loads
- E2E failures

Rollback the specific app: `cd apps/<app> && pnpm wrangler pages deploy --rollback` (or whatever the current wrangler syntax is — verify per app).

---

### Task 35: Stage 4 — production deploy (API first)

**Files:** none

- [ ] **Step 1: Verify staging has been green for at least 24 hours**

Check the monitoring dashboard:
- API 5xx rate: baseline for 24h
- Realtime error rate: baseline for 24h
- Frontend console error rate: baseline for 24h

If any metric is above baseline in staging, STOP — do not deploy to production.

- [ ] **Step 2: Announce the deploy window**

Post to the team channel: start time, expected duration, rollback trigger.

- [ ] **Step 3: Deploy API to production**

```bash
cd apps/api && pnpm deploy:prod
```

- [ ] **Step 4: Smoke test production**

Same as staging Step 3 (Task 32) but against the prod URL. Use a read-only account.

- [ ] **Step 5: Monitor for 15 minutes before advancing**

Watch the metrics dashboard. If any 5xx spike, rollback.

---

### Task 36: Stage 5 — production deploy (realtime, then frontends)

**Files:** none

- [ ] **Step 1: Deploy realtime to production**

```bash
cd apps/realtime && pnpm deploy:prod
```

- [ ] **Step 2: Tail production logs for DO migration**

```bash
cd apps/realtime && pnpm wrangler tail --format pretty --env production
```

Watch for `DO state migration: 1 → 2` log lines. They should appear as hibernated sessions wake up. Zero errors expected.

- [ ] **Step 3: Monitor realtime for 15 minutes**

- [ ] **Step 4: Deploy frontends to production — one at a time**

```bash
cd apps/customer-app && pnpm deploy:prod
# monitor 10 min
cd ../kitchen-display && pnpm deploy:prod
# monitor 10 min — kitchen-display cache bump causes one-time storm
cd ../admin-dashboard && pnpm deploy:prod
# ... management-portal, onboarding-app
```

- [ ] **Step 5: Global rollback if anything breaks**

Any app failing: `wrangler pages deploy --rollback` for that app. Keep API + realtime on the new version (they are backward-compatible via dual-emit).

---

## Phase 7: Post-Deploy Verification + Dual-Emit Removal

**Phase goal:** Monitor the production rollout for 48 hours, confirm metrics are clean, then remove the dual-emit scaffolding.

---

### Task 37: 48-hour monitoring window

**Files:** none

- [ ] **Step 1: Set monitoring checkpoints at +1h, +6h, +24h, +48h**

At each checkpoint, verify:
- API 5xx rate remains at baseline
- Realtime error rate remains at baseline
- Frontend console error telemetry (if available) shows no "unknown status" errors
- Support tickets mentioning order status are zero

- [ ] **Step 2: Verify no clients are reading `statusLegacyNumeric`**

Add a temporary log line to the dual-emit middleware that counts reads of the legacy field. OR use the existing analytics/logging infra to detect the field access pattern.

If ANY client is still reading the legacy field at +48h, extend the monitoring window and investigate WHO. A stale mobile client? A CRON job reading the API? Root-cause before removing dual-emit.

- [ ] **Step 3: Document findings**

Append to `docs/investigations/2026-04-09-orderstatus-surface-audit.md`:

```markdown
## 13. Post-Deploy Report

**Deploy date:** YYYY-MM-DD
**Monitoring window:** +48h
**API 5xx rate delta:** ...
**Realtime error rate delta:** ...
**kitchen-display cache storm magnitude:** ... entries wiped
**Legacy field reads at +48h:** 0 / N
**Incidents:** ...
```

- [ ] **Step 4: Commit the report**

```bash
git add docs/investigations/2026-04-09-orderstatus-surface-audit.md
git commit -m "docs(investigation): post-deploy report for OrderStatus unification"
```

---

### Task 38: Remove dual-emit scaffolding

**Files:**
- Delete: `apps/api/src/shared/middleware/order-status-dual-emit.ts`
- Modify: `apps/api/src/features/orders/routes/index.ts` (remove the middleware mount)
- Delete: `apps/api/src/features/orders/__tests__/dual-emit.test.ts`
- Modify: `apps/api/wrangler.toml` (remove the ORDER_STATUS_DUAL_EMIT var)

- [ ] **Step 1: Confirm legacy reads are zero**

Re-check the telemetry from Task 37 Step 2. If non-zero, do NOT proceed.

- [ ] **Step 2: Remove the files**

```bash
rm apps/api/src/shared/middleware/order-status-dual-emit.ts
rm apps/api/src/features/orders/__tests__/dual-emit.test.ts
```

Remove the middleware mount from `apps/api/src/features/orders/routes/index.ts`.

Remove `ORDER_STATUS_DUAL_EMIT = "true"` from both staging and prod sections of `apps/api/wrangler.toml`.

- [ ] **Step 3: Typecheck + test**

```bash
cd apps/api && pnpm typecheck && pnpm vitest run
```

- [ ] **Step 4: Deploy API to staging, verify, then prod**

```bash
cd apps/api && pnpm deploy:staging
# smoke test — statusLegacyNumeric field should no longer appear
cd apps/api && pnpm deploy:prod
# smoke test again
```

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "chore(api): remove OrderStatus dual-emit scaffolding (Issue #9 migration complete)"
```

---

### Task 39: Close Issue #9 with retrospective

**Files:** none (GitHub issue operation)

- [ ] **Step 1: Compose the closing comment**

Structure:
- Links to the investigation doc + this plan
- Summary of phases executed
- Deviations from plan (if any)
- Metrics: total files changed, total commits, deploy window duration, incidents
- Lessons learned (what surprised us, what was mis-estimated)

- [ ] **Step 2: Post the comment and close**

```bash
gh issue close 9 --comment "$(cat <<'EOF'
## OrderStatus unification — shipped

**Investigation doc:** docs/investigations/2026-04-09-orderstatus-surface-audit.md
**Implementation plan:** docs/superpowers/plans/2026-04-09-orderstatus-unification.md

### Summary
...

### Deviations
...

### Metrics
...

### Lessons
...
EOF
)"
```

- [ ] **Step 3: Update MEMORY.md with any durable lessons**

If the migration surfaced learnings that future sessions should know (e.g. "the kitchen-display cache always bumps on every schema change" or "dual-emit windows need telemetry or you can't ever remove them"), save to memory via the memory system.

---

## Self-Review Checklist

Per the writing-plans skill, the plan author runs this before handing off. Run this before advancing to execution:

### Spec coverage (vs Issue #9 AC)

- [x] Full survey as markdown doc → Phase 0 Tasks 1-10 produce `docs/investigations/2026-04-09-orderstatus-surface-audit.md`
- [x] Complete file-level inventory across all 11 apps → Phase 0 Tasks 3-4
- [x] All callers of `getAllowedStatusTransitions` identified → Phase 0 Task 6
- [x] Answer to "which states are canonical" → Phase 0 Task 10 + Phase 0.5 Task 11
- [x] External-consumer audit → Phase 0 Task 7
- [x] Hibernated DO state schema + migration strategy → Phase 0 Task 8, implemented in Phase 3 Task 21
- [x] Staged deploy order → Phase 6 Tasks 32-36
- [x] Rollback strategy + criteria → each Phase 6 task has "Rollback criteria" step
- [x] Client bundle cache invalidation approach → Phase 4 Task 25 (kitchen-display explicit bump), browser bundle caching investigated in Phase 0 Task 9
- [x] DO state migration approach → Phase 3 Task 21 (lazy on wakeup with explicit version header)
- [x] localStorage cache invalidation for kitchen-display → Phase 4 Task 25
- [x] Post-deploy verification runbook → Phase 7 Task 37
- [x] Parametrized regression test covering all status values → Phase 1 Task 12

### Placeholder scan

Searched plan for: "TBD", "TODO", "implement later", "fill in details", "Similar to Task N", "add appropriate error handling":

- Task 19 Step 3 says "If ... go back and find it" — this is procedural, not a placeholder
- Task 21 Step 3 has "Note: `apps/realtime/package.json` does not currently have a `test` script. Task 21 Step 2 requires adding one." — this is a known-unknown, discovered during plan writing, documented explicitly as a task dependency (not deferred work)
- Task 25 Step 3 has `localStorage.removeItem("cached_orders"); // exact key name TBD from code` — **this IS a placeholder**. The engineer must read offlineService.ts to find the actual key name. Accept this as a bounded investigation within the task rather than a deferred decision.
- Task 26 Step 2 says "Suggested batches" — this is guidance, not a placeholder

### Type consistency

- `OrderStatus` is referenced in Phase 2 Task 13 (defined), Phase 2 Tasks 14-18 (used), Phase 3 Tasks 20-22 (used), Phase 4 Tasks 23-28 (used) — consistent throughout
- `ORDER_STATUSES` array defined in Task 13, referenced in Task 25 — consistent
- `ORDER_STATUS_TRANSITIONS` matrix defined in Task 22 Step 3 — referenced in the same task; new location is `packages/shared-types/src/order-transitions.ts`
- `CURRENT_DO_STATE_VERSION` defined in Task 20, referenced in Tasks 20-21 — consistent
- `ORDER_STATUS_DUAL_EMIT` env var defined in Task 31, referenced in Tasks 32, 34, 38 — consistent

### Open risks / known weaknesses

1. **Task 21's test infrastructure dependency** is the biggest risk — if realtime has no existing vitest setup, Task 21 grows significantly. Phase 0 Task 8 should confirm this before plan execution starts.
2. **Task 25's exact cache key name** is an in-task investigation. Not a blocker but the engineer should not assume.
3. **The 48-hour monitoring window in Phase 7** assumes telemetry exists to count legacy field reads. If it doesn't, a grep-based sampler or a header-based marker must be added. Phase 0 Task 9 should verify telemetry capability.
4. **Production deploy order assumes API → realtime → frontends is correct.** This is the conventional order but depends on whether any frontend writes directly to realtime without going through API. Phase 0 survey should confirm.

These are known open items that the Phase 0 investigation phase is designed to resolve before Phase 1+ executes.
