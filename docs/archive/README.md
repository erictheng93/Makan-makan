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

### 🐛 Bug Fixes (`bug-fixes/`)

Bug 修復記錄

- `BUG_FIXES_2025-10-11.md` - 2025-10-11 Bug 修復
- `SECURITY_FIXES_2025-10-11.md` - 2025-10-11 安全修復

**用途**: 記錄重要的 Bug 修復，便於問題追溯

### 📦 Deprecated (`deprecated/`)

已棄用的文檔

- `CLAUDE_UPDATE_EMPLOYEE_SYSTEMS.md` - 員工系統更新（已整合到新文檔）
- `PAYMENT_SYSTEM_IMPLEMENTATION_SUMMARY.md` - 支付系統實施摘要（功能已移除）

**用途**: 保留歷史文檔，了解系統演變

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

### Deprecated (2 個文件)

1. 員工系統更新（已整合）
2. 支付系統實施摘要（已移除）

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

**最後更新**: 2025-11-24
**歸檔文件總數**: 10+ 文件
**歸檔策略**: 階段完成後歸檔
