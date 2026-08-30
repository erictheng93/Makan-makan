import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmasak/database/testing";
import {
  categories,
  forecastCache,
  menuItems,
  orderItems,
  orders,
  restaurants,
} from "@makanmasak/database";
import { ForecastService } from "../../features/forecast/services/ForecastService";

/**
 * Real-D1 cover for the +08 business-day bucketing in `ForecastService`
 * (#268 item 3, fixed in d56302f9; this suite is #291).
 *
 * What it pins, in the words of the production symptom: an order taken between
 * 00:00 and 07:59 Taipei time belongs to *that* Taipei day and *that* Taipei
 * weekday, not to the previous UTC day. Bucketing it by UTC pours Sunday's
 * small hours into Saturday's forecast and starves Sunday's.
 *
 * Every fixture here is the same single order at 2026-01-11T17:00Z — Monday
 * 2026-01-12 01:00 in Taipei, Sunday 2026-01-11 in UTC. Each assertion below
 * flips if the SQL goes back to a bare `'unixepoch'`, so this replaces the
 * `ForecastService.toString()` string match that used to stand in for it.
 */

// SQLite does its own +8 arithmetic (packages/database/src/utils/sql-time.ts),
// but `generateForecast` still derives the weekday in JS from the target date.
// `new Date("2026-02-02").getDay()` is Monday at UTC and at +08 and *Sunday*
// west of Greenwich, so a suite running at UTC — which is what CI and Workers
// both do — cannot tell a host-independent implementation from a lucky one.
// Pinning a negative offset makes the host hostile on purpose. Node re-reads
// process.env.TZ on the next Date operation, so assigning it here is enough.
const originalTZ = process.env.TZ;

const RESTAURANT_ID = "forecast-tz-restaurant";
const MENU_ITEM_NAME = "Char Kway Teow";

/** 2026-01-11 17:00Z === Monday 2026-01-12 01:00 in Taipei. */
const ORDER_PLACED_AT = new Date("2026-01-11T17:00:00.000Z");
const TAIPEI_BUSINESS_DATE = "2026-01-12";
const UTC_DATE = "2026-01-11";
const ORDERED_QUANTITY = 7;

// Both targets sit inside the service's 28-day lookback from the seeded order
// (windows open 2026-01-05 and 2026-01-04 respectively), so only the weekday
// separates them.
const MONDAY_TARGET = "2026-02-02";
const SUNDAY_TARGET = "2026-02-01";

let testDb: TestDatabase;
let menuItemId: number;

beforeAll(async () => {
  process.env.TZ = "America/New_York";
  testDb = await createTestDatabase();
});

afterAll(async () => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
  await testDb?.dispose();
});

beforeEach(async () => {
  await testDb.truncateAll();
  const now = new Date("2026-02-10T00:00:00.000Z");

  await testDb.drizzle.insert(restaurants).values({
    id: RESTAURANT_ID,
    name: "Forecast Timezone Restaurant",
    type: "restaurant",
    category: "casual",
    address: "1 Forecast Road",
    district: "Central",
    city: "Taipei",
    phone: "0200000001",
    createdAt: now,
    updatedAt: now,
  });

  const [category] = await testDb.drizzle
    .insert(categories)
    .values({
      restaurantId: RESTAURANT_ID,
      name: "Mains",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [menuItem] = await testDb.drizzle
    .insert(menuItems)
    .values({
      restaurantId: RESTAURANT_ID,
      categoryId: category.id,
      name: MENU_ITEM_NAME,
      priceCents: 12000,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  menuItemId = menuItem.id;

  const [order] = await testDb.drizzle
    .insert(orders)
    .values({
      restaurantId: RESTAURANT_ID,
      orderNumber: "TZ-0001",
      status: "paid",
      createdAt: ORDER_PLACED_AT,
      updatedAt: ORDER_PLACED_AT,
    })
    .returning();

  await testDb.drizzle.insert(orderItems).values({
    orderId: order.id,
    menuItemId,
    quantity: ORDERED_QUANTITY,
    unitPriceCents: 12000,
    totalPriceCents: 12000 * ORDERED_QUANTITY,
    status: "pending",
    createdAt: ORDER_PLACED_AT,
    updatedAt: ORDER_PLACED_AT,
  });
});

function buildService(): ForecastService {
  return new ForecastService(testDb.bindings.DB, testDb.bindings.CACHE_KV);
}

describe("ForecastService business-day bucketing (real D1)", () => {
  it("counts a Taipei-Monday small-hours order towards a Monday forecast", async () => {
    const [forecast] = await buildService().generateForecast(RESTAURANT_ID, {
      startDate: MONDAY_TARGET,
      endDate: MONDAY_TARGET,
    });

    // One week of history, so the weighted average is just the quantity itself.
    expect(forecast.items).toEqual([
      expect.objectContaining({
        menuItemId,
        menuItemName: MENU_ITEM_NAME,
        predicted: ORDERED_QUANTITY,
        historicalAvg: ORDERED_QUANTITY,
      }),
    ]);
  });

  it("keeps that order out of the Sunday forecast it lands in under UTC", async () => {
    const [forecast] = await buildService().generateForecast(RESTAURANT_ID, {
      startDate: SUNDAY_TARGET,
      endDate: SUNDAY_TARGET,
    });

    expect(forecast.items).toEqual([]);
  });

  it("scores accuracy against the Taipei business date, not the UTC one", async () => {
    const predicted = 5;
    await testDb.drizzle.insert(forecastCache).values(
      [UTC_DATE, TAIPEI_BUSINESS_DATE].map((forecastDate) => ({
        restaurantId: RESTAURANT_ID,
        forecastDate,
        forecastType: "item_level",
        data: {
          [menuItemId]: { predicted, confidence: 0.9, trend: "stable" },
        },
        generatedBy: "statistical",
        createdAt: new Date("2026-01-10T00:00:00.000Z"),
      })),
    );
    const service = buildService();

    // A `ForecastAccuracyItem` carries no date, so the two days have to be
    // asked for one at a time: querying the pair back together would return
    // the same {0, 7} multiset whichever way round the buckets fell.
    await expect(
      service.getAccuracy(
        RESTAURANT_ID,
        TAIPEI_BUSINESS_DATE,
        TAIPEI_BUSINESS_DATE,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        menuItemId,
        predicted,
        actual: ORDERED_QUANTITY,
        // |7 - 5| / 5 * 100
        deviation: 40,
      }),
    ]);

    await expect(
      service.getAccuracy(RESTAURANT_ID, UTC_DATE, UTC_DATE),
    ).resolves.toEqual([
      expect.objectContaining({ menuItemId, predicted, actual: 0 }),
    ]);
  });
});
