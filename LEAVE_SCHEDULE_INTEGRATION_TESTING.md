# Leave-Schedule Integration Testing Guide

## 測試目標

驗證請假排班雙向整合功能：
1. ✅ 請假核准後自動取消排班
2. ✅ 建立排班時過濾已請假員工

## 前置準備

### 1. 啟動 API 服務

```bash
cd apps/api
npm run dev
```

API 應該在 `http://localhost:8787` 運行

### 2. 設置環境變數

```bash
# API Base URL
$API_BASE = "http://localhost:8787/api/v1"
$RESTAURANT_ID = 1
```

## 測試流程

### Phase 1: 獲取認證 Token

```bash
# PowerShell
$LOGIN_RESPONSE = Invoke-RestMethod -Uri "$API_BASE/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{
    email = "admin@makanmakan.com"
    password = "admin123"
  } | ConvertTo-Json)

$AUTH_TOKEN = $LOGIN_RESPONSE.data.token
Write-Host "Auth Token: $AUTH_TOKEN"
```

### Phase 2: 測試可用員工查詢 API

```bash
# PowerShell
$TEST_DATE = Get-Date -Format "yyyy-MM-dd"

$HEADERS = @{
  "Authorization" = "Bearer $AUTH_TOKEN"
  "Content-Type" = "application/json"
}

# 查詢可用員工
$AVAILABLE_EMP = Invoke-RestMethod `
  -Uri "$API_BASE/scheduling/$RESTAURANT_ID/available-employees?date=$TEST_DATE" `
  -Method GET `
  -Headers $HEADERS

Write-Host "Available Employees:"
$AVAILABLE_EMP | ConvertTo-Json -Depth 5
```

**預期結果：**
- ✅ API 回傳 `success: true`
- ✅ `data` 陣列包含可用員工清單
- ✅ 每個員工包含 `id`, `fullName`, `role`, `availability`

### Phase 3: 創建測試數據

#### 3.1 創建班別模板

```bash
# PowerShell
$SHIFT_TEMPLATE = Invoke-RestMethod `
  -Uri "$API_BASE/scheduling/$RESTAURANT_ID/templates" `
  -Method POST `
  -Headers $HEADERS `
  -Body (@{
    name = "測試早班"
    description = "Integration test shift"
    shiftType = "regular"
    startTime = "09:00"
    endTime = "17:00"
    durationMinutes = 480
    isSplitShift = $false
    breakDurationMinutes = 60
    applicableDays = "[1,2,3,4,5]"
    minEmployees = 1
    maxEmployees = 5
    hourlyRate = 200
    colorCode = "#4CAF50"
    isActive = $true
  } | ConvertTo-Json)

$SHIFT_TEMPLATE_ID = $SHIFT_TEMPLATE.data.id
Write-Host "Shift Template ID: $SHIFT_TEMPLATE_ID"
```

#### 3.2 獲取員工 ID

```bash
# PowerShell
$USERS = Invoke-RestMethod `
  -Uri "$API_BASE/users/$RESTAURANT_ID?role=2" `
  -Method GET `
  -Headers $HEADERS

$EMPLOYEE_ID = $USERS.data[0].id
Write-Host "Test Employee ID: $EMPLOYEE_ID"
```

#### 3.3 創建排班（未來一週）

```bash
# PowerShell
$SCHEDULE_DATE = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")

$SCHEDULE = Invoke-RestMethod `
  -Uri "$API_BASE/scheduling/$RESTAURANT_ID/schedules" `
  -Method POST `
  -Headers $HEADERS `
  -Body (@{
    employeeId = $EMPLOYEE_ID
    shiftTemplateId = $SHIFT_TEMPLATE_ID
    workDate = $SCHEDULE_DATE
    startTime = "09:00"
    endTime = "17:00"
    breakDurationMinutes = 60
    scheduledHours = 8
    notes = "Integration test schedule"
    createdBy = 1
  } | ConvertTo-Json)

$SCHEDULE_ID = $SCHEDULE.data.id
Write-Host "Schedule ID: $SCHEDULE_ID"
Write-Host "Schedule Date: $SCHEDULE_DATE"
Write-Host "Initial Status: $($SCHEDULE.data.status)"
```

**預期結果：**
- ✅ 排班創建成功
- ✅ `status = "scheduled"`

### Phase 4: 測試自動取消排班功能

#### 4.1 獲取請假類型

```bash
# PowerShell
$LEAVE_TYPES = Invoke-RestMethod `
  -Uri "$API_BASE/leaves/$RESTAURANT_ID/types" `
  -Method GET `
  -Headers $HEADERS

$ANNUAL_LEAVE = $LEAVE_TYPES.data | Where-Object { $_.code -eq "annual" }
$LEAVE_TYPE_ID = $ANNUAL_LEAVE.id
Write-Host "Leave Type ID: $LEAVE_TYPE_ID"
```

#### 4.2 創建請假申請（與排班同日期）

```bash
# PowerShell
$LEAVE_REQUEST = Invoke-RestMethod `
  -Uri "$API_BASE/leaves/$RESTAURANT_ID/requests" `
  -Method POST `
  -Headers $HEADERS `
  -Body (@{
    employeeId = $EMPLOYEE_ID
    leaveTypeId = $LEAVE_TYPE_ID
    startDate = $SCHEDULE_DATE
    endDate = $SCHEDULE_DATE
    startPeriod = "full"
    endPeriod = "full"
    totalDays = 1
    reason = "Integration test - should auto-cancel schedule"
  } | ConvertTo-Json)

$LEAVE_REQUEST_ID = $LEAVE_REQUEST.data.id
Write-Host "Leave Request ID: $LEAVE_REQUEST_ID"
Write-Host "Leave Request Status: $($LEAVE_REQUEST.data.status)"
```

**預期結果：**
- ✅ 請假申請創建成功
- ✅ `status = "pending"`

#### 4.3 核准請假（觸發自動取消排班）

```bash
# PowerShell
$APPROVE_RESPONSE = Invoke-RestMethod `
  -Uri "$API_BASE/leaves/requests/$LEAVE_REQUEST_ID/approve" `
  -Method POST `
  -Headers $HEADERS `
  -Body (@{
    approverId = 1
    comments = "Integration test approval"
  } | ConvertTo-Json)

Write-Host "Leave Approved!"
Write-Host "Affected Schedule IDs: $($APPROVE_RESPONSE.data.affectedScheduleIds)"
$APPROVE_RESPONSE | ConvertTo-Json -Depth 5
```

**預期結果：**
- ✅ 請假核准成功
- ✅ `status = "approved"`
- ✅ `affectedScheduleIds` 包含被取消的排班 ID（JSON 字串）

#### 4.4 驗證排班已被取消

```bash
# PowerShell
$SCHEDULE_CHECK = Invoke-RestMethod `
  -Uri "$API_BASE/scheduling/schedules/$SCHEDULE_ID" `
  -Method GET `
  -Headers $HEADERS

Write-Host "Schedule Status After Leave Approval:"
Write-Host "  ID: $($SCHEDULE_CHECK.data.id)"
Write-Host "  Status: $($SCHEDULE_CHECK.data.status)"
Write-Host "  Manager Notes: $($SCHEDULE_CHECK.data.managerNotes)"
```

**預期結果：**
- ✅ `status = "cancelled"` ⭐ 核心驗證點
- ✅ `managerNotes` 包含 "請假核准" 文字
- ✅ 取消原因記錄完整

### Phase 5: 測試可用員工過濾功能

```bash
# PowerShell
$AVAILABLE_AFTER = Invoke-RestMethod `
  -Uri "$API_BASE/scheduling/$RESTAURANT_ID/available-employees?date=$SCHEDULE_DATE" `
  -Method GET `
  -Headers $HEADERS

Write-Host "Available Employees After Leave Approval:"
$AVAILABLE_AFTER.data | ForEach-Object {
  Write-Host "  - ID: $($_.id), Name: $($_.fullName), Availability: $($_.availability)"
}

# 檢查請假員工是否被排除
$IS_EXCLUDED = -not ($AVAILABLE_AFTER.data.id -contains $EMPLOYEE_ID)
if ($IS_EXCLUDED) {
  Write-Host "✓ SUCCESS: Employee on leave excluded from available list" -ForegroundColor Green
} else {
  Write-Host "✗ FAIL: Employee on leave still in available list" -ForegroundColor Red
}
```

**預期結果：**
- ✅ 請假的員工 **不在** 可用員工清單中
- ✅ 其他員工正常顯示在清單中

## 完整測試腳本（PowerShell）

將上述所有命令整合到一個完整的 PowerShell 腳本中，請參考：
`test-leave-schedule-integration.ps1`

## 測試檢查清單

### ✅ Backend Integration Checklist

- [ ] API 服務正常啟動
- [ ] 認證成功獲取 Token
- [ ] 可用員工查詢 API 正常回應
- [ ] 班別模板創建成功
- [ ] 排班創建成功
- [ ] 請假申請創建成功
- [ ] 請假核准成功
- [ ] **排班自動取消（status = cancelled）** ⭐
- [ ] **取消原因記錄正確（managerNotes）** ⭐
- [ ] **affectedScheduleIds 正確記錄** ⭐
- [ ] **請假員工從可用清單中排除** ⭐

### 🔍 Debug Tips

如果測試失敗，檢查以下項目：

1. **排班未被取消**：
   - 檢查 API 日誌中是否有 "Leave approved - Auto-cancelled X schedules"
   - 檢查是否有錯誤日誌 "Failed to auto-cancel schedules"
   - 驗證請假日期和排班日期是否一致

2. **affectedScheduleIds 為空**：
   - 檢查排班創建時間是否在請假申請之前
   - 確認排班狀態不是已取消（只取消非 cancelled 狀態）

3. **請假員工仍在可用清單**：
   - 確認請假狀態為 "approved"
   - 檢查查詢日期是否在請假日期範圍內
   - 查看 API 日誌確認查詢條件

## 預期 API 日誌輸出

在 API console 中應該看到：

```
Leave approved - Auto-cancelled 1 schedules {
  leaveRequestId: 123,
  employeeId: 2,
  scheduleIds: [456]
}
```

## 測試報告模板

```
# Leave-Schedule Integration Test Report

**Test Date:** 2025-10-11
**Tester:** [Your Name]
**API Version:** v1

## Test Results

| Test Case | Expected | Actual | Status |
|-----------|----------|--------|--------|
| Auth Token | Success | Success | ✅ PASS |
| Available Employees API | 200 OK | 200 OK | ✅ PASS |
| Create Schedule | status=scheduled | status=scheduled | ✅ PASS |
| Approve Leave | status=approved | status=approved | ✅ PASS |
| Auto-Cancel Schedule | status=cancelled | status=cancelled | ✅ PASS |
| Record Affected IDs | JSON array | JSON array | ✅ PASS |
| Filter Available Employees | Excluded | Excluded | ✅ PASS |

**Overall Result:** ✅ ALL TESTS PASSED

## Notes
[Any observations or issues encountered]
```

## Next Steps

完成測試後：
1. ✅ 確認所有測試通過
2. 📝 記錄測試結果
3. 🚀 繼續實施 Part 2 - Frontend UI
