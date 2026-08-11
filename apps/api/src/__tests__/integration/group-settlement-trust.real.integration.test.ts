import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { splitBills } from "@makanmasak/database";
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

  it("leaves an unsettled share with no answer at all", async () => {
    const { hostId } = await tableWithSplitBill();

    const bill = await billFor(hostId);
    expect(bill.paymentStatus).toBe("pending");
    // Nobody has said anything yet, so there is nothing to record.
    expect(bill.settledBy).toBeNull();
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
