import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
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
  it("uses gallery image fallback and shows open status", () => {
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
});
