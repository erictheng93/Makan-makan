import { describe, expect, it } from "vitest";
import { getApiErrorMessage, getErrorMessage } from "./unknown";

describe("getApiErrorMessage", () => {
  it("maps a unified envelope by code instead of displaying server prose", () => {
    const error = {
      message: "Request failed with status code 401",
      response: {
        status: 401,
        data: {
          success: false,
          error: { code: "ACCOUNT_LOCKED", message: "帳號已鎖定" },
        },
      },
    };

    expect(getApiErrorMessage(error, "登入失敗")).toBe(
      "帳號已被鎖定，請稍後再試或聯繫管理員",
    );
  });

  it("maps legacy server messages by HTTP status instead of displaying them", () => {
    const error = { response: { data: { message: "舊路由訊息" } } };
    expect(getApiErrorMessage(error, "登入失敗")).toBe(
      "發生未知錯誤，請稍後再試",
    );
  });

  it("does not expose error messages or caller fallbacks", () => {
    expect(getApiErrorMessage(new Error("Network Error"), "登入失敗")).toBe(
      "發生未知錯誤，請稍後再試",
    );
    expect(getApiErrorMessage({}, "登入失敗")).toBe("發生未知錯誤，請稍後再試");
  });
});

describe("getErrorMessage", () => {
  it("never presents an Error message", () => {
    expect(
      getErrorMessage(new Error("Internal server detail"), "fallback"),
    ).toBe("發生未知錯誤，請稍後再試");
  });
});
