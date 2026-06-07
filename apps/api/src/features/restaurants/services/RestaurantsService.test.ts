import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const dbService = {
    getRestaurants: vi.fn(),
    getRestaurant: vi.fn(),
    createRestaurant: vi.fn(),
    updateRestaurant: vi.fn(),
    deactivateRestaurant: vi.fn(),
    getRestaurantStats: vi.fn(),
    searchNearbyRestaurants: vi.fn(),
    getPopularRestaurants: vi.fn(),
    generateShopQrCode: vi.fn(),
    regenerateShopQrCode: vi.fn(),
    getShopQrCodeInfo: vi.fn(),
    updateShopQrCodeImage: vi.fn(),
    updateShopMode: vi.fn(),
    verifyShopQrCode: vi.fn(),
  };
  const subscriptionService = {
    provisionDefaultForRestaurant: vi.fn(),
  };
  const cache = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  };
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  return { dbService, subscriptionService, cache, logger, db };
});

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

vi.mock("../../../core/cache", () => ({
  KVCacheService: vi.fn(function KVCacheService() {
    return mocks.cache;
  }),
}));

vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function ConsoleLogger() {
    return mocks.logger;
  }),
}));

vi.mock("../../subscriptions/services/SubscriptionService", () => ({
  SubscriptionService: vi.fn(function SubscriptionService() {
    return mocks.subscriptionService;
  }),
}));

vi.mock("@makanmakan/database", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    RestaurantService: vi.fn(function RestaurantService() {
      return mocks.dbService;
    }),
  };
});

import { RestaurantsService } from "./RestaurantsService";

function createService() {
  return new RestaurantsService(
    {} as D1Database,
    { DB: {} as D1Database, CACHE_KV: {} as KVNamespace } as any,
    {} as KVNamespace,
  );
}

const restaurant = {
  id: "restaurant-1",
  name: "Makan",
  type: "malaysian",
  district: "Central",
};

describe("RestaurantsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached restaurant lists using stable sorted filter cache keys", async () => {
    const cached = {
      restaurants: [restaurant],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
    };
    mocks.cache.get.mockResolvedValue(cached);

    await expect(
      createService().getRestaurants({
        limit: 10,
        page: 2,
        district: "Central",
        type: "malaysian",
        isAvailable: true,
      }),
    ).resolves.toBe(cached);

    expect(mocks.cache.get).toHaveBeenCalledWith(
      "restaurants:list:district:Central:isAvailable:true:limit:10:page:2:type:malaysian",
    );
    expect(mocks.dbService.getRestaurants).not.toHaveBeenCalled();
  });

  it("loads restaurant list and detail misses through database service and caches them", async () => {
    const list = {
      restaurants: [restaurant],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    mocks.cache.get.mockResolvedValue(null);
    mocks.dbService.getRestaurants.mockResolvedValue(list);
    mocks.dbService.getRestaurant.mockResolvedValue(restaurant);

    await expect(
      createService().getRestaurants({ district: "Central", page: 1 }),
    ).resolves.toBe(list);
    await expect(createService().getRestaurant("restaurant-1")).resolves.toBe(
      restaurant,
    );

    expect(mocks.dbService.getRestaurants).toHaveBeenCalledWith({
      page: 1,
      limit: undefined,
      type: undefined,
      district: "Central",
      isAvailable: undefined,
    });
    expect(mocks.cache.set).toHaveBeenCalledWith(
      "restaurants:list:district:Central:page:1",
      list,
      expect.any(Number),
    );
    expect(mocks.cache.set).toHaveBeenCalledWith(
      "restaurant:restaurant-1",
      restaurant,
      expect.any(Number),
    );
  });

  it("updates restaurants and clears detail plus list caches", async () => {
    mocks.dbService.updateRestaurant.mockResolvedValue({
      ...restaurant,
      name: "Updated Makan",
    });

    await expect(
      createService().updateRestaurant("restaurant-1", {
        name: "Updated Makan",
      }),
    ).resolves.toMatchObject({ name: "Updated Makan" });

    expect(mocks.cache.delete).toHaveBeenCalledWith("restaurant:restaurant-1");
    expect(mocks.cache.clear).toHaveBeenCalledWith("restaurants:list:*");
    expect(mocks.cache.clear).toHaveBeenCalledWith("restaurants:nearby:*");
    expect(mocks.cache.clear).toHaveBeenCalledWith("restaurants:popular:*");
    expect(mocks.logger.debug).toHaveBeenCalledWith(
      "Emitting restaurant event",
      expect.objectContaining({ type: "RESTAURANT_UPDATED" }),
    );
  });

  it("transforms and caches basic restaurant statistics", async () => {
    mocks.cache.get.mockResolvedValue(null);
    mocks.dbService.getRestaurantStats.mockResolvedValue({
      totalMenuItems: 12,
      totalTables: 4,
    });

    await expect(
      createService().getRestaurantStats("restaurant-1"),
    ).resolves.toEqual({
      totalOrders: 0,
      todayOrders: 0,
      totalRevenue: 0,
      todayRevenue: 0,
      averageOrderValue: 0,
      activeMenuItems: 12,
      totalTables: 4,
      occupiedTables: 0,
      popularItems: [],
      ordersByHour: [],
      customerRetention: {
        newCustomers: 0,
        returningCustomers: 0,
        retentionRate: 0,
      },
    });
    expect(mocks.cache.set).toHaveBeenCalledWith(
      "restaurant:restaurant-1:stats",
      expect.objectContaining({ activeMenuItems: 12, totalTables: 4 }),
      expect.any(Number),
    );
  });

  it("maps service item rows with null-safe optional collections", () => {
    expect(
      (createService() as any).mapServiceItem({
        id: 1,
        restaurantId: "restaurant-1",
        name: "Table styling",
        description: null,
        serviceType: "booking",
        priceCents: 5000,
        priceLabel: null,
        durationMinutes: 60,
        requiresBooking: true,
        bookingUrl: null,
        availableHours: null,
        tags: null,
        keywords: null,
        sortOrder: 3,
        isActive: true,
        isPublic: true,
      }),
    ).toEqual({
      id: 1,
      restaurantId: "restaurant-1",
      name: "Table styling",
      description: null,
      serviceType: "booking",
      priceCents: 5000,
      priceLabel: null,
      durationMinutes: 60,
      requiresBooking: true,
      bookingUrl: null,
      availableHours: null,
      tags: [],
      keywords: null,
      sortOrder: 3,
      isActive: true,
      isPublic: true,
    });
  });

  it("wraps shop QR operations with cache invalidation and result normalization", async () => {
    mocks.dbService.generateShopQrCode.mockResolvedValue({
      qrCode: "shop-qr",
      qrCodeImageUrl: null,
      version: 1,
    });
    mocks.dbService.getShopQrCodeInfo.mockResolvedValue({
      qrCode: "shop-qr",
      qrCodeImageUrl: "https://cdn.example/qr.png",
      enabled: true,
      version: 1,
      settings: { mode: "pickup" },
    });
    mocks.dbService.verifyShopQrCode.mockResolvedValue({
      valid: true,
      restaurantId: "restaurant-1",
      restaurant,
    });

    await expect(
      createService().generateShopQrCode("restaurant-1"),
    ).resolves.toEqual({
      qrCode: "shop-qr",
      qrCodeImageUrl: null,
      version: 1,
    });
    await expect(
      createService().getShopQrCodeInfo("restaurant-1"),
    ).resolves.toMatchObject({ enabled: true, settings: { mode: "pickup" } });
    await createService().updateShopMode("restaurant-1", true, {
      mode: "pickup",
    });
    await expect(createService().verifyShopQrCode("shop-qr")).resolves.toEqual({
      valid: true,
      restaurantId: "restaurant-1",
      restaurant,
    });

    expect(mocks.cache.delete).toHaveBeenCalledWith("restaurant:restaurant-1");
    expect(mocks.cache.delete).toHaveBeenCalledWith(
      "restaurant:restaurant-1:shop-qr",
    );
    expect(mocks.cache.set).toHaveBeenCalledWith(
      "restaurant:restaurant-1:shop-qr",
      expect.objectContaining({ qrCode: "shop-qr" }),
      expect.any(Number),
    );
    expect(mocks.dbService.updateShopMode).toHaveBeenCalledWith(
      "restaurant-1",
      true,
      { mode: "pickup" },
    );
  });
});
