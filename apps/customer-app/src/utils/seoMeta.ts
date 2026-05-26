import type { MarketDetail } from "@/services/marketsApi";

const SITE_NAME = "MakanMakan";
const DEFAULT_IMAGE = "/og-image.png";

interface MarketSeoMetaInput {
  market: MarketDetail;
  vendorCount: number;
  path: string;
  origin?: string;
}

function getOrigin(origin?: string) {
  if (origin) return origin.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "https://makanmakan.app";
}

function absoluteUrl(value: string, origin: string) {
  return new URL(value, origin).href;
}

function ensureMeta(
  attribute: "name" | "property",
  key: string,
): HTMLMetaElement {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  return element;
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  ensureMeta(attribute, key).content = content;
}

function ensureCanonical() {
  let element = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  return element;
}

function marketImage(market: MarketDetail, origin: string) {
  const image =
    market.bannerUrl ||
    market.logoUrl ||
    market.imageUrls?.[0] ||
    DEFAULT_IMAGE;
  return absoluteUrl(image, origin);
}

function marketDescription(market: MarketDetail, vendorCount: number) {
  const base =
    market.description?.trim() ||
    `探索${market.name}的店家、商品與服務，直接查看菜單並開始點餐。`;
  return `${base} ${market.city}${market.district}，目前收錄 ${vendorCount} 間店家。`;
}

export function applyMarketSeoMeta({
  market,
  vendorCount,
  path,
  origin,
}: MarketSeoMetaInput) {
  const siteOrigin = getOrigin(origin);
  const canonicalUrl = absoluteUrl(path, siteOrigin);
  const title = `${market.name}｜${market.city}${market.district}美食與店家菜單｜${SITE_NAME}`;
  const description = marketDescription(market, vendorCount);
  const image = marketImage(market, siteOrigin);

  document.title = title;
  setMeta("name", "description", description);
  setMeta(
    "name",
    "keywords",
    [market.name, market.city, market.district, ...(market.tags ?? [])].join(
      ",",
    ),
  );
  setMeta("property", "og:type", "website");
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:image", image);
  setMeta("property", "og:url", canonicalUrl);
  setMeta("property", "og:site_name", SITE_NAME);
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", image);
  ensureCanonical().href = canonicalUrl;
}
