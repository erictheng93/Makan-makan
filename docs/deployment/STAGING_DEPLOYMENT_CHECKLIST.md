# Staging 環境部署清單

> 本文檔說明如何將 MakanMasak 即時服務部署到 Cloudflare Staging 環境

## 部署架構

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Staging 環境架構                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐      ┌─────────────────┐                      │
│  │ makanmasak-api- │      │ makanmasak-     │                      │
│  │ staging         │◄────►│ realtime-staging│                      │
│  │ (Cloudflare     │      │ (Durable Objects)                      │
│  │  Worker)        │      │                 │                      │
│  └────────┬────────┘      └────────┬────────┘                      │
│           │                        │                                │
│           ▼                        ▼                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Cloudflare Resources                       │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ D1: makanmasak-staging                                       │   │
│  │ KV: CACHE_KV / RATE_LIMIT_KV / BACKUP_KV                     │   │
│  │ KV: TOKEN_BLACKLIST  ← Token 撤銷                            │   │
│  │ R2: makanmasak-backups-staging                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 前置條件

### 1. 確認 Cloudflare 帳戶設置

```bash
# 登入 Cloudflare
npx wrangler login

# 確認登入狀態
npx wrangler whoami
```

### 2. 創建必要的 Cloudflare 資源

如果這是首次部署，需要先創建以下資源：

```bash
# 創建 D1 數據庫
npx wrangler d1 create makanmasak-staging

# 創建 KV 命名空間
npx wrangler kv:namespace create "CACHE_KV" --env staging
npx wrangler kv:namespace create "RATE_LIMIT_KV" --env staging
npx wrangler kv:namespace create "BACKUP_KV" --env staging
npx wrangler kv:namespace create "TOKEN_BLACKLIST" --env staging

# 創建 R2 存儲桶
npx wrangler r2 bucket create makanmasak-backups-staging
```

### 3. 更新 wrangler.toml 配置

將創建的資源 ID 更新到 `wrangler.toml` 中：

```toml
# apps/api/wrangler.toml
[[env.staging.d1_databases]]
binding = "DB"
database_name = "makanmasak-staging"
database_id = "<YOUR_ACTUAL_D1_ID>"  # 替換為實際 ID

[[env.staging.kv_namespaces]]
binding = "TOKEN_BLACKLIST"
id = "<YOUR_ACTUAL_KV_ID>"  # 替換為實際 ID
```

### 4. 設置 Secrets

這些是 Cloudflare Worker runtime secrets，會寫入 Cloudflare，不會提供給
GitHub Actions 的 staging deploy/smoke gate。

```bash
# 設置 JWT 密鑰（至少 32 字符）
npx wrangler secret put JWT_SECRET --env staging

# 設置 Slack Webhook（可選，用於告警通知）
npx wrangler secret put SLACK_WEBHOOK_URL --env staging
```

### 5. 設置 GitHub Actions Staging Secrets

`.github/workflows/test.yml` 的 `deploy-staging` job 會在手動觸發
`workflow_dispatch` 或 `develop` 分支 push 時執行 staging 部署與部署後煙霧測試。
這些 secrets 應設在 GitHub `staging` environment（建議），或設為 repository
secrets。

必要 secrets：

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions 使用 Wrangler 部署 Cloudflare 資源 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `STAGING_API_URL` | Layer 1/2/3 smoke test 的 API base URL |
| `STAGING_CUSTOMER_URL` | Customer app smoke test URL |
| `STAGING_ADMIN_URL` | Admin dashboard smoke test URL 與 realtime gate |
| `STAGING_KITCHEN_URL` | Kitchen display smoke test URL |
| `STAGING_AUTH_USERNAME` | Staging owner/admin 測試帳號 |
| `STAGING_AUTH_PASSWORD` | Staging owner/admin 測試密碼 |
| `STAGING_KITCHEN_USERNAME` | Kitchen display 測試帳號 |
| `STAGING_KITCHEN_PASSWORD` | Kitchen display 測試密碼 |
| `STAGING_RESTAURANT_ID` | 已 seed 的 staging 餐廳 ID |
| `STAGING_MENU_ITEM_ID` | 已 seed 的 staging 菜品 ID |

可選 secrets：

| Secret | 用途 |
| --- | --- |
| `STAGING_URL` | 舊版 fallback；若未設 `STAGING_API_URL` 或 `STAGING_CUSTOMER_URL` 才使用 |
| `STAGING_REALTIME_URL` | 若無法從 smoke response 推導 realtime HTTP base URL 時使用 |
| `STAGING_KITCHEN_RESTAURANT_ID` | 若 chef login response 沒有 restaurantId，或需指定 kitchen restaurant 時使用 |

互動式設定範例：

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo erictheng93/Makan-Masak --env staging
gh secret set CLOUDFLARE_ACCOUNT_ID --repo erictheng93/Makan-Masak --env staging
gh secret set STAGING_API_URL --repo erictheng93/Makan-Masak --env staging
gh secret set STAGING_CUSTOMER_URL --repo erictheng93/Makan-Masak --env staging
gh secret set STAGING_ADMIN_URL --repo erictheng93/Makan-Masak --env staging
gh secret set STAGING_KITCHEN_URL --repo erictheng93/Makan-Masak --env staging
gh secret set STAGING_AUTH_USERNAME --repo erictheng93/Makan-Masak --env staging
gh secret set STAGING_AUTH_PASSWORD --repo erictheng93/Makan-Masak --env staging
gh secret set STAGING_KITCHEN_USERNAME --repo erictheng93/Makan-Masak --env staging
gh secret set STAGING_KITCHEN_PASSWORD --repo erictheng93/Makan-Masak --env staging
gh secret set STAGING_RESTAURANT_ID --repo erictheng93/Makan-Masak --env staging
gh secret set STAGING_MENU_ITEM_ID --repo erictheng93/Makan-Masak --env staging
```

從 shell 環境變數非互動式寫入範例：

```bash
printf '%s' "$CLOUDFLARE_API_TOKEN" |
  gh secret set CLOUDFLARE_API_TOKEN --repo erictheng93/Makan-Masak --env staging
```

設定後驗證：

```bash
gh secret list --repo erictheng93/Makan-Masak --env staging
gh workflow run test.yml --repo erictheng93/Makan-Masak --ref main
gh run watch <RUN_ID> --repo erictheng93/Makan-Masak --exit-status
```

完整上線驗收前，手動 workflow run 必須看到以下 jobs 全部成功：

- `🔍 代碼品質檢查`
- `🧪 單元測試`
- `🔗 真實服務整合測試`
- `🎭 E2E 測試`
- `🚀 部署到測試環境`
- `🧪 部署後煙霧測試`

## 部署步驟

### 方法 1: 使用 workspace script（推薦）

```bash
# 1. 安裝依賴
pnpm install --frozen-lockfile

# 2. 類型檢查
pnpm typecheck

# 3. 執行 staging D1 遷移
pnpm db:migrate:staging

# 4. 執行 migration 檢查、全 workspace build 與各 workspace staging deploy
pnpm deploy:staging
```

### 方法 2: 手動部署

```bash
# 1. 安裝依賴
pnpm install

# 2. 類型檢查
pnpm run typecheck

# 3. 執行數據庫遷移
pnpm db:migrate:staging

# 4. 部署 API
pnpm --filter @makanmakan/api deploy:staging

# 5. 部署 Realtime
pnpm --filter @makanmakan/realtime deploy:staging
```

## 部署驗證

### 1. API 健康檢查

```bash
curl https://api-staging.makanmasak.com/info
```

預期回應：

```json
{
  "name": "MakanMakan API",
  "version": "v1",
  "environment": "staging",
  "deployment": {
    "mode": "saas",
    "platformVersion": "1.0.0"
  }
}
```

> 注意：公開探活請使用 `/info`。目前 API 沒有未授權的
> `/api/v1/health` 路由；系統健康檢查已移到受保護的 monitoring/system 功能。

### 2. Realtime 服務健康檢查

```bash
curl https://api-staging.makanmasak.com/api/v1/realtime/health
```

預期回應：

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "realtimeService": "up"
  }
}
```

### 3. Token 撤銷功能測試

```bash
# 1. 獲取 WebSocket Token
curl -X POST https://api-staging.makanmasak.com/api/v1/realtime/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "roomType": "customer",
    "roomId": "test-table-1",
    "restaurantId": "1"
  }'

# 2. 驗證 Token
curl -X POST https://api-staging.makanmasak.com/api/v1/realtime/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "<YOUR_TOKEN>"}'

# 3. 撤銷 Token
curl -X POST https://api-staging.makanmasak.com/api/v1/realtime/auth/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<YOUR_TOKEN>",
    "reason": "manual"
  }'

# 4. 確認 Token 已被撤銷
curl -X POST https://api-staging.makanmasak.com/api/v1/realtime/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "<YOUR_TOKEN>"}'
# 預期回應: {"success": false, "error": {"code": "TOKEN_BLACKLISTED", "message": "Token has been invalidated"}}
```

### 4. WebSocket 連接測試

```bash
# 使用 Artillery 進行負載測試
cd tests/performance
npx artillery run artillery-realtime-v2.yml --environment staging
```

## 監控和日誌

### 查看實時日誌

```bash
# API 日誌
npx wrangler tail makanmasak-api-staging

# Realtime 日誌
npx wrangler tail makanmasak-realtime-staging
```

### Cloudflare Dashboard

- [Workers 監控](https://dash.cloudflare.com/?to=/:account/workers)
- [D1 數據庫](https://dash.cloudflare.com/?to=/:account/d1)
- [KV 存儲](https://dash.cloudflare.com/?to=/:account/workers/kv/namespaces)

## 回滾流程

如果部署出現問題：

```bash
# 1. 查看部署歷史
npx wrangler deployments list --env staging

# 2. 回滾到上一個版本
npx wrangler rollback --env staging
```

## 常見問題

### Q: 部署失敗提示「Database ID not found」

A: 確認 wrangler.toml 中的 database_id 已更新為實際的 D1 ID

### Q: WebSocket 連接失敗

A: 檢查 Durable Objects 遷移是否正確執行

### Q: Token 驗證失敗

A: 確認 JWT_SECRET 已通過 `wrangler secret put` 設置

### Q: KV 操作失敗

A: 確認 KV namespace ID 正確，且已授權給 Worker

## 部署清單

在部署前確認以下事項：

- [ ] Cloudflare 登入狀態正常
- [ ] D1 數據庫已創建並配置
- [ ] KV 命名空間已創建（包括 TOKEN_BLACKLIST）
- [ ] R2 存儲桶已創建
- [ ] JWT_SECRET 已設置
- [ ] GitHub Actions `staging` environment secrets 已設置
- [ ] 本地類型檢查通過
- [ ] 數據庫遷移已執行
- [ ] API 服務已部署
- [ ] Realtime 服務已部署
- [ ] 健康檢查通過
- [ ] WebSocket 連接測試通過
- [ ] Token 撤銷功能測試通過
- [ ] 手動 GitHub Actions staging deploy 與部署後煙霧測試通過

---

**最後更新**: 2026-06-27
**相關文檔**: [REALTIME_SERVICES_IMPLEMENTATION.md](../REALTIME_SERVICES_IMPLEMENTATION.md)
