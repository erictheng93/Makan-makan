import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock i18n before importing api module
vi.mock("@/i18n", () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}));

// The api module reads VITE_API_BASE_URL at module scope and throws if missing.
// We mock import.meta.env before import via vi.stubEnv.
vi.stubEnv("VITE_API_BASE_URL", "https://api.test.com");

// Dynamic import to ensure env stub is applied first
const { ApiException, handleApiError } = await import("@/services/api");

describe("api service", () => {
  // ──────────────────────────────────────────────
  // ApiException
  // ──────────────────────────────────────────────

  describe("ApiException", () => {
    it("should create an error with code and message", () => {
      const error = new ApiException("NOT_FOUND" as any, "Item not found");
      expect(error.message).toBe("Item not found");
      expect(error.code).toBe("NOT_FOUND");
      expect(error.name).toBe("ApiException");
      expect(error).toBeInstanceOf(Error);
    });

    it("should include optional details and status", () => {
      const error = new ApiException(
        "VALIDATION_ERROR" as any,
        "Invalid input",
        { field: "name" },
        400,
      );
      expect(error.details).toEqual({ field: "name" });
      expect(error.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────
  // handleApiError
  // ──────────────────────────────────────────────

  describe("handleApiError", () => {
    it("should return message from ApiException", () => {
      const error = new ApiException("NOT_FOUND" as any, "Not found");
      expect(handleApiError(error)).toBe("Not found");
    });

    it("should return message from generic Error", () => {
      const error = new Error("Something went wrong");
      expect(handleApiError(error)).toBe("Something went wrong");
    });

    it("should return fallback for unknown error types", () => {
      expect(handleApiError("string error")).toBe("errors.unknown");
      expect(handleApiError(null)).toBe("errors.unknown");
      expect(handleApiError(42)).toBe("errors.unknown");
    });
  });
});
