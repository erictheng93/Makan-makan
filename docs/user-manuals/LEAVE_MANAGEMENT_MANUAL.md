# 請假管理操作手冊 / Leave Management Manual
**MakanMakan 餐廳管理系統 / MakanMakan Restaurant Management System**

---

## 📋 目錄 / Table of Contents

1. [系統概述 / System Overview](#系統概述--system-overview)
2. [角色與權限 / Roles & Permissions](#角色與權限--roles--permissions)
3. [快速入門 / Quick Start](#快速入門--quick-start)
4. [請假類型管理 / Leave Type Management](#請假類型管理--leave-type-management)
5. [請假申請流程 / Leave Request Process](#請假申請流程--leave-request-process)
6. [審批管理 / Approval Management](#審批管理--approval-management)
7. [請假餘額管理 / Leave Balance Management](#請假餘額管理--leave-balance-management)
8. [統計與分析 / Statistics & Analytics](#統計與分析--statistics--analytics)
9. [匯出功能 / Export Features](#匯出功能--export-features)
10. [通知系統 / Notification System](#通知系統--notification-system)
11. [常見問題 / FAQ](#常見問題--faq)
12. [鍵盤快捷鍵 / Keyboard Shortcuts](#鍵盤快捷鍵--keyboard-shortcuts)
13. [技術支援 / Technical Support](#技術支援--technical-support)

---

## 系統概述 / System Overview

### 中文說明

請假管理系統是 MakanMakan 員工管理模組的核心功能之一，提供完整的員工請假申請、審批、餘額追蹤和分析功能。系統支援多種請假類型，自動計算請假天數，並提供智慧化的審批工作流程。

**核心功能：**
- ✅ 多種請假類型（年假、病假、事假、婚假等）
- ✅ 自動請假餘額追蹤與扣除
- ✅ 半天請假支援（上午/下午）
- ✅ 多層級審批流程
- ✅ 即時通知系統（Email、SMS、推播）
- ✅ 完整的分析與報表功能
- ✅ 匯出功能（CSV、Excel、PDF）
- ✅ 請假衝突偵測
- ✅ 年度結轉與過期管理

### English Description

The Leave Management System is one of the core features of MakanMakan's employee management module, providing complete leave request, approval, balance tracking, and analytics capabilities. The system supports multiple leave types, automatically calculates leave days, and offers intelligent approval workflows.

**Core Features:**
- ✅ Multiple leave types (Annual, Sick, Personal, Marriage, etc.)
- ✅ Automatic leave balance tracking and deduction
- ✅ Half-day leave support (Morning/Afternoon)
- ✅ Multi-level approval workflow
- ✅ Real-time notification system (Email, SMS, Push)
- ✅ Comprehensive analytics and reporting
- ✅ Export functionality (CSV, Excel, PDF)
- ✅ Leave conflict detection
- ✅ Annual carryover and expiration management

---

## 系統架構 / System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    請假管理系統 / Leave Management           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  請假類型    │  │  請假申請    │  │  審批流程    │      │
│  │  Leave Types │  │  Requests    │  │  Approvals   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│         ┌──────────────────┴──────────────────┐              │
│         │        餘額管理 / Balance Mgmt      │              │
│         └──────────────────┬──────────────────┘              │
│                            │                                 │
│         ┌──────────────────┴──────────────────┐              │
│         │                                       │             │
│  ┌──────▼──────┐  ┌──────────────┐  ┌────────▼───────┐     │
│  │  統計分析   │  │  匯出功能    │  │  通知系統      │     │
│  │  Analytics  │  │  Export      │  │  Notifications │     │
│  └─────────────┘  └──────────────┘  └────────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 角色與權限 / Roles & Permissions

### 權限矩陣 / Permission Matrix

| 功能 / Feature | 員工<br>Employee | 主管<br>Supervisor | 店主<br>Owner | 管理員<br>Admin |
|----------------|:---------------:|:-----------------:|:-------------:|:---------------:|
| 查看自己的請假記錄<br>View own leave records | ✅ | ✅ | ✅ | ✅ |
| 申請請假<br>Submit leave request | ✅ | ✅ | ✅ | ✅ |
| 取消自己的請假<br>Cancel own leave | ✅ | ✅ | ✅ | ✅ |
| 查看請假餘額<br>View leave balance | ✅ | ✅ | ✅ | ✅ |
| 審批請假申請<br>Approve leave requests | ❌ | ✅ | ✅ | ✅ |
| 查看所有員工請假<br>View all employee leaves | ❌ | ✅ | ✅ | ✅ |
| 管理請假類型<br>Manage leave types | ❌ | ❌ | ✅ | ✅ |
| 調整員工餘額<br>Adjust employee balance | ❌ | ❌ | ✅ | ✅ |
| 匯出報表<br>Export reports | ❌ | ✅ | ✅ | ✅ |
| 查看分析數據<br>View analytics | ❌ | ✅ | ✅ | ✅ |
| 系統設定<br>System settings | ❌ | ❌ | ❌ | ✅ |

---

## 快速入門 / Quick Start

### 5分鐘快速教學 / 5-Minute Tutorial

#### 1️⃣ 申請請假 / Submit Leave Request

```
步驟 / Steps:
┌─────────────────────────────────────────────────────────┐
│ 1. 登入系統並點擊「請假管理」                            │
│    Login and click "Leave Management"                    │
│                                                           │
│ 2. 點擊「申請請假」按鈕                                  │
│    Click "Submit Request" button                         │
│                                                           │
│ 3. 選擇請假類型（年假、病假等）                          │
│    Select leave type (Annual, Sick, etc.)                │
│                                                           │
│ 4. 選擇日期範圍和時段                                    │
│    Select date range and period                          │
│    • 全天 / Full Day                                     │
│    • 上午 / Morning (AM)                                 │
│    • 下午 / Afternoon (PM)                               │
│                                                           │
│ 5. 填寫請假原因                                          │
│    Enter reason for leave                                │
│                                                           │
│ 6. 檢查剩餘天數並提交                                    │
│    Check remaining balance and submit                    │
│                                                           │
│ 7. ✅ 完成！等待主管審批                                 │
│    ✅ Done! Wait for supervisor approval                │
└─────────────────────────────────────────────────────────┘
```

#### 2️⃣ 審批請假 / Approve Leave Request

```
審批流程 / Approval Flow:
┌─────────────────────────────────────────────────────────┐
│ 1. 主管收到通知（Email/SMS/推播）                        │
│    Supervisor receives notification                       │
│                                                           │
│ 2. 進入「待審批」頁籤                                    │
│    Go to "Pending Approval" tab                          │
│                                                           │
│ 3. 查看請假詳情                                          │
│    Review leave details:                                 │
│    • 員工資訊 / Employee info                            │
│    • 請假類型和天數 / Leave type & days                  │
│    • 剩餘天數 / Remaining balance                        │
│    • 衝突檢查 / Conflict check                           │
│                                                           │
│ 4. 決策並填寫備註                                        │
│    Make decision and add comments                        │
│    • 批准 / Approve ✅                                   │
│    • 拒絕 / Reject ❌                                    │
│                                                           │
│ 5. 提交決定                                              │
│    Submit decision                                       │
│                                                           │
│ 6. ✅ 系統自動通知員工                                   │
│    ✅ System notifies employee automatically            │
└─────────────────────────────────────────────────────────┘
```

---

## 請假類型管理 / Leave Type Management

### 系統預設請假類型 / Default Leave Types

| 代碼<br>Code | 名稱<br>Name | 說明<br>Description | 年度額度<br>Annual Quota | 結轉<br>Carryover |
|-------------|-------------|---------------------|------------------------|------------------|
| `ANNUAL` | 年假<br>Annual Leave | 法定年假<br>Statutory annual leave | 14 天 / days | ✅ 允許 / Yes |
| `SICK` | 病假<br>Sick Leave | 因病請假<br>Medical leave | 10 天 / days | ❌ 不允許 / No |
| `PERSONAL` | 事假<br>Personal Leave | 私人事務<br>Personal matters | 7 天 / days | ❌ 不允許 / No |
| `MARRIAGE` | 婚假<br>Marriage Leave | 結婚假期<br>Marriage leave | 3 天 / days | ❌ 不允許 / No |
| `MATERNITY` | 產假<br>Maternity Leave | 產假<br>Maternity leave | 56 天 / days | ❌ 不允許 / No |
| `PATERNITY` | 陪產假<br>Paternity Leave | 陪產假<br>Paternity leave | 5 天 / days | ❌ 不允許 / No |
| `BEREAVEMENT` | 喪假<br>Bereavement Leave | 喪假<br>Bereavement leave | 3 天 / days | ❌ 不允許 / No |
| `UNPAID` | 無薪假<br>Unpaid Leave | 無薪事假<br>Unpaid personal leave | 無限制 / Unlimited | N/A |

### 新增請假類型 / Add New Leave Type

**管理員/店主操作 / Admin/Owner Only:**

1. **進入設定頁面 / Go to Settings:**
   - 路徑：請假管理 → 請假類型設定
   - Path: Leave Management → Leave Type Settings

2. **點擊「新增類型」/ Click "Add Type"**

3. **填寫表單 / Fill Form:**
   ```yaml
   基本資訊 / Basic Information:
     代碼 (Code): CUSTOM_CODE
     名稱 (Name): 自訂假別名稱
     顏色 (Color): #3B82F6

   額度設定 / Quota Settings:
     年度天數 (Annual Days): 10
     半天支援 (Half-day): ✅ 啟用
     需要審批 (Requires Approval): ✅ 是

   進階設定 / Advanced Settings:
     允許結轉 (Allow Carryover): ✅ 是
     最大結轉天數 (Max Carryover Days): 5
     過期月份 (Expiration Month): 12
     是否扣薪 (Paid): ✅ 帶薪

   說明 / Description:
     請假類型的詳細說明...
   ```

4. **設定可用性 / Set Availability:**
   - 選擇適用角色 / Select applicable roles
   - 選擇適用部門 / Select applicable departments

5. **儲存設定 / Save Settings**

### 編輯請假類型 / Edit Leave Type

1. 找到要編輯的類型並點擊「編輯」按鈕
2. 修改所需欄位
3. 點擊「儲存」

⚠️ **注意事項 / Important Notes:**
- 已有請假記錄的類型，代碼不可修改
- Types with existing records cannot change code
- 修改額度不會影響已核准的請假
- Quota changes won't affect approved leaves

---

## 請假申請流程 / Leave Request Process

### 完整申請流程 / Complete Request Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 請假申請完整流程圖                           │
│              Complete Leave Request Flow                     │
└─────────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │  員工登入   │
    │   Login     │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  選擇請假   │
    │   類型      │
    │Select Type  │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐       ┌──────────────────────┐
    │  選擇日期   │──────→│ 系統自動檢查：       │
    │Select Dates │       │ • 餘額是否足夠       │
    │             │       │ • 是否有衝突         │
    └──────┬──────┘       │ • 是否符合規則       │
           │              └──────────────────────┘
           │                         │
           │                    ┌────┴────┐
           │                    │有問題？ │
           │                    └────┬────┘
           │                  Yes ←──┘ │→ No
           │                    │        │
           ▼                    ▼        ▼
    ┌─────────────┐       ┌────────┐  ┌────────┐
    │  填寫原因   │       │ 顯示   │  │  繼續  │
    │Enter Reason │       │ 警告   │  │        │
    └──────┬──────┘       └────────┘  └────────┘
           │
           ▼
    ┌─────────────┐
    │  確認並提交 │
    │   Submit    │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐       ┌──────────────────────┐
    │  建立申請   │──────→│ 系統自動執行：       │
    │   Record    │       │ • 發送審批通知       │
    │   Created   │       │ • 扣除pending天數    │
    └──────┬──────┘       │ • 記錄審計日誌       │
           │              └──────────────────────┘
           ▼
    ┌─────────────┐
    │  等待審批   │
    │   Pending   │
    └─────────────┘
           │
           ├───────────────┬──────────────┐
           │               │              │
           ▼               ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │  批准 ✅  │   │  拒絕 ❌  │   │  取消 🚫 │
    │ Approved │   │ Rejected │   │Cancelled │
    └──────────┘   └──────────┘   └──────────┘
```

### 申請步驟詳解 / Detailed Steps

#### 步驟 1: 選擇請假類型 / Step 1: Select Leave Type

**操作說明 / Instructions:**
1. 點擊「申請請假」按鈕
2. 在下拉選單中選擇請假類型
3. 系統會顯示該類型的剩餘天數

**剩餘天數計算 / Balance Calculation:**
```
剩餘天數 = 總天數 - 已使用天數 - 待審批天數
Remaining = Total - Used - Pending

範例 / Example:
年假總額：14 天
已使用：5 天
待審批：2 天
剩餘：7 天 (14 - 5 - 2 = 7)
```

#### 步驟 2: 選擇日期和時段 / Step 2: Select Dates & Period

**日期選擇 / Date Selection:**
- 開始日期 / Start Date
- 結束日期 / End Date
- 系統會自動計算工作日天數（排除週末和假日）
- System automatically calculates working days (excluding weekends & holidays)

**時段選擇 / Period Selection:**

| 時段 / Period | 天數計算 / Days Count | 說明 / Description |
|--------------|---------------------|-------------------|
| 全天 / Full Day | 1.0 天 / day | 整天請假 / Full day off |
| 上午 / Morning (AM) | 0.5 天 / day | 08:00 - 12:00 |
| 下午 / Afternoon (PM) | 0.5 天 / day | 13:00 - 17:00 |

**半天請假規則 / Half-Day Rules:**
- 單日只能選擇一個時段
- Only one period per day
- 連續多日不可使用半天選項
- Half-day not available for multi-day requests
- 某些請假類型可能不支援半天
- Some leave types may not support half-day

#### 步驟 3: 填寫請假原因 / Step 3: Enter Reason

**必填欄位 / Required Field:**
- 最少 10 個字元 / Minimum 10 characters
- 最多 500 個字元 / Maximum 500 characters
- 清楚說明請假原因 / Clearly state the reason

**建議格式 / Suggested Format:**
```
病假 / Sick Leave:
"因感冒身體不適，需要在家休息"
"Feeling unwell due to cold, need rest at home"

事假 / Personal Leave:
"家中有急事需要處理"
"Urgent family matter to attend to"

年假 / Annual Leave:
"規劃家庭旅遊"
"Planned family vacation"
```

#### 步驟 4: 系統檢查 / Step 4: System Validation

**自動檢查項目 / Automatic Checks:**

1. **餘額檢查 / Balance Check:**
   ```
   ✅ 通過：剩餘天數 >= 申請天數
   ❌ 失敗：剩餘天數不足

   ✅ Pass: Remaining days >= Requested days
   ❌ Fail: Insufficient balance
   ```

2. **衝突檢查 / Conflict Check:**
   - 是否有重疊的請假申請
   - Check for overlapping requests
   - 是否與排班衝突
   - Check for schedule conflicts

3. **規則檢查 / Rule Check:**
   - 是否在允許的申請時間範圍內
   - Within allowed request timeframe
   - 是否符合最短/最長天數限制
   - Meets min/max days requirement

**檢查結果 / Check Results:**

```
✅ 全部通過 / All Passed:
┌─────────────────────────────────────┐
│ ✓ 餘額充足 (7 天剩餘)               │
│ ✓ 無衝突                             │
│ ✓ 符合規則                           │
│                                      │
│ 【可以提交】                         │
└─────────────────────────────────────┘

⚠️ 有警告 / Has Warnings:
┌─────────────────────────────────────┐
│ ✓ 餘額充足                           │
│ ⚠ 與現有請假接近                    │
│ ✓ 符合規則                           │
│                                      │
│ 【可以提交，但請確認】               │
└─────────────────────────────────────┘

❌ 檢查失敗 / Check Failed:
┌─────────────────────────────────────┐
│ ✗ 餘額不足 (需要 5 天，僅剩 3 天)   │
│ ✓ 無衝突                             │
│ ✓ 符合規則                           │
│                                      │
│ 【無法提交】                         │
└─────────────────────────────────────┘
```

#### 步驟 5: 提交申請 / Step 5: Submit Request

**提交前確認 / Pre-Submit Confirmation:**
```
┌────────────────────────────────────────┐
│         請假申請確認                    │
│      Leave Request Confirmation        │
├────────────────────────────────────────┤
│ 請假類型：年假                          │
│ Leave Type: Annual Leave               │
│                                         │
│ 日期範圍：2025-11-10 至 2025-11-12     │
│ Date Range: Nov 10 - Nov 12, 2025      │
│                                         │
│ 時段：全天                              │
│ Period: Full Day                        │
│                                         │
│ 總天數：3 天                            │
│ Total Days: 3 days                      │
│                                         │
│ 剩餘天數：7 → 4 天                     │
│ Balance: 7 → 4 days                    │
│                                         │
│ 原因：規劃家庭旅遊                      │
│ Reason: Planned family vacation        │
│                                         │
│ [取消] [確認提交]                       │
│ [Cancel] [Confirm]                      │
└────────────────────────────────────────┘
```

**提交後動作 / Post-Submit Actions:**
1. ✅ 建立請假記錄（狀態：待審批）
2. 📧 發送通知給審批主管
3. 📊 更新餘額（扣除 pending 天數）
4. 📝 記錄審計日誌
5. 🔔 發送確認通知給申請人

---

## 審批管理 / Approval Management

### 審批工作流程 / Approval Workflow

```
┌────────────────────────────────────────────────────────┐
│                  審批工作流程                           │
│                  Approval Workflow                      │
└────────────────────────────────────────────────────────┘

員工提交           主管收到           主管審核           結果通知
Employee Submit → Notification  →   Review      →      Notify
                                        │
                                        │
                        ┌───────────────┴───────────────┐
                        │                               │
                        ▼                               ▼
                  ┌──────────┐                    ┌──────────┐
                  │  批准 ✅  │                    │  拒絕 ❌  │
                  │ Approve  │                    │  Reject  │
                  └────┬─────┘                    └────┬─────┘
                       │                               │
                       ▼                               ▼
              ┌────────────────┐            ┌────────────────┐
              │ • 更新狀態      │            │ • 更新狀態      │
              │ • 確認餘額扣除  │            │ • 恢復餘額      │
              │ • 發送通知      │            │ • 發送通知      │
              │ • 更新行事曆    │            │ • 記錄原因      │
              └────────────────┘            └────────────────┘
```

### 審批頁面功能 / Approval Page Features

**頁籤分類 / Tab Categories:**

1. **待審批 / Pending (🔴 優先處理)**
   - 等待您審批的請假申請
   - Leave requests awaiting your approval
   - 按提交時間排序
   - Sorted by submission time

2. **已批准 / Approved (✅)**
   - 您已批准的請假記錄
   - Approved leave records
   - 可查看詳細資訊
   - Can view details

3. **已拒絕 / Rejected (❌)**
   - 您已拒絕的請假記錄
   - Rejected leave records
   - 可查看拒絕原因
   - Can view rejection reason

4. **全部 / All**
   - 所有請假記錄
   - All leave records
   - 支援篩選和搜尋
   - Supports filtering and search

### 審批操作步驟 / Approval Steps

#### 1. 查看申請詳情 / View Request Details

點擊請假記錄可查看完整資訊：

```
┌────────────────────────────────────────────────────────┐
│                  請假申請詳情                           │
│               Leave Request Details                     │
├────────────────────────────────────────────────────────┤
│ 【員工資訊 / Employee Info】                            │
│   姓名：張小明 (Zhang Xiaoming)                         │
│   部門：外場服務 (Service)                              │
│   職位：服務員 (Server)                                 │
│   入職日期：2023-01-15                                  │
│                                                         │
│ 【請假資訊 / Leave Info】                               │
│   類型：年假 (Annual Leave)                             │
│   日期：2025-11-10 至 2025-11-12                       │
│   天數：3 天 (3 days)                                   │
│   時段：全天 (Full Day)                                 │
│   原因：規劃家庭旅遊                                    │
│   提交時間：2025-11-03 14:30                           │
│                                                         │
│ 【餘額狀況 / Balance Status】                           │
│   年度總額：14 天 (Annual Total: 14 days)              │
│   已使用：5 天 (Used: 5 days)                          │
│   待審批：5 天 (含本次) (Pending: 5 days incl. this)   │
│   剩餘：4 天 (Remaining: 4 days)                       │
│                                                         │
│ 【衝突檢查 / Conflict Check】                           │
│   ✅ 無排班衝突 (No schedule conflict)                 │
│   ✅ 無重疊請假 (No overlapping leave)                 │
│   ⚠️  同期有 2 位同事請假 (2 colleagues on leave)      │
│                                                         │
│ 【歷史記錄 / History】                                  │
│   本年度請假次數：3 次 (3 times this year)             │
│   上次請假：2025-09-20 (病假 1 天)                     │
│   準時出勤率：95%                                       │
│                                                         │
├────────────────────────────────────────────────────────┤
│ [批准] [拒絕] [聯繫員工]                                │
│ [Approve] [Reject] [Contact]                            │
└────────────────────────────────────────────────────────┘
```

#### 2. 批准請假 / Approve Leave

**操作步驟 / Steps:**
1. 點擊「批准」按鈕
2. 可選填審批備註
3. 確認批准

**系統動作 / System Actions:**
```
✅ 批准後系統會自動：
After approval, system will automatically:

1. 更新請假狀態為「已批准」
   Update status to "Approved"

2. 確認餘額扣除（從 pending 轉為 used）
   Confirm balance deduction (pending → used)

3. 發送批准通知給員工（Email + SMS + 推播）
   Send approval notification (Email + SMS + Push)

4. 更新員工行事曆
   Update employee calendar

5. 記錄審批日誌
   Log approval record

6. 觸發自動排班調整（如有設定）
   Trigger automatic schedule adjustment (if configured)
```

**批准確認畫面 / Approval Confirmation:**
```
┌────────────────────────────────────────┐
│         批准請假申請                    │
│       Approve Leave Request            │
├────────────────────────────────────────┤
│ 員工：張小明                            │
│ 請假類型：年假                          │
│ 日期：2025-11-10 至 2025-11-12         │
│ 天數：3 天                              │
│                                         │
│ 審批備註 (選填)：                       │
│ ┌────────────────────────────────────┐ │
│ │ 批准，請提前完成手頭工作            │ │
│ └────────────────────────────────────┘ │
│                                         │
│ [取消] [確認批准]                       │
│ [Cancel] [Confirm]                      │
└────────────────────────────────────────┘
```

#### 3. 拒絕請假 / Reject Leave

**操作步驟 / Steps:**
1. 點擊「拒絕」按鈕
2. **必須填寫**拒絕原因
3. 確認拒絕

**系統動作 / System Actions:**
```
❌ 拒絕後系統會自動：
After rejection, system will automatically:

1. 更新請假狀態為「已拒絕」
   Update status to "Rejected"

2. 恢復餘額（取消 pending 扣除）
   Restore balance (cancel pending deduction)

3. 發送拒絕通知給員工（含拒絕原因）
   Send rejection notification (with reason)

4. 記錄審批日誌
   Log rejection record

5. 允許員工重新提交申請
   Allow employee to resubmit
```

**拒絕原因範例 / Rejection Reason Examples:**
```
人力不足 / Insufficient Staff:
"該時段已有 2 位同事請假，人力安排困難，
建議調整至其他時間。"

"2 colleagues already on leave during this period,
insufficient staffing. Please consider other dates."

提前通知不足 / Short Notice:
"請假時間距今不足 3 天，
根據公司政策需提前 7 天申請年假。"

"Less than 3 days notice, company policy requires
7 days advance notice for annual leave."

餘額不足 / Insufficient Balance:
"您的年假餘額僅剩 2 天，
本次申請 3 天超過可用額度。"

"Only 2 days annual leave remaining,
this 3-day request exceeds available balance."
```

### 批量審批 / Batch Approval

**適用場景 / Use Cases:**
- 節日前後大量請假申請
- Mass leave requests before/after holidays
- 例行年假申請
- Routine annual leave requests

**操作步驟 / Steps:**
1. 在待審批列表勾選多個申請
2. 點擊「批量批准」或「批量拒絕」
3. 填寫統一備註（可選）
4. 確認操作

⚠️ **注意事項 / Important Notes:**
- 批量操作前請仔細檢查每個申請
- Carefully review each request before batch operation
- 批量拒絕必須提供原因
- Batch rejection requires reason
- 系統會逐一檢查每個申請的合規性
- System validates each request individually

---

## 請假餘額管理 / Leave Balance Management

### 餘額計算邏輯 / Balance Calculation Logic

```
┌────────────────────────────────────────────────────────┐
│                  餘額計算公式                           │
│               Balance Calculation Formula               │
└────────────────────────────────────────────────────────┘

剩餘天數 (Remaining) =
    總天數 (Total)
  - 已使用天數 (Used)
  - 待審批天數 (Pending)
  + 調整天數 (Adjustment)

範例 / Example:
─────────────────────────────────────────────────────
年初分配：14 天 (Initial allocation: 14 days)
已使用：5 天 (Used: 5 days)
待審批：2 天 (Pending: 2 days)
額外獎勵：+1 天 (Bonus: +1 day)
─────────────────────────────────────────────────────
剩餘 = 14 - 5 - 2 + 1 = 8 天
Remaining = 14 - 5 - 2 + 1 = 8 days
```

### 年度結轉規則 / Annual Carryover Rules

**自動結轉流程 / Automatic Carryover Process:**

```
12月31日 23:59         1月1日 00:00          1月1日 00:01
Year End          →    New Year      →      After Carryover

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│ 2024年餘額  │       │ 系統計算     │       │ 2025年餘額  │
│ 2024 Balance│  →    │ Calculation │  →    │ 2025 Balance│
│             │       │             │       │             │
│ 年假: 3天   │       │ • 檢查結轉  │       │ 總額: 14天  │
│ 病假: 5天   │       │ • 檢查過期  │       │ 結轉: 3天   │
│             │       │ • 重置額度  │       │ 病假: 10天  │
└─────────────┘       └─────────────┘       └─────────────┘
                              │
                              ▼
                      ┌───────────────┐
                      │ 結轉規則檢查  │
                      └───────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
        ┌───────────────┐           ┌──────────────┐
        │ 允許結轉      │           │ 不允許結轉    │
        │ (如: 年假)    │           │ (如: 病假)    │
        └───────────────┘           └──────────────┘
                │                           │
                ▼                           ▼
        ┌───────────────┐           ┌──────────────┐
        │ 計算結轉天數  │           │ 清零重置      │
        │ (最多5天)     │           │ (重新分配)    │
        └───────────────┘           └──────────────┘
```

**結轉規則表 / Carryover Rules Table:**

| 請假類型<br>Leave Type | 結轉<br>Carryover | 最大結轉<br>Max Carryover | 過期月份<br>Expiration | 說明<br>Notes |
|----------------------|-------------------|------------------------|---------------------|--------------|
| 年假<br>Annual | ✅ 允許 / Yes | 5 天 / days | 3月 / March | 未使用部分可結轉至下年度Q1<br>Unused portion carries to next year Q1 |
| 病假<br>Sick | ❌ 不允許 / No | 0 | 12月 / Dec | 年度清零，重新分配<br>Resets annually |
| 事假<br>Personal | ❌ 不允許 / No | 0 | 12月 / Dec | 年度清零<br>Resets annually |
| 婚假<br>Marriage | ❌ 不允許 / No | 0 | 登記後1年 / 1 year | 一次性使用<br>One-time use |
| 產假<br>Maternity | N/A | N/A | 分娩後6月 / 6 months | 特殊處理<br>Special handling |

### 餘額調整 / Balance Adjustment

**調整場景 / Adjustment Scenarios:**

1. **額外獎勵 / Bonus Award**
   - 績效優秀員工
   - High-performing employees
   - 長期服務獎勵
   - Long-service award

2. **特殊扣除 / Special Deduction**
   - 曠職處罰
   - Absence penalty
   - 遲到早退累計
   - Late/early leave accumulation

3. **補發額度 /补Allocation**
   - 系統錯誤修正
   - System error correction
   - 政策變更補償
   - Policy change compensation

**調整操作步驟 / Adjustment Steps:**

```
店主/管理員 → 員工管理 → 選擇員工 → 請假餘額 → 調整
Owner/Admin → Employees → Select → Leave Balance → Adjust

┌────────────────────────────────────────────────────────┐
│                  調整請假餘額                           │
│               Adjust Leave Balance                      │
├────────────────────────────────────────────────────────┤
│ 員工：張小明 (Zhang Xiaoming)                          │
│ 年度：2025                                              │
│                                                         │
│ 【當前餘額 / Current Balance】                          │
│   年假：7 天 / Annual: 7 days                          │
│   病假：10 天 / Sick: 10 days                          │
│                                                         │
│ 【調整設定 / Adjustment】                               │
│   請假類型：[年假 ▼]                                    │
│   Leave Type: [Annual ▼]                                │
│                                                         │
│   調整天數：[+2] 天                                     │
│   Adjustment: [+2] days                                 │
│                                                         │
│   調整原因：                                            │
│   Reason:                                               │
│   ┌──────────────────────────────────────────────┐   │
│   │ 優秀員工獎勵額外2天年假                       │   │
│   │ Bonus 2 days for excellent performance       │   │
│   └──────────────────────────────────────────────┘   │
│                                                         │
│ 【調整後餘額 / New Balance】                            │
│   年假：7 → 9 天                                        │
│   Annual: 7 → 9 days                                    │
│                                                         │
│ [取消] [確認調整]                                       │
│ [Cancel] [Confirm]                                      │
└────────────────────────────────────────────────────────┘
```

⚠️ **重要提醒 / Important Reminders:**
- 所有調整都會記錄在審計日誌中
- All adjustments are logged in audit trail
- 需要填寫詳細的調整原因
- Detailed reason required
- 調整會立即生效
- Changes take effect immediately

---

## 統計與分析 / Statistics & Analytics

### 分析儀表板 / Analytics Dashboard

```
┌────────────────────────────────────────────────────────────┐
│              請假管理分析儀表板                             │
│           Leave Management Analytics Dashboard             │
└────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┬──────────────┐
│   總請假數   │   批准率     │   平均天數   │   待審批     │
│  Total       │  Approval    │  Avg Days    │  Pending     │
│   245        │    92%       │    3.5       │     12       │
└──────────────┴──────────────┴──────────────┴──────────────┘

┌─────────────────────────────────┐ ┌─────────────────────────┐
│     請假趨勢圖 / Trend Chart     │ │ 類型分布 / Distribution │
│                                  │ │                         │
│  50│                     ●       │ │   年假  ███████ 45%    │
│  40│           ●   ●             │ │   病假  ████ 25%       │
│  30│     ●                       │ │   事假  ███ 18%        │
│  20│ ●                       ●   │ │   其他  ██ 12%         │
│  10│                             │ │                         │
│   0└──────────────────────────   │ │                         │
│     1月 3月 5月 7月 9月 11月     │ │                         │
└─────────────────────────────────┘ └─────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│            部門使用狀況 / Department Usage                   │
├─────────────────────────────────────────────────────────────┤
│ 外場服務  ████████████████████ 85人次 平均3.2天           │
│ 內場廚房  ██████████████ 62人次 平均2.8天                 │
│ 收銀台    ███████ 28人次 平均2.1天                         │
│ 管理部    ████ 15人次 平均4.5天                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│            高峰期分析 / Peak Period Analysis                 │
├─────────────────────────────────────────────────────────────┤
│ 📊 最多請假月份：8月 (45人次)                               │
│ 📊 Most requests: August (45 times)                         │
│                                                              │
│ 📊 最多請假週：第32週 (18人次)                              │
│ 📊 Most requests: Week 32 (18 times)                        │
│                                                              │
│ 📊 最常請假日：星期一 (35%)                                 │
│ 📊 Most common: Monday (35%)                                │
└─────────────────────────────────────────────────────────────┘
```

### 可用分析報表 / Available Reports

#### 1. 使用統計報表 / Usage Statistics Report

**包含數據 / Included Data:**
- 總請假次數 / Total requests
- 批准/拒絕率 / Approval/rejection rate
- 平均請假天數 / Average days per request
- 總使用天數 / Total days used
- 各狀態數量分布 / Status distribution

**篩選條件 / Filter Options:**
- 日期範圍 / Date range
- 部門 / Department
- 請假類型 / Leave type
- 員工 / Employee

#### 2. 類型摘要報表 / Type Summary Report

**包含數據 / Included Data:**
- 各類型請假次數 / Requests by type
- 各類型總天數 / Total days by type
- 批准/拒絕數 / Approved/rejected count
- 平均天數 / Average days
- 最常請假月份 / Most common month

#### 3. 員工統計報表 / Employee Statistics Report

**包含數據 / Included Data:**
- 個人請假記錄 / Individual records
- 總使用天數 / Total days used
- 剩餘天數 / Remaining balance
- 最常用類型 / Most used type
- 上次請假日期 / Last leave date

**排序選項 / Sort Options:**
- 使用天數最多 / Most days used
- 剩餘天數最少 / Least remaining
- 請假次數最多 / Most requests

#### 4. 趨勢分析報表 / Trend Analysis Report

**時間維度 / Time Dimensions:**
- 按月分組 / By month
- 按週分組 / By week
- 按季度分組 / By quarter

**顯示指標 / Metrics:**
- 請假次數趨勢 / Request trend
- 批准率趨勢 / Approval rate trend
- 使用天數趨勢 / Days used trend

#### 5. 分布分析報表 / Distribution Analysis Report

**分布維度 / Distribution Dimensions:**
- 按類型分布 / By type
- 按部門分布 / By department
- 按角色分布 / By role
- 按時段分布 / By period (AM/PM)

#### 6. 高峰期分析報表 / Peak Period Analysis Report

**分析內容 / Analysis Content:**
- 最多請假月份 / Peak month
- 最多請假週 / Peak week
- 最常請假星期 / Most common weekday
- 高需求日期列表 / High-demand dates
- 平均每日請假人數 / Avg requests per day

#### 7. 餘額分析報表 / Balance Analytics Report

**包含數據 / Included Data:**
- 平均餘額 / Average balance
- 中位數餘額 / Median balance
- 低餘額員工數 / Employees with low balance
- 零餘額員工數 / Employees with zero balance
- 總未使用天數 / Total unused days
- 即將過期天數 / Expiring days
- 結轉天數 / Carryover days

---

## 匯出功能 / Export Features

### 支援格式 / Supported Formats

| 格式<br>Format | 檔案類型<br>File Type | 適用場景<br>Use Case | 大小<br>Size |
|---------------|---------------------|---------------------|-------------|
| CSV | .csv | Excel 分析<br>Excel analysis | 最小<br>Smallest |
| Excel | .xlsx | 專業報表<br>Professional reports | 中等<br>Medium |
| PDF | .pdf/.html | 列印存檔<br>Print & archive | 較大<br>Larger |

### 匯出操作步驟 / Export Steps

#### 1. 匯出請假記錄 / Export Leave Records

**操作路徑 / Path:**
```
請假管理 → 匯出 → 請假記錄
Leave Management → Export → Leave Records
```

**匯出設定 / Export Settings:**
```
┌────────────────────────────────────────────────────────┐
│              匯出請假記錄                               │
│            Export Leave Records                         │
├────────────────────────────────────────────────────────┤
│ 【篩選條件 / Filters】                                  │
│                                                         │
│ 日期範圍 / Date Range:                                  │
│ [2025-01-01] 至 [2025-12-31]                           │
│                                                         │
│ 請假類型 / Leave Types:                                 │
│ ☑ 年假  ☑ 病假  ☑ 事假                                 │
│ ☐ 婚假  ☐ 產假  ☐ 其他                                 │
│                                                         │
│ 員工 / Employees:                                       │
│ [ ] 全部 (All)                                          │
│ [ ] 指定員工 (Specific):                                │
│     [選擇員工... ▼]                                     │
│                                                         │
│ 狀態 / Status:                                          │
│ ☑ 待審批  ☑ 已批准  ☑ 已拒絕  ☑ 已取消                │
│                                                         │
│ 【格式選擇 / Format】                                   │
│ ◉ CSV (.csv)                                           │
│ ○ Excel (.xlsx)                                        │
│ ○ PDF (.pdf)                                           │
│                                                         │
│ 【欄位選擇 / Column Selection】                         │
│ ☑ 員工姓名      ☑ 請假類型     ☑ 開始日期             │
│ ☑ 結束日期      ☑ 天數         ☑ 狀態                 │
│ ☑ 申請時間      ☑ 審批人       ☑ 審批時間             │
│ ☑ 原因          ☐ 備註                                 │
│                                                         │
│ [取消] [匯出]                                           │
│ [Cancel] [Export]                                       │
└────────────────────────────────────────────────────────┘
```

**匯出欄位 / Export Columns:**

| 欄位名稱<br>Column Name | 說明<br>Description | 必選<br>Required |
|------------------------|-------------------|-----------------|
| 員工姓名<br>Employee Name | 申請人姓名<br>Requester name | ✅ |
| 員工郵箱<br>Email | 聯絡信箱<br>Contact email | ☐ |
| 請假類型<br>Leave Type | 類型名稱<br>Type name | ✅ |
| 開始日期<br>Start Date | 請假開始日<br>Leave start | ✅ |
| 結束日期<br>End Date | 請假結束日<br>Leave end | ✅ |
| 開始時段<br>Start Period | AM/PM/全天<br>AM/PM/Full | ☐ |
| 結束時段<br>End Period | AM/PM/全天<br>AM/PM/Full | ☐ |
| 總天數<br>Total Days | 請假天數<br>Leave days | ✅ |
| 原因<br>Reason | 請假原因<br>Leave reason | ✅ |
| 狀態<br>Status | 當前狀態<br>Current status | ✅ |
| 提交時間<br>Created At | 申請時間<br>Request time | ✅ |
| 審批人<br>Approver | 審批主管<br>Approving manager | ☐ |
| 審批時間<br>Approved At | 審批日期<br>Approval date | ☐ |
| 拒絕原因<br>Rejection Reason | 拒絕說明<br>Rejection note | ☐ |

#### 2. 匯出請假餘額 / Export Leave Balances

**操作路徑 / Path:**
```
請假管理 → 匯出 → 請假餘額
Leave Management → Export → Leave Balances
```

**匯出內容 / Export Content:**
- 員工基本資訊 / Employee info
- 各類型餘額明細 / Balance by type
- 年度總額 / Annual total
- 已使用天數 / Used days
- 待審批天數 / Pending days
- 剩餘天數 / Remaining days
- 結轉天數 / Carryover days

#### 3. 匯出統計報表 / Export Analytics Reports

**可匯出報表 / Exportable Reports:**
1. 使用統計摘要 / Usage summary
2. 類型分布分析 / Type distribution
3. 部門使用對比 / Department comparison
4. 員工排行榜 / Employee ranking
5. 趨勢分析圖表 / Trend charts
6. 高峰期分析 / Peak analysis

### 匯出文件範例 / Export File Examples

#### CSV 範例 / CSV Example:
```csv
員工姓名,員工郵箱,請假類型,開始日期,結束日期,總天數,狀態,提交時間
張小明,zhang@example.com,年假,2025-11-10,2025-11-12,3.0,已批准,2025-11-03 14:30
李小華,li@example.com,病假,2025-11-08,2025-11-08,1.0,已批准,2025-11-07 09:15
王大明,wang@example.com,事假,2025-11-15,2025-11-15,0.5,待審批,2025-11-05 16:20
```

#### Excel 範例結構 / Excel Example Structure:
```
Sheet 1: 請假記錄 (Leave Records)
┌──────┬──────┬────────┬────────┬─────┬──────┐
│ 員工 │ 類型 │ 開始   │ 結束   │ 天數│ 狀態 │
├──────┼──────┼────────┼────────┼─────┼──────┤
│ 張明 │ 年假 │11-10   │11-12   │ 3.0 │ 批准 │
│ 李華 │ 病假 │11-08   │11-08   │ 1.0 │ 批准 │
└──────┴──────┴────────┴────────┴─────┴──────┘

Sheet 2: 統計摘要 (Summary)
┌────────────┬─────┐
│ 項目       │ 數值│
├────────────┼─────┤
│ 總請假次數 │ 245 │
│ 批准率     │ 92% │
│ 平均天數   │ 3.5 │
└────────────┴─────┘
```

---

## 通知系統 / Notification System

### 通知渠道 / Notification Channels

```
┌────────────────────────────────────────────────────────┐
│                通知系統架構                             │
│             Notification System Architecture            │
└────────────────────────────────────────────────────────┘

        事件觸發 (Event Triggered)
                │
                ▼
        ┌───────────────┐
        │ 通知服務       │
        │ Notification  │
        │ Service       │
        └───────┬───────┘
                │
        ┌───────┴───────┬───────────┬──────────┐
        │               │           │          │
        ▼               ▼           ▼          ▼
  ┌─────────┐    ┌─────────┐  ┌────────┐  ┌──────┐
  │  Email  │    │   SMS   │  │  推播  │  │ 站內 │
  │  📧    │    │   📱   │  │  🔔   │  │  💬 │
  └─────────┘    └─────────┘  └────────┘  └──────┘
```

### 通知類型 / Notification Types

#### 1. 請假申請通知 / Leave Request Notifications

**觸發時機 / Trigger:**
- 員工提交請假申請時
- When employee submits leave request

**接收者 / Recipients:**
- 審批主管 / Approving supervisor
- 部門經理 / Department manager

**通知內容 / Content:**
```
主題 / Subject: 新的請假申請待審批
Title: New Leave Request Pending Approval

內容 / Content:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 新的請假申請
New Leave Request

員工 / Employee: 張小明 (Zhang Xiaoming)
部門 / Department: 外場服務 (Service)

請假類型 / Type: 年假 (Annual Leave)
日期範圍 / Dates: 2025-11-10 至 2025-11-12
天數 / Days: 3 天 (3 days)

原因 / Reason:
規劃家庭旅遊
Planned family vacation

請盡快審批此請假申請。
Please review and approve this request.

[立即審批 / Approve Now]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 2. 審批結果通知 / Approval Result Notifications

**觸發時機 / Trigger:**
- 主管批准或拒絕請假申請時
- When supervisor approves or rejects request

**接收者 / Recipients:**
- 申請員工 / Requesting employee
- 抄送：HR部門 / CC: HR department

**批准通知範例 / Approval Example:**
```
主題 / Subject: 您的請假申請已批准 ✅
Title: Your Leave Request Approved ✅

內容 / Content:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 請假申請已批准
Leave Request Approved

您的請假申請已獲批准：

請假類型 / Type: 年假 (Annual Leave)
日期範圍 / Dates: 2025-11-10 至 2025-11-12
天數 / Days: 3 天 (3 days)

審批人 / Approver: 林主管 (Manager Lin)
審批時間 / Approved At: 2025-11-04 10:30

審批備註 / Comments:
批准，請提前完成手頭工作。
Approved, please complete current tasks in advance.

更新後餘額 / Updated Balance:
年假剩餘 / Annual Remaining: 4 天 (4 days)

祝您假期愉快！
Enjoy your time off!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**拒絕通知範例 / Rejection Example:**
```
主題 / Subject: 您的請假申請未獲批准 ❌
Title: Your Leave Request Not Approved ❌

內容 / Content:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ 請假申請未獲批准
Leave Request Not Approved

很抱歉，您的請假申請未獲批准：

請假類型 / Type: 年假 (Annual Leave)
日期範圍 / Dates: 2025-11-10 至 2025-11-12
天數 / Days: 3 天 (3 days)

審批人 / Reviewed By: 林主管 (Manager Lin)
審批時間 / Reviewed At: 2025-11-04 10:30

拒絕原因 / Reason:
該時段已有2位同事請假，人力安排困難，
建議調整至其他時間。

2 colleagues already on leave during this period,
insufficient staffing. Please consider other dates.

您可以：
You can:
• 調整日期後重新申請
  Adjust dates and resubmit
• 聯繫主管討論
  Contact supervisor to discuss

[重新申請 / Resubmit]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 3. 餘額提醒通知 / Balance Alert Notifications

**觸發時機 / Trigger:**
- 餘額低於設定閾值時
- When balance falls below threshold
- 年假即將過期時
- When annual leave about to expire

**接收者 / Recipients:**
- 員工本人 / Employee

**通知內容 / Content:**
```
主題 / Subject: 請假餘額提醒 ⚠️
Title: Leave Balance Alert ⚠️

內容 / Content:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  請假餘額提醒
Leave Balance Alert

您好 張小明，

您的年假餘額即將不足：

當前餘額 / Current Balance:
• 年假 / Annual: 3 天 (3 days) ⚠️
• 病假 / Sick: 8 天 (8 days)

注意事項 / Notes:
• 建議盡快安排年假，避免過期
• 結轉截止日期：2026-03-31
• Plan your annual leave soon
• Carryover deadline: Mar 31, 2026

[查看詳情 / View Details]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 4. 取消請假通知 / Cancellation Notifications

**觸發時機 / Trigger:**
- 員工取消已批准的請假時
- When employee cancels approved leave

**接收者 / Recipients:**
- 審批主管 / Approving supervisor
- HR部門 / HR department

#### 5. 即將到期提醒 / Expiration Reminders

**觸發時機 / Trigger:**
- 年假即將過期前30天、15天、7天
- 30, 15, 7 days before expiration

**接收者 / Recipients:**
- 員工本人 / Employee
- 抄送：直屬主管 / CC: Direct supervisor

### 通知設定 / Notification Settings

**個人通知偏好 / Personal Preferences:**

```
個人設定 → 通知偏好
Personal Settings → Notification Preferences

┌────────────────────────────────────────────────────────┐
│              通知偏好設定                               │
│         Notification Preferences                        │
├────────────────────────────────────────────────────────┤
│                                                         │
│ 【通知渠道 / Channels】                                 │
│                                                         │
│ 📧 Email:                                              │
│ ☑ 啟用郵件通知 (Enable email notifications)           │
│ 信箱：zhang@example.com                                │
│                                                         │
│ 📱 SMS:                                                │
│ ☑ 啟用簡訊通知 (Enable SMS notifications)             │
│ 手機：+886-912-345-678                                 │
│                                                         │
│ 🔔 推播通知:                                           │
│ ☑ 啟用推播通知 (Enable push notifications)            │
│                                                         │
│ 【通知類型 / Types】                                    │
│                                                         │
│ ☑ 請假審批結果 (Approval results)                      │
│ ☑ 餘額提醒 (Balance alerts)                            │
│ ☑ 即將過期提醒 (Expiration reminders)                  │
│ ☐ 系統公告 (System announcements)                      │
│                                                         │
│ 【提醒頻率 / Frequency】                                │
│                                                         │
│ 過期提醒：                                              │
│ ◉ 30天、15天、7天前 (30, 15, 7 days before)           │
│ ○ 15天、7天前 (15, 7 days before)                     │
│ ○ 僅7天前 (Only 7 days before)                        │
│                                                         │
│ 【安靜時段 / Quiet Hours】                              │
│                                                         │
│ ☑ 啟用安靜時段 (Enable quiet hours)                    │
│ 時間：22:00 - 08:00                                    │
│ (不在此時段發送非緊急通知)                             │
│                                                         │
│ [儲存設定 / Save Settings]                              │
└────────────────────────────────────────────────────────┘
```

---

## 常見問題 / FAQ

### 1. 如何申請半天假？ / How to request half-day leave?

**問題 / Question:**
我只需要請假半天（上午或下午），該如何操作？
I only need half a day off (morning or afternoon), how do I request it?

**解答 / Answer:**
1. 在申請請假時，選擇**同一天**作為開始和結束日期
2. 在時段選擇中，選擇「上午 (AM)」或「下午 (PM)」
3. 系統會自動計算為 0.5 天
4. 確認剩餘天數足夠（至少 0.5 天）
5. 提交申請

注意事項：
- 半天假僅適用於單日請假
- 某些請假類型可能不支援半天（如婚假、產假）
- Half-day only available for single-day requests
- Some leave types may not support half-day

---

### 2. 請假申請被拒絕後怎麼辦？ / What if my request is rejected?

**問題 / Question:**
我的請假申請被主管拒絕了，我該怎麼辦？
My leave request was rejected by my supervisor, what should I do?

**解答 / Answer:**

1. **查看拒絕原因 / Check Rejection Reason:**
   - 進入請假記錄查看詳細的拒絕原因
   - View detailed rejection reason in leave records

2. **常見拒絕原因及應對 / Common Reasons & Solutions:**

   | 拒絕原因<br>Reason | 建議解決方案<br>Solution |
   |-------------------|------------------------|
   | 人力不足<br>Insufficient staff | 調整至其他日期<br>Change to other dates |
   | 提前通知不足<br>Short notice | 提前規劃下次請假<br>Plan ahead next time |
   | 餘額不足<br>Insufficient balance | 檢查餘額並調整天數<br>Check balance and adjust days |
   | 與重要活動衝突<br>Conflict with important events | 協調時間或參與活動<br>Coordinate or attend event |

3. **後續行動 / Next Steps:**
   - 與主管溝通了解具體情況
   - Communicate with supervisor
   - 調整請假日期後重新申請
   - Adjust dates and resubmit
   - 如有特殊原因，提供補充說明
   - Provide additional explanation if needed

---

### 3. 如何取消已提交的請假申請？ / How to cancel submitted request?

**問題 / Question:**
我已經提交了請假申請，但現在想取消，該如何操作？
I've submitted a leave request but want to cancel it, how do I do that?

**解答 / Answer:**

**取消規則 / Cancellation Rules:**

| 請假狀態<br>Status | 可否取消<br>Can Cancel | 操作方式<br>Method |
|-------------------|----------------------|-------------------|
| 待審批<br>Pending | ✅ 可以 / Yes | 直接取消<br>Direct cancel |
| 已批准<br>Approved | ⚠️ 有條件 / Conditional | 需主管同意<br>Requires approval |
| 已拒絕<br>Rejected | ❌ 不可 / No | 已結束<br>Already ended |
| 已取消<br>Cancelled | ❌ 不可 / No | 已結束<br>Already ended |

**操作步驟 / Steps:**

1. **取消待審批請假 / Cancel Pending:**
   ```
   請假管理 → 我的請假 → 找到該記錄 → 點擊「取消」
   Leave Management → My Leaves → Find record → Click "Cancel"
   ```
   - 直接取消即可
   - Direct cancellation
   - 餘額會立即恢復
   - Balance restored immediately

2. **取消已批准請假 / Cancel Approved:**
   ```
   請假管理 → 我的請假 → 找到該記錄 → 點擊「申請取消」
   Leave Management → My Leaves → Find record → Click "Request Cancel"
   ```
   - 需要填寫取消原因
   - Need to provide reason
   - 等待主管批准取消
   - Wait for supervisor approval
   - 批准後餘額恢復
   - Balance restored after approval

⚠️ **重要提醒 / Important:**
- 請假開始前24小時內取消可能需要特別審批
- Cancellation within 24 hours may need special approval
- 頻繁取消請假可能影響信用記錄
- Frequent cancellations may affect credibility
- 緊急情況請直接聯繫主管
- Contact supervisor directly in emergencies

---

### 4. 餘額不足時可以申請請假嗎？ / Can I request leave with insufficient balance?

**問題 / Question:**
我的年假餘額只剩2天，但想請3天假，可以嗎？
I only have 2 days annual leave left but want to request 3 days, is it possible?

**解答 / Answer:**

**選項 1: 使用其他類型請假 / Option 1: Use Other Leave Types**
```
年假不足時，可以：
When annual leave insufficient, you can:

• 將部分天數改為事假 (Personal Leave)
• 使用無薪假 (Unpaid Leave)
• 與主管協商特殊安排 (Special arrangement)
```

**選項 2: 拆分請假申請 / Option 2: Split Request**
```
範例 / Example:
需要請假：3天 (Need: 3 days)
年假餘額：2天 (Annual balance: 2 days)

申請方案 / Request plan:
• 申請1：年假 2天 (Annual: 2 days)
• 申請2：事假 1天 (Personal: 1 day)
```

**選項 3: 申請餘額調整 / Option 3: Request Balance Adjustment**
```
特殊情況下可以：
In special cases, you can:

• 向主管說明原因
  Explain to supervisor
• 申請額外年假配額
  Request additional quota
• 使用下年度額度 (需批准)
  Use next year's quota (requires approval)
```

⚠️ **注意 / Note:**
- 系統預設會阻止餘額不足的申請
- System blocks insufficient balance by default
- 如有特殊需求，請直接聯繫HR或主管
- Contact HR or supervisor for special needs

---

### 5. 如何查看團隊成員的請假狀況？ / How to view team leave status?

**問題 / Question:**
作為主管，如何查看團隊成員的請假安排？
As a supervisor, how do I view team members' leave schedules?

**解答 / Answer:**

**方法 1: 請假日曆檢視 / Method 1: Leave Calendar View**
```
請假管理 → 團隊日曆 → 選擇月份
Leave Management → Team Calendar → Select Month

顯示：
Shows:
• 所有團隊成員的請假日期 (All team leave dates)
• 不同顏色標示不同類型 (Different colors for types)
• 人力配置狀況 (Staffing status)
```

**方法 2: 員工請假列表 / Method 2: Employee Leave List**
```
請假管理 → 員工請假 → 篩選部門
Leave Management → Employee Leaves → Filter Department

可以查看：
Can view:
• 個別員工的所有請假記錄
  Individual employee leave records
• 請假頻率和模式
  Leave frequency and patterns
• 餘額使用情況
  Balance usage
```

**方法 3: 統計報表 / Method 3: Statistical Reports**
```
請假管理 → 統計分析 → 部門報表
Leave Management → Analytics → Department Report

提供：
Provides:
• 部門整體使用統計
  Department-wide statistics
• 人力配置分析
  Staffing analysis
• 高峰期預測
  Peak period forecast
```

---

### 6. 年假可以結轉到明年嗎？ / Can annual leave be carried over?

**問題 / Question:**
今年的年假用不完，可以留到明年使用嗎？
I can't use all my annual leave this year, can I carry it over?

**解答 / Answer:**

**年假結轉規則 / Annual Leave Carryover Rules:**

✅ **可以結轉 / Yes, Can Carryover:**
```
條件 / Conditions:
• 最多結轉 5 天 (Maximum 5 days)
• 必須在明年第一季度使用 (Must use in Q1 next year)
• 過期日期：明年 3月31日 (Expires: March 31)

範例 / Example:
2025年餘額：7天 → 結轉 5天 + 過期 2天
2025 balance: 7 days → Carryover 5 + Expire 2

2026年額度：
2026 quota:
• 新年度額度：14天 (New annual: 14 days)
• 2025結轉：5天 (2025 carryover: 5 days)
• 總計可用：19天 (Total available: 19 days)
```

**其他請假類型 / Other Leave Types:**
```
❌ 不可結轉 (Cannot Carryover):
• 病假 (Sick Leave)
• 事假 (Personal Leave)
• 婚假 (Marriage Leave)
• 產假 (Maternity Leave)
• 其他特殊假 (Other special leaves)

這些假別會在年底清零並重新分配。
These reset at year-end with new allocation.
```

**結轉提醒 / Carryover Reminders:**
- 系統會在11月底發送提醒
- System sends reminder in late November
- 建議提前規劃年假使用
- Plan annual leave usage in advance
- 避免過期浪費
- Avoid expiration waste

---

### 7. 請假會影響薪資嗎？ / Does leave affect salary?

**問題 / Question:**
不同類型的請假會扣薪嗎？
Do different leave types affect my salary?

**解答 / Answer:**

**請假類型與薪資對照表 / Leave Types & Salary Impact:**

| 請假類型<br>Leave Type | 是否扣薪<br>Paid/Unpaid | 說明<br>Description |
|----------------------|----------------------|-------------------|
| 年假<br>Annual | ✅ 帶薪<br>Paid | 不影響薪資<br>No impact |
| 病假<br>Sick | ✅ 帶薪<br>Paid | 前10天帶薪<br>First 10 days paid |
| 事假<br>Personal | ⚠️ 依規定<br>Varies | 可能扣薪<br>May be unpaid |
| 婚假<br>Marriage | ✅ 帶薪<br>Paid | 法定帶薪<br>Statutory paid |
| 產假<br>Maternity | ✅ 帶薪<br>Paid | 法定帶薪<br>Statutory paid |
| 陪產假<br>Paternity | ✅ 帶薪<br>Paid | 法定帶薪<br>Statutory paid |
| 喪假<br>Bereavement | ✅ 帶薪<br>Paid | 法定帶薪<br>Statutory paid |
| 無薪假<br>Unpaid | ❌ 無薪<br>Unpaid | 按天數扣薪<br>Deducted by days |

**薪資計算範例 / Salary Calculation Example:**
```
月薪：$30,000
工作日：22天
日薪：$30,000 ÷ 22 = $1,364

請假情況 / Leave Taken:
• 年假 3天：$0 扣除 (Paid)
• 事假 1天：-$1,364
• 無薪假 2天：-$2,727

實際薪資 / Actual Salary:
$30,000 - $1,364 - $2,727 = $25,909
```

**查詢方式 / How to Check:**
```
個人資訊 → 薪資明細 → 本月扣款
Personal Info → Payroll → Monthly Deductions

可查看：
Can view:
• 各類型請假天數 (Leave days by type)
• 扣款明細 (Deduction details)
• 實際薪資 (Actual salary)
```

---

### 8. 如何設定請假審批流程？ / How to configure approval workflow?

**問題 / Question:**
管理員如何設定不同部門的審批流程？
How can admin configure approval workflow for different departments?

**解答 / Answer:**

**系統設定 → 請假管理 → 審批流程設定**
**System Settings → Leave Management → Approval Workflow**

**審批層級設定 / Approval Levels:**

```
單層審批 / Single-Level Approval:
員工 → 直屬主管 → 完成
Employee → Direct Supervisor → Done

┌────────────────────────────────────┐
│ 適用範圍 / Applicable:             │
│ • 一般員工請假                      │
│ • 天數少於3天                       │
│ • 非特殊假別                        │
└────────────────────────────────────┘


雙層審批 / Two-Level Approval:
員工 → 直屬主管 → 部門經理 → 完成
Employee → Supervisor → Manager → Done

┌────────────────────────────────────┐
│ 適用範圍 / Applicable:             │
│ • 主管級員工請假                    │
│ • 天數超過5天                       │
│ • 特殊假別（婚假、產假）            │
└────────────────────────────────────┘


三層審批 / Three-Level Approval:
員工 → 主管 → 經理 → HR → 完成
Employee → Supervisor → Manager → HR → Done

┌────────────────────────────────────┐
│ 適用範圍 / Applicable:             │
│ • 高階主管請假                      │
│ • 天數超過10天                      │
│ • 無薪假申請                        │
└────────────────────────────────────┘
```

**設定步驟 / Configuration Steps:**

1. 選擇部門或角色 / Select department or role
2. 設定審批層級 / Set approval levels
3. 指定審批人員 / Assign approvers
4. 設定審批時限 / Set approval deadlines
5. 啟用自動提醒 / Enable auto-reminders
6. 儲存並測試 / Save and test

---

### 9. 可以批量匯入員工請假記錄嗎？ / Can I bulk import leave records?

**問題 / Question:**
從舊系統遷移，如何批量匯入歷史請假記錄？
Migrating from old system, how to bulk import historical leave records?

**解答 / Answer:**

**批量匯入功能 / Bulk Import Feature:**

**操作路徑 / Path:**
```
系統設定 → 資料管理 → 批量匯入 → 請假記錄
System Settings → Data Management → Bulk Import → Leave Records
```

**匯入步驟 / Import Steps:**

1. **下載匯入範本 / Download Template:**
   ```
   點擊「下載Excel範本」
   Click "Download Excel Template"

   範本包含欄位 / Template includes:
   • 員工編號 (Employee ID) *必填
   • 員工郵箱 (Email) *必填
   • 請假類型代碼 (Leave Type Code) *必填
   • 開始日期 (Start Date) *必填
   • 結束日期 (End Date) *必填
   • 開始時段 (Start Period)
   • 結束時段 (End Period)
   • 總天數 (Total Days) *必填
   • 原因 (Reason)
   • 狀態 (Status) *必填
   • 審批人郵箱 (Approver Email)
   • 審批時間 (Approved At)
   ```

2. **填寫資料 / Fill Data:**
   ```
   範例 / Example:
   ┌────────┬──────────────┬──────┬────────┬────────┬─────┬────┐
   │員工編號│郵箱          │類型  │開始    │結束    │天數 │狀態│
   ├────────┼──────────────┼──────┼────────┼────────┼─────┼────┤
   │E001    │zhang@ex.com  │ANNUAL│2025-01-│2025-01-│ 3.0 │批准│
   │        │              │      │10      │12      │     │    │
   ├────────┼──────────────┼──────┼────────┼────────┼─────┼────┤
   │E002    │li@ex.com     │SICK  │2025-02-│2025-02-│ 1.0 │批准│
   │        │              │      │05      │05      │     │    │
   └────────┴──────────────┴──────┴────────┴────────┴─────┴────┘
   ```

3. **上傳檔案 / Upload File:**
   - 選擇填寫好的Excel檔案
   - Select filled Excel file
   - 系統會進行格式驗證
   - System validates format

4. **驗證結果 / Validation Results:**
   ```
   ✅ 驗證成功 / Validation Passed:
   • 總記錄數：150
   • 格式正確：150
   • 可以匯入：150

   ❌ 驗證失敗 / Validation Failed:
   • 總記錄數：150
   • 格式正確：145
   • 錯誤記錄：5

   錯誤詳情 / Error Details:
   • 第3行：員工編號不存在
   • 第15行：日期格式錯誤
   • 第28行：請假類型代碼無效
   ```

5. **確認匯入 / Confirm Import:**
   - 檢查預覽資料
   - Review preview data
   - 確認無誤後點擊「開始匯入」
   - Click "Start Import" after confirmation

**注意事項 / Important Notes:**
- 大量資料建議分批匯入（每次不超過500筆）
- Large datasets: import in batches (max 500 per batch)
- 匯入前建議先備份現有資料
- Backup existing data before import
- 匯入完成後檢查餘額是否正確
- Verify balances after import

---

### 10. 如何處理請假衝突？ / How to handle leave conflicts?

**問題 / Question:**
如果有多位員工在同一時間請假導致人力不足，該如何處理？
What if multiple employees request leave at the same time causing insufficient staffing?

**解答 / Answer:**

**衝突類型 / Conflict Types:**

1. **人力衝突 / Staffing Conflict:**
   ```
   ⚠️ 同時段請假人數過多
   Too many employees on leave at same time

   範例 / Example:
   • 部門總人數：10人
   • 最少需要：7人
   • 已請假：4人
   • 新申請：1人
   • 結果：人力不足 ❌
   ```

2. **排班衝突 / Schedule Conflict:**
   ```
   ⚠️ 請假與已排班次重疊
   Leave overlaps with scheduled shifts

   系統會顯示：
   System shows:
   • 衝突日期和班次
   • 受影響的工作任務
   • 建議調整方案
   ```

3. **關鍵時段衝突 / Peak Period Conflict:**
   ```
   ⚠️ 節假日或高峰期請假
   Leave during holidays or peak periods

   需要特別審批：
   Requires special approval:
   • 提供充分理由
   • 提前通知時間更長
   • 可能需要更高層級批准
   ```

**解決方案 / Solutions:**

**方案 1: 調整請假時間 / Adjust Leave Dates**
```
建議員工：
Suggest employee:
• 查看團隊日曆
  Check team calendar
• 選擇較少人請假的日期
  Choose dates with fewer leaves
• 與同事協調
  Coordinate with colleagues
```

**方案 2: 設定請假配額 / Set Leave Quotas**
```
系統設定 → 請假管理 → 配額管理
System Settings → Leave Management → Quota Management

設定：
Configure:
• 同時段最多請假人數限制
  Max concurrent leaves
• 關鍵時段的特殊規則
  Special rules for peak periods
• 優先級規則（先到先得）
  Priority rules (first-come-first-served)
```

**方案 3: 建立候補機制 / Waitlist Mechanism**
```
當人力已滿時：
When staffing full:
1. 員工加入候補名單
   Employee joins waitlist
2. 如有人取消，自動通知
   Auto-notify if someone cancels
3. 候補者可選擇接受或拒絕
   Waitlisted can accept or decline
```

**方案 4: 彈性調整班次 / Flexible Shift Adjustment**
```
與員工協商：
Negotiate with employee:
• 調整班次時間
  Adjust shift times
• 安排替班人員
  Arrange cover staff
• 加班補償
  Overtime compensation
```

**預防措施 / Preventive Measures:**
```
提前規劃 / Plan Ahead:
• 每月初公布高峰期日期
  Announce peak dates monthly
• 鼓勵提前申請
  Encourage early requests
• 定期檢視人力配置
  Regular staffing review

系統限制 / System Limits:
• 設定提前申請天數要求
  Set advance notice requirement
• 關鍵時段自動警告
  Auto-warn for critical periods
• 主管優先審批權
  Supervisor priority approval
```

---

## 鍵盤快捷鍵 / Keyboard Shortcuts

### 全局快捷鍵 / Global Shortcuts

| 快捷鍵<br>Shortcut | 功能<br>Function | 說明<br>Description |
|-------------------|-----------------|-------------------|
| `Ctrl + N` | 新增請假申請<br>New Leave Request | 快速開啟申請表單<br>Quick open form |
| `Ctrl + K` | 搜尋請假記錄<br>Search Leaves | 開啟搜尋框<br>Open search box |
| `Ctrl + E` | 匯出當前頁面<br>Export Current | 匯出當前檢視資料<br>Export current view |
| `Ctrl + P` | 列印當前頁面<br>Print Current | 列印當前內容<br>Print current content |
| `Ctrl + R` | 重新整理資料<br>Refresh Data | 更新最新資料<br>Update latest data |
| `Esc` | 關閉彈窗<br>Close Modal | 關閉當前對話框<br>Close current dialog |

### 列表操作 / List Operations

| 快捷鍵<br>Shortcut | 功能<br>Function | 說明<br>Description |
|-------------------|-----------------|-------------------|
| `↑` / `↓` | 上下移動<br>Move Up/Down | 選擇列表項目<br>Select list item |
| `Enter` | 開啟詳情<br>Open Details | 查看選中記錄<br>View selected record |
| `Space` | 勾選/取消<br>Check/Uncheck | 批量操作時使用<br>For batch operations |
| `Ctrl + A` | 全選<br>Select All | 選擇所有項目<br>Select all items |
| `Ctrl + D` | 取消全選<br>Deselect All | 取消所有選擇<br>Deselect all items |

### 審批操作 / Approval Operations

| 快捷鍵<br>Shortcut | 功能<br>Function | 說明<br>Description |
|-------------------|-----------------|-------------------|
| `Ctrl + Enter` | 快速批准<br>Quick Approve | 批准選中申請<br>Approve selected |
| `Ctrl + Shift + R` | 快速拒絕<br>Quick Reject | 拒絕選中申請<br>Reject selected |
| `Ctrl + M` | 添加備註<br>Add Comment | 快速填寫備註<br>Quick add comment |

### 日曆檢視 / Calendar View

| 快捷鍵<br>Shortcut | 功能<br>Function | 說明<br>Description |
|-------------------|-----------------|-------------------|
| `←` / `→` | 上月/下月<br>Prev/Next Month | 切換月份<br>Switch month |
| `T` | 今天<br>Today | 跳轉到今天<br>Jump to today |
| `D` | 日檢視<br>Day View | 切換到日檢視<br>Switch to day view |
| `W` | 週檢視<br>Week View | 切換到週檢視<br>Switch to week view |
| `M` | 月檢視<br>Month View | 切換到月檢視<br>Switch to month view |

---

## 技術支援 / Technical Support

### 聯繫方式 / Contact Information

**技術支援團隊 / Technical Support Team:**
- 📧 Email: support@makanmakan.com
- 📱 電話 / Phone: +886-2-1234-5678
- 💬 線上客服 / Live Chat: 週一至週五 09:00-18:00

**支援時間 / Support Hours:**
- 一般支援 / General Support: 週一至週五 09:00-18:00
- 緊急支援 / Emergency Support: 24/7
- 回應時間 / Response Time:
  - 緊急問題 / Critical: 1小時內
  - 一般問題 / Normal: 24小時內
  - 功能建議 / Suggestions: 3-5工作日

### 問題回報 / Issue Reporting

**回報問題時請提供 / When reporting, please provide:**
1. 問題詳細描述 / Detailed description
2. 重現步驟 / Steps to reproduce
3. 螢幕截圖或錄影 / Screenshots or recordings
4. 錯誤訊息 / Error messages
5. 瀏覽器和版本 / Browser and version
6. 發生時間 / Time of occurrence

### 文檔資源 / Documentation Resources

**線上文檔 / Online Documentation:**
- 📖 使用手冊 / User Manual: docs.makanmakan.com/manual
- 🎥 影片教學 / Video Tutorials: docs.makanmakan.com/videos
- 📚 API文檔 / API Documentation: api.makanmakan.com/docs
- 📝 更新日誌 / Changelog: docs.makanmakan.com/changelog

### 培訓資源 / Training Resources

**可用培訓 / Available Training:**
- 新用戶入門培訓（線上，1小時）
- New user onboarding (Online, 1 hour)
- 進階功能培訓（每月一次）
- Advanced features training (Monthly)
- 管理員專業培訓（季度）
- Admin professional training (Quarterly)

---

## 附錄 / Appendix

### 請假政策參考 / Leave Policy Reference

**法定假期 / Statutory Holidays:**
- 參考當地勞動法規
- Refer to local labor laws
- 各地區可能有所不同
- May vary by region

**公司政策 / Company Policy:**
- 請參考公司員工手冊
- Refer to employee handbook
- 政策可能定期更新
- Policies may be updated periodically

### 系統更新計劃 / System Update Plan

**即將推出的功能 / Upcoming Features:**
- [ ] 移動端APP / Mobile App
- [ ] 語音通知 / Voice Notifications
- [ ] AI智慧建議最佳請假時間 / AI-suggested best leave dates
- [ ] 團隊協作日曆 / Team collaboration calendar
- [ ] 與第三方日曆整合 / Third-party calendar integration

### 版本歷史 / Version History

**當前版本 / Current Version: 2.0**
- 發布日期 / Release Date: 2025-11-01
- 主要更新 / Major Updates:
  - ✅ 完整的請假管理功能
  - ✅ 進階分析與報表
  - ✅ 多渠道通知系統
  - ✅ 匯出功能（CSV、Excel、PDF）
  - ✅ 自動餘額管理
  - ✅ 衝突偵測與預防

---

**文檔版本 / Document Version: 1.0**
**最後更新 / Last Updated: 2025-11-06**
**編寫者 / Author: MakanMakan Development Team**

© 2025 MakanMakan Restaurant Management System. All rights reserved.
