# 出單與列印流程

> **對應 master board**：現場作業 → 出單與列印流程
> **主要角色**：收銀（role 4）、店主（role 1）；列印代理是店內常駐服務
> **最後對照原始碼**：2026-08-21

## 1. 定位

master board 上這條線畫的是「訂單事件 → WebSocket → 列印代理 → ESC/POS 出單」。
**那是設計意圖，不是目前的實作。** 這份文件先說明兩端各自做了什麼，再說明中間缺哪一段。

## 2. 雲端這一端做了什麼

| 動作 | 端點 | 實際行為 |
| --- | --- | --- |
| 列印收據 | `POST /api/v1/pos/receipts/print` | 產生收據內容 → 寫入 `receipts`（`print_status = pending`）→ **立刻**呼叫 `markPrinted` 改成 `printed` |
| 重印 | `POST /pos/receipts/:receiptId/reprint` | `reprinted_count + 1`，同樣立刻標成 `printed` |
| 取消 | `POST /pos/receipts/:receiptId/cancel` | 標記取消 |
| 查詢 | `GET /pos/receipts/:receiptId`、`GET /pos/registers/:registerId/receipts` | 讀 `receipts` |
| 訂單收據 | `GET /api/v1/orders/:id/receipt` | 產生收據資料（計 `print.jobs` 配額） |

閘門：`moduleGate("receipt_printing")` + `quotaGate("print.jobs")` + `requireRole([0, 1, 4])`，
並要求 `X-Register-Id` 標頭。

> **`print_status = printed` 不代表有紙印出來。** 它只代表「這筆收據資料寫成功了」。
> 整條路徑上沒有任何地方接觸實體印表機。

## 3. 店內這一端做了什麼

`apps/print-agent` 是一個本機常駐的 Node 服務：

| 面向 | 內容 |
| --- | --- |
| HTTP | `:3003`，`/api/v1/print`、`/print/:jobId`、`/devices`、`/devices/:id/test`、`/discover`、`/health`、`/statistics` |
| WebSocket | `:3004`，**它是伺服器**，等別人連進來；連線需帶 `x-api-key` |
| 驅動 | `packages/queue-core` 的 `PrinterService` / `PrintJobManager`，USB 與網路印表機、ESC/POS |
| 探索 | 可自動掃描 USB／網路印表機 |

## 4. 中間缺的那一段

| 缺口 | 證據 |
| --- | --- |
| 雲端沒有推播給列印代理 | 列印代理只當 WS **伺服器**，不會主動連上雲端 |
| 列印代理不會向雲端註冊或送心跳 | `LocalPrintService.ts:848`、`:853` 兩個 `// TODO: 實作雲端心跳／註冊` |
| 雲端沒有列印 API | `app-factory.ts:750`：`// apiV1.route('/print', printApp) // Disabled - incomplete feature` |
| 沒有任何前端連 `:3003` / `:3004` | 全 repo 只有 `apps/api/src/middleware/cors.ts` 的開發埠清單提到這兩個埠 |

也就是說：**目前唯一能讓紙吐出來的方法，是有人自己去打 `http://localhost:3003/api/v1/print`。**
收銀台按下「列印」時，雲端只是寫了一筆 `receipts`。

## 5. Edge cases 與失敗模式

| 情境 | 系統行為 | 風險 |
| --- | --- | --- |
| 收據寫入 DB 失敗 | `markPrinted` 的 catch 會改標 `print_status = failed`；再失敗就只留 log | 🟡 P2 |
| 收銀員以為印好了 | `printed` 是寫入成功的意思，畫面看不出實體印表機狀態 | 🟠 P1 |
| 未購買 `receipt_printing` | 收據端點被擋，POS 其餘功能正常 | 🟡 P2 |
| `print.jobs` 配額耗盡 | 429；但 `QUOTA_ENFORCEMENT_MODE` 預設 `disabled` 時不擋 | 🟡 P2 |
| 沒帶 `X-Register-Id` | 400「需要指定收銀機ID」 | ⚪ P3 |
| 列印代理設定錯誤 | 啟動時 `validateConfig` 失敗即 `process.exit(1)` | 🟡 P2 |
| WS 連線沒帶正確 `x-api-key` | `verifyWebSocketClient` 拒絕連線 | 🟠 P1 |
| 印表機離線 | 列印代理內部有重試（`maxRetries` 3、`retryDelay` 5s）與健康檢查，但**雲端看不到** | 🟠 P1 |

## 6. 對應程式碼與測試

**程式碼**

- `apps/api/src/features/pos/routes/receipts.ts` — 收據端點與閘門
- `apps/api/src/features/pos/services/ReceiptService.ts:59`、`:338` — 寫入與 `markPrinted`
- `apps/print-agent/src/LocalPrintService.ts` — HTTP/WS 伺服器、裝置管理
- `apps/print-agent/src/services/PrintAgentService.ts` — 包裝 `queue-core` 的印表機服務
- `packages/queue-core/src/print/` — 驅動、工作佇列、健康監控

**測試**

- `apps/api/src/features/pos/services/ReceiptService.test.ts`
- `apps/print-agent/src/LocalPrintService.test.ts`、`services/PrintAgentService.test.ts`

## 7. 已知缺口

這一節就是本文件的重點：

1. **雲端與列印代理之間沒有連線。** 要嘛列印代理主動連上雲端（它已經有 `cloudEndpoint` 設定與兩個 TODO），
   要嘛雲端重新啟用 `/api/v1/print` 由店內輪詢。目前兩條都沒有做完。
2. **`print_status` 是假的成功訊號。** 在真的接上印表機之前，不應該讓 UI 顯示「已列印」。
3. **廚房出單票（kitchen ticket）完全沒有實作。** `receipt_type` 有 `kitchen` 這個值，
   但沒有任何流程會在訂單確認時自動產生廚房票。
4. **列印代理的健康狀態沒有回報到雲端**，所以後台看不到「這家店的印表機掛了」。
