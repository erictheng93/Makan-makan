import { describe, expect, it } from "vitest";
import {
  filterMarketsByReadiness,
  marketReadinessStats,
} from "./marketPublicReadinessWorkbench";
import type { MarketListItem } from "@/services/marketsService";

function market(overrides: Partial<MarketListItem> = {}): MarketListItem {
  return {
    id: "market-1",
    slug: "fengjia",
    name: "逢甲夜市",
    type: "night_market",
    city: "台中市",
    district: "西屯區",
    vendorCount: 12,
    publicReadiness: {
      ready: true,
      score: 100,
      completedCount: 5,
      totalCount: 5,
      issues: [],
    },
    ...overrides,
  };
}

describe("market public readiness workbench", () => {
  it("counts ready, blocked, and unknown markets", () => {
    expect(
      marketReadinessStats([
        market(),
        market({
          id: "market-2",
          publicReadiness: {
            ready: false,
            score: 60,
            completedCount: 3,
            totalCount: 5,
            issues: [{ key: "vendors", severity: "required" }],
          },
        }),
        market({ id: "market-3", publicReadiness: undefined }),
      ]),
    ).toEqual({
      total: 3,
      ready: 1,
      blocked: 1,
      unknown: 1,
      averageScore: 80,
    });
  });

  it("filters markets by readiness state and text query", () => {
    const markets = [
      market(),
      market({
        id: "market-2",
        name: "一中商圈",
        slug: "yizhong",
        district: "北區",
        publicReadiness: {
          ready: false,
          score: 60,
          completedCount: 3,
          totalCount: 5,
          issues: [{ key: "vendors", severity: "required" }],
        },
      }),
    ];

    expect(filterMarketsByReadiness(markets, "blocked")).toHaveLength(1);
    expect(filterMarketsByReadiness(markets, "ready")[0].slug).toBe("fengjia");
    expect(filterMarketsByReadiness(markets, "all", "北區")[0].slug).toBe(
      "yizhong",
    );
  });
});
