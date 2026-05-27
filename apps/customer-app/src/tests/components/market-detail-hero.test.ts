import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import MarketDetailHero from "@/components/markets/MarketDetailHero.vue";
import type { MarketDetail } from "@/services/marketsApi";

function market(overrides: Partial<MarketDetail> = {}): MarketDetail {
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
    bannerUrl: "https://example.com/banner.jpg",
    logoUrl: "https://example.com/logo.jpg",
    tags: ["夜市", "小吃"],
    vendorCount: 12,
    openingHours: null,
    imageUrls: null,
    ...overrides,
  };
}

describe("MarketDetailHero", () => {
  it("shows the venue type on market detail pages", () => {
    const wrapper = mount(MarketDetailHero, {
      props: {
        market: market({
          name: "精明商圈",
          type: "commercial_district",
        }),
        vendorCount: 8,
      },
    });

    expect(wrapper.get('[data-testid="market-detail-type"]').text()).toBe(
      "商圈",
    );
  });

  it("renders gallery images and weekly opening hours", () => {
    const wrapper = mount(MarketDetailHero, {
      props: {
        market: market({
          imageUrls: [
            "https://example.com/gallery-1.jpg",
            "https://example.com/gallery-2.jpg",
          ],
          openingHours: {
            friday: { open: "17:00", close: "23:30" },
            saturday: { open: "16:00", close: "23:59", closed: false },
            sunday: { open: "16:00", close: "23:00", closed: true },
          },
        }),
        vendorCount: 12,
      },
    });

    const gallery = wrapper.findAll('[data-testid="market-gallery-image"]');
    expect(gallery).toHaveLength(2);
    expect(gallery[0].attributes("src")).toBe(
      "https://example.com/gallery-1.jpg",
    );
    expect(wrapper.text()).toContain("營業時間");
    expect(wrapper.text()).toContain("週五");
    expect(wrapper.text()).toContain("17:00-23:30");
    expect(wrapper.text()).toContain("週六");
    expect(wrapper.text()).toContain("16:00-23:59");
    expect(wrapper.text()).toContain("週日");
    expect(wrapper.text()).toContain("休息");
  });
});
