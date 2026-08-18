import { beforeAll, describe, expect, it, vi } from "vitest";
import { isGroupOrderNotFound } from "@/utils/group-order-error";

// `@/services/api` validates its config the moment it is imported, so the real
// exception class only becomes reachable once the env it wants is present.
type ApiExceptionCtor = new (
  code: string,
  message: string,
  details?: unknown,
  status?: number,
) => Error;

let ApiException: ApiExceptionCtor;

beforeAll(async () => {
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8787/api/v1");
  ({ ApiException } = (await import("@/services/api")) as unknown as {
    ApiException: ApiExceptionCtor;
  });
});

/**
 * Built from the real ApiException rather than a hand-shaped literal. The join
 * view's own check used to read "404" out of the message, and its test fed it
 * `new Error("404")` — a shape `apiClient` has never thrown. Both sides agreed
 * with each other and neither agreed with the client, so the test kept passing
 * while the screen it guarded could not have worked.
 */
describe("group order not-found detection", () => {
  it("recognises the exception apiClient actually throws for a dead share code", () => {
    const error = new ApiException(
      "NOT_FOUND",
      "找不到要求的資源",
      undefined,
      404,
    );

    expect(isGroupOrderNotFound(error)).toBe(true);
  });

  it("recognises the envelope code when no status survived the trip", () => {
    expect(isGroupOrderNotFound({ code: "NOT_FOUND" })).toBe(true);
  });

  it("leaves a transient failure as a failure", () => {
    const error = new ApiException(
      "INTERNAL_SERVER_ERROR",
      "系統暫時無法處理",
      undefined,
      500,
    );

    expect(isGroupOrderNotFound(error)).toBe(false);
  });

  /**
   * The message is the one thing that must not decide this. It is the server's
   * prose, it is not shown, and it is free to change.
   */
  it("does not decide from the message text", () => {
    expect(
      isGroupOrderNotFound(new Error("Request failed with status 404")),
    ).toBe(false);
  });
});
