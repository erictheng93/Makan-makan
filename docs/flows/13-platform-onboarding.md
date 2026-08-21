# 入駐流程

> **對應 master board**：平台管理 → 入駐流程
> **主要角色**：申請人（無帳號）、平台管理者（role 0）
> **最後對照原始碼**：2026-08-21

## 1. 定位

一家新店從填表到能登入後台為止。這條流程**不在主 API**，而在
`apps/management-api`（`:8789`）——控制平面與各店營運 API 是分開部署的。

核准這個動作會一次跨兩個資料庫寫入：`MANAGEMENT_DB`（租戶）與 `PLATFORM DB`（餐廳與店主帳號）。

## 2. 觸發與前置條件

| 項目 | 內容 |
| --- | --- |
| 進入點 | Onboarding App `:3011`（公開）、Management Portal `:3010`（審核） |
| 認證 | 申請端**無需帳號**，靠 `X-Onboarding-Secret` 查詢自己的申請；審核端需管理者權杖 |
| 綁定 | management-api 需同時綁 `MANAGEMENT_DB` 與平台 D1 |

## 3. Happy path

| # | 動作 | 端點／程式 | 狀態 |
| --- | --- | --- | --- |
| 1 | 送出申請 | `POST /onboarding/applications` | → `submitted` |
| 2 | 自動配發 subdomain | `generateSubdomain` + 最多 5 次重試 | — |
| 3 | 發出 application secret | 只回給申請人一次，DB 存 hash | — |
| 4 | 申請人查詢進度 | `GET /onboarding/applications/:id` + `X-Onboarding-Secret` | — |
| 5 | 平台審核清單 | `GET /admin/onboarding/applications` | — |
| 6 | 核准 | `POST /admin/onboarding/applications/:id/approve` | → `provisioning` |
| 7 | 建立租戶與訂閱 | `createTenantWithSubscription` | 寫 `MANAGEMENT_DB` |
| 8 | 建立平台餐廳與店主帳號 | `createPlatformOwnerAccount` | 寫 `PLATFORM DB`：`restaurants`、`users`、`shop_subscriptions`、`password_reset_tokens` |
| 9 | 產生設定密碼連結 | `createCredentialDelivery` | — |
| 10 | 標記完成 | `UPDATE onboarding_applications SET status='completed'` | → `completed` |
| 11 | 寄出憑證 | `dispatchCredentialDelivery` | 失敗只標記，不回滾 |

駁回：`POST /admin/onboarding/applications/:id/reject` → `rejected`。

> **店主的初始密碼是「不可用密碼」。** `createPlatformOwnerAccount` 用
> `generateUnusablePassword()` 產生隨機字串再 bcrypt，真正的入口是設定密碼連結。
> 所以核准之後、店主點連結之前，那個帳號是登不進去的。

> **餐廳 id 必須是 UUID v7。** 註解寫得很明白：v4 的 owner id 會讓這個租戶的菜單圖片上傳直接壞掉。

## 4. 補償（rollback）

`activateApplication` 的 catch 會**反序**執行四步補償：

1. `rollbackCredentialDelivery`
2. `rollbackPlatformOwnerAccount`
3. `rollbackTenantProvisioning`
4. 把申請狀態改回 `submitted`

每一步都包在 `runRollbackStep` 裡，單一步驟失敗不會中斷其他步驟。

## 5. Edge cases 與失敗模式

| 情境 | 系統行為 | 錯誤碼 | 風險 |
| --- | --- | --- | --- |
| 重複核准已完成的申請 | 直接回既有結果（冪等） | — | 🔴 P0（已防） |
| 核准非 `submitted` 狀態的申請 | 「Cannot complete application with status: X」 | — | 🟠 P1 |
| subdomain 被佔用 | 產生建議清單；連續 5 次都撞則「Unable to generate an available subdomain」 | — | 🟡 P2 |
| 已 `rejected` / `completed` 的申請佔用的 subdomain | 不算佔用（查詢有排除這兩種狀態） | — | ⚪ P3 |
| 沒帶 `X-Onboarding-Secret` 查申請 | 401 | `APPLICATION_SECRET_REQUIRED` | 🟠 P1 |
| 建立店主帳號失敗 | 反序補償（見 §4），申請退回 `submitted` | — | 🔴 P0（已防） |
| 憑證寄送失敗 | **不回滾**，`credentialDelivery.status = failed` 並附錯誤訊息 | — | 🟠 P1 |
| 平台 DB binding 沒設定 | 「Platform DB binding is not configured」 | — | 🔴 P0 |
| 本機開發沒有套齊兩套 migration | 核准會失敗——management 的 0010–0012 與平台 `migrations_fresh` 都要套進同一個 local D1 | — | 🟡 P2 |

## 6. 對應程式碼與測試

**程式碼**

- `apps/management-api/src/routes/onboarding.ts` — 公開申請端點與 secret 驗證
- `apps/management-api/src/routes/admin-onboarding.ts` — 審核端點
- `apps/management-api/src/services/OnboardingService.ts:287` — 核准、供應、補償
- `apps/management-api/src/services/TenantService.ts`
- `apps/api/src/features/... `（平台端不參與，只被寫入）

**測試**

- `apps/management-api/src/__tests__/integration/onboarding-workflow.real.integration.test.ts`
- `apps/admin-dashboard/src/views/PlatformOnboardingApplicationsView.test.ts`
- `tests/e2e/integration/real-workflows.spec.ts` — 只涵蓋「送出申請」這一步

## 7. 已知缺口

- **憑證寄送失敗沒有重送機制**。狀態被標成 `failed` 之後只能人工處理。
- **跨兩個 D1 沒有交易**（D1 本來也沒有跨庫交易），一致性完全靠 §4 的補償。
- **瀏覽器端 E2E 只涵蓋申請提交**，核准與供應由 management-api 的整合測試覆蓋。
- 舊的 Cloudflare 驗證／完成流程已退役，只保留在歷史文件裡。
