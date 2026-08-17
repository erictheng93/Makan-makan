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
 * 只取後端回應主體裡的訊息，取不到就回 `undefined`。
 *
 * 本專案強制的錯誤格式是 `{ success: false, error: { code, message } }`
 * （見 CLAUDE.md），所以先找 `data.error.message`；`data.message` 是尚未
 * 遷移的舊路由才會有的形狀，留著當後備。
 *
 * 刻意不退回 axios 自身的 `message` —— 那是 "Network Error" 這種未在地化
 * 的英文字串，蓋掉呼叫端的 `?? t("...")` 只會讓 UI 更難懂。需要那層退路的
 * 用 {@link getApiErrorMessage}。
 */
export function getApiEnvelopeMessage(error: unknown): string | undefined {
  const data =
    isRecord(error) && isRecord(error.response)
      ? error.response.data
      : undefined;

  if (!isRecord(data)) {
    return undefined;
  }

  const enveloped = isRecord(data.error) ? data.error.message : undefined;
  if (typeof enveloped === "string" && enveloped.length > 0) {
    return enveloped;
  }
  if (typeof data.message === "string" && data.message.length > 0) {
    return data.message;
  }
  return undefined;
}

/**
 * 從**回應主體**取錯誤訊息，不管它是哪一種形狀。
 *
 * 上面幾個 helper 吃的是 axios 風格的錯誤（`error.response.data`），但用
 * `fetch` 的呼叫端手上只有 `await res.json()` 的結果。而 API 目前同時存在
 * 兩種錯誤形狀 —— CLAUDE.md 強制的 `error: { code, message }`，以及尚未
 * 遷移的 `error: "文字"`（2026-08 實測 85 處）。
 *
 * 讀取端要能同時吃這兩種，否則遷移那 85 處的那一刻，只讀字串的呼叫端會把
 * 物件丟進字串位置，畫面出現 `[object Object]`。
 */
export function getResponseErrorMessage(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  // 信封形狀優先：它是本專案的目標格式。
  if (isRecord(body.error)) {
    const message = body.error.message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  // 尚未遷移的裸字串。
  if (typeof body.error === "string" && body.error.length > 0) {
    return body.error;
  }

  // 有些舊路由把失敗文字放在 `message`（見 /auth/forgot-password）。
  if (typeof body.message === "string" && body.message.length > 0) {
    return body.message;
  }

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
 * axios 風格的錯誤優先取後端回的訊息，取不到再退回該錯誤自身的訊息，
 * 最後才是 fallback。
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
