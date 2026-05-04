# Factory Champions 計畫

> 👑 培養團隊中的 Factory 專家，推動測試質量提升

---

## 📋 目錄

1. [計畫概述](#計畫概述)
2. [為什麼需要 Champions](#為什麼需要-champions)
3. [角色與職責](#角色與職責)
4. [如何成為 Champion](#如何成為-champion)
5. [權限與資源](#權限與資源)
6. [認可與獎勵](#認可與獎勵)
7. [協作機制](#協作機制)
8. [成功指標](#成功指標)
9. [Champions 名單](#champions-名單)

---

## 計畫概述

### 什麼是 Factory Champion？

Factory Champion 是團隊中的測試專家，負責：

- 推廣 factory 最佳實踐
- 幫助團隊成員使用 factory
- 維護測試基礎設施
- 持續改進測試質量

### 計畫目標

```
┌──────────────────────────────────────┐
│ Factory Champions 計畫目標            │
├──────────────────────────────────────┤
│                                      │
│ 🎯 短期目標（1-2 個月）              │
│  ├─ 80% 測試採用 factory             │
│  ├─ 每個團隊至少 1 位 Champion       │
│  └─ 建立完整的支援體系               │
│                                      │
│ 🚀 中期目標（3-6 個月）              │
│  ├─ 95% 測試採用 factory             │
│  ├─ 新測試強制使用 factory           │
│  └─ Champions 能獨立解決問題         │
│                                      │
│ 🏆 長期目標（6-12 個月）             │
│  ├─ Factory 成為團隊文化             │
│  ├─ Champions 培養新 Champions       │
│  └─ 持續創新測試基礎設施             │
│                                      │
└──────────────────────────────────────┘
```

---

## 為什麼需要 Champions

### 挑戰

```
❌ 沒有 Champions 的情況：
├─ 團隊成員不知道如何使用 factory
├─ 遇到問題沒人可以問
├─ 文檔更新不及時
├─ 最佳實踐沒有傳播
└─ 遷移進度緩慢

✅ 有 Champions 的情況：
├─ 快速響應團隊問題
├─ 積極推廣最佳實踐
├─ 主動維護文檔和工具
├─ 培養新的專家
└─ 加速遷移進度
```

### 成功案例

> "我們團隊有了 Champion 之後，factory 採用率從 20% 提升到 85%，僅用了 6 週。"
> — 某團隊負責人

---

## 角色與職責

### 🎯 核心職責

#### 1. 技術支援（40%）

```
職責範圍：
├─ 回答團隊成員關於 factory 的問題
├─ Code review 時檢查 factory 使用
├─ 幫助解決 factory 相關的 bug
└─ 指導新人正確使用 factory

回應時間：
├─ Slack 消息：2 小時內
├─ PR 評論：1 個工作日內
└─ 技術諮詢：當天安排
```

#### 2. 知識傳播（30%）

```
活動形式：
├─ 每月一次工作坊（30 分鐘）
├─ 新人入職培訓（factory 部分）
├─ 分享最佳實踐和技巧
└─ 維護 FAQ 和文檔

典型主題：
├─ Factory 基礎使用
├─ 複雜場景處理
├─ 常見錯誤和修復
└─ 新功能介紹
```

#### 3. 基礎設施維護（20%）

```
維護內容：
├─ 更新 factory 定義
├─ 擴展 factory 功能
├─ 修復 factory bug
├─ 優化性能
└─ 更新文檔

定期任務：
├─ 每週：查看 issue 和 PR
├─ 每兩週：更新文檔
└─ 每月：檢查工具運行狀態
```

#### 4. 推廣遷移（10%）

```
推廣策略：
├─ 識別高價值遷移候選
├─ 協助團隊完成遷移
├─ 追蹤遷移進度
└─ 慶祝里程碑達成

遷移支援：
├─ 提供遷移檢查清單
├─ 協助解決遷移問題
├─ Review 遷移 PR
└─ 記錄經驗教訓
```

### 🚫 非職責範圍

```
以下事項不屬於 Champion 職責：
├─ ❌ 替團隊成員寫測試
├─ ❌ 修復非 factory 相關的測試問題
├─ ❌ 7x24 隨時待命
└─ ❌ 承擔所有測試工作
```

---

## 如何成為 Champion

### 🎯 資格要求

#### 必備條件

```typescript
interface ChampionRequirements {
  // 技術要求
  technical: {
    factoryExperience: "至少遷移 3 個測試文件";
    codeQuality: "所有測試都正確使用 resetAllFactories";
    documentation: "閱讀並理解所有 factory 文檔";
  };

  // 軟技能
  softSkills: {
    communication: "能清晰解釋技術概念";
    patience: "願意幫助他人";
    proactive: "主動發現和解決問題";
  };

  // 時間投入
  commitment: {
    weeklyHours: "每週 2-4 小時";
    duration: "至少 3 個月";
  };
}
```

#### 加分條件

- ✅ 獲得 🥇 金級徽章
- ✅ 對測試基礎設施有貢獻
- ✅ 在團隊中有影響力
- ✅ 熟悉多個代碼庫

### 📝 申請流程

```
第 1 步：自我評估
├─ 確認符合資格要求
├─ 評估時間投入能力
└─ 準備申請材料

第 2 步：提交申請
├─ 填寫申請表單（見下方）
├─ 提供過往貢獻證明
└─ 說明為什麼想成為 Champion

第 3 步：面談
├─ 與現有 Champion 面談
├─ 討論技術理解
├─ 確認期望和職責

第 4 步：試用期（2 週）
├─ 協助解決 2-3 個問題
├─ 主持一次工作坊
└─ 獲得團隊反饋

第 5 步：正式任命
├─ 獲得 👑 Factory Champion 徽章
├─ 加入 Champions 群組
└─ 開始正式職責
```

### 📋 申請表單

```markdown
# Factory Champion 申請表單

## 個人信息

- 姓名：
- 團隊：
- Slack ID：
- GitHub ID：

## 資格證明

- 已遷移的測試文件數：
- 獲得的徽章：
- 對 testing-utils 的貢獻：

## 動機

為什麼想成為 Factory Champion？（100-200 字）

## 承諾

每週可投入時間：
預期擔任期限：

## 簽名

日期：
簽名：
```

---

## 權限與資源

### 🔑 特殊權限

```
代碼庫權限：
├─ @makanmasak/testing-utils 維護權限
├─ 文檔倉庫寫入權限
└─ CI/CD 配置修改權限

群組權限：
├─ #factory-champions Slack 頻道（私有）
├─ champions@makanmasak.com 郵件列表
└─ Factory Champions GitHub 團隊

決策權限：
├─ 批准 factory 相關 PR
├─ 決定 factory API 設計
└─ 優先級排序（feature request）
```

### 🎁 提供資源

#### 培訓資源

```
初始培訓（2 小時）：
├─ Factory 深度技術培訓
├─ Code review 最佳實踐
├─ 溝通技巧培訓
└─ Champions 工具使用

持續學習：
├─ 訪問付費線上課程
├─ 參加相關技術會議
└─ 定期 Champions 會議
```

#### 工具支援

```
專用工具：
├─ Champions Dashboard（進度追蹤）
├─ 問題管理系統
├─ 文檔編輯器權限
└─ 分析工具訪問權限

辦公資源：
├─ Champions T-shirt
├─ 專屬貼紙
└─ 認證證書
```

#### 時間保障

```
工作時間分配：
├─ Champion 工作計入正常工時
├─ 每週 2-4 小時專用時間
└─ 大型活動可申請額外時間

工作計劃：
├─ Champion 工作納入 Sprint
├─ 與 Manager 協調優先級
└─ 記錄在績效評估中
```

---

## 認可與獎勵

### 🏆 正式認可

#### 內部認可

```
徽章系統：
└─ 👑 Factory Champion（金級徽章）
   ├─ 顯示在個人檔案
   ├─ 顯示在 GitHub
   └─ 顯示在 Slack

公開表揚：
├─ 全員大會宣布
├─ 內部新聞稿報導
├─ 團隊慶祝活動
└─ 季度 Champion 頒獎
```

#### 外部認可

```
職業發展：
├─ LinkedIn 認證推薦
├─ 個人 Blog 推廣支援
├─ 技術會議演講機會
└─ 開源貢獻展示

職涯晉升：
├─ 績效評估加分
├─ 晉升候選人優先考慮
└─ 技術領導力證明
```

### 🎁 實質獎勵

#### 季度獎勵（所有 Champions）

```
實體獎勵：
├─ Champions T-shirt
├─ 專屬辦公用品
└─ 限量貼紙包

數位獎勵：
├─ 專屬 Slack emoji
├─ GitHub 個人檔案徽章
└─ 團隊網站榮譽榜
```

#### 年度獎勵（傑出 Champion）

```
評選標準：
├─ 幫助最多團隊成員
├─ 解決最多技術問題
├─ 最佳工作坊評價
└─ 最大影響力貢獻

獎勵內容：
├─ 💰 現金獎金
├─ 🎫 技術會議門票
├─ 📚 技術書籍/課程
└─ 🏅 年度 Champion 獎杯
```

---

## 協作機制

### 👥 Champions 團隊結構

```
┌────────────────────────────────────┐
│ Lead Champion（1 人）               │
│ ├─ 協調 Champions 工作             │
│ ├─ 決策重要事項                    │
│ └─ 代表 Champions 與管理層溝通     │
└────────────────┬───────────────────┘
                 ↓
┌────────────────────────────────────┐
│ Core Champions（3-5 人）            │
│ ├─ 各團隊/領域的代表               │
│ ├─ 日常技術支援                    │
│ └─ 推動遷移和培訓                  │
└────────────────┬───────────────────┘
                 ↓
┌────────────────────────────────────┐
│ Junior Champions（若干）            │
│ ├─ 學習中的 Champions              │
│ ├─ 協助 Core Champions             │
│ └─ 準備成為 Core Champion          │
└────────────────────────────────────┘
```

### 🗓️ 定期活動

#### 每週同步（30 分鐘）

```
時間：每週五下午 3:00
形式：Slack 頻道 async 更新 + 每月一次同步會議

議程：
├─ 本週幫助的團隊成員數
├─ 遇到的技術問題
├─ 文檔/工具更新需求
└─ 下週計劃
```

#### 每月工作坊（1 小時）

```
時間：每月第一個週三下午 2:00
形式：線上/線下混合

內容：
├─ Champions 主持
├─ 新功能介紹
├─ 最佳實踐分享
├─ Q&A 環節
└─ 實戰練習
```

#### 季度回顧（2 小時）

```
時間：每季度最後一週
形式：全體 Champions 會議

內容：
├─ 回顧季度目標達成
├─ 分享成功案例
├─ 討論改進方向
├─ 計劃下季度目標
└─ 表彰傑出 Champion
```

### 💬 溝通渠道

```
主要渠道：
├─ #factory-champions（Champions 私有）
├─ #testing（全員可見，Champions 監控）
└─ champions@makanmasak.com

問題追蹤：
├─ GitHub Issues（功能請求）
├─ Slack Threads（快速問題）
└─ 1-on-1（複雜問題）

知識庫：
├─ Confluence（文檔）
├─ GitHub Wiki（技術細節）
└─ Slack Canvas（FAQ）
```

---

## 成功指標

### 📊 個人指標

```typescript
interface ChampionMetrics {
  // 每季度目標
  quarterly: {
    questionsAnswered: 20; // 回答問題數
    prsReviewed: 15; // Review PR 數
    workshopsHosted: 1; // 主持工作坊數
    helpedDevelopers: 5; // 幫助的開發者數
  };

  // 質量指標
  quality: {
    averageResponseTime: "< 4 小時";
    satisfactionScore: "> 4.5/5";
    issueResolutionRate: "> 90%";
  };

  // 影響力指標
  impact: {
    teamAdoptionRate: "+10%"; // 團隊採用率提升
    newChampionsRecruited: 1; // 招募新 Champions
    documentationUpdates: 5; // 文檔更新次數
  };
}
```

### 🎯 團隊指標

```
整體目標（季度）：
├─ Factory 採用率 > 80%
├─ 新測試 100% 使用 factory
├─ resetAllFactories 合規率 > 95%
└─ 團隊滿意度 > 4.0/5

Champions 覆蓋：
├─ 每個團隊至少 1 位 Champion
├─ Champions 總數 5-10 人
└─ 活躍 Champions 比例 > 80%
```

### 📈 追蹤方式

```
自動化追蹤：
├─ factory:badges（徽章系統）
├─ factory:usage（使用統計）
└─ GitHub Insights（PR activity）

手動追蹤：
├─ Champions Dashboard（每月更新）
├─ 滿意度調查（每季度）
└─ 回顧會議記錄
```

---

## Champions 名單

### 現任 Champions

#### Lead Champion

> _待任命_

#### Core Champions

> _待任命_

### 申請成為 Champion

如果你對成為 Factory Champion 感興趣：

1. 📖 閱讀本文檔了解職責
2. ✅ 確認符合資格要求
3. 📝 填寫申請表單
4. 💬 聯繫現有 Champion

**申請方式**：

- 📧 發送郵件至：champions@makanmasak.com
- 💬 Slack 私訊：@factory-champion-lead
- 🎫 提交 GitHub Issue：[申請成為 Champion]

---

## 📚 附錄

### A. Champion 入職檢查清單

```markdown
## Champions 入職清單

### 第 1 天

- [ ] 獲得所有必要權限
- [ ] 加入 Slack 頻道和郵件列表
- [ ] 收到 Champions 歡迎包
- [ ] 閱讀所有相關文檔

### 第 1 週

- [ ] 完成初始培訓
- [ ] 與 Lead Champion 1-on-1
- [ ] 設置 Champions Dashboard
- [ ] 回答第一個問題

### 第 1 個月

- [ ] 主持或協助一次工作坊
- [ ] 完成 3 次 code review
- [ ] 幫助 5 位團隊成員
- [ ] 更新 1 次文檔
```

### B. 每週工作範本

```markdown
## Champion 每週工作記錄

**週次**: 2025-W##

### 技術支援

- 回答問題數：
- Review PR 數：
- 解決 Issue 數：

### 知識傳播

- 工作坊/培訓：
- 文檔更新：
- 分享最佳實踐：

### 遷移推動

- 新遷移文件：
- 協助團隊：

### 下週計劃

-
```

### C. 工作坊大綱範本

```markdown
## Factory 工作坊大綱

**主題**：
**日期**：
**時長**：
**講師**：

### 學習目標

1.
2.
3.

### 議程（60 分鐘）

- 00:00-00:10 | 介紹和破冰
- 00:10-00:30 | 主題講解
- 00:30-00:45 | 實戰練習
- 00:45-00:55 | Q&A
- 00:55-01:00 | 總結和反饋

### 準備材料

- [ ] 簡報
- [ ] 範例代碼
- [ ] 練習題
- [ ] 反饋表單
```

---

## 🔗 相關資源

- [Factory 快速參考](./FACTORY_QUICK_REFERENCE.md)
- [自動化工具指南](./AUTOMATION_TOOLS_GUIDE.md)
- [FAQ](./FACTORY_FAQ.md)
- [試點遷移計畫](./PILOT_MIGRATION_PLAN.md)

---

## 📞 聯繫我們

- 💬 Slack: #factory-champions
- 📧 Email: champions@makanmasak.com
- 🐛 Issues: GitHub Issues
- 📅 會議: 每月第一個週三

---

**建立日期**: 2025-11-15
**版本**: 1.0.0
**狀態**: Active
**維護者**: Factory Champions Team
