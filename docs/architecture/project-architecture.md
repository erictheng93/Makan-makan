# MakanMakan 項目架構文檔

## 📂 完整項目架構

```
makanmakan/
├── 📁 根目錄配置
│   ├── package.json                 # 根目錄包管理
│   ├── wrangler.toml               # 全局Wrangler配置
│   ├── tsconfig.json               # TypeScript全局配置
│   ├── .env.example                # 環境變數模板
│   ├── .env.local                  # 本地環境變數(gitignore)
│   ├── .gitignore                  # Git忽略文件
│   ├── README.md                   # 項目說明文檔
│   └── CLAUDE.md                   # Claude Code指引文檔
│
├── 📁 apps/ (應用程式)
│   ├── 🔧 api/                     # 核心API服務 (Cloudflare Workers)
│   │   ├── src/
│   │   │   ├── index.ts            # API主入口點
│   │   │   ├── routes/             # API路由模組
│   │   │   │   ├── auth.ts         # 認證路由
│   │   │   │   ├── restaurants.ts  # 餐廳管理路由
│   │   │   │   ├── menu.ts         # 菜單管理路由
│   │   │   │   ├── orders.ts       # 訂單管理路由
│   │   │   │   ├── tables.ts       # 桌台管理路由
│   │   │   │   ├── users.ts        # 用戶管理路由
│   │   │   │   └── analytics.ts    # 分析統計路由
│   │   │   ├── middleware/         # 中間件
│   │   │   │   ├── auth.ts         # 認證中間件
│   │   │   │   ├── cors.ts         # CORS處理
│   │   │   │   ├── rateLimit.ts    # 速率限制
│   │   │   │   ├── validation.ts   # 資料驗證
│   │   │   │   └── errorHandler.ts # 錯誤處理
│   │   │   ├── services/           # 業務邏輯服務
│   │   │   │   ├── authService.ts  # 認證服務
│   │   │   │   ├── menuService.ts  # 菜單服務
│   │   │   │   ├── orderService.ts # 訂單服務
│   │   │   │   └── cacheService.ts # 快取服務
│   │   │   └── utils/              # 工具函式
│   │   │       ├── crypto.ts       # 加密工具
│   │   │       ├── jwt.ts          # JWT處理
│   │   │       └── validators.ts   # 驗證工具
│   │   ├── wrangler.toml           # API專用Wrangler配置
│   │   ├── package.json            # API依賴管理
│   │   └── tsconfig.json           # API TypeScript配置
│   │
│   ├── 🎨 customer-app/            # 消費者前端應用 (Cloudflare Pages)
│   │   ├── src/
│   │   │   ├── main.ts             # Vue.js入口
│   │   │   ├── App.vue             # 根組件
│   │   │   ├── views/              # 頁面組件
│   │   │   │   ├── QRScanView.vue  # QR碼掃描頁面
│   │   │   │   ├── MenuView.vue    # 菜單瀏覽頁面
│   │   │   │   ├── CartView.vue    # 購物車頁面
│   │   │   │   └── OrderView.vue   # 訂單追蹤頁面
│   │   │   ├── components/         # 通用組件
│   │   │   │   ├── MenuCard.vue    # 菜單卡片
│   │   │   │   ├── OrderStatus.vue # 訂單狀態
│   │   │   │   └── QRScanner.vue   # QR掃描器
│   │   │   ├── stores/             # Pinia狀態管理
│   │   │   │   ├── cart.ts         # 購物車狀態
│   │   │   │   ├── menu.ts         # 菜單狀態
│   │   │   │   └── order.ts        # 訂單狀態
│   │   │   ├── composables/        # Vue組合式函數
│   │   │   │   ├── useApi.ts       # API請求
│   │   │   │   ├── useWebSocket.ts # 即時通訊
│   │   │   │   └── useQRScanner.ts # QR掃描
│   │   │   └── assets/             # 靜態資源
│   │   │       ├── css/
│   │   │       ├── images/
│   │   │       └── icons/
│   │   ├── dist/                   # 構建輸出目錄
│   │   ├── public/                 # 公共資源
│   │   ├── index.html              # HTML模板
│   │   ├── vite.config.ts          # Vite配置
│   │   ├── package.json            # 前端依賴
│   │   └── tsconfig.json           # 前端TypeScript配置
│   │
│   ├── 🎛️ admin-dashboard/          # 管理後台應用 (Cloudflare Pages)
│   │   ├── src/
│   │   │   ├── main.ts             # Vue.js入口
│   │   │   ├── App.vue             # 根組件
│   │   │   ├── views/              # 管理頁面
│   │   │   │   ├── LoginView.vue   # 登入頁面
│   │   │   │   ├── DashboardView.vue # 儀表板
│   │   │   │   ├── OrdersView.vue  # 訂單管理
│   │   │   │   ├── MenuView.vue    # 菜單管理
│   │   │   │   ├── TablesView.vue  # 桌台管理
│   │   │   │   ├── UsersView.vue   # 用戶管理
│   │   │   │   └── AnalyticsView.vue # 數據分析
│   │   │   ├── components/         # 管理組件
│   │   │   │   ├── OrderCard.vue   # 訂單卡片
│   │   │   │   ├── MenuEditor.vue  # 菜單編輯器
│   │   │   │   ├── TableManager.vue # 桌台管理器
│   │   │   │   └── UserForm.vue    # 用戶表單
│   │   │   ├── layouts/            # 佈局組件
│   │   │   │   ├── DefaultLayout.vue # 預設佈局
│   │   │   │   ├── KitchenLayout.vue # 廚房顯示佈局
│   │   │   │   └── CashierLayout.vue # 收銀員佈局
│   │   │   └── router/             # 路由配置
│   │   │       └── index.ts
│   │   ├── dist/                   # 構建輸出
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── 🔄 realtime/                # 即時通訊服務 (Durable Objects)
│   │   ├── src/
│   │   │   ├── index.ts            # Durable Objects入口
│   │   │   ├── OrderNotifier.ts    # 訂單通知對象
│   │   │   ├── TableSession.ts     # 桌台會話對象
│   │   │   └── RestaurantRoom.ts   # 餐廳房間對象
│   │   ├── wrangler.toml
│   │   └── package.json
│   │
│   └── 🖼️ image-processor/          # 圖片處理服務 (Cloudflare Workers)
│       ├── src/
│       │   ├── index.ts            # 圖片處理Worker
│       │   ├── imageOptimizer.ts   # 圖片優化
│       │   └── uploadHandler.ts    # 上傳處理
│       ├── wrangler.toml
│       └── package.json
│
├── 📁 packages/ (共用包)
│   ├── 📘 shared-types/            # 共用TypeScript型別定義
│   │   ├── src/
│   │   │   ├── database.ts         # 資料庫型別
│   │   │   ├── api.ts              # API請求/響應型別
│   │   │   ├── user.ts             # 用戶相關型別
│   │   │   ├── restaurant.ts       # 餐廳相關型別
│   │   │   ├── menu.ts             # 菜單相關型別
│   │   │   ├── order.ts            # 訂單相關型別
│   │   │   ├── table.ts            # 桌台相關型別
│   │   │   ├── websocket.ts        # WebSocket訊息型別
│   │   │   └── index.ts            # 統一匯出
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── 🗄️ database/                 # 資料庫相關功能
│   │   ├── migrations/             # D1資料庫遷移文件
│   │   │   ├── 0001_initial_schema.sql
│   │   │   ├── 0002_add_indexes.sql
│   │   │   ├── 0003_add_audit_logs.sql
│   │   │   └── 0004_optimize_queries.sql
│   │   ├── seeds/                  # 初始資料
│   │   │   ├── development.sql
│   │   │   ├── staging.sql
│   │   │   └── categories.sql
│   │   ├── scripts/                # 資料庫工具腳本
│   │   │   ├── migrate.ts          # 遷移執行器
│   │   │   ├── seed.ts             # 資料填充器
│   │   │   ├── backup.ts           # 備份工具
│   │   │   └── dataTransform.ts    # 資料轉換工具
│   │   ├── src/                    # 資料庫查詢邏輯
│   │   │   ├── queries.ts          # SQL查詢構建器
│   │   │   ├── models.ts           # 資料模型
│   │   │   └── validators.ts       # 資料驗證
│   │   └── package.json
│   │
│   └── 🔧 utils/                    # 共用工具函式
│       ├── src/
│       │   ├── crypto.ts           # 加密解密工具
│       │   ├── datetime.ts         # 日期時間工具
│       │   ├── string.ts           # 字符串處理
│       │   ├── validation.ts       # 通用驗證
│       │   ├── qrcode.ts           # QR碼生成工具
│       │   ├── cache.ts            # 快取工具
│       │   └── index.ts
│       └── package.json
│
├── 📁 docs/ (文檔)
│   ├── api.md                      # API文檔
│   ├── deployment.md               # 部署指南
│   ├── development.md              # 開發指南
│   ├── database-schema.md          # 資料庫設計文檔
│   ├── project-architecture.md     # 此文檔
│   ├── user-stories.md             # 用戶故事
│   └── troubleshooting.md          # 問題排解
│
├── 📁 .github/ (CI/CD配置)
│   └── workflows/
│       ├── deploy-staging.yml      # 預發布環境部署
│       ├── deploy-production.yml   # 生產環境部署
│       ├── test.yml                # 自動化測試
│       └── security-scan.yml       # 安全掃描
│
└── 📁 legacy/ (舊系統，僅供參考)
    └── (現有的PHP系統文件)
```

## 🔧 核心配置文件

### 根目錄 package.json

```json
{
  "name": "makanmakan",
  "version": "2.0.0",
  "description": "智慧雲端點餐平台 - 基於Cloudflare生態系統",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev --workspaces --if-present",
    "build": "npm run build --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "db:migrate:staging": "wrangler d1 migrations apply makanmakan-staging --env staging",
    "db:migrate:prod": "wrangler d1 migrations apply makanmakan-prod --env production",
    "deploy:staging": "npm run build && npm run deploy:staging --workspaces --if-present",
    "deploy:prod": "npm run build && npm run deploy:prod --workspaces --if-present"
  },
  "keywords": [
    "restaurant",
    "ordering-system",
    "cloudflare",
    "serverless",
    "vue.js",
    "typescript"
  ],
  "author": "MakanMakan Team",
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "wrangler": "^3.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0"
  }
}
```

### TypeScript 全局配置

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@makanmakan/shared-types": ["packages/shared-types/src"],
      "@makanmakan/database": ["packages/database/src"],
      "@makanmakan/utils": ["packages/utils/src"]
    }
  },
  "include": ["apps/**/*", "packages/**/*"],
  "exclude": ["node_modules", "dist", "legacy"]
}
```

## 🌐 Cloudflare服務映射

| 應用/功能  | Cloudflare服務        | 配置位置                |
| ---------- | --------------------- | ----------------------- |
| 消費者前端 | Pages                 | `apps/customer-app/`    |
| 管理後台   | Pages                 | `apps/admin-dashboard/` |
| 核心API    | Workers               | `apps/api/`             |
| 即時通訊   | Durable Objects       | `apps/realtime/`        |
| 圖片處理   | Workers + R2 + Images | `apps/image-processor/` |
| 資料庫     | D1                    | `packages/database/`    |
| 快取       | KV Store              | 各個應用配置            |

## 📋 開發工作流程

1. **本地開發**：`npm run dev` (啟動所有服務)
2. **類型檢查**：`npm run typecheck`
3. **代碼檢查**：`npm run lint`
4. **構建應用**：`npm run build`
5. **部署測試環境**：`npm run deploy:staging`
6. **部署生產環境**：`npm run deploy:prod`

## 🔄 版本控制策略

- `main` - 生產環境分支
- `develop` - 開發環境分支
- `feature/*` - 功能分支
- `hotfix/*` - 緊急修復分支

---

**文檔版本**: v2.0  
**創建時間**: 2025年8月23日  
**更新時間**: 定期更新
