import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api";
import { discoveryApi } from "@/services/discoveryApi";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("discoveryApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches service items with discovery filters", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      results: [
        {
          serviceItemId: 1,
          name: "代客切水果",
          description: "現場代切並分裝",
          serviceType: "general",
          priceCents: 3000,
          priceLabel: null,
          durationMinutes: null,
          requiresBooking: false,
          bookingUrl: null,
          tags: ["水果"],
          restaurantId: "restaurant-1",
          restaurantName: "水果攤",
          district: "西屯區",
          city: "台中市",
          isOpen: true,
        },
      ],
      total: 1,
    });

    const result = await discoveryApi.searchServices({
      q: "切水果",
      marketId: "market-1",
      page: 1,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/discovery/services", {
      q: "切水果",
      marketId: "market-1",
      page: 1,
    });
    expect(result.results[0].name).toBe("代客切水果");
  });
});
