# MakanMakan 測試套件

## 📁 目錄結構

```
tests/
├── unit/                    # 單元測試
│   ├── components/          # Vue 組件測試
│   ├── stores/             # Pinia store 測試
│   ├── services/           # API 服務測試
│   ├── utils/              # 工具函數測試
│   └── workers/            # Cloudflare Worker 測試
├── e2e/                    # 端到端測試
│   ├── specs/              # 測試規格
│   ├── support/            # 測試輔助函數
│   ├── global-setup.ts     # 全域設置
│   └── global-teardown.ts  # 全域清理
├── integration/            # 整合測試
│   ├── api/                # API 整合測試
│   └── database/           # 資料庫測試
├── fixtures/               # 測試資料
│   ├── test-data.json      # 測試資料集
│   └── images/             # 測試圖片
├── __mocks__/              # Mock 檔案
├── setup.ts                # 測試環境設置
└── README.md               # 本檔案
```

## 🚀 快速開始

### 安裝依賴

```bash
pnpm install
```

### 執行測試

```bash
# 執行所有測試
pnpm test

# 執行單元測試
pnpm run test:unit

# 執行 E2E 測試
pnpm run test:e2e

# 執行測試並產生覆蓋率報告
pnpm run test:coverage

# 監控模式執行測試
pnpm run test:watch
```

### 執行特定測試

```bash
# 執行特定檔案的測試
npx vitest tests/unit/components/MenuItemCard.test.ts

# 執行特定測試套件
npx vitest --grep "購物車"

# 執行特定的 E2E 測試
npx playwright test tests/e2e/specs/ordering-flow.spec.ts
```

## 🧪 測試類型說明

### 單元測試 (Unit Tests)

- **目的**: 測試個別組件、函數的功能
- **框架**: Vitest + Vue Test Utils
- **執行速度**: 快速 (< 10ms per test)
- **覆蓋範圍**: 組件邏輯、工具函數、API 服務

### 整合測試 (Integration Tests)

- **目的**: 測試模組間的互動
- **框架**: Vitest + Miniflare
- **執行速度**: 中等 (< 100ms per test)
- **覆蓋範圍**: API 端點、資料庫操作、Worker 整合

### 端到端測試 (E2E Tests)

- **目的**: 測試完整的用戶流程
- **框架**: Playwright
- **執行速度**: 較慢 (1-10s per test)
- **覆蓋範圍**: 用戶互動、跨瀏覽器相容性

## 📊 測試覆蓋率目標

- **整體覆蓋率**: ≥ 80%
- **關鍵組件**: ≥ 90%
- **工具函數**: ≥ 95%
- **API 端點**: ≥ 85%

## 🎯 測試策略

### 1. 測試金字塔原則

```
     E2E Tests (少量, 高價值)
    /           \
   Integration Tests (中量)
  /                        \
Unit Tests (大量, 快速, 廉價)
```

### 2. 測試命名規範

- **檔案名稱**: `ComponentName.test.ts`
- **測試描述**: 使用中文，清楚說明測試目的
- **分組**: 使用 `describe` 按功能分組

### 3. 測試資料管理

- 使用 `tests/fixtures/test-data.json` 統一管理測試資料
- 測試間相互隔離，不共享狀態
- 使用 Factory Pattern 建立測試物件

## 🔧 配置檔案說明

### vitest.config.ts

- Vitest 單元測試配置
- 包含路徑別名、覆蓋率設定
- Mock 配置和環境變數

### playwright.config.ts

- Playwright E2E 測試配置
- 多瀏覽器支援設定
- 測試伺服器配置

### tests/setup.ts

- 全域測試環境設置
- Mock 物件定義
- Vue Test Utils 配置

## 🛠️ 常用 Mock 物件

### API Mock

```typescript
vi.mock("@/services/api", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
```

### LocalStorage Mock

```typescript
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(() => null),
    removeItem: vi.fn(() => null),
    clear: vi.fn(() => null),
  },
});
```

### Router Mock

```typescript
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
};
```

## 🎭 E2E 測試輔助工具

### OrderingHelper

提供點餐流程相關的輔助方法：

- `addItemToCart()`: 添加商品到購物車
- `fillCustomerInfo()`: 填寫顧客資訊
- `submitOrder()`: 提交訂單

### AdminHelper

提供管理後台相關的輔助方法：

- `login()`: 管理員登入
- `addMenuItem()`: 新增菜品
- `updateOrderStatus()`: 更新訂單狀態

### TestDataGenerator

提供測試資料生成方法：

- `generateOrderData()`: 生成測試訂單
- `generateMenuItemData()`: 生成測試菜品

## 📱 跨裝置測試

### 支援的瀏覽器

- **Desktop**: Chrome, Firefox, Safari
- **Mobile**: Chrome (Android), Safari (iOS)
- **Tablet**: iPad Pro

### 響應式測試

```typescript
// 設定手機視窗
await page.setViewportSize({ width: 375, height: 667 });

// 設定平板視窗
await page.setViewportSize({ width: 768, height: 1024 });
```

## 🚨 錯誤處理測試

### 網路錯誤模擬

```typescript
// 模擬 API 錯誤
await page.route("**/api/v1/orders", (route) => {
  route.abort("failed");
});

// 模擬慢速網路
await page.route("**/*", (route) => {
  setTimeout(() => route.continue(), 2000);
});
```

### 錯誤狀態測試

- 網路連線異常
- API 回傳錯誤
- 表單驗證錯誤
- 商品庫存不足

## 🔄 CI/CD 整合

### GitHub Actions

測試流程會在以下情況自動執行：

- Push to `main` or `develop` branch
- Pull Request 建立或更新
- 手動觸發

### 測試階段

1. **程式碼檢查**: ESLint + Prettier + TypeScript
2. **單元測試**: Vitest 執行所有單元測試
3. **Workers 測試**: 測試 Cloudflare Workers
4. **E2E 測試**: 多瀏覽器端到端測試
5. **覆蓋率報告**: 上傳到 Codecov

## 📈 效能測試

### 載入時間基準

- 頁面載入: < 3s
- API 回應: < 1s
- 圖片載入: < 2s

### Lighthouse CI

- 效能分數: ≥ 90
- 可訪問性: ≥ 95
- 最佳實踐: ≥ 90
- SEO: ≥ 90

## 🐛 測試除錯

### 除錯工具

```bash
# 開啟 Playwright 的 UI 模式
pnpm run test:e2e:ui

# 產生測試報告
npx playwright show-report

# 檢視測試覆蓋率
open coverage/index.html
```

### 常見問題

1. **測試逾時**: 增加 `timeout` 設定
2. **元素找不到**: 檢查 `data-testid` 屬性
3. **異步操作**: 使用 `await` 等待完成
4. **Mock 不生效**: 確認 Mock 設定順序

## 📚 學習資源

- [Vitest 官方文檔](https://vitest.dev/)
- [Playwright 官方文檔](https://playwright.dev/)
- [Vue Test Utils](https://vue-test-utils.vuejs.org/)
- [Testing Library](https://testing-library.com/)

## 🤝 貢獻指南

### 新增測試時請注意：

1. 遵循現有的測試結構和命名規範
2. 確保測試案例互相獨立
3. 添加適當的文檔說明
4. 更新相關的 Mock 資料

### 測試審查清單：

- [ ] 測試覆蓋了主要功能路徑
- [ ] 包含錯誤情況處理
- [ ] 測試描述清楚易懂
- [ ] 沒有硬編碼的測試資料
- [ ] 測試執行速度合理

---

如有任何測試相關問題，請參考 [測試指南文檔](../docs/testing-guide.md) 或聯繫開發團隊。
