import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmasak/database/testing";
import {
  MODULES,
  PLAN_DEFAULT_MODULES,
  restaurants,
  shopSubscriptions,
} from "@makanmasak/database";
import { SubscriptionService } from "../../features/subscriptions/services/SubscriptionService";

let testDb: TestDatabase;
let service: SubscriptionService;

async function seedRestaurant(id = "restaurant-1") {
  await testDb.drizzle.insert(restaurants).values({
    id,
    name: "Subscription Test Restaurant",
    type: "street_food",
    category: "snack",
    address: "1 Test Rd",
    district: "West",
    phone: "0900000000",
  });
}

async function readSubscription(restaurantId = "restaurant-1") {
  const [row] = await testDb.drizzle
    .select()
    .from(shopSubscriptions)
    .where(eq(shopSubscriptions.restaurantId, restaurantId))
    .limit(1);
  return row ?? null;
}

describe("SubscriptionService", () => {
  beforeAll(async () => {
    testDb = await createTestDatabase();
  });

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T12:00:00.000Z"));
    await testDb.truncateAll();
    service = new SubscriptionService(testDb.bindings.DB);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates and reads a subscription for a restaurant", async () => {
    await seedRestaurant();

    const created = await service.create({
      restaurantId: "restaurant-1",
      planTier: "pro",
      trialEndsAt: new Date("2026-06-21T00:00:00.000Z"),
      billingCycleStartAt: new Date("2026-06-01T00:00:00.000Z"),
      billingCycleEndAt: new Date("2026-07-01T00:00:00.000Z"),
      notes: "pilot",
    });
    const fetched = await service.getByRestaurantId("restaurant-1");

    expect(created).toMatchObject({
      restaurantId: "restaurant-1",
      planTier: "pro",
      moduleOverrides: {},
      isActive: true,
      notes: "pilot",
    });
    expect(created.trialEndsAt).toEqual(new Date("2026-06-21T00:00:00.000Z"));
    expect(fetched).toEqual(created);
  });

  it("rejects duplicate subscriptions for the same restaurant", async () => {
    await seedRestaurant();
    await service.create({
      restaurantId: "restaurant-1",
      planTier: "basic",
    });

    await expect(
      service.create({
        restaurantId: "restaurant-1",
        planTier: "pro",
      }),
    ).rejects.toMatchObject({
      code: "SUBSCRIPTION_EXISTS",
      status: 409,
    });
  });

  it("provisions a trial subscription once with a configurable trial window", async () => {
    await seedRestaurant();

    const created = await service.provisionDefaultForRestaurant({
      restaurantId: "restaurant-1",
      trialDays: 7,
    });
    const second = await service.provisionDefaultForRestaurant({
      restaurantId: "restaurant-1",
      trialDays: 14,
    });

    expect(created).toMatchObject({
      restaurantId: "restaurant-1",
      planTier: "trial",
      isActive: true,
      notes: "auto-provisioned during restaurant onboarding",
    });
    expect(created.trialEndsAt).toEqual(new Date("2026-06-14T12:00:00.000Z"));
    expect(second).toEqual(created);
    expect(await testDb.drizzle.select().from(shopSubscriptions)).toHaveLength(
      1,
    );
  });

  it("removes a null override and restores the plan default", async () => {
    await seedRestaurant();
    await service.create({
      restaurantId: "restaurant-1",
      planTier: "basic",
    });

    const enabled = await service.updateModules("restaurant-1", {
      overrides: { [MODULES.ONLINE_ORDERING]: true },
    });
    expect(enabled.moduleOverrides).toEqual({
      [MODULES.ONLINE_ORDERING]: true,
    });
    expect(service.getEffectiveModules(enabled)[MODULES.ONLINE_ORDERING]).toBe(
      true,
    );

    const ignored = await service.updateModules("restaurant-1", {
      overrides: { [MODULES.ONLINE_ORDERING]: undefined },
    });
    expect(ignored.moduleOverrides).toEqual({
      [MODULES.ONLINE_ORDERING]: true,
    });

    const reset = await service.updateModules("restaurant-1", {
      overrides: { [MODULES.ONLINE_ORDERING]: null },
    });

    expect(reset.moduleOverrides).toEqual({});
    expect(service.getEffectiveModules(reset)[MODULES.ONLINE_ORDERING]).toBe(
      true,
    );
    expect(await readSubscription()).toMatchObject({
      moduleOverrides: {},
    });
  });

  it("changes plan tiers, resets overrides, and toggles active status", async () => {
    await seedRestaurant();
    await service.create({
      restaurantId: "restaurant-1",
      planTier: "basic",
    });
    await service.updateModules("restaurant-1", {
      overrides: { [MODULES.AI_ANALYTICS]: true },
    });

    const planChanged = await service.changePlan("restaurant-1", "enterprise");
    const deactivated = await service.setActive("restaurant-1", false);

    expect(planChanged).toMatchObject({
      restaurantId: "restaurant-1",
      planTier: "enterprise",
      moduleOverrides: {},
    });
    expect(deactivated).toMatchObject({
      restaurantId: "restaurant-1",
      isActive: false,
    });
  });

  it("throws not found errors when mutating a missing subscription", async () => {
    await expect(
      service.updateModules("missing", { overrides: { [MODULES.POS]: true } }),
    ).rejects.toMatchObject({
      code: "SUBSCRIPTION_NOT_FOUND",
      status: 404,
    });

    await expect(service.changePlan("missing", "pro")).rejects.toMatchObject({
      code: "SUBSCRIPTION_NOT_FOUND",
      status: 404,
    });

    await expect(service.setActive("missing", true)).rejects.toMatchObject({
      code: "SUBSCRIPTION_NOT_FOUND",
      status: 404,
    });
  });

  it("lists all subscriptions in creation order", async () => {
    await seedRestaurant("restaurant-1");
    await seedRestaurant("restaurant-2");
    await service.create({
      restaurantId: "restaurant-1",
      planTier: "basic",
    });
    await service.create({
      restaurantId: "restaurant-2",
      planTier: "pro",
    });

    const rows = await service.listAll();

    expect(rows.map((row) => row.restaurantId)).toEqual([
      "restaurant-1",
      "restaurant-2",
    ]);
  });

  it("computes effective modules from plan defaults and explicit overrides", () => {
    const effective = service.getEffectiveModules({
      planTier: "basic",
      moduleOverrides: {
        [MODULES.ONLINE_ORDERING]: false,
        [MODULES.POS]: true,
      },
    } as typeof shopSubscriptions.$inferSelect);

    expect(effective).toMatchObject({
      ...PLAN_DEFAULT_MODULES.basic,
      [MODULES.ONLINE_ORDERING]: false,
      [MODULES.POS]: true,
    });
    expect(effective[MODULES.MENU_MANAGEMENT]).toBe(true);
    expect(effective[MODULES.AI_ANALYTICS]).toBeUndefined();
  });
});
