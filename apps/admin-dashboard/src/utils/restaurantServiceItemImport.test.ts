import { describe, expect, it } from "vitest";
import {
  buildRestaurantServiceItemImportTemplate,
  parseRestaurantServiceItemImport,
} from "./restaurantServiceItemImport";

describe("restaurant service item import parsing", () => {
  it("parses spreadsheet CSV into service item inputs", () => {
    const result = parseRestaurantServiceItemImport(
      [
        "name,serviceType,description,priceCents,priceLabel,durationMinutes,requiresBooking,bookingUrl,tags,sortOrder,isActive,isPublic",
        '"代客切水果",general,"現場代切並分裝",5000,,15,false,,"水果;分裝",1,true,true',
        '"預約外送",delivery,,,"依距離報價",45,true,https://example.com/book,"外送",2,true,true',
      ].join("\n"),
    );

    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([
      {
        name: "代客切水果",
        serviceType: "general",
        description: "現場代切並分裝",
        priceCents: 5000,
        durationMinutes: 15,
        requiresBooking: false,
        tags: ["水果", "分裝"],
        keywords: "水果 分裝",
        sortOrder: 1,
        isActive: true,
        isPublic: true,
      },
      {
        name: "預約外送",
        serviceType: "delivery",
        priceLabel: "依距離報價",
        durationMinutes: 45,
        requiresBooking: true,
        bookingUrl: "https://example.com/book",
        tags: ["外送"],
        keywords: "外送",
        sortOrder: 2,
        isActive: true,
        isPublic: true,
      },
    ]);
  });

  it("reports row-level errors before import", () => {
    const result = parseRestaurantServiceItemImport(
      [
        "name,serviceType,priceCents,durationMinutes,bookingUrl",
        ',unknown,-1,0,"not-a-url"',
      ].join("\n"),
    );

    expect(result.items).toEqual([]);
    expect(result.errors).toEqual([
      "第 2 列：name 必填。",
      "第 2 列：serviceType 必須是 general、booking、pickup、delivery、consultation、rental、activity。",
      "第 2 列：priceCents 必須是 0 以上整數。",
      "第 2 列：durationMinutes 必須是 1 到 1440 的整數。",
      "第 2 列：bookingUrl 必須是有效 URL。",
    ]);
  });

  it("builds a spreadsheet-friendly CSV template", () => {
    const template = buildRestaurantServiceItemImportTemplate();

    expect(template).toContain(
      "name,serviceType,description,priceCents,priceLabel,durationMinutes,requiresBooking,bookingUrl,tags,sortOrder,isActive,isPublic",
    );
    expect(template).toContain("代客切水果");
  });
});
