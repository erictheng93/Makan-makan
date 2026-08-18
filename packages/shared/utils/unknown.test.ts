import { describe, it, expect } from "vitest";
import {
  isRecord,
  getErrorMessage,
  getApiEnvelopeMessage,
  getResponseErrorMessage,
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
  it("never exposes an Error or plain-object message", () => {
    expect(getErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
    expect(getErrorMessage({ message: "boom" }, "fallback")).toBe("fallback");
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
  it("never exposes a unified envelope message", () => {
    const error = {
      response: { data: { error: { message: "此優惠券已過期" } } },
    };
    expect(getApiEnvelopeMessage(error)).toBeUndefined();
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
  it("falls back instead of reading a unified envelope message", () => {
    const error = {
      message: "Request failed with status code 400",
      response: {
        data: {
          success: false,
          error: { code: "EXPIRED", message: "此優惠券已過期" },
        },
      },
    };
    expect(getApiErrorMessage(error, "fallback")).toBe("fallback");
  });

  it("falls back instead of reading a flat error shape", () => {
    const error = {
      message: "Request failed with status code 400",
      response: { data: { message: "此優惠券已過期" } },
    };
    expect(getApiErrorMessage(error, "fallback")).toBe("fallback");
  });

  it("does not fall back to the error's own message", () => {
    const error = { message: "Network Error", response: { data: {} } };
    expect(getApiErrorMessage(error, "fallback")).toBe("fallback");
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

describe("getResponseErrorMessage", () => {
  it("never exposes an enveloped response message", () => {
    expect(
      getResponseErrorMessage({
        success: false,
        error: { code: "SHOP_MODE_DISABLED", message: "店家未開放掃碼點餐" },
      }),
    ).toBeUndefined();
  });

  /**
   * 85 個端點還在回這個形狀（2026-08 實測）。只讀信封的呼叫端會漏掉它們，
   * 只讀字串的呼叫端會在遷移那天把物件塞進字串位置。兩種都要吃。
   */
  it("never exposes a not-yet-migrated bare string error", () => {
    expect(
      getResponseErrorMessage({
        success: false,
        error: "Insufficient permissions",
      }),
    ).toBeUndefined();
  });

  it("never exposes a flat response message", () => {
    expect(
      getResponseErrorMessage({
        success: false,
        message: "Reset link expired",
      }),
    ).toBeUndefined();
  });

  it("does not select between server message fields", () => {
    expect(
      getResponseErrorMessage({
        success: false,
        error: { code: "X", message: "from envelope" },
        message: "from sibling",
      }),
    ).toBeUndefined();
  });

  it("returns undefined for every response body", () => {
    expect(
      getResponseErrorMessage({ error: { code: "X" }, message: "fallback" }),
    ).toBeUndefined();
    expect(
      getResponseErrorMessage({ error: { message: "" }, message: "fallback" }),
    ).toBeUndefined();
  });

  it("returns undefined when there is nothing to show, so callers keep their own copy", () => {
    expect(getResponseErrorMessage({ success: false })).toBeUndefined();
    expect(getResponseErrorMessage({ error: "" })).toBeUndefined();
    expect(getResponseErrorMessage(undefined)).toBeUndefined();
    expect(getResponseErrorMessage("not an object")).toBeUndefined();
  });
});
