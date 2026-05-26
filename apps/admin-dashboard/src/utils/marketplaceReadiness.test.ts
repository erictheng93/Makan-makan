import { describe, expect, it } from "vitest";
import { evaluateMarketplaceReadiness } from "./marketplaceReadiness";

describe("evaluateMarketplaceReadiness", () => {
  it("flags missing marketplace-critical vendor data", () => {
    const result = evaluateMarketplaceReadiness({
      city: "台中市",
      district: "",
      address: "一中街",
      latitude: null,
      longitude: null,
      takeawayEnabled: false,
      shopModeEnabled: true,
      shopQrCode: "",
      contactChannelCount: 0,
      activeFaqCount: 0,
      marketMembershipCount: 0,
    });

    expect(result.ready).toBe(false);
    expect(result.score).toBe(0);
    expect(result.issues).toEqual([
      { key: "location", severity: "required" },
      { key: "fulfillment", severity: "required" },
      { key: "shopMode", severity: "required" },
      { key: "contact", severity: "recommended" },
      { key: "faq", severity: "recommended" },
      { key: "market", severity: "required" },
    ]);
  });

  it("allows readiness when required data is complete", () => {
    const result = evaluateMarketplaceReadiness({
      city: "台中市",
      district: "北區",
      address: "一中街",
      latitude: 24.1491,
      longitude: 120.6842,
      takeawayEnabled: true,
      shopModeEnabled: true,
      shopQrCode: "SHOP-123",
      contactChannelCount: 1,
      activeFaqCount: 2,
      marketMembershipCount: 1,
    });

    expect(result.ready).toBe(true);
    expect(result.score).toBe(100);
    expect(result.completedCount).toBe(6);
    expect(result.totalCount).toBe(6);
    expect(result.issues).toEqual([]);
  });
});
