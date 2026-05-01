/**
 * Shared Utilities
 * Common utility functions used across feature modules
 */

// Re-export existing utils if they exist
// export * from '../../utils/common'
export * from "./money";

// Common response helpers
export const createSuccessResponse = <T>(data: T, message?: string) => ({
  success: true as const,
  data,
  message: message || "Operation successful",
});

export const createErrorResponse = (message: string, code?: string) => ({
  success: false as const,
  error: {
    message,
    code: code || "UNKNOWN_ERROR",
  },
});

// Common validation helpers
export const isValidId = (id: unknown): id is number => {
  return typeof id === "number" && Number.isInteger(id) && id > 0;
};

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/\s+/g, " ");
};
