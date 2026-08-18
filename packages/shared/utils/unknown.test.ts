import { describe, it, expect } from "vitest";
import {
  describeErrorForLog,
  getApiErrorCode,
  getApiErrorStatus,
  getApiErrorStatusText,
  isRecord,
} from "./unknown";

describe("isRecord", () => {
  it("accepts objects and arrays, rejects null and primitives", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord("x")).toBe(false);
    expect(isRecord(0)).toBe(false);
  });
});

describe("getApiErrorCode", () => {
  it("reads the machine-readable code the recovery UIs branch on", () => {
    const error = {
      response: {
        status: 409,
        data: { error: { code: "MENU_ITEM_MODIFIED", message: "conflict" } },
      },
    };
    expect(getApiErrorCode(error)).toBe("MENU_ITEM_MODIFIED");
  });

  it("returns undefined when the envelope carries no code", () => {
    expect(
      getApiErrorCode({ response: { data: { error: {} } } }),
    ).toBeUndefined();
    expect(
      getApiErrorCode({ response: { data: { error: "legacy string" } } }),
    ).toBeUndefined();
    expect(getApiErrorCode(new Error("boom"))).toBeUndefined();
  });
});

describe("getApiErrorStatus / getApiErrorStatusText", () => {
  it("reads them off an axios-shaped error", () => {
    const error = { response: { status: 404, statusText: "Not Found" } };
    expect(getApiErrorStatus(error)).toBe(404);
    expect(getApiErrorStatusText(error)).toBe("Not Found");
  });

  it("returns undefined when the shape does not match", () => {
    expect(getApiErrorStatus(new Error("boom"))).toBeUndefined();
    expect(getApiErrorStatus({ response: { status: "404" } })).toBeUndefined();
    expect(getApiErrorStatusText({ response: {} })).toBeUndefined();
  });
});

/**
 * The counterpart to `resolveUserFacingError`: this one is allowed to read the
 * server's sentence, because nothing renders what it returns. The pair only
 * works if each stays on its own side, so these tests assert the reading that
 * would be a leak anywhere else.
 */
describe("describeErrorForLog", () => {
  it("prefers the unified envelope's message", () => {
    expect(
      describeErrorForLog({
        response: {
          data: {
            error: { code: "D1_ERROR", message: "no such table: seats" },
          },
        },
        message: "Request failed with status code 500",
      }),
    ).toBe("no such table: seats");
  });

  it("reads a legacy body message when there is no envelope", () => {
    expect(
      describeErrorForLog({ response: { data: { message: "token expired" } } }),
    ).toBe("token expired");
  });

  it("falls back to the throwable's own message for a transport failure", () => {
    expect(describeErrorForLog(new Error("Network Error"))).toBe(
      "Network Error",
    );
  });

  it("uses the caller's text when the error says nothing", () => {
    expect(describeErrorForLog({}, "sync failed")).toBe("sync failed");
    expect(describeErrorForLog(new Error(""), "sync failed")).toBe(
      "sync failed",
    );
  });
});
