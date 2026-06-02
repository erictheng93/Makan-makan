import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import MarketCard from "@/components/markets/MarketCard.vue";
import type { MarketListItem } from "@/services/marketsApi";

function market(overrides: Partial<MarketListItem> = {}): MarketListItem {
  return {
    id: "market-1",
    slug: "fengjia",
    name: "逢甲夜市",
    type: "night_market",
    description: "人氣小吃聚落",
    city: "台中市",
    district: "西屯區",
    address: "台中市西屯區文華路",
    latitude: 24.1764,
    longitude: 120.6466,
    bannerUrl: null,
    logoUrl: null,
    imageUrls: null,
    openingHours: null,
    tags: ["夜市"],
    vendorCount: 12,
    ...overrides,
  };
}

describe("MarketCard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the venue type for mixed market directories", () => {
    const wrapper = mount(MarketCard, {
      props: {
        market: market({
          name: "精明商圈",
          type: "commercial_district",
        }),
      },
    });

    expect(wrapper.get('[data-testid="market-card-type"]').text()).toBe("商圈");
  });

  it("uses gallery image fallback and shows open status", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-22T18:30:00+08:00"));

    const wrapper = mount(MarketCard, {
      props: {
        market: market({
          imageUrls: ["https://example.com/gallery.jpg"],
          openingHours: {
            friday: { open: "17:00", close: "23:30" },
          },
        }),
      },
    });

    expect(
      wrapper.get('[data-testid="market-card-image"]').attributes("src"),
    ).toBe("https://example.com/gallery.jpg");
    expect(wrapper.text()).toContain("營業中");
    expect(wrapper.text()).toContain("至 23:30");
  });

  it("shows closed status when today is marked closed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-24T18:30:00+08:00"));

    const wrapper = mount(MarketCard, {
      props: {
        market: market({
          openingHours: {
            sunday: { open: "16:00", close: "23:00", closed: true },
          },
        }),
      },
    });

    expect(wrapper.text()).toContain("今日休息");
  });

  it("shows searchable product and service coverage", () => {
    const wrapper = mount(MarketCard, {
      props: {
        market: market({
          catalogCoverage: {
            searchableProductCount: 36,
            publicServiceCount: 5,
          },
        }),
      },
    });

    const coverage = wrapper.get('[data-testid="market-card-catalog"]');
    expect(coverage.text()).toContain("商品 36");
    expect(coverage.text()).toContain("服務 5");
    expect(
      wrapper.get('[data-testid="market-card-explore-status"]').text(),
    ).toContain("進入市場搜尋");
  });

  it("explains markets that are listed before searchable catalogs are ready", () => {
    const wrapper = mount(MarketCard, {
      props: {
        market: market({
          catalogCoverage: {
            searchableProductCount: 0,
            publicServiceCount: 0,
          },
        }),
      },
    });

    expect(wrapper.get('[data-testid="market-card-catalog"]').text()).toContain(
      "店鋪補齊後可搜尋商品與服務",
    );
    expect(
      wrapper.get('[data-testid="market-card-explore-status"]').text(),
    ).toContain("資料補齊中");
  });

  it("surfaces public readiness issues before users enter a market", () => {
    const wrapper = mount(MarketCard, {
      props: {
        market: market({
          publicReadiness: {
            ready: false,
            score: 71,
            completedCount: 5,
            totalCount: 7,
            issues: [
              { key: "products", severity: "required" },
              { key: "services", severity: "recommended" },
            ],
          },
        }),
      },
    });

    expect(
      wrapper.get('[data-testid="market-card-readiness"]').text(),
    ).toContain("資料補齊中");
    expect(
      wrapper.get('[data-testid="market-card-readiness"]').text(),
    ).toContain("5/7");
  });
});
