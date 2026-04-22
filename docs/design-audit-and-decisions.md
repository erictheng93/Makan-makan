# UI/UX Design Audit & Decisions

> 審計日期：2026-04-22
> 審計範圍：`tests/visual/` 快照 × 5 Apps（Admin、Customer、Kitchen、Management、Onboarding）
> 設計系統基準：`docs/UIUX-design-system.md`（Apple-Native Soft Minimalism）

---

## 一、App 品牌色決策（已確認）

設計系統定義 `#007AFF` 為全系統主色，但各 App 採用獨立品牌色，需在設計系統文件中明確記錄例外。

| App | 品牌主色 | 決策狀態 |
|-----|---------|---------|
| Customer App | `#007AFF` 藍（系統主色）| ✅ 符合規範 |
| Admin Dashboard | `#de5c09` 橘（primary-600）| ✅ **確認保留** — Admin 角色識別色 |
| Kitchen Display | `#FF9500` 橘 / `#007AFF` 藍 / `#34C759` 綠（狀態色）| ✅ 功能性色彩，非品牌色 |
| Management Portal | `#34C759` 綠 | ✅ 確認保留 — 平台管理角色識別色 |
| Onboarding App | `#34C759` 綠（同 Management）| ✅ 確認保留 |

**原則：橘 = Admin 操作員，綠 = 平台管理者，藍 = 顧客端。** 角色視覺分離有助於使用者快速辨認所在系統。

---

## 二、已執行的修正

### 2.1 Admin Dashboard — 按鈕語義統一

**問題：** 主要操作按鈕混用橘、藍、綠三色，沒有語義一致性。

**決策：**
- 主要動作（Search、搜尋等通用操作）→ `#007AFF` 藍（`btn-primary`）
- 品牌性管理操作（Export Report、品牌相關 CTA）→ `primary-600` 橘
- 危險操作（刪除、取消）→ `#FF3B30` 紅（`btn-danger`，已存在）
- 成功/建立操作 → `#34C759` 綠（語義正確，如 Add Category）

**修改檔案：** `apps/admin-dashboard/src/assets/css/main.css`
```css
/* Before */
.btn-primary {
  @apply btn bg-primary-600 text-white hover:bg-primary-700 ...;
}

/* After — 通用操作按鈕改為藍色，品牌橘另行用 primary-600 class */
.btn-primary {
  @apply btn bg-[#007AFF] text-white hover:bg-[#0066D6] ...;
}
```

**修改檔案：** `apps/admin-dashboard/src/views/AnalyticsView.vue`
```html
<!-- Export Report：品牌操作，改用 primary-600 橘 + rounded-full -->
<button class="... bg-primary-600 rounded-full hover:bg-primary-700 ...">
```

---

### 2.2 Admin Dashboard — 表單輸入框樣式

**問題：** `<input>` 和 `<select>` 使用 `border border-gray-300 rounded-lg`，違反設計系統「無硬邊框」原則，圓角規範應為 `rounded-xl`。

**修改檔案：** `apps/admin-dashboard/src/assets/css/main.css`
```css
/* Before */
.form-input {
  @apply w-full px-3 py-2 border border-gray-300 rounded-lg ...;
}

/* After */
.form-input {
  @apply w-full px-3 py-2 bg-white border-0 rounded-xl shadow-ios-sm ...;
}
```

**修改檔案：** `apps/admin-dashboard/src/views/OrdersView.vue`
- 搜尋 input：`border border-gray-300 rounded-lg` → `bg-white border-0 rounded-xl shadow-ios-sm`
- 三個 filter `<select>`：同上

**覆蓋範圍：**
- `WaitingListTab.vue` — 使用 `form-input` class，自動覆蓋
- `ReservationTab.vue` — 分頁器按鈕群組（連接式設計）不在此範圍

---

### 2.3 Admin Analytics — 訂單狀態分布圓形圖

**問題：** 使用純色實心圓（`bg-green-500`、`bg-blue-500` 等），飽和度過高，不符合「柔和粉彩」原則。

**修改檔案：** `apps/admin-dashboard/src/views/AnalyticsView.vue`

| 狀態 | Before | After |
|------|--------|-------|
| Delivered | `bg-green-500` 白字 | `bg-green-100` `text-green-700` |
| Preparing | `bg-blue-500` 白字 | `bg-blue-100` `text-blue-700` |
| Pending | `bg-yellow-500` 白字 | `bg-amber-100` `text-amber-700` |
| Cancelled | `bg-red-500` 白字 | `bg-red-100` `text-red-700` |

---

## 三、待決策項目

### 3.1 Kitchen Display 看板設計 ✅ 已確認

**決策：保留方案 A（現行設計）**

低透明度淡色欄位背景（`rgba(255,149,0,0.06)` 等），頁面背景白色。

**理由：** Kitchen Display 作為實體廚房環境的功能性看板，允許獨立的設計語言。柔和欄位背景提供足夠的狀態區分，不需統一至其他 App 的 `#F2F2F7` 風格。

---

## 四、已知的合理例外（不需修改）

| 項目 | 例外原因 |
|------|---------|
| Kitchen Display 獨立色彩系統 | KDS 功能性需求：色彩識別訂單狀態，非品牌用途。白色頁面背景 + 淡色欄位填滿為**確認保留**的設計決策（2026-04-22）|
| ReservationTab 分頁器按鈕邊框 | 連接式按鈕群組（`rounded-l-md` / `rounded-r-md`），邊框是必要的視覺連接 |
| Admin/Management/Onboarding 品牌色差異 | 角色識別設計：橘=管理員，綠=平台，藍=顧客 |
| "Currently Managing" 橘色 Banner | 警示用途（提醒管理員正在操作哪家餐廳），橘色語義正確 |

---

## 五、未追蹤的已知問題（低優先級）

- Admin Orders：`Preparing` 狀態標籤用紫色（不在設計系統語義色內），建議改為 `#30B0C7` 青色
- Customer App Home：「Discover Food」次要 CTA 用橘色（設計系統警告色），建議改為白底藍字次要按鈕
- Analytics Status Distribution：考慮未來改用真實的環形圖（Donut Chart）取代圓形色塊
