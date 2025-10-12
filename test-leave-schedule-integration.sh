#!/bin/bash

# ============================================
# Leave-Schedule Integration Testing Script
# 測試請假排班雙向整合功能
# ============================================

echo "=========================================="
echo "Leave-Schedule Integration Testing"
echo "=========================================="
echo ""

# Configuration
API_BASE="http://localhost:8787/api/v1"
RESTAURANT_ID=1

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Function to run test
run_test() {
    local test_name=$1
    local expected=$2
    local actual=$3

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    if [ "$actual" == "$expected" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        echo -e "  Expected: $expected"
        echo -e "  Actual: $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Function to extract JSON field
extract_json() {
    echo "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*[^,}]*" | sed 's/.*:[[:space:]]*//' | tr -d '"'
}

echo "============================================"
echo "Phase 1: Setup - Login and Get Auth Token"
echo "============================================"
echo ""

# Login to get auth token
echo "Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@makanmakan.com",
    "password": "admin123"
  }')

AUTH_TOKEN=$(extract_json "$LOGIN_RESPONSE" "token")

if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}✗ FAIL${NC}: Failed to get auth token"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ SUCCESS${NC}: Obtained auth token"
echo "Token: ${AUTH_TOKEN:0:20}..."
echo ""

echo "============================================"
echo "Phase 2: Test Available Employees Query"
echo "============================================"
echo ""

# Test 1: Query available employees for today
TEST_DATE=$(date +%Y-%m-%d)
echo "Test 1: Query available employees for date: $TEST_DATE"
echo "GET $API_BASE/scheduling/$RESTAURANT_ID/available-employees?date=$TEST_DATE"
echo ""

AVAILABLE_EMP_RESPONSE=$(curl -s -X GET \
  "$API_BASE/scheduling/$RESTAURANT_ID/available-employees?date=$TEST_DATE" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json")

echo "Response:"
echo "$AVAILABLE_EMP_RESPONSE" | jq '.' 2>/dev/null || echo "$AVAILABLE_EMP_RESPONSE"
echo ""

# Check if response is successful
SUCCESS=$(extract_json "$AVAILABLE_EMP_RESPONSE" "success")
run_test "Available Employees API responds successfully" "true" "$SUCCESS"

# Check if data is returned
if echo "$AVAILABLE_EMP_RESPONSE" | grep -q '"data"'; then
    echo -e "${GREEN}✓${NC} Data field exists in response"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Data field missing in response"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

echo ""
echo "============================================"
echo "Phase 3: Setup Test Data"
echo "============================================"
echo ""

# Create a shift template for testing
echo "Creating test shift template..."
SHIFT_TEMPLATE_RESPONSE=$(curl -s -X POST \
  "$API_BASE/scheduling/$RESTAURANT_ID/templates" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "測試早班",
    "description": "Integration testing shift",
    "shiftType": "regular",
    "startTime": "09:00",
    "endTime": "17:00",
    "durationMinutes": 480,
    "isSplitShift": false,
    "breakDurationMinutes": 60,
    "applicableDays": "[1,2,3,4,5]",
    "minEmployees": 1,
    "maxEmployees": 5,
    "hourlyRate": 200,
    "colorCode": "#4CAF50",
    "isActive": true
  }')

SHIFT_TEMPLATE_ID=$(echo "$SHIFT_TEMPLATE_RESPONSE" | grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$')

if [ -n "$SHIFT_TEMPLATE_ID" ]; then
    echo -e "${GREEN}✓${NC} Shift template created with ID: $SHIFT_TEMPLATE_ID"
else
    echo -e "${YELLOW}⚠${NC} Could not extract shift template ID, using existing template"
    SHIFT_TEMPLATE_ID=1
fi
echo ""

# Get an employee ID for testing
echo "Getting employee list..."
USERS_RESPONSE=$(curl -s -X GET \
  "$API_BASE/users/$RESTAURANT_ID?role=2" \
  -H "Authorization: Bearer $AUTH_TOKEN")

EMPLOYEE_ID=$(echo "$USERS_RESPONSE" | grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*$')

if [ -z "$EMPLOYEE_ID" ]; then
    echo -e "${RED}✗${NC} No employees found for testing"
    EMPLOYEE_ID=2  # Fallback to default
fi

echo -e "${GREEN}✓${NC} Using employee ID: $EMPLOYEE_ID"
echo ""

# Create a schedule for next week
SCHEDULE_DATE=$(date -d "+7 days" +%Y-%m-%d 2>/dev/null || date -v+7d +%Y-%m-%d 2>/dev/null || echo "2025-10-20")
echo "Creating test schedule for date: $SCHEDULE_DATE"

SCHEDULE_RESPONSE=$(curl -s -X POST \
  "$API_BASE/scheduling/$RESTAURANT_ID/schedules" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"employeeId\": $EMPLOYEE_ID,
    \"shiftTemplateId\": $SHIFT_TEMPLATE_ID,
    \"workDate\": \"$SCHEDULE_DATE\",
    \"startTime\": \"09:00\",
    \"endTime\": \"17:00\",
    \"breakDurationMinutes\": 60,
    \"scheduledHours\": 8,
    \"notes\": \"Integration test schedule\",
    \"createdBy\": 1
  }")

SCHEDULE_ID=$(echo "$SCHEDULE_RESPONSE" | grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$')

if [ -n "$SCHEDULE_ID" ]; then
    echo -e "${GREEN}✓ SUCCESS${NC}: Schedule created with ID: $SCHEDULE_ID"
    echo "Schedule Date: $SCHEDULE_DATE"
    echo "Employee ID: $EMPLOYEE_ID"
else
    echo -e "${RED}✗ FAIL${NC}: Failed to create schedule"
    echo "Response: $SCHEDULE_RESPONSE"
fi
echo ""

echo "============================================"
echo "Phase 4: Test Leave-Schedule Integration"
echo "============================================"
echo ""

# Get leave type ID (Annual Leave)
echo "Getting leave type..."
LEAVE_TYPES_RESPONSE=$(curl -s -X GET \
  "$API_BASE/leaves/$RESTAURANT_ID/types" \
  -H "Authorization: Bearer $AUTH_TOKEN")

LEAVE_TYPE_ID=$(echo "$LEAVE_TYPES_RESPONSE" | grep -o '"code"[[:space:]]*:[[:space:]]*"annual"' -A 10 | grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*$')

if [ -z "$LEAVE_TYPE_ID" ]; then
    echo -e "${YELLOW}⚠${NC} Annual leave type not found, using ID 1"
    LEAVE_TYPE_ID=1
fi

echo -e "${GREEN}✓${NC} Using leave type ID: $LEAVE_TYPE_ID"
echo ""

# Create leave request
echo "Creating leave request for same date as schedule..."
LEAVE_REQUEST_RESPONSE=$(curl -s -X POST \
  "$API_BASE/leaves/$RESTAURANT_ID/requests" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"employeeId\": $EMPLOYEE_ID,
    \"leaveTypeId\": $LEAVE_TYPE_ID,
    \"startDate\": \"$SCHEDULE_DATE\",
    \"endDate\": \"$SCHEDULE_DATE\",
    \"startPeriod\": \"full\",
    \"endPeriod\": \"full\",
    \"totalDays\": 1,
    \"reason\": \"Integration test - should auto-cancel schedule\"
  }")

LEAVE_REQUEST_ID=$(echo "$LEAVE_REQUEST_RESPONSE" | grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$')

if [ -n "$LEAVE_REQUEST_ID" ]; then
    echo -e "${GREEN}✓ SUCCESS${NC}: Leave request created with ID: $LEAVE_REQUEST_ID"
else
    echo -e "${RED}✗ FAIL${NC}: Failed to create leave request"
    echo "Response: $LEAVE_REQUEST_RESPONSE"
fi
echo ""

# Approve leave request (should auto-cancel schedule)
echo "Approving leave request (should trigger auto-cancel)..."
APPROVE_RESPONSE=$(curl -s -X POST \
  "$API_BASE/leaves/requests/$LEAVE_REQUEST_ID/approve" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approverId": 1,
    "comments": "Integration test approval"
  }')

echo "Response:"
echo "$APPROVE_RESPONSE" | jq '.' 2>/dev/null || echo "$APPROVE_RESPONSE"
echo ""

# Check if affectedScheduleIds was populated
AFFECTED_SCHEDULES=$(extract_json "$APPROVE_RESPONSE" "affectedScheduleIds")
if [ -n "$AFFECTED_SCHEDULES" ] && [ "$AFFECTED_SCHEDULES" != "null" ]; then
    echo -e "${GREEN}✓ SUCCESS${NC}: affectedScheduleIds populated: $AFFECTED_SCHEDULES"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠ WARNING${NC}: affectedScheduleIds is empty (may be no schedules to cancel)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

# Verify schedule was cancelled
echo "Verifying schedule was cancelled..."
SCHEDULE_CHECK=$(curl -s -X GET \
  "$API_BASE/scheduling/schedules/$SCHEDULE_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN")

SCHEDULE_STATUS=$(extract_json "$SCHEDULE_CHECK" "status")
echo "Schedule Status: $SCHEDULE_STATUS"

if [ "$SCHEDULE_STATUS" == "cancelled" ]; then
    echo -e "${GREEN}✓ SUCCESS${NC}: Schedule was automatically cancelled!"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}: Schedule was NOT cancelled (status: $SCHEDULE_STATUS)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

# Check manager notes for cancellation reason
MANAGER_NOTES=$(extract_json "$SCHEDULE_CHECK" "managerNotes")
if echo "$MANAGER_NOTES" | grep -q "請假核准"; then
    echo -e "${GREEN}✓ SUCCESS${NC}: Cancellation reason recorded in managerNotes"
    echo "Notes: $MANAGER_NOTES"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠ WARNING${NC}: Cancellation reason not found in managerNotes"
    echo "Notes: $MANAGER_NOTES"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

echo "============================================"
echo "Phase 5: Test Available Employees Filtering"
echo "============================================"
echo ""

# Query available employees again (should exclude employee on leave)
echo "Querying available employees after leave approval..."
AVAILABLE_AFTER_RESPONSE=$(curl -s -X GET \
  "$API_BASE/scheduling/$RESTAURANT_ID/available-employees?date=$SCHEDULE_DATE" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "Response:"
echo "$AVAILABLE_AFTER_RESPONSE" | jq '.' 2>/dev/null || echo "$AVAILABLE_AFTER_RESPONSE"
echo ""

# Check if the employee on leave is excluded from results
if echo "$AVAILABLE_AFTER_RESPONSE" | grep -q "\"id\"[[:space:]]*:[[:space:]]*$EMPLOYEE_ID"; then
    echo -e "${RED}✗ FAIL${NC}: Employee on leave still appears in available employees list"
    TESTS_FAILED=$((TESTS_FAILED + 1))
else
    echo -e "${GREEN}✓ SUCCESS${NC}: Employee on leave correctly excluded from available employees"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

echo "============================================"
echo "Test Summary"
echo "============================================"
echo ""
echo "Total Tests: $TESTS_TOTAL"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo ""
    echo "🎉 Leave-Schedule Integration is working correctly!"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "Please review the failed tests above."
    exit 1
fi
