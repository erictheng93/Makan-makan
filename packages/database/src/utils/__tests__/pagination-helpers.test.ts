import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock shared-types pagination utilities
vi.mock("@makanmakan/shared-types", () => ({
  normalizePaginationParams: vi.fn((params: any) => ({
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    sortBy: params.sortBy ?? "createdAt",
    sortOrder: params.sortOrder ?? "desc",
  })),
  calculatePaginationMeta: vi.fn(
    (page: number, pageSize: number, total: number) => ({
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
      hasNextPage: page * pageSize < total,
      hasPreviousPage: page > 1,
    }),
  ),
  getPaginationOffsetLimit: vi.fn((params: any) => ({
    offset: (params.page - 1) * params.pageSize,
    limit: params.pageSize,
  })),
  encodeCursor: vi.fn((data: any) =>
    Buffer.from(JSON.stringify(data)).toString("base64"),
  ),
  decodeCursor: vi.fn((cursor: string) =>
    JSON.parse(Buffer.from(cursor, "base64").toString()),
  ),
}));

import {
  applyPagination,
  applySorting,
  getTotalCount,
  createPaginatedResponse,
  buildCacheKey,
} from "../pagination-helpers";

describe("pagination-helpers", () => {
  describe("applyPagination", () => {
    it("should apply limit and offset to query", () => {
      const mockQuery = {
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
      };

      applyPagination(mockQuery, { page: 2, pageSize: 10 });

      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.offset).toHaveBeenCalledWith(10);
    });

    it("should use defaults for page 1 with default pageSize", () => {
      const mockQuery = {
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
      };

      applyPagination(mockQuery, { page: 1, pageSize: 20 });

      expect(mockQuery.limit).toHaveBeenCalledWith(20);
      expect(mockQuery.offset).toHaveBeenCalledWith(0);
    });
  });

  describe("applySorting", () => {
    it("should apply ascending sort when specified", () => {
      const mockQuery = { orderBy: vi.fn().mockReturnThis() };
      const mockTable = { name: "name_column", createdAt: "created_at" };

      applySorting(mockQuery, mockTable, "name", "asc");

      expect(mockQuery.orderBy).toHaveBeenCalledWith("name_column");
    });

    it("should fall back to createdAt when column not found", () => {
      const mockQuery = { orderBy: vi.fn().mockReturnThis() };
      const mockTable = { createdAt: "created_at" };

      applySorting(mockQuery, mockTable, "nonexistent", "asc");

      expect(mockQuery.orderBy).toHaveBeenCalledWith("created_at");
    });
  });

  describe("getTotalCount", () => {
    function createCountDb(count: number) {
      // The query chain: db.select().from(table) returns a thenable with optional .where()
      const resolved = [{ count }];
      const fromResult = {
        where: vi.fn().mockResolvedValue(resolved),
        then: (resolve: any) => Promise.resolve(resolved).then(resolve),
      };
      return {
        db: {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue(fromResult),
          }),
        },
        fromResult,
      };
    }

    it("should return count from query without where", async () => {
      const { db } = createCountDb(42);
      const result = await getTotalCount(db, {});
      expect(result).toBe(42);
    });

    it("should apply where clause when provided", async () => {
      const whereClause = {} as any;
      const { db, fromResult } = createCountDb(10);

      await getTotalCount(db, {}, whereClause);

      expect(fromResult.where).toHaveBeenCalledWith(whereClause);
    });

    it("should return 0 when no results", async () => {
      const fromResult = {
        where: vi.fn().mockResolvedValue([]),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
      };
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue(fromResult),
        }),
      };

      const result = await getTotalCount(db, {});
      expect(result).toBe(0);
    });
  });

  describe("createPaginatedResponse", () => {
    it("should build response with data and pagination metadata", () => {
      const data = [{ id: 1 }, { id: 2 }];

      const response = createPaginatedResponse(data, { page: 1, pageSize: 20 }, 50);

      expect(response.data).toEqual(data);
      expect(response.pagination).toEqual(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
          totalItems: 50,
          totalPages: 3,
        }),
      );
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should calculate hasNextPage correctly", () => {
      const response = createPaginatedResponse([], { page: 3, pageSize: 20 }, 50);

      expect(response.pagination.hasNextPage).toBe(false); // page 3 * 20 = 60 > 50
    });
  });
});
