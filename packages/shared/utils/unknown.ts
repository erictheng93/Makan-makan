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
