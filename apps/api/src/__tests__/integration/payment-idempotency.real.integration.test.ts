import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { paymentTransactions } from "@makanmasak/database";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import { PaymentService } from "../../features/payments/services/PaymentService";

/**
 * The unit tests for the replay path run against a select mock, so they can
 * only show that no write was *issued*. "Exactly one transaction row exists"
 * is a statement about the database, and the partial unique index that backs
 * it only exists there — hence these.
 */
describe("payment idempotency replay", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  afterAll(async () => {
    await testApp?.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  const service = () => new PaymentService(testApp.env);

  const payment = (orderId: string) => ({
    orderId,
    paymentMode: "full" as const,
    amount: 120,
    expectedTotal: 120,
    method: "cash",
  });

  const recordedRows = (key: string) =>
    testApp.testDb.drizzle
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.idempotencyKey, key));

  it("returns the first result and writes no second row when a key is retried", async () => {
    const restaurant = await seed.restaurant();
    const order = await seed.order(restaurant.id);

    const first = await service().processPayment(payment(order.id), {
      idempotencyKey: "idem-real-1",
    });
    expect(first.status).toBe(200);

    // The order is `paid` by now, so a replay that ran after the payable-state
    // check would 409 instead of replaying. It has to short-circuit earlier.
    const replay = await service().processPayment(payment(order.id), {
      idempotencyKey: "idem-real-1",
    });

    expect(replay).toEqual(first);
    await expect(recordedRows("idem-real-1")).resolves.toHaveLength(1);
  });

  it("refuses a key already recorded against a different order", async () => {
    const restaurant = await seed.restaurant();
    const paid = await seed.order(restaurant.id);
    const unpaid = await seed.order(restaurant.id);

    await service().processPayment(payment(paid.id), {
      idempotencyKey: "idem-real-2",
    });

    await expect(
      service().processPayment(payment(unpaid.id), {
        idempotencyKey: "idem-real-2",
      }),
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_ORDER_MISMATCH",
      status: 422,
    });

    // The reused key must not settle the second order behind the caller's back,
    // and must not leave a partial row for it either.
    await expect(recordedRows("idem-real-2")).resolves.toHaveLength(1);
    await expect(
      testApp.testDb.drizzle
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.orderId, unpaid.id)),
    ).resolves.toEqual([]);
  });
});
