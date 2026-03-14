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
  it("should extend Error with code and status", () => {
    const err = new ApiError("TEST_CODE", "test message", 400);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("test message");
    expect(err.status).toBe(400);
  });

  it("should default status to 500", () => {
    const err = new ApiError("CODE", "msg");
    expect(err.status).toBe(500);
  });

  it("should carry optional details", () => {
    const details = [{ field: "email", message: "required" }];
    const err = new ApiError("VALIDATION_ERROR", "Invalid", 400, details);
    expect(err.details).toEqual(details);
  });
});

describe("factory functions", () => {
  it("notFound defaults to 404", () => {
    const err = notFound();
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Resource not found");
  });

  it("notFound accepts custom message and code", () => {
    const err = notFound("Forecast not found", "FORECAST_NOT_FOUND");
    expect(err.code).toBe("FORECAST_NOT_FOUND");
    expect(err.message).toBe("Forecast not found");
  });

  it("badRequest defaults to 400", () => {
    const err = badRequest();
    expect(err.status).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
  });

  it("badRequest accepts details", () => {
    const err = badRequest("Invalid", "VALIDATION_ERROR", [{ field: "name" }]);
    expect(err.details).toEqual([{ field: "name" }]);
  });

  it("unauthorized defaults to 401", () => {
    const err = unauthorized();
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("forbidden defaults to 403", () => {
    const err = forbidden();
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("conflict defaults to 409", () => {
    const err = conflict();
    expect(err.status).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });
});
