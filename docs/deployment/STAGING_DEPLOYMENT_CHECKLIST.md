# Staging 環境部署清單

> 本文檔說明如何將 MakanMakan 即時服務部署到 Cloudflare Staging 環境

## 部署架構

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Staging 環境架構                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐      ┌─────────────────┐                      │
│  │ makanmakan-api- │      │ makanmakan-     │                      │
│  │ staging         │◄────►│ realtime-staging│                      │
│  │ (Cloudflare     │      │ (Durable Objects)                      │
│  │  Worker)        │      │                 │                      │
│  └────────┬────────┘      └────────┬────────┘                      │
│           │                        │                                │
│           ▼                        ▼                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Cloudflare Resources                       │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ D1: makanmakan-staging                                       │   │
│  │ KV: makanmakan-cache-staging                                 │   │
│  │ KV: makanmakan-ratelimit-staging                             │   │
│  │ KV: makanmakan-token-blacklist-staging  ← 新增: Token 撤銷   │   │
│  │ R2: makanmakan-backups-staging                               │   │
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
npx wrangler d1 create makanmakan-staging

# 創建 KV 命名空間
npx wrangler kv:namespace create "CACHE" --env staging
npx wrangler kv:namespace create "RATE_LIMIT" --env staging
npx wrangler kv:namespace create "BACKUP" --env staging
npx wrangler kv:namespace create "TOKEN_BLACKLIST" --env staging

# 創建 R2 存儲桶
npx wrangler r2 bucket create makanmakan-backups-staging
```

### 3. 更新 wrangler.toml 配置

將創建的資源 ID 更新到 `wrangler.toml` 中：

```toml
# apps/api/wrangler.toml
[[env.staging.d1_databases]]
binding = "DB"
database_name = "makanmakan-staging"
database_id = "<YOUR_ACTUAL_D1_ID>"  # 替換為實際 ID

[[env.staging.kv_namespaces]]
binding = "TOKEN_BLACKLIST"
id = "<YOUR_ACTUAL_KV_ID>"  # 替換為實際 ID
```

### 4. 設置 Secrets

```bash
# 設置 JWT 密鑰（至少 32 字符）
npx wrangler secret put JWT_SECRET --env staging

# 設置 Slack Webhook（可選，用於告警通知）
npx wrangler secret put SLACK_WEBHOOK_URL --env staging
```

## 部署步驟

### 方法 1: 使用部署腳本（推薦）

```powershell
# Windows PowerShell
.\scripts\deploy-staging.ps1

# 預覽模式（不實際部署）
.\scripts\deploy-staging.ps1 -DryRun

# 跳過構建
.\scripts\deploy-staging.ps1 -SkipBuild

# 跳過遷移
.\scripts\deploy-staging.ps1 -SkipMigrations
```

### 方法 2: 手動部署

```bash
# 1. 安裝依賴
pnpm install

# 2. 類型檢查
pnpm run typecheck

# 3. 執行數據庫遷移
cd packages/database
npx wrangler d1 migrations apply makanmakan-staging --env staging

# 4. 部署 API
cd apps/api
npx wrangler deploy --env staging

# 5. 部署 Realtime
cd apps/realtime
npx wrangler deploy --env staging
```

## 部署驗證

### 1. API 健康檢查

```bash
curl https://api-staging.makanmakan.com/api/v1/health
```

預期回應：
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-..."
}
```

### 2. Realtime 服務健康檢查

```bash
curl https://api-staging.makanmakan.com/api/v1/realtime/health
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
curl -X POST https://api-staging.makanmakan.com/api/v1/realtime/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "roomType": "customer",
    "roomId": "test-table-1",
    "restaurantId": "1"
  }'

# 2. 驗證 Token
curl -X POST https://api-staging.makanmakan.com/api/v1/realtime/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "<YOUR_TOKEN>"}'

# 3. 撤銷 Token
curl -X POST https://api-staging.makanmakan.com/api/v1/realtime/auth/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<YOUR_TOKEN>",
    "reason": "manual"
  }'

# 4. 確認 Token 已被撤銷
curl -X POST https://api-staging.makanmakan.com/api/v1/realtime/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "<YOUR_TOKEN>"}'
# 預期回應: {"success": false, "error": "Token has been revoked", "revoked": true}
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
npx wrangler tail makanmakan-api-staging

# Realtime 日誌
npx wrangler tail makanmakan-realtime-staging
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
- [ ] 本地類型檢查通過
- [ ] 數據庫遷移已執行
- [ ] API 服務已部署
- [ ] Realtime 服務已部署
- [ ] 健康檢查通過
- [ ] WebSocket 連接測試通過
- [ ] Token 撤銷功能測試通過

---

**最後更新**: 2024-12-06
**相關文檔**: [REALTIME_SERVICES_IMPLEMENTATION.md](../REALTIME_SERVICES_IMPLEMENTATION.md)
