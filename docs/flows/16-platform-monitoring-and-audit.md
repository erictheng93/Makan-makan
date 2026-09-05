# 監控與稽核

> **對應 master board**：平台管理 → 監控與稽核
> **主要角色**：平台管理者（role 0）、店主（部分）
> **最後對照原始碼**：2026-08-21

## 1. 定位

系統活著嗎、相依健康嗎、誰動了什麼、資料救不救得回來。四塊：健康檢查、監控指標、稽核日誌、備份還原。

## 2. 健康端點不可互換

| 端點 | 會不會碰相依？ | 用途 |
| --- | --- | --- |
| `GET /info` | **不會**，只回靜態中繼資料 | 「Worker 活著嗎」——冒煙測試、LB liveness，最便宜 |
| `GET /api/v1/monitoring/health` | 會：D1 `SELECT 1` + KV **讀取**，另加 Analytics Engine 的延遲與錯誤率 | 「相依健康嗎」——儀表板、告警、頻繁輪詢 |
| `GET /api/v1/system/health` | 會：同樣的 D1 探針 + 同一支唯讀 KV 探針 | 兩支都可以輪詢。這支另外會回報 D1 讀取的 `servedByPrimary`／`servedByRegion` |
| `GET /api/v1/system/health?deep=1` | 會：D1，加上 KV put + get +（背景）delete，再加一筆 uptime evidence 寫入 | 驗證 KV **寫入**路徑。**需要 bearer token**——公開豁免是比對路徑的，刻意不涵蓋這個 |

### KV 寫入約是 KV 讀取的 4 倍、D1 探針的 4.5 倍——公開路徑上一筆都不要放

2026-09-05 對 production 實測（Worker 已回到 APAC，#322 修後）：
D1 `SELECT 1` 約 95ms、KV 讀取約 210ms、每一筆 KV 寫入約 420ms。

公開的 `/api/v1/system/health` 過去每次匿名呼叫要花掉**三筆寫入等級的往返**
（探針的 put + get + delete，再加 uptime evidence 的 put），端點自報 900–1500ms。
現在是「一次 KV 讀取」與 D1 探針**並行**，寫入路徑移到需要認證的 `?deep=1`（#324）。

### 每支探針各自計時

`runBasicHealthCheck` 原本兩支檢查都回報 `Date.now() - startTime`，
而那個 `startTime` 在 D1 查詢**之前**就起算了——D1 花掉的時間會在 KV 的數字裡**再被算一次**。
#324 量到的「KV 是 D1 的三倍」就是這麼來的：它記錄的 KV 356–421ms 裡，
有 115–169ms 其實是 D1 探針被重複計入。現在兩支探針並行且各自計時，
KV 檢查另外帶一個 `probe: "read" | "read-write"` 欄位，讓延遲數字能對上產生它的工作量。

`GET /health` 會轉址到 `/api/v1/monitoring/health`，而且那個回應是裸的
`{ overall, components }`，**不是**統一的 `{ success, data }` 信封。

`/api/v1/system/health/ready` 與 `/live` 是 kubernetes 式探針，**需要 bearer token**。
沒有未認證的 `/api/v1/health` 路由——舊 router 已被 System／Monitoring 兩個 feature 取代。

### 健康要從探針來，不是從計數器來

`MonitoringService` 保有 per-isolate 的行程內計數器。只看計數器的話，
一個沒服務過任何流量的 isolate 會在 D1 掛掉時回報「完全健康」。
所以 `getHealthStatus()` **兩個訊號都用**：探針失敗 → `critical`；探針成功 → 落回計數器推導的狀態，
讓「連得上但很慢」仍能顯示 `warning`。動這段時兩個訊號都要留著。

探針結果快取 **10 秒**（`HEALTH_PROBE_TTL_MS`），所以十個開著的儀表板共用一次探測。

## 3. 監控指標與告警

| 動作 | 端點 |
| --- | --- |
| 指標讀取／清除 | `GET /api/v1/monitoring/metrics`、`DELETE /monitoring/metrics` |
| 回報錯誤 | `POST /monitoring/errors` |
| 告警規則 CRUD | `GET/POST/PUT/DELETE /monitoring/alerts/rules[/:id]` |
| 近期告警／預設值／測試 | `GET /monitoring/alerts/recent`、`/alerts/defaults`、`POST /alerts/test` |
| 總覽與效能報表 | `GET /monitoring/overview`、`/reports/performance` |

門檻常數寫在 `PERFORMANCE_THRESHOLDS`：API 回應 500ms 警告／1000ms 危險、
DB 查詢 100ms／500ms、錯誤率 5%／10%、快取命中率 60%／30%。
這組數字與 CLAUDE.md 的效能目標（P99 < 300ms、P95 < 100ms）是兩套標準，**不要混用**。

系統側另有 `POST /api/v1/system/error-report`、`/errors`、`/performance`、
`GET /system/error-stats`、`DELETE /system/error-reports/cleanup`。錯誤會自動送 Slack。

## 4. 稽核日誌

| 動作 | 端點 | 角色 |
| --- | --- | --- |
| 前端回報操作 | `POST /api/v1/audit/actions` | 已登入；寫入前檢查 `canWriteRestaurantScope` |
| 查詢稽核日誌 | `GET /api/v1/audit-logs` | **僅 role 0** |
| 管理者動作 | `POST /api/v1/manager/...` | role 0/1 |

`POST /audit/actions` 的 `restaurant_id` 若沒帶會退回 `user.restaurantId`，而且會擋掉跨店寫入——
不能替別家店寫稽核紀錄。

## 5. 備份與還原

| 動作 | 端點 |
| --- | --- |
| 建立／上傳 | `POST /api/v1/backup/create`、`/upload` |
| 列表／明細／下載 | `GET /backup/list`、`/:id`、`/:id/download` |
| 還原 | `POST /backup/:id/restore` |
| 刪除 | `DELETE /backup/:id` |
| 設定 | `GET /backup/configurations/:restaurant_id`、`POST /backup/configurations` |
| 健康與指標 | `GET /backup/system/health`、`/restaurants/:restaurant_id/metrics` |
| 告警 | `GET /backup/alerts/:restaurant_id`、`PATCH /alerts/:id/acknowledge`、`/resolve` |

排程備份由獨立的 `apps/backup-scheduler`（Cron Worker）觸發，匯出到 R2。

## 6. Edge cases 與失敗模式

| 情境 | 系統行為 | 風險 |
| --- | --- | --- |
| 拿 `/info` 當相依健康檢查 | 永遠 200——D1 掛了也一樣 | 🔴 P0 |
| 用 `/api/v1/system/health?deep=1` 做高頻輪詢 | 每次兩筆 KV 寫入，成本與配額都在燒；需要 token，匿名者打不到 | 🟠 P1 |
| 期待 `/health` 回統一信封 | 它回裸 payload，解析會壞 | 🟡 P2 |
| 未帶 token 打 `/health/ready`、`/live` | 401 | 🟡 P2 |
| isolate 沒流量 | 計數器全 0，但探針仍會如實回報相依狀態 | 🔴 P0（已防） |
| 10 秒內重複查健康 | 回快取結果，不重打探針 | — |
| 非 role 0 查稽核日誌 | 403 | 🔴 P0 |
| 替別家店寫稽核 | 被 `canWriteRestaurantScope` 擋下 | 🟠 P1 |
| Analytics Engine 未綁定 | 延遲／錯誤率欄位缺值，其餘健康資訊照常 | 🟡 P2 |

## 7. 對應程式碼與測試

**程式碼**

- `apps/api/src/features/monitoring/services/MonitoringService.ts:360` — `getHealthStatus`、探針快取、門檻
- `apps/api/src/features/monitoring/routes/index.ts`
- `apps/api/src/features/system/routes/index.ts` — 深度健檢與錯誤回報
- `apps/api/src/features/audit/routes/index.ts`、`manager/routes/audit-logs.ts`
- `apps/api/src/features/backup/routes/index.ts`
- `apps/backup-scheduler/` — 排程備份

**測試**

- `apps/api/src/features/audit/routes/index.test.ts`
- `apps/api/src/features/backup/routes/index.test.ts`
- `apps/admin-dashboard/src/views/MonitoringView.test.ts`

**相關文件**

- [runbooks/backup-restore-runbook.md](../runbooks/backup-restore-runbook.md)
- [runbooks/incident-triage-runbook.md](../runbooks/incident-triage-runbook.md)
- [runbooks/rollback-runbook.md](../runbooks/rollback-runbook.md)

## 8. 已知缺口

- **業務層面的稽核鏈很薄**。訂單狀態變更沒有逐筆紀錄（見 [02](./02-customer-order-tracking.md) §9），
  請假餘額調整只留最後一次（見 [07](./07-merchant-workforce.md) §8）。
  `audit_logs` 主要靠前端主動回報，不是後端強制寫入。
- **監控門檻與效能目標是兩套數字**，沒有對齊。
- **備份還原沒有定期演練紀錄**，還原路徑只在 runbook 裡描述。
