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
  page?: number

  /**
   * Number of items per page
   * @default 20
   */
  pageSize?: number

  /**
   * Sort field
   * @example "createdAt" | "updatedAt" | "name"
   */
  sortBy?: string

  /**
   * Sort order
   * @default "desc"
   */
  sortOrder?: 'asc' | 'desc'

  /**
   * Search query
   */
  search?: string

  /**
   * Additional filters (endpoint-specific)
   */
  filters?: Record<string, any>
}

/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
  /**
   * Current page number (1-indexed)
   */
  currentPage: number

  /**
   * Number of items per page
   */
  pageSize: number

  /**
   * Total number of items across all pages
   */
  totalItems: number

  /**
   * Total number of pages
   */
  totalPages: number

  /**
   * Whether there is a next page
   */
  hasNextPage: boolean

  /**
   * Whether there is a previous page
   */
  hasPreviousPage: boolean

  /**
   * Index of first item on current page (0-indexed)
   */
  startIndex: number

  /**
   * Index of last item on current page (0-indexed)
   */
  endIndex: number
}

/**
 * Standardized paginated response
 */
export interface PaginatedResponse<T> {
  /**
   * Array of items for current page
   */
  data: T[]

  /**
   * Pagination metadata
   */
  pagination: PaginationMeta

  /**
   * Timestamp of response
   */
  timestamp?: string
}

/**
 * Cursor-based pagination parameters (for real-time feeds)
 */
export interface CursorPaginationParams {
  /**
   * Number of items to fetch
   * @default 20
   */
  limit?: number

  /**
   * Cursor for next page (opaque string)
   */
  cursor?: string

  /**
   * Direction of pagination
   * @default "forward"
   */
  direction?: 'forward' | 'backward'
}

/**
 * Cursor-based pagination metadata
 */
export interface CursorPaginationMeta {
  /**
   * Number of items returned
   */
  count: number

  /**
   * Cursor for next page (null if no more pages)
   */
  nextCursor: string | null

  /**
   * Cursor for previous page (null if on first page)
   */
  previousCursor: string | null

  /**
   * Whether there are more items
   */
  hasMore: boolean
}

/**
 * Cursor-based paginated response
 */
export interface CursorPaginatedResponse<T> {
  /**
   * Array of items
   */
  data: T[]

  /**
   * Cursor pagination metadata
   */
  pagination: CursorPaginationMeta

  /**
   * Timestamp of response
   */
  timestamp?: string
}

/**
 * Infinite scroll state
 */
export interface InfiniteScrollState<T> {
  /**
   * All loaded items
   */
  items: T[]

  /**
   * Whether currently loading
   */
  isLoading: boolean

  /**
   * Whether there are more items to load
   */
  hasMore: boolean

  /**
   * Current page number
   */
  currentPage: number

  /**
   * Error if any
   */
  error: Error | null
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  /**
   * Default page size
   * @default 20
   */
  defaultPageSize: number

  /**
   * Maximum page size allowed
   * @default 100
   */
  maxPageSize: number

  /**
   * Minimum page size allowed
   * @default 1
   */
  minPageSize: number

  /**
   * Default sort order
   * @default "desc"
   */
  defaultSortOrder: 'asc' | 'desc'
}

/**
 * Default pagination configuration
 */
export const DEFAULT_PAGINATION_CONFIG: PaginationConfig = {
  defaultPageSize: 20,
  maxPageSize: 100,
  minPageSize: 1,
  defaultSortOrder: 'desc'
}

/**
 * Calculate pagination metadata from total count
 */
export function calculatePaginationMeta(
  page: number,
  pageSize: number,
  totalItems: number
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / pageSize)
  const currentPage = Math.min(Math.max(1, page), totalPages || 1)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1)

  return {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    startIndex,
    endIndex
  }
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(
  params: PaginationParams,
  config: PaginationConfig = DEFAULT_PAGINATION_CONFIG
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  const page = params.page ?? 1
  const pageSize = params.pageSize ?? config.defaultPageSize

  if (page < 1) {
    errors.push('Page number must be >= 1')
  }

  if (pageSize < config.minPageSize) {
    errors.push(`Page size must be >= ${config.minPageSize}`)
  }

  if (pageSize > config.maxPageSize) {
    errors.push(`Page size must be <= ${config.maxPageSize}`)
  }

  if (params.sortOrder && !['asc', 'desc'].includes(params.sortOrder)) {
    errors.push('Sort order must be "asc" or "desc"')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Normalize pagination parameters with defaults
 */
export function normalizePaginationParams(
  params: PaginationParams,
  config: PaginationConfig = DEFAULT_PAGINATION_CONFIG
): Required<Omit<PaginationParams, 'search' | 'filters'>> & Pick<PaginationParams, 'search' | 'filters'> {
  return {
    page: Math.max(1, params.page ?? 1),
    pageSize: Math.min(
      Math.max(config.minPageSize, params.pageSize ?? config.defaultPageSize),
      config.maxPageSize
    ),
    sortBy: params.sortBy ?? 'createdAt',
    sortOrder: params.sortOrder ?? config.defaultSortOrder,
    search: params.search,
    filters: params.filters
  }
}

/**
 * Generate SQL OFFSET and LIMIT from pagination params
 */
export function getPaginationOffsetLimit(params: PaginationParams): {
  offset: number
  limit: number
} {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? DEFAULT_PAGINATION_CONFIG.defaultPageSize

  return {
    offset: (page - 1) * pageSize,
    limit: pageSize
  }
}

/**
 * Encode cursor for cursor-based pagination
 */
export function encodeCursor(data: Record<string, any>): string {
  return Buffer.from(JSON.stringify(data)).toString('base64')
}

/**
 * Decode cursor for cursor-based pagination
 */
export function decodeCursor(cursor: string): Record<string, any> {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
  } catch {
    throw new Error('Invalid cursor')
  }
}
