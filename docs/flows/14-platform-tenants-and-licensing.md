# 租戶與授權管理

> **對應 master board**：平台管理 → 租戶與授權管理
> **主要角色**：平台管理者（role 0）
> **最後對照原始碼**：2026-08-21

## 1. 定位

控制平面。租戶清單、資源配額、授權金鑰、部署與版本更新，全部住在
`apps/management-api`（`:8789`），與各店營運用的主 API 分開部署。

Management Portal（`:3010`）是它的前端。

## 2. 認證模型

管理 API **不吃**主 API 的 staff JWT。它自己一套：

| # | 動作 | 端點 |
| --- | --- | --- |
| 1 | 用平台管理員的 API token 換管理權杖 | `POST /auth/exchange` |
| 2 | 檢查 platform admin claim | `hasPlatformAdminClaim` |
| 3 | 簽發管理權杖 | TTL **1 小時**，`iss` / `aud` 為 `MANAGEMENT_JWT_ISSUER` / `AUDIENCE` |
| 4 | 之後每個請求帶 Bearer | `managementAuthMiddleware` |

兩個例外是**刻意公開**的：

- `POST /licenses/verify` — 獨立部署用 `tenantId` + `licenseKey` 自我認證，不可能持有管理權杖
- `POST /onboarding/applications` 與其查詢端點 — 申請人根本還沒有帳號

公開的 licenses 路由掛在受保護的 `/licenses/*` 區塊**之前**，靠註冊順序取勝。改動掛載順序會直接改掉授權邊界。

## 3. 租戶

| 動作 | 端點 |
| --- | --- |
| 列表／單筆 | `GET /tenants`、`GET /tenants/:id` |
| 建立 | `POST /tenants` |
| 修改 | `PATCH /tenants/:id` |
| 刪除 | `DELETE /tenants/:id` |
| 資源用量 | `GET /tenants/:id/resources` |

另有兩個**內部**端點供主 API 回寫：`POST /internal/platform-restaurants/:restaurantId/tenant`、
`PATCH /internal/platform-restaurants/:restaurantId/owner`。

## 4. 授權

| 動作 | 端點 | 認證 |
| --- | --- | --- |
| 產生金鑰 | `POST /licenses/generate` | Bearer |
| 驗證金鑰 | `POST /licenses/verify` | **公開**（payload 自我認證） |
| 查詢 | `GET /licenses/:tenantId` | Bearer |
| 續約 | `POST /licenses/:tenantId/renew` | Bearer |
| 升級 | `POST /licenses/:tenantId/upgrade` | Bearer |

產生金鑰時會同時寫 `licenses` 表與 `tenants.license_key` / `license_tier` / `license_expires_at`
兩個地方——**兩份資料要一致**，改動時兩邊都要更新。

## 5. 部署與版本

| 動作 | 端點 |
| --- | --- |
| 部署狀態／歷史 | `GET /deployments/:tenantId`、`/history` |
| 供應資源 | `POST /deployments/provision` |
| 部署 | `POST /deployments/deploy`（`deploymentType`：`initial` / `update` / `rollback`） |
| 回滾 | `POST /deployments/:tenantId/rollback` |
| 批次部署 | `POST /deployments/batch` |
| 遷移狀態 | `GET /deployments/:tenantId/migrations` |
| 版本清單／待更新 | `GET /updates/releases`、`/updates/pending` |
| 更新計畫 | `POST /updates/plans`、`/plans/:planId/execute`、`/progress`、`/cancel` |
| 全部更新 | `POST /updates/update-all` |

## 6. 健康與監控（控制平面視角）

| 動作 | 端點 |
| --- | --- |
| 全租戶健康 | `GET /health/tenants` |
| 單租戶健康 | `GET /health/tenants/:tenantId` |
| 租戶回報 | `POST /health/report` |
| 主動檢查 | `POST /health/check/:tenantId` |
| 平台總覽／時間軸／效能／告警／版本 | `GET /monitoring/overview`、`/health/timeline`、`/performance`、`/alerts`、`/versions` |

## 7. Edge cases 與失敗模式

| 情境 | 系統行為 | 風險 |
| --- | --- | --- |
| 用主 API 的 staff token 打管理 API | 401——兩套權杖的 `iss` / `aud` 不同 | 🟠 P1 |
| 管理權杖過期（1 小時） | 401，需重新 `POST /auth/exchange` | 🟡 P2 |
| 非 platform admin 的 token 去換管理權杖 | 401「Admin API token required」 | 🔴 P0 |
| 授權過期後獨立部署仍呼叫 `verify` | 由 `verify` 回傳過期狀態，由部署端自行處置 | 🟠 P1 |
| `licenses` 表與 `tenants` 欄位不同步 | 沒有一致性檢查，兩邊會各說各話 | 🟠 P1 |
| 批次部署部分失敗 | 逐租戶回報；沒有整批回滾 | 🟠 P1 |
| 刪除仍有營運資料的租戶 | `DELETE /tenants/:id` 只動控制平面；平台 DB 的餐廳資料不受影響 | 🔴 P0 |

## 8. 對應程式碼與測試

**程式碼**

- `apps/management-api/src/index.ts` — 掛載順序（公開 licenses 在受保護區塊之前）
- `apps/management-api/src/routes/auth.ts` — 權杖交換
- `apps/management-api/src/middleware/auth.ts` — `managementAuthMiddleware`、claim 檢查
- `apps/management-api/src/routes/tenants.ts`、`licenses.ts`、`deployments.ts`、`updates.ts`、`health.ts`
- `apps/management-api/src/services/TenantService.ts`、`ProvisioningService.ts`、`MigrationService.ts`、`VersionSyncService.ts`
- `apps/management-portal/src/` — 前端

**測試**

- `apps/management-api/src/services/TenantService.test.ts`、`VersionSyncService.test.ts`
- `tests/e2e/integration/real-workflows.spec.ts` — 健康、租戶列表／建立／明細、部署、授權、市集頁載入

## 9. 已知缺口

- **授權資料有兩份真相**（`licenses` 表與 `tenants` 欄位），沒有對帳。
- **刪除租戶不會清平台側資料**，語意上是「停止管理」而不是「移除」。
- **管理權杖沒有撤銷機制**。1 小時 TTL 就是唯一的收回手段（主 API 那邊有黑名單，這邊沒有）。
- 部署與更新的權限只有「是不是 platform admin」一級，沒有更細的分工。
