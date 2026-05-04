# 測試增強路線圖

## MakanMasak Testing Enhancement Roadmap

> **當前狀態**: Phase 1 已啟動 - POSService 測試套件已完成
> **目標**: 將整體測試覆蓋率從 9.8% 提升至 40%+

---

## 📊 當前測試覆蓋率分析

```
┌─────────────────────────────────────────────────────────────────┐
│                   測試覆蓋率基準 (Baseline)                     │
├─────────────────────────────────────────────────────────────────┤
│  模組                源碼行數    測試行數    覆蓋率    目標     │
│  ──────────────────────────────────────────────────────────── │
│  API                 51,612      6,574      12.7%     40%      │
│  Packages (DB)       23,762      3,975      16.7%     50%      │
│  Admin Dashboard     73,492      4,046       5.5%     30%      │
│  ──────────────────────────────────────────────────────────── │
│  總計               148,866     14,595       9.8%     40%      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Phase 1: 關鍵業務邏輯測試 (已啟動)

### ✅ 已完成

- **POSService 測試套件** (1,000+ 行, 40+ 測試用例)
  - ✓ 收銀機管理 (4 tests)
  - ✓ 班次管理 (8 tests)
  - ✓ 現金操作 (4 tests)
  - ✓ 收據管理 (4 tests)
  - ✓ 退款處理 (5 tests)
  - ✓ 報表生成 (4 tests)
  - ✓ 錯誤處理 (3 tests)
  - ✓ 併發處理 (1 test)
  - ✓ 數據完整性 (2 tests)

### 🔄 進行中

- **GroupOrderService 測試套件** (待實施)

### 📝 待完成

#### 1.2 GroupOrderService Tests (預計 800+ 行)

**文件**: `packages/database/src/services/__tests__/GroupOrderService.test.ts`

```typescript
/**
 * 測試範圍:
 * - 群組訂單創建和管理
 * - 成員加入和權限管理
 * - 購物車項目管理
 * - 帳單分攤 (equal, proportional, individual, custom)
 * - 分享碼生成和驗證
 * - 群組活動日誌
 */

describe("GroupOrderService", () => {
  // 1. 群組訂單創建 (5 tests)
  //    - 成功創建群組訂單
  //    - 生成唯一分享碼
  //    - 設置過期時間
  //    - 創建群組創建者記錄
  //    - 驗證權限設置
  // 2. 成員管理 (8 tests)
  //    - 成功加入群組
  //    - 拒絕加入已滿群組
  //    - 拒絕加入過期群組
  //    - 成員角色分配
  //    - 成員離開群組
  //    - 更新成員活躍狀態
  //    - 驗證成員權限
  //    - 處理匿名成員
  // 3. 購物車管理 (10 tests)
  //    - 添加菜品到購物車
  //    - 更新購物車項目
  //    - 刪除購物車項目
  //    - 計算項目總價
  //    - 處理定制選項
  //    - 驗證菜品可用性
  //    - 處理特殊說明
  //    - 批量操作
  //    - 鎖定購物車
  //    - 清空購物車
  // 4. 帳單分攤 (12 tests)
  //    - 平均分攤 (equal split)
  //    - 按比例分攤 (proportional split)
  //    - 個人項目分攤 (individual split)
  //    - 自定義分攤 (custom split)
  //    - 計算稅費和服務費
  //    - 處理小費
  //    - 處理折扣
  //    - 驗證分攤總額
  //    - 更新支付狀態
  //    - 處理部分支付
  //    - 退款處理
  //    - 生成分攤明細
  // 5. 分享功能 (6 tests)
  //    - 生成分享碼
  //    - 驗證分享碼
  //    - 生成分享 URL
  //    - 生成 QR 碼
  //    - 處理過期分享碼
  //    - 記錄分享統計
  // 6. 群組狀態管理 (5 tests)
  //    - 更新群組狀態
  //    - 鎖定群組訂單
  //    - 完成群組訂單
  //    - 取消群組訂單
  //    - 處理超時
  // 7. 併發和競態條件 (3 tests)
  //    - 同時加入群組
  //    - 同時添加購物車項目
  //    - 同時更新訂單
  // 8. 錯誤處理 (4 tests)
  //    - 處理無效分享碼
  //    - 處理數據庫錯誤
  //    - 處理無效輸入
  //    - 處理權限錯誤
});
```

#### 1.3 NotificationService Tests (預計 500+ 行)

**文件**: `packages/database/src/services/__tests__/NotificationService.test.ts`

```typescript
/**
 * 測試範圍:
 * - Email 通知發送
 * - SMS 通知發送
 * - Push 通知發送
 * - 通知模板管理
 * - 批量通知
 * - 重試機制
 */

describe("NotificationService", () => {
  // 1. Email 通知 (6 tests)
  // 2. SMS 通知 (5 tests)
  // 3. Push 通知 (4 tests)
  // 4. 模板管理 (5 tests)
  // 5. 批量通知 (3 tests)
  // 6. 重試機制 (4 tests)
  // 7. 錯誤處理 (3 tests)
});
```

#### 1.4 ExportService Tests (預計 400+ 行)

**文件**: `packages/database/src/services/__tests__/ExportService.test.ts`

#### 1.5 LeaveAnalyticsService Tests (預計 450+ 行)

**文件**: `packages/database/src/services/__tests__/LeaveAnalyticsService.test.ts`

---

## 🎯 Phase 2: API 層端到端測試

### 2.1 POS API Tests (預計 800+ 行)

**文件**: `apps/api/src/features/pos/__tests__/api.test.ts`

```typescript
describe("POS API", () => {
  // 1. 收銀機 API (8 tests)
  //    - POST /api/v1/pos/registers
  //    - GET /api/v1/pos/registers
  //    - GET /api/v1/pos/registers/:id
  //    - PUT /api/v1/pos/registers/:id
  //    - DELETE /api/v1/pos/registers/:id
  // 2. 班次管理 API (10 tests)
  //    - POST /api/v1/pos/shifts/start
  //    - POST /api/v1/pos/shifts/:id/end
  //    - GET /api/v1/pos/shifts
  //    - GET /api/v1/pos/shifts/:id
  // 3. 現金操作 API (6 tests)
  //    - POST /api/v1/pos/cash-movements
  //    - GET /api/v1/pos/cash-movements
  // 4. 收據 API (8 tests)
  //    - POST /api/v1/pos/receipts/print
  //    - POST /api/v1/pos/receipts/:id/reprint
  //    - GET /api/v1/pos/receipts
  // 5. 退款 API (8 tests)
  //    - POST /api/v1/pos/refunds
  //    - GET /api/v1/pos/refunds
  //    - PUT /api/v1/pos/refunds/:id/approve
  // 6. 報表 API (6 tests)
  //    - GET /api/v1/pos/reports/shift/:id
  //    - GET /api/v1/pos/reports/daily
  //    - GET /api/v1/pos/stats
  // 7. 認證和權限 (8 tests)
  // 8. 錯誤處理 (6 tests)
});
```

### 2.2 Group Orders API Tests (預計 700+ 行)

### 2.3 Scheduling API Tests (預計 600+ 行)

### 2.4 Leaves API Tests (預計 500+ 行)

### 2.5 Reservations API Tests (預計 400+ 行)

---

## 🎯 Phase 3: 前端 Composables 測試

### 3.1 核心 Realtime Composables

#### useAdminRealtime Tests (預計 600+ 行)

**文件**: `apps/admin-dashboard/src/composables/__tests__/useAdminRealtime.test.ts`

```typescript
describe("useAdminRealtime", () => {
  // 1. 連接管理 (8 tests)
  //    - 建立 WebSocket 連接
  //    - 自動重連
  //    - 心跳檢測
  //    - 連接狀態監控
  //    - 處理斷線
  //    - 多次連接防護
  //    - 連接超時
  //    - 清理資源
  // 2. 訂單通知 (10 tests)
  //    - 接收新訂單事件
  //    - 接收訂單狀態更新
  //    - 訂單通知過濾
  //    - 訂單通知優先級
  //    - 通知聲音控制
  //    - 通知標記已讀
  //    - 通知歷史記錄
  //    - 通知清除
  //    - 通知搜索
  //    - 批量操作
  // 3. 廚房統計 (6 tests)
  //    - 實時廚房隊列
  //    - 待處理項目計數
  //    - 烹飪中項目計數
  //    - 準備完成項目計數
  //    - 平均等待時間
  //    - 統計刷新
  // 4. 菜單警報 (5 tests)
  //    - 庫存不足警報
  //    - 菜品下架警報
  //    - 警報過濾
  //    - 警報確認
  //    - 警報歷史
  // 5. 系統通知 (4 tests)
  //    - 系統警報接收
  //    - 通知級別處理
  //    - 通知持久化
  //    - 通知配置
  // 6. 錯誤處理 (4 tests)
  //    - 連接錯誤
  //    - 訊息格式錯誤
  //    - 事件處理錯誤
  //    - 重試機制
});
```

#### useKitchenRealtime Tests (預計 650+ 行)

#### useRealtimeOrders Tests (預計 450+ 行)

#### useRealtimePOS Tests (預計 400+ 行)

#### useRealtimeQueue Tests (預計 380+ 行)

### 3.2 工具類 Composables

#### useErrorTracking Tests (預計 300+ 行)

#### usePerformanceMonitor Tests (預計 350+ 行)

#### useRequestDeduplication Tests (預計 280+ 行)

#### usePagination Tests (預計 250+ 行)

---

## 🎯 Phase 4: 集成測試和 E2E 測試

### 4.1 關鍵業務流程集成測試

#### POS Complete Workflow (預計 500+ 行)

```typescript
describe("POS Complete Workflow", () => {
  // 完整流程: 開班 → 銷售 → 退款 → 結班 → 報表
  it("應該完成完整的 POS 操作流程", async () => {
    // 1. 創建收銀機
    // 2. 開始班次
    // 3. 處理多筆銷售
    // 4. 打印收據
    // 5. 處理退款
    // 6. 記錄現金操作
    // 7. 結束班次
    // 8. 生成報表
    // 9. 驗證數據一致性
  });
});
```

#### Group Ordering Workflow (預計 600+ 行)

```typescript
describe("Group Ordering Complete Flow", () => {
  // 完整流程: 創建群組 → 多人加入 → 點餐 → 分攤 → 支付
  it("應該完成完整的群組點餐流程", async () => {
    // 1. 創建群組訂單
    // 2. 多個成員加入
    // 3. 成員添加菜品
    // 4. 確認訂單
    // 5. 計算分攤
    // 6. 處理支付
    // 7. 完成訂單
    // 8. 驗證數據
  });
});
```

### 4.2 跨模組集成測試

#### Menu → Order → Kitchen Integration (預計 400+ 行)

#### Order → Payment → POS Integration (預計 400+ 行)

#### Realtime → Dashboard Integration (預計 350+ 行)

---

## 📈 預期測試覆蓋率提升

```
【測試覆蓋率提升軌跡】

Phase 1 完成後:
API:          12.7% → 25%    (+12.3%)
DB:           16.7% → 45%    (+28.3%)
Dashboard:     5.5% → 8%     (+2.5%)
總體:          9.8% → 22%    (+12.2%)

Phase 2 完成後:
API:          25% → 45%      (+20%)
DB:           45% → 50%      (+5%)
Dashboard:     8% → 12%      (+4%)
總體:         22% → 35%      (+13%)

Phase 3 完成後:
API:          45% → 48%      (+3%)
DB:           50% → 52%      (+2%)
Dashboard:    12% → 35%      (+23%)
總體:         35% → 43%      (+8%)

Phase 4 完成後:
API:          48% → 52%      (+4%)
DB:           52% → 55%      (+3%)
Dashboard:    35% → 38%      (+3%)
總體:         43% → 48%      (+5%)

【最終目標】
API:          52%  (行業標準: 40-60%)  ✅
DB:           55%  (行業標準: 50-70%)  ✅
Dashboard:    38%  (行業標準: 30-50%)  ✅
總體:         48%  (行業標準: 40-80%)  ✅
```

---

## 🛠️ 測試工具和最佳實踐

### 測試框架和工具

```json
{
  "framework": "Vitest",
  "coverage": "v8",
  "e2e": "Playwright",
  "mocking": "vi.mock",
  "assertions": "expect"
}
```

### 測試結構模板

```typescript
describe('ServiceName', () => {
  let service: ServiceType
  let mockDB: any
  let mockEnv: any

  beforeEach(() => {
    // 設置 mock 和測試環境
    mockDB = createMockDB()
    mockEnv = createMockEnv()
    service = new ServiceType(mockDB, mockEnv)
  })

  afterEach(() => {
    // 清理資源
    vi.restoreAllMocks()
  })

  describe('功能分組', () => {
    it('應該 [具體行為]', async () => {
      // Arrange: 準備測試數據
      const testData = { ... }

      // Act: 執行測試操作
      const result = await service.method(testData)

      // Assert: 驗證結果
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })
  })
})
```

### 測試命名規範

```typescript
// ✅ 好的命名
it('應該成功創建收銀機', ...)
it('應該拒絕無效的收銀機名稱', ...)
it('應該正確處理併發請求', ...)

// ❌ 不好的命名
it('test createRegister', ...)
it('works', ...)
it('test 1', ...)
```

### Mock 數據管理

```typescript
// 使用工廠函數創建測試數據
const createTestRegister = (overrides = {}) => ({
  name: "POS-001",
  location: "Front Counter",
  restaurantId: 1,
  isActive: true,
  ...overrides,
});

// 使用 builders 構建複雜數據
const registerBuilder = {
  withName: (name) => ({ ...base, name }),
  withLocation: (location) => ({ ...base, location }),
  build: () => base,
};
```

---

## 🚀 快速開始指南

### 運行測試

```bash
# 運行所有測試
pnpm test

# 運行特定模組測試
pnpm test packages/database

# 運行單個測試文件
pnpm test POSService.test.ts

# 查看測試覆蓋率
pnpm test:coverage

# 監視模式
pnpm test:watch
```

### 調試測試

```bash
# 使用 --inspect-brk 調試
node --inspect-brk ./node_modules/vitest/vitest.mjs run POSService.test.ts

# 使用 console.log 輸出
it('test', () => {
  console.log('Debug:', testData)
})
```

---

## 📝 實施檢查清單

### Phase 1 Checklist

- [x] POSService Tests (1000+ 行, 40+ tests)
- [ ] GroupOrderService Tests (800+ 行, 50+ tests)
- [ ] NotificationService Tests (500+ 行, 30+ tests)
- [ ] ExportService Tests (400+ 行, 25+ tests)
- [ ] LeaveAnalyticsService Tests (450+ 行, 28+ tests)

### Phase 2 Checklist

- [ ] POS API Tests (800+ 行)
- [ ] Group Orders API Tests (700+ 行)
- [ ] Scheduling API Tests (600+ 行)
- [ ] Leaves API Tests (500+ 行)
- [ ] Reservations API Tests (400+ 行)

### Phase 3 Checklist

- [ ] useAdminRealtime Tests (600+ 行)
- [ ] useKitchenRealtime Tests (650+ 行)
- [ ] useRealtimeOrders Tests (450+ 行)
- [ ] useErrorTracking Tests (300+ 行)
- [ ] usePerformanceMonitor Tests (350+ 行)

### Phase 4 Checklist

- [ ] POS Complete Workflow (500+ 行)
- [ ] Group Ordering Workflow (600+ 行)
- [ ] Cross-module Integration (1200+ 行)

---

## 📊 進度追蹤

```
【整體進度】
Phase 1: ████████░░░░░░░░░░░░ 20% (1/5 完成)
Phase 2: ░░░░░░░░░░░░░░░░░░░░  0% (0/5 完成)
Phase 3: ░░░░░░░░░░░░░░░░░░░░  0% (0/5 完成)
Phase 4: ░░░░░░░░░░░░░░░░░░░░  0% (0/3 完成)

總進度: ███░░░░░░░░░░░░░░░░░ 8% (1/18 完成)
```

**估計完成時間**: 8-10 個工作日 (全職工作)

---

## 🎯 下一步行動

### 立即執行

1. **運行 POSService 測試**

   ```bash
   cd packages/database
   pnpm test POSService.test.ts
   ```

2. **修復任何失敗的測試**
   - 調整 mock 數據
   - 修正測試邏輯
   - 驗證預期行為

3. **開始 GroupOrderService 測試**
   - 閱讀 GroupOrderService 實現
   - 設計測試用例
   - 編寫測試代碼

### 本週目標

- ✅ 完成 Phase 1.1: POSService Tests
- 🎯 完成 Phase 1.2: GroupOrderService Tests
- 🎯 完成 Phase 1.3: NotificationService Tests
- 🎯 運行所有測試並驗證覆蓋率提升

---

**最後更新**: 2025-11-13
**作者**: Claude Code + MakanMasak Team
**狀態**: Phase 1 進行中
