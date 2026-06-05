# 資料庫遷移觸發告警規格（夜市/商圈版本）

**版本**: 1.0  
**日期**: 2026-06-05  
**目的**: 為「D1 是否需要切換到更高階架構」提供可操作、可量化的告警與決策門檻。

## 1. 適用範圍

本規格僅針對：

- 夜市商圈/發掘（Discovery）讀流量快速增長
- 商家點餐、服務預約、結帳、排隊/訂單等交易寫入
- 單一 D1 主 DB (`DB`) 的現況

目標決策：

1) **先行方案**：先將公開目錄查詢切到獨立 `CATALOG_DB`（仍是 D1）  
2) **下一階段**：當交易寫入持續受限，才評估 PostgreSQL + Cloudflare Hyperdrive

---

## 2. 指標來源（資料合併窗口）

所有告警都以「時間窗 + 持續窗口」為條件，避免尖峰誤判。

- **Window A**: 5 分鐘，作為短期壓力偵測
- **Window B**: 30 分鐘，作為趨勢確認
- **Window C**: 2 小時，作為遷移執行級別最終確認

### 2.1 指標清單

### 2.1.1 D1 層（Cloudflare 監控來源）

1. `d1_read_requests`：每分鐘 read 請求數  
2. `d1_write_requests`：每分鐘 write 請求數  
3. `d1_query_cpu_ms`：每分鐘累計 DB CPU time（ms）  
4. `d1_overloaded_errors`：5 分鐘內 D1 overload / throttling / `SQLITE_BUSY` / `database unavailable` 類型錯誤數
5. `d1_avg_query_ms`：5 分鐘內平均查詢耗時（ms）

### 2.1.2 API / 產品層

1. `discovery_qps`：`/api/v1/discovery/*`、`/api/v1/markets/*`、公開目錄查詢每分鐘 qps  
2. `discovery_p95_ms` / `discovery_p99_ms`  
3. `tx_p95_ms` / `tx_p99_ms`：交易路由的 p95/p99（`orders`, `checkout`, `reservation`, `queue`, `payments`）  
4. `db_error_rate`：標註為 DB 相關的 5xx 比例  
5. `catalog_index_stale_ratio`：`search index` 缺頁面/可見性差異比例（例如 `missing items` / `total visible`）  
6. `cache_hit_ratio`：Discovery 相關 KV 緩存命中率  

---

## 3. 告警層級

### 3.1 Level 1（預警，準備啟動）

以下條件任一在 Window A 連續 3 次成立：

- `discovery_p95_ms > 500` 且 `discovery_qps > 120`
- `d1_overloaded_errors > 0` 且 `d1_write_requests` 非0  
- `cache_hit_ratio < 55%`

**動作**：  
啟動容量觀察儀表板，拉日誌核對是新用戶行為異常還是功能性 regressions，不能直接遷移。

### 3.2 Level 2（警戒，啟動遷移準備）

以下任一條件在 Window B 連續 2 次成立：

- `discovery_p95_ms > 800` 且 `discovery_qps > 300`  
- `d1_overloaded_errors / (d1_read_requests + d1_write_requests) > 0.20%`  
- `d1_avg_query_ms > 120` 且 `d1_query_cpu_ms / d1_read_requests > 7ms`  
- `catalog_index_stale_ratio > 8%` 且趨勢 24h 上升（相較昨日同時段 +20%）

**動作**：
- 指定遷移負責人，完成 `CATALOG_DB` 前置工件清單（見 4.1），預估維護窗口，做讀量回歸測試。

### 3.3 Level 3（阻塞，執行遷移）

以下條件任一在 Window C 連續成立 2 次：

- `discovery_p95_ms > 1,000` 且 `db_error_rate > 0.5%`
- `d1_overloaded_errors / (d1_read_requests + d1_write_requests) > 0.5%`
- `tx_p99_ms > 1,500` 且 `d1_avg_query_ms > 200`
- `d1_write_requests > 900/min` 且 `d1_read_requests > 1800/min` 且 `d1_overloaded_errors > 0.5%`

**動作**：
- 立即啟用遷移 Runbook（優先級 P1），並在監控頁公開遷移進度。  
- 未完成切流前不做低風險外緣功能變更。

---

## 4. 遷移決策規則

### 4.1 判定 `CATALOG_DB`（仍維持 D1）切換時點

當滿足以下全條件時，**建議執行**：

1. 連續 4 小時 Level 3（讀取類）警報存在  
2. 其中至少 2/3 指標涉及「讀取路徑」：  
   - `discovery_p95_ms`  
   - `d1_read_requests`  
   - `discovery_qps`

**執行目標**：

- 將目錄/搜索入口查詢獨立到 `CATALOG_DB`  
- 保持主交易 DB 不變  
- 先完成雙 DB 同步（後寫一致）、再進行逐步 cut-over

### 4.2 判定 PostgreSQL + Hyperdrive 時點

僅在 **`CATALOG_DB` 成功切入且仍有 Level 3 交易類壓力** 時觸發：

1. `tx_p99_ms` 連續 Window C > **1800ms**  
2. `d1_overloaded_errors` 連續 Window C > **1.0%（相對 write 請求）**  
3. `write` 相關 API 的 `db_error_rate > 0.5%`  
4. 24h 內交易尖峰無法藉由快取、批次化或索引優化回到 Level 2

**執行目標**：

- 以 Postgres 作為交易主庫，D1 停留於快取/輕量層（或特定低風險模組）
- 透過 Hyperdrive 管理連線池與高並發讀寫，降低 D1 單寫瓶頸

> 不滿足 4.2.4 時，先不啟動 PG，先做 schema/index/快取/讀寫分流優化。

---

## 5. 告警與回應責任（RACI）

| 任務 | 責任人 | 協力 | 目標時間 |
| --- | --- | --- | --- |
| 觸發 Level 1 | Platform owner | SRE | 立即 |
| 觸發 Level 2 | Platform owner | API owner + DBA | 15 分鐘內核對 |
| 觸發 Level 3 | DBA owner | 平台+產品 owner | 30 分鐘內決策 |
| 啟動 `CATALOG_DB` Runbook | DBA owner | 平台 + 後端 | 4 小時內完成前置 |
| 啟動 PG+Hyperdrive 決策會 | CTO/Tech lead | 平台 + App owner | 24 小時內 |

---

## 6. 驗收條件（遷移執行後）

### `CATALOG_DB` 成功切換

- `discovery_p95_ms` 下降至少 25%（比較切換前 24h 均值）  
- `d1_overloaded_errors` 降低至少 70%（同口徑）  
- 新舊查詢結果一致率 >= 99.8%（抽樣）  

### PG+Hyperdrive 上線

- 交易 `tx_p99_ms` 持續 7 天低於 1200ms  
- 交易路徑 `db_error_rate` 降低至少 50%  
- 無資料不同步導致的客訴或訂單不一致回退事件

---

## 7. 例外與降級

- 若 Level 3 為短暫尖峰且 `d1_overloaded_errors` 在 30 分鐘內歸零，允許降級為 Level 2 並人工註記 `no-migrate spike`。  
- 假日檔期可暫調觸發門檻 +10%，但需在事故記錄中註明並在活動後恢復。

---

## 8. 依賴文件

- `docs/night-market-scaling-execution.md`（分層遷移路徑）
- `apps/api/src/features/discovery/services/DiscoveryService.ts`（public read 寫法集中點）
- `docs/runbooks/orderstatus-migration-deploy.md`（遷移事件溝通格式可借用）
