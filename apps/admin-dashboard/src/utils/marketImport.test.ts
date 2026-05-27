import { describe, expect, it } from "vitest";
import {
  buildMarketImportRetryText,
  buildMarketImportTemplate,
  parseMarketImport,
} from "./marketImport";

describe("market import parsing", () => {
  it("parses CSV with headers into market create inputs", () => {
    const result = parseMarketImport(
      "csv",
      [
        "slug,name,type,city,district,address,latitude,longitude,tags,isActive",
        '"fengjia","逢甲夜市","night_market","台中市","西屯區","文華路",24.176,120.646,"夜市,小吃",true',
      ].join("\n"),
    );

    expect(result.errors).toEqual([]);
    expect(result.markets).toEqual([
      {
        slug: "fengjia",
        name: "逢甲夜市",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        address: "文華路",
        latitude: 24.176,
        longitude: 120.646,
        tags: ["夜市", "小吃"],
        isActive: true,
      },
    ]);
  });

  it("reports row-level CSV errors before import", () => {
    const result = parseMarketImport(
      "csv",
      [
        "slug,name,type,city,district,address,latitude,longitude",
        '"Bad Slug","","night_market","台中市","西屯區","文華路","abc",120.646',
      ].join("\n"),
    );

    expect(result.markets).toEqual([]);
    expect(result.errors).toEqual([
      "第 2 列：slug 只能使用小寫英數與連字號。",
      "第 2 列：name 為必填。",
      "第 2 列：latitude 必須是 -90 到 90 之間的數字。",
    ]);
  });

  it("rejects duplicate CSV slugs before import", () => {
    const result = parseMarketImport(
      "csv",
      [
        "slug,name,type,city,district,address,latitude,longitude",
        '"fengjia","逢甲夜市","night_market","台中市","西屯區","文華路",24.176,120.646',
        '"fengjia","逢甲商圈","commercial_district","台中市","西屯區","福星路",24.179,120.645',
      ].join("\n"),
    );

    expect(result.markets).toEqual([]);
    expect(result.errors).toEqual([
      "第 3 列：slug 與第 2 列重複，請確認每個市場 slug 唯一。",
    ]);
  });

  it("accepts JSON arrays and markets envelopes", () => {
    expect(
      parseMarketImport(
        "json",
        JSON.stringify({
          markets: [
            {
              slug: "xinyi",
              name: "信義商圈",
              type: "commercial_district",
              city: "台北市",
              district: "信義區",
              address: "市府路",
              latitude: 25.033,
              longitude: 121.565,
            },
          ],
        }),
      ),
    ).toEqual({
      markets: [
        {
          slug: "xinyi",
          name: "信義商圈",
          type: "commercial_district",
          city: "台北市",
          district: "信義區",
          address: "市府路",
          latitude: 25.033,
          longitude: 121.565,
        },
      ],
      errors: [],
    });
  });

  it("rejects JSON rows that are not objects", () => {
    expect(parseMarketImport("json", "[1]")).toEqual({
      markets: [],
      errors: ["每一筆市場資料都必須是 JSON 物件。"],
    });
  });

  it("rejects duplicate JSON slugs before import", () => {
    const result = parseMarketImport(
      "json",
      JSON.stringify([
        {
          slug: "xinyi",
          name: "信義商圈",
          type: "commercial_district",
          city: "台北市",
          district: "信義區",
          address: "市府路",
          latitude: 25.033,
          longitude: 121.565,
        },
        {
          slug: "xinyi",
          name: "信義夜生活商圈",
          type: "commercial_district",
          city: "台北市",
          district: "信義區",
          address: "松壽路",
          latitude: 25.035,
          longitude: 121.566,
        },
      ]),
    );

    expect(result.markets).toEqual([]);
    expect(result.errors).toEqual([
      "第 2 列：slug 與第 1 列重複，請確認每個市場 slug 唯一。",
    ]);
  });

  it("builds a spreadsheet-friendly CSV template", () => {
    expect(buildMarketImportTemplate()).toContain(
      "slug,name,type,city,district,address,latitude,longitude",
    );
    expect(buildMarketImportTemplate()).toContain("fengjia");
    expect(
      parseMarketImport("csv", buildMarketImportTemplate()).errors,
    ).toEqual([]);
  });

  it("builds retry text for failed CSV market imports", () => {
    const retryText = buildMarketImportRetryText("csv", [
      {
        slug: "existing-market",
        name: "既有市場",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        address: "福星路",
        latitude: 24.179,
        longitude: 120.645,
        tags: ["夜市", "商圈"],
        isActive: true,
      },
    ]);

    expect(retryText).toContain("slug,name,type,city,district,address");
    expect(retryText).toContain("existing-market");
    expect(retryText).not.toContain("created-market");
    expect(parseMarketImport("csv", retryText).markets).toEqual([
      {
        slug: "existing-market",
        name: "既有市場",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        address: "福星路",
        latitude: 24.179,
        longitude: 120.645,
        tags: ["夜市", "商圈"],
        isActive: true,
      },
    ]);
  });

  it("builds retry text for failed JSON market imports", () => {
    const retryText = buildMarketImportRetryText("json", [
      {
        slug: "existing-market",
        name: "既有市場",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        address: "福星路",
        latitude: 24.179,
        longitude: 120.645,
      },
    ]);

    expect(JSON.parse(retryText)).toEqual([
      {
        slug: "existing-market",
        name: "既有市場",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        address: "福星路",
        latitude: 24.179,
        longitude: 120.645,
      },
    ]);
    expect(parseMarketImport("json", retryText).errors).toEqual([]);
  });
});
