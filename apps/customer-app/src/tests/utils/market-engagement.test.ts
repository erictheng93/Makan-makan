import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hydrateFavoriteMarketsFromIdentity,
  hydrateRecentMarketsFromIdentity,
  isFavoriteMarket,
  listFavoriteMarkets,
  listRecentMarkets,
  recordRecentMarket,
  syncFavoriteMarketPreference,
  syncRecentMarketVisit,
  toggleFavoriteMarket,
} from "@/utils/marketEngagement";
import { customerIdentityApi } from "@/services/customerIdentityApi";
import type { MarketListItem } from "@/services/marketsApi";

vi.mock("@/services/customerIdentityApi", () => ({
  customerIdentityApi: {
    listFavorites: vi.fn(),
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
    listRecentMarkets: vi.fn(),
    recordRecentMarket: vi.fn(),
  },
}));

function market(overrides: Partial<MarketListItem> = {}): MarketListItem {
  return {
    id: "market-1",
    slug: "fengjia",
    name: "逢甲夜市",
    type: "night_market",
    description: null,
    city: "台中市",
    district: "西屯區",
    address: "文華路",
    latitude: 24.1764,
    longitude: 120.6466,
    bannerUrl: null,
    logoUrl: null,
    tags: ["夜市"],
    vendorCount: 3,
    ...overrides,
  };
}

describe("marketEngagement", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(customerIdentityApi.listFavorites).mockReset();
    vi.mocked(customerIdentityApi.addFavorite).mockReset();
    vi.mocked(customerIdentityApi.removeFavorite).mockReset();
    vi.mocked(customerIdentityApi.listRecentMarkets).mockReset();
    vi.mocked(customerIdentityApi.recordRecentMarket).mockReset();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  });

  it("toggles favorite markets idempotently", () => {
    expect(toggleFavoriteMarket(market())).toBe(true);
    expect(isFavoriteMarket("market-1")).toBe(true);
    expect(listFavoriteMarkets()[0]).toMatchObject({
      id: "market-1",
      slug: "fengjia",
      name: "逢甲夜市",
      updatedAt: Date.now(),
    });

    expect(toggleFavoriteMarket(market())).toBe(false);
    expect(isFavoriteMarket("market-1")).toBe(false);
    expect(listFavoriteMarkets()).toEqual([]);
  });

  it("records recent markets newest first and deduplicates visits", () => {
    recordRecentMarket(market({ id: "market-1", slug: "fengjia" }));
    recordRecentMarket(
      market({ id: "market-2", slug: "ximen", name: "西門町" }),
    );
    recordRecentMarket(market({ id: "market-1", slug: "fengjia" }));

    expect(listRecentMarkets().map((item) => item.slug)).toEqual([
      "fengjia",
      "ximen",
    ]);
  });

  it("syncs favorite market changes to customer identity when authenticated", async () => {
    sessionStorage.setItem("customer_auth_token", "customer-token");
    vi.mocked(customerIdentityApi.listFavorites).mockResolvedValueOnce([]);

    await syncFavoriteMarketPreference(market(), true);

    expect(customerIdentityApi.listFavorites).toHaveBeenCalledWith("market");
    expect(customerIdentityApi.addFavorite).toHaveBeenCalledWith({
      targetType: "market",
      targetId: "market-1",
    });
  });

  it("removes synced favorite market records when unfavorited", async () => {
    sessionStorage.setItem("customer_auth_token", "customer-token");
    vi.mocked(customerIdentityApi.listFavorites).mockResolvedValueOnce([
      {
        id: 42,
        targetType: "market",
        targetId: "market-1",
        createdAtMs: Date.now(),
      },
    ]);

    await syncFavoriteMarketPreference(market(), false);

    expect(customerIdentityApi.removeFavorite).toHaveBeenCalledWith(42);
  });

  it("hydrates server favorite ids into local market snapshots", async () => {
    sessionStorage.setItem("customer_auth_token", "customer-token");
    vi.mocked(customerIdentityApi.listFavorites).mockResolvedValueOnce([
      {
        id: 42,
        targetType: "market",
        targetId: "market-2",
        createdAtMs: Date.now(),
      },
    ]);

    const hydrated = await hydrateFavoriteMarketsFromIdentity([
      market(),
      market({ id: "market-2", slug: "ximen", name: "西門町商圈" }),
    ]);

    expect(hydrated).toHaveLength(1);
    expect(hydrated[0]).toMatchObject({
      id: "market-2",
      slug: "ximen",
      name: "西門町商圈",
    });
    expect(localStorage.getItem("makanmakan_favorite_markets")).toContain(
      "ximen",
    );
  });

  it("syncs recent market visits to customer identity when authenticated", async () => {
    sessionStorage.setItem("customer_auth_token", "customer-token");

    await syncRecentMarketVisit(market());

    expect(customerIdentityApi.recordRecentMarket).toHaveBeenCalledWith({
      marketId: "market-1",
      visitedAtMs: Date.now(),
    });
  });

  it("hydrates server recent market ids into local market snapshots", async () => {
    sessionStorage.setItem("customer_auth_token", "customer-token");
    vi.mocked(customerIdentityApi.listRecentMarkets).mockResolvedValueOnce([
      {
        marketId: "market-2",
        visitedAtMs: 1_780_000_003_000,
      },
    ]);

    const hydrated = await hydrateRecentMarketsFromIdentity([
      market(),
      market({ id: "market-2", slug: "ximen", name: "西門町商圈" }),
    ]);

    expect(customerIdentityApi.listRecentMarkets).toHaveBeenCalledWith(8);
    expect(hydrated).toHaveLength(1);
    expect(hydrated[0]).toMatchObject({
      id: "market-2",
      slug: "ximen",
      name: "西門町商圈",
      updatedAt: 1_780_000_003_000,
    });
    expect(localStorage.getItem("makanmakan_recent_markets")).toContain(
      "ximen",
    );
  });
});
