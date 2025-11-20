# Realtime Services - Performance Testing 執行計劃

**創建日期**: 2025-11-15
**狀態**: 準備階段
**目標**: 建立 Realtime Services 的性能基準並識別優化機會

---

## 📋 驗證結果摘要

### ✅ 環境驗證完成

```
工具檢查:
├─ pnpm 10.18.1          ✅ 已安裝
├─ wrangler 4.42.1       ✅ 已安裝
├─ Artillery 2.0.26      ✅ 已安裝
└─ Node.js v22.18.0      ✅ 已安裝

服務檢查:
├─ apps/api              ✅ dev 腳本可用 (wrangler dev)
└─ apps/realtime         ✅ dev 腳本可用 (wrangler dev)

測試基礎設施:
├─ artillery-websocket.yml      ✅ WebSocket 測試配置
├─ artillery-api.yml            ✅ API 測試配置
├─ artillery-processor.js       ✅ 自定義處理器
└─ README.md                    ✅ 完整文檔
```

### ⚠️ 發現的問題

從 `baseline.json` 分析：
- **19,500 測試全部失敗**
- **37,488 個 404 錯誤**
- **1,512 個連線被拒絕錯誤**

**根本原因**: 測試時服務未運行或測試數據不存在

---

## 🎯 測試目標

### 1. 性能基準建立

建立 Realtime Services 的性能基準指標：

```
目標指標:
├─ WebSocket 連線成功率  目標: > 99%
├─ 訊息延遲 P95          目標: < 200ms
├─ 訊息延遲 P99          目標: < 500ms
├─ 並發連線數            目標: 10,000+
└─ 訊息吞吐量            目標: 1,000 msg/sec
```

### 2. 負載測試場景

```
場景分布:
├─ Kitchen WebSocket     30% 流量
├─ Admin WebSocket       30% 流量
├─ Customer WebSocket    40% 流量
└─ Message Flood Test    壓力測試
```

### 3. 測試階段

```
Phase 1: Warm-up     (60s,  5 conn/s)    系統預熱
Phase 2: Ramp-up     (120s, 10→50 conn/s) 逐步增載
Phase 3: Sustained   (180s, 50 conn/s)    穩定負載
Phase 4: Peak        (60s,  100 conn/s)   峰值測試
Phase 5: Cool-down   (60s,  10 conn/s)    降載觀察

總測試時間: 480 秒 (8 分鐘)
```

---

## 📝 執行步驟

### 步驟 1: 準備測試數據

創建 `tests/performance/seed-realtime-test.sql`:

```sql
-- 清理舊數據
DELETE FROM tables WHERE id BETWEEN 1 AND 10;
DELETE FROM restaurants WHERE id = 1;

-- 創建測試餐廳
INSERT INTO restaurants (
  id, name, type, category, description,
  address, district, city, state, zip_code,
  country, phone, email, website, logo_url,
  is_active, created_at, updated_at
) VALUES (
  1,
  'Performance Test Restaurant',
  'restaurant',
  'asian',
  'Restaurant for performance testing',
  '123 Test St',
  'Test District',
  'Test City',
  'Test State',
  '12345',
  'Taiwan',
  '+886-2-1234-5678',
  'test@makanmakan.com',
  'https://makanmakan.com',
  'https://example.com/logo.png',
  1,
  datetime('now'),
  datetime('now')
);

-- 創建測試桌號 (ID 1-10)
INSERT INTO tables (
  id, restaurant_id, table_number, table_name,
  capacity, location, is_active, qr_code,
  created_at, updated_at
) VALUES
(1, 1, '1', 'Test Table 1', 4, 'Area A', 1, 'QR001', datetime('now'), datetime('now')),
(2, 1, '2', 'Test Table 2', 4, 'Area A', 1, 'QR002', datetime('now'), datetime('now')),
(3, 1, '3', 'Test Table 3', 6, 'Area B', 1, 'QR003', datetime('now'), datetime('now')),
(4, 1, '4', 'Test Table 4', 6, 'Area B', 1, 'QR004', datetime('now'), datetime('now')),
(5, 1, '5', 'Test Table 5', 2, 'Area C', 1, 'QR005', datetime('now'), datetime('now')),
(6, 1, '6', 'Test Table 6', 2, 'Area C', 1, 'QR006', datetime('now'), datetime('now')),
(7, 1, '7', 'Test Table 7', 8, 'VIP', 1, 'QR007', datetime('now'), datetime('now')),
(8, 1, '8', 'Test Table 8', 8, 'VIP', 1, 'QR008', datetime('now'), datetime('now')),
(9, 1, '9', 'Test Table 9', 4, 'Patio', 1, 'QR009', datetime('now'), datetime('now')),
(10, 1, '10', 'Test Table 10', 4, 'Patio', 1, 'QR010', datetime('now'), datetime('now'));

-- 驗證數據
SELECT 'Restaurant created' as status, COUNT(*) as count FROM restaurants WHERE id = 1;
SELECT 'Tables created' as status, COUNT(*) as count FROM tables WHERE restaurant_id = 1;
```

執行命令:
```bash
# Local D1 database
npx wrangler d1 execute makanmakan-staging --local --file=./tests/performance/seed-realtime-test.sql

# 或者直接在 API dev 環境中執行
```

### 步驟 2: 啟動服務

**終端 1 - API 服務**:
```bash
cd apps/api
pnpm dev
# 服務應在 http://localhost:8787 啟動
```

**終端 2 - Realtime 服務**:
```bash
cd apps/realtime
pnpm dev
# 服務應在 ws://localhost:8788 啟動
```

**驗證服務**:
```bash
# 測試 API 健康檢查
curl http://localhost:8787/api/v1/health

# 測試 Realtime token 生成
curl -X POST http://localhost:8787/api/v1/realtime/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "roomType": "kitchen",
    "roomId": "test",
    "restaurantId": "1",
    "sessionId": "test-session"
  }'
```

### 步驟 3: 執行基準測試

**終端 3 - Performance Test**:
```bash
cd tests/performance

# 設定環境變數
export API_URL=http://localhost:8787
export TEST_TABLE_ID=1

# 執行 WebSocket 基準測試
artillery run artillery-websocket.yml \
  --output baseline-$(date +%Y%m%d-%H%M%S).json

# 或使用簡化版本（快速測試）
artillery run test-simple-ws.yml
```

### 步驟 4: 生成報告

```bash
# 生成 HTML 報告
artillery report baseline-YYYYMMDD-HHMMSS.json \
  --output reports/baseline-YYYYMMDD-HHMMSS.html

# 在瀏覽器中查看報告
start reports/baseline-YYYYMMDD-HHMMSS.html
```

---

## 📊 預期輸出指標

### 關鍵性能指標 (KPIs)

**連線指標**:
```
ws.connection_success_rate    目標: > 99%
ws.connection_time.p95        目標: < 500ms
ws.connection_time.p99        目標: < 1000ms
並發連線數                    目標: 1000+ (Phase 4)
```

**訊息指標**:
```
ws.response_time.p95          目標: < 200ms
ws.response_time.p99          目標: < 500ms
ws.messages_sent              記錄值
ws.messages_received          目標: ≈ messages_sent
訊息成功率                    目標: > 95%
```

**自定義指標**:
```
tokens.kitchen.success        應 > 0
tokens.admin.success          應 > 0
tokens.customer.success       應 > 0
connections.established       應接近 scenarios launched
```

### 成功標準

**綠色指標** (優秀):
- 連線成功率 > 99%
- P95 延遲 < 200ms
- 錯誤率 < 1%

**黃色指標** (可接受):
- 連線成功率 95-99%
- P95 延遲 200-500ms
- 錯誤率 1-5%

**紅色指標** (需優化):
- 連線成功率 < 95%
- P95 延遲 > 500ms
- 錯誤率 > 5%

---

## 🔍 故障排除

### 問題 1: Token 生成失敗

**症狀**: `tokens.kitchen.failed` 或類似指標很高

**檢查步驟**:
```bash
# 1. 檢查 API 服務狀態
curl http://localhost:8787/api/v1/health

# 2. 手動測試 token 生成
curl -X POST http://localhost:8787/api/v1/realtime/auth/token \
  -H "Content-Type: application/json" \
  -d '{"roomType":"kitchen","roomId":"1","restaurantId":"1","sessionId":"test"}'

# 3. 檢查 API 日誌
# 查看 Terminal 1 的輸出
```

### 問題 2: WebSocket 連線失敗

**症狀**: 大量 `ECONNREFUSED` 或 404 錯誤

**檢查步驟**:
```bash
# 1. 檢查 Realtime 服務狀態
curl http://localhost:8788/health

# 2. 檢查端口是否被佔用
netstat -ano | findstr :8788

# 3. 檢查 Realtime 服務日誌
# 查看 Terminal 2 的輸出
```

### 問題 3: Customer Token 總是失敗

**症狀**: `tokens.customer.failed` 很高

**原因**: 沒有有效的 table 數據

**解決方案**:
```bash
# 確認測試數據已創建
# 重新執行步驟 1 的 SQL 腳本
```

### 問題 4: 測試中途崩潰

**症狀**: Artillery 突然停止

**可能原因**:
- 服務記憶體不足
- 負載太高導致服務崩潰

**解決方案**:
```yaml
# 降低負載 - 修改 artillery-websocket.yml
phases:
  - duration: 60
    arrivalRate: 2  # 降低到 2 (原本 5)
  # ... 其他階段也相應降低
```

---

## 📈 測試後分析

### 1. 性能基準建立

創建 `tests/performance/baselines/` 目錄並保存：
- `baseline-YYYYMMDD.json` - 原始數據
- `baseline-YYYYMMDD.html` - 可視化報告
- `baseline-summary.md` - 關鍵指標摘要

### 2. 識別瓶頸

分析以下指標：
- **高延遲**: 查看 p95, p99 延遲
- **低成功率**: 查看錯誤類型和分布
- **資源使用**: 監控 CPU, 記憶體使用

### 3. 優化建議

基於測試結果，可能的優化方向：
- WebSocket 連線池優化
- 訊息批次處理
- Durable Objects 實例數調整
- 心跳頻率優化
- 錯誤處理改進

---

## 🎯 下一步行動

完成基準測試後：

1. **建立性能基準報告** ✅
   - 記錄所有關鍵指標
   - 識別性能瓶頸
   - 提出優化建議

2. **實施優化** ⏳
   - 根據瓶頸分析進行優化
   - 重新測試並對比

3. **建立 Monitoring Dashboard** ⏳
   - 即時監控 WebSocket 連線
   - 訊息流量統計
   - 錯誤率追蹤

4. **完成 Group Order Frontend** ⏳
   - Customer App 完整整合
   - 即時協作介面

5. **Staging Deployment** ⏳
   - 部署到 Cloudflare staging 環境
   - 生產前驗證

---

**創建者**: Claude Code
**最後更新**: 2025-11-15
**預計完成時間**: 2-3 週
