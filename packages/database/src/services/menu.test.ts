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
