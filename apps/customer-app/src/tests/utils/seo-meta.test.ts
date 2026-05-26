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

function marketJsonLd() {
  const script = document.head.querySelector<HTMLScriptElement>(
    'script[type="application/ld+json"][data-seo="market"]',
  );
  return script ? JSON.parse(script.textContent ?? "{}") : null;
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

  it("adds structured data for the market page", () => {
    applyMarketSeoMeta({
      market: market({
        openingHours: {
          monday: { open: "17:00", close: "23:30" },
          tuesday: { open: "17:00", close: "23:30", closed: true },
        },
      }),
      vendorCount: 12,
      path: "/markets/fengjia",
      origin: "https://makanmakan.app",
    });

    const jsonLd = marketJsonLd();

    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Place",
      name: "逢甲夜市",
      description: expect.stringContaining("12 間店家"),
      url: "https://makanmakan.app/markets/fengjia",
      image: "https://example.com/banner.jpg",
      address: {
        "@type": "PostalAddress",
        streetAddress: "台中市西屯區文華路",
        addressLocality: "西屯區",
        addressRegion: "台中市",
        addressCountry: "TW",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 24.1764,
        longitude: 120.6466,
      },
    });
    expect(jsonLd.openingHoursSpecification).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "https://schema.org/Monday",
        opens: "17:00",
        closes: "23:30",
      },
    ]);

    applyMarketSeoMeta({
      market: market({ name: "一中商圈" }),
      vendorCount: 4,
      path: "/markets/yizhong",
      origin: "https://makanmakan.app",
    });

    expect(
      document.head.querySelectorAll(
        'script[type="application/ld+json"][data-seo="market"]',
      ),
    ).toHaveLength(1);
    expect(marketJsonLd()?.name).toBe("一中商圈");
  });
});
