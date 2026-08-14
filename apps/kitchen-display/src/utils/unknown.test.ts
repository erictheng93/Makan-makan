import { describe, it, expect } from "vitest";
import { getApiErrorMessage, getErrorMessage } from "./unknown";

describe("getApiErrorMessage", () => {
  // 這是後端唯一會送的錯誤形狀（CLAUDE.md 強制），而 kitchen 的登入 /
  // 抓單路徑全部走這支。讀錯層級的話伺服器說什麼都不會顯示。
  it("reads the unified envelope the API actually returns", () => {
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

    expect(getApiErrorMessage(error, "登入失敗")).toBe("帳號已鎖定");
  });

  it("still reads the flat shape un-migrated routes return", () => {
    const error = { response: { data: { message: "舊路由訊息" } } };
    expect(getApiErrorMessage(error, "登入失敗")).toBe("舊路由訊息");
  });

  it("falls back to the error's own message, then to the caller's string", () => {
    expect(getApiErrorMessage(new Error("Network Error"), "登入失敗")).toBe(
      "Network Error",
    );
    expect(getApiErrorMessage({}, "登入失敗")).toBe("登入失敗");
  });
});

describe("getErrorMessage", () => {
  it("treats an empty message as absent", () => {
    expect(getErrorMessage(new Error(""), "fallback")).toBe("fallback");
    expect(getErrorMessage({ message: "" }, "fallback")).toBe("fallback");
  });
});
