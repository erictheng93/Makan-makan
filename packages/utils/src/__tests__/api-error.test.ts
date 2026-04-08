import { describe, it, expect } from "vitest";
import {
  ApiError,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
} from "../api-error";

describe("ApiError", () => {
  describe("constructor", () => {
    it("should set code, message, status, and details", () => {
      const error = new ApiError("TEST_ERROR", "test message", 422, {
        field: "name",
      });
      expect(error.code).toBe("TEST_ERROR");
      expect(error.message).toBe("test message");
      expect(error.status).toBe(422);
      expect(error.details).toEqual({ field: "name" });
    });

    it("should default status to 500", () => {
      const error = new ApiError("INTERNAL", "something broke");
      expect(error.status).toBe(500);
    });

    it("should extend Error", () => {
      const error = new ApiError("CODE", "msg");
      expect(error).toBeInstanceOf(Error);
    });

    it("should have name ApiError", () => {
      const error = new ApiError("CODE", "msg");
      expect(error.name).toBe("ApiError");
    });

    it("should have details as undefined when not provided", () => {
      const error = new ApiError("CODE", "msg", 400);
      expect(error.details).toBeUndefined();
    });
  });

  describe("factory functions", () => {
    it("notFound returns 404 with defaults", () => {
      const error = notFound();
      expect(error.status).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("Resource not found");
    });

    it("notFound accepts custom message and code", () => {
      const error = notFound("User not found", "USER_NOT_FOUND");
      expect(error.status).toBe(404);
      expect(error.code).toBe("USER_NOT_FOUND");
      expect(error.message).toBe("User not found");
    });

    it("badRequest returns 400 with defaults", () => {
      const error = badRequest();
      expect(error.status).toBe(400);
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.message).toBe("Invalid request");
    });

    it("badRequest accepts details", () => {
      const details = { field: "email", reason: "invalid format" };
      const error = badRequest(
        "Validation failed",
        "VALIDATION_ERROR",
        details,
      );
      expect(error.status).toBe(400);
      expect(error.details).toEqual(details);
    });

    it("unauthorized returns 401 with defaults", () => {
      const error = unauthorized();
      expect(error.status).toBe(401);
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toBe("Unauthorized");
    });

    it("forbidden returns 403 with defaults", () => {
      const error = forbidden();
      expect(error.status).toBe(403);
      expect(error.code).toBe("FORBIDDEN");
      expect(error.message).toBe("Access denied");
    });

    it("conflict returns 409 with defaults", () => {
      const error = conflict();
      expect(error.status).toBe(409);
      expect(error.code).toBe("CONFLICT");
      expect(error.message).toBe("Resource conflict");
    });

    it("all factories return ApiError instances", () => {
      expect(notFound()).toBeInstanceOf(ApiError);
      expect(badRequest()).toBeInstanceOf(ApiError);
      expect(unauthorized()).toBeInstanceOf(ApiError);
      expect(forbidden()).toBeInstanceOf(ApiError);
      expect(conflict()).toBeInstanceOf(ApiError);
    });
  });
});
