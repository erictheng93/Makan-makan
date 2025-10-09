/**
 * Standardized Pagination Types
 *
 * Consistent pagination interface across all API endpoints
 */
/**
 * Default pagination configuration
 */
export const DEFAULT_PAGINATION_CONFIG = {
    defaultPageSize: 20,
    maxPageSize: 100,
    minPageSize: 1,
    defaultSortOrder: 'desc'
};
/**
 * Calculate pagination metadata from total count
 */
export function calculatePaginationMeta(page, pageSize, totalItems) {
    const totalPages = Math.ceil(totalItems / pageSize);
    const currentPage = Math.min(Math.max(1, page), totalPages || 1);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1);
    return {
        currentPage,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
        startIndex,
        endIndex
    };
}
/**
 * Validate pagination parameters
 */
export function validatePaginationParams(params, config = DEFAULT_PAGINATION_CONFIG) {
    const errors = [];
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? config.defaultPageSize;
    if (page < 1) {
        errors.push('Page number must be >= 1');
    }
    if (pageSize < config.minPageSize) {
        errors.push(`Page size must be >= ${config.minPageSize}`);
    }
    if (pageSize > config.maxPageSize) {
        errors.push(`Page size must be <= ${config.maxPageSize}`);
    }
    if (params.sortOrder && !['asc', 'desc'].includes(params.sortOrder)) {
        errors.push('Sort order must be "asc" or "desc"');
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
/**
 * Normalize pagination parameters with defaults
 */
export function normalizePaginationParams(params, config = DEFAULT_PAGINATION_CONFIG) {
    return {
        page: Math.max(1, params.page ?? 1),
        pageSize: Math.min(Math.max(config.minPageSize, params.pageSize ?? config.defaultPageSize), config.maxPageSize),
        sortBy: params.sortBy ?? 'createdAt',
        sortOrder: params.sortOrder ?? config.defaultSortOrder,
        search: params.search,
        filters: params.filters
    };
}
/**
 * Generate SQL OFFSET and LIMIT from pagination params
 */
export function getPaginationOffsetLimit(params) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? DEFAULT_PAGINATION_CONFIG.defaultPageSize;
    return {
        offset: (page - 1) * pageSize,
        limit: pageSize
    };
}
/**
 * Encode cursor for cursor-based pagination
 */
export function encodeCursor(data) {
    return Buffer.from(JSON.stringify(data)).toString('base64');
}
/**
 * Decode cursor for cursor-based pagination
 */
export function decodeCursor(cursor) {
    try {
        return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    }
    catch {
        throw new Error('Invalid cursor');
    }
}
