# MakanMakan Documentation / 項目文檔

歡迎來到 MakanMakan 文檔中心！本文檔庫包含完整的技術文檔、功能實施指南、API 參考和用戶手冊。

> **📍 快速導航**: 新手請從 [CLAUDE.md](../CLAUDE.md) 開始，了解項目概覽和開發環境設置。

---

## 📂 文檔結構

### 🔌 [API Documentation](./api/)

REST API 文檔與使用指南

- API 端點參考
- 認證與授權
- 請求/回應格式
- 分頁與過濾
- **查看**: [API README](./api/README.md)

### 🏗️ [Architecture](./architecture/)

系統架構與技術規格

- ⭐ [技術文檔](./architecture/technical-documentation.md) - 完整技術規格（主文檔）
- [專案架構](./architecture/project-architecture.md) - 架構概覽
- [資料庫架構](./architecture/database/) - D1 設計與優化
- [系統設計](./architecture/system-design/) - 模組化架構
- **查看**: [Architecture README](./architecture/README.md)

### ✨ [Features](./features/)

各功能模組的實施文檔

- 🤖 [AI Analytics](./features/ai-analytics/) - AI 分析功能
- 👥 [Employee Management](./features/employee-management/) - 員工管理（排班/請假）
- 🤝 [Partnership System](./features/partnership-system/) - 合作夥伴系統
- ⚡ [Realtime Services](./features/realtime-services/) - 實時服務與 WebSocket
- 🏪 [Shop QR](./features/shop-qr/) - 店家 QR 碼系統
- 💺 [Seat Management](./features/seat-management/) - 座位管理
- 🔒 [Security](./features/security/) - 安全功能
- **查看**: [Features README](./features/README.md)

### 📚 [Guides](./guides/)

開發與部署指南

- [測試指南](./guides/testing-guide.md) - 測試最佳實踐
- [開發指南](./guides/development/) - 開發最佳實踐
- [部署指南](./guides/deployment/) - 部署步驟與檢查清單

### 🚀 [Implementation](./implementation/)

實施計劃與進度報告

- [Roadmaps](./implementation/roadmaps/) - 功能路線圖
- [Summaries](./implementation/summaries/) - 實施總結
- [Testing](./implementation/testing/) - 測試基礎設施實施

### 🔄 [Migration](./migration/)

資料庫遷移與優化指南

- 遷移計劃
- 優化策略
- V2 遷移記錄

### ⚡ [Performance](./performance/)

性能優化指南

- Bundle 優化
- PWA 性能分析
- 請求去重
- 性能監控

### 🔒 [Security](./security/)

安全文檔與檢查清單

- [安全指南](./security/SECURITY.md)
- 部署安全檢查清單

### 🧪 [Testing](./testing/)

測試框架、指南與報告

- [測試指南](./testing/guides/) - 各類測試指南
- [Factory Pattern](./testing/factory-pattern/) - 測試數據工廠
- [測試報告](./testing/reports/) - 執行報告
- **查看**: [Testing README](./testing/README.md)

### 📱 [User Manuals](./user-manuals/)

使用者手冊（多語言）

- AI Analytics 使用手冊
- 排班系統手冊
- 請假管理手冊
- 角色別使用指南（店主/廚師/收銀/服務員/顧客）
- **語言**: 繁中、簡中、英文、日文、越南文、印尼文、菲律賓文

### 🎓 [Workshops](./workshops/)

工作坊與培訓資料

### 📦 [Archive](./archive/)

歷史文檔與完成報告

- [變更日誌](./archive/CHANGELOG.md) ⭐
- 完成報告
- Bug 修復記錄
- 已棄用文檔
- **查看**: [Archive README](./archive/README.md)

### 🌍 [Locales](./locales/)

多語言文檔

- [簡體中文](./locales/zh-cn/) - CLAUDE 指南、技術文檔

---

## 🎯 快速導航

### 我想...

#### 🆕 開始開發

1. 閱讀 [CLAUDE.md](../CLAUDE.md) - 項目概覽
2. 設置開發環境
3. 查看 [架構文檔](./architecture/technical-documentation.md)
4. 閱讀 [測試指南](./guides/testing-guide.md)

#### 🔍 了解特定功能

→ 查看 [Features 文件夾](./features/)

#### 📖 API 使用

→ 查看 [API 文檔](./api/)

#### 🏗️ 理解系統架構

→ 閱讀 [技術文檔](./architecture/technical-documentation.md)

#### 🧪 編寫測試

→ 查看 [Testing 文檔](./testing/)

#### 🚀 部署應用

→ 查看 [部署指南](./guides/deployment/)

#### 📊 查看進度

→ 查看 [變更日誌](./archive/CHANGELOG.md)

---

## 📋 核心文檔

### 必讀文檔

| 文檔                                                  | 描述               | 讀者          |
| ----------------------------------------------------- | ------------------ | ------------- |
| [requirements.md](./requirements.md)                  | 產品需求文檔       | 所有人        |
| [CLAUDE.md](../CLAUDE.md)                             | 項目概覽與開發指南 | 開發者        |
| [技術文檔](./architecture/technical-documentation.md) | 完整技術規格       | 開發者/架構師 |
| [INDEX.md](./INDEX.md)                                | 詳細文檔索引       | 所有人        |

### 最新更新

- **2025-11-24**: 文檔結構重組，創建清晰的分類結構
- **2025-11-24**: 新增 Partnership System 完整實施文檔
- **2025-11-23**: 修復所有 TypeScript 錯誤（106 → 0）
- **2025-11-15**: 完成測試基礎設施 Phase 1-3
- **2025-11-06**: 員工管理模組 100% 完成

詳見：[完整變更日誌](./archive/CHANGELOG.md)

---

## 📊 項目狀態

| 指標           | 狀態                        |
| -------------- | --------------------------- |
| **架構版本**   | 2.0 (Cloudflare Serverless) |
| **TypeScript** | ✅ 0 errors (100% 合規)     |
| **ESLint**     | ✅ 0 errors, 0 warnings     |
| **測試覆蓋率** | 85%+ (核心模組)             |
| **PWA 分數**   | 95/100                      |
| **整體完成度** | 98%                         |

### 功能完成度

| 功能                | 狀態    | 文檔                                             |
| ------------------- | ------- | ------------------------------------------------ |
| 核心 API            | ✅ 100% | [Architecture](./architecture/)                  |
| AI Analytics        | ✅ 100% | [AI Analytics](./features/ai-analytics/)         |
| Employee Management | ✅ 100% | [Employee Mgmt](./features/employee-management/) |
| Partnership System  | ✅ 100% | [Partnership](./features/partnership-system/)    |
| Realtime Services   | 🟡 90%  | [Realtime](./features/realtime-services/)        |
| Shop QR System      | ✅ 100% | [Shop QR](./features/shop-qr/)                   |

---

## 🗺️ 文檔地圖

```
docs/
├── 📖 README.md (您在這裡)
├── 📑 INDEX.md (詳細索引)
├── 📋 requirements.md (產品需求)
├── 🔌 api/ (API 文檔)
├── 🏗️ architecture/ (架構設計)
├── ✨ features/ (功能實施)
├── 📚 guides/ (開發指南)
├── 🚀 implementation/ (實施計劃)
├── 🔄 migration/ (遷移指南)
├── ⚡ performance/ (性能優化)
├── 🔒 security/ (安全文檔)
├── 🧪 testing/ (測試文檔)
├── 📱 user-manuals/ (用戶手冊)
├── 🎓 workshops/ (工作坊)
├── 📦 archive/ (歷史文檔)
└── 🌍 locales/ (多語言)
```

---

## 🔍 搜尋文檔

### 使用 grep 搜尋

```bash
# 搜尋特定關鍵字
grep -r "Partnership System" docs/

# 搜尋特定文件類型
find docs/ -name "*.md" -exec grep "API" {} +

# 搜尋特定文件夾
grep -r "WebSocket" docs/features/realtime-services/
```

### 使用 GitHub 搜尋

在 GitHub 儲存庫頁面使用搜尋功能：

```
path:docs/ "keyword"
```

---

## 📝 貢獻指南

### 新增文檔

1. 確定文檔類型，選擇合適的文件夾
2. 遵循現有文檔的格式
3. 使用清晰的標題和章節
4. 包含目錄（如適用）
5. 添加範例代碼
6. 更新 INDEX.md

### 更新文檔

1. 保持文檔的及時性
2. 記錄重大變更
3. 更新「最後更新」日期
4. 相關文檔同步更新

### 文檔標準

- **語言**: 優先使用英文，重要文檔提供中文版
- **格式**: Markdown (.md)
- **命名**: 使用大寫加下劃線（UPPERCASE_WITH_UNDERSCORES.md）
- **結構**: 清晰的層級結構
- **代碼**: 使用代碼圍欄和語法高亮

---

## 🌐 多語言支援

### 可用語言

- 🇬🇧 English (主要)
- 🇹🇼 繁體中文
- 🇨🇳 簡體中文
- 🇯🇵 日本語
- 🇻🇳 Tiếng Việt
- 🇮🇩 Bahasa Indonesia
- 🇵🇭 Filipino

### 語言優先級

1. 技術文檔：英文為主
2. 用戶手冊：多語言完整版本
3. 架構文檔：英文 + 繁中/簡中
4. API 文檔：英文為主

---

## 🆘 需要幫助？

### 常見問題

- **找不到特定文檔？** 查看 [INDEX.md](./INDEX.md) 詳細索引
- **不確定從哪裡開始？** 閱讀 [CLAUDE.md](../CLAUDE.md)
- **API 使用問題？** 查看 [API 文檔](./api/)
- **測試相關問題？** 查看 [Testing 指南](./testing/)

### 聯絡方式

- 📧 Email: support@makanmakan.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/makanmakan/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/makanmakan/discussions)

---

## 📚 推薦閱讀順序

### 新加入開發者

1. [CLAUDE.md](../CLAUDE.md) - 項目概覽
2. [requirements.md](./requirements.md) - 了解業務需求
3. [架構文檔](./architecture/technical-documentation.md) - 理解技術架構
4. [測試指南](./guides/testing-guide.md) - 測試規範
5. [API 文檔](./api/) - API 使用

### 功能開發者

1. 相關 [功能文檔](./features/)
2. [API 文檔](./api/)
3. [測試指南](./testing/)
4. [實施計劃](./implementation/)

### 架構師/Tech Lead

1. [技術文檔](./architecture/technical-documentation.md)
2. [架構文件夾](./architecture/)
3. [性能優化](./performance/)
4. [安全文檔](./security/)

---

**文檔最後更新**: 2025-11-24
**文檔總數**: 140+ 文件
**主要語言**: English, 繁體中文, 簡體中文
**維護者**: MakanMakan 開發團隊

---

_有任何文檔問題或建議，歡迎提出 Issue 或 Pull Request！_ 🚀
