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

  if (isRecord(error)) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

/**
 * 取後端回的錯誤訊息。
 *
 * 本專案強制的錯誤格式是 `{ success: false, error: { code, message } }`
 * （見 CLAUDE.md），所以要找的是 `data.error.message`。這裡原本只看
 * `data.message`，那個欄位在信封格式下永遠不存在，於是每一次登入或抓單
 * 失敗都退回呼叫端的通用字串 —— 伺服器已經說了「帳號已鎖定」，畫面卻
 * 只顯示「登入失敗」。`data.message` 留著給尚未遷移的舊路由。
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isRecord(error)) {
    const response = error.response;
    if (isRecord(response)) {
      const data = response.data;
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
  }

  return getErrorMessage(error, fallback);
}

export function getApiErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error) || !isRecord(error.response)) {
    return undefined;
  }

  return typeof error.response.status === "number"
    ? error.response.status
    : undefined;
}

export function getApiErrorStatusText(error: unknown): string | undefined {
  if (!isRecord(error) || !isRecord(error.response)) {
    return undefined;
  }

  return typeof error.response.statusText === "string"
    ? error.response.statusText
    : undefined;
}
