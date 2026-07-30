import { afterEach, describe, expect, it, vi } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { categories, menuItems } from "@makanmakan/database";
import {
  createCategorySchema,
  createMenuItemSchema,
  menuFilterSchema,
  updateCategorySchema,
  updateMenuItemSchema,
  validateCompleteMenuItem,
  validateCustomizationOptions,
  validateMenuItemAvailability,
  validatePriceConsistency,
} from "./validation";

describe("menu validation schemas", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses menu items with defaults and safe image data URLs", () => {
    const parsed = createMenuItemSchema.parse({
      categoryId: 1,
      name: "  Nasi Lemak  ",
      price: 12,
      imageId: "01940000-0000-7000-8000-000000000001",
      imageUrl: `data:image/png;base64,${Buffer.from("png").toString("base64")}`,
    });

    expect(parsed).toMatchObject({
      categoryId: 1,
      name: "Nasi Lemak",
      price: 12,
      imageId: "01940000-0000-7000-8000-000000000001",
      spiceLevel: 0,
      preparationTime: 15,
    });
  });

  // Issue #78: these fields were absent from createMenuItemSchema, so zod's
  // default strip mode silently discarded them while the API answered 201.
  it("preserves availability/featured/sort fields on create (#78)", () => {
    const parsed = createMenuItemSchema.parse({
      categoryId: 1,
      name: "審計品項A",
      price: 100,
      isFeatured: true,
      isAvailable: false,
      isPopular: true,
      sortOrder: 7,
      inventoryCount: 3,
    });

    expect(parsed).toMatchObject({
      isFeatured: true,
      isAvailable: false,
      isPopular: true,
      sortOrder: 7,
      inventoryCount: 3,
    });
  });

  it("leaves availability/featured/sort fields absent when not sent, and validates them when sent", () => {
    const parsed = createMenuItemSchema.parse({
      categoryId: 1,
      name: "Plain",
      price: 10,
    });
    // DB layer owns the defaults (isAvailable=true, sortOrder=0); the schema
    // must not materialise keys the caller never sent.
    expect(parsed).not.toHaveProperty("isAvailable");
    expect(parsed).not.toHaveProperty("sortOrder");

    expect(() =>
      createMenuItemSchema.parse({
        categoryId: 1,
        name: "Bad",
        price: 10,
        sortOrder: -1,
      }),
    ).toThrow();
    expect(() =>
      createMenuItemSchema.parse({
        categoryId: 1,
        name: "Bad",
        price: 10,
        isAvailable: "yes",
      }),
    ).toThrow();
  });

  // The admin dashboard always sends imageVariants: null when no image is
  // uploaded (useMenuManagement.ts `form.imageVariants ?? null`) — the schema
  // must accept null, like imageUrl/imageId already do.
  it("accepts the exact no-image dashboard create payload (#78)", () => {
    const parsed = createMenuItemSchema.parse({
      name: "測試品項",
      price: 100,
      categoryId: 1,
      catalogType: "menu_item",
      imageUrl: null,
      imageId: null,
      imageVariants: null,
      isFeatured: true,
      isAvailable: false,
      sortOrder: 7,
    });

    expect(parsed).toMatchObject({
      isFeatured: true,
      isAvailable: false,
      sortOrder: 7,
      imageVariants: null,
    });
  });

  it("rejects unsafe image data URLs and inconsistent prices", () => {
    expect(() =>
      createMenuItemSchema.parse({
        categoryId: 1,
        name: "Soup",
        price: 8,
        imageUrl: "data:text/html;base64,PGgxPk5vPC9oMT4=",
      }),
    ).toThrow(/imageUrl/);

    expect(() => validatePriceConsistency(12, 10)).toThrow(
      /higher than original price/,
    );
  });

  it("validates required customization and size defaults", () => {
    expect(() =>
      validateCustomizationOptions({
        customizations: [
          {
            name: "Spice",
            required: true,
            type: "single",
            choices: [{ isDefault: false }],
          },
        ],
      }),
    ).toThrow(/must have a default choice/);

    expect(() =>
      validateCustomizationOptions({
        sizes: [{ isDefault: true }, { isDefault: true }],
      }),
    ).toThrow(/Exactly one size/);

    expect(
      validateCompleteMenuItem.parse({
        categoryId: 1,
        name: "Tea",
        price: 4,
        originalPrice: 5,
        options: {
          sizes: [{ id: "s", name: "Small", priceAdjustment: 0 }],
        },
      }),
    ).toMatchObject({ name: "Tea" });
  });

  it("checks availability windows and query transforms", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 7, 10, 30, 0));

    expect(
      validateMenuItemAvailability({
        isAvailable: true,
        inventoryCount: 5,
        availableHours: {
          start: "10:00",
          end: "11:00",
          days: [0],
        },
      }),
    ).toBe(true);
    expect(
      validateMenuItemAvailability({
        isAvailable: true,
        inventoryCount: 5,
        availableHours: {
          start: "11:00",
          end: "12:00",
          days: [0],
        },
      }),
    ).toBe(false);

    expect(
      menuFilterSchema.parse({
        categoryId: "12",
        minPrice: "3.5",
        isAvailable: "true",
      }),
    ).toMatchObject({
      categoryId: 12,
      minPrice: 3.5,
      isAvailable: true,
      page: 1,
      limit: 20,
    });
  });
});

// Issue #107: the admin item form and category form have always had an English
// name input, and item search filters on it, but no column and no schema field
// existed — so zod stripped it and every save discarded it while returning 2xx.
describe("English name round-trips through the request schemas (#107)", () => {
  it("keeps nameEn on menu item create and update", () => {
    expect(
      createMenuItemSchema.parse({
        categoryId: 1,
        name: "海南雞飯",
        nameEn: "Hainanese Chicken Rice",
        price: 120,
      }),
    ).toMatchObject({ nameEn: "Hainanese Chicken Rice" });

    expect(
      updateMenuItemSchema.parse({ nameEn: "Chicken Rice" }),
    ).toMatchObject({ nameEn: "Chicken Rice" });

    // Clearing the field has to survive too, otherwise there is no way to
    // remove an English name once set.
    expect(updateMenuItemSchema.parse({ nameEn: null })).toMatchObject({
      nameEn: null,
    });
  });

  it("keeps nameEn on category create and update", () => {
    expect(
      createCategorySchema.parse({ name: "主食", nameEn: "Main Dishes" }),
    ).toMatchObject({ nameEn: "Main Dishes" });

    expect(
      updateCategorySchema.parse({ nameEn: "Mains" }),
    ).toMatchObject({ nameEn: "Mains" });
  });

  it("rejects an over-long nameEn instead of silently truncating", () => {
    expect(() =>
      createMenuItemSchema.parse({
        categoryId: 1,
        name: "x",
        price: 1,
        nameEn: "e".repeat(201),
      }),
    ).toThrow();
    expect(() =>
      createCategorySchema.parse({ name: "x", nameEn: "e".repeat(51) }),
    ).toThrow();
  });
});

/**
 * Drift guard for the #78 / #107 failure class.
 *
 * Both bugs were the same shape: a writable column existed (or was wanted) and
 * the UI sent it, but the zod schema never declared the key, so `parse()`
 * stripped it and the API answered 2xx while throwing the value away. Neither
 * a type error nor a runtime error ever fired.
 *
 * These tests make that drift fail in CI. Every column must be either declared
 * in the request schema or explicitly listed as server-owned — so adding a
 * column forces a deliberate decision about whether the API exposes it, rather
 * than defaulting to "silently unreachable".
 */
describe("request schemas do not drift from the writable columns", () => {
  /** zod key -> column property, where the API name differs from the column. */
  const MENU_ITEM_ALIASES: Record<string, string> = {
    price: "priceCents",
    originalPrice: "originalPriceCents",
  };

  const MENU_ITEM_SERVER_OWNED = new Set([
    "id",
    "restaurantId", // comes from the path, not the body
    "costPriceCents", // internal margin data, never client-set
    "minInventoryAlert", // no UI yet; add to the schema when one exists
    "orderCount",
    "rating",
    "reviewCount",
    "viewCount",
    "createdAt",
    "updatedAt",
    "deletedAt",
  ]);

  const CATEGORY_SERVER_OWNED = new Set([
    "id",
    "restaurantId",
    "iconUrl", // no UI yet
    "availableHours", // no UI yet
    "itemCount", // maintained by the service on item mutations
    "createdAt",
    "updatedAt",
    "deletedAt",
  ]);

  it("declares every client-writable menu_items column", () => {
    const declared = new Set(
      Object.keys(createMenuItemSchema.shape).map(
        (key) => MENU_ITEM_ALIASES[key] ?? key,
      ),
    );
    const undeclared = Object.keys(getTableColumns(menuItems)).filter(
      (column) => !declared.has(column) && !MENU_ITEM_SERVER_OWNED.has(column),
    );

    expect(undeclared).toEqual([]);
  });

  it("declares every client-writable categories column", () => {
    // isActive / isVisible are update-only by design, so the union is what the
    // API can accept across both routes.
    const declared = new Set([
      ...Object.keys(createCategorySchema.shape),
      ...Object.keys(updateCategorySchema.shape),
    ]);
    const undeclared = Object.keys(getTableColumns(categories)).filter(
      (column) => !declared.has(column) && !CATEGORY_SERVER_OWNED.has(column),
    );

    expect(undeclared).toEqual([]);
  });

  it("has no schema key that maps to a missing column", () => {
    const menuItemColumns = new Set(Object.keys(getTableColumns(menuItems)));
    const orphanItemKeys = Object.keys(createMenuItemSchema.shape).filter(
      (key) => !menuItemColumns.has(MENU_ITEM_ALIASES[key] ?? key),
    );
    expect(orphanItemKeys).toEqual([]);

    // updateCategory's service signature accepted `nameEn` for a long time
    // while the column did not exist — a request that reached it would have
    // crashed in Drizzle's update builder (#107).
    const categoryColumns = new Set(Object.keys(getTableColumns(categories)));
    const orphanCategoryKeys = [
      ...Object.keys(createCategorySchema.shape),
      ...Object.keys(updateCategorySchema.shape),
    ].filter((key) => !categoryColumns.has(key));
    expect(orphanCategoryKeys).toEqual([]);
  });
});
