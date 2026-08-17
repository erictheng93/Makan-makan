import { describe, expect, it } from "vitest";
import {
  ERROR_PRESENTATION_KEYS,
  resolveUserFacingError,
} from "./user-facing-error";
import enUS from "../src/i18n/src/locales/en-US/common.json";
import idID from "../src/i18n/src/locales/id-ID/common.json";
import msMY from "../src/i18n/src/locales/ms-MY/common.json";
import viVN from "../src/i18n/src/locales/vi-VN/common.json";
import zhCN from "../src/i18n/src/locales/zh-CN/common.json";
import zhTW from "../src/i18n/src/locales/zh-TW/common.json";

const translations: Record<string, string> = {
  "errorPresentation.invalidRequest": "請檢查輸入內容後再試一次",
  "errorPresentation.sessionExpired": "登入狀態已失效，請重新登入",
  "errorPresentation.permissionDenied": "你沒有執行此操作的權限",
  "errorPresentation.notFound": "找不到要求的資源",
  "errorPresentation.conflict": "目前狀態不允許此操作，請重新整理後再試",
  "errorPresentation.tooManyRequests": "操作過於頻繁，請稍後再試",
  "errorPresentation.serviceUnavailable": "系統暫時無法處理，請稍後再試",
  "errorPresentation.network": "網路連線發生問題，請檢查後再試",
  "errorPresentation.timeout": "連線逾時，請再試一次",
  "errorPresentation.unknown": "發生未知錯誤，請稍後再試",
  "errors.menuItemUnavailable": "餐點目前無法供應",
};

const translate = (key: string) => translations[key] ?? key;

describe("resolveUserFacingError", () => {
  it("requires every shared fallback key in every supported common catalog", () => {
    const catalogs = [enUS, zhTW, zhCN, msMY, idID, viVN];

    for (const catalog of catalogs) {
      for (const key of ERROR_PRESENTATION_KEYS) {
        const value = key.split(".").reduce<unknown>((current, segment) => {
          if (!current || typeof current !== "object") return undefined;
          return (current as Record<string, unknown>)[segment];
        }, catalog);
        expect(value, key).toEqual(expect.any(String));
      }
    }
  });

  it("uses a translated actionable code and never returns the server message", () => {
    const result = resolveUserFacingError(
      {
        response: {
          status: 409,
          data: {
            success: false,
            error: {
              code: "MENU_ITEM_UNAVAILABLE",
              message: "Menu item 101 is not available",
              requestId: "req-123",
            },
          },
        },
      },
      translate,
      { codeKeys: { MENU_ITEM_UNAVAILABLE: "errors.menuItemUnavailable" } },
    );

    expect(result).toEqual({
      code: "MENU_ITEM_UNAVAILABLE",
      requestId: "req-123",
      message: "餐點目前無法供應",
      presentation: "code",
    });
    expect(result.message).not.toContain("Menu item");
  });

  it("uses a localized HTTP-status fallback for an unknown English server message", () => {
    const result = resolveUserFacingError(
      {
        response: {
          status: 401,
          data: { error: "Invalid username or password" },
        },
      },
      translate,
    );

    expect(result.message).toBe("登入狀態已失效，請重新登入");
    expect(result.presentation).toBe("status");
    expect(result.message).not.toContain("Invalid username");
  });

  it("classifies transport failures without using the thrown English message", () => {
    const result = resolveUserFacingError(
      { code: "ECONNABORTED", message: "timeout of 10000ms exceeded" },
      translate,
    );

    expect(result).toMatchObject({
      code: "ECONNABORTED",
      message: "連線逾時，請再試一次",
      presentation: "network",
    });
  });
});
