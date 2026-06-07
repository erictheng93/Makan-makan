import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/utils/api-error";

const auth = vi.hoisted(() => ({
  user: { id: 1, role: 0 },
}));

const services = vi.hoisted(() => ({
  read: {
    searchDishes: vi.fn(),
    listDishCategories: vi.fn(),
    searchServices: vi.fn(),
    listServiceTypes: vi.fn(),
    browseRestaurants: vi.fn(),
    getTakeawayEligibility: vi.fn(),
    getRestaurantMarkets: vi.fn(),
    getRestaurantServices: vi.fn(),
    getRestaurantMenu: vi.fn(),
    getPopular: vi.fn(),
  },
  createDiscoveryRead: vi.fn(),
  discoveryCtor: vi.fn(),
  getIndexStatus: vi.fn(),
  reindex: vi.fn(),
  semanticCtor: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", auth.user);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../services/DiscoveryService", () => ({
  createDiscoveryRead: services.createDiscoveryRead,
  DiscoveryService: vi.fn(function DiscoveryService(...args: unknown[]) {
    services.discoveryCtor(...args);
    return {
      getIndexStatus: services.getIndexStatus,
      reindex: services.reindex,
    };
  }),
}));

vi.mock("../services/SemanticDiscoveryService", () => ({
  SemanticDiscoveryService: vi.fn(function SemanticDiscoveryService(
    ...args: unknown[]
  ) {
    services.semanticCtor(...args);
    return { semantic: true };
  }),
}));

import routes from "./index";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }

  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function createEnv() {
  return {
    DB: { binding: "db" },
    CACHE_KV: { binding: "kv" },
    AI: { binding: "ai" },
    DISCOVERY_VECTORIZE: { binding: "vectorize" },
    DISCOVERY_EMBEDDING_MODEL: "bge-small",
  };
}

function request(path: string, method = "GET") {
  const waitUntil = vi.fn();
  const response = routes.fetch(
    new Request(`http://localhost${path}`, { method }),
    createEnv() as never,
    { waitUntil } as never,
  );

  return { response, waitUntil };
}

async function json(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: unknown;
    error?: { code?: string; message?: string; details?: unknown };
  };
}

describe("discovery routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.createDiscoveryRead.mockReturnValue(services.read);
    services.read.searchDishes.mockResolvedValue({
      results: [{ menuItemId: 101, dishName: "Laksa" }],
      total: 1,
      page: 2,
      limit: 5,
    });
    services.read.listDishCategories.mockResolvedValue({
      categories: ["Noodles"],
    });
    services.read.searchServices.mockResolvedValue({
      results: [{ id: 7, name: "Delivery" }],
      total: 1,
      page: 1,
      limit: 20,
    });
    services.read.listServiceTypes.mockResolvedValue({
      serviceTypes: ["delivery"],
    });
    services.read.browseRestaurants.mockResolvedValue({
      results: [{ id: "restaurant-1", name: "Makan" }],
      total: 1,
      page: 1,
      limit: 10,
    });
    services.read.getTakeawayEligibility.mockResolvedValue({
      restaurantId: "restaurant-1",
      eligible: true,
    });
    services.read.getRestaurantMarkets.mockResolvedValue([
      { id: "market-1", name: "Night Market" },
    ]);
    services.read.getRestaurantServices.mockResolvedValue([
      { id: 7, name: "Delivery" },
    ]);
    services.read.getRestaurantMenu.mockResolvedValue([
      { id: 101, name: "Laksa" },
    ]);
    services.read.getPopular.mockResolvedValue({
      dishes: [{ menuItemId: 101 }],
    });
    services.getIndexStatus.mockResolvedValue({ indexed: 10 });
    services.reindex.mockResolvedValue({ indexed: 10, deleted: 1 });
  });

  it("routes public dish search through the read service with parsed filters", async () => {
    const { response: responsePromise, waitUntil } = request(
      "/search?q=laksa&page=2&limit=5&takeaway=true",
    );
    const response = await responsePromise;
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(services.createDiscoveryRead).toHaveBeenCalledWith(
      createEnv(),
      expect.objectContaining({ waitUntil: expect.any(Function) }),
    );
    expect(services.read.searchDishes).toHaveBeenCalledWith({
      q: "laksa",
      page: 2,
      limit: 5,
      takeaway: true,
    });
    expect(waitUntil).not.toHaveBeenCalled();
    expect(body).toEqual({
      success: true,
      data: {
        results: [{ menuItemId: 101, dishName: "Laksa" }],
        total: 1,
        page: 2,
        limit: 5,
      },
    });
  });

  it("returns validation errors before constructing a read service", async () => {
    const { response: responsePromise } = request("/search?sortBy=distance");
    const response = await responsePromise;
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(services.createDiscoveryRead).not.toHaveBeenCalled();
  });

  it("maps public facet, service, restaurant, detail, and popular endpoints", async () => {
    const categoryResponse = await request(
      "/categories?city=Taipei&takeaway=true",
    ).response;
    const servicesResponse = await request(
      "/services?q=delivery&serviceType=delivery",
    ).response;
    const serviceTypesResponse = await request(
      "/service-types?city=Taipei&delivery=true",
    ).response;
    const restaurantsResponse = await request(
      "/restaurants?district=Da-an&limit=10",
    ).response;
    const eligibilityResponse = await request(
      "/restaurants/restaurant-1/takeaway-eligibility",
    ).response;
    const marketsResponse = await request("/restaurants/restaurant-1/markets")
      .response;
    const restaurantServicesResponse = await request(
      "/restaurants/restaurant-1/services",
    ).response;
    const menuResponse = await request("/restaurants/restaurant-1/menu")
      .response;
    const popularResponse = await request("/popular").response;

    expect(categoryResponse.status).toBe(200);
    expect(services.read.listDishCategories).toHaveBeenCalledWith({
      city: "Taipei",
      takeaway: true,
    });
    expect(servicesResponse.status).toBe(200);
    expect(services.read.searchServices).toHaveBeenCalledWith({
      q: "delivery",
      serviceType: "delivery",
      page: 1,
      limit: 20,
    });
    expect(serviceTypesResponse.status).toBe(200);
    expect(services.read.listServiceTypes).toHaveBeenCalledWith({
      city: "Taipei",
      delivery: true,
    });
    expect(restaurantsResponse.status).toBe(200);
    expect(services.read.browseRestaurants).toHaveBeenCalledWith({
      district: "Da-an",
      page: 1,
      limit: 10,
    });
    expect(eligibilityResponse.status).toBe(200);
    expect(services.read.getTakeawayEligibility).toHaveBeenCalledWith(
      "restaurant-1",
    );
    expect(marketsResponse.status).toBe(200);
    expect(services.read.getRestaurantMarkets).toHaveBeenCalledWith(
      "restaurant-1",
    );
    expect(restaurantServicesResponse.status).toBe(200);
    await expect(restaurantServicesResponse.json()).resolves.toEqual({
      success: true,
      data: { services: [{ id: 7, name: "Delivery" }] },
    });
    expect(services.read.getRestaurantServices).toHaveBeenCalledWith(
      "restaurant-1",
    );
    expect(menuResponse.status).toBe(200);
    await expect(menuResponse.json()).resolves.toEqual({
      success: true,
      data: { items: [{ id: 101, name: "Laksa" }] },
    });
    expect(services.read.getRestaurantMenu).toHaveBeenCalledWith(
      "restaurant-1",
    );
    expect(popularResponse.status).toBe(200);
    expect(services.read.getPopular).toHaveBeenCalledWith();
  });

  it("uses primary services for admin index status and reindex routes", async () => {
    const statusResponse = await request("/index-status").response;
    const reindexResponse = await request("/reindex", "POST").response;

    expect(statusResponse.status).toBe(200);
    await expect(statusResponse.json()).resolves.toEqual({
      success: true,
      data: { indexed: 10 },
    });
    expect(services.discoveryCtor).toHaveBeenNthCalledWith(
      1,
      createEnv().DB,
      createEnv().CACHE_KV,
    );
    expect(reindexResponse.status).toBe(200);
    await expect(reindexResponse.json()).resolves.toEqual({
      success: true,
      data: { indexed: 10, deleted: 1 },
    });
    expect(services.semanticCtor).toHaveBeenCalledWith({
      ai: createEnv().AI,
      vectorize: createEnv().DISCOVERY_VECTORIZE,
      embeddingModel: "bge-small",
    });
    expect(services.discoveryCtor).toHaveBeenNthCalledWith(
      2,
      createEnv().DB,
      createEnv().CACHE_KV,
      undefined,
      { semantic: true },
    );
    expect(services.getIndexStatus).toHaveBeenCalledWith();
    expect(services.reindex).toHaveBeenCalledWith();
  });
});
