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
 * 回傳呼叫端提供的在地化 fallback。被 throw 的原始訊息可能來自 API、proxy
 * 或瀏覽器執行期，僅能用於診斷，不能作為使用者介面文案。
 */
export function getErrorMessage(
  _error: unknown,
  fallback = "發生未知錯誤",
): string {
  // Error prose is diagnostic data from an untrusted boundary. Callers own
  // presentation through their current-locale fallback or the shared resolver.
  return fallback;
}

/**
 * 舊 API 信封 helper，保留相容性但不再回傳後端文字。介面層必須以
 * `resolveUserFacingError` 或在地化 fallback 產生文案。
 */
export function getApiEnvelopeMessage(error: unknown): string | undefined {
  void error;
  return undefined;
}

/**
 * 舊 fetch 回應 helper，保留相容性但不再回傳 API 文字。使用者介面應以目前
 * 語系的 fallback 或共用 error resolver 顯示錯誤。
 */
export function getResponseErrorMessage(body: unknown): string | undefined {
  void body;
  return undefined;
}

/**
 * 取統一錯誤信封裡機器可讀的 `code`，用來分支到專屬的復原 UI
 * （例如 MENU_ITEM_MODIFIED 的重載/合併流程）。
 */
export function getApiErrorCode(error: unknown): string | undefined {
  const data =
    isRecord(error) && isRecord(error.response)
      ? error.response.data
      : undefined;
  const envelope =
    isRecord(data) && isRecord(data.error) ? data.error : undefined;
  return typeof envelope?.code === "string" ? envelope.code : undefined;
}

/**
 * Axios 相容 helper；一律回傳呼叫端提供的在地化 fallback。
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  return getApiEnvelopeMessage(error) ?? getErrorMessage(error, fallback);
}

/**
 * axios 把狀態碼放在 `response.status`，但被 throw 的不一定是 axios error
 * —— WebSocket / fetch 包裝過的錯誤是把 `status` 掛在自己身上。兩處都看。
 */
export function getApiErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  if (isRecord(error.response) && typeof error.response.status === "number") {
    return error.response.status;
  }

  return typeof error.status === "number" ? error.status : undefined;
}

export function getApiErrorStatusText(error: unknown): string | undefined {
  if (!isRecord(error) || !isRecord(error.response)) {
    return undefined;
  }

  return typeof error.response.statusText === "string"
    ? error.response.statusText
    : undefined;
}
