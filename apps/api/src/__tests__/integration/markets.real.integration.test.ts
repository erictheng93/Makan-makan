import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import {
  dishSearchIndex,
  markets,
  restaurants,
  restaurantServiceItems,
  restaurantMarketMemberships,
} from "@makanmakan/database";
import { and, eq, isNull } from "drizzle-orm";

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

function closedAllWeek() {
  const day = { open: "00:00", close: "00:00", closed: true };
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

async function seedSearchableMarket(
  testApp: RealIntegrationTestApp,
  seed: ReturnType<typeof buildSeedHelpers>,
  marketOverrides: Partial<typeof markets.$inferInsert> = {},
  restaurantOverrides: Parameters<typeof seed.restaurant>[0] = {},
) {
  const market = await seedMarket(testApp, marketOverrides);
  const restaurant = await seed.restaurant({
    name: `${market.slug} Vendor`,
    city: market.city,
    district: market.district,
    latitude: market.latitude,
    longitude: market.longitude,
    isActive: true,
    ...restaurantOverrides,
  });
  await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
    restaurantId: String(restaurant.id),
    marketId: market.id,
    isPrimary: true,
    joinedAt: new Date(),
  });
  const menuItem = await seed.menuItem(String(restaurant.id), {
    name: `${market.name} Searchable Item`,
    price: 95,
  });
  await testApp.testDb.drizzle.insert(dishSearchIndex).values({
    menuItemId: menuItem.id,
    restaurantId: String(restaurant.id),
    dishName: `${market.name} Searchable Item`,
    dishNameNormalized: `${market.slug.replaceAll("-", "")}searchableitem`,
    price: 95,
    isAvailable: true,
    tags: [],
    district: market.district,
    primaryMarketId: market.id,
    marketIds: [market.id],
    latitude: market.latitude,
    longitude: market.longitude,
    updatedAt: new Date(),
  });

  return { market, restaurant, menuItem };
}

async function seedServiceOnlyMarket(
  testApp: RealIntegrationTestApp,
  seed: ReturnType<typeof buildSeedHelpers>,
  marketOverrides: Partial<typeof markets.$inferInsert> = {},
  restaurantOverrides: Parameters<typeof seed.restaurant>[0] = {},
) {
  const market = await seedMarket(testApp, marketOverrides);
  const restaurant = await seed.restaurant({
    name: `${market.slug} Service Vendor`,
    city: market.city,
    district: market.district,
    latitude: market.latitude,
    longitude: market.longitude,
    isActive: true,
    ...restaurantOverrides,
  });
  await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
    restaurantId: String(restaurant.id),
    marketId: market.id,
    isPrimary: true,
    joinedAt: new Date(),
  });
  await testApp.testDb.drizzle.insert(restaurantServiceItems).values({
    restaurantId: String(restaurant.id),
    name: `${market.name} Public Service`,
    serviceType: "general",
    isActive: true,
    isPublic: true,
    sortOrder: 1,
  });

  return { market, restaurant };
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
    const productItem = await seed.menuItem(String(restaurant.id), {
      name: "Phone Charm",
      price: 120,
      catalogType: "product",
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: menuItem.id,
      restaurantId: String(restaurant.id),
      dishName: "Fengjia Chicken",
      dishNameNormalized: "fengjiachicken",
      price: 95,
      catalogType: "menu_item",
      categoryName: "炸物",
      isAvailable: true,
      tags: [],
      district: "西屯區",
      primaryMarketId: market.id,
      marketIds: [market.id],
      latitude: 24.1765,
      longitude: 120.6467,
      updatedAt: new Date(),
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: productItem.id,
      restaurantId: String(restaurant.id),
      dishName: "Phone Charm",
      dishNameNormalized: "phonecharm",
      price: 120,
      catalogType: "product",
      categoryName: "配件",
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
        searchableProductCount: 2,
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
      searchableProductCount: 2,
      publicServiceCount: 1,
    });
    expect(detailJson.data.explorationSummary).toEqual({
      dishSearchUrl: "/api/v1/discovery/search?marketSlug=fengjia-night-market",
      serviceSearchUrl:
        "/api/v1/discovery/services?marketSlug=fengjia-night-market",
      dishCategories: [
        {
          categoryName: "配件",
          catalogType: "product",
          count: 1,
          searchUrl: `/api/v1/discovery/search?marketSlug=fengjia-night-market&catalogType=product&categoryName=${encodeURIComponent(
            "配件",
          )}`,
        },
        {
          categoryName: "炸物",
          catalogType: "menu_item",
          count: 1,
          searchUrl: `/api/v1/discovery/search?marketSlug=fengjia-night-market&catalogType=menu_item&categoryName=${encodeURIComponent(
            "炸物",
          )}`,
        },
      ],
      menuItemCategories: [
        {
          categoryName: "炸物",
          catalogType: "menu_item",
          count: 1,
          searchUrl: `/api/v1/discovery/search?marketSlug=fengjia-night-market&catalogType=menu_item&categoryName=${encodeURIComponent(
            "炸物",
          )}`,
        },
      ],
      productCategories: [
        {
          categoryName: "配件",
          catalogType: "product",
          count: 1,
          searchUrl: `/api/v1/discovery/search?marketSlug=fengjia-night-market&catalogType=product&categoryName=${encodeURIComponent(
            "配件",
          )}`,
        },
      ],
      serviceTypes: [
        {
          serviceType: "pickup",
          count: 1,
          searchUrl:
            "/api/v1/discovery/services?marketSlug=fengjia-night-market&serviceType=pickup",
        },
      ],
    });
    expect(detailJson.data.publicReadiness).toMatchObject({
      ready: true,
      score: 100,
      completedCount: 7,
      totalCount: 7,
      issues: [],
    });
  });

  it("finds public markets by searchable catalog and service keywords", async () => {
    const productMarket = await seedMarket(testApp, {
      slug: "catalog-keyword-market",
      name: "第一商圈",
      description: "一般商圈介紹",
      tags: ["商圈"],
    });
    const productVendor = await seed.restaurant({
      name: "Catalog Keyword Vendor",
      city: productMarket.city,
      district: productMarket.district,
      latitude: productMarket.latitude,
      longitude: productMarket.longitude,
      isActive: true,
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(productVendor.id),
      marketId: productMarket.id,
      isPrimary: true,
      joinedAt: new Date(),
    });
    const productItem = await seed.menuItem(String(productVendor.id), {
      name: "星光手機殼",
      price: 180,
      catalogType: "product",
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: productItem.id,
      restaurantId: String(productVendor.id),
      dishName: "星光手機殼",
      dishNameNormalized: "starlightphonecase",
      price: 180,
      catalogType: "product",
      categoryName: "配件",
      isAvailable: true,
      tags: ["手機殼"],
      district: productMarket.district,
      primaryMarketId: productMarket.id,
      marketIds: [productMarket.id],
      latitude: productMarket.latitude,
      longitude: productMarket.longitude,
      updatedAt: new Date(),
    });

    const serviceMarket = await seedMarket(testApp, {
      slug: "service-keyword-market",
      name: "第二商圈",
      description: "一般服務聚落",
      tags: ["商圈"],
    });
    const serviceVendor = await seed.restaurant({
      name: "Service Keyword Vendor",
      city: serviceMarket.city,
      district: serviceMarket.district,
      latitude: serviceMarket.latitude,
      longitude: serviceMarket.longitude,
      isActive: true,
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(serviceVendor.id),
      marketId: serviceMarket.id,
      isPrimary: true,
      joinedAt: new Date(),
    });
    await testApp.testDb.drizzle.insert(restaurantServiceItems).values({
      restaurantId: String(serviceVendor.id),
      name: "代客切水果",
      description: "現場分切並分裝",
      serviceType: "general",
      keywords: "切水果 分裝",
      isActive: true,
      isPublic: true,
      sortOrder: 1,
    });

    const productRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/markets?q=${encodeURIComponent("手機殼")}`,
      ),
    );
    expect(productRes.status).toBe(200);
    const productJson: any = await productRes.json();
    expect(productJson.data.markets.map((market: any) => market.slug)).toEqual([
      "catalog-keyword-market",
    ]);

    const serviceRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/markets?q=${encodeURIComponent("切水果")}`,
      ),
    );
    expect(serviceRes.status).toBe(200);
    const serviceJson: any = await serviceRes.json();
    expect(serviceJson.data.markets.map((market: any) => market.slug)).toEqual([
      "service-keyword-market",
    ]);
  });

  it("hides empty or productless markets from public market listings", async () => {
    const readyMarket = await seedMarket(testApp, {
      slug: "ready-public-market",
      name: "Ready Public Market",
    });
    await seedMarket(testApp, {
      slug: "empty-public-market",
      name: "Empty Public Market",
    });
    const productlessMarket = await seedMarket(testApp, {
      slug: "productless-public-market",
      name: "Productless Public Market",
    });
    await seedSearchableMarket(testApp, seed, {
      slug: "incomplete-profile-public-market",
      name: "Incomplete Profile Public Market",
      description: "",
      address: "",
      openingHours: null,
    });
    const readyRestaurant = await seed.restaurant({
      name: "Ready Public Vendor",
      city: "台中市",
      district: "西屯區",
      isActive: true,
    });
    const productlessRestaurant = await seed.restaurant({
      name: "Productless Public Vendor",
      city: "台中市",
      district: "西屯區",
      isActive: true,
    });

    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values([
      {
        restaurantId: String(readyRestaurant.id),
        marketId: readyMarket.id,
        isPrimary: true,
        joinedAt: new Date(),
      },
      {
        restaurantId: String(productlessRestaurant.id),
        marketId: productlessMarket.id,
        isPrimary: true,
        joinedAt: new Date(),
      },
    ]);
    const menuItem = await seed.menuItem(String(readyRestaurant.id), {
      name: "Ready Public Bao",
      price: 95,
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: menuItem.id,
      restaurantId: String(readyRestaurant.id),
      dishName: "Ready Public Bao",
      dishNameNormalized: "readypublicbao",
      price: 95,
      isAvailable: true,
      tags: [],
      district: "西屯區",
      primaryMarketId: readyMarket.id,
      marketIds: [readyMarket.id],
      updatedAt: new Date(),
    });

    const res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/markets?q=Ready+Public&city=台中市&district=西屯區",
      ),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.data.total).toBe(1);
    expect(json.data.markets.map((market: any) => market.slug)).toEqual([
      "ready-public-market",
    ]);

    const incompleteRes = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/markets?q=Incomplete+Profile&city=台中市&district=西屯區",
      ),
    );
    const incompleteJson: any = await incompleteRes.json();
    expect(incompleteJson.data.markets).toEqual([]);
  });

  it("lists service-only markets as public exploration entrypoints", async () => {
    const market = await seedMarket(testApp, {
      slug: "service-only-market",
      name: "Service Only Market",
      city: "台中市",
      district: "西屯區",
    });
    const vendor = await seed.restaurant({
      name: "Service Only Vendor",
      city: "台中市",
      district: "西屯區",
      latitude: 24.1765,
      longitude: 120.6467,
      isActive: true,
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(vendor.id),
      marketId: market.id,
      stallNumber: "S-01",
      isPrimary: true,
      joinedAt: new Date(),
    });
    await testApp.testDb.drizzle.insert(restaurantServiceItems).values({
      restaurantId: String(vendor.id),
      name: "代客切水果",
      serviceType: "general",
      isActive: true,
      isPublic: true,
      sortOrder: 1,
    });

    const res = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/markets?q=Service+Only&city=台中市&district=西屯區",
      ),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.data.total).toBe(1);
    expect(json.data.markets[0]).toMatchObject({
      id: market.id,
      slug: "service-only-market",
      vendorCount: 1,
      catalogCoverage: {
        searchableProductCount: 0,
        publicServiceCount: 1,
      },
      publicReadiness: {
        ready: true,
      },
    });
  });

  it("counts only active public vendors in market list and detail", async () => {
    const market = await seedMarket(testApp, {
      slug: "active-vendor-count-market",
    });
    const activeRestaurant = await seed.restaurant({
      name: "Active Count Vendor",
      city: "台中市",
      district: "西屯區",
      isActive: true,
    });
    const inactiveRestaurant = await seed.restaurant({
      name: "Inactive Count Vendor",
      city: "台中市",
      district: "西屯區",
      isActive: false,
    });
    const deletedRestaurant = await seed.restaurant({
      name: "Deleted Count Vendor",
      city: "台中市",
      district: "西屯區",
      deletedAt: new Date(),
    });
    const leftRestaurant = await seed.restaurant({
      name: "Left Count Vendor",
      city: "台中市",
      district: "西屯區",
      isActive: true,
    });

    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values([
      {
        restaurantId: String(activeRestaurant.id),
        marketId: market.id,
        joinedAt: new Date(),
      },
      {
        restaurantId: String(inactiveRestaurant.id),
        marketId: market.id,
        joinedAt: new Date(),
      },
      {
        restaurantId: String(deletedRestaurant.id),
        marketId: market.id,
        joinedAt: new Date(),
      },
      {
        restaurantId: String(leftRestaurant.id),
        marketId: market.id,
        joinedAt: new Date(Date.now() - 60_000),
        leftAt: new Date(),
      },
    ]);
    const activeMenuItem = await seed.menuItem(String(activeRestaurant.id), {
      name: "Active Count Bao",
      price: 95,
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: activeMenuItem.id,
      restaurantId: String(activeRestaurant.id),
      dishName: "Active Count Bao",
      dishNameNormalized: "activecountbao",
      price: 95,
      isAvailable: true,
      tags: [],
      district: "西屯區",
      primaryMarketId: market.id,
      marketIds: [market.id],
      updatedAt: new Date(),
    });

    const listRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets?q=active-vendor-count-market"),
    );
    expect(listRes.status).toBe(200);
    const listJson: any = await listRes.json();
    expect(listJson.data.markets).toHaveLength(1);
    expect(listJson.data.markets[0]).toMatchObject({
      id: market.id,
      vendorCount: 1,
    });

    const detailRes = await testApp.app.fetch(
      new Request("https://test/api/v1/markets/active-vendor-count-market"),
    );
    expect(detailRes.status).toBe(200);
    const detailJson: any = await detailRes.json();
    expect(detailJson.data.vendorCount).toBe(1);
    expect(detailJson.data.publicReadiness.issues).not.toContainEqual({
      key: "vendors",
      severity: "required",
    });
  });

  it("lists active market cities and districts for customer filters", async () => {
    await seedSearchableMarket(testApp, seed, {
      slug: "fengjia-area",
      name: "逢甲夜市",
      city: "台中市",
      district: "西屯區",
    });
    await seedSearchableMarket(testApp, seed, {
      slug: "yizhong-area",
      name: "一中商圈",
      city: "台中市",
      district: "北區",
    });
    await seedSearchableMarket(testApp, seed, {
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
    await seedMarket(testApp, {
      slug: "productless-area",
      name: "Productless Area",
      city: "桃園市",
      district: "中壢區",
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
    const fengjiaRestaurant = await seed.restaurant({
      name: "Fengjia Search Vendor",
      city: "台中市",
      district: "西屯區",
      isActive: true,
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(fengjiaRestaurant.id),
      marketId: fengjia.id,
      isPrimary: true,
      joinedAt: new Date(),
    });
    const fengjiaMenuItem = await seed.menuItem(String(fengjiaRestaurant.id), {
      name: "Fengjia Search Chicken",
      price: 95,
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: fengjiaMenuItem.id,
      restaurantId: String(fengjiaRestaurant.id),
      dishName: "Fengjia Search Chicken",
      dishNameNormalized: "fengjiasearchchicken",
      price: 95,
      isAvailable: true,
      tags: [],
      district: "西屯區",
      primaryMarketId: fengjia.id,
      marketIds: [fengjia.id],
      updatedAt: new Date(),
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

  it("does not expose vendors for incomplete public markets", async () => {
    const market = await seedMarket(testApp, {
      slug: "incomplete-market-vendors",
      description: "",
      address: "",
      openingHours: null,
    });
    const vendor = await seed.restaurant({
      name: "Incomplete Public Vendor",
      city: market.city,
      district: market.district,
      isActive: true,
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(vendor.id),
      marketId: market.id,
      isPrimary: true,
      joinedAt: new Date(),
    });

    const vendorsRes = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/markets/incomplete-market-vendors/vendors",
      ),
    );

    expect(vendorsRes.status).toBe(404);
    const vendorsJson: any = await vendorsRes.json();
    expect(vendorsJson.error).toMatchObject({
      code: "MARKET_NOT_FOUND",
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
    const missingStallVendor = await seed.restaurant({
      name: "Missing Stall Vendor",
      city: "台中市",
      district: "西屯區",
      latitude: 24.1771,
      longitude: 120.6471,
    });
    const productOnlyVendor = await seed.restaurant({
      name: "Product Only Vendor",
      city: "台中市",
      district: "西屯區",
      latitude: 24.1773,
      longitude: 120.6473,
    });
    const serviceOnlyVendor = await seed.restaurant({
      name: "Service Only Vendor",
      city: "台中市",
      district: "西屯區",
      latitude: 24.1775,
      longitude: 120.6475,
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
      {
        restaurantId: String(missingStallVendor.id),
        marketId: market.id,
        stallNumber: null,
        isPrimary: false,
        joinedAt: new Date(),
      },
      {
        restaurantId: String(productOnlyVendor.id),
        marketId: market.id,
        stallNumber: "C-03",
        isPrimary: false,
        joinedAt: new Date(),
      },
      {
        restaurantId: String(serviceOnlyVendor.id),
        marketId: market.id,
        stallNumber: "D-04",
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
    const missingStallItem = await seed.menuItem(
      String(missingStallVendor.id),
      {
        name: "No Stall Tea",
        price: 45,
      },
    );
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: missingStallItem.id,
      restaurantId: String(missingStallVendor.id),
      dishName: "No Stall Tea",
      dishNameNormalized: "nostalltea",
      price: 45,
      isAvailable: true,
      tags: [],
      district: "西屯區",
      primaryMarketId: market.id,
      marketIds: [market.id],
      latitude: 24.1771,
      longitude: 120.6471,
      updatedAt: new Date(),
    });
    await testApp.testDb.drizzle.insert(restaurantServiceItems).values({
      restaurantId: String(missingStallVendor.id),
      name: "免攤位服務",
      serviceType: "booking",
      isActive: true,
      isPublic: true,
      sortOrder: 1,
    });
    const productOnlyItem = await seed.menuItem(String(productOnlyVendor.id), {
      name: "Product Only Snack",
      price: 60,
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: productOnlyItem.id,
      restaurantId: String(productOnlyVendor.id),
      dishName: "Product Only Snack",
      dishNameNormalized: "productonlysnack",
      price: 60,
      isAvailable: true,
      tags: [],
      district: "西屯區",
      primaryMarketId: market.id,
      marketIds: [market.id],
      latitude: 24.1773,
      longitude: 120.6473,
      updatedAt: new Date(),
    });
    await testApp.testDb.drizzle.insert(restaurantServiceItems).values({
      restaurantId: String(serviceOnlyVendor.id),
      name: "純服務入口",
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
      searchableProductCount: 3,
      publicServiceCount: 3,
      vendorsWithSearchableProducts: 3,
      vendorsMissingSearchableProducts: 2,
      vendorsWithPublicServices: 3,
      vendorsMissingPublicServices: 2,
      vendorsMissingStallNumbers: 1,
      vendorsMissingSearchEntrypoints: 1,
    });
    expect(readinessMarket.catalogCoverage.missingProductVendors).toEqual(
      expect.arrayContaining([
        {
          restaurantId: String(missingVendor.id),
          name: "Missing Catalog Vendor",
          stallNumber: "B-02",
        },
        {
          restaurantId: String(serviceOnlyVendor.id),
          name: "Service Only Vendor",
          stallNumber: "D-04",
        },
      ]),
    );
    expect(readinessMarket.catalogCoverage.missingServiceVendors).toEqual(
      expect.arrayContaining([
        {
          restaurantId: String(missingVendor.id),
          name: "Missing Catalog Vendor",
          stallNumber: "B-02",
        },
        {
          restaurantId: String(productOnlyVendor.id),
          name: "Product Only Vendor",
          stallNumber: "C-03",
        },
      ]),
    );
    expect(readinessMarket.catalogCoverage.missingStallNumberVendors).toEqual([
      {
        restaurantId: String(missingStallVendor.id),
        name: "Missing Stall Vendor",
        stallNumber: null,
      },
    ]);
    expect(
      readinessMarket.catalogCoverage.missingSearchEntrypointVendors,
    ).toEqual([
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
    expect(
      readinessMarket.catalogCoverage.missingSearchEntrypointVendors,
    ).toHaveLength(6);
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
    await seedMarket(testApp, {
      slug: "west-empty-area-market",
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
      marketCount: 2,
      vendorCount: 2,
      vendorsMissingSearchableProducts: 2,
      vendorsMissingPublicServices: 2,
      totalCatalogGapVendors: 4,
      marketsWithoutVendors: 1,
      marketsWithoutSearchableCatalog: 2,
    });
    expect(json.data.areas[1]).toMatchObject({
      city: "台中市",
      district: "北區",
      marketCount: 1,
      vendorCount: 1,
      vendorsMissingSearchableProducts: 0,
      vendorsMissingPublicServices: 1,
      totalCatalogGapVendors: 1,
      marketsWithoutVendors: 0,
      marketsWithoutSearchableCatalog: 0,
    });
  });

  it("exposes market pages through sitemap.xml and robots.txt", async () => {
    const { market: activeMarket } = await seedSearchableMarket(testApp, seed, {
      slug: "seo-night-market",
      name: "SEO Night Market",
      updatedAt: new Date("2026-05-20T12:00:00.000Z"),
    });
    await seedServiceOnlyMarket(testApp, seed, {
      slug: "seo-service-market",
      name: "SEO Service Market",
      updatedAt: new Date("2026-05-19T12:00:00.000Z"),
    });
    await seedMarket(testApp, {
      slug: "inactive-night-market",
      name: "Inactive Night Market",
      isActive: false,
      updatedAt: new Date("2026-05-21T12:00:00.000Z"),
    });
    await seedMarket(testApp, {
      slug: "productless-night-market",
      name: "Productless Night Market",
      updatedAt: new Date("2026-05-22T12:00:00.000Z"),
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
    expect(sitemapXml).toContain(
      "<loc>https://makanmakan.app/markets/seo-service-market</loc>",
    );
    expect(sitemapXml).toContain("<lastmod>2026-05-20</lastmod>");
    expect(sitemapXml).toContain("<lastmod>2026-05-19</lastmod>");
    expect(sitemapXml).not.toContain("inactive-night-market");
    expect(sitemapXml).not.toContain("productless-night-market");
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
    const serviceVendor = await seed.restaurant({
      name: "Key Cutting Booth",
      type: "market_stall",
      category: "services",
      city: "台中市",
      district: "北區",
      businessHours: openAllWeek(),
      latitude: 24.17655,
      longitude: 120.64675,
      supportsTakeaway: false,
      supportsDelivery: false,
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(serviceVendor.id),
      marketId: nearMarket.id,
      stallNumber: "R-88",
      isPrimary: false,
      joinedAt: new Date(),
    });
    const menuItem = await seed.menuItem(String(vendor.id), {
      name: "Bubble Tea",
      price: 65,
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: menuItem.id,
      restaurantId: String(vendor.id),
      dishName: "Bubble Tea",
      dishNameNormalized: "bubbletea",
      price: 65,
      isAvailable: true,
      tags: [],
      district: "西屯區",
      primaryMarketId: nearMarket.id,
      marketIds: [nearMarket.id],
      latitude: 24.1765,
      longitude: 120.6467,
      updatedAt: new Date(),
    });
    await testApp.testDb.drizzle.insert(restaurantServiceItems).values({
      restaurantId: String(vendor.id),
      name: "外帶自取",
      serviceType: "pickup",
      isActive: true,
      isPublic: true,
      sortOrder: 1,
    });
    const productlessNearMarket = await seedMarket(testApp, {
      slug: "productless-near-market",
      latitude: 24.17645,
      longitude: 120.64665,
    });
    const productlessVendor = await seed.restaurant({
      name: "Productless Nearby Stand",
      city: "台中市",
      district: "西屯區",
      latitude: 24.17646,
      longitude: 120.64666,
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(productlessVendor.id),
      marketId: productlessNearMarket.id,
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
      detailUrl: `/api/v1/restaurants/${vendor.id}`,
      menuUrl: `/api/v1/menu/${vendor.id}`,
      serviceItemsUrl: `/api/v1/restaurants/${vendor.id}/service-items`,
      availableMenuItemCount: 1,
      publicServiceItemCount: 1,
    });

    for (const query of ["R-88", "services", "北區"]) {
      const searchRes = await testApp.app.fetch(
        new Request(
          `https://test/api/v1/markets/near-market/vendors?q=${encodeURIComponent(query)}`,
        ),
      );
      expect(searchRes.status).toBe(200);
      const searchJson: any = await searchRes.json();
      expect(searchJson.data.total).toBe(1);
      expect(searchJson.data.vendors[0]).toMatchObject({
        restaurantId: String(serviceVendor.id),
        name: "Key Cutting Booth",
        stallNumber: "R-88",
        category: "services",
        district: "北區",
      });
    }

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
      vendorCount: 2,
      catalogCoverage: {
        searchableProductCount: 1,
        publicServiceCount: 1,
      },
      publicReadiness: {
        ready: true,
      },
    });
    expect(nearbyJson.data.markets[0].distanceKm).toBeLessThan(0.1);
  });

  it("filters open market vendors before pagination", async () => {
    const market = await seedMarket(testApp, {
      slug: "open-vendor-pagination-market",
    });
    const closedVendor = await seed.restaurant({
      name: "Closed Popular Stand",
      businessHours: closedAllWeek(),
      totalOrders: 50,
    });
    const openVendor = await seed.restaurant({
      name: "Open Smaller Stand",
      businessHours: openAllWeek(),
      totalOrders: 10,
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values([
      {
        restaurantId: String(closedVendor.id),
        marketId: market.id,
        stallNumber: "A-01",
        joinedAt: new Date(),
      },
      {
        restaurantId: String(openVendor.id),
        marketId: market.id,
        stallNumber: "A-02",
        joinedAt: new Date(),
      },
    ]);
    const openVendorItem = await seed.menuItem(String(openVendor.id), {
      name: "Open Vendor Searchable Item",
      price: 80,
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: openVendorItem.id,
      restaurantId: String(openVendor.id),
      dishName: "Open Vendor Searchable Item",
      dishNameNormalized: "openvendorsearchableitem",
      price: 80,
      isAvailable: true,
      tags: [],
      district: market.district,
      primaryMarketId: market.id,
      marketIds: [market.id],
      latitude: market.latitude,
      longitude: market.longitude,
      updatedAt: new Date(),
    });

    const vendorsRes = await testApp.app.fetch(
      new Request(
        "https://test/api/v1/markets/open-vendor-pagination-market/vendors?openNow=true&limit=1&sortBy=popular",
      ),
    );

    expect(vendorsRes.status).toBe(200);
    const vendorsJson: any = await vendorsRes.json();
    expect(vendorsJson.data.total).toBe(1);
    expect(vendorsJson.data.vendors).toHaveLength(1);
    expect(vendorsJson.data.vendors[0]).toMatchObject({
      restaurantId: String(openVendor.id),
      name: "Open Smaller Stand",
      stallNumber: "A-02",
      isOpen: true,
    });
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
        "https://test/api/v1/discovery/search?q=Market+Bao&marketSlug=yizhong",
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

  it("exposes public restaurant market memberships for shop context", async () => {
    const activeMarket = await seedMarket(testApp, {
      slug: "public-shop-context-market",
      name: "Public Shop Context Market",
      type: "commercial_district",
      city: "台中市",
      district: "北區",
    });
    const inactiveMarket = await seedMarket(testApp, {
      slug: "hidden-shop-context-market",
      name: "Hidden Shop Context Market",
      isActive: false,
    });
    const restaurant = await seed.restaurant({
      name: "Shop Context Vendor",
      city: activeMarket.city,
      district: activeMarket.district,
      isActive: true,
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values([
      {
        restaurantId: String(restaurant.id),
        marketId: activeMarket.id,
        stallNumber: "A-18",
        isPrimary: true,
        joinedAt: new Date(),
      },
      {
        restaurantId: String(restaurant.id),
        marketId: inactiveMarket.id,
        stallNumber: "H-01",
        isPrimary: false,
        joinedAt: new Date(),
      },
    ]);

    const res = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/restaurants/${restaurant.id}/markets`,
      ),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.data.memberships).toEqual([
      {
        marketId: activeMarket.id,
        stallNumber: "A-18",
        isPrimary: true,
        market: {
          id: activeMarket.id,
          slug: "public-shop-context-market",
          name: "Public Shop Context Market",
          type: "commercial_district",
          city: "台中市",
          district: "北區",
        },
        marketUrl: "/markets/public-shop-context-market",
      },
    ]);
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

    const duplicateVendorRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/admin/markets/${marketId}/vendors`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          restaurantId: String(restaurant.id),
          stallNumber: "A-01",
        }),
      }),
    );
    expect(duplicateVendorRes.status).toBe(409);
    expect(((await duplicateVendorRes.json()) as any).error).toMatchObject({
      code: "MARKET_VENDOR_ALREADY_ATTACHED",
    });

    const updateVendorRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/admin/markets/${marketId}/vendors/${vendorJson.data.membership.restaurantId}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            stallNumber: "A-02",
            isPrimary: false,
          }),
        },
      ),
    );
    expect(updateVendorRes.status).toBe(200);
    expect(
      ((await updateVendorRes.json()) as any).data.membership,
    ).toMatchObject({
      restaurantId: String(restaurant.id),
      marketId,
      stallNumber: "A-02",
      isPrimary: false,
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

  it("syncs discovery search scope when admins add and remove market vendors", async () => {
    const adminRestaurant = await seed.restaurant({
      name: "Vendor Discovery Admin",
      latitude: 24.15,
      longitude: 120.67,
    });
    await seed.user({
      id: 44,
      username: "vendor-discovery-admin",
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
      slug: "vendor-discovery-sync-market",
    });
    const restaurant = await seed.restaurant({
      name: "Vendor Discovery Sync Stall",
      city: "台中市",
      district: "西屯區",
      latitude: 24.1764,
      longitude: 120.6466,
    });
    const item = await seed.menuItem(String(restaurant.id), {
      name: "Vendor Discovery Sync Bao",
      price: 60,
    });
    await testApp.testDb.drizzle.insert(dishSearchIndex).values({
      menuItemId: item.id,
      restaurantId: String(restaurant.id),
      dishName: "Vendor Discovery Sync Bao",
      dishNameNormalized: "vendordiscoverysyncbao",
      price: 60,
      isAvailable: true,
      tags: [],
      district: "西屯區",
      primaryMarketId: null,
      marketIds: [],
      latitude: 24.1764,
      longitude: 120.6466,
      updatedAt: new Date(),
    });

    const cachedEmptyRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/search?q=Vendor+Discovery+Sync&marketId=${market.id}`,
      ),
    );
    expect(cachedEmptyRes.status).toBe(200);
    expect(((await cachedEmptyRes.json()) as any).data.total).toBe(0);

    const addVendorRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/admin/markets/${market.id}/vendors`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          restaurantId: String(restaurant.id),
          stallNumber: "B-01",
          isPrimary: true,
        }),
      }),
    );
    expect(addVendorRes.status).toBe(201);

    const [afterAddIndex] = await testApp.testDb.drizzle
      .select({
        primaryMarketId: dishSearchIndex.primaryMarketId,
        marketIds: dishSearchIndex.marketIds,
      })
      .from(dishSearchIndex)
      .where(eq(dishSearchIndex.menuItemId, item.id))
      .limit(1);
    expect(afterAddIndex).toEqual({
      primaryMarketId: market.id,
      marketIds: [market.id],
    });

    const afterAddSearchRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/search?q=Vendor+Discovery+Sync&marketId=${market.id}`,
      ),
    );
    expect(afterAddSearchRes.status).toBe(200);
    const afterAddSearchJson: any = await afterAddSearchRes.json();
    expect(
      afterAddSearchJson.data.results.map((r: any) => r.menuItemId),
    ).toEqual([item.id]);
    expect(afterAddSearchJson.data.total).toBe(1);

    const removeVendorRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/admin/markets/${market.id}/vendors/${restaurant.id}`,
        {
          method: "DELETE",
          headers,
        },
      ),
    );
    expect(removeVendorRes.status).toBe(200);
    expect(((await removeVendorRes.json()) as any).data.removed).toBe(true);

    const [afterRemoveIndex] = await testApp.testDb.drizzle
      .select({
        primaryMarketId: dishSearchIndex.primaryMarketId,
        marketIds: dishSearchIndex.marketIds,
      })
      .from(dishSearchIndex)
      .where(eq(dishSearchIndex.menuItemId, item.id))
      .limit(1);
    expect(afterRemoveIndex).toEqual({
      primaryMarketId: null,
      marketIds: [],
    });

    const afterRemoveSearchRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/search?q=Vendor+Discovery+Sync&marketId=${market.id}`,
      ),
    );
    expect(afterRemoveSearchRes.status).toBe(200);
    const afterRemoveSearchJson: any = await afterRemoveSearchRes.json();
    expect(afterRemoveSearchJson.data.results).toEqual([]);
    expect(afterRemoveSearchJson.data.total).toBe(0);
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
                latitude: 24.1791,
                longitude: 120.6479,
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
      catalogReadiness: {
        searchableProductCount: 0,
        publicServiceCount: 0,
        vendorsWithSearchableProducts: 0,
        vendorsMissingSearchableProducts: 2,
        vendorsWithPublicServices: 0,
        vendorsMissingPublicServices: 2,
        vendorsMissingStallNumbers: 0,
        vendorsMissingSearchEntrypoints: 2,
      },
      publicReadiness: {
        ready: false,
        score: 71,
        completedCount: 5,
        totalCount: 7,
        issues: [
          { key: "products", severity: "required" },
          { key: "services", severity: "recommended" },
        ],
      },
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
    expect(importJson.data.catalogReadiness.missingProductVendors).toEqual(
      expect.arrayContaining([
        {
          restaurantId: String(existingRestaurant.id),
          name: "Existing Import Vendor",
          stallNumber: "A-01",
        },
        expect.objectContaining({
          name: "新匯入蚵仔煎",
          stallNumber: "B-02",
        }),
      ]),
    );
    expect(importJson.data.catalogReadiness.missingServiceVendors).toEqual(
      expect.arrayContaining([
        {
          restaurantId: String(existingRestaurant.id),
          name: "Existing Import Vendor",
          stallNumber: "A-01",
        },
        expect.objectContaining({
          name: "新匯入蚵仔煎",
          stallNumber: "B-02",
        }),
      ]),
    );
    expect(
      importJson.data.catalogReadiness.missingSearchEntrypointVendors,
    ).toHaveLength(2);

    const memberships = await testApp.testDb.drizzle
      .select({
        restaurantId: restaurantMarketMemberships.restaurantId,
        stallNumber: restaurantMarketMemberships.stallNumber,
      })
      .from(restaurantMarketMemberships)
      .where(eq(restaurantMarketMemberships.marketId, market.id));
    expect(memberships).toEqual(
      expect.arrayContaining([
        { restaurantId: String(existingRestaurant.id), stallNumber: "A-01" },
        expect.objectContaining({ stallNumber: "B-02" }),
      ]),
    );
    expect(memberships).toHaveLength(2);

    const [importedVendor] = await testApp.testDb.drizzle
      .select({
        name: restaurants.name,
        latitude: restaurants.latitude,
        longitude: restaurants.longitude,
      })
      .from(restaurants)
      .where(eq(restaurants.name, "新匯入蚵仔煎"))
      .limit(1);
    expect(importedVendor).toMatchObject({
      name: "新匯入蚵仔煎",
      latitude: 24.1791,
      longitude: 120.6479,
    });

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

  it("lets platform admins dry-run vendor imports before mutating data", async () => {
    const adminRestaurant = await seed.restaurant({
      name: "Vendor Import Dry Run Admin",
      latitude: 24.15,
      longitude: 120.67,
    });
    const existingRestaurant = await seed.restaurant({
      name: "Existing Dry Run Vendor",
      city: "台中市",
      district: "西屯區",
      address: "台中市西屯區既有預檢攤位",
      phone: "0233333333",
    });
    await seed.user({
      id: 45,
      username: "vendor-import-dry-run-admin",
      role: 0,
      restaurantId: String(adminRestaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(adminRestaurant.id),
    );
    const market = await seedMarket(testApp, {
      slug: "bulk-import-dry-run-market",
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(existingRestaurant.id),
      marketId: market.id,
      stallNumber: "A-01",
      isPrimary: true,
      joinedAt: new Date(),
    });
    const headers = {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
      ...CSRF_HEADERS,
    };

    const dryRunRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/admin/markets/${market.id}/vendor-imports`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            dryRun: true,
            vendors: [
              {
                restaurantId: String(existingRestaurant.id),
                stallNumber: "A-01",
              },
              {
                restaurantId: "missing-dry-run-restaurant",
                stallNumber: "B-02",
              },
              {
                name: "預檢新攤商",
                type: "street_food",
                category: "food",
                address: "台中市西屯區文華路 200 號",
                district: "西屯區",
                stallNumber: "C-03",
              },
              {
                name: "預檢新攤商",
                type: "street_food",
                category: "food",
                address: "台中市西屯區文華路 200 號",
                district: "西屯區",
                stallNumber: "C-04",
              },
            ],
          }),
        },
      ),
    );

    expect(dryRunRes.status).toBe(200);
    const dryRunJson: any = await dryRunRes.json();
    expect(dryRunJson.data).toMatchObject({
      dryRun: true,
      wouldCreateRestaurants: 1,
      wouldAttachVendors: 1,
      skipped: 3,
      publicReadiness: {
        ready: false,
        score: 71,
        completedCount: 5,
        totalCount: 7,
        issues: [
          { key: "products", severity: "required" },
          { key: "services", severity: "recommended" },
        ],
      },
    });
    expect(dryRunJson.data.results).toEqual([
      expect.objectContaining({
        status: "skipped",
        reason: "already_attached",
        restaurantId: String(existingRestaurant.id),
      }),
      expect.objectContaining({
        status: "skipped",
        reason: "restaurant_not_found",
        restaurantId: "missing-dry-run-restaurant",
      }),
      expect.objectContaining({
        status: "would_create",
        restaurantName: "預檢新攤商",
        stallNumber: "C-03",
      }),
      expect.objectContaining({
        status: "skipped",
        reason: "duplicate_in_payload",
        restaurantName: "預檢新攤商",
        stallNumber: "C-04",
      }),
    ]);
    expect(dryRunJson.data.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          index: 0,
          code: "already_attached",
          severity: "blocking",
        }),
        expect.objectContaining({
          index: 1,
          code: "restaurant_not_found",
          severity: "blocking",
        }),
        expect.objectContaining({
          index: 2,
          code: "phone_defaulted",
          severity: "warning",
          field: "phone",
        }),
        expect.objectContaining({
          index: 2,
          code: "city_defaulted",
          severity: "warning",
          field: "city",
        }),
        expect.objectContaining({
          index: 2,
          code: "coordinates_missing",
          severity: "warning",
          field: "coordinates",
        }),
        expect.objectContaining({
          index: 3,
          code: "duplicate_in_payload",
          severity: "blocking",
        }),
      ]),
    );

    const memberships = await testApp.testDb.drizzle
      .select({ restaurantId: restaurantMarketMemberships.restaurantId })
      .from(restaurantMarketMemberships)
      .where(eq(restaurantMarketMemberships.marketId, market.id));
    expect(memberships).toEqual([
      { restaurantId: String(existingRestaurant.id) },
    ]);

    const [createdRestaurant] = await testApp.testDb.drizzle
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.name, "預檢新攤商"))
      .limit(1);
    expect(createdRestaurant).toBeUndefined();
  });

  it("skips duplicate vendors in a live bulk import payload", async () => {
    const adminRestaurant = await seed.restaurant({
      name: "Vendor Duplicate Import Admin",
      latitude: 24.15,
      longitude: 120.67,
    });
    const existingRestaurant = await seed.restaurant({
      name: "Existing Duplicate Import Vendor",
      city: "台中市",
      district: "西屯區",
      address: "台中市西屯區重複攤位",
      phone: "0244444444",
    });
    await seed.user({
      id: 46,
      username: "vendor-import-duplicate-admin",
      role: 0,
      restaurantId: String(adminRestaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(adminRestaurant.id),
    );
    const market = await seedMarket(testApp, {
      slug: "bulk-import-duplicate-market",
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
              },
              {
                restaurantId: String(existingRestaurant.id),
                stallNumber: "A-02",
              },
              {
                name: "正式匯入重複新攤商",
                type: "street_food",
                category: "food",
                address: "台中市西屯區文華路 300 號",
                district: "西屯區",
                city: "台中市",
                phone: "0255555555",
                stallNumber: "B-01",
              },
              {
                name: "正式匯入重複新攤商",
                type: "street_food",
                category: "food",
                address: "台中市西屯區文華路 300 號",
                district: "西屯區",
                city: "台中市",
                phone: "0255555555",
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
      skipped: 2,
      issueCount: 2,
      blockingIssueCount: 2,
    });
    expect(importJson.data.results).toEqual([
      expect.objectContaining({
        status: "attached",
        restaurantId: String(existingRestaurant.id),
        stallNumber: "A-01",
      }),
      expect.objectContaining({
        status: "skipped",
        reason: "duplicate_in_payload",
        restaurantId: String(existingRestaurant.id),
        stallNumber: "A-02",
      }),
      expect.objectContaining({
        status: "created",
        restaurantName: "正式匯入重複新攤商",
        stallNumber: "B-01",
      }),
      expect.objectContaining({
        status: "skipped",
        reason: "duplicate_in_payload",
        restaurantName: "正式匯入重複新攤商",
        stallNumber: "B-02",
      }),
    ]);
    expect(importJson.data.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          index: 1,
          code: "duplicate_in_payload",
          severity: "blocking",
        }),
        expect.objectContaining({
          index: 3,
          code: "duplicate_in_payload",
          severity: "blocking",
        }),
      ]),
    );

    const memberships = await testApp.testDb.drizzle
      .select({ restaurantId: restaurantMarketMemberships.restaurantId })
      .from(restaurantMarketMemberships)
      .where(eq(restaurantMarketMemberships.marketId, market.id));
    expect(memberships).toHaveLength(2);

    const createdRows = await testApp.testDb.drizzle
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.name, "正式匯入重複新攤商"));
    expect(createdRows).toHaveLength(1);
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

  it("approves a pending join request when the vendor was already attached", async () => {
    const restaurant = await seed.restaurant({
      name: "Already Attached Join Vendor",
      latitude: 24.15,
      longitude: 120.67,
    });
    await seed.user({
      id: 24,
      username: "already-attached-join-admin",
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
    const market = await seedMarket(testApp, {
      slug: "already-attached-join-market",
      name: "Already Attached Join Market",
    });

    const requestRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/market-join-requests`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ marketId: market.id }),
        },
      ),
    );
    expect(requestRes.status).toBe(201);
    const requestJson: any = await requestRes.json();

    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(restaurant.id),
      marketId: market.id,
      stallNumber: "B-12",
      joinedAt: new Date(),
    });

    const approveRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/admin/markets/join-requests/${requestJson.data.request.id}/approve`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            stallNumber: "B-12",
            isPrimary: true,
          }),
        },
      ),
    );
    expect(approveRes.status).toBe(200);
    const approveJson: any = await approveRes.json();
    expect(approveJson.data.request).toMatchObject({
      id: requestJson.data.request.id,
      status: "approved",
    });
    expect(approveJson.data.membership).toMatchObject({
      restaurantId: String(restaurant.id),
      marketId: market.id,
      stallNumber: "B-12",
      isPrimary: true,
    });

    const memberships = await testApp.testDb.drizzle
      .select({ id: restaurantMarketMemberships.id })
      .from(restaurantMarketMemberships)
      .where(
        and(
          eq(restaurantMarketMemberships.restaurantId, String(restaurant.id)),
          eq(restaurantMarketMemberships.marketId, market.id),
          isNull(restaurantMarketMemberships.leftAt),
        ),
      );
    expect(memberships).toHaveLength(1);
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
