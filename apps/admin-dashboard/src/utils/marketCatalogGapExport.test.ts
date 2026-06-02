import { describe, expect, it } from "vitest";
import {
  buildMarketVendorImportWorklistCsv,
  buildMarketCatalogGapCsv,
  marketCatalogGapCsvFilename,
} from "./marketCatalogGapExport";
import type { MarketListItem } from "@/services/marketsService";

function market(overrides: Partial<MarketListItem> = {}): MarketListItem {
  return {
    id: "market-1",
    slug: "fengjia",
    name: "逢甲夜市",
    type: "night_market",
    city: "台中市",
    district: "西屯區",
    vendorCount: 2,
    catalogCoverage: {
      searchableProductCount: 0,
      publicServiceCount: 0,
      vendorsMissingSearchableProducts: 1,
      vendorsMissingPublicServices: 1,
      vendorsMissingStallNumbers: 1,
      vendorsMissingMapPositions: 1,
      vendorsMissingSearchEntrypoints: 1,
      missingProductVendors: [
        {
          restaurantId: "restaurant-1",
          name: "缺商品攤",
          stallNumber: "A-01",
        },
      ],
      missingServiceVendors: [
        {
          restaurantId: "restaurant-2",
          name: "缺服務,攤",
          stallNumber: null,
        },
      ],
      missingStallNumberVendors: [
        {
          restaurantId: "restaurant-2",
          name: "缺服務,攤",
          stallNumber: null,
        },
      ],
      missingMapPositionVendors: [
        {
          restaurantId: "restaurant-2",
          name: "缺服務,攤",
          stallNumber: "A-02",
        },
      ],
      missingSearchEntrypointVendors: [
        {
          restaurantId: "restaurant-1",
          name: "缺商品攤",
          stallNumber: "A-01",
        },
      ],
    },
    ...overrides,
  };
}

describe("market catalog gap export", () => {
  it("exports product and service vendor gaps as spreadsheet CSV", () => {
    expect(buildMarketCatalogGapCsv([market()])).toBe(
      [
        "marketId,marketSlug,marketName,city,district,gapType,action,actionTarget,returnMarketSlug,restaurantId,vendorName,stallNumber",
        "market-1,fengjia,逢甲夜市,台中市,西屯區,searchableCatalog,補菜單/商品/服務或重建索引,menu_or_services,fengjia,,,",
        "market-1,fengjia,逢甲夜市,台中市,西屯區,products,補商品,menu,fengjia,restaurant-1,缺商品攤,A-01",
        'market-1,fengjia,逢甲夜市,台中市,西屯區,services,補服務,services,fengjia,restaurant-2,"缺服務,攤",',
        'market-1,fengjia,逢甲夜市,台中市,西屯區,stallNumbers,補攤位號,market_vendor,fengjia,restaurant-2,"缺服務,攤",',
        'market-1,fengjia,逢甲夜市,台中市,西屯區,mapPositions,補攤位座標,market_vendor,fengjia,restaurant-2,"缺服務,攤",A-02',
        "market-1,fengjia,逢甲夜市,台中市,西屯區,searchEntrypoints,補商品或補服務,menu_or_services,fengjia,restaurant-1,缺商品攤,A-01",
      ].join("\r\n"),
    );
  });

  it("exports market-level gaps when a market has no vendors or searchable catalog", () => {
    expect(
      buildMarketCatalogGapCsv([
        market({
          id: "market-empty",
          slug: "empty-market",
          name: "空白夜市",
          vendorCount: 0,
          catalogCoverage: {
            searchableProductCount: 0,
            publicServiceCount: 0,
            vendorsMissingSearchableProducts: 0,
            vendorsMissingPublicServices: 0,
            vendorsMissingStallNumbers: 0,
            vendorsMissingMapPositions: 0,
            vendorsMissingSearchEntrypoints: 0,
            missingProductVendors: [],
            missingServiceVendors: [],
            missingStallNumberVendors: [],
            missingMapPositionVendors: [],
            missingSearchEntrypointVendors: [],
          },
        }),
      ]),
    ).toBe(
      [
        "marketId,marketSlug,marketName,city,district,gapType,action,actionTarget,returnMarketSlug,restaurantId,vendorName,stallNumber",
        "market-empty,empty-market,空白夜市,台中市,西屯區,marketVendors,匯入或加入店鋪,market_vendors,empty-market,,,",
        "market-empty,empty-market,空白夜市,台中市,西屯區,searchableCatalog,補菜單/商品/服務或重建索引,menu_or_services,empty-market,,,",
      ].join("\r\n"),
    );
  });

  it("returns only the header when there are no catalog gaps", () => {
    expect(
      buildMarketCatalogGapCsv([
        market({
          catalogCoverage: {
            searchableProductCount: 2,
            publicServiceCount: 1,
            vendorsMissingSearchableProducts: 0,
            vendorsMissingPublicServices: 0,
            vendorsMissingStallNumbers: 0,
            vendorsMissingMapPositions: 0,
            vendorsMissingSearchEntrypoints: 0,
            missingProductVendors: [],
            missingServiceVendors: [],
            missingStallNumberVendors: [],
            missingMapPositionVendors: [],
            missingSearchEntrypointVendors: [],
          },
        }),
      ]),
    ).toBe(
      "marketId,marketSlug,marketName,city,district,gapType,action,actionTarget,returnMarketSlug,restaurantId,vendorName,stallNumber",
    );
  });

  it("builds a dated filename", () => {
    expect(marketCatalogGapCsvFilename(new Date("2026-05-26"))).toBe(
      "market-catalog-gaps-2026-05-26.csv",
    );
  });

  it("builds a vendor import worklist for market-level and stall gaps", () => {
    expect(
      buildMarketVendorImportWorklistCsv([
        market({
          id: "market-empty",
          slug: "empty-market",
          name: "空白夜市",
          vendorCount: 0,
          catalogCoverage: {
            searchableProductCount: 0,
            publicServiceCount: 0,
            vendorsMissingSearchableProducts: 0,
            vendorsMissingPublicServices: 0,
            vendorsMissingStallNumbers: 0,
            vendorsMissingMapPositions: 0,
            vendorsMissingSearchEntrypoints: 0,
            missingProductVendors: [],
            missingServiceVendors: [],
            missingStallNumberVendors: [],
            missingMapPositionVendors: [],
            missingSearchEntrypointVendors: [],
          },
        }),
        market(),
      ]),
    ).toBe(
      [
        "marketId,marketSlug,marketName,restaurantId,name,type,category,description,address,district,city,latitude,longitude,phone,email,website,stallNumber,mapX,mapY,isPrimary",
        "market-empty,empty-market,空白夜市,,新店鋪,market_stall,,,請填入店鋪地址,西屯區,台中市,,,,,,,,,false",
        'market-1,fengjia,逢甲夜市,restaurant-2,"缺服務,攤",,,,,西屯區,台中市,,,,,,,,,true',
        'market-1,fengjia,逢甲夜市,restaurant-2,"缺服務,攤",,,,,西屯區,台中市,,,,,,A-02,,,true',
      ].join("\r\n"),
    );
  });
});
