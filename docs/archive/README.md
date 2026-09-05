# Archive / 歸檔文件

本文件夾包含歷史文檔、完成報告和已棄用的文檔。

## 📂 文件夾結構

### 📊 Reports (`reports/`)

各階段完成報告與測試報告

**API & Testing Reports**:

- `API_DOCUMENTATION_COMPLETION_REPORT.md` - API 文檔完成報告
- `API_TEST_FINAL_STATUS_REPORT.md` - API 測試最終狀態
- `API_TEST_PROGRESS_REPORT.md` - API 測試進度報告
- `TESTING_API_FINAL_STATUS.md` - 測試 API 最終狀態
- `TESTING_API_VERIFICATION_REPORT.md` - 測試 API 驗證報告

**用途**: 保留歷史記錄，追溯項目進度

### 🗄️ Historical Reports (`historical-reports/`)

早期實作藍圖、測試基礎建設階段報告，以及已被取代的掃描報告

- `2026-05-02-technical-debt-scan.md` - **技術債掃描（已取代 2026-09-05）**。原本位於
  `docs/TECHNICAL_DEBT_TODO.md`，一度自稱 primary working list，但 2026-07-17
  之後就沒有實質更新。仍開著的項目已於 2026-09-05 逐一驗證後移入
  [`docs/TODOS.md`](../TODOS.md)。**它的頭條數字全部過期**（宣稱 16 個
  production 佔位符實為 0、172 行 TODO 實為 27 行），檔頭有完整的 superseded
  banner 列出哪兩段是主動錯誤。保留是因為其中的 resolution 紀錄（什麼壞了、
  什麼修好的、哪個 commit）是有用的歷史，而 `multi_branch` 移除等決定只有這裡寫了。
- `IMPLEMENTATION_ROADMAP.md`、`IMPLEMENTATION_SUMMARY*.md`、`INDEX_LEGACY.md` - 早期實作規劃
- `TESTING_INFRASTRUCTURE_*.md`、`WEEK3_COMPLETION_REPORT.md` - 測試基礎建設階段報告
- `migrations-v2/` - 舊 migration 軌資料

**用途**: 保留歷史脈絡；**這裡沒有任何一份是 live backlog**

### 🐛 Bug Fixes (`bug-fixes/`)

Bug 修復記錄

- `BUG_FIXES_2025-10-11.md` - 2025-10-11 Bug 修復
- `SECURITY_FIXES_2025-10-11.md` - 2025-10-11 安全修復

**用途**: 記錄重要的 Bug 修復，便於問題追溯

### 📦 Deprecated (`deprecated/`)

已棄用/已被取代的文檔（每份文件開頭都有 ⚠️ SUPERSEDED 橫幅說明取代原因與現行來源）

- `CLAUDE_UPDATE_EMPLOYEE_SYSTEMS.md` - 員工系統更新（已整合到新文檔）
- `PAYMENT_SYSTEM_IMPLEMENTATION_SUMMARY.md` - 支付系統實施摘要（功能已移除）
- `REALTIME_SERVICES_IMPLEMENTATION.md` - 即時服務架構文件（描述的 `AdvancedRealtimeSession` 已刪除）
- `REAL_BROWSER_REAL_API_GAP_PRIORITY.md` - 描述的整個 E2E 測試樹已刪除重建
- `PRODUCTION_READINESS_REPORT.md` - 同上，引用的 E2E 測試樹已刪除重建
- `PERSONA_TEST_CHECKLIST_AUDIT.md` - 角色測試覆蓋審核，引用的 spec 檔案已刪除
- `leaves-module-test-report.md` - 請假模組測試報告，引用的測試檔已刪除重寫
- `RESTAURANT_ID_MIGRATION_PLAN.md` - 餐廳 ID 遷移計畫，實際採取了不同方案
- `DATABASE_OPTIMIZATION_IMPLEMENTATION_GUIDE.md` - 資料庫優化指南，描述的遷移檔案從未真正套用
- `MIGRATION_FIXES_SUMMARY.md` - 遷移修復總結，描述的修復實際上是被跳過而非部署
- `factory-pattern/` - 整套 factory 測試資料建構模式提案，全部指示從不存在的
  `@makanmasak/testing-utils` 套件 import，與 `CLAUDE.md` 現行明確規範
  （builder 應就近放在測試檔旁）直接矛盾；該套件從未真正建成

**用途**: 保留歷史文檔，了解系統演變；每份文件僅供理解脈絡，不應作為現行狀態或部署依據

### 📝 Root Level Archives

- **`CHANGELOG.md`** ⭐ - 完整變更日誌（保留在根目錄以便訪問）

---

## 🎯 歸檔策略

### 何時歸檔

文檔應歸檔當:

1. ✅ 項目階段完成（如 Phase 1-3 完成報告）
2. ✅ 功能已移除或重構（如舊支付系統）
3. ✅ 文檔已被新版本取代
4. ✅ 臨時報告已不再需要參考

### 不應歸檔

以下文檔應保留在主文檔區:

- 🔴 持續更新的文檔（如 CLAUDE.md）
- 🔴 核心技術文檔（如架構文檔）
- 🔴 使用手冊（如用戶手冊）
- 🔴 實施指南（如功能實施文檔）

---

## 📚 如何使用歸檔文檔

### 查找歷史報告

```bash
# 查找 API 相關報告
ls docs/archive/reports/API*.md

# 查找特定日期的修復
ls docs/archive/bug-fixes/*2025-10-11*.md
```

### 查看變更歷史

```bash
# 查看完整變更日誌
cat docs/archive/CHANGELOG.md

# 查找特定功能的歷史
grep -r "Partnership System" docs/archive/
```

---

## 🗂️ 歸檔文件清單

### Reports (5 個文件)

1. API 文檔完成報告
2. API 測試最終狀態報告
3. API 測試進度報告
4. 測試 API 最終狀態
5. 測試 API 驗證報告

### Bug Fixes (2 個文件)

1. Bug 修復 2025-10-11
2. 安全修復 2025-10-11

### Deprecated (15 個文件，含 factory-pattern/ 子資料夾 5 份)

1. 員工系統更新（已整合）
2. 支付系統實施摘要（已移除）
3. 即時服務架構文件（AdvancedRealtimeSession 已刪除）
4. Real Browser/API 測試缺口優先序（E2E 測試樹已重建）
5. 生產就緒報告（E2E 測試樹已重建）
6. 角色測試檢查審核（spec 檔案已刪除）
7. 請假模組測試報告（測試檔已重寫）
8. 餐廳 ID 遷移計畫（實際方案不同）
9. 資料庫優化實作指南（遷移從未套用）
10. 遷移修復總結（修復實際被跳過）
11-15. `factory-pattern/`（5 份）- 整套 factory 測試資料建構提案，import 不存在的套件

### Root Level (1 個文件)

1. CHANGELOG.md ⭐

---

## 📖 變更日誌 (CHANGELOG.md)

變更日誌記錄項目的所有重要變更，包括:

- 新功能
- Bug 修復
- 破壞性變更
- 性能改進
- 安全更新

**格式**: 按日期倒序排列，最新的在最上面

---

## 🔗 相關文檔

- **主文檔**: `docs/README.md`
- **功能文檔**: `docs/features/`
- **實施文檔**: `docs/implementation/`

---

## 💡 貢獻指南

### 歸檔文檔時

1. 確認文檔不再需要頻繁訪問
2. 將文檔移動到適當的子文件夾
3. 在原文檔位置添加指向歸檔的鏈接（如適用）
4. 更新主 INDEX.md 文件

### 編寫變更日誌

遵循 [Keep a Changelog](https://keepachangelog.com/) 標準:

```markdown
## [版本號] - YYYY-MM-DD

### Added

- 新增的功能

### Changed

- 改變的功能

### Fixed

- 修復的 Bug

### Removed

- 移除的功能
```

---

**最後更新**: 2026-07-05
**歸檔文件總數**: 23+ 文件
**歸檔策略**: 階段完成後歸檔，或文件描述的程式碼/測試已被刪除或取代後歸檔
