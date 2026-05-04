# MakanMasak 性能測試

本目錄包含 MakanMasak 平台的性能測試腳本和配置，包括 REST API 和 WebSocket 即時通訊系統的負載測試。

## 📋 測試工具

我們使用 [Artillery](https://www.artillery.io/) 進行性能測試，它提供了：

- WebSocket 支持
- 靈活的負載模式配置
- 詳細的性能指標報告
- 自定義腳本處理器

## 🚀 快速開始

### 1. 安裝依賴

```bash
# 安裝 Artillery
npm install -g artillery@latest

# 或使用 pnpm（在專案根目錄）
pnpm add -D artillery
```

### 2. 啟動服務

確保 API 和 Realtime 服務正在運行：

```bash
# 終端 1: 啟動 API 服務
cd apps/api && pnpm dev

# 終端 2: 啟動 Realtime 服務
cd apps/realtime && pnpm dev
```

### 3. 執行性能測試

#### REST API 負載測試

```bash
# 基本測試
artillery run tests/performance/artillery-api.yml

# 生成 HTML 報告
artillery run tests/performance/artillery-api.yml --output api-report.json
artillery report api-report.json --output api-report.html

# 指定環境變數
API_URL=http://localhost:8787 artillery run tests/performance/artillery-api.yml
```

#### WebSocket 負載測試

```bash
# 基本測試
artillery run tests/performance/artillery-websocket.yml

# 生成 HTML 報告
artillery run tests/performance/artillery-websocket.yml --output ws-report.json
artillery report ws-report.json --output ws-report.html

# 指定環境變數
API_URL=http://localhost:8787 artillery run tests/performance/artillery-websocket.yml
```

## 📊 測試場景

### REST API 測試場景

#### 場景 1: 認證流程測試 (20% 流量)

- 用戶登入
- Token 驗證
- 獲取用戶資訊

#### 場景 2: 菜單管理流程 (25% 流量)

- 查看分類列表
- 查看菜單列表
- 查看菜品詳情
- 搜尋菜品

#### 場景 3: 訂單管理流程 (30% 流量)

- 查看訂單列表
- 創建新訂單
- 更新訂單狀態
- 查看訂單統計

#### 場景 4: 桌台管理流程 (15% 流量)

- 查看桌台列表
- 更新桌台狀態
- 生成 QR 碼

#### 場景 5: 用戶管理流程 (10% 流量)

- 查看用戶列表
- 創建新用戶
- 更新用戶資訊

#### 場景 6: 混合讀取操作 (50% 流量)

- 並發執行多個讀取請求
- 測試高並發讀取性能

#### 場景 7: 分析和報表 (5% 流量)

- 銷售分析
- 菜品分析
- 導出報表

#### 場景 8: 錯誤情境測試 (5% 流量)

- 未授權訪問
- 無效 Token
- 資源不存在
- 驗證錯誤

### WebSocket 測試場景

#### 場景 1: Kitchen WebSocket 連線 (30% 流量)

模擬廚房員工的連線行為：

- 獲取 kitchen token
- 建立 WebSocket 連線
- 訂閱訂單事件
- 定期發送心跳
- 持續連線 30 秒

### 場景 2: Admin WebSocket 連線 (30% 流量)

模擬管理員的連線行為：

- 獲取 admin token
- 建立 WebSocket 連線
- 較短的連線時間
- 較少的心跳頻率

### 場景 3: Customer WebSocket 連線 (40% 流量)

模擬顧客的連線行為：

- 獲取 customer token（需要有效 table ID）
- 建立 WebSocket 連線
- 較長的連線時間（60 秒）
- 定期心跳

### 場景 4: 訊息洪流測試 (10% 流量)

壓力測試場景：

- 快速發送 100 個 ping 訊息
- 測試系統的訊息處理能力

## 🧪 測試階段

性能測試分為 5 個階段：

```
Phase 1: Warm-up (60s)
  - 5 connections/sec
  - 讓系統預熱

Phase 2: Ramp-up (120s)
  - 10 → 50 connections/sec
  - 逐步增加負載

Phase 3: Sustained load (180s)
  - 50 connections/sec
  - 穩定負載運行

Phase 4: Peak load (60s)
  - 100 connections/sec
  - 峰值負載測試

Phase 5: Cool-down (60s)
  - 10 connections/sec
  - 降載觀察
```

## 📈 性能指標

### 關鍵指標

1. **連線成功率**
   - 目標: > 99%
   - 測量: 成功建立 WebSocket 連線的百分比

2. **訊息延遲**
   - P95: < 200ms
   - P99: < 500ms
   - 測量: 從發送 ping 到收到 pong 的時間

3. **並發連線數**
   - 目標: 支援 10,000+ 同時連線
   - 測量: 系統能穩定處理的最大連線數

4. **訊息吞吐量**
   - 目標: 1,000 messages/sec
   - 測量: 每秒處理的訊息數量

### Artillery 輸出指標

```
Summary report @ 12:00:00
--------------------------
Scenarios launched:  5000
Scenarios completed: 4995
Requests completed:  25000

WebSocket connections:
  - ws.connection_success_rate: 99.9%
  - ws.connection_time.min: 45ms
  - ws.connection_time.max: 520ms
  - ws.connection_time.median: 85ms
  - ws.connection_time.p95: 180ms
  - ws.connection_time.p99: 320ms

WebSocket messages:
  - ws.messages_sent: 50000
  - ws.messages_received: 48500
  - ws.response_time.min: 10ms
  - ws.response_time.max: 450ms
  - ws.response_time.median: 50ms
  - ws.response_time.p95: 150ms
  - ws.response_time.p99: 280ms

Custom metrics:
  - tokens.kitchen.success: 1500
  - tokens.admin.success: 1500
  - tokens.customer.success: 2000
  - connections.established: 4995
  - messages.received: 48500
  - messages.sent: 50000
```

## 🔧 自定義配置

### 修改負載模式

編輯 `artillery-websocket.yml` 中的 `phases` 配置：

```yaml
phases:
  - duration: 60 # 持續時間（秒）
    arrivalRate: 10 # 每秒新連線數
    rampTo: 50 # 逐步增加到此數值（可選）
    name: "My Phase" # 階段名稱
```

### 修改性能目標

編輯 `artillery-websocket.yml` 中的 `ensure` 配置：

```yaml
ensure:
  - ws.connection_success_rate:
      min: 99.5 # 最低連線成功率
  - ws.response_time.p95:
      max: 150 # P95 延遲上限（ms）
```

### 添加自定義指標

在 `artillery-processor.js` 中使用 `events.emit()`:

```javascript
events.emit("counter", "my.custom.metric", 1);
events.emit("histogram", "my.response.time", duration);
```

## 📝 測試前準備

### 1. 資料庫種子數據

Customer token 需要有效的 table ID。執行以下 SQL 創建測試數據：

```sql
-- 創建測試餐廳
INSERT INTO restaurants (id, name) VALUES (1, 'Test Restaurant');

-- 創建測試桌號
INSERT INTO tables (id, restaurant_id, table_number, table_name)
VALUES (1, 1, 'T1', 'Test Table 1');

-- 設定環境變數
export TEST_TABLE_ID=1
```

### 2. 調整速率限制

性能測試會產生大量請求，可能觸發速率限制。建議在測試環境中：

```typescript
// 臨時提高速率限制（僅用於測試環境）
const RATE_LIMIT_TEST = {
  windowMs: 60 * 1000, // 1 分鐘
  max: 10000, // 允許 10,000 次請求
};
```

### 3. 監控資源使用

在測試期間監控：

- CPU 使用率
- 記憶體使用
- WebSocket 連線數
- Durable Object 實例數

## 🎯 測試目標與基準

### 基準測試

第一次運行建立基準：

```bash
# 執行基準測試
artillery run artillery-websocket.yml --output baseline.json

# 生成報告
artillery report baseline.json --output baseline-report.html
```

### 優化後對比

優化後重新測試並對比：

```bash
# 執行優化後測試
artillery run artillery-websocket.yml --output optimized.json

# 生成對比報告
artillery report optimized.json --output optimized-report.html
```

### 性能退化檢測

可以使用 Artillery Pro 的性能退化檢測功能：

```bash
# 比較兩次測試結果
artillery compare baseline.json optimized.json
```

## 🐛 常見問題

### Q1: 測試中途失敗

**原因**: 服務崩潰或記憶體不足

**解決方案**:

- 降低 `arrivalRate`
- 縮短測試持續時間
- 增加服務器資源

### Q2: Token 生成失敗

**原因**: API 服務未運行或速率限制

**解決方案**:

```bash
# 檢查 API 服務狀態
curl http://localhost:8787/api/v1/health

# 調整速率限制配置
```

### Q3: WebSocket 連線失敗

**原因**: Realtime 服務未運行或埠被佔用

**解決方案**:

```bash
# 檢查服務狀態
curl http://localhost:8788/health

# 檢查埠佔用
lsof -i :8788
```

### Q4: Customer token 總是失敗

**原因**: 測試數據庫中沒有有效的 table

**解決方案**:

```bash
# 創建測試數據
npx wrangler d1 execute makanmasak-local --local --file=./scripts/seed-realtime-test.sql
```

## 📚 進階測試

### 壓力測試

找出系統極限：

```yaml
phases:
  - duration: 300
    arrivalRate: 1
    rampTo: 500
    name: "Stress test"
```

### 尖峰測試

模擬突發流量：

```yaml
phases:
  - duration: 60
    arrivalRate: 10
    name: "Normal"
  - duration: 30
    arrivalRate: 500
    name: "Spike"
  - duration: 60
    arrivalRate: 10
    name: "Recovery"
```

### 持久性測試

長時間穩定性測試：

```yaml
phases:
  - duration: 3600 # 1 小時
    arrivalRate: 50
    name: "Endurance"
```

## 📊 報告解讀

### 綠色指標（良好）

- 連線成功率 > 99%
- P95 延遲 < 200ms
- 錯誤率 < 1%

### 黃色指標（需關注）

- 連線成功率 95-99%
- P95 延遲 200-500ms
- 錯誤率 1-5%

### 紅色指標（需優化）

- 連線成功率 < 95%
- P95 延遲 > 500ms
- 錯誤率 > 5%

## 🔗 相關資源

- [Artillery 官方文檔](https://www.artillery.io/docs)
- [WebSocket 性能最佳實踐](https://blog.cloudflare.com/introducing-websockets/)
- [Durable Objects 性能指南](https://developers.cloudflare.com/durable-objects/best-practices/performance/)

---

**最後更新**: 2025-11-03
**維護者**: MakanMasak Dev Team
