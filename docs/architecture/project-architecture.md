# MakanMakan 項目架構文檔

## 項目結構

```
makanmakan/
├── apps/                          # 應用程式
│   ├── api/                       # 核心 API (Cloudflare Workers + Hono)
│   │   └── src/features/          # 功能模組 (48 modules)
│   │       ├── authentication/    # 認證 (login, register, sessions, JWT)
│   │       ├── users/             # 員工管理
│   │       ├── customers/         # 顧客資料
│   │       ├── verification/      # Email/手機驗證
│   │       ├── admin-settings/    # 管理員設定
│   │       ├── restaurants/       # 餐廳 CRUD + 店鋪 QR
│   │       ├── menu/              # 菜單管理 + 分類
│   │       ├── orders/            # 訂單生命週期
│   │       ├── guest-orders/      # Guest 訂餐 (免註冊)
│   │       ├── group-orders/      # 團體訂餐 + 分帳
│   │       ├── tables/            # 桌位管理
│   │       ├── seats/             # 座位管理 + QR
│   │       ├── qr-codes/          # QR 碼產生/模板
│   │       ├── reservations/      # 預約系統
│   │       ├── queue/             # 排隊系統 (legacy)
│   │       ├── waiting-list/      # 候位系統 (modular)
│   │       ├── pos/               # POS 收銀 (收銀機/班次/現金/收據)
│   │       ├── payments/          # 支付、退款與分帳
│   │       ├── kitchen/           # 廚房顯示 (SSE)
│   │       ├── coupons/           # 優惠券
│   │       ├── partnerships/      # 合作夥伴 + 會員
│   │       ├── ingredients/       # 食材 + 食譜管理
│   │       ├── forecast/          # 銷售/食材預測
│   │       ├── discovery/         # 菜餚/餐廳搜尋
│   │       ├── feedback/          # 顧客回饋
│   │       ├── analytics/         # 儀表板分析
│   │       ├── ai-analytics/      # AI 分析報告
│   │       ├── scheduling/        # 排班 + 打卡 + 換班
│   │       ├── leaves/            # 請假管理
│   │       ├── manager/           # 主管委派與管理操作
│   │       ├── integrations/      # 第三方平台 (Uber Eats, Foodpanda)
│   │       ├── realtime/          # WebSocket Token 管理
│   │       ├── sse/               # SSE 即時事件
│   │       ├── notifications/     # 通知發送
│   │       ├── push/              # 推播通知
│   │       ├── subscriptions/     # 訂閱方案
│   │       ├── audit/             # 稽核日誌
│   │       ├── system/            # 系統健康 + 錯誤報告
│   │       ├── monitoring/        # 監控 + 警報
│   │       ├── backup/            # 備份管理
│   │       └── cache/             # 快取管理
│   │
│   ├── customer-app/              # 消費者前端 (Vue 3 + Cloudflare Pages)
│   ├── admin-dashboard/           # 管理後台 (Vue 3 + Cloudflare Pages)
│   ├── kitchen-display/           # 廚房顯示 (Vue 3 + Cloudflare Pages)
│   ├── onboarding-app/            # 入職引導應用
│   ├── management-portal/         # 管理入口
│   ├── management-api/            # 管理 API
│   ├── realtime/                  # 即時通訊 (Durable Objects)
│   ├── image-processor/           # 圖片處理 (Workers + R2)
│   ├── backup-scheduler/          # 備份排程 (Workers Cron)
│   └── print-agent/               # 列印代理 (Node.js + Express + WebSocket)
│
├── packages/                      # 共用套件
│   ├── database/                  # Drizzle ORM Schema + Migrations
│   │   ├── src/schema/            # Schema 定義 (source of truth)
│   │   └── migrations_fresh/      # Generated migrations
│   ├── shared-types/              # 共用 TypeScript 型別
│   ├── shared/                    # 共用常數與工具
│   ├── utils/                     # UUID v7、加密、日期等工具
│   ├── ai-analytics/              # AI 分析引擎
│   ├── queue-core/                # 排隊核心邏輯
│   ├── queue-service/             # 排隊服務層
│   └── testing-utils/             # 測試工具 + Factory Pattern
│
├── docs/                          # 文檔
│   ├── api/                       # API 端點文檔 (300+ endpoints)
│   ├── architecture/              # 架構設計
│   ├── features/                  # 功能文檔
│   ├── deployment/                # 部署指南
│   ├── security/                  # 安全文檔
│   ├── performance/               # 效能優化
│   ├── testing/                   # 測試指南
│   ├── user-manuals/              # 用戶手冊 (6 語言)
│   └── archive/                   # 已完成功能的歷史文檔
│
└── turbo.json                     # Turborepo 建置管道配置
```

## Cloudflare 服務映射

| 應用/功能  | Cloudflare 服務           | 目錄                     |
| ---------- | ------------------------- | ------------------------ |
| 消費者前端 | Pages                     | `apps/customer-app/`     |
| 管理後台   | Pages                     | `apps/admin-dashboard/`  |
| 廚房顯示   | Pages                     | `apps/kitchen-display/`  |
| 核心 API   | Workers                   | `apps/api/`              |
| 即時通訊   | Durable Objects           | `apps/realtime/`         |
| 圖片處理   | Workers + R2 + Images API | `apps/image-processor/`  |
| 備份排程   | Workers Cron + R2         | `apps/backup-scheduler/` |
| 列印代理   | Local Node.js             | `apps/print-agent/`      |
| 資料庫     | D1 (SQLite)               | `packages/database/`     |
| 快取       | KV Store                  | API Worker bindings      |
| 檔案儲存   | R2                        | API Worker bindings      |

## 核心技術棧

| 層級         | 技術                                        |
| ------------ | ------------------------------------------- |
| **Frontend** | Vue.js 3 + TypeScript + Vite + Tailwind CSS |
| **Backend**  | Cloudflare Workers + Hono Framework         |
| **Database** | Cloudflare D1 + Drizzle ORM                 |
| **Cache**    | Cloudflare KV Store                         |
| **Storage**  | Cloudflare R2 + Images API                  |
| **Realtime** | Durable Objects (WebSocket) + SSE           |
| **Build**    | Turborepo (parallel builds with caching)    |
| **Testing**  | Vitest (unit) + Playwright (e2e)            |
| **Print**    | Express + WebSocket (local agent)           |
| **Security** | Cloudflare WAF + Zero Trust                 |

## API 架構

API 使用 **Feature-based modular architecture**，每個功能模組包含：

```
features/{module}/
├── routes/index.ts      # Hono 路由定義
├── services/            # 業務邏輯
├── validators/          # Zod Schema 驗證
└── types.ts             # 模組型別定義
```

共用層：

- `shared/middleware/` — 認證、RBAC、速率限制、CORS、錯誤處理
- `shared/utils/` — ApiError、回應格式、加密
- `shared/constants/` — 角色定義、狀態碼

## 資料庫策略

- **Schema 定義**: `packages/database/src/schema/` (Drizzle ORM)
- **ID 策略**: UUID v7 (`TEXT` primary keys)
- **時間戳**: `INTEGER` (Unix ms, `timestamp_ms` mode)
- **查詢層**: Layer 1 (Drizzle Query Builder) + Layer 2 (Drizzle `sql` template)
- **禁止**: Raw SQL string (Layer 3)

## 開發工作流程

```bash
pnpm install              # 安裝依賴 (必須用 pnpm)
pnpm dev                  # 啟動所有應用
pnpm typecheck            # TypeScript 檢查
pnpm test                 # 執行測試
pnpm lint                 # 程式碼檢查
pnpm deploy:staging       # 部署到 staging
pnpm deploy:prod          # 部署到 production
```

---

**最後更新**: 2026-06-09
**功能模組**: 48
**API 端點**: 400+
**前端應用**: 5 (customer, admin, kitchen, management-portal, onboarding)
