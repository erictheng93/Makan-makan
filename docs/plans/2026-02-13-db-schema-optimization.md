# DB Schema Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve database reliability and maintainability by adding transaction protection to 21 methods, standardizing soft deletes, unifying ID strategy, adopting cursor pagination for log tables, and splitting large schema files.

**Architecture:** Service-layer changes (transactions, pagination) + schema refactoring (file splits, ID defaults) + migration (soft delete columns). No breaking API changes.

**Tech Stack:** Drizzle ORM, SQLite/D1, TypeScript, pnpm + Turborepo

---

## Task 1: Split `partnerships.ts` schema file (18KB → 4 files)

**Files:**

- Create: `packages/database/src/schema/partnerships/partnerships.ts`
- Create: `packages/database/src/schema/partnerships/plans.ts`
- Create: `packages/database/src/schema/partnerships/members.ts`
- Create: `packages/database/src/schema/partnerships/usage-logs.ts`
- Create: `packages/database/src/schema/partnerships/index.ts`
- Delete: `packages/database/src/schema/partnerships.ts`
- Modify: `packages/database/src/schema/index.ts:21,69-74,86-96,104-113`

**Step 1: Read the current partnerships.ts file**

Read `packages/database/src/schema/partnerships.ts` fully. Identify the 4 table definitions, 4 relation definitions, type exports, and constant exports.

**Step 2: Create directory and split files**

Create `packages/database/src/schema/partnerships/` directory.

Split into 4 files, each containing:

- Its table definition (`sqliteTable`)
- Its relations definition (`relations()`)
- Its type exports (`$inferSelect`, `$inferInsert`)
- Required imports from drizzle-orm and cross-references to sibling tables

`partnerships.ts` — `partnerships` table + `partnershipsRelations` + types + constants (PARTNER_TYPES, VERIFICATION_METHODS, PARTNERSHIP_STATUS)
`plans.ts` — `partnershipPlans` table + `partnershipPlansRelations` + types + constants (PLAN_DISCOUNT_TYPES). Import `partnerships` from `./partnerships` and `users` from `../users`, `restaurants` from `../restaurants`
`members.ts` — `verifiedMembers` table + `verifiedMembersRelations` + types + constants (MEMBER_TYPES, MEMBER_STATUS). Import `partnerships` from `./partnerships`, `customers` from `../customers`, `users` from `../users`
`usage-logs.ts` — `partnershipUsageLogs` table + `partnershipUsageLogsRelations` + types + constants (USAGE_LOG_STATUS, USAGE_CHANNELS). Import from siblings and `../orders`, `../restaurants`, `../users`

**Step 3: Create the barrel index.ts**

```typescript
// packages/database/src/schema/partnerships/index.ts
export * from "./partnerships";
export * from "./plans";
export * from "./members";
export * from "./usage-logs";
```

**Step 4: Update parent schema/index.ts**

No changes needed — `export * from './partnerships'` resolves to `./partnerships/index.ts` automatically when the directory has an index.ts.

**Step 5: Delete the old file**

Delete `packages/database/src/schema/partnerships.ts`.

**Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors. All imports resolve through the barrel exports.

**Step 7: Commit**

```bash
git add packages/database/src/schema/partnerships/
git add packages/database/src/schema/partnerships.ts
git commit -m "refactor: split partnerships schema into subdirectory (4 files)"
```

---

## Task 2: Split `scheduling.ts` schema file (18KB → 7 files)

**Files:**

- Create: `packages/database/src/schema/scheduling/shift-templates.ts`
- Create: `packages/database/src/schema/scheduling/employee-schedules.ts`
- Create: `packages/database/src/schema/scheduling/scheduling-rules.ts`
- Create: `packages/database/src/schema/scheduling/scheduling-conflicts.ts`
- Create: `packages/database/src/schema/scheduling/swap-requests.ts`
- Create: `packages/database/src/schema/scheduling/employee-availability.ts`
- Create: `packages/database/src/schema/scheduling/index.ts`
- Delete: `packages/database/src/schema/scheduling.ts`

**Step 1: Read the current scheduling.ts file**

Read `packages/database/src/schema/scheduling.ts` fully. Identify 6 tables, 6 relations, and their cross-references.

**Step 2: Create directory and split files**

Same pattern as Task 1. Each file gets its table + relations + types. Cross-table references use relative imports (`./shift-templates`, `../users`, `../restaurants`).

**Step 3: Create barrel index.ts**

```typescript
export * from "./shift-templates";
export * from "./employee-schedules";
export * from "./scheduling-rules";
export * from "./scheduling-conflicts";
export * from "./swap-requests";
export * from "./employee-availability";
```

**Step 4: Delete old file, typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

**Step 5: Commit**

```bash
git add packages/database/src/schema/scheduling/
git add packages/database/src/schema/scheduling.ts
git commit -m "refactor: split scheduling schema into subdirectory (6 files)"
```

---

## Task 3: Split `leaves.ts` schema file (16KB → 6 files)

**Files:**

- Create: `packages/database/src/schema/leaves/leave-types.ts`
- Create: `packages/database/src/schema/leaves/leave-requests.ts`
- Create: `packages/database/src/schema/leaves/leave-balances.ts`
- Create: `packages/database/src/schema/leaves/leave-approval-rules.ts`
- Create: `packages/database/src/schema/leaves/leave-calendar-events.ts`
- Create: `packages/database/src/schema/leaves/index.ts`
- Delete: `packages/database/src/schema/leaves.ts`

**Step 1-5: Same pattern as Task 1 and 2**

Split 5 tables into individual files. Barrel export. Delete old file. Typecheck. Commit.

```bash
git commit -m "refactor: split leaves schema into subdirectory (5 files)"
```

---

## Task 4: Unify ID strategy — CUID2 → UUID v7

**Files:**

- Modify: `packages/database/src/schema/qr-codes.ts:3,8`
- Modify: `packages/database/src/schema/images.ts:3,8`

**Step 1: Update qr-codes.ts**

Replace:

```typescript
import { createId } from "@paralleldrive/cuid2";
```

With:

```typescript
import { generateUUID } from "@makanmasak/utils";
```

Replace:

```typescript
.$defaultFn(() => createId()),
```

With:

```typescript
.$defaultFn(() => generateUUID()),
```

**Step 2: Update images.ts**

Same replacements as Step 1.

**Step 3: Check if createId is used elsewhere**

Run: `grep -r "createId" packages/database/src/` — if no other usages, the `@paralleldrive/cuid2` dependency can be removed from `packages/database/package.json` later.

**Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors. Both functions return `string`.

**Step 5: Commit**

```bash
git add packages/database/src/schema/qr-codes.ts packages/database/src/schema/images.ts
git commit -m "refactor: unify ID strategy from CUID2 to UUID v7 for qr-codes and images"
```

---

## Task 5: Add transaction protection — GroupOrderService (6 methods)

**Files:**

- Modify: `packages/database/src/services/GroupOrderService.ts`

**Reference pattern** from `order.optimized.ts:332`:

```typescript
const result = await this.db.transaction(async (tx) => {
  // all writes use tx instead of this.db
});
```

**Step 1: Wrap `createGroupOrder` (lines 171-282)**

Find the method body. Wrap the 3 sequential inserts (groupOrders:224, groupMembers:243, shareCodes:259) in `this.db.transaction(async (tx) => { ... })`. Replace all `this.db.insert` with `tx.insert` inside the transaction.

**Step 2: Wrap `joinGroup` (lines 285-441)**

Wrap the insert groupMembers (398), update shareCodes (401-410), and insert groupActivityLogs (423) in a transaction.

**Step 3: Wrap `addCartItem` (lines 546-675)**

Wrap insert groupCartItems (629) and insert groupActivityLogs (647) in a transaction.

**Step 4: Wrap `initiateSplit` (lines 678-840) — CRITICAL**

This is the highest-risk method. Wrap the update groupOrders (712-719) and the loop inserting splitBills (826) in a transaction. The group must not be locked if split bill creation fails.

**Step 5: Wrap `processPayment` (lines 843-918)**

Wrap update splitBills (872-882) and conditional update groupOrders (900-907) in a transaction.

**Step 6: Wrap `leaveGroup` (lines 921-984)**

Wrap update groupMembers (955-962) and update groupCartItems (965-974) in a transaction.

**Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

**Step 8: Commit**

```bash
git add packages/database/src/services/GroupOrderService.ts
git commit -m "fix: add transaction protection to GroupOrderService (6 methods)"
```

---

## Task 6: Add transaction protection — LeaveService (6 methods)

**Files:**

- Modify: `packages/database/src/services/LeaveService.ts`

**Step 1: Wrap `createLeaveRequest` (lines 635-696)**

Wrap insert leaveRequests (646-658) and updateBalancePendingDays call (661) in a transaction. Pass `tx` to the balance update.

**Step 2: Wrap `approveLeaveRequest` (lines 701-832) — CRITICAL**

This is complex — it calls SchedulingService externally. Strategy:

1. Wrap the DB writes in a transaction: update leaveRequests (727-737), balance updates (740-741), second update leaveRequests (756-762)
2. Keep the SchedulingService call OUTSIDE the transaction (it's a separate service with its own DB connection)
3. If the schedule cancellation fails, the leave is still approved but schedules remain — this is acceptable (better than a partial state)

**Step 3: Wrap `rejectLeaveRequest` (lines 837-903)**

Wrap update leaveRequests (853-863) and updateBalancePendingDays (866) in a transaction.

**Step 4: Wrap `cancelLeaveRequest` (lines 908-977)**

Wrap update leaveRequests (924-934) and conditional balance updates (937-941) in a transaction.

**Step 5: Wrap `accrueLeaveBalances` (lines 449-509)**

Wrap the loop of insert employeeLeaveBalances (486-499) in a single transaction. All-or-nothing accrual.

**Step 6: Wrap `adjustLeaveBalance` (lines 366-444)**

Wrap the conditional insert/update of employeeLeaveBalances in a transaction.

**Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

**Step 8: Commit**

```bash
git add packages/database/src/services/LeaveService.ts
git commit -m "fix: add transaction protection to LeaveService (6 methods)"
```

---

## Task 7: Add transaction protection — POSService (3 methods)

**Files:**

- Modify: `packages/database/src/services/POSService.ts`

**Step 1: Wrap `startShift` (lines 345-421)**

Wrap insert cashShifts (392) and recordCashMovement call (395-400) in a transaction. The `recordCashMovement` method itself needs to accept an optional `tx` parameter.

**Step 2: Refactor `recordCashMovement` to accept optional tx**

Add an optional `tx` parameter to `recordCashMovement`. When provided, use `tx` instead of `this.db`. This allows it to participate in the caller's transaction.

```typescript
private async recordCashMovement(data: CashMovementData, tx?: typeof this.db) {
  const db = tx ?? this.db
  return await db.insert(cashMovements).values({...}).returning()
}
```

**Step 3: Wrap `endShift` (lines 423-508) — CRITICAL**

Wrap all 4 operations in a transaction: update cashShifts (456-467), recordCashMovement (470-475), update cashRegisters (478-481), and generateShiftReport if applicable. Pass `tx` to `recordCashMovement`.

**Step 4: Wrap `processRefund` (lines 720-833)**

Wrap insert refunds (776) and recordCashMovement (780-787) in a transaction.

**Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

**Step 6: Commit**

```bash
git add packages/database/src/services/POSService.ts
git commit -m "fix: add transaction protection to POSService (3 methods)"
```

---

## Task 8: Add transaction protection — SchedulingService (4 methods)

**Files:**

- Modify: `packages/database/src/services/SchedulingService.ts`

**Step 1: Wrap `createSchedule` (lines 320-380)**

Wrap createConflictRecord loop (326-328) and insert employeeSchedules (331-341) in a transaction. Conflicts and schedule must be atomic.

**Step 2: Wrap `bulkCreateSchedules` (lines 479-518)**

Wrap the entire loop calling createSchedule (496-506) in a single transaction. All schedules succeed or none do. Pass `tx` through to `createSchedule` by adding an optional tx parameter.

**Step 3: Wrap `cancelSchedulesByDateRange` (lines 1291-1342)**

Wrap the query + batch update in a transaction to prevent race conditions.

**Step 4: Wrap `approveSwapRequest` (lines 1001-1084)**

Wrap update scheduleSwapRequests (1002-1011) in a transaction. Keep notification calls outside the transaction (they're non-critical side effects).

**Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

**Step 6: Commit**

```bash
git add packages/database/src/services/SchedulingService.ts
git commit -m "fix: add transaction protection to SchedulingService (4 methods)"
```

---

## Task 9: Add transaction protection — VerificationService (4 methods)

**Files:**

- Modify: `packages/database/src/services/VerificationService.ts`

**Step 1: Wrap `resetPassword` (lines 269-360)**

Wrap update users (299-306), update passwordResetTokens (309-313), and insert passwordChangeLogs (323) in a transaction. Password change must be all-or-nothing.

**Step 2: Wrap `verifyEmail` (lines 438-523)**

Wrap update emailVerificationTokens (469-476) and update users (479-486) in a transaction.

**Step 3: Wrap `verifyPhone` (lines 582-678)**

Wrap update phoneVerificationTokens and update users in a transaction for the success path (637-653).

**Step 4: Wrap `cleanupExpiredTokens` (lines 687-726)**

Wrap the 3 delete operations (696-711) in a transaction. All-or-nothing cleanup.

**Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

**Step 6: Commit**

```bash
git add packages/database/src/services/VerificationService.ts
git commit -m "fix: add transaction protection to VerificationService (4 methods)"
```

---

## Task 10: Cursor pagination for log tables

**Files:**

- Modify: `packages/database/src/services/error-reporting.ts:120-204`
- Modify: `packages/database/src/services/PartnershipService.ts` (listPartnerships, listPlans, getUsageLogs methods)

**Step 1: Read the existing cursor pagination helper**

Read `packages/database/src/utils/pagination-helpers.ts` fully. Understand the `paginateWithCursor()` API — its input parameters and return shape (`CursorPaginatedResponse`).

**Step 2: Update ErrorReportingService.getErrorReports**

Replace the `createPagination(page, limit)` + `.offset()/.limit()` pattern with `paginateWithCursor()`. The cursor key should be `id` (auto-increment, guaranteed unique and ordered).

Keep the existing offset-based method as a fallback by checking if a `cursor` parameter is provided:

```typescript
async getErrorReports(filters: ErrorReportFilters & { cursor?: string }) {
  if (filters.cursor) {
    return paginateWithCursor(/* ... */)
  }
  // existing offset-based logic
}
```

**Step 3: Update PartnershipService usage log queries**

Apply the same pattern to `getPartnershipStatistics` and any method returning paginated usage logs.

**Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

**Step 5: Commit**

```bash
git add packages/database/src/services/error-reporting.ts packages/database/src/services/PartnershipService.ts
git commit -m "feat: add cursor pagination support for log tables (error-reports, partnerships)"
```

---

## Task 11: Soft delete standardization — Migration + Schema

**Files:**

- Create: `packages/database/migrations_fresh/0007_add-soft-delete-columns.sql`
- Modify: `packages/database/src/schema/partnerships/partnerships.ts` (after Task 1 split)
- Modify: `packages/database/src/schema/partnerships/plans.ts`
- Modify: `packages/database/src/schema/partnerships/members.ts`
- Modify: `packages/database/src/schema/scheduling/shift-templates.ts` (after Task 2 split)
- Modify: `packages/database/src/schema/scheduling/employee-schedules.ts`
- Modify: `packages/database/src/schema/leaves/leave-requests.ts` (after Task 3 split)

**Step 1: Add `deleted_at_ms` to schema files**

For each of the 6 tables above, add:

```typescript
deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
```

Follow the existing pattern from `restaurants.ts:89`.

**Step 2: Write the migration SQL**

Create `packages/database/migrations_fresh/0007_add-soft-delete-columns.sql`:

```sql
-- Add soft delete columns to partnership tables
ALTER TABLE partnerships ADD COLUMN deleted_at_ms INTEGER;
ALTER TABLE partnership_plans ADD COLUMN deleted_at_ms INTEGER;
ALTER TABLE verified_members ADD COLUMN deleted_at_ms INTEGER;

-- Add soft delete columns to scheduling tables
ALTER TABLE shift_templates ADD COLUMN deleted_at_ms INTEGER;
ALTER TABLE employee_schedules ADD COLUMN deleted_at_ms INTEGER;

-- Add soft delete columns to leave tables
ALTER TABLE leave_requests ADD COLUMN deleted_at_ms INTEGER;
```

**Step 3: Generate migration metadata**

Run: `pnpm db:generate` — Drizzle Kit will detect the new columns and generate the migration metadata JSON (snapshot). If it creates a new migration file conflicting with our manual one, merge them.

Alternatively, create the migration journal entry manually in `migrations_fresh/meta/` if `db:generate` creates a duplicate.

**Step 4: Apply migration locally**

Run: `pnpm db:migrate:local`
Expected: Migration applied successfully.

**Step 5: Update service queries to filter soft-deleted records**

In each affected service, add `notDeleted()` filter (from `packages/database/src/utils/soft-delete.ts`) to list/get queries:

```typescript
import { notDeleted } from "../utils/soft-delete";

// In list queries, add to WHERE clause:
where: and(
  eq(partnerships.restaurantId, restaurantId),
  notDeleted(partnerships), // filter out soft-deleted
);
```

Update delete methods to use `softDelete.softDelete()` instead of `this.db.delete()`.

**Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

**Step 7: Apply migration and verify**

Run: `pnpm db:migrate:local && pnpm db:seed:mock`
Expected: Migration applies cleanly, seed data loads.

**Step 8: Commit**

```bash
git add packages/database/migrations_fresh/0007_add-soft-delete-columns.sql
git add packages/database/src/schema/partnerships/ packages/database/src/schema/scheduling/ packages/database/src/schema/leaves/
git add packages/database/src/services/
git commit -m "feat: standardize soft delete across partnerships, scheduling, and leave tables (migration 0007)"
```

---

## Task 12: Final verification

**Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: 0 errors across all 18 packages.

**Step 2: Run unit tests**

Run: `pnpm test`
Expected: All existing tests pass. Transaction wrappers should not change test behavior (mock DB uses in-memory stores).

**Step 3: Verify database**

Run: `pnpm db:reset:local && pnpm db:migrate:local && pnpm db:seed:mock`
Expected: Clean database with all 7 migrations applied, seed data loaded.

**Step 4: Final commit (if any fixes needed)**

```bash
git commit -m "fix: resolve issues from DB schema optimization"
```

---

## Execution Summary

| Task | Description                       | Risk   | Files Changed      |
| ---- | --------------------------------- | ------ | ------------------ |
| 1    | Split partnerships.ts             | None   | 6 create, 1 delete |
| 2    | Split scheduling.ts               | None   | 8 create, 1 delete |
| 3    | Split leaves.ts                   | None   | 7 create, 1 delete |
| 4    | Unify CUID2 → UUID v7             | Low    | 2 modify           |
| 5    | Transactions: GroupOrderService   | Medium | 1 modify           |
| 6    | Transactions: LeaveService        | High   | 1 modify           |
| 7    | Transactions: POSService          | High   | 1 modify           |
| 8    | Transactions: SchedulingService   | Medium | 1 modify           |
| 9    | Transactions: VerificationService | Medium | 1 modify           |
| 10   | Cursor pagination                 | Low    | 2 modify           |
| 11   | Soft delete migration             | Medium | 7 modify, 1 create |
| 12   | Final verification                | None   | 0                  |
