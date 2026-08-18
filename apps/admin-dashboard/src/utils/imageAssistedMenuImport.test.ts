import { describe, expect, it } from "vitest";
import {
  validateImageAssistedMenuCategories,
  validateImageAssistedMenuItems,
} from "./imageAssistedMenuImport";

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
        name: "nameRequired",
        price: "priceInvalid",
        categoryKey: "categoryRequired",
        sortOrder: "sortOrderInvalid",
      },
    });
  });

  it("rejects blank numeric fields instead of treating them as zero", () => {
    const result = validateImageAssistedMenuItems(
      [
        {
          id: "item-1",
          name: "牛肉麵",
          price: "",
          categoryKey: "category-1",
          description: "",
          isAvailable: true,
          sortOrder: "",
        },
      ],
      new Map([["category-1", 7]]),
    );

    expect(result.items).toEqual([]);
    expect(result.errors).toEqual({
      "item-1": {
        price: "priceRequired",
        sortOrder: "sortOrderRequired",
      },
    });
  });

  it("returns an error for each blank category name", () => {
    expect(
      validateImageAssistedMenuCategories([
        { key: "new-1", name: "", sortOrder: 0 },
        { key: "new-2", name: " 飲料 ", sortOrder: 1 },
      ]),
    ).toEqual({ "new-1": "categoryNameRequired" });
  });
});
