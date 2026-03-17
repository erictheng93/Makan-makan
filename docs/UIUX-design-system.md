# Apple-Native Soft Minimalism Design System

# (蘋果原生柔和極簡設計系統)

**風格定義：** 一種高度遵循 Apple Human Interface Guidelines (HIG) 的現代 iOS 設計語言，以 Bento Box 模組化佈局為骨架、柔和光影與粉彩漸層為血肉，追求「乾淨、透氣、無壓力、年輕化」的使用者體驗。

---

## 1\. 核心設計理念 (Core Philosophy)

- **極簡但不空洞**：每一處留白都有呼吸的目的，每一塊色彩都有引導的功能
- **原生感優先**：UI 應讓使用者感覺像 iOS 系統內建 App，而非第三方應用
- **資訊降噪**：透過光影、大圓角與大量留白來降低資訊焦慮感
- **直覺操作**：零學習成本，符合 iOS 使用者既有的操作心智模型

---

## 2\. 佈局系統 (Layout System)

### 2.1 Bento Grid 模組化佈局

- 將資訊封裝在獨立的白色卡片模組中，每個模組承載一個功能區塊
- 卡片之間保持 **16px** 間距（Tailwind: `gap-4`）
- 頁面水平內邊距 **20px**（Tailwind: `px-5`）

### 2.2 頁面結構模式

┌─────────────────────────┐

│ Status Bar (系統) │

│ Large Title (大標題) │ ← 頁面標題區域

│ \[Filter / Segment\] │ ← 可選的篩選控制列

├─────────────────────────┤

│ ┌─────────────────┐ │

│ │ Primary Card │ │ ← 主要資訊卡片（醒目）

│ └─────────────────┘ │

│ Section Header │ ← 區塊標題 \+ "查看全部" 連結

│ ┌─────────────────┐ │

│ │ Secondary Card │ │ ← 次要資訊卡片

│ └─────────────────┘ │

│ Section Header │

│ ┌─────────────────┐ │

│ │ List Card │ │ ← 列表型卡片

│ └─────────────────┘ │

├─────────────────────────┤

│ Bottom Tab Bar │ ← 底部導覽列

└─────────────────────────┘

### 2.3 間距 Token 系統

| Token       | 數值 | Tailwind        | 用途                    |
| :---------- | :--- | :-------------- | :---------------------- |
| `space-xs`  | 4px  | `gap-1` / `p-1` | 圖示與文字間距          |
| `space-sm`  | 8px  | `gap-2` / `p-2` | 元素內部緊湊間距        |
| `space-md`  | 12px | `gap-3` / `p-3` | 卡片內部元素間距        |
| `space-lg`  | 16px | `gap-4` / `p-4` | 卡片內邊距、卡片間距    |
| `space-xl`  | 20px | `gap-5` / `p-5` | 頁面水平內邊距          |
| `space-2xl` | 24px | `gap-6` / `p-6` | 區塊間大間距            |
| `space-3xl` | 32px | `gap-8` / `p-8` | 頁面頂部/區塊間特大間距 |

---

## 3\. 形狀與邊界 (Shapes & Borders)

### 3.1 圓角規範

- **卡片容器**：`20px - 24px`（Tailwind: `rounded-2xl` 至 `rounded-3xl`）— 使用平滑 Squircle 曲線
- **嵌套內部卡片**：`12px - 16px`（Tailwind: `rounded-xl` 至 `rounded-2xl`）
- **按鈕 / 標籤 / 分頁切換器**：完全膠囊形（Tailwind: `rounded-full`）
- **進度條**：完全圓角（Tailwind: `rounded-full`）
- **輸入框**：`12px`（Tailwind: `rounded-xl`）

### 3.2 無邊框原則

- **禁止**使用生硬的 1px 實線邊框來劃分區塊
- 區塊分隔依靠：白色卡片 \+ 陰影 \+ 背景色差異
- 列表項目分隔使用極細淡灰分隔線（`border-gray-100` 或 `divide-gray-100`），且左側留出縮進對齊文字起始位置

---

## 4\. 色彩計畫 (Color Palette)

### 4.1 基礎色

| 角色     | 色碼                  | Tailwind              | 說明                              |
| :------- | :-------------------- | :-------------------- | :-------------------------------- |
| 背景底色 | `#F2F2F7` / `#F6F6F9` | `bg-gray-50` / 自定義 | 整體頁面底色，iOS 系統灰          |
| 卡片背景 | `#FFFFFF`             | `bg-white`            | 所有內容卡片                      |
| 主要文字 | `#1C1C1E`             | `text-gray-900`       | 標題、重要資訊（避免純黑 `#000`） |
| 次要文字 | `#8E8E93`             | `text-gray-400`       | 輔助說明、時間、地點              |
| 三級文字 | `#AEAEB2`             | `text-gray-300`       | 佔位符、禁用文字                  |

### 4.2 功能色（語義色）

| 角色        | 色碼      | Tailwind          | 說明                               |
| :---------- | :-------- | :---------------- | :--------------------------------- |
| 主要強調色  | `#007AFF` | `text-blue-500`   | 主要按鈕、連結、選中狀態、Tab 高亮 |
| 成功/進行中 | `#34C759` | `text-green-500`  | 進度條、GPA 環、「上課中」狀態燈   |
| 警告        | `#FF9500` | `text-orange-500` | 截止日期提醒、警告圖示             |
| 錯誤/假日   | `#FF3B30` | `text-red-500`    | 錯誤狀態、今日日期標記、假日標籤   |
| 深青/數據   | `#30B0C7` | `text-teal-500`   | GPA 進度環、數據視覺化             |

### 4.3 粉彩點綴色（Pastel Accents）

用於課表色塊、分類標籤背景等，特徵為**低飽和度、高明度**： | 用途 | 背景色 | 文字色 | 感受 | |------|--------|--------|------| | 課程色塊 A | 淡紫漸層 `#E8DEF8 → #F3E5F5` | `#5C4F7C` | 薰衣草 | | 課程色塊 B | 淡粉橘漸層 `#FFE0B2 → #FFF3E0` | `#8D6E4C` | 蜜桃 | | 課程色塊 C | 淡薄荷漸層 `#C8E6C9 → #E8F5E9` | `#4E7C5F` | 薄荷 | | 課程色塊 D | 淡藍漸層 `#BBDEFB → #E3F2FD` | `#4A6E8C` | 天空 | | 標籤-活動訊息 | `#E3F2FD` | `#007AFF` | 藍色資訊 | | 標籤-業務公告 | `#FFF3E0` | `#FF9500` | 橘色公告 | | 標籤-選修 | `#E3F2FD` | `#007AFF` | 藍色膠囊 | | 標籤-必修 | `#FFF3E0` | `#FF9500` | 橘色膠囊 | | 標籤-假日 | `#FFEBEE` | `#FF3B30` | 紅色膠囊 |

### 4.4 課表漸層色塊規範

課表中的課程色塊使用**垂直方向的同色系微漸層**：

- 頂部較深（飽和度略高）→ 底部較淺（趨向白色）
- 漸層角度：`180deg`（由上到下）
- 不透明度範圍：頂部 60-80%，底部 20-40%
- Tailwind 範例：`bg-gradient-to-b from-purple-200/70 to-purple-50/30`

---

## 5\. 層次與陰影 (Depth & Shadows)

### 5.1 陰影層級

| 層級    | CSS 值                        | Tailwind             | 用途                              |
| :------ | :---------------------------- | :------------------- | :-------------------------------- |
| Level 0 | 無陰影                        | —                    | 背景、嵌入式元素                  |
| Level 1 | `0 2px 8px rgba(0,0,0,0.04)`  | `shadow-sm` 或自定義 | 小型卡片、Widget 預覽             |
| Level 2 | `0 4px 16px rgba(0,0,0,0.06)` | `shadow-md` 或自定義 | 主要內容卡片（預設）              |
| Level 3 | `0 8px 30px rgba(0,0,0,0.08)` | `shadow-lg` 或自定義 | 懸浮卡片、底部 Sheet、手機 Mockup |

### 5.2 陰影原則

- 陰影必須**極度柔和**：高模糊度 (blur)、低不透明度 (opacity 3%-8%)
- Y 軸偏移量稍大於 X 軸，模擬頂部環境光
- **絕對禁止**生硬死黑的陰影（opacity \> 15%）
- 推薦自定義 Tailwind：`shadow-[0_8px_30px_rgb(0,0,0,0.04)]`

---

## 6\. 字體排版 (Typography)

### 6.1 字體選擇

- **英文 / 數字**：SF Pro（iOS）或 Inter（Web fallback）
- **中文**：SF Pro TC（iOS）或 Noto Sans TC（Web fallback）
- **等寬數字**：使用 `font-variant-numeric: tabular-nums` 對齊數字列

### 6.2 字體層級

| 角色                  | 字重           | 字號    | Tailwind                | 色彩            |
| :-------------------- | :------------- | :------ | :---------------------- | :-------------- |
| 頁面大標題            | Bold (700)     | 34px    | `text-3xl font-bold`    | `text-gray-900` |
| 區塊標題              | Semibold (600) | 22px    | `text-xl font-semibold` | `text-gray-900` |
| 卡片標題              | Bold (700)     | 17px    | `text-base font-bold`   | `text-gray-900` |
| 正文                  | Regular (400)  | 15px    | `text-sm`               | `text-gray-700` |
| 輔助文字              | Regular (400)  | 13px    | `text-xs`               | `text-gray-400` |
| 標籤文字              | Medium (500)   | 12px    | `text-xs font-medium`   | 依分類色        |
| 強調數字（GPA、分數） | Bold (700)     | 28-48px | `text-3xl+ font-bold`   | 語義色          |

### 6.3 排版原則

- 標題與正文之間必須有**極強的視覺對比**（大小 \+ 粗細 \+ 色彩三重差異）
- 避免純黑文字，主要文字使用 `#1C1C1E`（深碳灰）
- 數據類文字（GPA、分數、百分比）使用醒目的大字號 \+ 語義色

---

## 7\. 核心元件規範 (Component Patterns)

### 7.1 底部導覽列 (Bottom Tab Bar)

┌──────┬──────┬──────┬──────┐

│ 🏠 │ 📋 │ 📅 │ 👤 │

│ 今天 │ 課表 │ 行事曆│ 更多 │

└──────┴──────┴──────┴──────┘

- 圖示使用 SF Symbols 風格（線條型，選中時填充型）
- 選中項：主要強調色（`#007AFF`）
- 未選中項：`#8E8E93`（灰色）
- 背景：白色 \+ 頂部極淡分隔線或毛玻璃效果
- Tailwind: `bg-white/80 backdrop-blur-xl border-t border-gray-200/50`

### 7.2 分段控制器 (Segmented Control)

- 膠囊形外殼（`rounded-full`），淺灰底色（`bg-gray-100`）
- 選中項滑塊：白色 \+ 微陰影，同樣膠囊形
- 文字：選中為深色 `font-medium`，未選中為灰色
- 範例：「週課表 | 今日課程」、「學期 | 歷年」

### 7.3 篩選膠囊 (Filter Chips / Pills)

- 選中狀態：填充色背景 \+ 白色文字（如藍色填充 `bg-blue-500 text-white`）
- 未選中狀態：淺灰背景 \+ 深灰文字（`bg-gray-100 text-gray-600`）
- 形狀：`rounded-full`，內邊距 `px-4 py-2`
- 排列：水平滾動，間距 `gap-2`

### 7.4 狀態指示器

- **進行中圓點**：綠色實心圓 `●`（`w-2 h-2 rounded-full bg-green-500`）+ 文字「上課中」
- **線性進度條**：圓角滿（`rounded-full`），背景 `bg-gray-200`，填充 `bg-green-500`，高度 `h-1.5`
- **圓形進度環**：用於 GPA 等核心數據，描邊色使用青色/綠色漸層，背景環用淺灰，中央放置大字號數字
- **警告圖示**：橘色圓形 `⚠️` 用於截止日期提醒

### 7.5 列表卡片 (List Card)

┌────────────────────────────────────┐

│ 區塊標題 查看全部 →│ ← 藍色連結

│ ┌──────────────────────────────┐ │

│ │ 標題文字 ⚠️/標籤 │ │

│ │ 副標題（灰色小字） │ │

│ │ 日期時間（灰色小字） │ │

│ ├──────────────────────────────┤ │ ← 極淡分隔線

│ │ 標題文字 ⚠️/標籤 │ │

│ │ 副標題（灰色小字） │ │

│ │ 日期時間（灰色小字） │ │

│ └──────────────────────────────┘ │

└────────────────────────────────────┘

### 7.6 課程資訊卡片 (Primary Info Card)

- 白色背景，大圓角（`rounded-2xl`）
- 左上角：狀態指示（綠色圓點 \+ 「上課中」）
- 右上角：剩餘時間（灰色文字）
- 中間：課程名稱（粗體大字）
- 下方：進度條 \+ 地點/時間/教師等圖示資訊行
- 陰影等級：Level 2

### 7.7 分類標籤 (Category Badge)

- 形狀：小型膠囊（`rounded-md` 至 `rounded-full`）
- 內邊距：`px-2 py-0.5`
- 字號：`text-xs font-medium`
- 配色：粉彩背景 \+ 對應深色文字（見 4.3 粉彩點綴色表）

### 7.8 底部彈出面板 (Bottom Sheet)

- 從底部滑入，圓角只在頂部（`rounded-t-2xl`）
- 頂部居中放置拖曳指示條（`w-10 h-1 rounded-full bg-gray-300`）
- 背景：白色
- 遮罩：`bg-black/30`

### 7.9 圓形操作按鈕

- 返回鍵、重新整理等使用圓形容器
- `w-10 h-10 rounded-full bg-gray-100` \+ 居中圖示
- 提供觸覺回饋感的視覺暗示

---

## 8\. 圖示系統 (Iconography)

- **風格**：SF Symbols 風格，線條粗細一致（Stroke width: 1.5-2px）
- **未選中狀態**：線條型 (Outline)
- **選中狀態**：填充型 (Filled)
- **尺寸**：導覽圖示 24px，內文圖示 16-20px，裝飾圖示 14px
- **色彩**：跟隨所在元件的文字色規則
- 推薦圖示庫：SF Symbols（iOS 原生）、Lucide Icons（Web 替代）

---

## 9\. 材質與視覺效果 (Materials & Effects)

### 9.1 毛玻璃效果 (Glassmorphism)

- **僅限局部使用**：底部導覽列、頂部導覽列、浮動工具列
- CSS: `backdrop-filter: blur(20px); background: rgba(255,255,255,0.8);`
- Tailwind: `bg-white/80 backdrop-blur-xl`
- 不可大面積使用，避免效能問題

### 9.2 微漸層 (Subtle Gradients)

- 課表色塊使用同色系垂直漸層（深 → 淺）
- 重點操作按鈕可使用同色系水平漸層增強質感
- 漸層色差不可過大，保持柔和過渡

---

## 10\. 動效與過場 (Motion & Transitions)

### 10.1 原則

- 遵循 iOS 原生動效感：**流暢、有彈性、不突兀**
- 持續時間：200-350ms
- 緩動函數：`ease-out`（進入）、`ease-in`（退出）、`spring`（彈性交互）

### 10.2 常見動效

| 場景            | 動效                          | 持續時間              |
| :-------------- | :---------------------------- | :-------------------- |
| 頁面切換        | 從右滑入 / 向右滑出           | 300ms                 |
| 底部 Sheet 彈出 | 從底部滑入 \+ 輕微彈跳        | 350ms                 |
| 卡片點擊        | 輕微縮放 `scale(0.98)` → 回彈 | 150ms                 |
| 分段控制器切換  | 滑塊水平滑動                  | 200ms                 |
| 進度條填充      | 從 0 到目標值的漸進動畫       | 600ms ease-out        |
| 列表項出現      | 由下淡入 \+ 逐項延遲          | 200ms \+ 50ms stagger |

---

## 11\. 資料視覺化 (Data Visualization)

### 11.1 圓形進度環 (Circular Progress Ring)

- 用於 GPA 等核心指標
- 背景環：`stroke: #E5E5EA`（淺灰），寬度 8-10px
- 進度環：`stroke: #30B0C7`（青色）或漸層色，寬度 8-10px
- 端點：圓形（`stroke-linecap: round`）
- 中央數字：超大粗體 \+ 下方小字說明

### 11.2 線性進度條 / 排名條

- 高度：`h-1.5` 至 `h-2`
- 背景：`bg-gray-200 rounded-full`
- 填充：`bg-green-500 rounded-full`（成功色系）
- 右側放置百分比或排名文字

### 11.3 數據展示佈局

- 大數字居左或居中，說明文字在右或下方
- 使用圖示 \+ 數字 \+ 標籤的三段式排列
- 不同類別的數據使用分隔線或獨立區塊

---

## 12\. 特殊頁面模式 (Page Patterns)

### 12.1 今日總覽頁 (Dashboard)

- 頂部大標題「今天」
- 首要卡片：當前課程（含進度條、狀態指示）
- 次要區塊：待辦事項、近期行程
- 每個區塊有標題 \+ 可選的「查看全部」連結

### 12.2 週課表頁 (Timetable)

- 分段控制器切換「週課表 / 今日課程」
- 網格佈局：左側時段，頂部星期
- 課程色塊使用粉彩漸層填充
- 色塊顯示課程名稱 \+ 教室地點

### 12.3 行事曆頁 (Calendar)

- 月曆視圖，顯示農曆日期
- 今日日期紅色圓圈標記
- 事件以彩色小標籤顯示在日期下方
- 底部 Sheet 用於行事曆訂閱管理

### 12.4 成績查詢頁 (Grades)

- 頂部篩選膠囊（學期切換）
- GPA 圓形進度環（醒目核心數據）
- 排名區塊：進度條 \+ 百分比 \+ 排名數字
- 課程列表：課程名 \+ 分類標籤 \+ 分數

### 12.5 公告列表頁 (Announcements)

- 頂部圖示篩選列（水平滾動）
- 列表項：分類標籤 \+ 標題 \+ 來源 \+ 日期 \+ 箭頭
- 分類標籤使用粉彩配色

---

## 13\. iOS Widget 風格 (Widget Design)

- 圓角：系統級大圓角（`rounded-2xl`）
- 背景：白色
- 內容精簡：僅顯示最關鍵的 1-2 項資訊
- 字體層級清晰：標題小字灰色，內容大字粗體
- 邊距充足，不擁擠

---

## 14\. Tailwind CSS 快速參考 (Quick Reference)

### 14.1 常用組合

/\* 頁面背景 \*/

.page { @apply bg-\[\#F2F2F7\] min-h-screen; }

/\* 主要卡片 \*/

.card { @apply bg-white rounded-2xl p-4 shadow-\[0_4px_16px_rgb(0,0,0,0.06)\]; }

/\* 區塊標題 \*/

.section-title { @apply text-xl font-semibold text-gray-900; }

/\* 膠囊按鈕-選中 \*/

.pill-active { @apply px-4 py-2 rounded-full bg-blue-500 text-white text-sm font-medium; }

/\* 膠囊按鈕-未選中 \*/

.pill-inactive { @apply px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm font-medium; }

/\* 分類標籤 \*/

.badge { @apply px-2 py-0.5 rounded-md text-xs font-medium; }

/\* 底部導覽列 \*/

.tab-bar { @apply fixed bottom-0 w-full bg-white/80 backdrop-blur-xl border-t border-gray-200/50 px-6 py-2; }

/\* 課程漸層色塊 \*/

.course-block { @apply rounded-xl bg-gradient-to-b from-purple-200/70 to-purple-50/30 p-3; }

/\* 柔和分隔線 \*/

.divider { @apply border-t border-gray-100; }

/\* 圓形操作按鈕 \*/

.circle-btn { @apply w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center; }

### 14.2 自定義陰影 (tailwind.config.js)

module.exports \= {

theme: {

    extend: {

      boxShadow: {

        'card-sm': '0 2px 8px rgba(0, 0, 0, 0.04)',

        'card': '0 4px 16px rgba(0, 0, 0, 0.06)',

        'card-lg': '0 8px 30px rgba(0, 0, 0, 0.08)',

        'card-float': '0 12px 40px rgba(0, 0, 0, 0.1)',

      },

      colors: {

        'ios-bg': '\#F2F2F7',

        'ios-card': '\#FFFFFF',

        'ios-text': '\#1C1C1E',

        'ios-secondary': '\#8E8E93',

        'ios-tertiary': '\#AEAEB2',

        'ios-separator': '\#E5E5EA',

        'ios-blue': '\#007AFF',

        'ios-green': '\#34C759',

        'ios-orange': '\#FF9500',

        'ios-red': '\#FF3B30',

        'ios-teal': '\#30B0C7',

      },

      borderRadius: {

        'ios': '20px',

        'ios-lg': '24px',

      }

    }

}

}

---

## 15\. 設計決策檢查清單 (Design Checklist)

在輸出任何 UI 之前，確認以下要點：

- [ ] 頁面背景是否為 `#F2F2F7` 或類似極淺灰？
- [ ] 卡片是否為白色 \+ 大圓角（≥ 20px）+ 柔和陰影？
- [ ] 是否避免了生硬的實線邊框？
- [ ] 按鈕和標籤是否使用膠囊形（rounded-full）？
- [ ] 陰影是否足夠柔和（opacity ≤ 8%）？
- [ ] 文字是否避免了純黑色（使用 \#1C1C1E 代替）？
- [ ] 標題與正文是否有足夠的層級對比？
- [ ] 元素之間是否有充足的留白和呼吸空間？
- [ ] 功能色使用是否正確（藍=主要、綠=成功、橘=警告、紅=錯誤）？
- [ ] 粉彩色是否保持低飽和度高明度？
- [ ] 圖示風格是否統一（SF Symbols 線條風格）？
- [ ] 是否有適當的動效暗示（不突兀的過渡）？
- [ ] 整體感覺是否像 iOS 原生 App？

---

## 16\. Prompt 快速載入指令

將以下指令貼給 Claude Code 即可載入此設計系統：

【角色設定】

你現在是一位精通 Apple iOS Human Interface Guidelines (HIG) 與現代前端技術的頂尖 UI/UX 設計師。請嚴格遵循「Apple-Native Soft Minimalism（蘋果原生柔和極簡風）」設計系統。

【核心原則】

\- 乾淨、透氣、無壓力、年輕化，讓 UI 看起來像 iOS 系統內建 App

\- 一切設計決策服務於「降低資訊焦慮感」與「直覺操作」

【視覺規範摘要】

1\. 佈局：Bento Grid 模組化卡片佈局，頁面內邊距 20px，卡片間距 16px

2\. 形狀：卡片 rounded-2xl\~3xl，按鈕/標籤 rounded-full，禁止生硬邊框

3\. 陰影：柔和彌散陰影 shadow-\[0_4px_16px_rgb(0,0,0,0.06)\]，禁止 opacity \> 8%

4\. 背景：頁面 \#F2F2F7（iOS 系統灰），卡片 \#FFFFFF

5\. 文字：避免純黑，主要 \#1C1C1E，次要 \#8E8E93；標題 Bold 大字，輔助 Regular 小灰字

6\. 色彩：強調 \#007AFF（藍）、\#34C759（綠）、\#FF9500（橘）、\#FF3B30（紅）

7\. 粉彩：課表/標籤使用低飽和度高明度漸層色塊（淡紫、淡橘、淡綠、淡藍）

8\. 材質：導覽列局部毛玻璃 bg-white/80 backdrop-blur-xl

9\. 圖示：SF Symbols 風格，線條型/填充型切換

10\. 動效：200-350ms，ease-out，流暢不突兀

【輸出要求】

使用 Vue \+ Tailwind CSS 輸出，套用上述 class 組合。確認符合設計檢查清單後再輸出。

---
