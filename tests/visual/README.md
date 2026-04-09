# Visual Regression Tests

使用 Playwright 原生 `toHaveScreenshot()` 進行視覺回歸測試，涵蓋全部 5 個前端應用。

## ⚠️ 重要：Baseline 平台一致性

CI 在 `ubuntu-latest` 的 **Playwright 官方 Docker image**（`mcr.microsoft.com/playwright:v1.57.0-noble`）中執行視覺測試。字型、subpixel antialiasing、emoji 渲染在 macOS / Linux / Windows 之間**一定會有差異**，所以 baseline 必須在 Linux 環境產生。

Repo 裡**只允許 `*-linux.png`**。`.husky/pre-commit` 會自動拒絕 `*-darwin.png` / `*-win32.png` commit。

---

## 快速開始

```bash
# 1. 比對 baseline（不會修改任何檔案）
pnpm test:visual
```

這會在本地先 `pnpm dev` 啟動所有 app，再跑 Playwright 比對目前 repo 裡的 `*-linux.png`。**本地跑會 fail**，因為你的 Mac / Windows 字型和 Linux 不同 — 這是預期行為。

本地開發時驗證視覺變更的正確做法是透過 `./scripts/update-visual-baselines.sh`（見下節），而不是本地 `test:visual`。

---

## 更新 Baseline（有預期 UI 變更時）

**唯一正確方式**：在 Linux 容器中產生。

```bash
./scripts/update-visual-baselines.sh
```

這個 script 會：

1. Rsync source 到 `~/.cache/makan-visual-baselines/`（不含 `node_modules`，避免混合平台 native binary）
2. 拉取 pinned `mcr.microsoft.com/playwright:v1.57.0-noble` 映像檔（強制 `linux/amd64`）
3. 在容器內 `pnpm install` → `pnpm build` → 啟動 5 個 preview server
4. 執行 `npx playwright test --config playwright.visual.config.ts --update-snapshots`
5. 只把 `*-snapshots/` 目錄同步回 repo
6. 驗證沒有任何非 Linux baseline 殘留

**需求**：
- Docker Desktop 或 OrbStack 執行中
- 空閒的 3000 / 3001 / 3002 / 3010 / 3011 port（在容器內）
- 首次執行約 10–15 分鐘（下載 image + install + build），之後會快一些

完成後，務必 `git diff` 檢視變更後再 commit：

```bash
git status tests/visual
git add tests/visual
git commit -m "chore(test): update visual regression baselines"
```

---

## 測試結構

```
tests/visual/
├── helpers/
│   ├── visual-test-utils.ts      # 共用工具 (loginAs, waitForPageStable, mockAllAPIs)
│   └── design-system-checks.ts   # 設計系統合規性程式化檢查
├── admin-dashboard.visual.ts     # Admin Dashboard
├── customer-app.visual.ts        # Customer App
├── kitchen-display.visual.ts     # Kitchen Display
├── management-portal.visual.ts   # Management Portal
├── onboarding-app.visual.ts      # Onboarding App
├── design-system.visual.ts       # 設計系統合規檢查
└── *-snapshots/                  # Baseline screenshots (*-linux.png only)
```

## Viewports

每個頁面在 3 個 viewport 下截圖：

| Project | Device         | Viewport   |
| ------- | -------------- | ---------- |
| desktop | Desktop Chrome | 1440 × 900 |
| tablet  | Desktop Chrome | 768 × 1024 |
| mobile  | Desktop Chrome | 375 × 812  |

所有 project 都用 Chromium（跨瀏覽器渲染差異由 E2E tests 涵蓋）。

## App Port 對照

| App               | Port |
| ----------------- | ---- |
| Customer App      | 3000 |
| Admin Dashboard   | 3001 |
| Kitchen Display   | 3002 |
| Management Portal | 3010 |
| Onboarding App    | 3011 |

## 新增頁面

1. 在對應的 `*.visual.ts` 檔案中新增 test case
2. 執行 `./scripts/update-visual-baselines.sh` 在 Linux 產生 baseline
3. `git diff` 檢視新的 `*-linux.png`，確認內容符合預期
4. Commit

## 穩定化機制（已內建）

在 `playwright.visual.config.ts` 和 `tests/visual/helpers/visual-test-utils.ts` 中：

- `maxDiffPixelRatio: 0.01`、`threshold: 0.2`
- `animations: "disabled"`（Playwright native + CSS 注入）
- `document.fonts.ready` 等待
- `networkidle` 等待
- `Date.now()` 凍結為固定時間
- 所有動態內容（訂單時間、計數器）mock 為固定值
- 所有 API mock 為固定回應（見 `mockAllAPIs`）

## 設計系統合規檢查

`design-system.visual.ts` 會程式化驗證：

- 頁面背景色 = `#F2F2F7`
- 文字不使用純黑 `#000000`（應為 `#1C1C1E`）
- Card border-radius ≥ 16px（`rounded-2xl`）
- Shadow opacity ≤ 8%

## CI

- Job: `visual-regression-tests` in `.github/workflows/test.yml`
- 跑在 pinned `mcr.microsoft.com/playwright:v1.57.0-noble` container 裡
- 失敗時會上傳 `visual-regression-diffs` artifact（`test-results/`），包含 diff PNG
- **升級 Playwright 必須同步更新**：`package.json` 的 `@playwright/test` 版本 + workflow 的 image tag + `scripts/update-visual-baselines.sh` 的 `PLAYWRIGHT_VERSION`，並在同一個 PR 重新產生所有 baseline

## 疑難排解

**Q: 我本地跑 `pnpm test:visual` 大量失敗。**
A: 預期行為 — 你的 Mac / Windows 字型和 Linux baseline 不同。用 `./scripts/update-visual-baselines.sh` 驗證。

**Q: Pre-commit hook 拒絕我的 `*-darwin.png`。**
A: 刪掉它們（`find tests/visual -name '*-darwin.png' -delete`），改跑 `./scripts/update-visual-baselines.sh`。

**Q: Docker image 拉不動或 OrbStack 沒跑起來。**
A: 確認 `docker info` 正常回應；script 會在 preflight 階段就 fail-fast。

**Q: 我修改了 visual config 或 helpers，baseline 需要重做嗎？**
A: 如果改動影響渲染（viewport、animation、mock 資料），是；如果只是重構，不需要。
