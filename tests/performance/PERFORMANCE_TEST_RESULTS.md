# Realtime Services - 性能測試結果報告

**測試日期**: 2025-11-15
**測試時長**: 8 分鐘 (480 秒)
**測試工具**: Artillery 2.0.26
**測試狀態**: ❌ 失敗 (100% 失敗率)

---

## 📊 測試結果摘要

### 總體統計

- **虛擬用戶創建**: 19,500
- **虛擬用戶失敗**: 19,500 (100%)
- **總錯誤數**: 39,000+

### 錯誤分布

```
errors.Unexpected server response: 404   32,412 (83.1%)
errors.ECONNREFUSED                       6,522 (16.7%)
errors.read ECONNRESET                       30 (<0.1%)
errors.ECONNRESET                            31 (<0.1%)
errors.Unexpected server response: 500        2 (<0.1%)
errors.write ECONNRESET                       1 (<0.1%)
errors.Parse Error                            1 (<0.1%)
errors.HPE_INVALID_CONSTANT                   1 (<0.1%)
```

### 場景分布

```
Customer WebSocket Connection:   9,645 (49.5%)  [全部失敗]
Admin WebSocket Connection:      7,172 (36.8%)  [全部失敗]
Message Flood Test:              2,440 (12.5%)  [全部失敗]
Kitchen WebSocket Connection:      243 ( 1.2%)  [全部失敗]
```

### Token 生成統計

```
❌ 無任何 token 生成統計
   - tokens.kitchen.success: 0
   - tokens.admin.success: 0
   - tokens.customer.success: 0
```

---

## 🔍 問題診斷

### 問題 1: Artillery Processor 語法錯誤 ⚠️

**症狀**: "errors.done is not a function"
**原因**: Artillery 2.x 不再支持 callback 模式
**影響**: 所有 processor 函數執行後報錯，導致 WebSocket 連線失敗

**當前代碼 (錯誤)**:
\`\`\`javascript
async function getKitchenToken(context, events, done) {
// ...
return done(); // ❌ Artillery 2.x 不支持
}
\`\`\`

**正確代碼 (應修復)**:
\`\`\`javascript
async function getKitchenToken(context, events) {
// ...
// ✅ 直接返回，不需要 done()
}
\`\`\`

**文件位置**: `tests/performance/artillery-processor.js`

---

### 問題 2: API Rate Limiting 🚫

**症狀**: HTTP 429 "Rate limit exceeded"
**原因**: API 服務啟用了嚴格的速率限制
**影響**: 高並發測試時，大量請求被拒絕

**測試證據**:
\`\`\`json
{
"success": false,
"error": "Rate limit exceeded",
"reason": "Rate limit exceeded",
"retry_after": 300,
"threat_score": 0
}
\`\`\`

**建議**:

1. 為性能測試環境禁用或放寬速率限制
2. 在 `wrangler.toml` 中添加測試模式配置
3. 使用 IP 白名單繞過 localhost 限制

---

### 問題 3: WebSocket 連線失敗 🔌

**症狀**: 大量 404 和 ECONNREFUSED 錯誤
**原因**: Token 未正確設置到 context.vars
**影響**: WebSocket URL 變成無效路徑 (如 `/`)

**連鎖反應**:

1. Processor callback 錯誤 →
2. context.vars.token 未設置 →
3. WebSocket URL 無效 →
4. Realtime 服務返回 404

**Realtime 日誌證據**:
\`\`\`
[wrangler:info] GET / 404 Not Found (3ms)
[wrangler:info] GET / 404 Not Found (4ms)
... (37,489 次)
\`\`\`

---

## ✅ 獨立驗證測試結果

### Token 生成測試 (成功)

**測試腳本**: `test-token-generation.js`
**結果**: ✅ 部分成功

\`\`\`
✅ Kitchen Token 生成: 成功 (Status 200)
✅ Admin Token 生成: 成功 (Status 200)
❌ Customer Token 生成: 失敗 (Status 400, "Invalid table ID")
\`\`\`

**Customer Token 問題**:

- TableId='1' 被視為無效
- 數據庫中 tables (ID 1-10) 確實存在
- 可能是 tableId 傳遞方式的問題（應該用 QR code?）

### 簡化 Artillery 測試 (部分成功)

**測試配置**: `test-simple.yml`
**結果**: ⚠️ 部分成功，發現關鍵問題

\`\`\`
✅ Processor 函數被調用: 10 次
✅ Token 生成成功: 6 次
❌ Token 生成失敗 (Rate limit): 4 次
❌ Processor callback 錯誤: 10 次
\`\`\`

---

## 🎯 根本原因總結

### 主要原因

1. **Artillery Processor 語法過時** (Critical)
   - 使用了已棄用的 callback 模式
   - 導致所有 processor 函數執行失敗
   - WebSocket 連線所需的變數未設置

2. **API 速率限制過於嚴格** (High)
   - 即使在本地測試環境也觸發限制
   - 阻礙大規模性能測試執行

3. **Customer Token 驗證邏輯問題** (Medium)
   - tableId 參數驗證失敗
   - 需要檢查 RealtimeAuthService.verifyTableExists()

---

## 🔧 修復建議

### 優先級 1: 修復 Artillery Processor (Critical)

**文件**: `tests/performance/artillery-processor.js`

**修改內容**:
\`\`\`javascript
// 移除所有函數中的 done 參數和 return done()
// 從:
async function getKitchenToken(context, events, done) {
// ...
return done();
}

// 改為:
async function getKitchenToken(context, events) {
// ...
// 直接返回，無需 done()
}
\`\`\`

**影響文件**: 3個函數需要修改

- getKitchenToken
- getAdminToken
- getCustomerToken

---

### 優先級 2: 調整 Rate Limiting (High)

**選項 A: 測試環境配置**
在 `apps/api/wrangler.toml` 中添加:
\`\`\`toml
[env.test]
name = "makanmakan-api-test"

[env.test.vars]
RATE_LIMIT_ENABLED = "false"
RATE_LIMIT_MULTIPLIER = "10"
\`\`\`

**選項 B: IP 白名單**
在 rate limit 中間件中添加 localhost 豁免:
\`\`\`javascript
// 跳過 localhost 的速率限制
if (ip === '127.0.0.1' || ip === '::1') {
return next();
}
\`\`\`

---

### 優先級 3: 修復 Customer Token (Medium)

**文件**: `apps/api/src/features/realtime/services/RealtimeAuthService.ts`

**問題分析**:
\`\`\`typescript
// Line 193: 使用 qr_code 而不是 id
const stmt = this.db.prepare(
\`SELECT id, restaurant_id FROM tables WHERE qr_code = ? ...\`
).bind(tableId, parseInt(restaurantId))
\`\`\`

**建議修改**:
支持同時通過 ID 或 QR code 查找:
\`\`\`typescript
const stmt = this.db.prepare(
\`SELECT id, restaurant_id FROM tables
WHERE (id = ? OR qr_code = ?)
AND restaurant_id = ?
AND is_active = 1
LIMIT 1\`
).bind(tableId, tableId, restaurantId)
\`\`\`

---

## 📈 預期改進後的結果

修復後應該達到的指標：

\`\`\`
目標指標:
├─ WebSocket 連線成功率 > 99% (當前: 0%)
├─ 訊息延遲 P95 < 200ms (當前: N/A)
├─ 訊息延遲 P99 < 500ms (當前: N/A)
├─ 並發連線數 1,000+ (當前: 0)
└─ Token 生成成功率 > 95% (當前: ~60% with rate limit)
\`\`\`

---

## 🚀 下一步行動

### 立即執行

1. **修復 Artillery Processor** ⏰ 5 分鐘
   - 移除 done() callback
   - 更新所有 processor 函數

2. **禁用測試環境 Rate Limiting** ⏰ 3 分鐘
   - 創建 test 環境配置
   - 或添加 localhost 豁免

3. **重新執行性能測試** ⏰ 10 分鐘
   - 使用修復後的配置
   - 收集新的性能數據

### 後續優化

4. **修復 Customer Token 驗證**
5. **建立性能基準**
6. **創建 Monitoring Dashboard**
7. **完成 Group Order Frontend**
8. **Staging Deployment**

---

## 📝 相關文件

- 測試配置: `tests/performance/artillery-websocket.yml`
- Processor: `tests/performance/artillery-processor.js`
- 診斷測試: `tests/performance/test-simple.yml`
- Token 測試: `tests/performance/test-token-generation.js`
- 測試結果: `tests/performance/baseline-20251115.json`

---

## 💡 關鍵學習

1. **Artillery 版本遷移**
   - Artillery 1.x → 2.x 有 breaking changes
   - Processor callback 模式已棄用
   - 需要使用 async/await

2. **性能測試環境配置**
   - 生產環境的安全措施（rate limiting）會影響測試
   - 需要專門的測試環境配置
   - 本地測試也需要考慮速率限制

3. **調試最佳實踐**
   - 從簡單測試開始
   - 逐步增加複雜度
   - 使用日誌追蹤問題

---

**報告生成時間**: 2025-11-15 16:47:00
**報告作者**: Claude Code
**測試環境**: Local Development (Windows)
**服務狀態**: API (8787), Realtime (8788) - Running
