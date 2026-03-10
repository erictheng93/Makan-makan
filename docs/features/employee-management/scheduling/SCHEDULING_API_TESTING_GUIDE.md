# Employee Scheduling API Testing Guide

**Date**: 2025-10-11
**API Version**: v1
**Base URL**: `http://localhost:8787/api/v1/scheduling`

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Authentication](#authentication)
3. [Shift Template Endpoints](#shift-template-endpoints)
4. [Employee Schedule Endpoints](#employee-schedule-endpoints)
5. [Clock In/Out Endpoints](#clock-inout-endpoints)
6. [Swap Request Endpoints](#swap-request-endpoints)
7. [Testing Scenarios](#testing-scenarios)
8. [Expected Responses](#expected-responses)

---

## Prerequisites

### 1. Start the Development Server

```bash
cd apps/api
npm run dev
```

The API should be running on `http://localhost:8787`

### 2. Set Environment Variables

Create `TOKEN` variable with a valid JWT token:

```bash
# Login first to get a token
TOKEN=$(curl -X POST http://localhost:8787/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }' | jq -r '.data.token')

echo "Token: $TOKEN"
```

### 3. Set Restaurant ID

```bash
RESTAURANT_ID=1
```

---

## Authentication

All scheduling endpoints (except public QR scanning) require authentication.

**Headers Required**:

- `Authorization: Bearer <token>`
- `Content-Type: application/json`

---

## Shift Template Endpoints

### 1. List Shift Templates

```bash
curl -X GET "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "restaurantId": 1,
      "name": "早班",
      "shiftType": "regular",
      "startTime": "09:00",
      "endTime": "17:00",
      "durationMinutes": 480,
      "colorCode": "#3B82F6"
    }
  ]
}
```

### 2. Create Shift Template

```bash
curl -X POST "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "早班",
    "description": "早班服務時段 9:00-17:00",
    "shiftType": "regular",
    "startTime": "09:00",
    "endTime": "17:00",
    "durationMinutes": 480,
    "breakDurationMinutes": 60,
    "minEmployees": 2,
    "maxEmployees": 5,
    "hourlyRate": 200,
    "overtimeMultiplier": 1.5,
    "colorCode": "#3B82F6"
  }'
```

**Response**:

```json
{
  "success": true,
  "message": "Shift template created successfully",
  "data": {
    "id": 1,
    "name": "早班",
    "startTime": "09:00",
    "endTime": "17:00"
  }
}
```

### 3. Get Shift Template Details

```bash
TEMPLATE_ID=1
curl -X GET "http://localhost:8787/api/v1/scheduling/templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Update Shift Template

```bash
curl -X PUT "http://localhost:8787/api/v1/scheduling/templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "早班 (更新)",
    "hourlyRate": 220
  }'
```

### 5. Delete Shift Template (Soft Delete)

```bash
curl -X DELETE "http://localhost:8787/api/v1/scheduling/templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Employee Schedule Endpoints

### 1. List Employee Schedules

```bash
# All schedules for a restaurant
curl -X GET "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules" \
  -H "Authorization: Bearer $TOKEN"

# Filter by employee
curl -X GET "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules?employeeId=2" \
  -H "Authorization: Bearer $TOKEN"

# Filter by date range
curl -X GET "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules?startDate=2025-10-11&endDate=2025-10-17" \
  -H "Authorization: Bearer $TOKEN"

# Filter by status
curl -X GET "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules?status=scheduled" \
  -H "Authorization: Bearer $TOKEN"

# Pagination
curl -X GET "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "employeeId": 2,
      "workDate": "2025-10-15",
      "startTime": "09:00",
      "endTime": "17:00",
      "scheduledHours": 8,
      "status": "scheduled",
      "employee": {
        "id": 2,
        "fullName": "張員工",
        "role": 3
      },
      "shiftTemplate": {
        "id": 1,
        "name": "早班"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### 2. Create Employee Schedule

```bash
curl -X POST "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": 2,
    "shiftTemplateId": 1,
    "workDate": "2025-10-15",
    "startTime": "09:00",
    "endTime": "17:00",
    "breakDurationMinutes": 60,
    "scheduledHours": 8,
    "notes": "正常排班"
  }'
```

**Response** (with conflict warnings if any):

```json
{
  "success": true,
  "message": "Schedule created successfully",
  "data": {
    "id": 1,
    "employeeId": 2,
    "workDate": "2025-10-15",
    "status": "scheduled"
  }
}
```

### 3. Bulk Create Schedules

Create multiple schedules for multiple employees over a date range:

```bash
curl -X POST "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shiftTemplateId": 1,
    "employeeIds": [2, 3, 4],
    "dateRange": {
      "startDate": "2025-10-15",
      "endDate": "2025-10-21"
    },
    "daysOfWeek": [1, 2, 3, 4, 5]
  }'
```

**Parameters**:

- `daysOfWeek`: Array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
- This will create schedules only for weekdays (Mon-Fri) in the date range

**Response**:

```json
{
  "success": true,
  "message": "Successfully created 15 schedules",
  "data": {
    "count": 15
  }
}
```

### 4. Update Schedule

```bash
SCHEDULE_ID=1
curl -X PUT "http://localhost:8787/api/v1/scheduling/schedules/$SCHEDULE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "10:00",
    "endTime": "18:00",
    "scheduledHours": 8,
    "managerNotes": "時間調整"
  }'
```

### 5. Cancel Schedule

```bash
curl -X DELETE "http://localhost:8787/api/v1/scheduling/schedules/$SCHEDULE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:

```json
{
  "success": true,
  "message": "Schedule cancelled successfully"
}
```

---

## Clock In/Out Endpoints

### 1. Clock In

```bash
SCHEDULE_ID=1
EMPLOYEE_ID=2

curl -X POST "http://localhost:8787/api/v1/scheduling/schedules/$SCHEDULE_ID/clock-in" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": '$EMPLOYEE_ID',
    "notes": "準時上班"
  }'
```

**Response**:

```json
{
  "success": true,
  "message": "Clocked in successfully",
  "data": {
    "id": 1,
    "status": "confirmed",
    "clockInTime": "2025-10-15T09:00:00.000Z"
  }
}
```

**Important Notes**:

- Employees can only clock in for their own schedules (unless they are Admin/Owner)
- Cannot clock in if already clocked in
- Clock in time is recorded as the current server time

### 2. Clock Out

```bash
curl -X POST "http://localhost:8787/api/v1/scheduling/schedules/$SCHEDULE_ID/clock-out" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": '$EMPLOYEE_ID',
    "notes": "正常下班"
  }'
```

**Response**:

```json
{
  "success": true,
  "message": "Clocked out successfully",
  "data": {
    "id": 1,
    "status": "completed",
    "clockOutTime": "2025-10-15T17:00:00.000Z",
    "actualHours": 8.0,
    "overtimeHours": 0.0
  }
}
```

**Automatic Calculations**:

- `actualHours`: Calculated from clock in/out times
- `overtimeHours`: Hours beyond `scheduledHours`

**Error Cases**:

- `"Must clock in first"` - Cannot clock out without clocking in
- `"Already clocked out"` - Cannot clock out twice

---

## Swap Request Endpoints

### 1. Create Swap Request

```bash
curl -X POST "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/swap-requests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requesterEmployeeId": 2,
    "requesterScheduleId": 1,
    "targetEmployeeId": 3,
    "requestType": "swap",
    "reason": "有私事需要換班",
    "urgency": "normal"
  }'
```

**Request Types**:

- `swap`: Exchange shifts with another employee
- `cover`: Request someone to cover (no exchange)
- `drop`: Request to drop shift without replacement

**Urgency Levels**:

- `low`: 可以等待
- `normal`: 一般請求
- `high`: 較緊急
- `urgent`: 非常緊急

**Response**:

```json
{
  "success": true,
  "message": "Swap request created successfully",
  "data": {
    "id": 1,
    "status": "pending",
    "requestType": "swap",
    "urgency": "normal"
  }
}
```

### 2. Approve Swap Request (Manager Only)

```bash
REQUEST_ID=1
MANAGER_ID=1

curl -X POST "http://localhost:8787/api/v1/scheduling/swap-requests/$REQUEST_ID/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "managerId": '$MANAGER_ID'
  }'
```

**Response**:

```json
{
  "success": true,
  "message": "Swap request approved successfully",
  "data": {
    "id": 1,
    "status": "approved",
    "approvedBy": 1,
    "approvedAt": "2025-10-15T10:00:00.000Z"
  }
}
```

---

## Testing Scenarios

### Scenario 1: Complete Workflow Test

```bash
# 1. Create shift template
TEMPLATE_RESPONSE=$(curl -s -X POST "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "測試早班",
    "shiftType": "regular",
    "startTime": "09:00",
    "endTime": "17:00",
    "durationMinutes": 480
  }')

TEMPLATE_ID=$(echo $TEMPLATE_RESPONSE | jq -r '.data.id')
echo "Template ID: $TEMPLATE_ID"

# 2. Create schedule
SCHEDULE_RESPONSE=$(curl -s -X POST "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": 2,
    "shiftTemplateId": '$TEMPLATE_ID',
    "workDate": "2025-10-15",
    "startTime": "09:00",
    "endTime": "17:00",
    "scheduledHours": 8
  }')

SCHEDULE_ID=$(echo $SCHEDULE_RESPONSE | jq -r '.data.id')
echo "Schedule ID: $SCHEDULE_ID"

# 3. Clock in
curl -s -X POST "http://localhost:8787/api/v1/scheduling/schedules/$SCHEDULE_ID/clock-in" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId": 2}' | jq

# 4. Clock out
curl -s -X POST "http://localhost:8787/api/v1/scheduling/schedules/$SCHEDULE_ID/clock-out" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId": 2}' | jq
```

### Scenario 2: Conflict Detection Test

```bash
# Create two overlapping schedules for same employee
# First schedule: 09:00-17:00
curl -X POST "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": 2,
    "shiftTemplateId": 1,
    "workDate": "2025-10-15",
    "startTime": "09:00",
    "endTime": "17:00",
    "scheduledHours": 8
  }'

# Second schedule: 14:00-22:00 (CONFLICT!)
curl -X POST "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": 2,
    "shiftTemplateId": 2,
    "workDate": "2025-10-15",
    "startTime": "14:00",
    "endTime": "22:00",
    "scheduledHours": 8
  }'

# Expected: Schedule will be created but conflict will be logged
# Check conflicts via system logs
```

### Scenario 3: Taiwan Labor Law Compliance Test

```bash
# Test daily hours limit (max 12 hours)
curl -X POST "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": 2,
    "workDate": "2025-10-15",
    "startTime": "08:00",
    "endTime": "21:00",
    "scheduledHours": 13
  }'

# Expected: Warning conflict (exceeds 12 hours)
```

### Scenario 4: Rest Period Validation Test

```bash
# Day 1: Late shift ending at 23:00
curl -X POST "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": 2,
    "workDate": "2025-10-15",
    "startTime": "15:00",
    "endTime": "23:00",
    "scheduledHours": 8
  }'

# Day 2: Early shift starting at 07:00 (ONLY 8 HOURS REST!)
curl -X POST "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": 2,
    "workDate": "2025-10-16",
    "startTime": "07:00",
    "endTime": "15:00",
    "scheduledHours": 8
  }'

# Expected: Error conflict (insufficient rest period, requires 11 hours)
```

---

## Expected Responses

### Success Response Format

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    /* resource data */
  }
}
```

### Error Response Format

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes

- `200 OK`: Success
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Access denied (role/permission issue)
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Conflict Types and Severity

### Error Severity (Prevents Creation)

- `overlapping_shifts`: Employee already has a shift at this time
- `insufficient_rest`: Less than 11 hours rest between shifts
- `leave_conflict`: Employee has approved leave on this date

### Warning Severity (Allows Creation)

- `max_hours_exceeded`: Daily hours > 12 or weekly hours > 46
- `consecutive_days_exceeded`: More than 6 consecutive work days

### Info Severity (Informational)

- `skill_mismatch`: Employee lacks required skills (future feature)
- `availability_conflict`: Outside employee's preferred times (future feature)

---

## Testing Checklist

### Shift Templates

- [ ] Create shift template with all fields
- [ ] Create shift template with minimal fields
- [ ] List all templates for a restaurant
- [ ] Get specific template by ID
- [ ] Update template
- [ ] Delete (soft) template
- [ ] Verify deleted templates don't appear in list

### Employee Schedules

- [ ] Create single schedule
- [ ] Create bulk schedules (multiple employees, multiple days)
- [ ] List schedules with filters (employee, date range, status)
- [ ] Update schedule
- [ ] Cancel schedule
- [ ] Verify pagination works correctly

### Clock In/Out

- [ ] Clock in to scheduled shift
- [ ] Verify cannot clock in twice
- [ ] Clock out from shift
- [ ] Verify cannot clock out without clock in
- [ ] Verify overtime calculation is correct
- [ ] Verify employees can only clock in/out for their own shifts

### Swap Requests

- [ ] Create swap request
- [ ] Approve swap request as manager
- [ ] Verify non-managers cannot approve

### Conflict Detection

- [ ] Test overlapping shifts detection
- [ ] Test rest period validation (11 hours)
- [ ] Test daily hours limit (12 hours)
- [ ] Test weekly hours limit (46 hours)
- [ ] Test consecutive days limit (6 days)
- [ ] Test leave conflict detection

### Authorization

- [ ] Verify Admin can access all endpoints
- [ ] Verify Shop Owner can manage their restaurant's schedules
- [ ] Verify employees can only view/manage their own schedules
- [ ] Verify employees cannot create schedules for others
- [ ] Verify employees cannot delete schedules

---

## Troubleshooting

### Issue: "Unauthorized" Error

**Solution**: Check your token is valid and not expired

```bash
# Re-login to get a fresh token
TOKEN=$(curl -s -X POST http://localhost:8787/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.data.token')
```

### Issue: "Restaurant not found"

**Solution**: Verify the restaurant ID exists

```bash
# List all restaurants
curl -X GET http://localhost:8787/api/v1/restaurants \
  -H "Authorization: Bearer $TOKEN"
```

### Issue: "Schedule not found"

**Solution**: Verify the schedule ID and that you have permission to access it

```bash
# List all schedules to find the correct ID
curl -X GET "http://localhost:8787/api/v1/scheduling/$RESTAURANT_ID/schedules" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Database Verification

### Check Schedules in Database

```bash
npx wrangler d1 execute makanmakan-staging --local \
  --command "SELECT * FROM employee_schedules LIMIT 5"
```

### Check Conflicts

```bash
npx wrangler d1 execute makanmakan-staging --local \
  --command "SELECT * FROM scheduling_conflicts WHERE status='unresolved'"
```

### Check Swap Requests

```bash
npx wrangler d1 execute makanmakan-staging --local \
  --command "SELECT * FROM schedule_swap_requests WHERE status='pending'"
```

---

**Last Updated**: 2025-10-11
**Documentation**: Complete
**Status**: Ready for Testing

For issues or questions, please refer to:

- API Documentation: `docs/architecture/technical-documentation.md`
- Implementation Summary: `SCHEDULING_IMPLEMENTATION_SUMMARY.md`
