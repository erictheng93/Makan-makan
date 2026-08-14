export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export function getErrorMessage(
  error: unknown,
  fallback = "發生未知錯誤",
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

/**
 * 取後端回的錯誤訊息。
 *
 * 本專案強制的錯誤格式是 `{ success: false, error: { code, message } }`
 * （見 CLAUDE.md），所以要找的是 `data.error.message`；`data.message` 是
 * 尚未遷移的舊路由才有的形狀。這裡原本只看後者，等於永遠讀不到伺服器
 * 給的原因 —— 目前沒有呼叫點，但留著錯的版本就是替下一個使用者埋雷。
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isRecord(error) && isRecord(error.response)) {
    const data = error.response.data;
    if (isRecord(data)) {
      const enveloped = isRecord(data.error) ? data.error.message : undefined;
      if (typeof enveloped === "string" && enveloped.length > 0) {
        return enveloped;
      }
      if (typeof data.message === "string" && data.message.length > 0) {
        return data.message;
      }
    }
  }

  return getErrorMessage(error, fallback);
}
