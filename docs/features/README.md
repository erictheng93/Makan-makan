# Features Documentation / 功能文檔

本文件夾包含 MakanMakan 系統各個功能模組的實施文檔。

## 📂 文件夾結構

### 🤖 AI Analytics (`ai-analytics/`)
AI 分析功能的完整實施文檔

**主要文檔**:
- `AI_ANALYTICS_IMPLEMENTATION.md` - 完整實施指南
- `AI_ANALYTICS_QUICK_START.md` - 快速開始指南
- `AI_ANALYTICS_UI_GUIDE.md` - UI 使用指南
- `AI_ANALYTICS_OPTIMIZATION_REPORT.md` - 優化報告

**功能**:
- 支援 4 個 LLM 提供商（OpenAI, Anthropic, Google, Groq）
- 產品分析與洞察
- 銷售趨勢預測
- 客戶行為分析

---

### 👥 Employee Management (`employee-management/`)
員工管理系統（排班與請假）

**子模組**:
- **Scheduling** (`scheduling/`) - 員工排班系統
  - 班次模板管理
  - 自動排班
  - 換班請求
  - 打卡記錄

- **Leave Management** (`leave-management/`) - 請假管理系統
  - 請假申請與審批
  - 假期餘額追蹤
  - 通知系統
  - 報表匯出

**完成度**: 100% ✅

---

### 🤝 Partnership System (`partnership-system/`)
商家合作夥伴系統

**主要文檔**:
- `PARTNERSHIP_SYSTEM_IMPLEMENTATION.md` - 系統實施文檔
- `CORPORATE_PARTNERSHIP_IMPLEMENTATION_PLAN.md` - 企業合作實施計劃

**功能**:
- 合作夥伴管理
- 折扣方案（百分比/固定金額/特價）
- 會員驗證與審批
- 使用記錄追蹤
- 退款管理

**完成度**: 100% ✅ (3,163 lines, 83 test cases)

---

### ⚡ Realtime Services (`realtime-services/`)
實時服務與 WebSocket 通訊

**主要文檔**:
- `REALTIME_SERVICES_IMPLEMENTATION.md` - 實時服務實施指南
- `REALTIME_FRONTEND_INTEGRATION_SUMMARY.md` - 前端整合總結
- `REALTIME_TESTING_GUIDE.md` - 測試指南

**階段文檔** (`phases/`):
- Phase 3 總結
- Phase 4 啟動與計劃

**測試文檔** (`testing/`):
- 測試結果報告

**功能**:
- WebSocket 基礎設施（Durable Objects）
- JWT 認證
- 訊息路由
- 離線重連
- 群組訂餐
- 分帳功能

**完成度**: 90% (6,500+ lines)

---

### 🏪 Shop QR (`shop-qr/`)
店家 QR 碼點餐系統

**主要文檔**:
- Phase 1-3 實施指南
- Phase 2-3 完成報告
- 測試報告

**功能**:
- 店家級別 QR 碼（無需桌號）
- 直接點餐流程
- 訂單管理

---

### 💺 Seat Management (`seat-management/`)
座位管理系統

**主要文檔**:
- `SEAT_MANAGEMENT_GUIDE.md` - 座位管理指南

**功能**:
- 桌位管理
- 座位級別 QR 碼
- 雙模式支援（桌位/座位）

---

### 🔒 Security (`security/`)
安全功能實施

**主要文檔**:
- `PASSWORD_SECURITY_MIGRATION.md` - 密碼安全遷移指南

**功能**:
- Bcrypt 密碼加密
- JWT 令牌管理
- 安全最佳實踐

---

## 📖 使用指南

### 閱讀建議

1. **新功能開發**: 參考相似功能的實施文檔
2. **功能維護**: 查看對應功能文件夾的文檔
3. **測試**: 參考各功能的測試指南

### 文檔查找

使用文檔名稱關鍵字搜索：
```bash
# 查找 AI 相關文檔
grep -r "AI Analytics" docs/features/

# 查找實時服務文檔
find docs/features/realtime-services/ -name "*.md"
```

## 🔗 相關文檔

- **API 文檔**: `docs/api/`
- **架構文檔**: `docs/architecture/`
- **測試文檔**: `docs/testing/`
- **用戶手冊**: `docs/user-manuals/`

## 📝 貢獻指南

新增功能文檔時：

1. 在 `features/` 下創建對應文件夾
2. 添加 README.md 說明功能概覽
3. 包含以下文檔：
   - 實施指南
   - API 文檔
   - 測試文檔
   - 使用指南（如需要）

---

**最後更新**: 2025-11-24
**文檔總數**: 30+ 文件
**功能模組**: 7 個主要模組
