import { describe, expect, it } from "vitest";
import {
  buildMarketVendorImportTemplate,
  parseMarketVendorImport,
} from "./marketVendorImport";

describe("marketVendorImport", () => {
  it("parses new vendors and existing restaurant attachments from CSV", () => {
    const result = parseMarketVendorImport(
      [
        "restaurantId,name,address,district,city,stallNumber,locationLabel,isPrimary,phone,email,latitude,longitude",
        ",逢甲雞排攤,台中市西屯區文華路100號,西屯區,台中市,A-18,文華路入口,true,0423456789,stall@example.com,24.179001,120.646001",
        "restaurant-123,,,,,B-02,福星路轉角,false,,,,",
      ].join("\n"),
    );

    expect(result.errors).toEqual([]);
    expect(result.vendors).toEqual([
      {
        name: "逢甲雞排攤",
        address: "台中市西屯區文華路100號",
        district: "西屯區",
        city: "台中市",
        stallNumber: "A-18",
        locationLabel: "文華路入口",
        isPrimary: true,
        phone: "0423456789",
        email: "stall@example.com",
        latitude: 24.179001,
        longitude: 120.646001,
      },
      {
        restaurantId: "restaurant-123",
        stallNumber: "B-02",
        locationLabel: "福星路轉角",
        isPrimary: false,
      },
    ]);
  });

  it("reports rows without enough identity data", () => {
    const result = parseMarketVendorImport(
      ["restaurantId,name,stallNumber", ",,A-18"].join("\n"),
    );

    expect(result.vendors).toEqual([]);
    expect(result.errors).toContain("Row 2: restaurantId or name is required");
    expect(result.errors).toContain("CSV has no importable vendors");
  });

  it("provides an editable template", () => {
    expect(buildMarketVendorImportTemplate()).toContain(
      "restaurantId,name,address,district,city,stallNumber",
    );
  });
});
