import { describe, expect, it } from "vitest";
import { validateImageAssistedMenuItems } from "./imageAssistedMenuImport";

describe("validateImageAssistedMenuItems", () => {
  it("maps corrected rows to the existing bulk import contract with defaults", () => {
    const result = validateImageAssistedMenuItems(
      [
        {
          id: "item-1",
          name: "牛肉麵",
          price: "18000",
          categoryKey: "category-1",
          description: "招牌",
          isAvailable: true,
          sortOrder: "0",
        },
      ],
      new Map([["category-1", 7]]),
    );

    expect(result.errors).toEqual({});
    expect(result.items).toEqual([
      {
        name: "牛肉麵",
        price: 18000,
        categoryId: 7,
        description: "招牌",
        isAvailable: true,
        isFeatured: false,
        catalogType: "menu_item",
        sortOrder: 0,
      },
    ]);
  });

  it("returns field-level errors without producing a partial bulk payload", () => {
    const result = validateImageAssistedMenuItems(
      [
        {
          id: "item-1",
          name: "",
          price: "18.5",
          categoryKey: "missing",
          description: "",
          isAvailable: true,
          sortOrder: "-1",
        },
      ],
      new Map(),
    );

    expect(result.items).toEqual([]);
    expect(result.errors).toEqual({
      "item-1": {
        name: "名稱必填。",
        price: "價格必須是 0 以上整數分。",
        categoryKey: "請選擇分類。",
        sortOrder: "排序必須是 0 以上整數。",
      },
    });
  });
});
