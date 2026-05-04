# MakanMasak 文檔索引

> **最後更新**: 2025-10-11
> **專案版本**: 2.0 (Cloudflare Serverless)
> **整體完成度**: 82%

## 📚 文檔導航

### 🎯 核心文檔

| 文件                                      | 說明                           | 位置   |
| ----------------------------------------- | ------------------------------ | ------ |
| [README.md](../README.md)                 | 專案概覽與快速開始指南         | 根目錄 |
| [CLAUDE.md](../CLAUDE.md)                 | AI 開發助手指南 (主要技術參考) | 根目錄 |
| [FEATURE_STATUS.md](../FEATURE_STATUS.md) | 功能開發狀態追蹤               | 根目錄 |

---

## 🚀 功能文檔

### 店家級 QR Code 系統 (✅ 100% 完成)

完整的三階段實作文檔,涵蓋後端、顧客端應用和管理介面。

| 文件                                                                                                    | 階段      | 說明               |
| ------------------------------------------------------------------------------------------------------- | --------- | ------------------ |
| [SHOP_QR_PHASE1_SUMMARY.md](./features/shop-qr/SHOP_QR_PHASE1_SUMMARY.md)                               | Phase 1   | 後端 API 實作總結  |
| [SHOP_QR_PHASE2_COMPLETION.md](./features/shop-qr/SHOP_QR_PHASE2_COMPLETION.md)                         | Phase 2   | 顧客端應用完成報告 |
| [SHOP_QR_PHASE3_COMPLETION.md](./features/shop-qr/SHOP_QR_PHASE3_COMPLETION.md)                         | Phase 3   | 管理介面完成報告   |
| [SHOP_QR_PHASE2_3_IMPLEMENTATION_GUIDE.md](./features/shop-qr/SHOP_QR_PHASE2_3_IMPLEMENTATION_GUIDE.md) | Phase 2-3 | 實作指南           |
| [SHOP_QR_TESTING_REPORT.md](./features/shop-qr/SHOP_QR_TESTING_REPORT.md)                               | 測試      | 測試報告與驗證結果 |

**實作統計**:

- 程式碼總量: ~2,860 行
- 後端: ~667 行
- 顧客端: ~1,770 行
- 管理介面: ~423 行
- API 端點: 5 個
- Vue 組件: 6 個

---

### 員工管理系統

#### 員工排班系統 (🔄 43% 進行中)

| 文件                                                                                                                            | 說明                     |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| [EMPLOYEE_MANAGEMENT_IMPLEMENTATION_PROGRESS.md](./features/employee-management/EMPLOYEE_MANAGEMENT_IMPLEMENTATION_PROGRESS.md) | 整體進度追蹤             |
| [SCHEDULING_IMPLEMENTATION_SUMMARY.md](./features/employee-management/SCHEDULING_IMPLEMENTATION_SUMMARY.md)                     | 排班系統實作總結         |
| [SCHEDULING_API_TESTING_GUIDE.md](./features/employee-management/SCHEDULING_API_TESTING_GUIDE.md)                               | API 測試指南             |
| [EMPLOYEE_SCHEDULING_IMPLEMENTATION.md](./EMPLOYEE_SCHEDULING_IMPLEMENTATION.md)                                                | 完整設計文檔 (2,100+ 行) |

**當前狀態**:

- ✅ 資料庫 Schema (100%)
- ✅ TypeScript 型別定義 (100%)
- 🔄 Service Layer (0%)
- ⏸️ API Routes (0%)
- ⏸️ Admin UI (0%)

#### 請假管理系統 (📋 100% 設計完成)

| 文件                                                                       | 說明                    |
| -------------------------------------------------------------------------- | ----------------------- |
| [LEAVE_MANAGEMENT_IMPLEMENTATION.md](./LEAVE_MANAGEMENT_IMPLEMENTATION.md) | 完整設計文檔 (1,865 行) |

**設計涵蓋**:

- ✅ 資料庫 Schema 設計
- ✅ API 端點規劃 (20+ 端點)
- ✅ UI 組件設計
- ✅ 多級審批工作流
- ✅ 台灣勞基法合規規則

**實作狀態**: 0% (等待開發)

---

## ⚡ 效能優化文檔

### PWA 效能優化 (✅ 95/100 分數)

| 文件                                                                                 | 說明                   |
| ------------------------------------------------------------------------------------ | ---------------------- |
| [PWA-TESTING-REPORT.md](./performance/PWA-TESTING-REPORT.md)                         | PWA 測試報告與優化結果 |
| [pwa-performance-analysis.md](./performance/pwa-performance-analysis.md)             | 效能分析報告           |
| [PERFORMANCE_ANALYSIS_REPORT.md](./performance/PERFORMANCE_ANALYSIS_REPORT.md)       | 整體效能分析           |
| [PERFORMANCE_OPTIMIZATION_GUIDE.md](./performance/PERFORMANCE_OPTIMIZATION_GUIDE.md) | 效能優化指南           |

**優化成果**:

- ⚡ 載入時間減少: 30-50%
- 📈 Cache 命中率: 85%+
- 💾 儲存效率提升: 25%
- 🔄 網路請求減少: 40%
- 📱 離線體驗改善: 60%

### 程式碼優化

| 文件                                                                           | 說明             |
| ------------------------------------------------------------------------------ | ---------------- |
| [BUNDLE_OPTIMIZATION_GUIDE.md](./performance/BUNDLE_OPTIMIZATION_GUIDE.md)     | Bundle 優化指南  |
| [REQUEST_DEDUPLICATION_GUIDE.md](./performance/REQUEST_DEDUPLICATION_GUIDE.md) | 請求去重機制指南 |

---

## 🗄️ 資料庫與遷移

### 資料庫遷移文檔

| 文件                                                                                                       | 說明                |
| ---------------------------------------------------------------------------------------------------------- | ------------------- |
| [MIGRATION_FIXES_SUMMARY.md](./migration/MIGRATION_FIXES_SUMMARY.md)                                       | 遷移修復總結        |
| [SQLITE_CONSTRAINT_RULES.md](./migration/SQLITE_CONSTRAINT_RULES.md)                                       | SQLite 約束規則指南 |
| [DATABASE_OPTIMIZATION_IMPLEMENTATION_GUIDE.md](./migration/DATABASE_OPTIMIZATION_IMPLEMENTATION_GUIDE.md) | 資料庫優化實作指南  |

**重要遷移檔案位置**: `packages/database/migrations/`

**資料庫結構**:

- 核心業務表: 15+ 張
- 員工管理表: 10+ 張 (設計階段)
- AI 分析表: 6 張
- 系統與安全表: 8+ 張

---

## 🚢 部署與安全

| 文件                                                              | 說明         |
| ----------------------------------------------------------------- | ------------ |
| [DEPLOYMENT_SETUP.md](./deployment/DEPLOYMENT_SETUP.md)           | 部署設定指南 |
| [SECURITY_AUDIT_REPORT.md](./deployment/SECURITY_AUDIT_REPORT.md) | 安全稽核報告 |

**部署環境**:

- 生產環境: `makanmasak-prod` (Cloudflare)
- 測試環境: `makanmasak-staging` (Cloudflare)
- 本地開發: Local SQLite

---

## 📡 API 文檔

| 文件                                                     | 說明             |
| -------------------------------------------------------- | ---------------- |
| [API_PAGINATION_GUIDE.md](./api/API_PAGINATION_GUIDE.md) | API 分頁機制指南 |

**API 端點總覽**: 85+ 端點

主要模組:

- `/api/v1/auth` - 認證系統
- `/api/v1/restaurants` - 餐廳管理 (含 Shop QR)
- `/api/v1/menu` - 菜單管理
- `/api/v1/orders` - 訂單管理
- `/api/v1/tables` - 桌位管理
- `/api/v1/seats` - 座位管理
- `/api/v1/customers` - 顧客管理 (新)
- `/api/v1/leaves` - 請假管理 (規劃中)
- `/api/v1/scheduling` - 排班管理 (進行中)

---

## 🏗️ 實作文檔

### 開發進度與里程碑

| 文件                                                                      | 說明           |
| ------------------------------------------------------------------------- | -------------- |
| [IMPLEMENTATION_SUMMARY.md](./implementation/IMPLEMENTATION_SUMMARY.md)   | 實作總結       |
| [IMPLEMENTATION_ROADMAP.md](./implementation/IMPLEMENTATION_ROADMAP.md)   | 實作路線圖     |
| [WEEK3_COMPLETION_REPORT.md](./implementation/WEEK3_COMPLETION_REPORT.md) | 第三週完成報告 |

---

## 📦 已封存文檔

已棄用或過時的文檔,保留作為歷史參考。

| 文件                                                                                           | 說明             | 封存原因                  |
| ---------------------------------------------------------------------------------------------- | ---------------- | ------------------------- |
| [PAYMENT_SYSTEM_IMPLEMENTATION_SUMMARY.md](./archive/PAYMENT_SYSTEM_IMPLEMENTATION_SUMMARY.md) | 支付系統實作總結 | 支付系統已移除 (簡化架構) |
| [CLAUDE_UPDATE_EMPLOYEE_SYSTEMS.md](./archive/CLAUDE_UPDATE_EMPLOYEE_SYSTEMS.md)               | 員工系統更新記錄 | 已整合至新文檔            |

---

## 🎯 快速導航

### 我想要...

#### 了解專案概況

→ 閱讀 [README.md](../README.md)

#### 開始開發新功能

→ 閱讀 [CLAUDE.md](../CLAUDE.md)

#### 查看功能開發進度

→ 閱讀 [FEATURE_STATUS.md](../FEATURE_STATUS.md)

#### 了解 Shop QR 系統

→ 閱讀 [Shop QR 文檔](./features/shop-qr/)

#### 實作員工排班功能

→ 閱讀 [EMPLOYEE_SCHEDULING_IMPLEMENTATION.md](./EMPLOYEE_SCHEDULING_IMPLEMENTATION.md)
→ 追蹤進度: [SCHEDULING_IMPLEMENTATION_SUMMARY.md](./features/employee-management/SCHEDULING_IMPLEMENTATION_SUMMARY.md)

#### 實作請假管理功能

→ 閱讀 [LEAVE_MANAGEMENT_IMPLEMENTATION.md](./LEAVE_MANAGEMENT_IMPLEMENTATION.md)

#### 優化應用效能

→ 閱讀 [效能優化文檔](./performance/)

#### 執行資料庫遷移

→ 閱讀 [遷移文檔](./migration/)

#### 部署到生產環境

→ 閱讀 [DEPLOYMENT_SETUP.md](./deployment/DEPLOYMENT_SETUP.md)

#### 查看 API 文檔

→ 閱讀 [API 文檔](./api/)

---

## 📊 專案統計

### 程式碼品質

- **TypeScript 合規**: ✅ 100% (0 錯誤)
- **ESLint 合規**: ✅ 100% (0 錯誤, 0 警告)
- **測試覆蓋率**: 📊 全面測試套件已實作

### 效能指標

- **PWA 分數**: 95/100
- **API 回應時間**: P99 < 300ms
- **資料庫查詢**: P95 < 100ms
- **圖片載入**: P90 < 1s

### 功能完成度

- **整體進度**: 82%
- **已完成功能**: 12 個主要功能
- **進行中功能**: 3 個
- **規劃中功能**: 8 個

---

## 🔄 文檔更新記錄

### 2025-10-11

- ✅ 完成文檔結構重組
- ✅ 創建 docs/ 資料夾架構
- ✅ 移動所有文檔到適當位置
- ✅ 更新所有交叉引用路徑
- ✅ 創建文檔索引 (本檔案)

### 2025-10-10

- ✅ 更新 CLAUDE.md (加入 Shop QR 與員工管理系統)
- ✅ 完整改寫 README.md
- ✅ 創建 FEATURE_STATUS.md

### 2025-10-09

- ✅ 資料庫遷移修復
- ✅ 密碼安全性增強
- ✅ 移除支付系統 (架構簡化)

### 2025-09-23

- ✅ PWA 效能優化完成 (95/100 分數)

### 2025-09-07

- ✅ 完成 TypeScript 100% 合規
- ✅ 完成 ESLint 100% 合規

---

## 📞 支援與問題回報

- **GitHub Issues**: [專案 Issues](https://github.com/your-org/makanmasak/issues)
- **技術文檔**: 參考 [CLAUDE.md](../CLAUDE.md)
- **API 文檔**: 參考 [API 指南](./api/)

---

## 📝 貢獻指南

如需貢獻文檔或程式碼:

1. 閱讀 [CLAUDE.md](../CLAUDE.md) 了解專案架構
2. 查看 [FEATURE_STATUS.md](../FEATURE_STATUS.md) 了解當前進度
3. 參考相關功能的實作文檔
4. 遵循專案的程式碼風格和測試標準

---

**文檔索引版本**: 1.0
**最後維護**: 2025-10-11
**維護者**: Claude AI Assistant
