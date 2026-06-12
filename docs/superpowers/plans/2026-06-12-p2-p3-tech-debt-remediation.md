# P2/P3 Tech Debt Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace silent stubs, fake operational data, mislabeled exports, weak generated IDs, and non-atomic money writes with real, test-covered behavior.

**Architecture:** Split the work into independently shippable tracks. Reservation notifications and printer/export/ID cleanup are package-level fixes; money-path atomicity is D1-bound service work; monitoring and backup cron are regression-guard tracks because the current code already appears partially fixed.

**Tech Stack:** TypeScript, Vitest, Cloudflare Workers, D1, Drizzle ORM, Hono, `crypto.randomUUID()`, existing notification/broadcast services.

---

## Current Verification Notes

- `packages/database/src/services/ReservationService.ts` still has silent comment stubs in `confirmReservation`, `cancelReservation`, and `markNoShow`.
- `packages/database/src/services/PrinterService.ts` still returns fabricated stats: `averageJobTime: 8000`, `paperUsage: 0`, and `busyHours: []`.
- `packages/database/src/services/ExportService.ts` still returns CSV bytes with an `.xlsx` filename and Excel MIME type.
- `apps/api/src/features/qr-codes/services/QrCodesService.ts`, `apps/api/src/services/qrCodeService.ts`, `packages/database/src/services/qrcode.ts`, and several POS/receipt/refund paths still use `Math.random()` for persisted/public IDs or business numbers.
- `packages/database/src/services/order.ts` and `packages/database/src/services/order.test.ts` currently have unrelated uncommitted local changes that already move `createOrder` toward `db.batch`. Do not overwrite them.
- `apps/api/src/features/system/routes/index.ts` now has a real D1/KV health check for `/health`; `apps/api/src/features/monitoring/services/MonitoringService.ts` now calculates uptime from isolate start time. Treat these as regression-guard work.
- `apps/backup-scheduler/wrangler.toml` and `apps/api/src/workers/backup-scheduler.ts` currently both use `"0 0 * * SUN"`. Treat this as regression-guard work.

## File Map

- Modify `packages/database/src/services/ReservationService.ts`: invoke real reservation notifications after confirmed/cancelled/no-show state changes.
- Modify or create `packages/database/src/services/ReservationNotificationService.ts`: small service that dispatches reservation email/SMS through the existing `NotificationService`.
- Modify `packages/database/src/services/__tests__/ReservationService.real.test.ts`: regression coverage for notification dispatch and non-blocking failure behavior.
- Modify `packages/database/src/services/PrinterService.ts`: derive stats from queue/device state without fabricated constants.
- Add or modify `packages/database/src/services/PrinterService.test.ts`: stats coverage.
- Modify `packages/database/src/services/ExportService.ts`: either return CSV for Excel-compatible output or implement a real XLSX generator.
- Add or modify `packages/database/src/services/ExportService.test.ts`: content-type and magic-byte coverage.
- Modify `apps/api/src/features/qr-codes/services/QrCodesService.ts`, `apps/api/src/services/qrCodeService.ts`, `packages/database/src/services/qrcode.ts`, POS receipt/refund services, and receipt formatter files: replace production `Math.random()` IDs with UUID/CUID or deterministic business-number helpers.
- Add `packages/database/src/services/id-generation.ts`: shared helpers for prefixed IDs and business numbers.
- Modify money-path services only after reconciling current local changes: `packages/database/src/services/order.ts`, `packages/database/src/services/POSService.ts`, `apps/api/src/features/payments/services/refundPayment.ts`, `apps/api/src/features/payments/services/PaymentService.ts`, `apps/api/src/features/pos/services/RefundService.ts`.
- Modify related tests in `packages/database/src/services/order.test.ts`, POS service tests, and payment/refund service tests.
- Add or modify `apps/api/src/features/system/routes/index.test.ts` and `apps/api/src/features/monitoring/services/MonitoringService.test.ts`: prove health data comes from checks/state, not random constants.
- Add `apps/api/src/workers/backup-scheduler.test.ts`: cron literal dispatch coverage.

---

### Task 1: Reservation Confirm/Cancel/No-Show Notifications

**Files:**
- Create: `packages/database/src/services/ReservationNotificationService.ts`
- Modify: `packages/database/src/services/ReservationService.ts`
- Modify: `packages/database/src/services/NotificationService.ts`
- Test: `packages/database/src/services/__tests__/ReservationService.real.test.ts`

- [ ] **Step 1: Write failing notification tests**

Add tests that inject a notification dispatcher and assert confirmed/cancelled/no-show events are attempted after persistence.

```ts
it("dispatches a confirmation notification after confirming a reservation", async () => {
  const sent: unknown[] = [];
  const service = new ReservationService(testDb.bindings.DB, {
    reservationNotifier: {
      send: async (event) => sent.push(event),
    },
  } as never);

  await seedReservation(testDb, "rsv-confirm", {
    reservationDate: "2026-07-01",
    reservationTime: "18:30",
  });

  await service.confirmReservation("rsv-confirm");

  expect(sent).toEqual([
    expect.objectContaining({
      type: "confirmed",
      reservationId: "rsv-confirm",
      reservationDate: "2026-07-01",
      reservationTime: "18:30",
    }),
  ]);
});

it("does not roll back cancellation when notification dispatch fails", async () => {
  const service = new ReservationService(testDb.bindings.DB, {
    reservationNotifier: {
      send: async () => {
        throw new Error("provider down");
      },
    },
  } as never);

  await seedReservation(testDb, "rsv-cancel");

  await expect(service.cancelReservation("rsv-cancel", "guest request"))
    .resolves.toMatchObject({ id: "rsv-cancel", status: "cancelled" });
});
```

- [ ] **Step 2: Run tests to verify red**

Run: `rtk pnpm --filter @makanmakan/database test:run -- ReservationService.real.test.ts`

Expected: the new tests fail because `ReservationService` does not accept or call a notifier.

- [ ] **Step 3: Add the notification contract and service**

Create `ReservationNotificationService.ts` with a narrow interface.

```ts
import type { D1Database } from "@cloudflare/workers-types";
import {
  NotificationService,
  type NotificationCategory,
  type NotificationType,
} from "./NotificationService";
import type { ReservationResponse } from "./ReservationService";

export type ReservationNotificationType = "confirmed" | "cancelled" | "no_show";

export interface ReservationNotificationEvent {
  type: ReservationNotificationType;
  reservationId: string;
  restaurantId: string;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  reservationDate: string;
  reservationTime: string;
  reason?: string;
}

export interface ReservationNotifier {
  send(event: ReservationNotificationEvent): Promise<void>;
}

export class ReservationNotificationService implements ReservationNotifier {
  constructor(
    private readonly d1: D1Database,
    private readonly env?: Record<string, unknown>,
  ) {}

  async send(event: ReservationNotificationEvent): Promise<void> {
    const notificationType = chooseNotificationType(event);
    if (!notificationType) return;

    const result = await new NotificationService(this.d1, this.env).sendNotification({
      recipientId: numericRecipientId(event.customerId),
      recipientEmail: event.customerEmail ?? undefined,
      recipientPhone: event.customerPhone ?? undefined,
      category: reservationCategory(event.type),
      type: notificationType,
      data: {
        customerName: event.customerName,
        reservationDate: event.reservationDate,
        reservationTime: event.reservationTime,
        reason: event.reason ?? "",
      },
      priority: "normal",
    });

    if (!result.success) {
      throw new Error(result.errors.join("; "));
    }
  }
}

function chooseNotificationType(
  event: ReservationNotificationEvent,
): NotificationType | null {
  if (event.customerEmail) return "email";
  if (event.customerPhone) return "sms";
  return null;
}

function numericRecipientId(customerId?: string | null): number {
  const parsed = Number(customerId);
  return Number.isFinite(parsed) ? parsed : 0;
}

function reservationCategory(
  type: ReservationNotificationType,
): NotificationCategory {
  if (type === "confirmed") return "reservation_confirmed";
  if (type === "cancelled") return "reservation_cancelled";
  return "reservation_no_show";
}
```

- [ ] **Step 3a: Add reservation notification categories**

Extend `NotificationCategory` in `NotificationService.ts`.

```ts
export type NotificationCategory =
  | "leave_request_submitted"
  | "leave_request_approved"
  | "leave_request_rejected"
  | "leave_request_cancelled"
  | "schedule_created"
  | "schedule_updated"
  | "schedule_cancelled"
  | "swap_request_created"
  | "swap_request_accepted"
  | "swap_request_approved"
  | "swap_request_rejected"
  | "shift_reminder"
  | "waiting_list_confirmed"
  | "waiting_list_called"
  | "waiting_list_expired"
  | "reservation_confirmed"
  | "reservation_cancelled"
  | "reservation_no_show"
  | "password_reset_request"
  | "password_reset_success"
  | "email_verification"
  | "email_verification_success"
  | "phone_verification"
  | "phone_verification_success";
```

Add templates:

```ts
reservation_confirmed: {
  subject: "Reservation confirmed",
  body: "Hi {{customerName}}, your reservation for {{reservationDate}} at {{reservationTime}} is confirmed.",
  variables: ["customerName", "reservationDate", "reservationTime"],
},
reservation_cancelled: {
  subject: "Reservation cancelled",
  body: "Hi {{customerName}}, your reservation for {{reservationDate}} at {{reservationTime}} was cancelled. {{reason}}",
  variables: ["customerName", "reservationDate", "reservationTime", "reason"],
},
reservation_no_show: {
  subject: "Reservation no-show recorded",
  body: "Hi {{customerName}}, your reservation for {{reservationDate}} at {{reservationTime}} was marked as no-show.",
  variables: ["customerName", "reservationDate", "reservationTime"],
},
```

- [ ] **Step 4: Wire `ReservationService`**

Add an optional notifier dependency, defaulting to `ReservationNotificationService`, then call it after each successful state transition. Swallow and log notification failures.

```ts
private async notifyReservation(
  type: ReservationNotificationType,
  reservation: ReservationResponse,
  reason?: string,
): Promise<void> {
  try {
    await this.reservationNotifier.send({
      type,
      reservationId: reservation.id,
      restaurantId: reservation.restaurantId,
      customerId: reservation.customerId,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      customerEmail: reservation.customerEmail,
      reservationDate: reservation.reservationDate,
      reservationTime: reservation.reservationTime,
      reason,
    });
  } catch (error) {
    console.error("Reservation notification failed:", error);
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run:
- `rtk pnpm --filter @makanmakan/database test:run -- ReservationService.real.test.ts`
- `rtk pnpm --filter @makanmakan/database typecheck`

Commit:

```bash
rtk git add packages/database/src/services/ReservationNotificationService.ts packages/database/src/services/ReservationService.ts packages/database/src/services/__tests__/ReservationService.real.test.ts
rtk git commit -m "fix(reservations): dispatch reservation status notifications"
```

---

### Task 2: Printer Stats and Export MIME Correctness

**Files:**
- Modify: `packages/database/src/services/PrinterService.ts`
- Modify: `packages/database/src/services/ExportService.ts`
- Test: `packages/database/src/services/PrinterService.test.ts`
- Test: `packages/database/src/services/ExportService.test.ts`

- [ ] **Step 1: Write failing printer stats tests**

```ts
it("returns zeroed printer uptime and error rate when there are no devices or jobs", () => {
  const service = createPrinterServiceWithQueueStats({
    total: 0,
    completed: 0,
    failed: 0,
  });

  expect(service.getStatistics()).toMatchObject({
    averageJobTime: 0,
    paperUsage: 0,
    deviceUptime: 0,
    errorRate: 0,
    busyHours: [],
  });
});
```

- [ ] **Step 2: Write failing export test**

```ts
it("does not label CSV bytes as XLSX", () => {
  const service = new ExportService(testDb.bindings.DB);

  const result = service.exportRecordsForTest(
    [{ name: "Nasi Lemak", total: 10 }],
    "xlsx",
    "orders",
  );

  expect(result.success).toBe(true);
  expect(result.filename).toMatch(/\.csv$/);
  expect(result.mimeType).toBe("text/csv;charset=utf-8");
});
```

If there is no test seam for `generateExcel`, add one minimal public wrapper only if the repo already uses that pattern; otherwise test the public export route/service method that reaches it.

- [ ] **Step 3: Run tests to verify red**

Run:
- `rtk pnpm --filter @makanmakan/database test:run -- PrinterService ExportService`

Expected: tests fail on current fabricated stats and `.xlsx` relabeling.

- [ ] **Step 4: Implement derived stats cleanup**

Replace fabricated calculations with safe derived values.

```ts
const totalJobs = queueStats.total;
const failedJobs = queueStats.failed;
const completedJobs = queueStats.completed;
const onlineDevices = devices.filter((d) => d.status === "online").length;

return {
  totalJobs,
  completedJobs,
  failedJobs,
      averageJobTime: queueStats.averageProcessingTime ?? 0,
      paperUsage: queueStats.paperUsage ?? 0,
  deviceUptime: devices.length === 0 ? 0 : (onlineDevices / devices.length) * 100,
  errorRate: totalJobs === 0 ? 0 : (failedJobs / totalJobs) * 100,
  busyHours: queueStats.busyHours ?? [],
};
```

If `PrintQueue.getStatistics()` does not expose `averageProcessingTime`, `paperUsage`, or `busyHours`, add those fields there with zero defaults and update this service to consume them directly.

- [ ] **Step 5: Implement honest export behavior**

Conservative option: keep CSV bytes and CSV MIME when XLSX is requested.

```ts
private generateExcel(records: any[], filename: string): ExportResult {
  const result = this.generateCSV(records, filename);
  if (result.success) {
    result.filename = result.filename.replace(".xlsx", ".csv");
    result.mimeType = "text/csv;charset=utf-8";
  }
  return result;
}
```

If product requires real XLSX, add a package dependency and assert the ZIP magic bytes `PK` in the test.

- [ ] **Step 6: Run tests and commit**

Run:
- `rtk pnpm --filter @makanmakan/database test:run -- PrinterService ExportService`
- `rtk pnpm --filter @makanmakan/database typecheck`

Commit:

```bash
rtk git add packages/database/src/services/PrinterService.ts packages/database/src/services/ExportService.ts packages/database/src/services/PrinterService.test.ts packages/database/src/services/ExportService.test.ts
rtk git commit -m "fix(database): remove fabricated printer and export metadata"
```

---

### Task 3: Replace Production `Math.random()` IDs

**Files:**
- Create: `packages/database/src/services/id-generation.ts`
- Modify: `apps/api/src/features/qr-codes/services/QrCodesService.ts`
- Modify: `apps/api/src/services/qrCodeService.ts`
- Modify: `packages/database/src/services/qrcode.ts`
- Modify: `packages/database/src/services/POSService.ts`
- Modify: `apps/api/src/features/pos/services/ReceiptService.ts`
- Modify: `apps/api/src/features/pos/services/RefundService.ts`
- Modify: `packages/database/src/services/printer/ReceiptFormatter.ts`

- [ ] **Step 1: Write failing ID tests**

```ts
it("uses crypto-generated QR entity ids instead of Math.random fallbacks", async () => {
  const randomSpy = vi.spyOn(Math, "random");
  vi.spyOn(crypto, "randomUUID").mockReturnValue(
    "11111111-1111-4111-8111-111111111111",
  );

  const result = await createQrCodesService().generateQRCode(input, user);

  expect(result.data.id).toBe("qr_11111111-1111-4111-8111-111111111111");
  expect(randomSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Add shared helpers**

```ts
export function prefixedUuid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function businessNumber(prefix: string, now = Date.now()): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${prefix}${now}-${suffix}`;
}
```

- [ ] **Step 3: Replace persisted/public ID call sites**

Examples:

```ts
const batchId = prefixedUuid("batch");
const receiptNumber = businessNumber("R");
const refundNumber = businessNumber("RF");
```

Keep non-security sampling uses of `Math.random()` in monitoring/performance utilities only when they are explicitly sampling, not generating identifiers.

- [ ] **Step 4: Run tests and commit**

Run:
- `rtk pnpm --filter @makanmakan/database test:run -- qrcode POSService ReceiptFormatter`
- `rtk pnpm --filter @makanmakan/api test -- QrCodesService ReceiptService RefundService`
- `rtk pnpm --filter @makanmakan/database typecheck`
- `rtk pnpm --filter @makanmakan/api typecheck`

Commit:

```bash
rtk git add packages/database/src/services/id-generation.ts apps/api/src/features/qr-codes/services/QrCodesService.ts apps/api/src/services/qrCodeService.ts packages/database/src/services/qrcode.ts packages/database/src/services/POSService.ts apps/api/src/features/pos/services/ReceiptService.ts apps/api/src/features/pos/services/RefundService.ts packages/database/src/services/printer/ReceiptFormatter.ts
rtk git commit -m "fix(ids): replace random production identifiers"
```

---

### Task 4: D1 Batch Atomicity for Money Paths

**Files:**
- Modify: `packages/database/src/services/order.ts`
- Modify: `packages/database/src/services/POSService.ts`
- Modify: `apps/api/src/features/payments/services/refundPayment.ts`
- Modify: `apps/api/src/features/payments/services/PaymentService.ts`
- Modify: `apps/api/src/features/pos/services/RefundService.ts`
- Test: `packages/database/src/services/order.test.ts`
- Test: payment/POS service tests near the modified services

- [ ] **Step 1: Reconcile active local changes first**

Before editing, inspect the current uncommitted diff:

```bash
rtk git diff -- packages/database/src/services/order.ts packages/database/src/services/order.test.ts
```

If the diff already passes tests, preserve it and build the remaining money-path work on top. Do not rewrite it.

- [ ] **Step 2: Write atomicity failure tests for each money workflow**

For each workflow, inject a failing D1 statement and assert no partial ledger, refund, receipt, inventory, coupon, or cash movement state remains. Use the failure-injection wrapper already present in the current local `order.test.ts` diff.

```ts
it("does not leave partial refund writes when audit append fails", async () => {
  const env = createEnvWithFailure((sqlText) =>
    /insert into\s+payment_audit_log/i.test(sqlText),
  );

  await expect(refundPayment(env, refundInput)).rejects.toThrow();

  await expect(selectRefundRows(env.DB)).resolves.toEqual([]);
  await expect(selectPaymentTransaction(env.DB, input.transactionId))
    .resolves.toMatchObject({ status: "paid" });
});
```

- [ ] **Step 3: Replace interactive transactions and sequential writes**

Use D1 native batch for Worker/D1 paths.

```ts
await env.DB.batch([
  env.DB.prepare("UPDATE orders SET payment_status = ?, refund_amount = ? WHERE id = ?")
    .bind(paymentStatus, nextRefundTotal, orderId),
  env.DB.prepare("UPDATE payment_transactions SET status = ?, updated_at_ms = ? WHERE transaction_id = ?")
    .bind(paymentStatus, now, transactionId),
  env.DB.prepare(
    `INSERT INTO refund_transactions (
        refund_id, payment_transaction_id, order_id, restaurant_id,
        amount_cents, reason, status, created_at_ms, updated_at_ms,
        completed_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
  ).bind(
    refundId,
    transactionId,
    orderId,
    restaurantId,
    refundAmountCents,
    reason,
    now,
    now,
    now,
  ),
  env.DB.prepare(
    `INSERT INTO payment_audit_log (
        id, restaurant_id, payment_transaction_id, event_type, provider,
        amount_cents, raw_payload, occurred_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    auditId,
    restaurantId,
    transactionId,
    PAYMENT_AUDIT_EVENT_TYPES.REFUND,
    provider,
    refundAmountCents,
    JSON.stringify({ refundId, orderId }),
    now,
  ),
]);
```

For Drizzle D1 services, follow the current `OrderService.createOrder` pattern: build a non-empty `BatchItem<"sqlite">[]`, cast it to Drizzle's non-empty batch tuple type at the call site, and call `this.db.batch`.

- [ ] **Step 4: Run focused money-path tests**

Run:
- `rtk pnpm --filter @makanmakan/database test:run -- order.test.ts POSService`
- `rtk pnpm --filter @makanmakan/api test -- refundPayment PaymentService RefundService`
- `rtk pnpm --filter @makanmakan/database typecheck`
- `rtk pnpm --filter @makanmakan/api typecheck`

- [ ] **Step 5: Commit**

```bash
rtk git add packages/database/src/services/order.ts packages/database/src/services/order.test.ts packages/database/src/services/POSService.ts apps/api/src/features/payments/services/refundPayment.ts apps/api/src/features/payments/services/PaymentService.ts apps/api/src/features/pos/services/RefundService.ts
rtk git commit -m "fix(payments): make money writes atomic on D1"
```

---

### Task 5: Monitoring and Health Regression Guards

**Files:**
- Modify or add: `apps/api/src/features/system/routes/index.test.ts`
- Modify: `apps/api/src/features/monitoring/services/MonitoringService.test.ts`

- [ ] **Step 1: Add a no-random health route test**

```ts
it("derives health from D1 and KV checks instead of fabricated random values", async () => {
  const randomSpy = vi.spyOn(Math, "random");

  const response = await app.request("/api/v1/system/health", {}, testEnv);
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.services).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "database", status: "healthy" }),
      expect.objectContaining({ name: "kv_storage", status: "healthy" }),
    ]),
  );
  expect(randomSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Add monitoring uptime regression test**

```ts
it("reports isolate uptime based on service start time", async () => {
  vi.setSystemTime(1_000);
  const service = new MonitoringService(kv);

  vi.setSystemTime(6_000);
  const health = await service.getHealthStatus();

  expect(health.uptime).toBe(5_000);
});
```

- [ ] **Step 3: Run tests and commit**

Run:
- `rtk pnpm --filter @makanmakan/api test -- system/routes monitoring/services/MonitoringService`
- `rtk pnpm --filter @makanmakan/api typecheck`

Commit:

```bash
rtk git add apps/api/src/features/system/routes/index.test.ts apps/api/src/features/monitoring/services/MonitoringService.test.ts
rtk git commit -m "test(monitoring): guard health endpoints against fabricated data"
```

---

### Task 6: Backup Scheduler Cron Regression Guard

**Files:**
- Create: `apps/api/src/workers/backup-scheduler.test.ts`
- Modify only if failing: `apps/api/src/workers/backup-scheduler.ts` or `apps/backup-scheduler/wrangler.toml`

- [ ] **Step 1: Write cron dispatch tests**

```ts
it("handles the weekly report cron literal configured in wrangler.toml", async () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

  await worker.scheduled(
    { cron: "0 0 * * SUN" } as ScheduledEvent,
    createBackupEnv(),
    createExecutionContext(),
  );

  expect(logSpy).not.toHaveBeenCalledWith(
    expect.stringContaining("Unknown cron trigger"),
  );
});
```

- [ ] **Step 2: Run test to verify current state**

Run: `rtk pnpm --filter @makanmakan/api test -- backup-scheduler`

Expected current result: pass, because code and wrangler config both use `"0 0 * * SUN"`. If it fails, make the switch case match the exact configured cron literal.

- [ ] **Step 3: Commit**

```bash
rtk git add apps/api/src/workers/backup-scheduler.test.ts apps/api/src/workers/backup-scheduler.ts apps/backup-scheduler/wrangler.toml
rtk git commit -m "test(backups): guard weekly cron trigger dispatch"
```

---

## Final Verification

Run the focused checks from each task, then run:

```bash
rtk pnpm lint
rtk pnpm typecheck
rtk pnpm test
```

If the full suite is too slow or blocked by unrelated failures, record the exact focused commands that passed and the exact unrelated failures. Do not claim global green without a fresh successful full run.

## Execution Order

1. Task 6 first if a quick low-risk win is desired.
2. Task 5 next because the code appears fixed and needs tests.
3. Task 2 for user-visible correctness.
4. Task 3 for production ID hygiene.
5. Task 1 for customer-facing reservation behavior.
6. Task 4 last because it touches money paths and there are already active local changes in `order.ts`.
