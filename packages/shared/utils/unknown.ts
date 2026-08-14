/**
 * 收窄 `unknown` 的共用工具。
 *
 * `catch (e)` 與 `await res.json()` 給的都是 `unknown`，把它換成 `any` 只是
 * 把錯誤延到執行期。這裡集中放「讀之前先確認形狀」的判斷，讓各 app 的
 * catch 區塊不必各自重寫一遍。
 */

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

/**
 * 取一個被 throw 的值的訊息。空字串視同沒有訊息，改用 fallback —— 顯示
 * 一則空的錯誤提示比顯示通用訊息更難懂。
 */
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
 * axios 風格的錯誤優先取後端回的訊息，取不到再退回該錯誤自身的訊息。
 *
 * 本專案強制的錯誤格式是 `{ success: false, error: { code, message } }`
 * （見 CLAUDE.md），所以先找 `data.error.message`；`data.message` 是尚未
 * 遷移的舊路由才會有的形狀，留著當後備。
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const data =
    isRecord(error) && isRecord(error.response)
      ? error.response.data
      : undefined;

  if (isRecord(data)) {
    const enveloped = isRecord(data.error) ? data.error.message : undefined;
    if (typeof enveloped === "string" && enveloped.length > 0) {
      return enveloped;
    }
    if (typeof data.message === "string" && data.message.length > 0) {
      return data.message;
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
