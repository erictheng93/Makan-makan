# Testing Documentation / 測試文檔

測試框架、指南、工具和測試報告。

## 📂 文件夾結構

### 📚 Guides (`guides/`)

測試指南與最佳實踐

- `TESTING_GUIDE.md` - 測試指南總覽
- `AUTOMATION_TOOLS_GUIDE.md` - 自動化工具指南
- `TEST_DOCUMENTATION_GUIDE.md` - 測試文檔編寫指南
- `TRACKING_DASHBOARD_GUIDE.md` - 追蹤儀表板指南
- `VISUAL_REGRESSION_AND_SECURITY_TESTING_GUIDE.md` - 視覺回歸與安全測試

### 🏭 Factory Pattern (`factory-pattern/`)

測試數據工廠模式

- `FACTORY_BEST_PRACTICES.md` - 最佳實踐
- `FACTORY_CHAMPIONS_PROGRAM.md` - Champions 計劃
- `FACTORY_FAQ.md` - 常見問題
- `FACTORY_QUICK_REFERENCE.md` - 快速參考
- `PILOT_MIGRATION_PLAN.md` - 遷移計劃
- `examples/` - 範例代碼

### 📊 Reports (`reports/`)

測試執行報告

- E2E 測試進度
- 群組訂餐測試報告
- Mock DB 優化報告
- 測試增強報告
- 基礎設施完成報告

### 🗺️ Roadmaps (`roadmaps/`)

測試增強路線圖

---

## 🎯 測試策略

### 測試金字塔

```
         ┌─────────┐
         │   E2E   │  ← 少量 (關鍵流程)
         └─────────┘
       ┌─────────────┐
       │ Integration │  ← 適量 (API/服務)
       └─────────────┘
     ┌─────────────────┐
     │   Unit Tests    │  ← 大量 (函數/模組)
     └─────────────────┘
```

### 測試類型

| 類型                  | 工具                            | 覆蓋率目標    | 位置                               |
| --------------------- | ------------------------------- | ------------- | ---------------------------------- |
| **Unit**              | Vitest                          | 85%+          | `apps/**/*.test.ts`, `packages/**` |
| **Integration**       | Vitest + Mock D1 (SQLite mem)   | 70%+          | `**/__tests__/integration/**`      |
| **E2E**               | Playwright                      | 關鍵流程 100% | `tests/e2e/`（含 `journeys/`）     |
| **Visual Regression** | Playwright Screenshots          | 重點頁面      | `tests/visual/*.visual.ts`         |
| **Contract**          | Zod schema snapshot             | 所有 API 模組 | `apps/api/src/contracts/`          |
| **Security**          | Vitest + Worker mock            | WAF / RBAC    | `tests/security/`                  |
| **Performance**       | Artillery (load / soak / spike) | 所有 API      | `tests/performance/`               |

---

## 🚀 快速開始

### 運行測試

```bash
# 所有 Vitest 測試（unit + integration）
pnpm test

# 單元測試
pnpm test:unit

# E2E 測試（Playwright）
pnpm test:e2e
pnpm test:e2e:ui          # Playwright UI 模式

# CI 管線（unit + e2e）
pnpm test:ci

# 視覺回歸測試
pnpm test:visual
pnpm test:visual:update   # 更新基線快照

# 覆蓋率報告
pnpm test:coverage

# API Contract 檢查
pnpm contract:check
pnpm contract:update
```

### 使用 Factory Pattern（`@makanmasak/testing-utils`）

```typescript
import {
  userFactory,
  restaurantFactory,
  orderFactory,
  envFactory,
  resetAllFactories,
} from "@makanmasak/testing-utils";

beforeEach(() => {
  resetAllFactories();
});

const restaurant = restaurantFactory.build();
const owner = userFactory.buildShopOwner(restaurant.id, {
  overrides: { id: "01HZ..." }, // UUID v7 string
});
const env = envFactory.build();
```

可用 factory：`userFactory`、`restaurantFactory`、`categoryFactory`、
`menuItemFactory`、`orderFactory`、`orderItemFactory`、`envFactory`、
`printJobFactory`、`printerDeviceFactory`、`printRequestFactory`、
`realtimeAuthFactory`。完整 API 見 `packages/testing-utils/src/factories/`。

---

## 📖 測試撰寫規範（強制 — 見 `CLAUDE.md` → Testing Standards）

新增測試必須遵守以下四條規則，舊測試以漸進方式遷移：

1. **使用 `@makanmasak/testing-utils` 的 factory** — 禁止手寫 mock 物件；`beforeEach` 呼叫 `resetAllFactories()`。
2. **驗證 mock 呼叫，不只驗證回傳值** — 每個 `vi.fn()` 必須有 `toHaveBeenCalledWith(...)` 檢查；用 `expect.objectContaining()` 做結構比對，禁止精確比對 timestamp / UUID 等非確定性欄位。
3. **禁止斷言 CSS class** — 改以 `data-testid`、`data-status`、`aria-*`、文字內容或 Vue computed 狀態驗證行為。
4. **Pre-commit 檢查** — `scripts/check-factory-usage.cjs` 透過 lint-staged 在所有 `*.test.ts` 上執行，會警告缺少 factory、CSS class 斷言、以及未驗證的 mock。

### 編寫測試時

1. **描述清晰**: 使用 `describe` 和 `it` 清楚描述測試場景
2. **AAA 模式**: Arrange（準備）→ Act（執行）→ Assert（斷言）
3. **Factory 優先**: 使用 Factory Pattern 創建測試數據
4. **Mock 外部服務**: 隔離測試，提高速度

### 測試命名規範

```typescript
describe("PartnershipService", () => {
  describe("createPartnership", () => {
    it("should create partnership with valid data", async () => {
      // Test implementation
    });

    it("should reject invalid email domain", async () => {
      // Test implementation
    });
  });
});
```

---

## 🔗 相關文檔

- **測試規範總覽**：`CLAUDE.md` → Testing Standards (Enforced)
- **測試指南**：[`guides/TESTING_GUIDE.md`](./guides/TESTING_GUIDE.md)
- **Factory 最佳實踐**：[`factory-pattern/FACTORY_BEST_PRACTICES.md`](./factory-pattern/FACTORY_BEST_PRACTICES.md)
- **進度追蹤**：[`TEST_PROGRESS.md`](./TEST_PROGRESS.md)
- **API 測試**：`docs/api/`
- **性能測試**：`docs/performance/`

---

**最後更新**: 2026-04-13
**測試覆蓋率**: 85%+ (核心模組)
**測試框架**: Vitest, Playwright, Artillery
