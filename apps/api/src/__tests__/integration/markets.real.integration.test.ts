import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import {
  dishSearchIndex,
  markets,
  restaurantServiceItems,
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
      imageUrls: [
        "https://example.com/fengjia-gallery-1.jpg",
        "https://example.com/fengjia-gallery-2.jpg",
      ],
      openingHours: {
        friday: { open: "17:00", close: "23:30" },
        saturday: { open: "16:00", close: "23:59" },
      },
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(restaurant.id),
      marketId: market.id,
      isPrimary: true,
      joinedAt: new Date(),
    });
    const menuItem = await seed.menuItem(String(restaurant.id), {
      name: "Fengjia Chicken",
      price: 95,
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: menuItem.id,
      restaurantId: String(restaurant.id),
      dishName: "Fengjia Chicken",
      dishNameNormalized: "fengjiachicken",
      price: 95,
      isAvailable: true,
      tags: [],
      district: "西屯區",
      primaryMarketId: market.id,
      marketIds: [market.id],
      latitude: 24.1765,
      longitude: 120.6467,
      updatedAt: new Date(),
    });
    await testApp.testDb.drizzle.insert(restaurantServiceItems).values({
      restaurantId: String(restaurant.id),
      name: "外帶預訂",
      serviceType: "pickup",
      isActive: true,
      isPublic: true,
      sortOrder: 1,
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
      catalogCoverage: {
        searchableProductCount: 1,
        publicServiceCount: 1,
      },
      imageUrls: [
        "https://example.com/fengjia-gallery-1.jpg",
        "https://example.com/fengjia-gallery-2.jpg",
      ],
    });
    expect(listJson.data.markets[0].openingHours).toMatchObject({
      friday: { open: "17:00", close: "23:30" },
      saturday: { open: "16:00", close: "23:59" },
    });
    expect(listJson.data.markets[0].publicReadiness).toMatchObject({
      ready: true,
      score: 100,
      completedCount: 7,
      totalCount: 7,
      issues: [],
    });

    const detailRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets/fengjia-night-market"),
    );
    expect(detailRes.status).toBe(200);
    const detailJson: any = await detailRes.json();
    expect(detailJson.data.market.slug).toBe("fengjia-night-market");
    expect(detailJson.data.vendorCount).toBe(1);
    expect(detailJson.data.catalogCoverage).toEqual({
      searchableProductCount: 1,
      publicServiceCount: 1,
    });
    expect(detailJson.data.publicReadiness).toMatchObject({
      ready: true,
      score: 100,
      completedCount: 7,
      totalCount: 7,
      issues: [],
    });
  });

  it("lists active market cities and districts for customer filters", async () => {
    await seedMarket(testApp, {
      slug: "fengjia-area",
      name: "逢甲夜市",
      city: "台中市",
      district: "西屯區",
    });
    await seedMarket(testApp, {
      slug: "yizhong-area",
      name: "一中商圈",
      city: "台中市",
      district: "北區",
    });
    await seedMarket(testApp, {
      slug: "ximending-area",
      name: "西門町商圈",
      city: "台北市",
      district: "萬華區",
    });
    await seedMarket(testApp, {
      slug: "inactive-area",
      name: "Inactive Area",
      city: "基隆市",
      district: "仁愛區",
      isActive: false,
    });

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/markets/areas"),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.data.areas).toEqual([
      { city: "台中市", districts: ["北區", "西屯區"] },
      { city: "台北市", districts: ["萬華區"] },
    ]);
  });

  it("searches public markets by keyword across name, slug, description, and tags", async () => {
    const fengjia = await seedMarket(testApp, {
      slug: "fengjia-night-market-search",
      name: "逢甲夜市",
      description: "台中大型夜市與小吃聚落",
      tags: ["夜市", "雞排"],
    });
    await seedMarket(testApp, {
      slug: "yizhong-commercial-area-search",
      name: "一中商圈",
      description: "台中學生商圈",
      tags: ["商圈", "飲品"],
    });

    const nameRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets?q=逢甲"),
    );
    expect(nameRes.status).toBe(200);
    const nameJson: any = await nameRes.json();
    expect(nameJson.data.markets).toHaveLength(1);
    expect(nameJson.data.markets[0]).toMatchObject({
      id: fengjia.id,
      slug: "fengjia-night-market-search",
    });

    const tagRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets?q=雞排"),
    );
    const tagJson: any = await tagRes.json();
    expect(tagJson.data.markets.map((market: any) => market.id)).toEqual([
      fengjia.id,
    ]);
  });

  it("reports public readiness issues for incomplete market pages", async () => {
    await seedMarket(testApp, {
      slug: "incomplete-market",
      description: "",
      address: "",
      openingHours: null,
      bannerUrl: null,
      logoUrl: null,
      imageUrls: null,
    });

    const detailRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets/incomplete-market"),
    );

    expect(detailRes.status).toBe(200);
    const detailJson: any = await detailRes.json();
    expect(detailJson.data.publicReadiness).toEqual({
      ready: false,
      score: 0,
      completedCount: 0,
      totalCount: 7,
      issues: [
        { key: "description", severity: "required" },
        { key: "location", severity: "required" },
        { key: "openingHours", severity: "required" },
        { key: "image", severity: "recommended" },
        { key: "vendors", severity: "required" },
        { key: "products", severity: "required" },
        { key: "services", severity: "recommended" },
      ],
    });
  });

  it("lets platform admins inspect vendor-level catalog readiness gaps", async () => {
    const adminRestaurant = await seed.restaurant({
      name: "Catalog Readiness Admin",
      latitude: 24.15,
      longitude: 120.67,
    });
    await seed.user({
      id: 31,
      username: "catalog-readiness-admin",
      role: 0,
      restaurantId: String(adminRestaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(adminRestaurant.id),
    );
    const market = await seedMarket(testApp, {
      slug: "catalog-readiness-market",
    });
    const completeVendor = await seed.restaurant({
      name: "Complete Vendor",
      city: "台中市",
      district: "西屯區",
      latitude: 24.1765,
      longitude: 120.6467,
    });
    const missingVendor = await seed.restaurant({
      name: "Missing Catalog Vendor",
      city: "台中市",
      district: "西屯區",
      latitude: 24.1768,
      longitude: 120.6469,
    });

    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values([
      {
        restaurantId: String(completeVendor.id),
        marketId: market.id,
        stallNumber: "A-01",
        isPrimary: true,
        joinedAt: new Date(),
      },
      {
        restaurantId: String(missingVendor.id),
        marketId: market.id,
        stallNumber: "B-02",
        isPrimary: false,
        joinedAt: new Date(),
      },
    ]);
    const completeItem = await seed.menuItem(String(completeVendor.id), {
      name: "Ready Bao",
      price: 70,
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: completeItem.id,
      restaurantId: String(completeVendor.id),
      dishName: "Ready Bao",
      dishNameNormalized: "readybao",
      price: 70,
      isAvailable: true,
      tags: [],
      district: "西屯區",
      primaryMarketId: market.id,
      marketIds: [market.id],
      latitude: 24.1765,
      longitude: 120.6467,
      updatedAt: new Date(),
    });
    await testApp.testDb.drizzle.insert(restaurantServiceItems).values({
      restaurantId: String(completeVendor.id),
      name: "現場預約",
      serviceType: "booking",
      isActive: true,
      isPublic: true,
      sortOrder: 1,
    });

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/admin/markets/readiness", {
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    const readinessMarket = json.data.markets.find(
      (item: any) => item.id === market.id,
    );
    expect(readinessMarket.catalogCoverage).toMatchObject({
      searchableProductCount: 1,
      publicServiceCount: 1,
      vendorsWithSearchableProducts: 1,
      vendorsMissingSearchableProducts: 1,
      vendorsWithPublicServices: 1,
      vendorsMissingPublicServices: 1,
    });
    expect(readinessMarket.catalogCoverage.missingProductVendors).toEqual([
      {
        restaurantId: String(missingVendor.id),
        name: "Missing Catalog Vendor",
        stallNumber: "B-02",
      },
    ]);
    expect(readinessMarket.catalogCoverage.missingServiceVendors).toEqual([
      {
        restaurantId: String(missingVendor.id),
        name: "Missing Catalog Vendor",
        stallNumber: "B-02",
      },
    ]);
  });

  it("returns the full admin catalog gap vendor list", async () => {
    const adminRestaurant = await seed.restaurant({
      name: "Full Catalog Gap Admin",
      latitude: 24.15,
      longitude: 120.67,
    });
    await seed.user({
      id: 32,
      username: "full-catalog-gap-admin",
      role: 0,
      restaurantId: String(adminRestaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(adminRestaurant.id),
    );
    const market = await seedMarket(testApp, {
      slug: "full-catalog-gap-market",
    });
    const missingVendors = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        seed.restaurant({
          name: `Missing Catalog Vendor ${index + 1}`,
          city: "台中市",
          district: "西屯區",
          latitude: 24.176 + index / 10000,
          longitude: 120.646 + index / 10000,
        }),
      ),
    );

    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values(
      missingVendors.map((vendor, index) => ({
        restaurantId: String(vendor.id),
        marketId: market.id,
        stallNumber: `G-${String(index + 1).padStart(2, "0")}`,
        isPrimary: index === 0,
        joinedAt: new Date(),
      })),
    );

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/admin/markets/readiness", {
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    const readinessMarket = json.data.markets.find(
      (item: any) => item.id === market.id,
    );
    expect(readinessMarket.catalogCoverage.missingProductVendors).toHaveLength(
      6,
    );
    expect(readinessMarket.catalogCoverage.missingServiceVendors).toHaveLength(
      6,
    );
  });

  it("summarizes market catalog readiness gaps by area for platform admins", async () => {
    const adminRestaurant = await seed.restaurant({
      name: "Area Readiness Admin",
      latitude: 24.15,
      longitude: 120.67,
    });
    await seed.user({
      id: 33,
      username: "area-readiness-admin",
      role: 0,
      restaurantId: String(adminRestaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(adminRestaurant.id),
    );
    const westMarket = await seedMarket(testApp, {
      slug: "west-area-market",
      city: "台中市",
      district: "西屯區",
    });
    const northMarket = await seedMarket(testApp, {
      slug: "north-area-market",
      city: "台中市",
      district: "北區",
    });
    const westVendors = await Promise.all(
      Array.from({ length: 2 }, (_, index) =>
        seed.restaurant({
          name: `West Missing Vendor ${index + 1}`,
          city: "台中市",
          district: "西屯區",
          latitude: 24.176 + index / 10000,
          longitude: 120.646 + index / 10000,
        }),
      ),
    );
    const northVendor = await seed.restaurant({
      name: "North Ready Vendor",
      city: "台中市",
      district: "北區",
      latitude: 24.15,
      longitude: 120.68,
    });

    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values([
      ...westVendors.map((vendor, index) => ({
        restaurantId: String(vendor.id),
        marketId: westMarket.id,
        stallNumber: `W-${index + 1}`,
        isPrimary: index === 0,
        joinedAt: new Date(),
      })),
      {
        restaurantId: String(northVendor.id),
        marketId: northMarket.id,
        stallNumber: "N-1",
        isPrimary: true,
        joinedAt: new Date(),
      },
    ]);
    const northItem = await seed.menuItem(String(northVendor.id), {
      name: "Ready Tea",
      price: 50,
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: northItem.id,
      restaurantId: String(northVendor.id),
      dishName: "Ready Tea",
      dishNameNormalized: "readytea",
      price: 50,
      isAvailable: true,
      tags: [],
      district: "北區",
      primaryMarketId: northMarket.id,
      marketIds: [northMarket.id],
      latitude: 24.15,
      longitude: 120.68,
      updatedAt: new Date(),
    });

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/admin/markets/area-readiness", {
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.data.areas[0]).toMatchObject({
      city: "台中市",
      district: "西屯區",
      marketCount: 1,
      vendorCount: 2,
      vendorsMissingSearchableProducts: 2,
      vendorsMissingPublicServices: 2,
      totalCatalogGapVendors: 4,
    });
    expect(json.data.areas[1]).toMatchObject({
      city: "台中市",
      district: "北區",
      marketCount: 1,
      vendorCount: 1,
      vendorsMissingSearchableProducts: 0,
      vendorsMissingPublicServices: 1,
      totalCatalogGapVendors: 1,
    });
  });

  it("exposes market pages through sitemap.xml and robots.txt", async () => {
    const activeMarket = await seedMarket(testApp, {
      slug: "seo-night-market",
      name: "SEO Night Market",
      updatedAt: new Date("2026-05-20T12:00:00.000Z"),
    });
    await seedMarket(testApp, {
      slug: "inactive-night-market",
      name: "Inactive Night Market",
      isActive: false,
      updatedAt: new Date("2026-05-21T12:00:00.000Z"),
    });

    const sitemapRes = await testApp.app.fetch(
      new Request("https://makanmakan.app/sitemap.xml"),
    );
    expect(sitemapRes.status).toBe(200);
    expect(sitemapRes.headers.get("content-type")).toContain("application/xml");
    const sitemapXml = await sitemapRes.text();
    expect(sitemapXml).toContain(
      "<loc>https://makanmakan.app/markets/seo-night-market</loc>",
    );
    expect(sitemapXml).toContain("<lastmod>2026-05-20</lastmod>");
    expect(sitemapXml).not.toContain("inactive-night-market");
    expect(sitemapXml).not.toContain(activeMarket.id);

    const robotsRes = await testApp.app.fetch(
      new Request("https://makanmakan.app/robots.txt"),
    );
    expect(robotsRes.status).toBe(200);
    const robotsText = await robotsRes.text();
    expect(robotsText).toContain("User-agent: *");
    expect(robotsText).toContain("Disallow: /api/");
    expect(robotsText).toContain("Disallow: /admin/");
    expect(robotsText).toContain("Sitemap: https://makanmakan.app/sitemap.xml");
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
    const initialMarketCacheVersion = Number(
      (await testApp.testDb.bindings.CACHE_KV.get("markets:version")) ?? 0,
    );

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
    const nextMarketCacheVersion = Number(
      await testApp.testDb.bindings.CACHE_KV.get("markets:version"),
    );
    expect(nextMarketCacheVersion).toBeGreaterThan(initialMarketCacheVersion);
  });

  it("syncs discovery index when market public availability changes", async () => {
    const adminRestaurant = await seed.restaurant({
      name: "Market Sync Admin",
      latitude: 24.15,
      longitude: 120.67,
    });
    await seed.user({
      id: 21,
      username: "market-sync-admin",
      role: 0,
      restaurantId: String(adminRestaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(adminRestaurant.id),
    );
    const market = await seedMarket(testApp, {
      slug: "sync-market",
    });
    const restaurant = await seed.restaurant({
      name: "Indexed Market Vendor",
      latitude: 24.1491,
      longitude: 120.6842,
      supportsTakeaway: true,
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(restaurant.id),
      marketId: market.id,
      isPrimary: true,
      joinedAt: new Date(),
    });
    const item = await seed.menuItem(String(restaurant.id), {
      name: "Indexed Market Bao",
      price: 60,
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: item.id,
      restaurantId: String(restaurant.id),
      dishName: "Indexed Market Bao",
      dishNameNormalized: "indexedmarketbao",
      price: 60,
      isAvailable: true,
      tags: [],
      district: "西屯區",
      supportsTakeaway: true,
      primaryMarketId: market.id,
      marketIds: [market.id],
      latitude: 24.1491,
      longitude: 120.6842,
      updatedAt: new Date(),
    });

    const updateRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/admin/markets/${market.id}`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
          ...CSRF_HEADERS,
        },
        body: JSON.stringify({ isActive: false }),
      }),
    );
    expect(updateRes.status).toBe(200);

    const [indexed] = await testApp.testDb.drizzle
      .select({
        primaryMarketId: dishSearchIndex.primaryMarketId,
        marketIds: dishSearchIndex.marketIds,
      })
      .from(dishSearchIndex)
      .where(eq(dishSearchIndex.menuItemId, item.id))
      .limit(1);

    expect(indexed).toEqual({
      primaryMarketId: null,
      marketIds: [],
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
          openingHours: {
            friday: { open: "17:00", close: "23:30" },
            saturday: { open: "16:00", close: "23:59" },
          },
          bannerUrl: "https://example.com/admin-market-banner.jpg",
          logoUrl: "https://example.com/admin-market-logo.jpg",
          imageUrls: [
            "https://example.com/admin-market-gallery-1.jpg",
            "https://example.com/admin-market-gallery-2.jpg",
          ],
          tags: ["夜市", "親子"],
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    const createdJson: any = await createRes.json();
    expect(createdJson.data.market).toMatchObject({
      slug: "admin-created-market",
      name: "管理新增夜市",
      isActive: true,
      bannerUrl: "https://example.com/admin-market-banner.jpg",
      logoUrl: "https://example.com/admin-market-logo.jpg",
      imageUrls: [
        "https://example.com/admin-market-gallery-1.jpg",
        "https://example.com/admin-market-gallery-2.jpg",
      ],
      tags: ["夜市", "親子"],
    });
    expect(createdJson.data.market.openingHours).toMatchObject({
      friday: { open: "17:00", close: "23:30" },
      saturday: { open: "16:00", close: "23:59" },
    });

    const marketId = createdJson.data.market.id as string;
    const updateRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/admin/markets/${marketId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name: "更新後夜市",
          district: "西區",
          imageUrls: ["https://example.com/admin-market-gallery-3.jpg"],
          tags: ["美食", "宵夜"],
        }),
      }),
    );
    expect(updateRes.status).toBe(200);
    const updatedJson: any = await updateRes.json();
    expect(updatedJson.data.market).toMatchObject({
      id: marketId,
      name: "更新後夜市",
      district: "西區",
      imageUrls: ["https://example.com/admin-market-gallery-3.jpg"],
      tags: ["美食", "宵夜"],
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

    const publicDetailBeforeDeleteRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets/admin-created-market"),
    );
    expect(publicDetailBeforeDeleteRes.status).toBe(200);
    const publicDetailBeforeDeleteJson: any =
      await publicDetailBeforeDeleteRes.json();
    expect(publicDetailBeforeDeleteJson.data.market).toMatchObject({
      slug: "admin-created-market",
      name: "更新後夜市",
      bannerUrl: "https://example.com/admin-market-banner.jpg",
      logoUrl: "https://example.com/admin-market-logo.jpg",
      imageUrls: ["https://example.com/admin-market-gallery-3.jpg"],
      tags: ["美食", "宵夜"],
    });
    expect(publicDetailBeforeDeleteJson.data.market.openingHours).toMatchObject(
      {
        friday: { open: "17:00", close: "23:30" },
        saturday: { open: "16:00", close: "23:59" },
      },
    );

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

  it("lets platform admins bulk import vendors into a market", async () => {
    const adminRestaurant = await seed.restaurant({
      name: "Vendor Import Admin",
      latitude: 24.15,
      longitude: 120.67,
    });
    const existingRestaurant = await seed.restaurant({
      name: "Existing Import Vendor",
      city: "台中市",
      district: "西屯區",
      address: "台中市西屯區既有攤位",
      phone: "0211111111",
    });
    await seed.user({
      id: 41,
      username: "vendor-import-admin",
      role: 0,
      restaurantId: String(adminRestaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(adminRestaurant.id),
    );
    const market = await seedMarket(testApp, {
      slug: "bulk-import-market",
    });
    const headers = {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
      ...CSRF_HEADERS,
    };

    const importRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/admin/markets/${market.id}/vendor-imports`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            vendors: [
              {
                restaurantId: String(existingRestaurant.id),
                stallNumber: "A-01",
                isPrimary: true,
              },
              {
                name: "新匯入蚵仔煎",
                type: "street_food",
                category: "food",
                address: "台中市西屯區文華路 100 號",
                district: "西屯區",
                city: "台中市",
                phone: "0222222222",
                stallNumber: "B-02",
              },
            ],
          }),
        },
      ),
    );

    expect(importRes.status).toBe(200);
    const importJson: any = await importRes.json();
    expect(importJson.data).toMatchObject({
      createdRestaurants: 1,
      attachedVendors: 2,
      skipped: 0,
    });
    expect(importJson.data.results).toEqual([
      expect.objectContaining({
        status: "attached",
        restaurantId: String(existingRestaurant.id),
        stallNumber: "A-01",
      }),
      expect.objectContaining({
        status: "created",
        restaurantName: "新匯入蚵仔煎",
        stallNumber: "B-02",
      }),
    ]);

    const vendorsRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets/bulk-import-market/vendors"),
    );
    expect(vendorsRes.status).toBe(200);
    const vendorsJson: any = await vendorsRes.json();
    expect(vendorsJson.data.total).toBe(2);
    expect(vendorsJson.data.vendors.map((vendor: any) => vendor.name)).toEqual(
      expect.arrayContaining(["Existing Import Vendor", "新匯入蚵仔煎"]),
    );

    const duplicateRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/admin/markets/${market.id}/vendor-imports`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            vendors: [
              {
                restaurantId: String(existingRestaurant.id),
                stallNumber: "A-01",
              },
            ],
          }),
        },
      ),
    );
    expect(duplicateRes.status).toBe(200);
    const duplicateJson: any = await duplicateRes.json();
    expect(duplicateJson.data).toMatchObject({
      createdRestaurants: 0,
      attachedVendors: 0,
      skipped: 1,
    });
    expect(duplicateJson.data.results[0]).toMatchObject({
      status: "skipped",
      reason: "already_attached",
      restaurantId: String(existingRestaurant.id),
    });

    const missingRestaurantRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/admin/markets/${market.id}/vendor-imports`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            vendors: [
              {
                restaurantId: "missing-import-restaurant",
                stallNumber: "C-03",
              },
            ],
          }),
        },
      ),
    );
    expect(missingRestaurantRes.status).toBe(200);
    const missingRestaurantJson: any = await missingRestaurantRes.json();
    expect(missingRestaurantJson.data).toMatchObject({
      createdRestaurants: 0,
      attachedVendors: 0,
      skipped: 1,
    });
    expect(missingRestaurantJson.data.results[0]).toMatchObject({
      status: "skipped",
      reason: "restaurant_not_found",
      restaurantId: "missing-import-restaurant",
    });
  });

  it("lets platform admins search restaurant candidates before attaching vendors", async () => {
    const adminRestaurant = await seed.restaurant({
      name: "Vendor Search Admin",
      latitude: 24.15,
      longitude: 120.67,
    });
    await seed.user({
      id: 22,
      username: "vendor-search-admin",
      role: 0,
      restaurantId: String(adminRestaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(adminRestaurant.id),
    );
    const headers = {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
      ...CSRF_HEADERS,
    };
    const market = await seedMarket(testApp, {
      slug: "vendor-search-market",
      name: "Vendor Search Market",
    });
    const candidate = await seed.restaurant({
      name: "Searchable Bao Stand",
      city: "台中市",
      district: "西屯區",
      address: "Candidate Road 1",
    });
    const activeMember = await seed.restaurant({
      name: "Searchable Existing Member",
      city: "台中市",
      district: "西屯區",
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(activeMember.id),
      marketId: market.id,
      joinedAt: new Date(),
    });
    await seed.restaurant({
      name: "Unrelated Noodle Shop",
      city: "台中市",
      district: "北區",
    });

    const candidatesRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/admin/markets/vendor-candidates?q=Searchable&marketId=${market.id}`,
        { headers },
      ),
    );
    expect(candidatesRes.status).toBe(200);
    const candidatesJson: any = await candidatesRes.json();
    expect(candidatesJson.data.restaurants).toEqual([
      expect.objectContaining({
        id: String(candidate.id),
        name: "Searchable Bao Stand",
        city: "台中市",
        district: "西屯區",
        address: "Candidate Road 1",
      }),
    ]);
    expect(candidatesJson.data.total).toBe(1);
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
