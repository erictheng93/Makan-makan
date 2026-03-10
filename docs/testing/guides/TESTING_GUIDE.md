# MakanMakan 測試指南

本文檔提供 MakanMakan 平台完整的測試策略、測試類型和執行指南。

## 📋 目錄

- [測試概述](#測試概述)
- [測試類型](#測試類型)
- [快速開始](#快速開始)
- [E2E 測試](#e2e-測試)
- [性能測試](#性能測試)
- [CI/CD 整合](#cicd-整合)
- [最佳實踐](#最佳實踐)

## 測試概述

### 測試金字塔

```
         ╱ ╲
        ╱   ╲     E2E 測試 (10%)
       ╱─────╲    - Playwright
      ╱       ╲   - 核心業務流程
     ╱─────────╲
    ╱           ╲  整合測試 (30%)
   ╱─────────────╲ - API 整合
  ╱               ╲- WebSocket 連線
 ╱─────────────────╲
╱                   ╲ 單元測試 (60%)
────────────────────── - Vitest
                       - 組件測試
                       - 服務測試
```

### 測試覆蓋率目標

| 類型     | 目標覆蓋率    | 當前狀態 |
| -------- | ------------- | -------- |
| 單元測試 | > 80%         | ✅ 82%   |
| 整合測試 | > 70%         | ✅ 75%   |
| E2E 測試 | 核心流程 100% | ✅ 100%  |
| 性能測試 | 所有 API      | ✅ 完成  |

## 測試類型

### 1. 單元測試 (Unit Tests)

使用 Vitest 進行單元測試。

**測試範圍**：

- Vue 組件
- 服務類別 (Services)
- 工具函數 (Utilities)
- 資料驗證 (Validators)

**執行命令**：

```bash
# 執行所有單元測試
pnpm test

# 執行特定檔案測試
pnpm test path/to/test.spec.ts

# 監視模式
pnpm test:watch

# 生成覆蓋率報告
pnpm test:coverage
```

### 2. 整合測試 (Integration Tests)

測試多個組件或服務之間的互動。

**測試範圍**：

- API 端點整合
- 資料庫操作
- 第三方服務整合
- WebSocket 連線

**執行命令**：

```bash
# 執行整合測試
pnpm test:integration

# Workers 整合測試
pnpm test:workers:integration
```

### 3. E2E 測試 (End-to-End Tests)

使用 Playwright 測試完整的用戶流程。

**測試範圍**：

- ✅ 登入/登出流程
- ✅ 訂單管理 (查看、創建、更新、取消)
- ✅ 菜單管理 (CRUD、搜尋、分類)
- ✅ 桌台管理 (狀態更新、QR 碼生成)
- ✅ 用戶管理 (CRUD、權限管理)
- ✅ 隊列管理 (安排座位、取消排隊)
- ✅ 廚房顯示 (訂單狀態更新)
- ✅ POS 收銀 (支付處理、收據生成)

**執行命令**：

```bash
# 執行所有 E2E 測試
pnpm test:e2e

# UI 模式（推薦開發使用）
pnpm test:e2e:ui

# 特定瀏覽器
npx playwright test --project=chromium

# 特定測試文件
npx playwright test tests/e2e/admin/orders-management.spec.ts

# Debug 模式
npx playwright test --debug
```

### 4. 性能測試 (Performance Tests)

使用 Artillery 進行負載測試和壓力測試。

**測試範圍**：

- ✅ REST API 端點 (認證、訂單、菜單、桌台、用戶)
- ✅ WebSocket 連線 (Kitchen、Admin、Customer)
- ✅ 混合場景測試
- ✅ 錯誤情境測試

**執行命令**：

```bash
# REST API 負載測試
pnpm test:performance

# WebSocket 負載測試
pnpm test:performance:ws

# 生成報告
pnpm test:performance:report
```

## 快速開始

### 1. 環境準備

```bash
# 安裝依賴
pnpm install

# 設置測試資料庫
pnpm db:migrate:local
pnpm db:seed:local
```

### 2. 執行所有測試

```bash
# CI 測試套件（快速）
pnpm test:ci

# 完整測試套件
pnpm test && pnpm test:e2e && pnpm test:performance
```

### 3. 開發模式測試

```bash
# 監視模式單元測試
pnpm test:watch

# E2E UI 模式
pnpm test:e2e:ui
```

## E2E 測試

### 測試結構

```
tests/e2e/
├── admin/                        # 管理後台測試
│   ├── orders-management.spec.ts       # 訂單管理
│   ├── menu-management.spec.ts         # 菜單管理
│   ├── tables-users-management.spec.ts # 桌台&用戶管理
│   └── kitchen-queue-pos.spec.ts       # 廚房&隊列&POS
├── global-setup.ts               # 全域設置
├── global-teardown.ts            # 全域清理
└── support/                      # 測試輔助
    └── test-helpers.ts
```

### 核心測試場景

#### 1. 訂單管理流程 (10 個測試)

- ✅ 顯示訂單列表
- ✅ 篩選訂單狀態
- ✅ 查看訂單詳情
- ✅ 更新訂單狀態
- ✅ 搜尋訂單
- ✅ 取消訂單
- ✅ 顯示訂單統計
- ✅ 導出訂單報表
- ✅ 實時更新訂單 (WebSocket)
- ✅ 錯誤處理

#### 2. 菜單管理流程 (10 個測試)

- ✅ 顯示菜單列表
- ✅ 按分類篩選
- ✅ 新增菜品
- ✅ 編輯菜品
- ✅ 刪除菜品
- ✅ 管理分類
- ✅ 上傳菜品圖片
- ✅ 切換可用狀態
- ✅ 搜尋菜品
- ✅ 顯示統計資訊

#### 3. 桌台管理流程 (5 個測試)

- ✅ 顯示桌台列表
- ✅ 新增桌台
- ✅ 生成 QR 碼
- ✅ 更新桌台狀態
- ✅ 篩選桌台狀態

#### 4. 用戶管理流程 (7 個測試)

- ✅ 顯示員工列表
- ✅ 新增員工
- ✅ 編輯員工資訊
- ✅ 停用/啟用員工
- ✅ 按角色篩選
- ✅ 重設密碼
- ✅ 顯示統計資訊

#### 5. 廚房顯示流程 (5 個測試)

- ✅ 顯示待處理訂單
- ✅ 更新訂單項目狀態
- ✅ 標記訂單完成
- ✅ 顯示訂單計時器
- ✅ 按優先級排序

#### 6. 隊列管理流程 (4 個測試)

- ✅ 顯示排隊列表
- ✅ 安排座位
- ✅ 取消排隊
- ✅ 顯示統計資訊

#### 7. POS 收銀流程 (3 個測試)

- ✅ 顯示待付款訂單
- ✅ 處理現金支付
- ✅ 顯示銷售摘要

**總計：44 個核心 E2E 測試場景**

### 執行特定測試

```bash
# 只測試訂單管理
npx playwright test orders-management

# 只測試菜單管理
npx playwright test menu-management

# 測試所有管理功能
npx playwright test tests/e2e/admin/
```

### E2E 測試最佳實踐

1. **使用 Mock 數據**：避免依賴真實 API
2. **獨立測試**：每個測試應該獨立可執行
3. **清理數據**：測試後清理創建的數據
4. **穩定的選擇器**：使用 data-testid 屬性
5. **適當的等待**：使用 waitForSelector 而非 timeout

## 性能測試

### 測試階段

性能測試分為 6 個階段，總時長約 12 分鐘：

```
1. Warm-up (60s)       → 5 req/s
2. Ramp-up (120s)      → 10-50 req/s
3. Sustained (300s)    → 50 req/s
4. Peak (120s)         → 100 req/s
5. Stress (60s)        → 150 req/s
6. Cool-down (60s)     → 10 req/s
```

### REST API 測試場景

| 場景     | 流量佔比 | 描述                     |
| -------- | -------- | ------------------------ |
| 認證流程 | 20%      | 登入、驗證、獲取用戶資訊 |
| 菜單管理 | 25%      | 查看、搜尋菜單           |
| 訂單管理 | 30%      | CRUD 訂單、統計          |
| 桌台管理 | 15%      | 查看、更新桌台           |
| 用戶管理 | 10%      | CRUD 用戶                |
| 混合讀取 | 50%      | 並發讀取多個端點         |
| 分析報表 | 5%       | 銷售、菜品分析           |
| 錯誤情境 | 5%       | 401、404、400 測試       |

### WebSocket 測試場景

| 場景          | 流量佔比 | 描述                 |
| ------------- | -------- | -------------------- |
| Kitchen 連線  | 30%      | 廚房員工連線、心跳   |
| Admin 連線    | 30%      | 管理員連線           |
| Customer 連線 | 40%      | 顧客連線（較長時間） |
| 訊息洪流      | 10%      | 高頻率訊息壓力測試   |

### 性能指標

#### REST API 目標

- ✅ **成功率**: > 99%
- ✅ **P95 回應時間**: < 300ms
- ✅ **P99 回應時間**: < 500ms
- ✅ **錯誤率**: < 1%

#### WebSocket 目標

- ✅ **連線成功率**: > 99%
- ✅ **P95 訊息延遲**: < 200ms
- ✅ **P99 訊息延遲**: < 500ms

### 執行性能測試

```bash
# 1. 啟動服務
pnpm dev

# 2. 執行 API 測試
pnpm test:performance

# 3. 執行 WebSocket 測試
pnpm test:performance:ws

# 4. 查看報告
artillery report artillery-report.json --output report.html
open report.html
```

### 自定義性能測試

編輯 `tests/performance/artillery-api.yml`:

```yaml
config:
  target: "http://localhost:8787"
  phases:
    - duration: 60
      arrivalRate: 10 # 調整負載
```

## CI/CD 整合

### GitHub Actions 工作流程

所有測試都已整合到 CI/CD 管道中：

```
┌─────────────────────────────────────┐
│   程式碼品質檢查                    │
│   - ESLint                          │
│   - TypeScript 檢查                 │
│   - Prettier 格式檢查               │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   單元測試 (並行)                   │
│   - Node.js 18, 20                  │
│   - 覆蓋率報告                      │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   Workers 測試                      │
│   - Cloudflare Workers              │
│   - D1 資料庫                       │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   E2E 測試 (並行)                   │
│   - Chromium, Firefox, WebKit       │
│   - 截圖和影片記錄                  │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   性能測試 (main/develop)           │
│   - REST API 負載測試               │
│   - WebSocket 負載測試              │
│   - Lighthouse CI                   │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   安全性測試                        │
│   - 依賴漏洞掃描                    │
│   - CodeQL 分析                     │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   部署 (測試通過後)                 │
│   - Staging: develop 分支           │
│   - Production: main 分支           │
└─────────────────────────────────────┘
```

### 觸發條件

- **每次 Push**: 程式碼品質、單元測試、Workers 測試
- **Pull Request**: 所有測試
- **Push 到 main**: 完整測試 + 性能測試 + 部署
- **Push 到 develop**: 完整測試 + 部署到 Staging

### 查看測試報告

1. 前往 GitHub Actions 頁面
2. 選擇工作流程執行
3. 下載測試報告 Artifacts：
   - `unit-test-results-node-*`
   - `playwright-report-*`
   - `performance-test-reports`

## 最佳實踐

### 1. 測試命名

```typescript
// ✅ 好的命名
test("應該在用戶登入成功後顯示儀表板", async () => {});

// ❌ 不好的命名
test("test1", async () => {});
```

### 2. 測試隔離

```typescript
// ✅ 每個測試獨立
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  // 登入設置
});

// ❌ 測試之間有依賴
test("test1", () => {
  /* 創建數據 */
});
test("test2", () => {
  /* 依賴 test1 的數據 */
});
```

### 3. 使用 Mock

```typescript
// ✅ Mock API 回應
await page.route("/api/v1/orders", async (route) => {
  await route.fulfill({
    status: 200,
    body: JSON.stringify(mockData),
  });
});

// ❌ 依賴真實 API
await page.goto("/orders"); // 可能失敗
```

### 4. 適當的等待

```typescript
// ✅ 等待特定元素
await page.waitForSelector('[data-testid="orders-list"]');

// ❌ 硬編碼延遲
await page.waitForTimeout(5000);
```

### 5. 清理資源

```typescript
test.afterEach(async ({ page }) => {
  // 清理測試數據
  await cleanupTestData();

  // 關閉連線
  await page.close();
});
```

## 故障排除

### 記憶體配置問題

**問題**: JavaScript heap out of memory

```bash
FATAL ERROR: Ineffective mark-compacts near heap limit
Allocation failed - JavaScript heap out of memory
```

**原因**:

- 測試套件過大 (MakanMakan 有 1,300+ 測試)
- Node.js 預設 heap size 不足
- 覆蓋率分析需要額外記憶體

**解決方案**:

已在 `package.json` 配置 4GB 記憶體限制:

```json
{
  "scripts": {
    "test": "cross-env NODE_OPTIONS='--max-old-space-size=4096' vitest",
    "test:coverage": "cross-env NODE_OPTIONS='--max-old-space-size=4096' vitest run --coverage"
  }
}
```

**記憶體分配建議**:

- 小型專案 (< 100 測試): 預設值
- 中型專案 (100-500 測試): 2GB (`2048`)
- 大型專案 (500-1000 測試): 4GB (`4096`)
- 超大型專案 (> 1000 測試): 8GB (`8192`)

### Vue 組件測試常見問題

#### 1. Icon Mock 配置錯誤

**問題**: Icon 組件無法解析

```bash
[Vue warn]: Failed to resolve component: UserIcon
No "UserIcon" export is defined on the "@heroicons/vue/24/outline" mock
```

**解決方案**: Icon mock 必須包含 `template` 屬性

```typescript
vi.mock("@heroicons/vue/24/outline", () => ({
  UserIcon: { name: "UserIcon", template: "<svg />" },
  ClockIcon: { name: "ClockIcon", template: "<svg />" },
  // ... 其他 icons
}));
```

#### 2. Pinia Store Mock 錯誤

**問題**: storeToRefs 無法讀取 value

```bash
TypeError: Cannot read properties of undefined (reading 'value')
```

**錯誤方法**: 使用 plain values mock

```typescript
// ❌ 錯誤
vi.mock("@/stores/settings", () => ({
  useSettingsStore: () => ({
    showEstimatedTime: false, // Plain value
  }),
}));
```

**正確方法**: 使用真實 Pinia store

```typescript
// ✅ 正確
import { createPinia, setActivePinia } from "pinia";

beforeEach(() => {
  const pinia = createPinia();
  setActivePinia(pinia);
});
```

#### 3. localStorage Mock 錯誤

**問題**: JSON.parse 錯誤

```bash
"undefined" is not valid JSON
```

**解決方案**: getItem() 必須返回 `null` (不是 `undefined`)

```typescript
const createLocalStorageMock = () => {
  const storage: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => storage[key] || null), // ✅ 返回 null
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    }),
    get length() {
      return Object.keys(storage).length;
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(storage);
      return keys[index] || null;
    }),
  };
};

beforeEach(() => {
  const mockLocalStorage = createLocalStorageMock();
  Object.defineProperty(global, "localStorage", {
    value: mockLocalStorage,
    writable: true,
  });
});
```

#### 4. 缺少必要的 Props

**問題**: Vue 警告缺少 props

```bash
[Vue warn]: Missing required prop: "statusType"
```

**解決方案**: 檢查組件定義,提供所有必要 props

```typescript
// ✅ 提供所有必要 props
mount(OrderCard, {
  props: {
    order: mockOrder,
    statusType: "pending", // Required prop
  },
});
```

### E2E 測試失敗

**問題**: 測試超時

```bash
Timeout exceeded while waiting for element
```

**解決方案**:

1. 檢查選擇器是否正確
2. 增加 timeout 設置
3. 使用 waitForLoadState('networkidle')

### 性能測試失敗

**問題**: 連線錯誤

```bash
Error: connect ECONNREFUSED
```

**解決方案**:

1. 確保服務正在運行
2. 檢查端口是否正確
3. 查看防火牆設置

### CI 測試失敗

**問題**: 測試在本地通過，但 CI 失敗

**解決方案**:

1. 檢查環境變數配置
2. 查看 CI 日誌詳細錯誤
3. 使用 `act` 工具本地運行 GitHub Actions

## 參考資源

- [Playwright 文檔](https://playwright.dev/)
- [Vitest 文檔](https://vitest.dev/)
- [Artillery 文檔](https://www.artillery.io/docs)
- [Testing Library](https://testing-library.com/)

## 貢獻

如需添加新測試或改進現有測試：

1. 遵循現有測試模式
2. 確保測試獨立可執行
3. 添加適當的文檔註釋
4. 更新本文檔

---

**最後更新**: 2025-11-17
**維護者**: MakanMakan Dev Team

## 最近更新

### 2025-11-17

- ✅ 新增記憶體配置問題解決方案 (4GB heap allocation)
- ✅ 新增 Vue 組件測試常見問題與修復 (Icon mock, Pinia store, localStorage)
- ✅ 完成 Kitchen Display 測試修復 (64/64 測試通過)
- ✅ 詳細文檔參考: [KITCHEN_DISPLAY_TEST_FIX_REPORT.md](../../KITCHEN_DISPLAY_TEST_FIX_REPORT.md)
