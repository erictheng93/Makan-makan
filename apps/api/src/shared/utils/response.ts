/**
 * Response Utilities
 * Standardized response helpers for API responses
 */

export function createSuccessResponse<T>(
  data: T,
  message?: string,
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    [key: string]: unknown;
  },
) {
  return {
    success: true as const,
    data,
    message,
    timestamp: new Date().toISOString(),
    ...(meta && { meta }),
  };
}

/**
 * Create a unified error response.
 * Returns { success: false, error: { code, message } } shape.
 */
export function createErrorResponse(message: string, code?: number | string) {
  const errorCode =
    typeof code === "number" ? `HTTP_${code}` : code || "INTERNAL_ERROR";
  return {
    success: false as const,
    error: {
      code: errorCode,
      message,
    },
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
  message?: string,
) {
  return createSuccessResponse(data, message, { pagination });
}
