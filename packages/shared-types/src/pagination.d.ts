/**
 * Standardized Pagination Types
 *
 * Consistent pagination interface across all API endpoints
 */
/**
 * Pagination request parameters
 */
export interface PaginationParams {
    /**
     * Page number (1-indexed)
     * @default 1
     */
    page?: number;
    /**
     * Number of items per page
     * @default 20
     */
    pageSize?: number;
    /**
     * Sort field
     * @example "createdAt" | "updatedAt" | "name"
     */
    sortBy?: string;
    /**
     * Sort order
     * @default "desc"
     */
    sortOrder?: 'asc' | 'desc';
    /**
     * Search query
     */
    search?: string;
    /**
     * Additional filters (endpoint-specific)
     */
    filters?: Record<string, any>;
}
/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
    /**
     * Current page number (1-indexed)
     */
    currentPage: number;
    /**
     * Number of items per page
     */
    pageSize: number;
    /**
     * Total number of items across all pages
     */
    totalItems: number;
    /**
     * Total number of pages
     */
    totalPages: number;
    /**
     * Whether there is a next page
     */
    hasNextPage: boolean;
    /**
     * Whether there is a previous page
     */
    hasPreviousPage: boolean;
    /**
     * Index of first item on current page (0-indexed)
     */
    startIndex: number;
    /**
     * Index of last item on current page (0-indexed)
     */
    endIndex: number;
}
/**
 * Standardized paginated response
 */
export interface PaginatedResponse<T> {
    /**
     * Array of items for current page
     */
    data: T[];
    /**
     * Pagination metadata
     */
    pagination: PaginationMeta;
    /**
     * Timestamp of response
     */
    timestamp?: string;
}
/**
 * Cursor-based pagination parameters (for real-time feeds)
 */
export interface CursorPaginationParams {
    /**
     * Number of items to fetch
     * @default 20
     */
    limit?: number;
    /**
     * Cursor for next page (opaque string)
     */
    cursor?: string;
    /**
     * Direction of pagination
     * @default "forward"
     */
    direction?: 'forward' | 'backward';
}
/**
 * Cursor-based pagination metadata
 */
export interface CursorPaginationMeta {
    /**
     * Number of items returned
     */
    count: number;
    /**
     * Cursor for next page (null if no more pages)
     */
    nextCursor: string | null;
    /**
     * Cursor for previous page (null if on first page)
     */
    previousCursor: string | null;
    /**
     * Whether there are more items
     */
    hasMore: boolean;
}
/**
 * Cursor-based paginated response
 */
export interface CursorPaginatedResponse<T> {
    /**
     * Array of items
     */
    data: T[];
    /**
     * Cursor pagination metadata
     */
    pagination: CursorPaginationMeta;
    /**
     * Timestamp of response
     */
    timestamp?: string;
}
/**
 * Infinite scroll state
 */
export interface InfiniteScrollState<T> {
    /**
     * All loaded items
     */
    items: T[];
    /**
     * Whether currently loading
     */
    isLoading: boolean;
    /**
     * Whether there are more items to load
     */
    hasMore: boolean;
    /**
     * Current page number
     */
    currentPage: number;
    /**
     * Error if any
     */
    error: Error | null;
}
/**
 * Pagination configuration
 */
export interface PaginationConfig {
    /**
     * Default page size
     * @default 20
     */
    defaultPageSize: number;
    /**
     * Maximum page size allowed
     * @default 100
     */
    maxPageSize: number;
    /**
     * Minimum page size allowed
     * @default 1
     */
    minPageSize: number;
    /**
     * Default sort order
     * @default "desc"
     */
    defaultSortOrder: 'asc' | 'desc';
}
/**
 * Default pagination configuration
 */
export declare const DEFAULT_PAGINATION_CONFIG: PaginationConfig;
/**
 * Calculate pagination metadata from total count
 */
export declare function calculatePaginationMeta(page: number, pageSize: number, totalItems: number): PaginationMeta;
/**
 * Validate pagination parameters
 */
export declare function validatePaginationParams(params: PaginationParams, config?: PaginationConfig): {
    valid: boolean;
    errors: string[];
};
/**
 * Normalize pagination parameters with defaults
 */
export declare function normalizePaginationParams(params: PaginationParams, config?: PaginationConfig): Required<Omit<PaginationParams, 'search' | 'filters'>> & Pick<PaginationParams, 'search' | 'filters'>;
/**
 * Generate SQL OFFSET and LIMIT from pagination params
 */
export declare function getPaginationOffsetLimit(params: PaginationParams): {
    offset: number;
    limit: number;
};
/**
 * Encode cursor for cursor-based pagination
 */
export declare function encodeCursor(data: Record<string, any>): string;
/**
 * Decode cursor for cursor-based pagination
 */
export declare function decodeCursor(cursor: string): Record<string, any>;
//# sourceMappingURL=pagination.d.ts.map