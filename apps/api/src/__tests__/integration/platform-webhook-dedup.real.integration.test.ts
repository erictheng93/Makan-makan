import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmasak/database/testing";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  orderItems,
  orders,
  platformMenuMappings,
  platformOrders,
  platformWebhookLogs,
} from "@makanmasak/database";
import type { Env } from "../../types/env";
import { PlatformOrderService } from "../../features/integrations/services/PlatformOrderService";
import { buildSeedHelpers, type SeedHelpers } from "./helpers/seed-helper";

/**
 * Issue #237: a redelivered platform notification used to write `orders` and
 * `order_items`, then collide with the unique index on the mapping row it
 * writes last. D1 has no rollback for that, so the order rows stayed behind
 * with nothing pointing at them.
 *
 * These run against a real migrated database because the defence is the
 * schema's — the partial unique index from
 * `0005_platform_webhook_event_dedup.sql` and the mapping index from the
 * baseline. Mocked query builders cannot reject anything.
 */

let testDb: TestDatabase;
let seed: SeedHelpers;

beforeAll(async () => {
  testDb = await createTestDatabase();
  seed = buildSeedHelpers(testDb);
}, 300_000);

afterAll(async () => {
  await testDb?.dispose();
});

beforeEach(async () => {
  await testDb.truncateAll();
});

function uberPayload(platformOrderId: string) {
  return {
    id: platformOrderId,
    store: { id: "store-1" },
    eater: { first_name: "Ari", phone: "0912345678" },
    delivery_info: { location: { address: "1 Main Street" } },
    cart: {
      items: [
        {
          id: "platform-item-1",
          title: "Laksa",
          quantity: 2,
          price: { unit_price: { amount: 550 } },
        },
      ],
    },
    payment: {
      charges: {
        total: { amount: 1325 },
        sub_total: { amount: 1250 },
        tax: { amount: 75 },
      },
    },
  };
}

async function orphanCount(restaurantId: string): Promise<number> {
  const rows = await testDb.drizzle
    .select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .leftJoin(platformOrders, eq(platformOrders.orderId, orders.id))
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        eq(orders.orderSource, "uber_eats"),
        isNull(platformOrders.id),
      ),
    );

  return Number(rows[0]?.count ?? 0);
}

describe("platform webhook deduplication", () => {
  async function setupRestaurant() {
    const restaurant = await seed.restaurant();
    const menuItem = await seed.menuItem(restaurant.id);

    await testDb.drizzle.insert(platformMenuMappings).values({
      restaurantId: restaurant.id,
      platform: "uber_eats",
      platformItemId: "platform-item-1",
      menuItemId: menuItem.id,
    });

    const env = {
      DB: testDb.bindings.DB,
      ENCRYPTION_KEY: "test-encryption-key",
    } as Env;

    return {
      restaurantId: restaurant.id,
      service: new PlatformOrderService(env),
    };
  }

  it("maps a redelivered platform order to the same internal order and leaves no orphan", async () => {
    const { restaurantId, service } = await setupRestaurant();

    const first = await service.processWebhook(
      "uber_eats",
      uberPayload("uber-order-1"),
      restaurantId,
    );
    const second = await service.processWebhook(
      "uber_eats",
      uberPayload("uber-order-1"),
      restaurantId,
    );

    expect(second).toBe(first);

    const orderRows = await testDb.drizzle
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.restaurantId, restaurantId));
    const mappingRows = await testDb.drizzle
      .select({ id: platformOrders.id })
      .from(platformOrders)
      .where(eq(platformOrders.restaurantId, restaurantId));
    const itemRows = await testDb.drizzle
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.orderId, first));

    expect(orderRows).toHaveLength(1);
    expect(mappingRows).toHaveLength(1);
    expect(itemRows).toHaveLength(1);
    expect(await orphanCount(restaurantId)).toBe(0);
  });

  it("keeps a single order when two deliveries of the same platform order race", async () => {
    const { restaurantId, service } = await setupRestaurant();

    const results = await Promise.all([
      service.processWebhook(
        "uber_eats",
        uberPayload("uber-order-race"),
        restaurantId,
      ),
      service.processWebhook(
        "uber_eats",
        uberPayload("uber-order-race"),
        restaurantId,
      ),
    ]);

    expect(results[0]).toBe(results[1]);

    const orderRows = await testDb.drizzle
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.restaurantId, restaurantId));

    expect(orderRows).toHaveLength(1);
    // The loser's batch is a transaction: its order and items never commit.
    expect(await orphanCount(restaurantId)).toBe(0);
  });

  it("rolls the order rows back when the mapping insert violates the unique index", async () => {
    const { restaurantId, service } = await setupRestaurant();

    const existingOrderId = await service.processWebhook(
      "uber_eats",
      uberPayload("uber-order-taken"),
      restaurantId,
    );

    // What the loser of a race issues: a fresh order plus a mapping row that
    // the index already holds. The point of the batch is that the first
    // statement does not survive the second one's rejection.
    const losingOrderId = "01900000-0000-7000-8000-000000000999";
    const now = new Date();

    await expect(
      testDb.drizzle.batch([
        testDb.drizzle.insert(orders).values({
          id: losingOrderId,
          restaurantId,
          orderNumber: "PL-loser",
          status: "pending",
          orderSource: "uber_eats",
          totalAmountCents: 1325,
          subtotalCents: 1250,
          taxAmountCents: 75,
          serviceChargeCents: 0,
          discountAmountCents: 0,
          createdAt: now,
          updatedAt: now,
        }),
        testDb.drizzle.insert(platformOrders).values({
          orderId: losingOrderId,
          restaurantId,
          platform: "uber_eats",
          platformOrderId: "uber-order-taken",
          platformStatus: "received",
          createdAt: now,
          updatedAt: now,
        }),
      ]),
    ).rejects.toThrow();

    const orderRows = await testDb.drizzle
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.restaurantId, restaurantId));

    expect(orderRows.map((row) => row.id)).toEqual([existingOrderId]);
    expect(await orphanCount(restaurantId)).toBe(0);
  });

  it("rejects a duplicate provider event id and still accepts logs without one", async () => {
    const reserve = (platformEventId: string | null) =>
      testDb.drizzle
        .insert(platformWebhookLogs)
        .values({
          platform: "uber_eats",
          eventType: "order.created",
          platformEventId,
          status: "received",
          createdAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: platformWebhookLogs.id });

    expect(await reserve("event-1")).toHaveLength(1);
    expect(await reserve("event-1")).toHaveLength(0);

    // The index is partial, so an absent provider event id never collides.
    expect(await reserve(null)).toHaveLength(1);
    expect(await reserve(null)).toHaveLength(1);
  });
});
