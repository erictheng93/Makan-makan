import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/services/api";
import { discoveryService } from "./discoveryService";

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  unwrapApiPayload: (payload: unknown) =>
    typeof payload === "object" && payload !== null && "data" in payload
      ? (payload as { data: unknown }).data
      : payload,
}));

describe("discoveryService", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  it("triggers discovery index reindexing", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          dishes: 12,
          restaurants: 4,
          duration_ms: 250,
        },
      },
    } as never);

    const result = await discoveryService.reindex();

    expect(api.post).toHaveBeenCalledWith("/discovery/reindex");
    expect(result).toEqual({
      dishes: 12,
      restaurants: 4,
      duration_ms: 250,
    });
  });

  it("loads discovery index status", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          version: "1779870000000",
          lastReindexedAt: "2026-05-27T08:00:00.000Z",
          indexedDishCount: 12,
          availableDishCount: 10,
          indexedRestaurantCount: 4,
        },
      },
    } as never);

    const result = await discoveryService.getIndexStatus();

    expect(api.get).toHaveBeenCalledWith("/discovery/index-status");
    expect(result).toEqual({
      version: "1779870000000",
      lastReindexedAt: "2026-05-27T08:00:00.000Z",
      indexedDishCount: 12,
      availableDishCount: 10,
      indexedRestaurantCount: 4,
    });
  });
});
