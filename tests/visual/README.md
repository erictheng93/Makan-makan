# Visual Regression Tests

使用 Playwright 原生 `toHaveScreenshot()` 進行視覺回歸測試，涵蓋全部 5 個前端應用。

## 快速開始

```bash
# 啟動所有前端 dev server（需要 API 不需啟動，所有 API 都被 mock）
pnpm dev

# 首次執行：產生 baseline screenshots
pnpm test:visual:update

# 後續執行：比對 screenshots
pnpm test:visual
```

## 測試結構

```
tests/visual/
├── helpers/
│   ├── visual-test-utils.ts      # 共用工具（loginAs, waitForPageStable, mockAllAPIs）
│   └── design-system-checks.ts   # 設計系統合規性程式化檢查
├── admin-dashboard.visual.ts     # Admin Dashboard (10 tests)
├── customer-app.visual.ts        # Customer App (8 tests)
├── kitchen-display.visual.ts     # Kitchen Display (4 tests)
├── management-portal.visual.ts   # Management Portal (4 tests)
├── onboarding-app.visual.ts      # Onboarding App (4 tests)
├── design-system.visual.ts       # 設計系統合規檢查 (5 tests)
└── __screenshots__/              # Baseline screenshots（需 commit）
```

## Viewports

每個頁面在 3 個 viewport 下截圖：

| Project | Device         | Width x Height |
| ------- | -------------- | -------------- |
| desktop | Desktop Chrome | 1440 x 900     |
| tablet  | iPad (gen 7)   | 768 x 1024     |
| mobile  | iPhone 12      | 375 x 812      |

## App Port 對照

| App               | Port |
| ----------------- | ---- |
| Customer App      | 3000 |
| Admin Dashboard   | 3001 |
| Kitchen Display   | 3002 |
| Management Portal | 3010 |
| Onboarding App    | 3011 |

## 更新 Baselines

當 UI 有**預期的變更**時，更新 baseline：

```bash
pnpm test:visual:update
```

更新後務必檢查 diff 確認變更是預期的，然後 commit `__screenshots__/` 目錄。

## 新增頁面

1. 在對應的 `*.visual.ts` 檔案中新增 test
2. 執行 `pnpm test:visual:update` 產生新的 baseline
3. Commit 新的 screenshot 檔案

## 設計系統合規檢查

`design-system.visual.ts` 會程式化驗證：

- 頁面背景色 = `#F2F2F7`
- 文字不使用純黑 `#000000`（應為 `#1C1C1E`）
- Card border-radius ≥ 16px (`rounded-2xl`)
- Shadow opacity ≤ 8%

## CI

視覺回歸測試在 GitHub Actions 的 `visual-regression-tests` job 中自動執行。失敗時會上傳 screenshot diffs 作為 artifacts。

## 注意事項

- Baseline 應在 CI (Linux) 環境產生，避免 macOS/Linux 字型渲染差異
- 所有 API 都被 mock，不需要後端服務
- 動畫和 transition 在截圖時自動停用
