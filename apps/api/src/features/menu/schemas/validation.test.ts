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
