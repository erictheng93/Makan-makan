# DB Schema Optimization Design

**Date**: 2026-02-13
**Status**: Approved

## Problem Statement

Database schema evaluation identified 5 areas for improvement across the MakanMasak database layer (69 tables, 22 schema files, 37 service classes).

## Scope

5 optimization items (JSON field optimization deferred — no current performance bottleneck, SQLite limitations on generated columns).

---

## 1. Transaction Protection (High Priority)

### Problem

21 out of 24 multi-step write methods lack `db.transaction()` wrappers. 3 are critical risk (data corruption on partial failure).

### Affected Services & Methods

**Critical Risk:**

- `GroupOrderService.initiateSplit` — locks group then inserts N split bills; group locked forever if partial insert fails
- `LeaveService.approveLeaveRequest` — updates request, balance, cancels schedules, second update; cascading failures
- `POSService.endShift` — 4 operations (shift close, cash movement, register clear, report); incomplete cash tracking

**High Risk:**

- `GroupOrderService.createGroupOrder` — 3 inserts (order, member, share code)
- `LeaveService.createLeaveRequest` — insert request then update balance
- `SchedulingService.bulkCreateSchedules` — loop-based inserts with silent failures

**Medium Risk (15 methods):**

- GroupOrderService: joinGroup, addCartItem, processPayment, leaveGroup
- LeaveService: rejectLeaveRequest, cancelLeaveRequest, accrueLeaveBalances, adjustLeaveBalance
- POSService: startShift, processRefund
- SchedulingService: createSchedule, cancelSchedulesByDateRange, approveSwapRequest
- VerificationService: resetPassword, verifyEmail/Phone

### Implementation Pattern

```typescript
// Wrap all multi-step writes in db.transaction()
async method(data) {
  return await this.db.transaction(async (tx) => {
    // All writes use tx instead of this.db
    const [result] = await tx.insert(table).values({...}).returning()
    await tx.update(otherTable).set({...}).where(...)
    return result
  })
}
```

### Constraint

Methods that call external services (e.g., LeaveService calling SchedulingService) need the transaction passed through or the external call placed outside the transaction boundary.

---

## 2. Soft Delete Standardization (Medium Priority)

### Problem

SoftDeleteService exists but only some tables have `deleted_at_ms`. Partnership and scheduling tables use CASCADE delete, losing historical data.

### Tables to Add `deleted_at_ms`

- `partnerships` — currently uses status field only
- `partnership_plans` — CASCADE from partnerships loses plan history
- `verified_members` — CASCADE from partnerships loses member verification history
- `shift_templates` — has `isActive` but no soft delete
- `employee_schedules` — has status but no soft delete
- `leave_requests` — has status but no soft delete

### Migration Strategy

New migration `0007_add-soft-delete-columns.sql` using `ALTER TABLE ADD COLUMN` (SQLite supports nullable ADD COLUMN without table recreation).

```sql
ALTER TABLE partnerships ADD COLUMN deleted_at_ms INTEGER;
ALTER TABLE partnership_plans ADD COLUMN deleted_at_ms INTEGER;
-- etc.
```

### Service Layer Changes

- Update delete methods to use `softDelete.softDelete()` instead of `db.delete()`
- Add `notDeleted()` filter to all list/get queries on affected tables
- Change CASCADE → RESTRICT for partnerships → partnership_plans, verified_members (requires table recreation in migration)

---

## 3. ID Strategy Unification: CUID2 → UUID v7 (Low Priority)

### Problem

2 tables (qr_codes, images) use CUID2 while 16+ others use UUID v7. Both are time-sortable unique IDs — unnecessary cognitive overhead.

### Changes

- `qr_codes.id`: Change `$defaultFn(() => createId())` → `$defaultFn(() => generateUUID())`
- `images.id`: Same change

### No Migration Needed

Only affects new records. Existing CUID2 IDs remain valid TEXT primary keys.

### Import Changes

- Remove `createId` import from `@paralleldrive/cuid2`
- Add `generateUUID` import from `@makanmasak/utils`

---

## 4. Cursor Pagination for Log Tables (Low Priority)

### Problem

`audit_logs`, `error_reports`, `partnership_usage_logs` use offset-based pagination. Deep pagination (OFFSET 100000+) scans and discards rows.

### Solution

Use existing `paginateWithCursor()` helper from `packages/database/src/utils/pagination-helpers.ts`.

### Affected Services

- `ErrorReportingService` — getErrors, getErrorStats
- `AuditLogService` (if exists) — list queries
- `PartnershipService` — getUsageLogs

### No Schema Changes

Cursor pagination uses existing indexed `id` or `created_at_ms` columns.

---

## 5. Large Schema File Splitting (Low Priority)

### Problem

3 schema files exceed 16KB, increasing merge conflict risk and reducing readability.

### Splitting Plan

**partnerships.ts (18KB) →**

```
schema/partnerships/
├── partnerships.ts          # partnerships table + relations
├── plans.ts                 # partnership_plans table + relations
├── members.ts               # verified_members table + relations
├── usage-logs.ts            # partnership_usage_logs table + relations
└── index.ts                 # re-exports all
```

**scheduling.ts (18KB) →**

```
schema/scheduling/
├── shift-templates.ts
├── employee-schedules.ts
├── scheduling-rules.ts
├── scheduling-conflicts.ts
├── swap-requests.ts
├── employee-availability.ts
└── index.ts
```

**leaves.ts (16KB) →**

```
schema/leaves/
├── leave-types.ts
├── leave-requests.ts
├── leave-balances.ts
├── leave-approval-rules.ts
├── leave-calendar-events.ts
└── index.ts
```

### Parent index.ts Update

Change `export * from './partnerships'` → `export * from './partnerships/index'` (or keep same if directory has index.ts).

### Verification

Run `pnpm typecheck` after splitting to ensure all imports resolve.

---

## Execution Order

1. **#5 Schema file splitting** — pure refactor, zero risk, makes subsequent changes easier to review
2. **#3 ID strategy unification** — trivial change, no migration
3. **#1 Transaction protection** — highest impact, service-layer only
4. **#4 Cursor pagination** — service-layer only, uses existing helpers
5. **#2 Soft delete standardization** — requires migration, most complex

## Deferred

- **JSON field optimization** — no current performance bottleneck; SQLite doesn't support indexed generated columns; revisit when specific slow queries are identified
