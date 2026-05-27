import { describe, expect, it } from "vitest";
import {
  buildMarketVendorImportTemplate,
  parseMarketVendorImport,
} from "./marketVendorImport";

describe("market vendor import parsing", () => {
  it("parses CSV with headers into vendor import inputs", () => {
    const result = parseMarketVendorImport(
      "csv",
      [
        "restaurantId,name,address,district,city,latitude,longitude,stallNumber,isPrimary",
        "restaurant-1,,,,,,,A-01,true",
        ',"新匯入店鋪","台中市西屯區文華路 100 號","西屯區","台中市",24.176,120.646,"B-02",false',
      ].join("\n"),
    );

    expect(result.errors).toEqual([]);
    expect(result.vendors).toEqual([
      {
        restaurantId: "restaurant-1",
        stallNumber: "A-01",
        isPrimary: true,
      },
      {
        name: "新匯入店鋪",
        address: "台中市西屯區文華路 100 號",
        district: "西屯區",
        city: "台中市",
        latitude: 24.176,
        longitude: 120.646,
        stallNumber: "B-02",
        isPrimary: false,
      },
    ]);
  });

  it("rejects invalid coordinates before import", () => {
    const result = parseMarketVendorImport(
      "csv",
      [
        "name,address,district,latitude,longitude",
        '"座標錯誤店鋪","台中市西屯區文華路","西屯區",91,181',
      ].join("\n"),
    );

    expect(result.vendors).toEqual([]);
    expect(result.errors).toEqual([
      "第 2 列：latitude 必須是 -90 到 90 之間的數字。",
      "第 2 列：longitude 必須是 -180 到 180 之間的數字。",
    ]);
  });

  it("reports row-level CSV errors before import", () => {
    const result = parseMarketVendorImport(
      "csv",
      ["name,address,district,phone", '"缺地址店鋪",,"西屯區","abc"'].join(
        "\n",
      ),
    );

    expect(result.vendors).toEqual([]);
    expect(result.errors).toEqual([
      "第 2 列：新店鋪需要 name、address、district。",
      "第 2 列：phone 只能包含數字、空白、+、-、括號。",
    ]);
  });

  it("accepts JSON arrays and vendors envelopes", () => {
    expect(
      parseMarketVendorImport("json", '[{"restaurantId":"restaurant-1"}]')
        .vendors,
    ).toEqual([{ restaurantId: "restaurant-1" }]);

    expect(
      parseMarketVendorImport(
        "json",
        JSON.stringify({
          vendors: [
            {
              name: "新店鋪",
              address: "台中市西屯區文華路",
              district: "西屯區",
            },
          ],
        }),
      ),
    ).toEqual({
      vendors: [
        {
          name: "新店鋪",
          address: "台中市西屯區文華路",
          district: "西屯區",
        },
      ],
      errors: [],
    });
  });

  it("validates JSON rows before import", () => {
    const result = parseMarketVendorImport(
      "json",
      JSON.stringify([
        {
          name: "缺地址店鋪",
          district: "西屯區",
          latitude: 91,
          longitude: 181,
          phone: "abc",
        },
      ]),
    );

    expect(result.vendors).toEqual([]);
    expect(result.errors).toEqual([
      "第 1 筆：新店鋪需要 name、address、district。",
      "第 1 筆：phone 只能包含數字、空白、+、-、括號。",
      "第 1 筆：latitude 必須是 -90 到 90 之間的數字。",
      "第 1 筆：longitude 必須是 -180 到 180 之間的數字。",
    ]);
  });

  it("rejects JSON rows that are not objects", () => {
    expect(parseMarketVendorImport("json", "[1]")).toEqual({
      vendors: [],
      errors: ["每一筆店鋪資料都必須是 JSON 物件。"],
    });
  });

  it("builds a spreadsheet-friendly CSV template", () => {
    expect(buildMarketVendorImportTemplate()).toContain(
      "restaurantId,name,type,category,description,address,district,city,latitude,longitude,phone,email,website,stallNumber,isPrimary",
    );
    expect(buildMarketVendorImportTemplate()).toContain("新店鋪");
  });
});
