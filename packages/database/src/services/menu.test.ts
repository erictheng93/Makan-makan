import { describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { MenuService } from "./menu";

function createServiceWithDb<TDb extends object>(db: TDb): MenuService {
  const service = new MenuService({} as D1Database, {
    JWT_SECRET: "test",
  });
  (service as unknown as { db: TDb }).db = db;
  return service;
}

function createQuery(result: unknown, capturedWhere: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    where: vi.fn((condition: unknown) => {
      capturedWhere.push(condition);
      return builder;
    }),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    offset: vi.fn(() => builder),
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function collectSqlMetadata(input: unknown): {
  columns: string[];
  numbers: number[];
} {
  const columns: string[] = [];
  const numbers: number[] = [];
  const visit = (value: unknown) => {
    if (typeof value === "number") {
      numbers.push(value);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const maybeColumn = value as {
      columnType?: unknown;
      name?: unknown;
      queryChunks?: unknown[];
    };
    if (
      typeof maybeColumn.columnType === "string" &&
      typeof maybeColumn.name === "string"
    ) {
      columns.push(maybeColumn.name);
      return;
    }
    if (Array.isArray(maybeColumn.queryChunks)) {
      maybeColumn.queryChunks.forEach(visit);
    }
  };
  visit(input);
  return { columns, numbers };
}

describe("MenuService money filters", () => {
  it("filters price ranges against authoritative cents", async () => {
    const capturedWhere: unknown[] = [];
    const results = [[], [{ totalCount: 0 }]];
    const db = {
      select: vi.fn(() => createQuery(results.shift() ?? [], capturedWhere)),
    };
    const service = createServiceWithDb(db);

    await service.searchMenuItems(
      "restaurant-1",
      { priceRange: [100, 300] },
      1,
      20,
    );

    const priceRangeCondition = capturedWhere[0];
    const metadata = collectSqlMetadata(priceRangeCondition);
    expect(metadata.columns).toContain("price_cents");
    expect(metadata.columns).not.toContain("price");
    expect(metadata.numbers).toEqual(expect.arrayContaining([10000, 30000]));
  });
});

describe("MenuService image ownership", () => {
  it("round-trips imageId through create, update, and read mappers", async () => {
    const insertedItem = {
      id: 101,
      restaurantId: "restaurant-1",
      categoryId: 7,
      catalogType: "menu_item",
      name: "Laksa",
      description: null,
      ingredients: null,
      priceCents: 18000,
      originalPriceCents: null,
      imageUrl: null,
      imageId: "01940000-0000-7000-8000-000000000001",
      imageVariants: null,
      isAvailable: true,
      isFeatured: false,
      isPopular: false,
      sortOrder: 0,
      inventoryCount: null,
      spiceLevel: 0,
      preparationTime: 15,
      calories: null,
      dietaryInfo: null,
      allergens: null,
      options: null,
      orderCount: 0,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    };
    const updatedItem = {
      ...insertedItem,
      imageId: "01940000-0000-7000-8000-000000000002",
    };
    const getItem = {
      ...updatedItem,
      imageId: "01940000-0000-7000-8000-000000000003",
    };
    const capturedWrites: unknown[] = [];
    const createBuilder = {
      values: vi.fn((data: unknown) => {
        capturedWrites.push(data);
        return createBuilder;
      }),
      returning: vi.fn(async () => [insertedItem]),
    };
    const updateBuilder = {
      set: vi.fn((data: unknown) => {
        capturedWrites.push(data);
        return updateBuilder;
      }),
      where: vi.fn(() => updateBuilder),
      returning: vi.fn(async () => [updatedItem]),
    };
    const selectBuilder = {
      from: vi.fn(() => selectBuilder),
      where: vi.fn(() => selectBuilder),
      limit: vi.fn(async () => [getItem]),
    };
    const db = {
      insert: vi.fn(() => createBuilder),
      update: vi.fn(() => updateBuilder),
      select: vi.fn(() => selectBuilder),
      query: {
        menuItems: {
          findFirst: vi.fn(async () => getItem),
        },
      },
    };
    const service = createServiceWithDb(db);
    vi.spyOn(
      service as unknown as { updateCategoryItemCount: (id: number) => void },
      "updateCategoryItemCount",
    ).mockResolvedValue(undefined);
    vi.spyOn(
      service as unknown as { invalidateCache: () => void },
      "invalidateCache",
    ).mockResolvedValue(undefined);

    await expect(
      service.createMenuItem({
        restaurantId: "restaurant-1",
        categoryId: 7,
        name: "Laksa",
        price: 180,
        imageId: insertedItem.imageId,
      }),
    ).resolves.toMatchObject({ imageId: insertedItem.imageId });
    await expect(
      service.updateMenuItem(101, { imageId: updatedItem.imageId }),
    ).resolves.toMatchObject({ imageId: updatedItem.imageId });
    await expect(service.getMenuItem(101)).resolves.toMatchObject({
      imageId: getItem.imageId,
    });
    expect(capturedWrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ imageId: insertedItem.imageId }),
        expect.objectContaining({ imageId: updatedItem.imageId }),
      ]),
    );
  });
});
