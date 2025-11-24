# Architecture Documentation / 架構文檔

本文件夾包含 MakanMakan 系統的架構設計、技術規格和系統設計文檔。

## 📂 文件夾結構

### 📄 根目錄文檔

- **`technical-documentation.md`** ⭐ - 完整技術規格文檔（主文檔）
- **`project-architecture.md`** - 專案架構概覽

### 🗄️ Database Architecture (`database/`)

資料庫架構設計與優化文檔

**主要文檔**:
- `schema-overview.md` - 資料庫 Schema 概覽（待創建）
- `DATABASE_ARCHITECTURE_COMPARISON.md` - 架構比較分析
- `database-optimization-analysis.md` - 優化分析報告
- `DATABASE_REFACTORING_INDEX.md` - 重構索引
- `DATABASE_REFACTORING_PLAN.md` - 重構計劃
- `DATABASE_REFACTORING_EXECUTIVE_SUMMARY.md` - 重構執行摘要

**涵蓋內容**:
- Cloudflare D1 (SQLite) 架構
- 表結構設計
- 索引優化
- 查詢性能
- 遷移策略

### 🏗️ System Design (`system-design/`)

系統設計與模組架構文檔

**主要文檔**:
- `MODULAR_ARCHITECTURE_GUIDE.md` - 模組化架構指南
- `QUEUE_MODULAR_API.md` - 佇列模組化 API
- `NOTIFICATION_SYSTEM.md` - 通知系統設計
- `VERIFICATION_SYSTEM.md` - 驗證系統設計

**涵蓋內容**:
- 微服務架構
- 模組化設計
- API 設計模式
- 系統整合

---

## 🎯 文檔用途

### Technical Documentation
> **最重要的架構文檔** - 包含完整的技術規格、系統設計和實施細節

**適合閱讀者**:
- 新加入的開發者
- 架構師
- 技術決策者

**內容涵蓋**:
- 系統架構概覽
- 技術棧選擇
- 資料庫設計
- API 架構
- 安全設計
- 部署架構

### Database Architecture
> 資料庫層面的設計與優化

**適合閱讀者**:
- 資料庫管理員
- 後端開發者
- 性能優化工程師

**內容涵蓋**:
- Schema 設計
- 索引策略
- 查詢優化
- 資料遷移

### System Design
> 系統層面的設計模式與架構決策

**適合閱讀者**:
- 系統架構師
- 資深開發者
- 模組負責人

**內容涵蓋**:
- 模組化設計
- 服務間通訊
- 佇列系統
- 通知機制

---

## 🔍 快速導航

### 我想了解...

#### 整體架構
→ 閱讀 `technical-documentation.md`

#### 資料庫設計
→ 查看 `database/` 文件夾

#### 特定子系統設計
→ 查看 `system-design/` 文件夾

#### 模組化架構
→ 閱讀 `system-design/MODULAR_ARCHITECTURE_GUIDE.md`

#### 資料庫優化
→ 閱讀 `database/database-optimization-analysis.md`

---

## 📊 架構圖示

### 系統架構層次

```
┌─────────────────────────────────────────────┐
│ Frontend Layer (Vue.js 3 + TypeScript)      │
│ - Customer App (PWA)                        │
│ - Admin Dashboard                           │
│ - Kitchen Display                           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Edge Layer (Cloudflare Workers)             │
│ - API Endpoints                             │
│ - Realtime Services (Durable Objects)       │
│ - Authentication & Authorization            │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Data Layer                                   │
│ - D1 Database (SQLite)                      │
│ - KV Store (Cache)                          │
│ - R2 Storage (Images)                       │
└─────────────────────────────────────────────┘
```

### 核心技術棧

- **Frontend**: Vue.js 3, TypeScript, Vite
- **Backend**: Cloudflare Workers, Hono Framework
- **Database**: Cloudflare D1 (SQLite-compatible)
- **Cache**: Cloudflare KV
- **Storage**: Cloudflare R2
- **Realtime**: Durable Objects (WebSocket)
- **Testing**: Vitest, Playwright

---

## 🔗 相關文檔

- **功能實施**: `docs/features/`
- **API 文檔**: `docs/api/`
- **部署指南**: `docs/guides/deployment/`
- **性能優化**: `docs/performance/`
- **測試指南**: `docs/testing/`

---

## 📝 架構決策記錄 (ADR)

未來可以在此處添加架構決策記錄（Architecture Decision Records），記錄重要的技術決策及其理由。

**建議格式**:
- 決策背景
- 考慮的方案
- 選擇的方案及理由
- 結果與影響

---

**最後更新**: 2025-11-24
**架構版本**: 2.0 (Cloudflare Serverless)
**文檔總數**: 10+ 文件
