import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import {
  dishSearchIndex,
  markets,
  restaurantMarketMemberships,
} from "@makanmakan/database";
import { eq } from "drizzle-orm";

const CSRF_HEADERS = {
  host: "test",
  origin: "https://test",
  cookie: `csrf_token=${"a".repeat(64)}`,
  "x-csrf-token": "a".repeat(64),
};

function openAllWeek() {
  const day = { open: "00:00", close: "23:59" };
  return {
    monday: day,
    tuesday: day,
    wednesday: day,
    thursday: day,
    friday: day,
    saturday: day,
    sunday: day,
  };
}

async function seedMarket(
  testApp: RealIntegrationTestApp,
  overrides: Partial<typeof markets.$inferInsert> = {},
) {
  const now = new Date();
  const [market] = await testApp.testDb.drizzle
    .insert(markets)
    .values({
      id: `market-${crypto.randomUUID()}`,
      slug: `test-market-${crypto.randomUUID()}`,
      name: "逢甲夜市",
      type: "night_market",
      description: "Integration test market",
      city: "台中市",
      district: "西屯區",
      address: "台中市西屯區文華路",
      latitude: 24.1764,
      longitude: 120.6466,
      openingHours: openAllWeek(),
      bannerUrl: "https://example.com/banner.jpg",
      logoUrl: "https://example.com/logo.jpg",
      imageUrls: ["https://example.com/gallery.jpg"],
      tags: ["夜市", "小吃"],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  return market;
}

describe("Markets API — real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  }, 300000);

  afterAll(async () => {
    if (testApp) await testApp.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("lists public markets and resolves a market detail by slug", async () => {
    const restaurant = await seed.restaurant({
      name: "Fengjia Fried Chicken",
      city: "台中市",
      district: "西屯區",
      latitude: 24.1765,
      longitude: 120.6467,
      supportsTakeaway: true,
      enableShopMode: true,
      shopQrCode: "SHOP-FENGJIA",
    });
    const market = await seedMarket(testApp, {
      slug: "fengjia-night-market",
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(restaurant.id),
      marketId: market.id,
      isPrimary: true,
      joinedAt: new Date(),
    });

    const listRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets?city=台中市&district=西屯區"),
    );
    expect(listRes.status).toBe(200);
    const listJson: any = await listRes.json();
    expect(listJson.success).toBe(true);
    expect(listJson.data.total).toBe(1);
    expect(listJson.data.markets[0]).toMatchObject({
      id: market.id,
      slug: "fengjia-night-market",
      name: "逢甲夜市",
      vendorCount: 1,
    });

    const detailRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets/fengjia-night-market"),
    );
    expect(detailRes.status).toBe(200);
    const detailJson: any = await detailRes.json();
    expect(detailJson.data.market.slug).toBe("fengjia-night-market");
    expect(detailJson.data.vendorCount).toBe(1);
  });

  it("caches public market reads and invalidates them after admin changes", async () => {
    const restaurant = await seed.restaurant({
      name: "Cached Market Admin",
      latitude: 24.15,
      longitude: 120.67,
    });
    await seed.user({
      id: 10,
      username: "market-cache-admin",
      role: 0,
      restaurantId: String(restaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(restaurant.id),
    );
    const market = await seedMarket(testApp, {
      slug: "cached-night-market",
    });

    const detailRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets/cached-night-market"),
    );
    expect(detailRes.status).toBe(200);

    const cacheKey = "markets:v1:detail:cached-night-market";
    const cachedDetail = await testApp.testDb.bindings.CACHE_KV.get(
      cacheKey,
      "json",
    );
    expect(cachedDetail).toMatchObject({
      market: { id: market.id, slug: "cached-night-market" },
      vendorCount: 0,
    });

    const updateRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/admin/markets/${market.id}`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
          ...CSRF_HEADERS,
        },
        body: JSON.stringify({ name: "Cached Market Updated" }),
      }),
    );
    expect(updateRes.status).toBe(200);
    await expect(
      testApp.testDb.bindings.CACHE_KV.get("markets:version"),
    ).resolves.toBe("2");
  });

  it("lists vendors in a market and finds nearby markets by distance", async () => {
    const nearMarket = await seedMarket(testApp, {
      slug: "near-market",
      latitude: 24.1764,
      longitude: 120.6466,
    });
    await seedMarket(testApp, {
      slug: "far-market",
      name: "高雄夜市",
      city: "高雄市",
      district: "鹽埕區",
      latitude: 22.626,
      longitude: 120.281,
    });
    const vendor = await seed.restaurant({
      name: "Bubble Tea Stand",
      city: "台中市",
      district: "西屯區",
      businessHours: openAllWeek(),
      latitude: 24.1765,
      longitude: 120.6467,
      supportsTakeaway: true,
      supportsDelivery: false,
      enableShopMode: true,
      shopQrCode: "SHOP-BUBBLE",
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(vendor.id),
      marketId: nearMarket.id,
      stallNumber: "A-12",
      isPrimary: true,
      joinedAt: new Date(),
    });

    const vendorsRes = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/markets/near-market/vendors?takeaway=true",
      ),
    );
    expect(vendorsRes.status).toBe(200);
    const vendorsJson: any = await vendorsRes.json();
    expect(vendorsJson.data.total).toBe(1);
    expect(vendorsJson.data.vendors[0]).toMatchObject({
      restaurantId: String(vendor.id),
      name: "Bubble Tea Stand",
      stallNumber: "A-12",
      supportsTakeaway: true,
    });

    const nearbyRes = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/markets/nearby?lat=24.1763&lng=120.6465&radiusKm=1",
      ),
    );
    expect(nearbyRes.status).toBe(200);
    const nearbyJson: any = await nearbyRes.json();
    expect(nearbyJson.data.markets).toHaveLength(1);
    expect(nearbyJson.data.markets[0]).toMatchObject({
      slug: "near-market",
    });
    expect(nearbyJson.data.markets[0].distanceKm).toBeLessThan(0.1);
  });

  it("scopes dish search by market and GPS filters", async () => {
    const market = await seedMarket(testApp, { slug: "yizhong" });
    const inside = await seed.restaurant({
      name: "Inside Vendor",
      city: "台中市",
      district: "北區",
      latitude: 24.1491,
      longitude: 120.6842,
      businessHours: openAllWeek(),
    });
    const outside = await seed.restaurant({
      name: "Outside Vendor",
      city: "台中市",
      district: "西屯區",
      latitude: 24.18,
      longitude: 120.65,
      businessHours: openAllWeek(),
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(inside.id),
      marketId: market.id,
      isPrimary: true,
      joinedAt: new Date(),
    });
    const insideItem = await seed.menuItem(String(inside.id), {
      name: "Market Bao",
      price: 60,
    });
    const outsideItem = await seed.menuItem(String(outside.id), {
      name: "Market Bao",
      price: 70,
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values([
      {
        menuItemId: insideItem.id,
        restaurantId: String(inside.id),
        dishName: "Market Bao",
        dishNameNormalized: "marketbao",
        price: 60,
        isAvailable: true,
        tags: [],
        district: "北區",
        primaryMarketId: market.id,
        marketIds: [market.id],
        latitude: 24.1491,
        longitude: 120.6842,
        updatedAt: new Date(),
      },
      {
        menuItemId: outsideItem.id,
        restaurantId: String(outside.id),
        dishName: "Market Bao",
        dishNameNormalized: "marketbao",
        price: 70,
        isAvailable: true,
        tags: [],
        district: "西屯區",
        marketIds: [],
        latitude: 24.18,
        longitude: 120.65,
        updatedAt: new Date(),
      },
    ]);

    const marketRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/search?q=Market+Bao&marketId=${market.id}`,
      ),
    );
    expect(marketRes.status).toBe(200);
    const marketJson: any = await marketRes.json();
    expect(marketJson.data.results).toHaveLength(1);
    expect(marketJson.data.results[0].restaurantName).toBe("Inside Vendor");

    const nearbyRes = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/discovery/search?q=Market+Bao&lat=24.1491&lng=120.6842&radiusKm=0.5",
      ),
    );
    expect(nearbyRes.status).toBe(200);
    const nearbyJson: any = await nearbyRes.json();
    expect(nearbyJson.data.results).toHaveLength(1);
    expect(nearbyJson.data.results[0].restaurantName).toBe("Inside Vendor");
  });

  it("returns shop QR code from takeaway eligibility only when eligible", async () => {
    const eligible = await seed.restaurant({
      supportsTakeaway: true,
      enableShopMode: true,
      shopQrCode: "SHOP-ELIGIBLE",
      businessHours: openAllWeek(),
    });
    const disabled = await seed.restaurant({
      supportsTakeaway: false,
      enableShopMode: false,
      shopQrCode: null,
      businessHours: openAllWeek(),
    });

    const eligibleRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/restaurants/${eligible.id}/takeaway-eligibility`,
      ),
    );
    expect(eligibleRes.status).toBe(200);
    const eligibleJson: any = await eligibleRes.json();
    expect(eligibleJson.data).toEqual({
      eligible: true,
      shopQrCode: "SHOP-ELIGIBLE",
    });

    const disabledRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/restaurants/${disabled.id}/takeaway-eligibility`,
      ),
    );
    expect(disabledRes.status).toBe(200);
    const disabledJson: any = await disabledRes.json();
    expect(disabledJson.data).toEqual({
      eligible: false,
      reason: "takeaway_disabled",
    });
  });

  it("syncs discovery index when marketplace-critical restaurant data changes", async () => {
    const restaurant = await seed.restaurant({
      name: "Sync Vendor",
      latitude: 24.1491,
      longitude: 120.6842,
      supportsTakeaway: true,
      supportsDelivery: false,
    });
    await seed.user({
      id: 20,
      username: "sync-owner",
      role: 1,
      restaurantId: String(restaurant.id),
    });
    const ownerToken = await testApp.authHelper.ownerToken(
      20,
      String(restaurant.id),
    );
    const item = await seed.menuItem(String(restaurant.id), {
      name: "Sync Bao",
      price: 60,
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: item.id,
      restaurantId: String(restaurant.id),
      dishName: "Sync Bao",
      dishNameNormalized: "syncbao",
      price: 60,
      isAvailable: true,
      tags: [],
      district: "北區",
      supportsTakeaway: true,
      supportsDelivery: false,
      latitude: 24.1491,
      longitude: 120.6842,
      updatedAt: new Date(),
    });

    const updateRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/restaurants/${restaurant.id}`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
          ...CSRF_HEADERS,
        },
        body: JSON.stringify({
          latitude: 24.15,
          longitude: 120.69,
          supportsTakeaway: false,
          supportsDelivery: true,
        }),
      }),
    );
    expect(updateRes.status).toBe(200);

    const [indexed] = await testApp.testDb.drizzle
      .select({
        supportsTakeaway: dishSearchIndex.supportsTakeaway,
        supportsDelivery: dishSearchIndex.supportsDelivery,
        latitude: dishSearchIndex.latitude,
        longitude: dishSearchIndex.longitude,
      })
      .from(dishSearchIndex)
      .where(eq(dishSearchIndex.menuItemId, item.id))
      .limit(1);

    expect(indexed).toMatchObject({
      supportsTakeaway: false,
      supportsDelivery: true,
      latitude: 24.15,
      longitude: 120.69,
    });
  });

  it("allows re-joining a market after soft leave but rejects duplicate active membership", async () => {
    const restaurant = await seed.restaurant();
    const market = await seedMarket(testApp);

    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(restaurant.id),
      marketId: market.id,
      joinedAt: new Date(Date.now() - 1000),
      leftAt: new Date(),
    });
    await expect(
      testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
        restaurantId: String(restaurant.id),
        marketId: market.id,
        joinedAt: new Date(),
      }),
    ).resolves.toBeDefined();
    await expect(
      testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
        restaurantId: String(restaurant.id),
        marketId: market.id,
        joinedAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it("lets platform admins create, update, soft delete markets, and manage vendors", async () => {
    const restaurant = await seed.restaurant({
      name: "Admin Market Vendor",
      latitude: 24.15,
      longitude: 120.67,
    });
    await seed.user({
      id: 1,
      username: "market-admin",
      role: 0,
      restaurantId: String(restaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(restaurant.id),
    );
    const headers = {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
      ...CSRF_HEADERS,
    };

    const createRes = await testApp.app.fetch(
      new Request("https://test/api/v1/admin/markets", {
        method: "POST",
        headers,
        body: JSON.stringify({
          slug: "admin-created-market",
          name: "管理新增夜市",
          type: "night_market",
          description: "Created by admin API",
          city: "台中市",
          district: "中區",
          address: "台中市中區測試路",
          latitude: 24.141,
          longitude: 120.683,
          tags: ["夜市"],
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    const createdJson: any = await createRes.json();
    expect(createdJson.data.market).toMatchObject({
      slug: "admin-created-market",
      name: "管理新增夜市",
      isActive: true,
    });

    const marketId = createdJson.data.market.id as string;
    const updateRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/admin/markets/${marketId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name: "更新後夜市",
          district: "西區",
        }),
      }),
    );
    expect(updateRes.status).toBe(200);
    const updatedJson: any = await updateRes.json();
    expect(updatedJson.data.market).toMatchObject({
      id: marketId,
      name: "更新後夜市",
      district: "西區",
    });

    const addVendorRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/admin/markets/${marketId}/vendors`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          restaurantId: String(restaurant.id),
          stallNumber: "A-01",
          isPrimary: true,
        }),
      }),
    );
    expect(addVendorRes.status).toBe(201);
    const vendorJson: any = await addVendorRes.json();
    expect(vendorJson.data.membership).toMatchObject({
      restaurantId: String(restaurant.id),
      marketId,
      stallNumber: "A-01",
      isPrimary: true,
    });

    const publicVendorsRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets/admin-created-market/vendors"),
    );
    expect(publicVendorsRes.status).toBe(200);
    const publicVendorsJson: any = await publicVendorsRes.json();
    expect(publicVendorsJson.data.total).toBe(1);

    const removeVendorRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/admin/markets/${marketId}/vendors/${restaurant.id}`,
        {
          method: "DELETE",
          headers,
        },
      ),
    );
    expect(removeVendorRes.status).toBe(200);
    expect(((await removeVendorRes.json()) as any).data.removed).toBe(true);

    const deleteRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/admin/markets/${marketId}`, {
        method: "DELETE",
        headers,
      }),
    );
    expect(deleteRes.status).toBe(200);
    expect(((await deleteRes.json()) as any).data.deleted).toBe(true);

    const publicDetailRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets/admin-created-market"),
    );
    expect(publicDetailRes.status).toBe(404);
  });

  it("lets platform admins review, approve, and reject market join requests", async () => {
    const restaurant = await seed.restaurant({
      name: "Join Review Vendor",
      latitude: 24.15,
      longitude: 120.67,
    });
    await seed.user({
      id: 21,
      username: "join-review-admin",
      role: 0,
      restaurantId: String(restaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(restaurant.id),
    );
    const headers = {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
      ...CSRF_HEADERS,
    };
    const approvedMarket = await seedMarket(testApp, {
      slug: "approved-review-market",
      name: "Approved Review Market",
    });
    const rejectedMarket = await seedMarket(testApp, {
      slug: "rejected-review-market",
      name: "Rejected Review Market",
    });

    const createApprovedRequest = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/market-join-requests`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            marketId: approvedMarket.id,
            message: "Please approve our stall.",
          }),
        },
      ),
    );
    expect(createApprovedRequest.status).toBe(201);
    const approvedRequestJson: any = await createApprovedRequest.json();

    const createRejectedRequest = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/market-join-requests`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            marketId: rejectedMarket.id,
            message: "Please reject this test request.",
          }),
        },
      ),
    );
    expect(createRejectedRequest.status).toBe(201);
    const rejectedRequestJson: any = await createRejectedRequest.json();

    const listRes = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/admin/markets/join-requests?status=pending",
        {
          headers: { authorization: `Bearer ${adminToken}` },
        },
      ),
    );
    expect(listRes.status).toBe(200);
    const listJson: any = await listRes.json();
    expect(listJson.data.requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: approvedRequestJson.data.request.id,
          status: "pending",
          restaurant: expect.objectContaining({ name: "Join Review Vendor" }),
          market: expect.objectContaining({ slug: "approved-review-market" }),
        }),
        expect.objectContaining({
          id: rejectedRequestJson.data.request.id,
          status: "pending",
          market: expect.objectContaining({ slug: "rejected-review-market" }),
        }),
      ]),
    );

    const approveRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/admin/markets/join-requests/${approvedRequestJson.data.request.id}/approve`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            stallNumber: "C-09",
            isPrimary: true,
          }),
        },
      ),
    );
    expect(approveRes.status).toBe(200);
    const approveJson: any = await approveRes.json();
    expect(approveJson.data.request).toMatchObject({
      id: approvedRequestJson.data.request.id,
      status: "approved",
    });
    expect(approveJson.data.membership).toMatchObject({
      restaurantId: String(restaurant.id),
      marketId: approvedMarket.id,
      stallNumber: "C-09",
      isPrimary: true,
    });

    const vendorsRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets/approved-review-market/vendors"),
    );
    expect(vendorsRes.status).toBe(200);
    const vendorsJson: any = await vendorsRes.json();
    expect(vendorsJson.data.vendors[0]).toMatchObject({
      restaurantId: String(restaurant.id),
      stallNumber: "C-09",
    });

    const rejectRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/admin/markets/join-requests/${rejectedRequestJson.data.request.id}/reject`,
        {
          method: "POST",
          headers,
        },
      ),
    );
    expect(rejectRes.status).toBe(200);
    const rejectJson: any = await rejectRes.json();
    expect(rejectJson.data.request).toMatchObject({
      id: rejectedRequestJson.data.request.id,
      status: "rejected",
    });
  });

  it("lets restaurant owners view memberships and request to join a market", async () => {
    const restaurant = await seed.restaurant({
      name: "Owner Market Vendor",
      latitude: 24.15,
      longitude: 120.67,
    });
    const activeMarket = await seedMarket(testApp, {
      slug: "owner-active-market",
      name: "Owner Active Market",
    });
    const requestedMarket = await seedMarket(testApp, {
      slug: "owner-requested-market",
      name: "Owner Requested Market",
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(restaurant.id),
      marketId: activeMarket.id,
      stallNumber: "B-02",
      isPrimary: true,
      joinedAt: new Date(),
    });
    await seed.user({
      id: 2,
      username: "market-owner",
      role: 1,
      restaurantId: String(restaurant.id),
    });
    const ownerToken = await testApp.authHelper.ownerToken(
      2,
      String(restaurant.id),
    );
    const headers = {
      authorization: `Bearer ${ownerToken}`,
      "content-type": "application/json",
      ...CSRF_HEADERS,
    };

    const membershipsRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/restaurants/${restaurant.id}/markets`, {
        headers: { authorization: `Bearer ${ownerToken}` },
      }),
    );
    expect(membershipsRes.status).toBe(200);
    const membershipsJson: any = await membershipsRes.json();
    expect(membershipsJson.data.memberships).toHaveLength(1);
    expect(membershipsJson.data.memberships[0]).toMatchObject({
      restaurantId: String(restaurant.id),
      marketId: activeMarket.id,
      stallNumber: "B-02",
      isPrimary: true,
      market: {
        slug: "owner-active-market",
        name: "Owner Active Market",
      },
    });

    const requestRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/market-join-requests`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            marketId: requestedMarket.id,
            message: "We sell late-night dumplings.",
          }),
        },
      ),
    );
    expect(requestRes.status).toBe(201);
    const requestJson: any = await requestRes.json();
    expect(requestJson.data.request).toMatchObject({
      restaurantId: String(restaurant.id),
      marketId: requestedMarket.id,
      status: "pending",
      message: "We sell late-night dumplings.",
    });

    const requestsRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/market-join-requests`,
        {
          headers: { authorization: `Bearer ${ownerToken}` },
        },
      ),
    );
    expect(requestsRes.status).toBe(200);
    const requestsJson: any = await requestsRes.json();
    expect(requestsJson.data.requests).toHaveLength(1);
    expect(requestsJson.data.requests[0]).toMatchObject({
      restaurantId: String(restaurant.id),
      marketId: requestedMarket.id,
      status: "pending",
      message: "We sell late-night dumplings.",
      market: {
        slug: "owner-requested-market",
        name: "Owner Requested Market",
      },
    });

    const duplicateRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/market-join-requests`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ marketId: requestedMarket.id }),
        },
      ),
    );
    expect(duplicateRes.status).toBe(409);

    const activeMembershipRequestRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/market-join-requests`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ marketId: activeMarket.id }),
        },
      ),
    );
    expect(activeMembershipRequestRes.status).toBe(409);
  });

  it("lets restaurant owners manage public contact channels and FAQs", async () => {
    const restaurant = await seed.restaurant({
      name: "Deep Link Dumplings",
    });
    await seed.user({
      id: 3,
      username: "contact-owner",
      role: 1,
      restaurantId: String(restaurant.id),
    });
    const ownerToken = await testApp.authHelper.ownerToken(
      3,
      String(restaurant.id),
    );

    const updateRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/contact-profile`,
        {
          method: "PUT",
          headers: {
            authorization: `Bearer ${ownerToken}`,
            "content-type": "application/json",
            ...CSRF_HEADERS,
          },
          body: JSON.stringify({
            messagingChannels: {
              line: "https://line.me/ti/p/~deep-dumplings",
              whatsapp: "https://wa.me/886912345678",
              instagram: "https://ig.me/m/deepdumplings",
            },
            faqs: [
              {
                question: "可以先預訂嗎？",
                answer: "可以，請透過 LINE 留下取餐時間。",
                keywords: ["預訂", "取餐"],
                displayOrder: 2,
                isActive: true,
              },
              {
                question: "有素食選項嗎？",
                answer: "目前提供高麗菜素餃。",
                keywords: ["素食"],
                displayOrder: 1,
                isActive: true,
              },
              {
                question: "停賣品項",
                answer: "這筆不應出現在公開 FAQ。",
                keywords: ["隱藏"],
                displayOrder: 3,
                isActive: false,
              },
            ],
          }),
        },
      ),
    );
    expect(updateRes.status).toBe(200);

    const publicRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/contact-profile`,
      ),
    );
    expect(publicRes.status).toBe(200);
    const publicJson: any = await publicRes.json();
    expect(publicJson.data.messagingChannels).toEqual({
      line: "https://line.me/ti/p/~deep-dumplings",
      whatsapp: "https://wa.me/886912345678",
      instagram: "https://ig.me/m/deepdumplings",
    });
    expect(publicJson.data.faqs).toEqual([
      expect.objectContaining({
        question: "有素食選項嗎？",
        answer: "目前提供高麗菜素餃。",
        keywords: ["素食"],
        displayOrder: 1,
        isActive: true,
      }),
      expect.objectContaining({
        question: "可以先預訂嗎？",
        answer: "可以，請透過 LINE 留下取餐時間。",
        keywords: ["預訂", "取餐"],
        displayOrder: 2,
        isActive: true,
      }),
    ]);

    const ownerRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/contact-profile`,
        {
          headers: { authorization: `Bearer ${ownerToken}` },
        },
      ),
    );
    expect(ownerRes.status).toBe(200);
    const ownerJson: any = await ownerRes.json();
    expect(ownerJson.data.faqs).toHaveLength(3);
    expect(ownerJson.data.faqs[2]).toMatchObject({
      question: "停賣品項",
      isActive: false,
    });
  });
});
