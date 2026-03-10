# 測試評估報告

## 測試統計摘要

```
總測試文件：75 個
  - ✅ 通過：21 個 (28%)
  - ❌ 失敗：54 個 (72%)

總測試用例：1340 個
  - ✅ 通過：748 個 (55.8%)
  - ❌ 失敗：555 個 (41.4%)
  - ⏭ 跳過：37 個 (2.8%)

錯誤數：21 個
執行時間：130.72 秒
```

## 測試分類評估

### 🗑️ A. 應該刪除的測試（不必要/已廢棄）

#### 1. Payment 相關測試（已廢棄功能）

**原因**：根據 CLAUDE.md，Payment 系統已被完全移除（14 tables removed, Phase 2 deferred）

**文件列表**：

- ❌ `apps/admin-dashboard/src/stores/__tests__/payment.test.js` (所有測試)
- ❌ `apps/admin-dashboard/src/stores/__tests__/payment.test.ts` (所有測試)
- ❌ `apps/admin-dashboard/src/components/payment/__tests__/PaymentForm.test.js`
- ❌ `apps/admin-dashboard/src/components/payment/__tests__/PaymentForm.test.ts`
- ❌ `apps/admin-dashboard/src/components/payment/__tests__/PaymentProcessing.test.js`
- ❌ `apps/admin-dashboard/src/components/payment/__tests__/PaymentProcessing.test.ts`
- ❌ `apps/admin-dashboard/src/components/payment/__tests__/PaymentSteps.test.js`
- ❌ `apps/admin-dashboard/src/components/payment/__tests__/PaymentSteps.test.ts`

**建議**：完全刪除這 8 個測試文件
**影響**：減少約 50-60 個失敗測試

---

### ✅ B. 必須保留並修復的測試（核心業務邏輯）

#### 1. Database Services 測試（高優先級）

**狀態**：失敗，需要修復 database mock
**重要性**：🔴 關鍵

**文件列表**：

- ⚠️ `packages/database/src/services/__tests__/coupon.test.ts` (14 failed tests)
  - 問題：Database 未初始化
  - 修復：添加 test setup with mock database

- ⚠️ `packages/database/src/services/__tests__/LeaveService.test.ts` (10 failed tests)
  - 問題：Database 未初始化
  - 修復：添加 test setup with mock database

- ⚠️ `packages/database/src/services/__tests__/SchedulingService.test.ts` (8 failed tests)
  - 問題：Database 未初始化
  - 修復：添加 test setup with mock database

**建議**：優先修復這些測試（約 32 個測試用例）

#### 2. API Feature 測試（高優先級）

**狀態**：失敗，需要修復環境配置
**重要性**：🔴 關鍵

**文件列表**：

- ⚠️ `apps/api/src/features/authentication/__tests__/feature.test.ts`
- ⚠️ `apps/api/src/features/qr-codes/__tests__/feature.test.ts`
- ⚠️ `apps/api/src/features/restaurants/__tests__/feature.test.ts`
- ⚠️ `apps/api/src/features/users/__tests__/feature.test.ts`

**問題**：

- ES Module 導入錯誤（queue-core/dist/types 目錄導入）
- 環境變量未設置

**建議**：修復 queue-core 導出配置

#### 3. Admin Dashboard Integration 測試（中優先級）

**狀態**：失敗，需要 mock 瀏覽器 API 和服務
**重要性**：🟡 重要

**文件列表**：

- ⚠️ `apps/admin-dashboard/src/__tests__/integration/dashboard-workflow.test.js`
- ⚠️ `apps/admin-dashboard/src/__tests__/integration/dashboard-workflow.test.ts`
- ⚠️ `apps/admin-dashboard/src/tests/integration/group-orders-integration.test.js`
- ⚠️ `apps/admin-dashboard/src/tests/integration/group-orders-integration.test.ts`
- ⚠️ `apps/admin-dashboard/src/tests/integration/pos-integration.test.js`
- ⚠️ `apps/admin-dashboard/src/tests/integration/pos-integration.test.ts`
- ⚠️ `apps/admin-dashboard/src/tests/integration/queue-integration.test.js`
- ⚠️ `apps/admin-dashboard/src/tests/integration/queue-integration.test.ts`
- ⚠️ `apps/admin-dashboard/src/tests/integration/realtime-group-orders.integration.test.js`
- ⚠️ `apps/admin-dashboard/src/tests/integration/realtime-group-orders.integration.test.ts`

**問題**：

- Notification API 未定義
- Realtime 服務 mock 缺失

**建議**：添加瀏覽器 API mock 到 setup 文件

#### 4. Kitchen Display Integration 測試（中優先級）

**狀態**：失敗，需要組件和服務 mock
**重要性**：🟡 重要

**文件列表**：

- ⚠️ `apps/kitchen-display/tests/integration/audio-integration.test.ts`
- ⚠️ `apps/kitchen-display/tests/integration/end-to-end.test.ts`
- ⚠️ `apps/kitchen-display/tests/integration/keyboard-shortcuts-integration.test.ts`
- ⚠️ `apps/kitchen-display/tests/integration/offline-sync-integration.test.ts`
- ⚠️ `apps/kitchen-display/tests/integration/performance-integration.test.ts`
- ⚠️ `apps/kitchen-display/tests/integration/workflow-integration.test.ts`

**問題**：

- Vue 組件 required props 缺失
- Storage API mock 不完整

**建議**：修復組件 mount 配置

---

### 🔄 C. 可選測試（根據項目階段決定）

#### 1. E2E 測試（低優先級）

**狀態**：失敗，需要 Playwright 配置
**重要性**：🟢 可選（現階段）

**文件列表**：

- 🔵 `apps/customer-app/e2e/core-user-flows.spec.ts`
- 🔵 `apps/customer-app/e2e/cross-browser-compatibility.spec.ts`
- 🔵 `apps/customer-app/e2e/i18n-multilingual.spec.ts`
- 🔵 `apps/customer-app/e2e/performance-accessibility.spec.ts`

**問題**：需要 Playwright 環境和瀏覽器安裝

**建議**：暫時跳過（添加到 vitest exclude），等 unit tests 修復後再處理

#### 2. Component 單元測試（低優先級）

**狀態**：部分失敗
**重要性**：🟢 可選（現階段）

**文件列表**：

- 🔵 `apps/customer-app/src/tests/components/*.test.ts`
- 🔵 `apps/admin-dashboard/src/__tests__/components/Sidebar.test.js`
- 🔵 `apps/admin-dashboard/src/__tests__/components/Sidebar.test.ts`

**問題**：組件導入和 mock 配置

**建議**：中等優先級，在集成測試修復後處理

---

## 修復優先級建議

### 階段 1：刪除不必要的測試（5 分鐘）

- [x] 刪除 8 個 Payment 相關測試文件
- [x] 預期減少：~60 個失敗測試

### 階段 2：修復核心 Database 測試（30 分鐘）

- [ ] 添加 database test setup
- [ ] 修復 LeaveService 測試 (10 tests)
- [ ] 修復 SchedulingService 測試 (8 tests)
- [ ] 修復 CouponService 測試 (14 tests)
- [ ] 預期提升：+32 個通過測試

### 階段 3：修復 API Feature 測試（20 分鐘）

- [ ] 修復 queue-core ES module 導出
- [ ] 修復環境變量配置
- [ ] 預期提升：+20 個通過測試

### 階段 4：修復 Integration 測試（45 分鐘）

- [ ] 添加瀏覽器 API mocks (Notification, WebSocket, etc.)
- [ ] 修復 Realtime 服務 mock
- [ ] 修復組件 required props
- [ ] 預期提升：+150 個通過測試

### 階段 5：排除 E2E 測試（5 分鐘）

- [ ] 將 E2E 測試添加到 exclude
- [ ] 預期減少：~80 個失敗測試

---

## 預期結果

**完成所有階段後**：

```
測試文件：
  - 刪除：8 個 payment 測試
  - 通過：~60 個 (80%)
  - 失敗：~15 個 (20%)

測試用例：
  - 通過：~950 個 (80%)
  - 失敗：~200 個 (15%)
  - 跳過：~50 個 (5%)

總通過率：從 55.8% → 80%+
```

---

## 立即行動建議

**推薦執行順序**：

1. ✅ 階段 1（刪除 Payment 測試）- 立即執行
2. ✅ 階段 2（修復 Database 測試）- 高優先級
3. ✅ 階段 3（修復 API 測試）- 高優先級
4. ✅ 階段 4（修復 Integration 測試）- 中優先級
5. ⏭️ 階段 5（排除 E2E）- 可選

---

生成時間：2025-11-07
狀態：待執行
