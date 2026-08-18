/**
 * 收窄 `unknown` 的共用工具。
 *
 * `catch (e)` 與 `await res.json()` 給的都是 `unknown`，把它換成 `any` 只是
 * 把錯誤延到執行期。這裡集中放「讀之前先確認形狀」的判斷，讓各 app 的
 * catch 區塊不必各自重寫一遍。
 *
 * 這裡**沒有**「取得錯誤訊息」的 helper。伺服器的句子是英文的診斷資料，不是
 * 產品文案；要顯示給人看的字串一律走 `resolveUserFacingError`，要寫進 log 的
 * 走 `describeErrorForLog`。曾經有過一版把這些 helper 留著名字、讓它們永遠回
 * 傳 fallback —— 那讓 `getApiEnvelopeMessage`（契約就是「讀信封裡的 message」）
 * 永遠回 `undefined`，下一個呼叫的人不會知道自己拿到的是空的。
 */

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
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

/**
 * 給 log 與遙測用的錯誤描述。**不要**把它放進畫面。
 *
 * 它讀的正是不該顯示的東西：伺服器信封裡的 message、或被 throw 的物件自己的
 * message。那些在 console 裡是最有用的一行，在 toast 裡是一句沒人看得懂的英文。
 * 名字裡的 `ForLog` 是刻意的 —— 讓誤用在 code review 時看得出來。
 */
export function describeErrorForLog(
  error: unknown,
  fallback = "Unknown error",
): string {
  const data =
    isRecord(error) && isRecord(error.response)
      ? error.response.data
      : undefined;
  const envelope =
    isRecord(data) && isRecord(data.error) ? data.error : undefined;

  if (typeof envelope?.message === "string" && envelope.message) {
    return envelope.message;
  }
  if (isRecord(data) && typeof data.message === "string" && data.message) {
    return data.message;
  }
  if (isRecord(error) && typeof error.message === "string" && error.message) {
    return error.message;
  }
  return fallback;
}
