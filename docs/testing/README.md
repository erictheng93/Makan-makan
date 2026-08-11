# Testing Documentation / 測試文檔

測試框架、指南、工具和測試報告。

## 📂 文件夾結構

### 📚 Guides (`guides/`)

測試指南與最佳實踐

- `TESTING_GUIDE.md` - 測試指南總覽
- `TEST_DOCUMENTATION_GUIDE.md` - 測試文檔編寫指南
- `VISUAL_REGRESSION_AND_SECURITY_TESTING_GUIDE.md` - 視覺回歸與安全測試（2026-07-05：視覺回歸部分目前無實際測試檔，見文件內橫幅）

> ⚠️ **2026-07-05 移除**：`AUTOMATION_TOOLS_GUIDE.md`、`TRACKING_DASHBOARD_GUIDE.md`，
> 以及整個 `factory-pattern/` 資料夾已移至
> `docs/archive/deprecated/factory-pattern/`——它們全部建立在不存在的
> `@makanmasak/testing-utils` 套件之上，與 `CLAUDE.md` 現行 Testing
> Standards（builder 應就近放在測試檔旁，不要 import 該套件）直接矛盾。
> 詳見下方「測試撰寫規範」章節的更正內容。

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
| **E2E**               | Playwright                      | 關鍵流程 100% | `tests/e2e/{smoke,integration,kitchen-display,ci-smoke}/`（`journeys/`/`admin/` 已於 2026-05-25 移除重建） |
| **Visual Regression** | Playwright Screenshots          | 重點頁面      | `tests/visual/*.visual.ts`（⚠️ 目錄目前為空，見 `VISUAL_REGRESSION_AND_SECURITY_TESTING_GUIDE.md`） |
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

### 建立測試數據（就近放在測試檔旁，不要 import 不存在的套件）

> ⚠️ **更正（2026-07-05）**：下方原先示範 import `@makanmasak/testing-utils`
> 的 factory——**這個套件不存在於本 repo 中**（`packages/` 沒有
> `testing-utils`），與本節上方示範直接矛盾。現行規範（見 `CLAUDE.md` →
> Testing Standards）是把 builder 函式就近放在擁有它的測試檔旁，或放在
> 現有的 local test helper 中，**不要** import 不存在的
> `@makanmasak/testing-utils`。

```typescript
// 就近放在測試檔旁的 local builder，不是共用套件
function buildUser(overrides = {}) {
  return { id: 1, role: 1, restaurantId: "rest-1", ...overrides };
}
```

---

## 📖 測試撰寫規範（強制 — 見 `CLAUDE.md` → Testing Standards）

新增測試必須遵守以下規則，舊測試以漸進方式遷移：

1. **優先使用就近放置的 local test builder/helper**（見上方範例）— 不要 import `@makanmasak/testing-utils`，該套件不存在。
2. **驗證 mock 呼叫，不只驗證回傳值** — 每個 `vi.fn()` 必須有 `toHaveBeenCalledWith(...)` 檢查；用 `expect.objectContaining()` 做結構比對，禁止精確比對 timestamp / UUID 等非確定性欄位。
3. **禁止斷言 CSS class** — 改以 `data-testid`、`data-status`、`aria-*`、文字內容或 Vue computed 狀態驗證行為。
4. **Pre-commit 檢查** — lint-staged 目前只執行 ESLint 與 Prettier；並**沒有** `scripts/check-factory-usage.cjs` 這個 gate（該腳本不存在，先前引用它的 CI workflow 已移除）。

### 編寫測試時

1. **描述清晰**: 使用 `describe` 和 `it` 清楚描述測試場景
2. **AAA 模式**: Arrange（準備）→ Act（執行）→ Assert（斷言）
3. **Builder 優先**: 使用就近放置的 local builder 創建測試數據
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
- **核心工作流程對照表（權威來源）**：[`CORE_WORKFLOW_TEST_MATRIX.md`](./CORE_WORKFLOW_TEST_MATRIX.md)
- **進度追蹤**：[`TEST_PROGRESS.md`](./TEST_PROGRESS.md)（2026-07-05：內含多處過時內容，見該文件頂部更正）
- **API 測試**：`docs/api/`
- **性能測試**：`docs/performance/`

---

**最後更新**: 2026-07-05
**測試框架**: Vitest, Playwright, Artillery
