export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export function getErrorMessage(
  _error: unknown,
  fallback = "發生未知錯誤",
): string {
  // Error messages can originate from an API, proxy, or browser runtime. They
  // are diagnostic data, not customer-facing copy, so callers must provide
  // their locale-safe fallback explicitly.
  return fallback;
}

/**
 * 取後端回的錯誤訊息。
 *
 * 本專案強制的錯誤格式是 `{ success: false, error: { code, message } }`
 * （見 CLAUDE.md），所以舊版與信封錯誤都可能帶有人類可讀的文字；`data.message` 是
 * 尚未遷移的舊路由才有的形狀。這裡原本只看後者，等於永遠讀不到伺服器
 * 給的原因 —— 目前沒有呼叫點，但留著錯的版本就是替下一個使用者埋雷。
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  // Kept as a compatibility helper for callers that pass Axios-shaped errors.
  // Neither old `{ error: string }` nor current error envelopes are UI copy.
  return getErrorMessage(error, fallback);
}
