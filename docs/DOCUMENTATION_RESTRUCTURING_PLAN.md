# 文檔重組計劃 (Documentation Restructuring Plan)

## 概述

當前 docs 文件夾包含 140+ 個文件，其中 40+ 個文件直接放在根目錄，導致文檔結構混亂、難以維護和查找。本計劃旨在建立清晰、有邏輯的文件夾結構。

## 🎯 目標

1. **清晰分類**：按照功能、用途、階段分類文檔
2. **易於查找**：開發者能快速找到所需文檔
3. **便於維護**：新文檔有明確的歸屬位置
4. **歷史追溯**：將臨時報告歸檔，保留歷史記錄

## 📁 新的文件夾結構

```
docs/
├── README.md                          # 📖 文檔導航（主入口）
├── INDEX.md                           # 📑 文檔索引（保持現有）
├── requirements.md                    # 📋 產品需求文檔
│
├── api/                               # 🔌 API 文檔
│   ├── README.md                      # API 文檔導航
│   ├── endpoints/                     # API 端點文檔
│   │   ├── auth.md
│   │   ├── restaurants.md
│   │   ├── menu.md
│   │   ├── orders.md
│   │   └── ...
│   ├── schemas/                       # API Schema 文檔
│   └── guides/
│       └── API_PAGINATION_GUIDE.md
│
├── architecture/                      # 🏗️ 架構文檔
│   ├── README.md
│   ├── technical-documentation.md     # 技術規格（主文檔）
│   ├── project-architecture.md        # 專案架構概覽
│   ├── database/                      # 數據庫架構
│   │   ├── schema-overview.md
│   │   ├── DATABASE_ARCHITECTURE_COMPARISON.md
│   │   ├── database-optimization-analysis.md
│   │   ├── DATABASE_REFACTORING_INDEX.md
│   │   ├── DATABASE_REFACTORING_PLAN.md
│   │   └── DATABASE_REFACTORING_EXECUTIVE_SUMMARY.md
│   └── system-design/                 # 系統設計
│       ├── MODULAR_ARCHITECTURE_GUIDE.md
│       ├── QUEUE_MODULAR_API.md
│       ├── NOTIFICATION_SYSTEM.md
│       └── VERIFICATION_SYSTEM.md
│
├── features/                          # ✨ 功能實現文檔
│   ├── README.md                      # 功能文檔索引
│   │
│   ├── ai-analytics/                  # AI 分析功能
│   │   ├── README.md
│   │   ├── AI_ANALYTICS_IMPLEMENTATION.md
│   │   ├── AI_ANALYTICS_QUICK_START.md
│   │   ├── AI_ANALYTICS_UI_GUIDE.md
│   │   └── AI_ANALYTICS_OPTIMIZATION_REPORT.md
│   │
│   ├── employee-management/           # 員工管理
│   │   ├── README.md
│   │   ├── scheduling/                # 排班系統
│   │   │   ├── EMPLOYEE_SCHEDULING_IMPLEMENTATION.md
│   │   │   ├── SCHEDULING_IMPLEMENTATION_SUMMARY.md
│   │   │   └── SCHEDULING_API_TESTING_GUIDE.md
│   │   ├── leave-management/          # 請假管理
│   │   │   └── LEAVE_MANAGEMENT_IMPLEMENTATION.md
│   │   └── EMPLOYEE_MANAGEMENT_IMPLEMENTATION.md
│   │
│   ├── partnership-system/            # 合作夥伴系統
│   │   ├── README.md
│   │   ├── PARTNERSHIP_SYSTEM_IMPLEMENTATION.md
│   │   └── CORPORATE_PARTNERSHIP_IMPLEMENTATION_PLAN.md
│   │
│   ├── realtime-services/             # 實時服務
│   │   ├── README.md
│   │   ├── REALTIME_SERVICES_IMPLEMENTATION.md
│   │   ├── REALTIME_FRONTEND_INTEGRATION_SUMMARY.md
│   │   ├── REALTIME_TESTING_GUIDE.md
│   │   ├── phases/                    # 各階段文檔
│   │   │   ├── REALTIME_PHASE3_SUMMARY.md
│   │   │   ├── REALTIME_PHASE4_KICKOFF.md
│   │   │   └── REALTIME_PHASE4_PLAN.md
│   │   └── testing/
│   │       └── REALTIME_TEST_RESULTS.md
│   │
│   ├── shop-qr/                       # 商店 QR（已存在）
│   │   ├── README.md
│   │   ├── SHOP_QR_PHASE1_SUMMARY.md
│   │   ├── SHOP_QR_PHASE2_3_IMPLEMENTATION_GUIDE.md
│   │   ├── SHOP_QR_PHASE2_COMPLETION.md
│   │   ├── SHOP_QR_PHASE3_COMPLETION.md
│   │   └── SHOP_QR_TESTING_REPORT.md
│   │
│   ├── seat-management/               # 座位管理
│   │   └── SEAT_MANAGEMENT_GUIDE.md
│   │
│   └── security/                      # 安全功能
│       └── PASSWORD_SECURITY_MIGRATION.md
│
├── guides/                            # 📚 開發指南
│   ├── README.md
│   ├── development/                   # 開發指南
│   │   ├── TIMESTAMP_BEST_PRACTICES.md
│   │   ├── CLAUDE_legacy.md
│   │   ├── gemini.md
│   │   └── restructuring-challenges.md
│   ├── deployment/                    # 部署指南（已存在）
│   │   ├── DEPLOYMENT_GUIDE.md
│   │   ├── DEPLOYMENT_SETUP.md
│   │   ├── ENVIRONMENT_CHECKLIST.md
│   │   ├── SECURITY_AUDIT_REPORT.md
│   │   └── TROUBLESHOOTING.md
│   └── testing-guide.md               # 測試指南（根級別）
│
├── implementation/                    # 🚀 實施文檔
│   ├── README.md
│   ├── roadmaps/                      # 路線圖
│   │   ├── IMPLEMENTATION_ROADMAP.md
│   │   └── new-features-implementation.md
│   ├── summaries/                     # 實施總結
│   │   ├── IMPLEMENTATION_SUMMARY.md (root)
│   │   ├── IMPLEMENTATION_SUMMARY.md (implementation/)
│   │   └── WEEK3_COMPLETION_REPORT.md
│   └── testing/                       # 測試實施
│       ├── TESTING_AND_API_DOCS_IMPLEMENTATION_PLAN.md
│       ├── TESTING_INFRASTRUCTURE_PHASE1_COMPLETION.md
│       ├── TESTING_INFRASTRUCTURE_PHASE2-3_COMPLETION.md
│       └── TESTING_INFRASTRUCTURE_PROGRESS_UPDATE.md
│
├── migration/                         # 🔄 遷移文檔（已存在）
│   ├── DATABASE_OPTIMIZATION_IMPLEMENTATION_GUIDE.md
│   ├── MIGRATION_FIXES_SUMMARY.md
│   ├── RESTAURANT_ID_MIGRATION_PLAN.md
│   ├── SQLITE_CONSTRAINT_RULES.md
│   └── migrations_v2/                 # V2 遷移記錄
│       ├── EXECUTION_LOG.md
│       ├── PHASE2_COMPLETE.md
│       ├── PHASE3_SUMMARY.md
│       ├── PROGRESS_REPORT_*.md
│       ├── PROJECT_COMPLETE.md
│       ├── TEST_STATUS.md
│       └── TESTING_GUIDE.md
│
├── performance/                       # ⚡ 性能優化（已存在）
│   ├── BUNDLE_OPTIMIZATION_GUIDE.md
│   ├── PERFORMANCE_ANALYSIS_REPORT.md
│   ├── PERFORMANCE_OPTIMIZATION_GUIDE.md
│   ├── pwa-performance-analysis.md
│   ├── PWA-TESTING-REPORT.md
│   └── REQUEST_DEDUPLICATION_GUIDE.md
│
├── security/                          # 🔒 安全文檔（已存在）
│   ├── SECURITY.md
│   ├── DEPLOYMENT_SECURITY_CHECKLIST.md
│   └── SECURITY_FIXES_2025-10-11.md
│
├── testing/                           # 🧪 測試文檔（已存在）
│   ├── README.md
│   ├── guides/
│   │   ├── TESTING_GUIDE.md
│   │   ├── AUTOMATION_TOOLS_GUIDE.md
│   │   ├── TEST_DOCUMENTATION_GUIDE.md
│   │   ├── TRACKING_DASHBOARD_GUIDE.md
│   │   └── VISUAL_REGRESSION_AND_SECURITY_TESTING_GUIDE.md
│   ├── factory-pattern/               # Factory Pattern 文檔
│   │   ├── FACTORY_BEST_PRACTICES.md
│   │   ├── FACTORY_CHAMPIONS_PROGRAM.md
│   │   ├── FACTORY_FAQ.md
│   │   ├── FACTORY_QUICK_REFERENCE.md
│   │   ├── PILOT_MIGRATION_PLAN.md
│   │   └── examples/
│   │       ├── README.md
│   │       ├── 01-basic-usage.ts
│   │       ├── 02-relationships.ts
│   │       └── 03-complete-environment.ts
│   ├── reports/                       # 測試報告（已存在的報告）
│   │   ├── API_E2E_TEST_PROGRESS.md
│   │   ├── GROUP_ORDERS_E2E_TEST_REPORT.md
│   │   ├── MOCK_DB_OPTIMIZATION_REPORT.md
│   │   ├── TEST_ENHANCEMENT_PROGRESS_REPORT.md
│   │   ├── TEST_ENHANCEMENT_SUMMARY.md
│   │   ├── TEST_IMPLEMENTATION_COMPLETION_REPORT.md
│   │   ├── TESTING_INFRASTRUCTURE_COMPLETION_REPORT.md
│   │   └── WEEK1_INFRASTRUCTURE_SUMMARY.md
│   └── roadmaps/
│       └── TEST_ENHANCEMENT_ROADMAP.md
│
├── user-manuals/                      # 📱 用戶手冊（已存在）
│   ├── README.md
│   ├── AI_ANALYTICS_USER_MANUAL.md
│   ├── SCHEDULING_MANUAL.md
│   ├── LEAVE_MANAGEMENT_MANUAL.md
│   ├── en-US/
│   ├── fil-PH/
│   ├── id-ID/
│   ├── ja-JP/
│   ├── vi-VN/
│   └── zh-TW/
│
├── workshops/                         # 🎓 工作坊文檔（已存在）
│   └── WEEK2_PILOT_SHARING.md
│
├── archive/                           # 📦 歸檔文件
│   ├── README.md                      # 說明歸檔策略
│   ├── CHANGELOG.md                   # 變更日誌
│   ├── reports/                       # 各種報告
│   │   ├── API_DOCUMENTATION_COMPLETION_REPORT.md
│   │   ├── API_TEST_FINAL_STATUS_REPORT.md
│   │   ├── API_TEST_PROGRESS_REPORT.md
│   │   ├── TESTING_API_FINAL_STATUS.md
│   │   └── TESTING_API_VERIFICATION_REPORT.md
│   ├── bug-fixes/                     # Bug 修復記錄
│   │   ├── BUG_FIXES_2025-10-11.md
│   │   └── SECURITY_FIXES_2025-10-11.md
│   └── deprecated/                    # 已棄用文檔
│       ├── CLAUDE_UPDATE_EMPLOYEE_SYSTEMS.md
│       └── PAYMENT_SYSTEM_IMPLEMENTATION_SUMMARY.md
│
└── locales/                           # 🌍 多語言文檔
    └── zh-CN/                         # 簡體中文
        ├── README.md
        ├── CLAUDE-指南.md
        ├── 實時服務實施.md
        ├── 技術文檔.md
        ├── 座位管理.md
        └── 員工排班實施檢查清單.md
```

## 🔄 文件移動計劃

### Phase 1: 創建新文件夾結構

```bash
# 創建主要文件夾
mkdir -p docs/api/endpoints
mkdir -p docs/api/schemas
mkdir -p docs/api/guides
mkdir -p docs/architecture/database
mkdir -p docs/architecture/system-design
mkdir -p docs/features/ai-analytics
mkdir -p docs/features/employee-management/scheduling
mkdir -p docs/features/employee-management/leave-management
mkdir -p docs/features/partnership-system
mkdir -p docs/features/realtime-services/phases
mkdir -p docs/features/realtime-services/testing
mkdir -p docs/features/seat-management
mkdir -p docs/features/security
mkdir -p docs/guides/development
mkdir -p docs/implementation/roadmaps
mkdir -p docs/implementation/summaries
mkdir -p docs/implementation/testing
mkdir -p docs/testing/guides
mkdir -p docs/testing/factory-pattern
mkdir -p docs/testing/reports
mkdir -p docs/testing/roadmaps
mkdir -p docs/archive/reports
mkdir -p docs/archive/bug-fixes
mkdir -p docs/archive/deprecated
mkdir -p docs/locales/zh-CN
```

### Phase 2: 移動文件

#### 2.1 AI Analytics 文檔
```bash
mv docs/AI_ANALYTICS_*.md docs/features/ai-analytics/
```

#### 2.2 Realtime Services 文檔
```bash
mv docs/REALTIME_*.md docs/features/realtime-services/
mv docs/features/realtime-services/REALTIME_PHASE*.md docs/features/realtime-services/phases/
mv docs/features/realtime-services/REALTIME_TEST_RESULTS.md docs/features/realtime-services/testing/
```

#### 2.3 Partnership System 文檔
```bash
mv docs/PARTNERSHIP_SYSTEM_IMPLEMENTATION.md docs/features/partnership-system/
mv docs/CORPORATE_PARTNERSHIP_IMPLEMENTATION_PLAN.md docs/features/partnership-system/
```

#### 2.4 Employee Management 文檔
```bash
mv docs/EMPLOYEE_SCHEDULING_IMPLEMENTATION.md docs/features/employee-management/scheduling/
mv docs/LEAVE_MANAGEMENT_IMPLEMENTATION.md docs/features/employee-management/leave-management/
mv docs/features/employee-management/EMPLOYEE_MANAGEMENT_IMPLEMENTATION.md docs/features/employee-management/
mv docs/features/employee-management/SCHEDULING_*.md docs/features/employee-management/scheduling/
```

#### 2.5 Database 文檔
```bash
mv docs/DATABASE_*.md docs/architecture/database/
mv docs/database-optimization-analysis.md docs/architecture/database/
```

#### 2.6 Architecture 文檔
```bash
mv docs/project-architecture.md docs/architecture/
mv docs/MODULAR_ARCHITECTURE_GUIDE.md docs/architecture/system-design/
mv docs/QUEUE_MODULAR_API.md docs/architecture/system-design/
mv docs/NOTIFICATION_SYSTEM.md docs/architecture/system-design/
mv docs/VERIFICATION_SYSTEM.md docs/architecture/system-design/
```

#### 2.7 Testing 文檔
```bash
mv docs/TESTING_AND_API_DOCS_IMPLEMENTATION_PLAN.md docs/implementation/testing/
mv docs/TESTING_INFRASTRUCTURE_*.md docs/implementation/testing/
mv docs/TESTING_API_*.md docs/archive/reports/
```

#### 2.8 API 文檔
```bash
mv docs/API_DOCUMENTATION_COMPLETION_REPORT.md docs/archive/reports/
mv docs/API_TEST_*.md docs/archive/reports/
```

#### 2.9 Implementation 文檔
```bash
mv docs/IMPLEMENTATION_SUMMARY.md docs/implementation/summaries/IMPLEMENTATION_SUMMARY_ROOT.md
mv docs/implementation/IMPLEMENTATION_SUMMARY.md docs/implementation/summaries/
mv docs/implementation/IMPLEMENTATION_ROADMAP.md docs/implementation/roadmaps/
mv docs/implementation/WEEK3_COMPLETION_REPORT.md docs/implementation/summaries/
mv docs/new-features-implementation.md docs/implementation/roadmaps/
```

#### 2.10 Security 文檔
```bash
mv docs/PASSWORD_SECURITY_MIGRATION.md docs/features/security/
mv docs/SECURITY_FIXES_2025-10-11.md docs/archive/bug-fixes/
mv docs/BUG_FIXES_2025-10-11.md docs/archive/bug-fixes/
```

#### 2.11 Development Guides
```bash
mv docs/development/* docs/guides/development/
mv docs/gemini.md docs/guides/development/
mv docs/restructuring-challenges.md docs/guides/development/
```

#### 2.12 Testing Factory Pattern
```bash
mkdir -p docs/testing/factory-pattern/examples
mv docs/testing/FACTORY_*.md docs/testing/factory-pattern/
mv docs/testing/PILOT_MIGRATION_PLAN.md docs/testing/factory-pattern/
mv docs/testing/examples/* docs/testing/factory-pattern/examples/
```

#### 2.13 Testing Guides
```bash
mv docs/testing/TESTING_GUIDE.md docs/testing/guides/
mv docs/testing/AUTOMATION_TOOLS_GUIDE.md docs/testing/guides/
mv docs/testing/TEST_DOCUMENTATION_GUIDE.md docs/testing/guides/
mv docs/testing/TRACKING_DASHBOARD_GUIDE.md docs/testing/guides/
mv docs/testing/VISUAL_REGRESSION_AND_SECURITY_TESTING_GUIDE.md docs/testing/guides/
```

#### 2.14 Testing Reports
```bash
mv docs/testing/*_REPORT.md docs/testing/reports/
mv docs/testing/*_SUMMARY.md docs/testing/reports/
mv docs/testing/WEEK1_INFRASTRUCTURE_SUMMARY.md docs/testing/reports/
```

#### 2.15 中文文檔
```bash
# 需要先修復文件名亂碼問題
mv docs/zh-cn/* docs/locales/zh-CN/
```

#### 2.16 歸檔文件
```bash
# 移動到 archive（已在上面的步驟中完成）
```

### Phase 3: 清理與優化

1. **刪除空文件夾**
2. **創建各文件夾的 README.md**
3. **更新主 README.md 和 INDEX.md**
4. **修復中文文件名亂碼**

## 📝 各文件夾的 README.md 內容

每個主要文件夾都應該有一個 README.md 文件，說明：
- 該文件夾的用途
- 包含的文檔類型
- 如何使用這些文檔
- 相關鏈接

## ✅ 驗證清單

重組完成後需要檢查：
- [ ] 所有文件都已正確移動
- [ ] 沒有文件遺失
- [ ] 所有文件夾都有 README.md
- [ ] 主 README.md 和 INDEX.md 已更新
- [ ] 文檔內部的鏈接已修正
- [ ] 中文文件名亂碼已修復
- [ ] Git 歷史記錄保持完整

## 🔗 文檔導航更新

更新以下文件：
1. **docs/README.md** - 主要文檔導航
2. **docs/INDEX.md** - 詳細文檔索引
3. **CLAUDE.md** - 更新文檔路徑引用
4. **各功能文件夾的 README.md** - 創建或更新

## 📅 執行時間表

- **Phase 1**: 創建文件夾結構（15 分鐘）
- **Phase 2**: 移動文件（30-45 分鐘）
- **Phase 3**: 清理與優化（30 分鐘）
- **驗證與測試**: 20 分鐘

**總計**: 約 1.5-2 小時

## 🎯 預期效果

重組後：
- ✅ 文檔按功能/用途清晰分類
- ✅ 開發者能快速找到所需文檔
- ✅ 新文檔有明確的歸屬位置
- ✅ 歷史報告已歸檔但仍可追溯
- ✅ 多語言文檔結構清晰

---

**創建日期**: 2025-11-24
**狀態**: 待執行
**負責人**: Claude Code
