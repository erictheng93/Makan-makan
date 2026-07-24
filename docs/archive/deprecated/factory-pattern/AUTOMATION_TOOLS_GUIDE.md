> ⚠️ **SUPERSEDED (2026-07-05)**: This guide describes tooling
> (`pnpm run factory:check`, `factory:badges`, `factory:report`,
> `factory:usage`, `scripts/check-factory-usage.cjs`, an ESLint
> `testing-utils` plugin) built entirely around the `@makanmakan/testing-utils`
> package — which does not exist anywhere in this repo. None of the npm
> scripts referenced here exist in `package.json`. The one CI workflow that
> tried to run this check (`factory-usage-check.yml`) called a script that
> didn't exist and silently no-op'd on every PR; it has been removed. See
> `docs/archive/deprecated/factory-pattern/` for the related factory-pattern
> docs this tooling was meant to support, and root `CLAUDE.md`'s Testing
> Standards section for the actual current guidance. Kept for historical
> context only.

# 自動化檢查工具使用指南

> 🤖 確保 factory 正確使用的自動化工具集

---

## 📋 目錄

1. [快速開始](#快速開始)
2. [檢查工具](#檢查工具)
3. [Pre-commit Hooks](#pre-commit-hooks)
4. [CI/CD 集成](#cicd-集成)
5. [徽章系統](#徽章系統)
6. [ESLint 規則](#eslint-規則)
7. [常見問題](#常見問題)

---

## 快速開始

### 安裝依賴

```bash
# 安裝 husky 和 lint-staged
pnpm add -D husky lint-staged

# 初始化 husky
pnpm run prepare
```

### 運行檢查

```bash
# 檢查所有測試文件
pnpm run factory:check

# 查看徽章排行榜
pnpm run factory:badges
```

---

## 檢查工具

### factory:check

**用途**：掃描所有測試文件，檢查 factory 使用是否正確。

#### 基本使用

```bash
# 標準檢查（控制台輸出）
pnpm run factory:check

# GitHub Actions 格式（CI 環境）
pnpm run factory:check:ci
```

#### 輸出格式

##### 控制台格式（默認）

```
📊 Factory 使用檢查報告
═══════════════════════════════════════

📈 摘要
   總文件數: 45
   ❌ 錯誤: 3 (3 個文件)
   ⚠️  警告: 8 (8 個文件)

❌ 錯誤詳情
───────────────────────────────────────

1. apps/api/src/features/users/__tests__/service.test.ts
   規則: missing-reset
   訊息: 使用 factory 但缺少 resetAllFactories()

2. apps/api/src/features/menu/__tests__/feature.test.ts
   規則: missing-factory-import
   訊息: 使用 factory 方法但沒有導入

⚠️  警告詳情（前 10 項）
───────────────────────────────────────

1. apps/api/src/features/orders/__tests__/legacy.test.ts
   規則: manual-data-creation
   訊息: 手動創建測試數據，建議使用 factory

💡 建議
───────────────────────────────────────
❌ 發現 3 個錯誤，必須修復：
   1. 為使用 factory 的測試添加 resetAllFactories()
   2. 確保正確導入 @makanmakan/testing-utils

⚠️  發現 8 個警告，建議處理：
   1. 考慮使用 factory 替代手動數據創建
   2. 拆分過大的測試文件
   3. 參考文檔：docs/testing/FACTORY_QUICK_REFERENCE.md
```

##### GitHub Actions 格式

```bash
# 設置環境變量
OUTPUT_FORMAT=github pnpm run factory:check

# 輸出格式
::error file=apps/api/src/features/users/__tests__/service.test.ts::使用 factory 但缺少 resetAllFactories() (missing-reset)
::warning file=apps/api/src/features/orders/__tests__/legacy.test.ts::手動創建測試數據，建議使用 factory (manual-data-creation)
```

#### 環境變量

```bash
# 輸出格式：console | json | github
OUTPUT_FORMAT=console pnpm run factory:check

# 錯誤時退出（阻塞構建）
FAIL_ON_ERROR=true pnpm run factory:check

# 警告時退出
FAIL_ON_WARNING=true pnpm run factory:check
```

#### 檢查規則

##### 錯誤級別（必須修復）

| 規則 ID                  | 說明                                    | 修復方法                                 |
| ------------------------ | --------------------------------------- | ---------------------------------------- |
| `missing-reset`          | 使用 factory 但缺少 resetAllFactories() | 在 beforeEach 中添加 resetAllFactories() |
| `missing-factory-import` | 使用 factory 方法但沒有導入             | 添加 import 語句                         |

##### 警告級別（建議修復）

| 規則 ID                | 說明                     | 建議                        |
| ---------------------- | ------------------------ | --------------------------- |
| `manual-data-creation` | 手動創建測試數據         | 使用 factory 替代           |
| `large-test-file`      | 測試文件過大（> 500 行） | 拆分文件或使用 factory 簡化 |

---

## Pre-commit Hooks

### 配置

Pre-commit hooks 會在 `git commit` 時自動運行檢查。

#### .husky/pre-commit

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# 運行 lint-staged 檢查
pnpm lint-staged

# Factory 使用快速檢查
if git diff --cached --name-only | grep -E '\.test\.ts$' > /dev/null; then
  echo "🧪 檢查測試文件 factory 使用..."
  # 檢查邏輯...
fi
```

#### package.json 配置

```json
{
  "lint-staged": {
    "**/*.test.ts": ["node scripts/check-factory-usage.js"],
    "**/*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"]
  }
}
```

### 工作流程

```
┌────────────────────────────────────────┐
│ 開發者提交代碼                         │
└────────────────┬───────────────────────┘
                 ↓
┌────────────────────────────────────────┐
│ git commit                             │
└────────────────┬───────────────────────┘
                 ↓
┌────────────────────────────────────────┐
│ Husky 觸發 pre-commit hook             │
└────────────────┬───────────────────────┘
                 ↓
┌────────────────────────────────────────┐
│ lint-staged 運行檢查                   │
├────────────────────────────────────────┤
│ 1. 檢查測試文件 factory 使用           │
│ 2. ESLint 修復                         │
│ 3. Prettier 格式化                     │
└────────────────┬───────────────────────┘
                 ↓
         ┌───────┴───────┐
         ↓               ↓
    ✅ 通過          ❌ 失敗
         ↓               ↓
   提交成功      顯示錯誤訊息
                 要求修復
```

### 繞過檢查（緊急情況）

```bash
# 不建議，但在緊急情況下可以使用
git commit --no-verify -m "緊急修復"
```

---

## CI/CD 集成

### GitHub Actions

#### 配置文件

`.github/workflows/factory-usage-check.yml`

```yaml
name: Factory Usage Check

on:
  pull_request:
    paths:
      - "**/__tests__/**"
      - "**/*.test.ts"

jobs:
  check-factory-usage:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: 運行檢查
        run: OUTPUT_FORMAT=github node scripts/check-factory-usage.js
```

#### PR 評論

檢查工具會自動在 PR 中評論：

```markdown
## 🧪 Factory 使用檢查報告

### ❌ 發現 2 個錯誤

這些錯誤**必須修復**才能確保測試數據一致性：

1. 為使用 factory 的測試添加 `resetAllFactories()`
2. 確保正確導入 `@makanmakan/testing-utils`

**修復範例**：
\`\`\`typescript
import { userFactory, resetAllFactories } from "@makanmakan/testing-utils"

describe("Test Suite", () => {
beforeEach(() => {
resetAllFactories() // 添加這一行
})
})
\`\`\`

---

_這是自動檢查，不會阻塞 PR 合併。但建議盡快修復問題。_
```

#### 自動標籤

- `needs-factory-fix` - 有錯誤需要修復
- `testing-improvement-suggested` - 有警告建議處理

---

## 徽章系統

### 什麼是徽章系統？

徽章系統是一個遊戲化激勵機制，鼓勵團隊成員正確使用 factory。

### 徽章等級

```
🥉 青銅級 → 🥈 銀級 → 🥇 金級 → 🏆 傳奇級
```

### 所有徽章

#### 🥉 青銅級徽章

- 🌱 **第一步**: 首次在測試中使用 factory
- 🔄 **重置大師**: 所有使用 factory 的測試都正確調用 resetAllFactories

#### 🥈 銀級徽章

- 🚀 **早期採用者**: 在試點階段就開始使用 factory
- 📦 **遷移專家**: 成功遷移 5 個以上的測試文件
- 🏗️ **測試構建者**: 使用 buildCompleteRestaurantData 創建複雜測試場景

#### 🥇 金級徽章

- 👑 **Factory 冠軍**: 成為 Factory Champion，幫助其他人使用 factory
- 💎 **完美主義者**: 遷移 10 個以上的測試文件，且所有文件都完美無誤
- 🎖️ **團隊領袖**: 幫助至少 3 位團隊成員成功使用 factory

#### 🏆 傳奇徽章

- 🏆 **Factory 傳奇**: 獲得所有其他徽章

### 使用方法

```bash
# 生成徽章報告和排行榜
pnpm run factory:badges
```

#### 輸出範例

```
🏆 Factory 徽章系統

📊 分析開發者使用情況...
🎖️  授予徽章...

🎉 Alice 獲得新徽章: 🌱 第一步
🎉 Alice 獲得新徽章: 🔄 重置大師
🎉 Bob 獲得新徽章: 📦 遷移專家

📝 生成排行榜...
✅ 徽章報告已生成: reports/factory-badges.md

🥇 前 5 名:
   1. Alice - 35 分 🌱 🔄 🚀
   2. Bob - 25 分 📦
   3. Charlie - 10 分 🌱
```

### 排行榜

查看 `reports/factory-badges.md`：

```markdown
# 🏆 Factory 徽章系統排行榜

## 🥇 排行榜

| 排名 | 開發者  | 分數 | 徽章     | 文件數 |
| ---- | ------- | ---- | -------- | ------ |
| 1    | Alice   | 35   | 🌱 🔄 🚀 | 8      |
| 2    | Bob     | 25   | 📦       | 5      |
| 3    | Charlie | 10   | 🌱       | 2      |
```

### 分數計算

- 🥉 青銅級：10 分
- 🥈 銀級：25 分
- 🥇 金級：50 分
- 🏆 傳奇級：100 分

---

## ESLint 規則

### 可用規則

#### enforce-factory-reset

**用途**：強制在使用 factory 的測試文件中調用 resetAllFactories()

**級別**：error（錯誤）

**自動修復**：是

```typescript
// ❌ 錯誤
import { userFactory } from "@makanmakan/testing-utils";

describe("Test", () => {
  it("should work", () => {
    const user = userFactory.build();
  });
});

// ✅ 正確
import { userFactory, resetAllFactories } from "@makanmakan/testing-utils";

describe("Test", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  it("should work", () => {
    const user = userFactory.build();
  });
});
```

#### prefer-factory-over-manual

**用途**：建議使用 factory 而非手動創建測試數據

**級別**：warn（警告）

**自動修復**：否

```typescript
// ⚠️ 警告
const user = {
  id: 1,
  username: "testuser",
  role: "ADMIN",
  email: "test@example.com",
  fullName: "Test User",
};

// ✅ 建議
const user = userFactory.buildAdmin();
```

### 配置

在 `.eslintrc.cjs` 中配置：

```javascript
module.exports = {
  plugins: ["testing-utils"],
  rules: {
    "testing-utils/enforce-factory-reset": "error",
    "testing-utils/prefer-factory-over-manual": "warn",
  },
};
```

---

## 常見問題

### Q1: 檢查工具太慢怎麼辦？

**A**: 只檢查變更的文件：

```bash
# 只檢查已暫存的文件
git diff --cached --name-only | grep '.test.ts$' | xargs node scripts/check-factory-usage.js
```

### Q2: 如何跳過某個文件的檢查？

**A**: 在文件頂部添加註釋：

```typescript
/* eslint-disable testing-utils/enforce-factory-reset */

// 測試代碼...
```

### Q3: Pre-commit hook 失敗了怎麼辦？

**A**: 按照提示修復錯誤：

1. 查看錯誤訊息
2. 修復代碼
3. 重新提交

緊急情況可以使用 `--no-verify` 繞過。

### Q4: 如何手動授予徽章？

**A**: 編輯 `reports/factory-badges.json`：

```json
{
  "developers": {
    "Alice": {
      "badges": ["first-step", "reset-master", "factory-champion"],
      "stats": {...}
    }
  }
}
```

### Q5: CI 檢查失敗會阻塞 PR 嗎？

**A**: 默認不會阻塞，只會添加評論和標籤。如需阻塞：

```yaml
- name: 運行檢查
  run: FAIL_ON_ERROR=true pnpm run factory:check:ci
```

---

## 📊 工具對比

| 工具            | 執行時機   | 阻塞性 | 用途       |
| --------------- | ---------- | ------ | ---------- |
| factory:check   | 手動/CI    | 可選   | 完整檢查   |
| Pre-commit hook | Git commit | 是     | 快速檢查   |
| GitHub Actions  | PR 提交    | 否     | 自動評論   |
| ESLint 規則     | 編輯時     | 否     | 即時反饋   |
| factory:badges  | 手動       | 否     | 遊戲化激勵 |

---

## 🔗 相關資源

- [Factory 快速參考](./FACTORY_QUICK_REFERENCE.md)
- [追蹤儀表板指南](./TRACKING_DASHBOARD_GUIDE.md)
- [FAQ](./FACTORY_FAQ.md)

---

**最後更新**: 2025-11-15
**版本**: 1.0.0
**維護者**: MakanMakan Testing Team
