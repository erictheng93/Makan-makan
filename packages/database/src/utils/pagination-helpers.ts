/**
 * Database Pagination Helpers
 *
 * Utilities for implementing pagination in Drizzle ORM queries
 */

import { sql, SQL } from "drizzle-orm";
import type {
  PaginationParams,
  PaginatedResponse,
  PaginationMeta,
  CursorPaginatedResponse,
} from "@makanmakan/shared-types";
import {
  calculatePaginationMeta,
  normalizePaginationParams,
  getPaginationOffsetLimit,
  DEFAULT_PAGINATION_CONFIG,
  encodeCursor,
  decodeCursor,
} from "@makanmakan/shared-types";

/**
 * Apply pagination to Drizzle query
 *
 * @example
 * const query = db.select().from(orders).where(eq(orders.restaurantId, restaurantId))
 * const paginatedQuery = applyPagination(query, { page: 1, pageSize: 20 })
 * const items = await paginatedQuery
 */
export function applyPagination<T>(query: any, params: PaginationParams): any {
  const normalized = normalizePaginationParams(params);
  const { offset, limit } = getPaginationOffsetLimit(normalized);

  return query.limit(limit).offset(offset);
}

/**
 * Apply sorting to Drizzle query
 *
 * @example
 * const query = db.select().from(orders)
 * const sortedQuery = applySorting(query, orders, 'createdAt', 'desc')
 * const items = await sortedQuery
 */
export function applySorting<T>(
  query: any,
  table: any,
  sortBy: string = "createdAt",
  sortOrder: "asc" | "desc" = "desc",
): any {
  const column = table[sortBy];
  if (!column) {
    console.warn(
      `[Pagination] Sort column ${sortBy} not found, using createdAt`,
    );
    return query.orderBy(
      sortOrder === "asc" ? table.createdAt : sql`${table.createdAt} DESC`,
    );
  }

  return query.orderBy(sortOrder === "asc" ? column : sql`${column} DESC`);
}

/**
 * Get total count for pagination
 *
 * @example
 * const total = await getTotalCount(
 *   db,
 *   orders,
 *   eq(orders.restaurantId, restaurantId)
 * )
 */
export async function getTotalCount(
  db: any,
  table: any,
  where?: SQL,
): Promise<number> {
  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(table);

  if (where) {
    countQuery.where(where);
  }

  const result = await countQuery;
  return result[0]?.count ?? 0;
}

/**
 * Create paginated response
 *
 * @example
 * const items = await paginatedQuery
 * const total = await getTotalCount(db, orders, whereCondition)
 * const response = createPaginatedResponse(items, params, total)
 */
export function createPaginatedResponse<T>(
  data: T[],
  params: PaginationParams,
  totalItems: number,
): PaginatedResponse<T> {
  const normalized = normalizePaginationParams(params);
  const pagination = calculatePaginationMeta(
    normalized.page,
    normalized.pageSize,
    totalItems,
  );

  return {
    data,
    pagination,
    timestamp: new Date().toISOString(),
  };
}

/**
 * All-in-one pagination helper
 *
 * Applies pagination, sorting, and creates response
 *
 * @example
 * const response = await paginateQuery(
 *   db,
 *   db.select().from(orders),
 *   orders,
 *   { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' },
 *   eq(orders.restaurantId, restaurantId)
 * )
 */
export async function paginateQuery<T>(
  db: any,
  baseQuery: any,
  table: any,
  params: PaginationParams,
  where?: SQL,
): Promise<PaginatedResponse<T>> {
  const normalized = normalizePaginationParams(params);

  // Apply where clause
  let query = baseQuery;
  if (where) {
    query = query.where(where);
  }

  // Apply sorting
  query = applySorting(query, table, normalized.sortBy, normalized.sortOrder);

  // Get total count
  const totalItems = await getTotalCount(db, table, where);

  // Apply pagination
  query = applyPagination(query, normalized);

  // Execute query
  const data = await query;

  // Create response
  return createPaginatedResponse(data, normalized, totalItems);
}

/**
 * Cursor-based pagination helper
 *
 * @example
 * const response = await paginateWithCursor(
 *   db,
 *   orders,
 *   { cursor: 'eyJpZCI6MTIzfQ==', limit: 20 },
 *   'id',
 *   'createdAt'
 * )
 */
export async function paginateWithCursor<T extends Record<string, any>>(
  db: any,
  table: any,
  options: {
    cursor?: string;
    limit?: number;
    where?: SQL;
  },
  cursorField: string = "id",
  sortField: string = "createdAt",
): Promise<CursorPaginatedResponse<T>> {
  const { cursor, limit = 20, where: whereCondition } = options;

  let query = db.select().from(table);

  // Apply where clause
  if (whereCondition) {
    query = query.where(whereCondition);
  }

  // Apply cursor
  if (cursor) {
    try {
      const decoded = decodeCursor(cursor);
      const cursorValue = decoded[cursorField];

      // Add cursor condition (assuming forward pagination)
      query = query.where(sql`${table[cursorField]} > ${cursorValue}`);
    } catch (error) {
      console.error("[Cursor Pagination] Invalid cursor:", error);
      throw new Error("Invalid cursor");
    }
  }

  // Apply sorting
  query = query.orderBy(table[sortField]);

  // Fetch one extra item to check if there are more
  query = query.limit(limit + 1);

  const items = await query;
  const hasMore = items.length > limit;

  // Remove extra item if exists
  if (hasMore) {
    items.pop();
  }

  // Generate next cursor
  const nextCursor =
    hasMore && items.length > 0
      ? encodeCursor({ [cursorField]: items[items.length - 1][cursorField] })
      : null;

  // Generate previous cursor (if current cursor exists)
  const previousCursor =
    cursor && items.length > 0
      ? encodeCursor({ [cursorField]: items[0][cursorField] })
      : null;

  return {
    data: items as T[],
    pagination: {
      count: items.length,
      nextCursor,
      previousCursor,
      hasMore,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Search helper with pagination
 *
 * @example
 * const response = await searchWithPagination(
 *   db,
 *   menuItems,
 *   ['name', 'description'],
 *   'pizza',
 *   { page: 1, pageSize: 20 }
 * )
 */
export async function searchWithPagination<T>(
  db: any,
  table: any,
  searchFields: string[],
  searchQuery: string,
  params: PaginationParams,
  additionalWhere?: SQL,
): Promise<PaginatedResponse<T>> {
  if (!searchQuery || searchQuery.trim() === "") {
    return paginateQuery(
      db,
      db.select().from(table),
      table,
      params,
      additionalWhere,
    );
  }

  // Build search conditions
  const searchConditions = searchFields
    .map(
      (field) =>
        sql`LOWER(${table[field]}) LIKE LOWER(${"%" + searchQuery + "%"})`,
    )
    .reduce((acc, condition) =>
      acc ? sql`${acc} OR ${condition}` : condition,
    );

  // Combine with additional where
  const where = additionalWhere
    ? sql`(${searchConditions}) AND (${additionalWhere})`
    : searchConditions;

  return paginateQuery(db, db.select().from(table), table, params, where);
}

/**
 * Batch pagination helper
 *
 * Fetches multiple pages at once (useful for prefetching)
 *
 * @example
 * const pages = await batchPaginate(
 *   db,
 *   orders,
 *   [1, 2, 3],
 *   { pageSize: 20, sortBy: 'createdAt' }
 * )
 */
export async function batchPaginate<T>(
  db: any,
  table: any,
  pages: number[],
  params: Omit<PaginationParams, "page">,
  where?: SQL,
): Promise<Record<number, PaginatedResponse<T>>> {
  const results: Record<number, PaginatedResponse<T>> = {};

  await Promise.all(
    pages.map(async (page) => {
      const response = await paginateQuery<T>(
        db,
        db.select().from(table),
        table,
        { ...params, page },
        where,
      );
      results[page] = response;
    }),
  );

  return results;
}
