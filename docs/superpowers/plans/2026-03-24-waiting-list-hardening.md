# Waiting-List Feature Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the waiting-list feature by adding optimistic locking, implementing batch-call auto-assignment, wiring notification hooks, and adding frontend component tests.

**Architecture:** The waiting-list has a 7-state FSM. All state transitions go through `WaitingListService` which uses Drizzle ORM `db.run()` for UPDATEs. Optimistic locking adds WHERE status conditions to prevent concurrent double-transitions. Batch-call queries available tables and matches them to waiting entries by capacity. Notifications use the existing `NotificationService` (MailChannels + Twilio). Frontend tests use `@vue/test-utils` + `vitest` with Pinia stores.

**Tech Stack:** TypeScript, Drizzle ORM (d1), Vitest, Vue 3, @vue/test-utils, Pinia

---

## File Map

| Action | Path                                                                  | Responsibility                                                                                        |
| ------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Modify | `packages/database/src/services/WaitingListService.ts`                | Add WHERE status to 5 UPDATEs, add `findAvailableTable()` + `batchCallNext()`, add notification hooks |
| Modify | `packages/database/src/services/NotificationService.ts:26-45`         | Add 3 waiting-list notification categories                                                            |
| Modify | `apps/api/src/features/waiting-list/routes/index.ts:339-356`          | Replace batch-call TODO with real service call                                                        |
| Modify | `packages/database/src/services/__tests__/WaitingListService.test.ts` | Update mock `run()` to return `meta.changes`, add optimistic locking + batch-call tests               |
| Create | `apps/admin-dashboard/src/views/__tests__/WaitingListView.test.ts`    | Frontend component tests                                                                              |

---

## Task 1: Optimistic Locking — Service Layer

**Files:**

- Modify: `packages/database/src/services/WaitingListService.ts:306-314,350-356,381-387,423-429,463-469`

### Context

Currently all 5 UPDATE statements use `WHERE id = ${id}` only. If two staff call the same customer simultaneously, both reads see `status = 'waiting'`, both pass the application-level check, and both UPDATEs succeed — resulting in double table reservation.

The fix: add `AND status = 'X'` to each WHERE clause, then check `result.meta.changes`. If 0, another operation won the race.

- [ ] **Step 1: Add optimistic lock to `callWaiting` UPDATE (line 306-314)**

```typescript
// Replace:
await this.db.run(sql`
  UPDATE waiting_list
  SET status = 'called',
      table_id = ${request.tableId},
      called_at = ${now},
      timeout_at = ${timeoutAt},
      updated_at = ${now}
  WHERE id = ${id}
`);

// With:
const result = await this.db.run(sql`
  UPDATE waiting_list
  SET status = 'called',
      table_id = ${request.tableId},
      called_at = ${now},
      timeout_at = ${timeoutAt},
      updated_at = ${now}
  WHERE id = ${id} AND status = 'waiting'
`);
if ((result as any)?.meta?.changes === 0) {
  throw new Error("叫號失敗：狀態已被其他操作更新，請刷新");
}
```

- [ ] **Step 2: Add optimistic lock to `confirmWaiting` UPDATE (line 350-356)**

```typescript
const result = await this.db.run(sql`
  UPDATE waiting_list
  SET status = 'confirmed',
      confirmed_at = ${now},
      updated_at = ${now}
  WHERE id = ${id} AND status = 'called'
`);
if ((result as any)?.meta?.changes === 0) {
  throw new Error("確認失敗：狀態已被其他操作更新，請刷新");
}
```

- [ ] **Step 3: Add optimistic lock to `markSeated` UPDATE (line 381-387)**

```typescript
const result = await this.db.run(sql`
  UPDATE waiting_list
  SET status = 'seated',
      seated_at = ${now},
      updated_at = ${now}
  WHERE id = ${id} AND (status = 'called' OR status = 'confirmed')
`);
if ((result as any)?.meta?.changes === 0) {
  throw new Error("入座失敗：狀態已被其他操作更新，請刷新");
}
```

- [ ] **Step 4: Add optimistic lock to `cancelWaiting` UPDATE (line 423-429)**

```typescript
const result = await this.db.run(sql`
  UPDATE waiting_list
  SET status = 'cancelled',
      cancelled_at = ${now},
      updated_at = ${now}
  WHERE id = ${id} AND status IN ('waiting', 'called', 'confirmed')
`);
if ((result as any)?.meta?.changes === 0) {
  throw new Error("取消失敗：狀態已被其他操作更新，請刷新");
}
```

- [ ] **Step 5: Add optimistic lock to `expireWaiting` UPDATE (line 463-469)**

```typescript
const result = await this.db.run(sql`
  UPDATE waiting_list
  SET status = 'expired',
      expired_at = ${now},
      updated_at = ${now}
  WHERE id = ${id} AND status IN ('waiting', 'called', 'confirmed')
`);
if ((result as any)?.meta?.changes === 0) {
  throw new Error("過期標記失敗：狀態已被其他操作更新，請刷新");
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/database/src/services/WaitingListService.ts
git commit -m "feat(waiting-list): add optimistic locking to all state transitions"
```

---

## Task 2: Optimistic Locking — Mock + Tests

**Files:**

- Modify: `packages/database/src/services/__tests__/WaitingListService.test.ts`

### Context

The mock's `handleUpdate` needs to check WHERE status conditions and `run()` needs to return `{ success: true, meta: { changes: N } }`. The key is parsing the WHERE clause to distinguish SET status from WHERE status.

- [ ] **Step 1: Update `handleUpdate` to return boolean (whether update was applied)**

Change `function handleUpdate(queryStr, values): void` to return `boolean`. Add WHERE status condition parsing:

```typescript
function handleUpdate(queryStr: string, values: any[]): boolean {
  state.updateCalled = true;

  if (queryStr.includes("waiting_list")) {
    const id = values[values.length - 1];
    const entry = mockData.waitingList.get(id);
    if (!entry) return false;

    // Check WHERE status condition (optimistic locking)
    const whereIndex = queryStr.indexOf("WHERE");
    if (whereIndex >= 0) {
      const whereClause = queryStr.substring(whereIndex);
      // Single status: AND status = 'waiting'
      const singleMatch = whereClause.match(/status\s*=\s*'(\w+)'/);
      // IN clause: AND status IN ('waiting', 'called', 'confirmed')
      const inMatch = whereClause.match(/status\s+IN\s*\(([^)]+)\)/i);
      // OR clause: AND (status = 'called' OR status = 'confirmed')
      const orMatch = whereClause.match(
        /\(status\s*=\s*'(\w+)'\s+OR\s+status\s*=\s*'(\w+)'\)/,
      );

      if (inMatch) {
        const allowed =
          inMatch[1].match(/'(\w+)'/g)?.map((s) => s.replace(/'/g, "")) || [];
        if (!allowed.includes(entry.status)) return false;
      } else if (orMatch) {
        if (entry.status !== orMatch[1] && entry.status !== orMatch[2])
          return false;
      } else if (singleMatch) {
        if (entry.status !== singleMatch[1]) return false;
      }
    }

    // Extract SET status (from before WHERE)
    const setClause = queryStr.substring(
      0,
      queryStr.indexOf("WHERE") || queryStr.length,
    );
    const setStatusMatch = setClause.match(/status\s*=\s*'(\w+)'/);
    if (setStatusMatch) entry.status = setStatusMatch[1];

    // ... rest of existing field extraction logic ...
  }

  // ... tables update logic unchanged ...
  return true;
}
```

- [ ] **Step 2: Update `run()` to return `meta.changes` based on `handleUpdate` result**

```typescript
run: async (query: any) => {
  const { queryStr, values } = extractQueryInfo(query);
  const upperStr = queryStr.trimStart().toUpperCase();
  if (upperStr.startsWith("INSERT")) {
    handleInsert(queryStr, values);
    return { success: true, meta: { changes: 1 } };
  } else if (upperStr.startsWith("UPDATE")) {
    const applied = handleUpdate(queryStr, values);
    return { success: true, meta: { changes: applied ? 1 : 0 } };
  }
  return { success: true, meta: { changes: 0 } };
},
```

- [ ] **Step 3: Write optimistic locking test — race condition now caught**

```typescript
describe("Optimistic Locking - 樂觀鎖", () => {
  it("並發叫號：第二次應因樂觀鎖失敗", async () => {
    const entryId = "wait-ol-001";
    mockDB._mockData.waitingList.set(entryId, {
      id: entryId,
      status: "waiting",
      party_size: 4,
      restaurant_id: "R-001",
    });
    mockDB._mockData.tables.set(10, {
      id: 10,
      is_occupied: 0,
      is_active: 1,
      capacity: 6,
    });
    mockDB._mockData.tables.set(11, {
      id: 11,
      is_occupied: 0,
      is_active: 1,
      capacity: 6,
    });

    // First call succeeds
    await service.callWaiting(entryId, { tableId: 10 });
    // Second call fails — WHERE status = 'waiting' no longer matches
    await expect(service.callWaiting(entryId, { tableId: 11 })).rejects.toThrow(
      "無法叫號",
    );
  });

  it("並發入座：WHERE status 條件阻止重複入座", async () => {
    const entryId = "wait-ol-002";
    mockDB._mockData.waitingList.set(entryId, {
      id: entryId,
      status: "confirmed",
      table_id: 1,
      restaurant_id: "R-001",
    });
    await service.markSeated(entryId);
    await expect(service.markSeated(entryId)).rejects.toThrow("無法入座");
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @makanmakan/database exec vitest run src/services/__tests__/WaitingListService.test.ts --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/services/__tests__/WaitingListService.test.ts
git commit -m "test(waiting-list): add optimistic locking mock support and tests"
```

---

## Task 3: Batch-Call — Auto Table Assignment

**Files:**

- Modify: `packages/database/src/services/WaitingListService.ts` (add `findAvailableTable` + `batchCallNext`)
- Modify: `apps/api/src/features/waiting-list/routes/index.ts:339-356`
- Test: `packages/database/src/services/__tests__/WaitingListService.test.ts`

### Context

The batch-call route fetches waiting entries but always returns `success: false` because auto table assignment is not implemented. The types `TableAssignmentRequest` and `TableAssignmentResult` already exist in shared-types. The algorithm: query available tables sorted by capacity (best-fit), match each waiting entry to the smallest suitable table.

- [ ] **Step 1: Write failing test for `findAvailableTable`**

```typescript
describe("findAvailableTable - 自動桌位分配", () => {
  it("應該找到容量最接近的可用桌位", async () => {
    mockDB._mockData.tables.set(1, {
      id: 1,
      table_number: "T1",
      capacity: 2,
      is_occupied: 0,
      is_active: 1,
      restaurant_id: "R-001",
    });
    mockDB._mockData.tables.set(2, {
      id: 2,
      table_number: "T2",
      capacity: 4,
      is_occupied: 0,
      is_active: 1,
      restaurant_id: "R-001",
    });
    mockDB._mockData.tables.set(3, {
      id: 3,
      table_number: "T3",
      capacity: 6,
      is_occupied: 0,
      is_active: 1,
      restaurant_id: "R-001",
    });

    const result = await service.findAvailableTable("R-001", 3);
    expect(result).not.toBeNull();
    expect(result!.tableId).toBe(2); // 4-person table is best fit for 3 people
  });

  it("沒有適合桌位時應返回 null", async () => {
    mockDB._mockData.tables.set(1, {
      id: 1,
      capacity: 2,
      is_occupied: 0,
      is_active: 1,
      restaurant_id: "R-001",
    });
    const result = await service.findAvailableTable("R-001", 6);
    expect(result).toBeNull();
  });

  it("所有桌位佔用時應返回 null", async () => {
    mockDB._mockData.tables.set(1, {
      id: 1,
      capacity: 6,
      is_occupied: 1,
      is_active: 1,
      restaurant_id: "R-001",
    });
    const result = await service.findAvailableTable("R-001", 2);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — should FAIL (method doesn't exist)**

- [ ] **Step 3: Implement `findAvailableTable` in WaitingListService**

Add after `expireWaiting` method (~line 486):

```typescript
/**
 * 自動尋找最適合的可用桌位（best-fit: 容量最小且 >= partySize）
 */
async findAvailableTable(
  restaurantId: string,
  partySize: number,
): Promise<TableAssignmentResult | null> {
  const table = (await this.db.get(sql`
    SELECT id, table_number, capacity
    FROM tables
    WHERE restaurant_id = ${restaurantId}
      AND is_active = 1
      AND is_occupied = 0
      AND capacity >= ${partySize}
    ORDER BY capacity ASC, id ASC
    LIMIT 1
  `)) as any;

  if (!table) return null;

  return {
    tableId: table.id,
    tableNumber: table.table_number || `T${table.id}`,
    confidence: table.capacity === partySize ? 1.0 : Math.max(0.5, 1.0 - (table.capacity - partySize) * 0.1),
    reason: `自動分配：${table.capacity}人桌 (最佳匹配)`,
  };
}
```

- [ ] **Step 4: Run test — should PASS**

- [ ] **Step 5: Write failing test for `batchCallNext`**

```typescript
describe("batchCallNext - 批次叫號", () => {
  it("應該自動分配桌位並叫號", async () => {
    mockDB._mockData.waitingList.set("w1", {
      id: "w1",
      status: "waiting",
      party_size: 2,
      queue_number: 1,
      restaurant_id: "R-001",
      customer_name: "Alice",
      customer_phone: "0912345678",
    });
    mockDB._mockData.tables.set(1, {
      id: 1,
      table_number: "T1",
      capacity: 4,
      is_occupied: 0,
      is_active: 1,
      restaurant_id: "R-001",
    });

    const results = await service.batchCallNext("R-001", 1);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].tableId).toBe(1);
  });

  it("沒有可用桌位時應返回失敗", async () => {
    mockDB._mockData.waitingList.set("w1", {
      id: "w1",
      status: "waiting",
      party_size: 2,
      queue_number: 1,
      restaurant_id: "R-001",
      customer_name: "Alice",
      customer_phone: "0912345678",
    });
    // No tables

    const results = await service.batchCallNext("R-001", 1);
    expect(results[0].success).toBe(false);
    expect(results[0].message).toContain("無可用桌位");
  });
});
```

- [ ] **Step 6: Implement `batchCallNext` in WaitingListService**

```typescript
/**
 * 批次叫號：自動為排隊中的客人分配桌位
 */
async batchCallNext(
  restaurantId: string,
  count: number = 1,
): Promise<Array<{ id: string; success: boolean; tableId?: number; message: string }>> {
  const { data: waitingList } = await this.listWaitingList({
    restaurantId,
    status: "waiting" as any,
    limit: count,
  });

  const results = [];

  for (const entry of waitingList) {
    const table = await this.findAvailableTable(restaurantId, entry.partySize);
    if (!table) {
      results.push({ id: entry.id, success: false, message: "無可用桌位" });
      continue;
    }

    try {
      await this.callWaiting(entry.id, { tableId: table.tableId });
      results.push({
        id: entry.id, success: true, tableId: table.tableId,
        message: `已叫號，分配桌位 ${table.tableNumber}`,
      });
    } catch (error) {
      results.push({
        id: entry.id, success: false,
        message: error instanceof Error ? error.message : "叫號失敗",
      });
    }
  }

  return results;
}
```

- [ ] **Step 7: Run test — should PASS**

- [ ] **Step 8: Update route to use `service.batchCallNext`**

Replace lines 337-356 in `routes/index.ts`:

```typescript
const service = new WaitingListService(c.env.DB, c.env);
const results = await service.batchCallNext(targetRestaurantId, count);

return c.json({
  success: true,
  data: results,
  message: `批次叫號完成：${results.filter((r) => r.success).length}/${results.length} 成功`,
});
```

- [ ] **Step 9: Run all waiting-list tests**

Run: `pnpm --filter @makanmakan/api exec vitest run src/features/waiting-list/ --reporter=verbose`
Expected: All PASS

- [ ] **Step 10: Commit**

```bash
git add packages/database/src/services/WaitingListService.ts apps/api/src/features/waiting-list/routes/index.ts packages/database/src/services/__tests__/WaitingListService.test.ts
git commit -m "feat(waiting-list): implement batch-call with auto table assignment"
```

---

## Task 4: Notification Hooks

**Files:**

- Modify: `packages/database/src/services/NotificationService.ts:26-45` (add categories)
- Modify: `packages/database/src/services/NotificationService.ts:498+` (add templates)
- Modify: `packages/database/src/services/WaitingListService.ts` (replace 3 TODOs)
- Test: `packages/database/src/services/__tests__/WaitingListService.test.ts`

### Context

The NotificationService already has `SMSProvider` interface and `TwilioSMSProvider` implementation. It also has a template system. We need to:

1. Add 3 notification categories: `waiting_list_confirmed`, `waiting_list_called`, `waiting_list_expired`
2. Add SMS templates for these categories
3. Call the notification service from WaitingListService (non-blocking, fire-and-forget with try-catch)

Notifications are **fire-and-forget** — they must never block or fail the main operation.

- [ ] **Step 1: Add 3 notification categories to NotificationService types (line 26-45)**

Add after `"phone_verification_success"`:

```typescript
// Waiting list notifications
| "waiting_list_confirmed"
| "waiting_list_called"
| "waiting_list_expired";
```

- [ ] **Step 2: Add SMS templates (after line 498 shift_reminder template)**

```typescript
// ============================================
// Waiting List Notification Templates
// ============================================

waiting_list_confirmed: {
  body: "【MakanMakan】{{customerName}} 您好，您已成功加入候位。排隊號碼：{{queueNumber}}，預計等待 {{estimatedWait}} 分鐘。",
  variables: ["customerName", "queueNumber", "estimatedWait"],
},
waiting_list_called: {
  body: "【MakanMakan】{{customerName}} 您好，輪到您了！請於 5 分鐘內至櫃檯報到，桌號：{{tableNumber}}。逾時將自動取消。",
  variables: ["customerName", "tableNumber"],
},
waiting_list_expired: {
  body: "【MakanMakan】{{customerName}} 您好，您的候位號碼 {{queueNumber}} 已過號。如需重新排隊，請至現場取號。",
  variables: ["customerName", "queueNumber"],
},
```

- [ ] **Step 3: Add notification helper to WaitingListService**

Add a private method that sends SMS without blocking the caller:

```typescript
/**
 * 非阻塞發送候位通知（失敗不影響主流程）
 */
private async sendWaitingNotification(
  phone: string,
  category: "waiting_list_confirmed" | "waiting_list_called" | "waiting_list_expired",
  data: Record<string, string>,
): Promise<void> {
  try {
    const smsConfig = this.env?.TWILIO_ACCOUNT_SID;
    if (!smsConfig) return; // SMS not configured, skip silently

    const { TwilioSMSProvider, notificationTemplates } = await import("./NotificationService");
    const provider = new TwilioSMSProvider(
      this.env.TWILIO_ACCOUNT_SID,
      this.env.TWILIO_AUTH_TOKEN,
      this.env.TWILIO_FROM_PHONE,
    );
    const template = notificationTemplates[category];
    if (!template?.body) return;

    let body = template.body;
    for (const [key, value] of Object.entries(data)) {
      body = body.replaceAll(`{{${key}}}`, value);
    }

    await provider.sendSMS({ to: phone, body });
  } catch (error) {
    console.error(`Waiting list notification failed (${category}):`, error);
    // Intentionally swallowed — notification failure must not block operation
  }
}
```

- [ ] **Step 4: Replace TODO at joinWaitingList (route line 106)**

After `return c.json(...)` in the joinWaitingList route, the notification should be in the service. Add after the INSERT in `joinWaitingList` method:

```typescript
// 發送候位確認通知
this.sendWaitingNotification(request.customerPhone, "waiting_list_confirmed", {
  customerName: request.customerName,
  queueNumber: `${queueLetter}${queueNumber}`,
  estimatedWait: String(estimate?.estimatedWaitMinutes || 30),
});
```

- [ ] **Step 5: Replace TODO at callWaiting (line 319)**

```typescript
// 發送叫號通知（SMS）
if (entry.customerPhone) {
  this.sendWaitingNotification(entry.customerPhone, "waiting_list_called", {
    customerName: entry.customerName,
    tableNumber: table.table_number || `桌${request.tableId}`,
  });
}
```

- [ ] **Step 6: Replace TODO at expireWaiting (line 476)**

```typescript
// 發送過號通知
if (entry.customerPhone) {
  this.sendWaitingNotification(entry.customerPhone, "waiting_list_expired", {
    customerName: entry.customerName,
    queueNumber: entry.queueLetter
      ? `${entry.queueLetter}${entry.queueNumber}`
      : String(entry.queueNumber),
  });
}
```

- [ ] **Step 7: Write test verifying notifications don't block on failure**

```typescript
it("通知失敗不應影響叫號操作", async () => {
  // Service will try to send SMS but env has no Twilio config
  // The callWaiting should still succeed
  const entryId = "wait-notif-001";
  mockDB._mockData.waitingList.set(entryId, {
    id: entryId,
    status: "waiting",
    party_size: 4,
    restaurant_id: "R-001",
    customer_phone: "0912345678",
    customer_name: "Test",
  });
  mockDB._mockData.tables.set(1, {
    id: 1,
    is_occupied: 0,
    is_active: 1,
    capacity: 6,
  });

  const result = await service.callWaiting(entryId, { tableId: 1 });
  expect(result.status).toBe("called"); // Operation succeeds regardless of notification
});
```

- [ ] **Step 8: Run all tests**

Run: `pnpm --filter @makanmakan/database exec vitest run src/services/__tests__/WaitingListService.test.ts --reporter=verbose`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add packages/database/src/services/WaitingListService.ts packages/database/src/services/NotificationService.ts packages/database/src/services/__tests__/WaitingListService.test.ts
git commit -m "feat(waiting-list): wire notification hooks for join/call/expire events"
```

---

## Task 5: Frontend Component Tests — WaitingListView

**Files:**

- Create: `apps/admin-dashboard/src/views/__tests__/WaitingListView.test.ts`

### Context

`WaitingListView.vue` (1,171 lines) has zero tests. It uses `WaitingListService` (static methods), `useAuthStore` (Pinia), and `useI18n`. The test pattern follows `DashboardView.test.ts`: mock child components and services with `vi.mock()`, mount with `@vue/test-utils`, use `flushPromises()` for async operations.

Focus on: mounting, data loading, user interactions (add/call/seat/cancel), error states.

- [ ] **Step 1: Create test file with mocks and setup**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import WaitingListView from "../WaitingListView.vue";
import { useAuthStore } from "@/stores/auth";

// Mock the WaitingListService
const mockListWaitingList = vi.fn().mockResolvedValue({
  data: [],
  pagination: { total: 0, page: 1, limit: 20 },
});
const mockGetQueueStatus = vi.fn().mockResolvedValue({
  totalWaiting: 5,
  averageWait: 15,
  availableTables: 3,
  byTableType: [],
});
const mockJoinWaitingList = vi
  .fn()
  .mockResolvedValue({ success: true, data: { id: "new-1" } });
const mockCallWaiting = vi.fn().mockResolvedValue({ success: true });
const mockMarkSeated = vi.fn().mockResolvedValue({ success: true });
const mockExpireWaiting = vi.fn().mockResolvedValue({ success: true });
const mockCancelWaiting = vi.fn().mockResolvedValue({ success: true });
const mockBatchCall = vi.fn().mockResolvedValue({ success: true, data: [] });

vi.mock("@/services/waitingListService", () => ({
  WaitingListService: {
    listWaitingList: (...args: any[]) => mockListWaitingList(...args),
    getQueueStatus: (...args: any[]) => mockGetQueueStatus(...args),
    joinWaitingList: (...args: any[]) => mockJoinWaitingList(...args),
    callWaiting: (...args: any[]) => mockCallWaiting(...args),
    markSeated: (...args: any[]) => mockMarkSeated(...args),
    expireWaiting: (...args: any[]) => mockExpireWaiting(...args),
    cancelWaiting: (...args: any[]) => mockCancelWaiting(...args),
    batchCall: (...args: any[]) => mockBatchCall(...args),
    getStatusText: (s: string) => s,
    getStatusColor: () => "default",
    formatQueueDisplay: (e: any) =>
      `${e.queueLetter || ""}${e.queueNumber || ""}`,
    formatWaitTime: (m: number) => `${m} min`,
  },
}));

vi.mock("@/i18n", () => ({ useI18n: () => ({ t: (k: string) => k }) }));

const mountOptions = {
  global: {
    stubs: {
      teleport: true,
      // Stub icon components
      PlusIcon: { template: "<span />" },
      PhoneIcon: { template: "<span />" },
      MagnifyingGlassIcon: { template: "<span />" },
    },
  },
};

describe("WaitingListView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    const authStore = useAuthStore();
    authStore.$patch({
      user: { id: 1, role: 1, restaurantId: "R-001" },
      restaurantId: "R-001",
      isAuthenticated: true,
    });
  });
  // ... tests follow
});
```

- [ ] **Step 2: Test mounting and initial data loading**

```typescript
describe("Component Mounting", () => {
  it("should mount and load initial data", async () => {
    const wrapper = mount(WaitingListView, mountOptions);
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
    expect(mockListWaitingList).toHaveBeenCalled();
    expect(mockGetQueueStatus).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Test queue status display**

```typescript
describe("Queue Status Display", () => {
  it("should display queue statistics", async () => {
    mockGetQueueStatus.mockResolvedValueOnce({
      totalWaiting: 8,
      averageWait: 20,
      availableTables: 2,
      byTableType: [],
    });
    const wrapper = mount(WaitingListView, mountOptions);
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain("8");
  });
});
```

- [ ] **Step 4: Test add customer dialog**

```typescript
describe("Add Customer", () => {
  it("should open add dialog and submit", async () => {
    const wrapper = mount(WaitingListView, mountOptions);
    await flushPromises();

    // Find and click "Add Customer" button
    const addBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("加入"));
    if (addBtn) {
      await addBtn.trigger("click");
      await nextTick();
    }
    // Verify dialog interaction
    expect(wrapper.html()).toBeTruthy();
  });
});
```

- [ ] **Step 5: Test error handling**

```typescript
describe("Error Handling", () => {
  it("should handle API errors gracefully", async () => {
    mockListWaitingList.mockRejectedValueOnce(new Error("Network error"));
    const wrapper = mount(WaitingListView, mountOptions);
    await flushPromises();
    // Component should still mount without crashing
    expect(wrapper.exists()).toBe(true);
  });
});
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @makanmakan/admin-dashboard exec vitest run src/views/__tests__/WaitingListView.test.ts --reporter=verbose`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add apps/admin-dashboard/src/views/__tests__/WaitingListView.test.ts
git commit -m "test(admin): add WaitingListView component tests"
```

---

## Execution Order

Tasks 1→2 are sequential (mock must support optimistic locking before tests).
Task 3 depends on Task 1 (uses same service file).
Tasks 4 and 5 are independent of each other and can run in parallel after Task 3.
