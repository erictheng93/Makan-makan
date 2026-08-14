import { describe, it, expect } from "vitest";
import {
  isRecord,
  getErrorMessage,
  getApiEnvelopeMessage,
  getApiErrorCode,
  getApiErrorMessage,
  getApiErrorStatus,
  getApiErrorStatusText,
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

describe("getErrorMessage", () => {
  it("reads an Error's message", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("reads a plain object's message", () => {
    expect(getErrorMessage({ message: "boom" })).toBe("boom");
  });

  it("falls back when the message is empty, not just when it is absent", () => {
    expect(getErrorMessage(new Error(""), "fallback")).toBe("fallback");
    expect(getErrorMessage({ message: "" }, "fallback")).toBe("fallback");
  });

  it("falls back for values that carry no message at all", () => {
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
    expect(getErrorMessage("a string", "fallback")).toBe("fallback");
    expect(getErrorMessage({ message: 42 }, "fallback")).toBe("fallback");
  });
});

describe("getApiEnvelopeMessage", () => {
  it("reads the unified envelope", () => {
    const error = {
      response: { data: { error: { message: "此優惠券已過期" } } },
    };
    expect(getApiEnvelopeMessage(error)).toBe("此優惠券已過期");
  });

  it("leaves the localized fallback to the caller instead of surfacing axios' English", () => {
    const error = { message: "Network Error", response: { data: {} } };
    expect(getApiEnvelopeMessage(error)).toBeUndefined();
    expect(getApiEnvelopeMessage(error) ?? "連線失敗").toBe("連線失敗");
  });

  it("returns undefined for a body-less error", () => {
    expect(getApiEnvelopeMessage(new Error("boom"))).toBeUndefined();
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

describe("getApiErrorMessage", () => {
  it("reads the unified envelope this API actually returns", () => {
    const error = {
      message: "Request failed with status code 400",
      response: {
        data: {
          success: false,
          error: { code: "EXPIRED", message: "此優惠券已過期" },
        },
      },
    };
    expect(getApiErrorMessage(error, "fallback")).toBe("此優惠券已過期");
  });

  it("still reads the flat shape un-migrated routes return", () => {
    const error = {
      message: "Request failed with status code 400",
      response: { data: { message: "此優惠券已過期" } },
    };
    expect(getApiErrorMessage(error, "fallback")).toBe("此優惠券已過期");
  });

  it("falls back to the error's own message when the body carries none", () => {
    const error = { message: "Network Error", response: { data: {} } };
    expect(getApiErrorMessage(error, "fallback")).toBe("Network Error");
  });

  it("falls back to the supplied string when neither exists", () => {
    expect(getApiErrorMessage({}, "fallback")).toBe("fallback");
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
