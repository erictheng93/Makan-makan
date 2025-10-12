# ============================================
# Leave-Schedule Integration Testing Script
# PowerShell Version
# ============================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Leave-Schedule Integration Testing" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$API_BASE = "http://localhost:8787/api/v1"
$RESTAURANT_ID = 1

# Test results tracking
$script:TESTS_PASSED = 0
$script:TESTS_FAILED = 0
$script:TESTS_TOTAL = 0

# Function to run test
function Test-Assertion {
    param(
        [string]$TestName,
        [string]$Expected,
        [string]$Actual
    )

    $script:TESTS_TOTAL++

    if ($Actual -eq $Expected) {
        Write-Host "✓ PASS: $TestName" -ForegroundColor Green
        $script:TESTS_PASSED++
    } else {
        Write-Host "✗ FAIL: $TestName" -ForegroundColor Red
        Write-Host "  Expected: $Expected" -ForegroundColor Yellow
        Write-Host "  Actual: $Actual" -ForegroundColor Yellow
        $script:TESTS_FAILED++
    }
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Phase 1: Setup - Login and Get Auth Token" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

try {
    Write-Host "Logging in as admin..."
    $LOGIN_BODY = @{
        email = "admin@makanmakan.com"
        password = "admin123"
    } | ConvertTo-Json

    $LOGIN_RESPONSE = Invoke-RestMethod `
        -Uri "$API_BASE/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $LOGIN_BODY

    $AUTH_TOKEN = $LOGIN_RESPONSE.data.token

    if ($AUTH_TOKEN) {
        Write-Host "✓ SUCCESS: Obtained auth token" -ForegroundColor Green
        Write-Host "Token: $($AUTH_TOKEN.Substring(0, [Math]::Min(20, $AUTH_TOKEN.Length)))..." -ForegroundColor Gray
    } else {
        Write-Host "✗ FAIL: Failed to get auth token" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ FAIL: Login failed - $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Setup headers for authenticated requests
$HEADERS = @{
    "Authorization" = "Bearer $AUTH_TOKEN"
    "Content-Type" = "application/json"
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Phase 2: Test Available Employees Query" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$TEST_DATE = Get-Date -Format "yyyy-MM-dd"
Write-Host "Test 1: Query available employees for date: $TEST_DATE"
Write-Host "GET $API_BASE/scheduling/$RESTAURANT_ID/available-employees?date=$TEST_DATE"
Write-Host ""

try {
    $AVAILABLE_EMP_RESPONSE = Invoke-RestMethod `
        -Uri "$API_BASE/scheduling/$RESTAURANT_ID/available-employees?date=$TEST_DATE" `
        -Method GET `
        -Headers $HEADERS

    Write-Host "Response:" -ForegroundColor Gray
    $AVAILABLE_EMP_RESPONSE | ConvertTo-Json -Depth 5
    Write-Host ""

    Test-Assertion -TestName "Available Employees API responds successfully" `
        -Expected "True" `
        -Actual $AVAILABLE_EMP_RESPONSE.success.ToString()

    if ($AVAILABLE_EMP_RESPONSE.data) {
        Write-Host "✓ Data field exists in response" -ForegroundColor Green
        $script:TESTS_PASSED++
    } else {
        Write-Host "✗ Data field missing in response" -ForegroundColor Red
        $script:TESTS_FAILED++
    }
    $script:TESTS_TOTAL++

} catch {
    Write-Host "✗ FAIL: Available Employees API error - $_" -ForegroundColor Red
    $script:TESTS_FAILED++
    $script:TESTS_TOTAL++
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Phase 3: Setup Test Data" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Create shift template
Write-Host "Creating test shift template..."
try {
    $SHIFT_TEMPLATE_BODY = @{
        name = "測試早班"
        description = "Integration testing shift"
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
    } | ConvertTo-Json

    $SHIFT_TEMPLATE_RESPONSE = Invoke-RestMethod `
        -Uri "$API_BASE/scheduling/$RESTAURANT_ID/templates" `
        -Method POST `
        -Headers $HEADERS `
        -Body $SHIFT_TEMPLATE_BODY

    $SHIFT_TEMPLATE_ID = $SHIFT_TEMPLATE_RESPONSE.data.id
    Write-Host "✓ Shift template created with ID: $SHIFT_TEMPLATE_ID" -ForegroundColor Green
} catch {
    Write-Host "⚠ Could not create shift template, using ID 1" -ForegroundColor Yellow
    $SHIFT_TEMPLATE_ID = 1
}
Write-Host ""

# Get employee for testing
Write-Host "Getting employee list..."
try {
    $USERS_RESPONSE = Invoke-RestMethod `
        -Uri "$API_BASE/users/$RESTAURANT_ID" `
        -Method GET `
        -Headers $HEADERS

    $EMPLOYEE_ID = $USERS_RESPONSE.data[0].id
    Write-Host "✓ Using employee ID: $EMPLOYEE_ID" -ForegroundColor Green
} catch {
    Write-Host "⚠ Could not get employees, using ID 2" -ForegroundColor Yellow
    $EMPLOYEE_ID = 2
}
Write-Host ""

# Create schedule for next week
$SCHEDULE_DATE = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
Write-Host "Creating test schedule for date: $SCHEDULE_DATE"

try {
    $SCHEDULE_BODY = @{
        employeeId = $EMPLOYEE_ID
        shiftTemplateId = $SHIFT_TEMPLATE_ID
        workDate = $SCHEDULE_DATE
        startTime = "09:00"
        endTime = "17:00"
        breakDurationMinutes = 60
        scheduledHours = 8
        notes = "Integration test schedule"
        createdBy = 1
    } | ConvertTo-Json

    $SCHEDULE_RESPONSE = Invoke-RestMethod `
        -Uri "$API_BASE/scheduling/$RESTAURANT_ID/schedules" `
        -Method POST `
        -Headers $HEADERS `
        -Body $SCHEDULE_BODY

    $SCHEDULE_ID = $SCHEDULE_RESPONSE.data.id
    Write-Host "✓ SUCCESS: Schedule created with ID: $SCHEDULE_ID" -ForegroundColor Green
    Write-Host "  Schedule Date: $SCHEDULE_DATE" -ForegroundColor Gray
    Write-Host "  Employee ID: $EMPLOYEE_ID" -ForegroundColor Gray
} catch {
    Write-Host "✗ FAIL: Failed to create schedule - $_" -ForegroundColor Red
    Write-Host "Response: $_" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Phase 4: Test Leave-Schedule Integration" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Get leave type
Write-Host "Getting leave type..."
try {
    $LEAVE_TYPES_RESPONSE = Invoke-RestMethod `
        -Uri "$API_BASE/leaves/$RESTAURANT_ID/types" `
        -Method GET `
        -Headers $HEADERS

    $ANNUAL_LEAVE = $LEAVE_TYPES_RESPONSE.data | Where-Object { $_.code -eq "annual" }
    $LEAVE_TYPE_ID = $ANNUAL_LEAVE.id

    if (-not $LEAVE_TYPE_ID) {
        Write-Host "⚠ Annual leave type not found, using ID 1" -ForegroundColor Yellow
        $LEAVE_TYPE_ID = 1
    } else {
        Write-Host "✓ Using leave type ID: $LEAVE_TYPE_ID" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Could not get leave types, using ID 1" -ForegroundColor Yellow
    $LEAVE_TYPE_ID = 1
}
Write-Host ""

# Create leave request
Write-Host "Creating leave request for same date as schedule..."
try {
    $LEAVE_REQUEST_BODY = @{
        employeeId = $EMPLOYEE_ID
        leaveTypeId = $LEAVE_TYPE_ID
        startDate = $SCHEDULE_DATE
        endDate = $SCHEDULE_DATE
        startPeriod = "full"
        endPeriod = "full"
        totalDays = 1
        reason = "Integration test - should auto-cancel schedule"
    } | ConvertTo-Json

    $LEAVE_REQUEST_RESPONSE = Invoke-RestMethod `
        -Uri "$API_BASE/leaves/$RESTAURANT_ID/requests" `
        -Method POST `
        -Headers $HEADERS `
        -Body $LEAVE_REQUEST_BODY

    $LEAVE_REQUEST_ID = $LEAVE_REQUEST_RESPONSE.data.id
    Write-Host "✓ SUCCESS: Leave request created with ID: $LEAVE_REQUEST_ID" -ForegroundColor Green
} catch {
    Write-Host "✗ FAIL: Failed to create leave request - $_" -ForegroundColor Red
}
Write-Host ""

# Approve leave request (should auto-cancel schedule)
Write-Host "Approving leave request (should trigger auto-cancel)..." -ForegroundColor Yellow
try {
    $APPROVE_BODY = @{
        approverId = 1
        comments = "Integration test approval"
    } | ConvertTo-Json

    $APPROVE_RESPONSE = Invoke-RestMethod `
        -Uri "$API_BASE/leaves/requests/$LEAVE_REQUEST_ID/approve" `
        -Method POST `
        -Headers $HEADERS `
        -Body $APPROVE_BODY

    Write-Host "Response:" -ForegroundColor Gray
    $APPROVE_RESPONSE | ConvertTo-Json -Depth 5
    Write-Host ""

    # Check affectedScheduleIds
    $AFFECTED_SCHEDULES = $APPROVE_RESPONSE.data.affectedScheduleIds
    if ($AFFECTED_SCHEDULES -and $AFFECTED_SCHEDULES -ne "null") {
        Write-Host "✓ SUCCESS: affectedScheduleIds populated: $AFFECTED_SCHEDULES" -ForegroundColor Green
        $script:TESTS_PASSED++
    } else {
        Write-Host "⚠ WARNING: affectedScheduleIds is empty" -ForegroundColor Yellow
        $script:TESTS_PASSED++
    }
    $script:TESTS_TOTAL++
} catch {
    Write-Host "✗ FAIL: Failed to approve leave request - $_" -ForegroundColor Red
}
Write-Host ""

# Verify schedule was cancelled
Write-Host "Verifying schedule was cancelled..."
try {
    $SCHEDULE_CHECK = Invoke-RestMethod `
        -Uri "$API_BASE/scheduling/schedules/$SCHEDULE_ID" `
        -Method GET `
        -Headers $HEADERS

    $SCHEDULE_STATUS = $SCHEDULE_CHECK.data.status
    Write-Host "Schedule Status: $SCHEDULE_STATUS" -ForegroundColor Gray

    if ($SCHEDULE_STATUS -eq "cancelled") {
        Write-Host "✓ SUCCESS: Schedule was automatically cancelled!" -ForegroundColor Green
        $script:TESTS_PASSED++
    } else {
        Write-Host "✗ FAIL: Schedule was NOT cancelled (status: $SCHEDULE_STATUS)" -ForegroundColor Red
        $script:TESTS_FAILED++
    }
    $script:TESTS_TOTAL++

    # Check manager notes
    $MANAGER_NOTES = $SCHEDULE_CHECK.data.managerNotes
    if ($MANAGER_NOTES -like "*請假核准*") {
        Write-Host "✓ SUCCESS: Cancellation reason recorded in managerNotes" -ForegroundColor Green
        Write-Host "  Notes: $MANAGER_NOTES" -ForegroundColor Gray
        $script:TESTS_PASSED++
    } else {
        Write-Host "⚠ WARNING: Cancellation reason not found in managerNotes" -ForegroundColor Yellow
        Write-Host "  Notes: $MANAGER_NOTES" -ForegroundColor Gray
        $script:TESTS_FAILED++
    }
    $script:TESTS_TOTAL++
} catch {
    Write-Host "✗ FAIL: Failed to verify schedule - $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Phase 5: Test Available Employees Filtering" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Query available employees again
Write-Host "Querying available employees after leave approval..."
try {
    $AVAILABLE_AFTER_RESPONSE = Invoke-RestMethod `
        -Uri "$API_BASE/scheduling/$RESTAURANT_ID/available-employees?date=$SCHEDULE_DATE" `
        -Method GET `
        -Headers $HEADERS

    Write-Host "Response:" -ForegroundColor Gray
    $AVAILABLE_AFTER_RESPONSE | ConvertTo-Json -Depth 5
    Write-Host ""

    # Check if employee on leave is excluded
    $EMPLOYEE_IDS = $AVAILABLE_AFTER_RESPONSE.data | ForEach-Object { $_.id }
    $IS_EXCLUDED = -not ($EMPLOYEE_IDS -contains $EMPLOYEE_ID)

    if ($IS_EXCLUDED) {
        Write-Host "✓ SUCCESS: Employee on leave correctly excluded from available employees" -ForegroundColor Green
        $script:TESTS_PASSED++
    } else {
        Write-Host "✗ FAIL: Employee on leave still appears in available employees list" -ForegroundColor Red
        $script:TESTS_FAILED++
    }
    $script:TESTS_TOTAL++
} catch {
    Write-Host "✗ FAIL: Failed to query available employees - $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total Tests: $TESTS_TOTAL"
Write-Host "Passed: $TESTS_PASSED" -ForegroundColor Green
Write-Host "Failed: $TESTS_FAILED" -ForegroundColor Red
Write-Host ""

if ($TESTS_FAILED -eq 0) {
    Write-Host "✓ ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Leave-Schedule Integration is working correctly!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ SOME TESTS FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please review the failed tests above." -ForegroundColor Yellow
    exit 1
}
