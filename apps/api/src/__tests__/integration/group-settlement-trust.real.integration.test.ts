import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { groupOrders, splitBills } from "@makanmasak/database";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import { GroupOrdersService } from "../../features/group-orders/services/GroupOrdersService";

/**
 * `payment_status = 'paid'` cannot say whose word a settlement is. These walk
 * the real column through a real database, because the unit tests for this
 * path all run against a mock and would pass whatever value was written.
 */
describe("settlement trust level", () => {
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

  const service = () =>
    new GroupOrdersService(testApp.env.DB, testApp.env.CACHE_KV);

  async function tableWithSplitBill() {
    const restaurant = await seed.restaurant();
    const item = await seed.menuItem(restaurant.id, {
      name: "滷肉飯",
      isAvailable: true,
      priceCents: 10000,
    });
    const created = await service().createGroupOrder(
      { restaurantId: String(restaurant.id), hostName: "Alex" } as never,
      null,
    );
    if (!created.data) throw new Error(created.error);
    const groupOrderId = created.data.groupOrderId;
    const hostId = created.data.host.id;

    await service().addCartItem(groupOrderId, {
      memberId: hostId,
      menuItemId: Number(item.id),
      quantity: 1,
    } as never);
    await service().splitBill(groupOrderId, { splitType: "by_item" });

    return { groupOrderId, hostId };
  }

  const billFor = async (memberId: string) => {
    const [bill] = await testApp.testDb.drizzle
      .select()
      .from(splitBills)
      .where(eq(splitBills.memberId, memberId));
    return bill;
  };

  async function insertDuplicateSplitBill(
    groupOrderId: string,
    memberId: string,
    id: string,
    paymentStatus: "pending" | "paid",
    updatedAtMs: number,
  ) {
    await testApp.env.DB.prepare(
      `INSERT INTO split_bills
         (id, group_order_id, member_id, items, payment_status,
          created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, '[]', ?, ?, ?)`,
    )
      .bind(id, groupOrderId, memberId, paymentStatus, 1, updatedAtMs)
      .run();
  }

  async function runSplitBillMemberUniqueMigration() {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "../../packages/database/migrations_fresh/0006_split_bill_member_unique.sql",
      ),
      "utf8",
    );
    for (const statement of sql
      .split("--> statement-breakpoint")
      .map((value) => value.trim())
      .filter(Boolean)) {
      await testApp.env.DB.prepare(statement).run();
    }
  }

  it("leaves an unsettled share with no answer at all", async () => {
    const { hostId } = await tableWithSplitBill();

    const bill = await billFor(hostId);
    expect(bill.paymentStatus).toBe("pending");
    // Nobody has said anything yet, so there is nothing to record.
    expect(bill.settledBy).toBeNull();
  });

  it("finalizes into completed only after creating the member split bills", async () => {
    const restaurant = await seed.restaurant();
    const item = await seed.menuItem(restaurant.id, {
      name: "雞肉飯",
      isAvailable: true,
      priceCents: 12000,
    });
    const created = await service().createGroupOrder(
      { restaurantId: String(restaurant.id), hostName: "Alex" } as never,
      null,
    );
    if (!created.data) throw new Error(created.error);

    await service().addCartItem(created.data.groupOrderId, {
      memberId: created.data.host.id,
      menuItemId: Number(item.id),
      quantity: 1,
    } as never);

    const finalized = await service().finalizeGroupOrder(
      created.data.groupOrderId,
    );
    const summary = await service().getGroupOrder(created.data.groupOrderId);

    expect(finalized).toMatchObject({
      success: true,
      data: { status: "completed" },
    });
    expect(summary?.groupOrder.status).toBe("completed");
    expect(summary?.splitBills).toHaveLength(1);
    expect(summary?.splitBills[0]?.memberId).toBe(created.data.host.id);
  });

  it("charges exactly one selected bearer the recorded total during finalization recovery", async () => {
    const restaurant = await seed.restaurant();
    const item = await seed.menuItem(restaurant.id, {
      name: "紅燒牛肉麵",
      isAvailable: true,
      priceCents: 12500,
    });
    const created = await service().createGroupOrder(
      { restaurantId: String(restaurant.id), hostName: "Alex" } as never,
      null,
    );
    if (!created.data) throw new Error(created.error);

    const { groupOrderId, host } = created.data;
    await service().addCartItem(groupOrderId, {
      memberId: host.id,
      menuItemId: Number(item.id),
      quantity: 1,
    } as never);
    await testApp.testDb.drizzle
      .update(groupOrders)
      .set({
        status: "finalizing_failed",
        masterOrderId: "order-already-created",
        settings: {
          finalizeFailure: {
            code: "SPLIT_TOTAL_MISMATCH",
            masterOrderId: "order-already-created",
            orderTotalCents: 12500,
            serviceChargeCents: 0,
            taxAmountCents: 0,
            expectedTotalCents: 12500,
            roundedTotalCents: 0,
            splitError: "Split total does not match order total",
            failedAt: "2026-08-23T00:00:00.000Z",
          },
        },
      })
      .where(eq(groupOrders.id, groupOrderId));

    await expect(
      service().recoverFinalization(groupOrderId, { bearerMemberId: host.id }),
    ).resolves.toMatchObject({
      success: true,
      data: { status: "checkout" },
    });

    const bills = await testApp.testDb.drizzle
      .select()
      .from(splitBills)
      .where(eq(splitBills.groupOrderId, groupOrderId));
    expect(bills).toHaveLength(1);
    expect(bills[0]).toMatchObject({
      memberId: host.id,
      totalAmountCents: 12500,
    });
  });

  it("rejects a second split bill for the same group member at the database boundary", async () => {
    const { groupOrderId, hostId } = await tableWithSplitBill();

    await expect(
      insertDuplicateSplitBill(
        groupOrderId,
        hostId,
        "duplicate-split-bill",
        "pending",
        2,
      ),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it("migration cleanup keeps a paid bill over a newer unpaid duplicate", async () => {
    const { groupOrderId, hostId } = await tableWithSplitBill();
    const paidBill = await billFor(hostId);
    let migrationApplied = false;

    try {
      await testApp.env.DB.prepare(
        "DROP INDEX idx_split_bills_group_order_member_unique",
      ).run();
      await testApp.env.DB.prepare(
        "UPDATE split_bills SET payment_status = 'paid', updated_at_ms = 10 WHERE id = ?",
      )
        .bind(paidBill.id)
        .run();
      await insertDuplicateSplitBill(
        groupOrderId,
        hostId,
        "newer-pending-split-bill",
        "pending",
        20,
      );

      await runSplitBillMemberUniqueMigration();
      migrationApplied = true;

      const bills = await testApp.testDb.drizzle
        .select()
        .from(splitBills)
        .where(eq(splitBills.groupOrderId, groupOrderId));
      expect(bills).toHaveLength(1);
      expect(bills[0]).toMatchObject({
        id: paidBill.id,
        paymentStatus: "paid",
      });

      await expect(
        insertDuplicateSplitBill(
          groupOrderId,
          hostId,
          "rejected-after-cleanup",
          "pending",
          30,
        ),
      ).rejects.toThrow(/UNIQUE constraint failed/);
    } finally {
      if (!migrationApplied) {
        try {
          await testApp.env.DB.prepare(
            "DELETE FROM split_bills WHERE id = 'newer-pending-split-bill'",
          ).run();
          await testApp.env.DB.prepare(
            "CREATE UNIQUE INDEX idx_split_bills_group_order_member_unique ON split_bills (group_order_id, member_id)",
          ).run();
        } catch {
          // The preceding failure is the meaningful test result; a best-effort
          // restoration failure must not replace it.
        }
      }
    }
  });

  it("records a diner's own settlement as their word, not the restaurant's", async () => {
    const { groupOrderId, hostId } = await tableWithSplitBill();

    const result = await service().processPayment(
      groupOrderId,
      hostId,
      { paymentMethod: "cash" } as never,
      "self",
    );
    expect(result.success).toBe(true);

    const bill = await billFor(hostId);
    expect(bill.paymentStatus).toBe("paid");
    expect(bill.settledBy).toBe("self");
  });

  // The trust level is an argument precisely so a future staff or provider
  // path can record something a report is allowed to believe.
  it("can record a confirmation that revenue may count", async () => {
    const { groupOrderId, hostId } = await tableWithSplitBill();

    await service().processPayment(
      groupOrderId,
      hostId,
      { paymentMethod: "card" } as never,
      "provider",
    );

    expect((await billFor(hostId)).settledBy).toBe("provider");
  });

  it("carries the trust level out on the group summary", async () => {
    const { groupOrderId, hostId } = await tableWithSplitBill();
    await service().processPayment(
      groupOrderId,
      hostId,
      { paymentMethod: "cash" } as never,
      "self",
    );

    const summary = await service().getGroupOrder(groupOrderId);

    expect(summary?.splitBills).toHaveLength(1);
    expect(summary?.splitBills[0]).toMatchObject({
      memberId: hostId,
      paymentStatus: "paid",
      settledBy: "self",
    });
  });
});
