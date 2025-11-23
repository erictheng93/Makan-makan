# 🚀 Performance Testing - 快速開始指南

**準備時間**: 5 分鐘
**測試時間**: 8 分鐘
**總計**: ~15 分鐘

---

## ✅ 前置檢查

所有工具已就緒：
- ✅ pnpm 10.18.1
- ✅ wrangler 4.42.1
- ✅ Artillery 2.0.26
- ✅ Node.js v22.18.0

---

## 📋 三步驟快速開始

### 第 1 步: 準備測試數據 (1 分鐘)

```bash
# 在專案根目錄執行
npx wrangler d1 execute makanmakan-staging --local \
  --file=./tests/performance/seed-realtime-test.sql
```

**預期輸出**:
```
✅ Restaurant created: 1
✅ Tables created: 10
✅ Table IDs: 1,2,3,4,5,6,7,8,9,10
```

### 第 2 步: 啟動服務 (2 分鐘)

**開啟 3 個終端視窗**:

**終端 1 - API 服務**:
```bash
cd apps/api
pnpm dev
# 等待看到 "Ready on http://localhost:8787"
```

**終端 2 - Realtime 服務**:
```bash
cd apps/realtime
pnpm dev
# 等待看到 "Listening on http://localhost:8788"
```

**終端 3 - 保持開啟** (稍後用於執行測試)

**驗證服務** (在終端 3 執行):
```bash
# 測試 API
curl http://localhost:8787/api/v1/health
# 應該看到: {"success":true,"status":"healthy"}

# 測試 Token 生成
curl -X POST http://localhost:8787/api/v1/realtime/auth/token \
  -H "Content-Type: application/json" \
  -d '{"roomType":"kitchen","roomId":"1","restaurantId":"1","sessionId":"test"}'
# 應該看到: {"success":true,"data":{"token":"..."}}
```

### 第 3 步: 執行測試 (8 分鐘)

**在終端 3 執行**:

```bash
cd tests/performance

# 設定環境變數
export API_URL=http://localhost:8787
export TEST_TABLE_ID=1

# 執行測試 (Windows PowerShell 用戶)
$env:API_URL="http://localhost:8787"
$env:TEST_TABLE_ID="1"

# 開始測試！
artillery run artillery-websocket.yml \
  --output baseline-$(date +%Y%m%d-%H%M%S).json

# Windows PowerShell 用戶:
artillery run artillery-websocket.yml `
  --output "baseline-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
```

**測試進行中** (約 8 分鐘):
```
Phase 1: Warm-up     ████████░░░░░░░░░░░░  1/5 (60s)
Phase 2: Ramp-up     ░░░░░░░░░░░░░░░░░░░░  0/5 (120s)
Phase 3: Sustained   ░░░░░░░░░░░░░░░░░░░░  0/5 (180s)
Phase 4: Peak        ░░░░░░░░░░░░░░░░░░░░  0/5 (60s)
Phase 5: Cool-down   ░░░░░░░░░░░░░░░░░░░░  0/5 (60s)
```

---

## 📊 查看結果

測試完成後，會生成 JSON 文件。生成 HTML 報告：

```bash
# 生成報告 (替換為實際文件名)
artillery report baseline-20251115-143000.json \
  --output reports/baseline-20251115-143000.html

# Windows 開啟報告
start reports\baseline-20251115-143000.html

# macOS/Linux 開啟報告
open reports/baseline-20251115-143000.html
# 或
xdg-open reports/baseline-20251115-143000.html
```

---

## 🎯 成功指標

查看報告中的關鍵指標：

### ✅ 綠色指標 (優秀)
```
ws.connection_success_rate > 99%
ws.response_time.p95 < 200ms
錯誤率 < 1%
```

### ⚠️ 黃色指標 (可接受)
```
ws.connection_success_rate 95-99%
ws.response_time.p95 200-500ms
錯誤率 1-5%
```

### ❌ 紅色指標 (需優化)
```
ws.connection_success_rate < 95%
ws.response_time.p95 > 500ms
錯誤率 > 5%
```

---

## 🔧 快速故障排除

### 問題: Token 生成失敗

```bash
# 檢查 API 服務
curl http://localhost:8787/api/v1/health

# 如果失敗，重啟 API 服務 (Terminal 1)
cd apps/api && pnpm dev
```

### 問題: WebSocket 連線失敗

```bash
# 檢查 Realtime 服務
curl http://localhost:8788/health

# 如果失敗，重啟 Realtime 服務 (Terminal 2)
cd apps/realtime && pnpm dev
```

### 問題: 測試數據不存在

```bash
# 重新執行數據種子腳本
npx wrangler d1 execute makanmakan-staging --local \
  --file=./tests/performance/seed-realtime-test.sql
```

---

## 🚀 進階選項

### 快速測試 (2 分鐘)

使用簡化配置進行快速驗證：

```bash
cd tests/performance
artillery run test-simple-ws.yml
```

### 壓力測試

找出系統極限：

```bash
# 編輯 artillery-websocket.yml
# 將 Phase 4 的 arrivalRate 從 100 改為 500

artillery run artillery-websocket.yml --output stress-test.json
```

### 持久性測試

長時間穩定性測試 (1 小時)：

```bash
# 創建 artillery-endurance.yml
# duration: 3600, arrivalRate: 50

artillery run artillery-endurance.yml --output endurance-test.json
```

---

## 📝 下一步

測試完成後：

1. **分析結果** - 查看 HTML 報告
2. **記錄基準** - 保存 JSON 和 HTML 文件到 `baselines/` 目錄
3. **識別瓶頸** - 查看高延遲或高錯誤率的區域
4. **優化代碼** - 根據瓶頸進行改進
5. **重新測試** - 對比優化前後的性能

---

## 💡 提示

- 測試期間保持所有服務運行
- 不要在測試期間使用瀏覽器訪問服務（會影響結果）
- 首次測試建立基準，後續測試用於對比
- 保存所有測試結果以追蹤性能趨勢

---

**需要幫助？** 查看 `PERFORMANCE_TESTING_PLAN.md` 獲取詳細說明。

**準備好了嗎？** 開始第 1 步！🎯
