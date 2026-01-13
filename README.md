# MakanMakan - Modern Serverless Restaurant Management Platform

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![PWA](https://img.shields.io/badge/PWA-95%2F100-green)
[![codecov](https://codecov.io/gh/makanmakan/makanmakan/graph/badge.svg)](https://codecov.io/gh/makanmakan/makanmakan)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**一個基於 Cloudflare 邊緣運算的現代化餐廳管理系統**

[功能特點](#-核心功能) •
[快速開始](#-快速開始) •
[技術架構](#-技術架構) •
[文檔](#-文檔) •
[開發狀態](#-開發狀態)

</div>

---

## 📖 專案簡介

MakanMakan 是一個完全基於 **Cloudflare 無伺服器生態系統**構建的餐廳管理平台,提供從訂單管理、菜單展示到員工排班的全方位解決方案。系統採用現代化的技術棧,實現了高性能、低延遲和全球分佈式部署。

### 🎯 核心優勢

- ⚡ **極致性能** - 全球邊緣運算,P99 響應時間 < 300ms
- 🌍 **全球分佈** - 自動在全球 300+ 個節點部署
- 💰 **成本效益** - 無伺服器架構,按需付費
- 🔒 **企業級安全** - Cloudflare WAF + Zero Trust 保護
- 📱 **PWA 支持** - 95/100 性能評分,完整離線功能
- 🚀 **TypeScript 全棧** - 100% 類型安全,零編譯錯誤

---

## ✨ 核心功能

### 🍽️ 餐廳運營管理

- **多店舖支援** - 完整的多租戶架構,每個店舖獨立配置
- **即時訂單追蹤** - WebSocket 實時更新,廚房/服務生即時通知
- **智慧菜單管理** - 動態分類、圖片優化、庫存管理
- **桌台管理系統** - QR Code 掃描點餐,支援桌台級/座位級雙模式
- **多角色權限** - Admin/Owner/Chef/Service/Cashier 五種角色

### 🛍️ 創新點餐方式

#### 店家級 QR Code (✅ 新功能 - 2025-10-10)
- 單一 QR Code 全店通用,適合攤位、外帶櫃台
- 顧客註冊/登入系統,訂單歷史追蹤
- 可選手機驗證,增強安全性
- 購物車管理,支援批量訂單

#### 傳統桌台點餐
- 每桌獨立 QR Code
- 座位級精細管理(精緻餐廳、美食廣場)
- 自動桌台佔用/釋放追蹤

### 👥 員工管理系統 (📋 設計完成)

#### 請假管理系統 (100% 設計完成)
- 多種假別(年假、病假、事假、產假等)
- 假期餘額自動追蹤與結轉
- 多級審批工作流引擎
- 排班衝突自動偵測
- 台灣勞基法合規

#### 員工排班系統 (43% 進行中)
- 班表模板管理(早班、午班、晚班)
- 自動排班生成
- 打卡簽到/退系統
- 加班計算與勞動時數追蹤
- 班次調換請求工作流

### 🤖 AI 驅動的商業分析 (✅ 後端完成)

- **多 LLM 提供商支援** - Anthropic Claude, OpenAI, Google Gemini, DeepSeek
- **產品分析** - 流量驅動產品、暢銷品、利潤領導者識別
- **智慧洞察生成** - 7 天營收預測、異常偵測、決策建議
- **成本控制** - Token 使用追蹤,AES-256 加密 API 金鑰

### 📊 進階功能

- **PWA 離線功能** - 完整 Service Worker,IndexedDB 快取
- **即時性能監控** - Web Vitals 追蹤,自動優化建議
- **安全密碼系統** - Bcrypt 雜湊,平滑遷移
- **完整審計日誌** - 所有操作可追溯
- **錯誤追蹤** - Slack 即時通知,詳細錯誤報告

---

## 🏗️ 技術架構

### 技術棧

```
┌─────────────────────────────────────────────┐
│              Frontend Layer                 │
│                                             │
│  Vue.js 3 + TypeScript + Tailwind CSS      │
│  (Cloudflare Pages)                        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│             Edge Computing                  │
│                                             │
│  Cloudflare Workers (TypeScript)           │
│  - API Routes                               │
│  - Authentication Middleware                │
│  - Business Logic                           │
└─────────────────────────────────────────────┘
                    ↓
┌──────────────┬──────────────┬───────────────┐
│              │              │               │
│  D1 Database │  KV Cache    │  R2 Storage   │
│  (SQLite)    │  (Sessions)  │  (Images)     │
│              │              │               │
└──────────────┴──────────────┴───────────────┘
```

### Cloudflare 生態系統應用

| 服務 | 用途 | 優勢 |
|------|------|------|
| **Workers** | API 處理, 認證, 業務邏輯 | 邊緣運算, < 50ms 延遲 |
| **D1** | 主資料庫 (SQLite) | 全球分佈, 自動複製 |
| **KV** | Session 快取, 熱資料 | 極低延遲讀取 |
| **R2** | 圖片, 靜態資源 | 免流量費用 |
| **Pages** | 前端託管 | 自動 CDN, Git 整合 |
| **Durable Objects** | WebSocket 即時通訊 | 狀態管理, 低延遲 |
| **Images** | 圖片優化與轉換 | 自動 Resize, WebP 轉換 |
| **Analytics** | 使用者行為追蹤 | 無需第三方工具 |

### 專案結構

```
makanmakan/
├── apps/
│   ├── customer-app/          # 顧客點餐 App (Vue 3 + PWA)
│   ├── admin-dashboard/       # 管理後台 (Vue 3)
│   ├── kitchen-display/       # 廚房顯示系統 (Vue 3)
│   ├── api/                   # API 服務 (Workers)
│   ├── realtime/              # 即時服務 (Durable Objects)
│   └── image-processor/       # 圖片處理 Worker
│
├── packages/
│   ├── database/              # D1 Schema & Migrations
│   ├── shared-types/          # 共用 TypeScript 定義
│   ├── utils/                 # 共用工具函數
│   └── shared/                # 共用 Vue 組件
│
└── docs/                      # 完整文檔
```

---

## 🚀 快速開始

### 環境需求

- Node.js 20+
- pnpm 8+
- Cloudflare 帳號 (付費方案 - D1, R2, Images)
- Wrangler CLI

### 安裝步驟

```bash
# 1. Clone 專案
git clone https://github.com/your-org/makanmakan.git
cd makanmakan

# 2. 安裝依賴
pnpm install

# 3. 設定環境變數
cp .env.example .env.local
# 編輯 .env.local 填入必要的 API Keys

# 4. Cloudflare 認證
npx wrangler login

# 5. 建立本地 D1 資料庫
npx wrangler d1 create makanmakan-local --local

# 6. 執行資料庫遷移
pnpm run db:migrate:local

# 7. 啟動開發伺服器
pnpm run dev
```

### 快速測試

```bash
# 開啟瀏覽器
Customer App:     http://localhost:5173
Admin Dashboard:  http://localhost:5174
Kitchen Display:  http://localhost:5175
API (Workers):    http://localhost:8787

# 測試帳號
Admin:  admin@makanmakan.com / admin123
Owner:  owner@restaurant1.com / owner123
```

---

## 💻 開發工作流

### 常用命令

```bash
# 開發環境
pnpm run dev              # 啟動所有 apps
pnpm run build            # 建置所有 apps
pnpm run typecheck        # TypeScript 檢查 (✅ 0 錯誤)
pnpm run lint             # ESLint 檢查 (✅ 0 錯誤)

# 資料庫管理
pnpm run db:migrate:create <name>  # 建立新遷移
pnpm run db:migrate:local          # 本地遷移
pnpm run db:migrate:staging        # Staging 遷移
pnpm run db:migrate:prod           # Production 遷移

# 測試
pnpm run test                      # 單元測試
pnpm run test:e2e                  # E2E 測試
pnpm run test:coverage             # 測試覆蓋率

# 部署
pnpm run deploy:staging            # 部署到 Staging
pnpm run deploy:prod               # 部署到 Production
```

### Git 工作流程

```bash
main (production)
  ↓
develop (staging)
  ↓
feature/* (開發分支)
```

---

## 📚 文檔

### 核心文檔

- **[CLAUDE.md](./CLAUDE.md)** - AI 輔助開發指南 (完整系統說明)
- **[API 文檔](./docs/api/)** - 完整 API 端點說明
- **[技術規格](./docs/architecture/technical-documentation.md)** - 架構設計文件

### 功能文檔

- **[Shop QR 系統](./docs/features/shop-qr/SHOP_QR_PHASE3_COMPLETION.md)** - 店家級 QR Code 完整指南
- **[員工排班系統](./docs/EMPLOYEE_SCHEDULING_IMPLEMENTATION.md)** - 排班系統設計文件
- **[請假管理系統](./docs/LEAVE_MANAGEMENT_IMPLEMENTATION.md)** - 請假系統設計文件
- **[AI 分析系統](./docs/AI_ANALYTICS_IMPLEMENTATION.md)** - AI 商業分析指南
- **[PWA 優化](./docs/performance/PWA-TESTING-REPORT.md)** - PWA 性能優化報告
- **[安全指南](./docs/security/SECURITY.md)** - 安全最佳實踐

### API 端點概覽

```
/api/v1/
├── /auth              # 認證 (登入/註冊/Token 刷新)
├── /restaurants       # 餐廳管理 (含 Shop QR)
├── /customers         # 顧客管理 (註冊/登入/個人資料)
├── /menu              # 菜單與分類管理
├── /orders            # 訂單處理
├── /tables            # 桌台管理
├── /seats             # 座位管理 (精細化控制)
├── /users             # 員工用戶管理
├── /leaves            # 請假管理 (設計完成)
├── /scheduling        # 員工排班 (進行中)
├── /analytics         # 商業分析
├── /ai-analytics      # AI 驅動洞察
├── /qr                # QR Code 生成與模板
└── /health            # 系統健康檢查
```

---

## 🎯 開發狀態

### ✅ 已完成功能 (Production Ready)

- ✅ **核心 API 基礎設施** - 所有端點正常運作,TypeScript 零錯誤
- ✅ **Shop QR 系統** - 全棧完成 (Backend + Customer App + Admin UI)
- ✅ **顧客認證系統** - 註冊/登入/個人資料管理
- ✅ **密碼安全增強** - Bcrypt 雜湊,從明文平滑遷移
- ✅ **座位管理系統** - 雙模式 QR (桌台級/座位級)
- ✅ **AI 分析後端** - 多 LLM 支援,產品分析,洞察生成
- ✅ **PWA 性能優化** - 95/100 評分,企業級 PWA 功能
- ✅ **完整型別安全** - 100% TypeScript 合規
- ✅ **程式碼品質** - 完美 ESLint 合規,零警告

### 🔨 進行中功能

- 🔄 **員工排班系統** (43% 完成)
  - ✅ 資料庫設計
  - ✅ TypeScript 型別定義
  - ✅ 驗證 Schemas
  - ⏳ SchedulingService 實作
  - ⏳ API Routes 開發
  - ⏳ Admin UI 介面

- 🔄 **即時功能** - WebSocket/SSE 實作
- 🔄 **圖片處理** - Cloudflare Images 整合

### 📋 待開發功能

- ⏸️ **請假管理前端** - Admin UI (設計 100% 完成)
- ⏸️ **AI 分析前端** - 儀表板 UI (後端 100% 完成)
- ⏳ **支付整合** - 多支付網關支援 (暫緩)
- ⏳ **多語言支援** - i18n 框架
- 🔜 **原生 Mobile App** - React Native (iOS/Android)

---

## 📊 性能指標

### 實際表現

| 指標 | 目標 | 實際 | 狀態 |
|------|------|------|------|
| API 響應時間 (P99) | < 300ms | ~250ms | ✅ |
| 資料庫查詢時間 (P95) | < 100ms | ~80ms | ✅ |
| PWA 性能評分 | > 90 | 95/100 | ✅ |
| 快取命中率 | > 80% | 85%+ | ✅ |
| TypeScript 錯誤 | 0 | 0 | ✅ |
| ESLint 錯誤 | 0 | 0 | ✅ |

### 成本效益

- **邊緣運算** - Workers 免費額度 100,000 請求/天
- **資料庫** - D1 免費額度 100,000 讀/天, 50,000 寫/天
- **圖片儲存** - R2 免費流量,每月只需付儲存費
- **估計月成本** - 中小型餐廳 < $10 USD/月

---

## 🤝 貢獻指南

歡迎貢獻! 請遵循以下步驟:

1. Fork 本專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add amazing feature'`)
4. Push 到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

### 開發規範

- ✅ 所有程式碼必須通過 TypeScript 檢查
- ✅ 遵循 ESLint 規則,零警告
- ✅ 撰寫測試覆蓋新功能
- ✅ 更新相關文檔
- ✅ 使用語意化提交訊息

---

## 📄 授權

本專案採用 MIT 授權條款 - 詳見 [LICENSE](./LICENSE) 文件。

---

## 🙏 致謝

- **Cloudflare** - 提供強大的邊緣運算平台
- **Vue.js** - 優秀的前端框架
- **Drizzle ORM** - 類型安全的 ORM
- **Claude (Anthropic)** - AI 輔助開發

---

## 📞 聯絡方式

- **專案主頁**: [GitHub Repository](#)
- **問題回報**: [GitHub Issues](#)
- **討論區**: [GitHub Discussions](#)
- **Email**: support@makanmakan.com

---

<div align="center">

**Built with ❤️ using Cloudflare Edge Computing**

**Last Updated**: 2025-10-11

</div>
