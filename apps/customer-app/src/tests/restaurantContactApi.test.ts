import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api";
import { restaurantContactApi } from "@/services/restaurantContactApi";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("restaurantContactApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads a public restaurant contact profile", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      restaurantId: "restaurant-1",
      messagingChannels: {},
      faqs: [],
    });

    await restaurantContactApi.getContactProfile("restaurant-1");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/restaurants/restaurant-1/contact-profile",
    );
  });

  it("loads public restaurant service items", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([
      {
        id: 1,
        restaurantId: "restaurant-1",
        name: "預約外送",
        serviceType: "delivery",
        requiresBooking: true,
        sortOrder: 0,
        isActive: true,
        isPublic: true,
      },
    ]);

    const result = await restaurantContactApi.listServiceItems("restaurant-1");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/restaurants/restaurant-1/service-items",
    );
    expect(result[0].name).toBe("預約外送");
  });
});
