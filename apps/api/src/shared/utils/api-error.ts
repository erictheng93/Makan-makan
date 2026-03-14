/**
 * Unified API Error class.
 * Throw this from route handlers or services — the global error handler
 * in index.ts formats it into { success: false, error: { code, message } }.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function notFound(
  message = "Resource not found",
  code = "NOT_FOUND",
): ApiError {
  return new ApiError(code, message, 404);
}

export function badRequest(
  message = "Invalid request",
  code = "BAD_REQUEST",
  details?: unknown,
): ApiError {
  return new ApiError(code, message, 400, details);
}

export function unauthorized(
  message = "Unauthorized",
  code = "UNAUTHORIZED",
): ApiError {
  return new ApiError(code, message, 401);
}

export function forbidden(
  message = "Access denied",
  code = "FORBIDDEN",
): ApiError {
  return new ApiError(code, message, 403);
}

export function conflict(
  message = "Resource conflict",
  code = "CONFLICT",
): ApiError {
  return new ApiError(code, message, 409);
}
