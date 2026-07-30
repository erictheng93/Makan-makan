import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMenuItemSchema,
  menuFilterSchema,
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
