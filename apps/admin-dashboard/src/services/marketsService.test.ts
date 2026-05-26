import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/services/api";
import { marketsService } from "./marketsService";

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  unwrapApiPayload: (payload: { data?: unknown }) => payload.data ?? payload,
}));

describe("marketsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists area-level market readiness summaries", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: {
          areas: [
            {
              city: "台中市",
              district: "西屯區",
              marketCount: 2,
              vendorCount: 8,
              searchableProductCount: 20,
              publicServiceCount: 5,
              vendorsMissingSearchableProducts: 3,
              vendorsMissingPublicServices: 4,
              totalCatalogGapVendors: 7,
              averageReadinessScore: 72,
            },
          ],
        },
      },
    } as never);

    const result = await marketsService.listAreaReadiness();

    expect(api.get).toHaveBeenCalledWith("/admin/markets/area-readiness");
    expect(result[0]).toMatchObject({
      city: "台中市",
      district: "西屯區",
      totalCatalogGapVendors: 7,
    });
  });
});
