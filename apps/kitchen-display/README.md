# MakanMakan 廚房顯示系統

專為餐廳廚房設計的現代化訂單管理顯示系統，基於 SSE (Server-Sent Events) 實現即時通信。

## 🚀 快速開始

### 安裝依賴

```bash
pnpm install
```

### 開發模式

```bash
pnpm dev
```

訪問：http://localhost:3002

### 構建生產版本

```bash
pnpm build
```

### 運行測試

```bash
pnpm test
```

## 🏗️ 項目結構

```
src/
├── components/          # UI 組件
│   ├── layout/         # 布局組件
│   ├── orders/         # 訂單相關組件
│   ├── stats/          # 統計組件
│   └── common/         # 通用組件
├── views/              # 頁面視圖
├── stores/             # Pinia 狀態管理
├── services/           # API 服務
├── composables/        # Vue 組合式函數
├── utils/              # 工具函數
├── types/              # TypeScript 類型定義
└── assets/             # 靜態資源
```

## 🎨 特色功能

### 已完成 (Phase 1)

- ✅ 現代化 Vue.js 3 + TypeScript 架構
- ✅ 廚師專用登入認證系統
- ✅ 響應式大屏幕優化設計
- ✅ 訂單狀態管理界面
- ✅ 實時統計面板
- ✅ 可自定義系統設定
- ✅ 鍵盤快捷鍵支持
- ✅ 音效通知系統基礎架構
- ✅ PWA 準備就緒

### 開發中 (Phase 2-4)

- 🔄 SSE 實時訂單推送
- 🔄 WebSocket fallback 機制
- 🔄 離線模式支持
- 🔄 高級統計和報表
- 🔄 訂單歷史記錄
- 🔄 多廚師協作功能

## 🛠️ 技術棧

- **前端框架**: Vue.js 3 + TypeScript
- **狀態管理**: Pinia
- **路由**: Vue Router 4
- **UI 組件**: Headless UI + Heroicons
- **樣式**: Tailwind CSS
- **HTTP 客戶端**: Axios + TanStack Query
- **通知系統**: Vue Toastification
- **音效**: Howler.js
- **測試**: Vitest + Vue Test Utils
- **構建工具**: Vite
- **部署**: Cloudflare Pages

## 🎯 用戶角色

系統專門為 **廚師** (role: 2) 設計，提供：

- 實時訂單接收和管理
- 狀態更新（待處理 → 製作中 → 已完成）
- 優先級管理（普通、重要、緊急）
- 製作時間追蹤
- 客製化需求顯示
- 批量操作支持

## 🔐 認證與權限

- 僅限廚師帳號登入
- JWT Token 認證
- 自動 Token 刷新
- 餐廳範圍權限控制

## 🎮 鍵盤快捷鍵

| 按鍵    | 功能     |
| ------- | -------- |
| `Space` | 標記完成 |
| `Enter` | 開始製作 |
| `M`     | 音效開關 |
| `F`     | 全屏模式 |
| `?`     | 顯示幫助 |

## 📱 響應式設計

- **主要目標**: 大屏幕廚房顯示器 (1920x1080+)
- **次要支持**: 平板設備 (iPad)
- **字體**: 最小 16px，按鈕最小 44px
- **對比度**: 滿足 WCAG AA 標準

## 🔧 環境變數

```bash
# Cloudflare API
VITE_API_BASE_URL=http://localhost:8787/api/v1

# 開發模式
VITE_DEV_MODE=true
```

## 🚀 部署

### Cloudflare Pages

```bash
pnpm build
# 上傳 dist/ 目錄到 Cloudflare Pages
```

### 環境配置

- **開發**: localhost:3002
- **測試**: staging-kitchen.makanmakan.com
- **生產**: kitchen.makanmakan.com

## 🤝 開發指南

### 代碼規範

- ESLint + Prettier
- TypeScript 嚴格模式
- Vue 3 Composition API
- 組件單一職責原則

### 提交規範

```bash
# 功能
git commit -m "feat(orders): add real-time order status updates"

# 修復
git commit -m "fix(auth): resolve login token refresh issue"

# 文檔
git commit -m "docs(readme): update installation instructions"
```

## 📝 TODO

- [ ] 實現 SSE 連接邏輯
- [ ] 添加音效文件和播放邏輯
- [ ] 完善錯誤處理和重試機制
- [ ] 增加單元測試覆蓋率
- [ ] 優化移動端適配
- [ ] 添加國際化支持

## 🐛 已知問題

- vue-toastification 使用 RC 版本
- 部分依賴版本需要更新
- 需要後端 API 端點配合測試

## 📞 支援

如需技術支援或報告問題，請聯繫開發團隊或在 GitHub 創建 Issue。

---

**版本**: 1.0.0 (Phase 1 完成)  
**最後更新**: 2025-08-26  
**許可證**: MIT
