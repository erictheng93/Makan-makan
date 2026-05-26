import { beforeEach, describe, expect, it } from "vitest";
import { applyMarketSeoMeta } from "@/utils/seoMeta";
import type { MarketDetail } from "@/services/marketsApi";

function market(overrides: Partial<MarketDetail> = {}): MarketDetail {
  return {
    id: "market-1",
    slug: "fengjia",
    name: "逢甲夜市",
    type: "night_market",
    description: "台中最受歡迎的夜市小吃聚落",
    city: "台中市",
    district: "西屯區",
    address: "台中市西屯區文華路",
    latitude: 24.1764,
    longitude: 120.6466,
    openingHours: null,
    bannerUrl: "https://example.com/banner.jpg",
    logoUrl: null,
    imageUrls: null,
    tags: ["夜市", "小吃"],
    vendorCount: 12,
    ...overrides,
  };
}

function metaByName(name: string) {
  return document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
    ?.content;
}

function metaByProperty(property: string) {
  return document.head.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  )?.content;
}

describe("applyMarketSeoMeta", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "";
  });

  it("updates title, description, share image, and canonical URL", () => {
    applyMarketSeoMeta({
      market: market(),
      vendorCount: 12,
      path: "/markets/fengjia",
      origin: "https://makanmakan.app",
    });

    expect(document.title).toBe(
      "逢甲夜市｜台中市西屯區美食與店家菜單｜MakanMakan",
    );
    expect(metaByName("description")).toContain("12 間店家");
    expect(metaByProperty("og:title")).toBe(
      "逢甲夜市｜台中市西屯區美食與店家菜單｜MakanMakan",
    );
    expect(metaByProperty("og:image")).toBe("https://example.com/banner.jpg");
    expect(metaByProperty("og:url")).toBe(
      "https://makanmakan.app/markets/fengjia",
    );
    expect(metaByName("twitter:image")).toBe("https://example.com/banner.jpg");
    expect(
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
        ?.href,
    ).toBe("https://makanmakan.app/markets/fengjia");
  });

  it("falls back to gallery image and generated description", () => {
    applyMarketSeoMeta({
      market: market({
        description: null,
        bannerUrl: null,
        imageUrls: ["/market-gallery.jpg"],
      }),
      vendorCount: 3,
      path: "/markets/fengjia",
      origin: "https://makanmakan.app",
    });

    expect(metaByName("description")).toContain("探索逢甲夜市");
    expect(metaByProperty("og:image")).toBe(
      "https://makanmakan.app/market-gallery.jpg",
    );
  });
});
