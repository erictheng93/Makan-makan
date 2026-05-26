import { describe, expect, it, vi, beforeEach } from "vitest";
import { api } from "@/services/api";
import { restaurantServiceItemsService } from "./restaurantServiceItemsService";

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  unwrapApiPayload: (payload: { data?: unknown }) => payload.data ?? payload,
}));

describe("restaurantServiceItemsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists manageable restaurant service items", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: [{ id: 1, name: "代客切水果" }] },
    } as never);

    const result = await restaurantServiceItemsService.list("restaurant-1");

    expect(api.get).toHaveBeenCalledWith(
      "/restaurants/restaurant-1/service-items",
    );
    expect(result[0].name).toBe("代客切水果");
  });

  it("creates, updates, and deletes restaurant service items", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { data: { id: 1, name: "代客切水果" } },
    } as never);
    vi.mocked(api.put).mockResolvedValueOnce({
      data: { data: { id: 1, name: "預約切水果" } },
    } as never);
    vi.mocked(api.delete).mockResolvedValueOnce({
      data: { success: true },
    } as never);

    await restaurantServiceItemsService.create("restaurant-1", {
      name: "代客切水果",
      serviceType: "general",
    });
    await restaurantServiceItemsService.update("restaurant-1", 1, {
      name: "預約切水果",
    });
    await restaurantServiceItemsService.remove("restaurant-1", 1);

    expect(api.post).toHaveBeenCalledWith(
      "/restaurants/restaurant-1/service-items",
      {
        name: "代客切水果",
        serviceType: "general",
      },
    );
    expect(api.put).toHaveBeenCalledWith(
      "/restaurants/restaurant-1/service-items/1",
      {
        name: "預約切水果",
      },
    );
    expect(api.delete).toHaveBeenCalledWith(
      "/restaurants/restaurant-1/service-items/1",
    );
  });
});
