# CLAUDE-中文.md

本檔案為 Claude Code (claude.ai/code) 在此代碼庫中工作時的中文指導文件。

## 專案概述

MakanMakan 是一個基於 Cloudflare 邊緣運算平台構建的現代化無伺服器餐廳管理系統。該系統提供線上點餐、菜單管理、桌台管理和多角色用戶存取，具備即時功能。支援多家餐廳/商店擁有各自的菜單、桌台和員工，透過可擴展、具成本效益的 SaaS 架構交付。

## 架構遷移狀態

**✅ 遷移完成**

- **舊系統**: PHP + MySQL（存檔於 `/legacy/` 資料夾）
- **新系統**: Cloudflare Workers + D1 + TypeScript（**生產就緒**）
- **遷移狀態**: 完成無伺服器架構實施，TypeScript 編譯 0 錯誤
- **目前階段**: 效能最佳化和功能增強

## 新系統架構（Cloudflare 生態系統）

### 技術堆疊

- **前端**: Vue.js 3 + TypeScript（Cloudflare Pages）
- **後端**: Cloudflare Workers + TypeScript
- **資料庫**: Cloudflare D1（相容 SQLite 的無伺服器 SQL）
- **快取**: Cloudflare KV 儲存
- **即時功能**: Durable Objects（WebSocket 連接）
- **檔案儲存**: Cloudflare R2 + Images API
- **監控**: Workers Analytics + 自訂指標
- **安全**: Cloudflare WAF + Zero Trust

### 專案結構

```
makanmakan/
├── apps/
│   ├── customer-app/          # 消費者點餐應用程式（Cloudflare Pages）
│   ├── admin-dashboard/       # 餐廳管理儀表板
│   ├── api/                   # API 服務（Cloudflare Workers）
│   ├── realtime/              # 即時服務（Durable Objects）
│   └── image-processor/       # 圖片處理 worker
├── packages/
│   ├── shared-types/          # 共享 TypeScript 定義
│   ├── database/              # D1 資料庫架構與遷移
│   └── utils/                 # 共享工具程式
├── legacy/                    # 原始 PHP 系統（已棄用）
└── docs/                      # 文件
    ├── requirements_optimized.md  # 產品需求文件
    └── technical-documentation.md # 技術規格
```

## 資料庫配置（Cloudflare D1）

### 資料庫設定

- **生產環境**: `makanmakan-prod`（Cloudflare D1）
- **本機開發**: 本機 SQLite 資料庫

### 關鍵資料表（生產架構）

**核心業務資料表:**

- `users`: 多角色用戶帳戶（管理員、店主、廚師、服務員、收銀員）
- `restaurants`: 餐廳資訊與設定
- `tables`: 桌台管理與 QR 碼產生
- `orders`: 訂單記錄與狀態追蹤
- `order_items`: 個別訂單項目與客製化
- `menu_items`: 菜單項目與圖片變體
- `categories`: 菜單分類

**系統與安全資料表:**

- `sessions`: 用戶會話（也快取於 KV）
- `audit_logs`: 完整系統活動記錄
- `error_reports`: 錯誤追蹤與除錯
- `qr_codes`: QR 碼產生與管理
- `qr_templates`: QR 碼樣式模板
- `qr_downloads`: QR 碼使用分析
- `qr_batches`: 批量 QR 產生追蹤

**媒體與分析資料表:**

- `images`: 圖片元資料與處理
- `image_variants`: 多種圖片尺寸變體

### 資料庫操作

```bash
# 應用遷移到生產環境
npx wrangler d1 migrations apply makanmakan-prod --env production

# 在本機執行 SQL 查詢
npx wrangler d1 execute makanmakan-local --local --command "SELECT * FROM users LIMIT 5"
```

## 開發工作流程

### 先決條件

- Node.js 22+
- Cloudflare 帳戶（付費方案，用於 D1、R2、Images）
- Wrangler CLI: `npm install -g wrangler`

### 本機開發設定

```bash
# 1. 安裝依賴項目
npm install

# 2. 設定環境
cp .env.example .env.local

# 3. 驗證 Cloudflare 身份
npx wrangler login

# 4. 建立本機 D1 資料庫
npx wrangler d1 create makanmakan-local --local

# 5. 執行資料庫遷移
npm run db:migrate:local

# 6. 啟動開發伺服器
npm run dev  # 並行啟動所有應用程式
```

### 環境配置

#### 必需的環境變數

```env
# Cloudflare API Token（用於部署）
CLOUDFLARE_API_TOKEN=your_api_token

# JWT 密鑰，用於身份驗證
JWT_SECRET=your_jwt_secret

# Slack webhook，用於錯誤通知
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

#### Wrangler 配置

每個應用程式都有自己的 `wrangler.toml`，包含環境特定綁定：

- D1 資料庫
- KV 命名空間
- R2 儲存桶
- Durable Object 綁定
- 佇列生產者

### 多角色存取系統（邏輯未變更）

系統維持相同的角色權限：

- **0: 管理員** - 完整系統存取權限
- **1: 店主** - 餐廳管理
- **2: 廚師** - 廚房顯示系統
- **3: 服務員** - 訂單履行
- **4: 收銀員** - 付款處理

### API 端點結構

```
/api/v1/
├── auth/          # 身份驗證（登入、註冊、刷新）
├── restaurants/   # 餐廳管理
├── menu/          # 菜單和分類
├── orders/        # 訂單管理
├── tables/        # 桌台管理和 QR 碼
├── users/         # 用戶/員工管理
├── analytics/     # 業務分析
├── qr/            # QR 碼產生和模板
├── system/        # 錯誤報告和健康檢查
├── sse/           # 伺服器發送事件，用於即時更新
└── health/        # 系統健康監控
```

## 開發指令

### 資料庫管理

```bash
# 建立並應用遷移
npm run db:migrate:create <遷移名稱>
npm run db:migrate:prod

# 開發用資料種子
npm run db:seed:local
```

### 測試

```bash
# 單元測試
npm run test

# TypeScript 編譯檢查
npm run typecheck  # ✅ 所有應用程式 0 錯誤

# 整合測試
npm run test:integration

# 端到端測試
npm run test:e2e

# 測試覆蓋率
npm run test:coverage

# 特定應用程式測試
cd apps/api && npm run test
cd apps/admin-dashboard && npm run test
cd apps/customer-app && npm run test
```

### 部署

```bash
# 部署到生產環境（推送到 main 分支時自動執行）
npm run deploy:prod

# 手動部署
npm run build && npm run deploy
```

### 監控和除錯

```bash
# 檢視特定 worker 的日誌
npx wrangler tail makanmakan-api-prod

# 檢視 D1 資料庫
npx wrangler d1 execute makanmakan-prod --command "SELECT COUNT(*) FROM orders"

# 監控 KV 使用狀況
npx wrangler kv:key list --binding CACHE_KV
```

## 目前開發狀態

### 🚀 生產就緒功能（已完成）

- ✅ **核心 API 基礎設施**: 所有端點正常運作，TypeScript 編譯 0 錯誤
- ✅ **資料庫架構**: 完整 D1 架構與遷移
- ✅ **身份驗證系統**: 基於 JWT 的多角色身份驗證
- ✅ **QR 碼服務**: 進階 QR 產生，具模板和分析功能
- ✅ **錯誤監控**: 全面錯誤報告和記錄
- ✅ **安全框架**: 完整安全文件和實施
- ✅ **測試套件**: 所有應用程式的完整測試覆蓋
- ✅ **CI/CD 管線**: 自動化部署和測試

### 🔨 開發中功能

- 🔄 **即時功能**: 即時更新的 WebSocket/SSE 實作
- 🔄 **圖片處理**: 菜單照片的 Cloudflare Images 整合
- 🔄 **分析儀表板**: 商業智慧和報告功能
- 🔄 **效能最佳化**: 快取策略和查詢最佳化

### 📋 下一階段（規劃中）

- ⏳ **付款整合**: 多閘道付款處理
- ⏳ **行動 PWA**: 離線支援的漸進式網頁應用功能
- ⏳ **進階分析**: AI 驅動的見解和推薦
- ⏳ **多語言支援**: 國際化框架

## 近期開發成就

### 🎯 TypeScript 錯誤解決（完成於: 2025-08-31）

**重大成就**: 成功解決整個 API 代碼庫中所有 **13 個剩餘的 TypeScript 編譯錯誤**，實現 **完美的 TypeScript 編譯（0 錯誤）**。

#### 實施的關鍵修復:

1. **D1Database 匯入解決（3 個錯誤）**:
   - 將匯入路徑從 `@cloudflare/workers-types` 修正為 `@makanmakan/database`
   - 更新型別別名和匯出模式
   - 解決 `packages/database/src/index.ts` 和 `packages/database/src/services/base.ts`

2. **QRCode 服務方法簽名（6 個錯誤）**:
   - 修正從不安全的 result 轉型到直接屬性存取的屬性存取模式
   - 將方法名稱從 `getAllTemplates()` 修正為 `getActiveTemplates()`
   - 更新服務回應結構以匹配實際實作
   - 在 `apps/api/src/routes/qrcode.ts` 中解決

3. **稽核日誌架構對齊（3 個錯誤）**:
   - 從稽核日誌建立呼叫中移除不支援的 `changes` 欄位
   - 將稽核資訊整合到支援的 `description` 欄位中
   - 與 `QRCodeService.createAuditLog()` 介面需求對齊

4. **系統路由匯入修復（1 個錯誤）**:
   - 透過從 `@makanmakan/database` 匯入來修復 drizzle-orm 匯入
   - 更新 `apps/api/src/routes/system.ts`

#### 技術影響:

- **程式碼品質**: 所有 API 路由 100% TypeScript 合規
- **開發者體驗**: 零編譯警告，改善 IDE 支援
- **可維護性**: 一致的型別安全和無錯誤建置
- **部署就緒**: CI/CD 管線中的所有檢查通過

#### 驗證:

```bash
# 所有應用程式現在都通過 TypeScript 編譯
cd apps/api && npx tsc --noEmit  # ✅ 0 錯誤
cd apps/admin-dashboard && npx tsc --noEmit  # ✅ 清潔
cd apps/customer-app && npx tsc --noEmit  # ✅ 清潔
```

### 🔒 安全性增強（完成於: 2025-08-31）

**新增全面的安全文件**:

- `SECURITY.md`: 完整的安全指導原則和協定
- `DEPLOYMENT_SECURITY_CHECKLIST.md`: 部署前安全驗證
- `SQL/migrate_passwords_security.sql`: 資料庫安全遷移
- 所有服務的增強錯誤處理和稽核記錄

### 🧪 測試基礎設施（完成於: 2025-08-31）

**新增的全面測試套件**:

- **管理儀表板**: 元件測試、設定配置
- **API 服務**: 路由測試、SSE 測試、身份驗證測試
- **客戶應用程式**: 購物車、錯誤邊界、訂單項目的元件測試
- **端到端**: 管理員登入和核心工作流程測試

#### 測試覆蓋:

```bash
apps/admin-dashboard/src/__tests__/     # Vue 元件測試
apps/api/src/__tests__/                 # API 路由測試
apps/customer-app/src/tests/            # 客戶應用程式測試
tests/e2e/                              # 端到端測試
```

## 關鍵功能（更新版）

### 核心功能

- **多餐廳 SaaS 平台**，具有租戶隔離
- **基於 QR 碼的點餐**，動態 QR 產生
- **即時訂單追蹤**，使用 WebSockets（Durable Objects）
- **角色為基礎的存取控制**，專門介面
- **圖片最佳化**，使用 Cloudflare Images API
- **全球邊緣部署**，全球低延遲

### 進階功能

- **智慧快取**，多層快取策略
- **業務分析**，自訂指標追蹤
- **自動監控**，健康檢查和警報
- **漸進式網頁應用程式（PWA）**，離線功能
- **多語言支援**，為國際擴展做準備
- **API 優先設計**，用於未來整合

## 常見開發任務

### 新增新菜單項目

- **API**: POST `/api/v1/menu/{restaurant_id}/items`
- **前端**: 管理儀表板 → 菜單管理 → 新增項目
- **圖片**: 自動處理，多種變體（縮圖、中等、大型）

### 管理用戶角色

- **API**: POST/PUT `/api/v1/users/{restaurant_id}`
- **權限矩陣**: 定義於 `packages/shared-types/permissions.ts`
- **角色介面**: 管理儀表板中每個角色的專門 UI

### QR 碼產生

- **個別 QR**: POST `/api/v1/qr/generate`
- **批量產生**: POST `/api/v1/qr/bulk`
- **模板管理**: GET/POST/PUT/DELETE `/api/v1/qr/templates`
- **下載 QR**: GET `/api/v1/qr/{id}/download`
- **批次下載**: GET `/api/v1/qr/batch/{batchId}/download`
- **統計**: GET `/api/v1/qr/stats`
- **客製化**: 進階樣式，包含模板、標誌、顏色、漸層

### 即時訂單更新

- **WebSocket 連接**: 由 Durable Objects 處理
- **事件廣播**: 訂單狀態變更觸發通知
- **基於角色的篩選**: 不同角色接收不同通知類型

### 分析和報告

- **儀表板資料**: GET `/api/v1/analytics/{restaurant_id}/dashboard`
- **自訂報告**: 具快取的時間範圍篩選
- **匯出選項**: JSON、CSV、PDF 格式

## 錯誤處理和除錯

### 常見問題

1. **D1 連接錯誤**: 檢查 wrangler.toml 綁定
2. **KV 快取遺失**: 驗證命名空間配置
3. **圖片上傳失敗**: 檢查 R2 儲存桶權限
4. **WebSocket 中斷**: 監控 Durable Objects 健康狀況

### 除錯工具

- **Worker 日誌**: `npx wrangler tail`
- **D1 查詢**: 透過 wrangler 直接資料庫存取
- **健康端點**: `/api/v1/health` 用於系統狀態
- **錯誤追蹤**: 關鍵錯誤的自動 Slack 通知

## 效能最佳化

### 快取策略

- **靜態資產**: Cloudflare CDN，長快取時間
- **API 回應**: KV 快取，智慧無效化
- **資料庫查詢**: 查詢結果快取，具 TTL
- **圖片傳遞**: Cloudflare Images，全球分發

### 監控目標

- **API 回應時間**: P99 < 300ms
- **資料庫查詢時間**: P95 < 100ms
- **圖片載入時間**: P90 < 1s
- **WebSocket 延遲**: 即時更新 < 50ms

## 安全考量

### 資料保護

- **加密**: 靜態敏感資料使用 AES-256
- **JWT 令牌**: 具刷新邏輯的安全令牌管理
- **輸入驗證**: 所有輸入的全面驗證
- **CORS**: 嚴格的來源驗證

### 存取控制

- **WAF 規則**: API 保護的自訂規則
- **速率限制**: 基於 IP 和用戶的速率限制
- **地理限制**: 管理介面地理阻擋
- **稽核記錄**: 所有操作的完整稽核追蹤

## 從舊系統遷移

### 資料遷移流程

1. **匯出舊資料**: `/legacy/migration/` 中的自訂 PHP 腳本
2. **轉換架構**: 將舊結構映射到新 D1 資料表
3. **匯入到 D1**: 具驗證的批次匯入
4. **驗證資料完整性**: 自動檢查和報告
5. **切換規劃**: 藍綠部署策略

### 向後相容性

- **API 端點**: 過渡期間重定向舊端點
- **檔案參考**: 圖片 URL 映射到新 R2/Images 結構
- **用戶會話**: 活動會話的逐步遷移
- **QR 碼**: 過渡期間舊 QR 碼繼續運作

## 未來路線圖

### 規劃增強（第二階段）

- **進階分析**: AI 驅動的見解和推薦
- **付款整合**: 多付款閘道支援
- **庫存管理**: 智慧庫存追蹤與預測
- **行銷自動化**: 客戶分群定位
- **行動應用程式**: 原生 iOS/Android 應用程式
- **API 市場**: 第三方整合和擴充功能

---

**最後更新**: 2025-08-31  
**架構版本**: 2.0（Cloudflare 無伺服器）  
**舊版本**: 1.0（PHP/MySQL - 已棄用）  
**TypeScript 狀態**: ✅ 100% 無錯誤編譯  
**測試覆蓋**: 📊 實作全面測試套件  
**安全狀態**: 🔒 新增增強安全文件

詳細技術規格請參閱 `docs/technical-documentation.md`  
產品需求請參閱 `docs/requirements_optimized.md`

# 重要指示提醒

按要求行事；不多不少。
除非絕對必要實現目標，否則永遠不要建立檔案。
始終優先編輯現有檔案而非建立新檔案。
除非用戶明確要求，否則永遠不要主動建立文件檔案（\*.md）或 README 檔案。僅在明確要求時才建立文件檔案。

重要: 此內容可能與您的任務相關或不相關。除非與您的任務高度相關，否則您不應回應此內容。
