import { ref } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tWithParams: (key: string, params: Record<string, unknown>) =>
      `${key}:${Object.values(params).join(",")}`,
    currentLanguage: ref("zh-TW"),
  }),
}));
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

    expect(wrapper.get('[data-testid="market-card-type"]').text()).toBe(
      "markets.type.commercial_district",
    );
  });

  it("uses gallery image fallback and shows open status", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-22T18:30:00Z"));

    const wrapper = mount(MarketCard, {
      props: {
        market: market({
          imageUrls: ["https://example.com/gallery.jpg"],
          openingHours: {
            friday: { open: "00:00", close: "23:30" },
            saturday: { open: "00:00", close: "23:30" },
          },
        }),
      },
    });

    expect(
      wrapper.get('[data-testid="market-card-image"]').attributes("src"),
    ).toBe("https://example.com/gallery.jpg");
    expect(wrapper.text()).toContain("markets.common.open");
    expect(wrapper.text()).toContain("markets.card.until:23:30");
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

    expect(wrapper.text()).toContain("markets.common.closedToday");
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
    expect(coverage.text()).toContain("markets.card.productCount:36");
    expect(coverage.text()).toContain("markets.card.serviceCount:5");
    expect(
      wrapper.get('[data-testid="market-card-explore-status"]').text(),
    ).toContain("markets.card.enterSearch");
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
      "markets.card.catalogPending",
    );
    expect(
      wrapper.get('[data-testid="market-card-explore-status"]').text(),
    ).toContain("markets.common.dataPending");
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
    ).toContain("markets.card.readiness");
    expect(
      wrapper.get('[data-testid="market-card-readiness"]').text(),
    ).toContain("5,7");
  });
});
