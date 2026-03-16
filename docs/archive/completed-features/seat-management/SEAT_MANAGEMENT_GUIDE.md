# Seat Management System Implementation Guide

**Version**: 1.0
**Date**: 2025-10-09
**Status**: ✅ Production Ready

---

## Overview

The Seat Management System extends MakanMakan's table management capabilities to support **individual seat tracking** with unique QR codes per seat. This enables restaurants to support both traditional "one table one QR" and advanced "one seat one QR" ordering modes.

### Key Features

- ✅ **Dual Mode Support**: Switch between table-level and seat-level QR codes
- ✅ **Batch Operations**: Create, manage, and regenerate QR codes for all seats at once
- ✅ **Flexible Numbering**: Numeric (01, 02), Alphabetic (A, B), or Custom seat numbers
- ✅ **Usage Tracking**: Monitor seat occupancy, usage statistics, and popular seats
- ✅ **Admin UI**: Comprehensive Vue.js components for seat management
- ✅ **API-First**: RESTful API with full CRUD operations

---

## Architecture

### Database Schema

#### Tables

**`tables` (Extended)**

```sql
ALTER TABLE tables ADD COLUMN qr_mode TEXT DEFAULT 'table'
    CHECK (qr_mode IN ('table', 'seat'));

ALTER TABLE tables ADD COLUMN seat_count INTEGER DEFAULT 0;
ALTER TABLE tables ADD COLUMN seat_layout TEXT;  -- JSON format
ALTER TABLE tables ADD COLUMN seat_numbering_style TEXT DEFAULT 'numeric'
    CHECK (seat_numbering_style IN ('numeric', 'alphabetic', 'custom'));
```

**`seats` (New Table)**

```sql
CREATE TABLE seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL,
    seat_number TEXT NOT NULL,
    seat_name TEXT,
    position TEXT,

    -- QR Code Information
    qr_code TEXT NOT NULL UNIQUE,
    qr_code_image_url TEXT,
    qr_code_version INTEGER NOT NULL DEFAULT 1,

    -- Status Management
    is_occupied INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    current_order_id INTEGER,

    -- Usage Tracking
    occupied_at INTEGER,
    occupied_by TEXT,
    total_usage INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
    UNIQUE(table_id, seat_number)
);
```

**`orders` (Extended)**

```sql
ALTER TABLE orders ADD COLUMN seat_id INTEGER;
ALTER TABLE orders ADD COLUMN order_source TEXT DEFAULT 'table'
    CHECK (order_source IN ('table', 'seat'));
```

#### Views

**`seat_usage_stats`** - Real-time seat usage statistics

```sql
CREATE VIEW seat_usage_stats AS
SELECT
    s.id AS seat_id,
    s.table_id,
    t.restaurant_id,
    s.seat_number,
    s.total_usage,
    s.is_occupied,
    CASE WHEN s.is_occupied = 1 THEN
        (strftime('%s', 'now') - s.occupied_at) / 60.0
    ELSE 0 END AS current_occupancy_minutes,
    t.number AS table_number,
    r.name AS restaurant_name
FROM seats s
JOIN tables t ON s.table_id = t.id
JOIN restaurants r ON t.restaurant_id = r.id
WHERE s.is_active = 1;
```

**`table_seat_summary`** - Table-level seat summary

```sql
CREATE VIEW table_seat_summary AS
SELECT
    t.id AS table_id,
    t.restaurant_id,
    t.number AS table_number,
    t.qr_mode,
    t.seat_count AS configured_seat_count,
    COUNT(s.id) AS actual_seat_count,
    SUM(CASE WHEN s.is_occupied = 1 THEN 1 ELSE 0 END) AS occupied_seats,
    SUM(CASE WHEN s.is_occupied = 0 AND s.is_active = 1 THEN 1 ELSE 0 END) AS available_seats
FROM tables t
LEFT JOIN seats s ON t.id = s.table_id
WHERE t.qr_mode = 'seat'
GROUP BY t.id;
```

---

## API Reference

### Base URL

```
/api/v1/seats
```

### Endpoints

#### 1. List Seats by Table

```http
GET /api/v1/seats?tableId={tableId}&page=1&limit=50

Query Parameters:
  - tableId (required): Table ID
  - isOccupied (optional): Filter by occupancy status (true/false)
  - isActive (optional): Filter by active status (true/false)
  - seatNumbers (optional): Comma-separated seat numbers
  - page (optional): Page number (default: 1)
  - limit (optional): Results per page (default: 50)

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tableId": 10,
      "seatNumber": "01",
      "seatName": "Window Seat",
      "position": "North side, window",
      "qrCode": "https://makanmakan.com/order?data=...",
      "qrCodeImageUrl": "https://...",
      "qrCodeVersion": 1,
      "isOccupied": false,
      "isActive": true,
      "currentOrderId": null,
      "totalUsage": 15,
      "createdAt": "2025-01-09T10:00:00Z"
    }
  ],
  "total": 8,
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

#### 2. Get Seat Details

```http
GET /api/v1/seats/:id

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "tableId": 10,
    "tableNumber": "T01",
    "restaurantId": 1,
    "restaurantName": "Example Restaurant",
    "seatNumber": "01",
    "seatName": "Window Seat",
    "position": "North side",
    "qrCode": "https://...",
    "qrCodeImageUrl": "https://...",
    "isOccupied": false,
    "isActive": true,
    "totalUsage": 15
  }
}
```

#### 3. Batch Create Seats

```http
POST /api/v1/seats/batch-create

Request Body:
{
  "tableId": 10,
  "seatCount": 8,
  "numberingStyle": "numeric",  // "numeric" | "alphabetic" | "custom"
  "prefix": "S",                 // Optional prefix
  "customNumbers": []            // For custom numbering
}

Response:
{
  "success": true,
  "data": [
    { "id": 1, "seatNumber": "S01", ... },
    { "id": 2, "seatNumber": "S02", ... },
    ...
  ],
  "message": "Successfully created 8 seats"
}
```

#### 4. Update Seat

```http
PUT /api/v1/seats/:id

Request Body:
{
  "seatNumber": "A1",
  "seatName": "VIP Seat",
  "position": "Corner, window view",
  "isActive": true
}

Response:
{
  "success": true,
  "data": { ... },
  "message": "Seat updated successfully"
}
```

#### 5. Delete Seat (Soft Delete)

```http
DELETE /api/v1/seats/:id

Response:
{
  "success": true,
  "message": "Seat deleted successfully"
}
```

#### 6. Occupy Seat

```http
POST /api/v1/seats/:id/occupy

Request Body:
{
  "orderId": 123,
  "occupiedBy": "Customer ABC"  // Optional
}

Response:
{
  "success": true,
  "message": "Seat occupied successfully"
}
```

#### 7. Release Seat

```http
POST /api/v1/seats/:id/release

Response:
{
  "success": true,
  "message": "Seat released successfully"
}
```

#### 8. Regenerate Seat QR Code

```http
POST /api/v1/seats/:id/regenerate-qr

Response:
{
  "success": true,
  "data": {
    "qrCode": "https://makanmakan.com/order?data=..."
  },
  "message": "Seat QR code regenerated successfully"
}
```

#### 9. Batch Regenerate QR Codes

```http
POST /api/v1/seats/batch-regenerate-qr

Request Body:
{
  "tableId": 10
}

Response:
{
  "success": true,
  "data": [
    { "seatId": 1, "seatNumber": "01", "qrCode": "..." },
    { "seatId": 2, "seatNumber": "02", "qrCode": "..." }
  ],
  "message": "Successfully regenerated QR codes for 8 seats"
}
```

#### 10. Get Seat Statistics

```http
GET /api/v1/seats/stats?tableId=10

Response:
{
  "success": true,
  "data": {
    "totalSeats": 8,
    "occupiedSeats": 3,
    "availableSeats": 5,
    "inactiveSeats": 0,
    "averageOccupancyRate": 37.5
  }
}
```

#### 11. Get Seat by QR Code (Public)

```http
GET /api/v1/seats/qr/:qrCode

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "tableId": 10,
    "tableNumber": "T01",
    "restaurantId": 1,
    "restaurantName": "Example Restaurant",
    "seatNumber": "01",
    "seatName": "Window Seat",
    "isActive": true,
    "isOccupied": false,
    "capacity": 4
  }
}
```

#### 12. Delete All Seats for Table (Hard Delete)

```http
DELETE /api/v1/seats/table/:tableId

Response:
{
  "success": true,
  "message": "All seats for the table deleted successfully"
}
```

---

## Frontend Integration

### Admin Dashboard Components

#### 1. **SeatGrid.vue** - Visual Seat Layout

```vue
<template>
  <div class="seat-grid">
    <div
      v-for="seat in seats"
      :key="seat.id"
      :class="[
        'seat-card',
        { occupied: seat.isOccupied, inactive: !seat.isActive },
      ]"
      @click="selectSeat(seat)"
    >
      <div class="seat-number">{{ seat.seatNumber }}</div>
      <div class="seat-status">
        {{ seat.isOccupied ? "已佔用" : "可用" }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { Seat } from "@makanmakan/shared-types";

const props = defineProps<{
  tableId: number;
}>();

const seats = ref<Seat[]>([]);

onMounted(async () => {
  const response = await fetch(`/api/v1/seats?tableId=${props.tableId}`);
  const result = await response.json();
  seats.value = result.data;
});

function selectSeat(seat: Seat) {
  // Handle seat selection
}
</script>
```

#### 2. **QRModeSelector.vue** - Mode Switching

```vue
<template>
  <div class="qr-mode-selector">
    <h3>QR Code 模式</h3>
    <el-radio-group v-model="selectedMode" @change="switchMode">
      <el-radio label="table">一桌一碼</el-radio>
      <el-radio label="seat">一位一碼</el-radio>
    </el-radio-group>

    <el-alert v-if="selectedMode === 'seat'" type="info">
      切換到座位模式後，將為每個座位生成獨立的 QR Code
    </el-alert>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { QRMode } from "@makanmakan/shared-types";

const props = defineProps<{
  tableId: number;
  currentMode: QRMode;
}>();

const emit = defineEmits<{
  modeChanged: [mode: QRMode];
}>();

const selectedMode = ref<QRMode>(props.currentMode);

async function switchMode(newMode: QRMode) {
  // Confirm mode switch with user
  const confirmed = await ElMessageBox.confirm(
    `確定要切換到${newMode === "seat" ? "座位" : "桌子"}模式嗎？`,
    "切換 QR 模式",
    { type: "warning" },
  );

  if (confirmed) {
    // Switch mode via API
    emit("modeChanged", newMode);
  } else {
    selectedMode.value = props.currentMode;
  }
}
</script>
```

#### 3. **SeatManagement.vue** - Full Management Interface

```vue
<template>
  <div class="seat-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>座位管理</span>
          <el-button type="primary" @click="showCreateDialog">
            批量創建座位
          </el-button>
        </div>
      </template>

      <!-- Seat Grid -->
      <SeatGrid :table-id="tableId" @seat-selected="handleSeatSelect" />

      <!-- Seat Statistics -->
      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <el-statistic title="總座位數" :value="stats.totalSeats" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="佔用中" :value="stats.occupiedSeats" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="可用" :value="stats.availableSeats" />
        </el-col>
        <el-col :span="6">
          <el-statistic
            title="佔用率"
            :value="stats.averageOccupancyRate"
            suffix="%"
          />
        </el-col>
      </el-row>
    </el-card>

    <!-- Create Seats Dialog -->
    <el-dialog v-model="createDialogVisible" title="批量創建座位">
      <el-form :model="createForm" label-width="120px">
        <el-form-item label="座位數量">
          <el-input-number v-model="createForm.seatCount" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="編號方式">
          <el-select v-model="createForm.numberingStyle">
            <el-option label="數字 (01, 02)" value="numeric" />
            <el-option label="字母 (A, B)" value="alphabetic" />
            <el-option label="自定義" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="前綴（可選）">
          <el-input v-model="createForm.prefix" placeholder="如：S, A" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createSeats">創建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import SeatGrid from "./SeatGrid.vue";
import type { SeatStats } from "@makanmakan/shared-types";

const props = defineProps<{
  tableId: number;
}>();

const stats = ref<SeatStats>({
  totalSeats: 0,
  occupiedSeats: 0,
  availableSeats: 0,
  inactiveSeats: 0,
  averageOccupancyRate: 0,
});

const createDialogVisible = ref(false);
const createForm = ref({
  seatCount: 4,
  numberingStyle: "numeric" as "numeric" | "alphabetic" | "custom",
  prefix: "",
});

onMounted(async () => {
  await loadStats();
});

async function loadStats() {
  const response = await fetch(`/api/v1/seats/stats?tableId=${props.tableId}`);
  const result = await response.json();
  stats.value = result.data;
}

function showCreateDialog() {
  createDialogVisible.value = true;
}

async function createSeats() {
  const response = await fetch("/api/v1/seats/batch-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tableId: props.tableId,
      ...createForm.value,
    }),
  });

  if (response.ok) {
    ElMessage.success("座位創建成功");
    createDialogVisible.value = false;
    await loadStats();
  }
}

function handleSeatSelect(seat: Seat) {
  // Handle seat selection
}
</script>
```

---

## Use Cases

### 1. Fine Dining Restaurant

**Scenario**: High-end restaurant wants to track individual seat orders for personalized service.

**Implementation**:

```typescript
// Switch table to seat mode
await tableService.updateTable(tableId, { qrMode: "seat" });

// Create 4 seats with alphabetic numbering
await seatService.createSeatsForTable(tableId, 4, {
  numberingStyle: "alphabetic",
  prefix: "VIP-",
});
// Creates: VIP-A, VIP-B, VIP-C, VIP-D

// When customer scans QR
const seat = await seatService.getSeatByQRCode(qrCode);
// Track order to specific seat
await orderService.create({
  restaurantId,
  tableId: seat.tableId,
  seatId: seat.id,
  orderSource: "seat",
});
```

### 2. Food Court with Shared Tables

**Scenario**: Food court needs to track individual seat orders on shared 8-seat tables.

**Implementation**:

```typescript
// Create 8 seats with numeric numbering
await seatService.createSeatsForTable(tableId, 8, {
  numberingStyle: "numeric",
});
// Creates: 01, 02, 03, 04, 05, 06, 07, 08

// Each customer scans their seat's QR code
// Orders are isolated per seat, not per table
```

### 3. Flexible Seating Restaurant

**Scenario**: Restaurant wants to dynamically switch between table and seat modes based on time of day.

**Implementation**:

```typescript
// Lunch: High volume, use table mode
if (isLunchTime) {
  await tableService.updateTable(tableId, { qrMode: "table" });
  await seatService.deleteSeatsForTable(tableId);
}

// Dinner: Intimate dining, use seat mode
if (isDinnerTime) {
  await tableService.updateTable(tableId, { qrMode: "seat" });
  await seatService.createSeatsForTable(tableId, 4, {
    numberingStyle: "numeric",
  });
}
```

---

## Best Practices

### 1. QR Code Management

**Regenerate QR codes when**:

- Security concern (QR code compromised)
- Switching between modes
- Changing restaurant configuration

**Don't regenerate QR codes**:

- During active orders
- Without proper user notification

### 2. Seat Numbering

**Recommended Patterns**:

```typescript
// Fine dining: Alphabetic
{ numberingStyle: 'alphabetic', prefix: '' }  // A, B, C, D

// Casual dining: Numeric
{ numberingStyle: 'numeric', prefix: 'S' }    // S01, S02, S03

// VIP areas: Custom
{ numberingStyle: 'custom', customNumbers: ['VIP1', 'VIP2', 'Royal'] }
```

### 3. Performance Optimization

**For large restaurants** (50+ tables, 200+ seats):

```typescript
// Use pagination
const { seats, total, pagination } = await seatService.getSeatsByTableId(
  tableId,
  { page: 1, limit: 20, isActive: true },
);

// Cache seat statistics
const stats = await redis.get(`seat:stats:${tableId}`);
if (!stats) {
  stats = await seatService.getSeatStats(tableId);
  await redis.set(`seat:stats:${tableId}`, stats, "EX", 60); // 1 minute cache
}
```

### 4. Error Handling

**Common Issues**:

```typescript
// Handle seat occupied errors
try {
  await seatService.occupySeat(seatId, orderId);
} catch (error) {
  if (error.message.includes("already occupied")) {
    // Show user alternative seats
    const availableSeats = await seatService.getSeatsByTableId(tableId, {
      isOccupied: false,
      isActive: true,
    });
  }
}

// Handle mode switch with active orders
const activeOrders = await orderService.getActiveOrdersForTable(tableId);
if (activeOrders.length > 0) {
  throw new Error("Cannot switch mode with active orders");
}
```

---

## Testing

### Unit Tests

```typescript
// Test seat creation
describe("SeatService.createSeatsForTable", () => {
  it("should create seats with numeric numbering", async () => {
    const seats = await seatService.createSeatsForTable(tableId, 4, {
      numberingStyle: "numeric",
    });

    expect(seats).toHaveLength(4);
    expect(seats[0].seatNumber).toBe("01");
    expect(seats[3].seatNumber).toBe("04");
  });

  it("should create seats with alphabetic numbering", async () => {
    const seats = await seatService.createSeatsForTable(tableId, 3, {
      numberingStyle: "alphabetic",
    });

    expect(seats[0].seatNumber).toBe("A");
    expect(seats[2].seatNumber).toBe("C");
  });
});
```

### Integration Tests

```typescript
// Test complete seat workflow
describe("Seat Management Workflow", () => {
  it("should complete full seat lifecycle", async () => {
    // 1. Create seats
    const seats = await seatService.createSeatsForTable(tableId, 2);

    // 2. Occupy seat
    await seatService.occupySeat(seats[0].id, orderId, "Customer A");

    // 3. Verify occupancy
    const seat = await seatService.getSeatById(seats[0].id);
    expect(seat.isOccupied).toBe(true);

    // 4. Release seat
    await seatService.releaseSeat(seats[0].id);

    // 5. Verify usage incremented
    const updatedSeat = await seatService.getSeatById(seats[0].id);
    expect(updatedSeat.totalUsage).toBe(1);
  });
});
```

---

## Migration Guide

### From Table Mode to Seat Mode

```typescript
async function migrateToSeatMode(tableId: number, seatCount: number) {
  // 1. Check for active orders
  const activeOrders = await orderService.getActiveOrdersForTable(tableId);
  if (activeOrders.length > 0) {
    throw new Error("Complete or cancel active orders before migrating");
  }

  // 2. Update table mode
  await tableService.updateTable(tableId, {
    qrMode: "seat",
    seatCount,
  });

  // 3. Create seats
  const seats = await seatService.createSeatsForTable(tableId, seatCount, {
    numberingStyle: "numeric",
  });

  // 4. Generate QR codes
  await seatService.batchGenerateSeatQRCodes(tableId);

  return seats;
}
```

### From Seat Mode to Table Mode

```typescript
async function migrateToTableMode(tableId: number) {
  // 1. Check for active orders
  const activeOrders = await orderService.getActiveOrdersForTable(tableId);
  if (activeOrders.length > 0) {
    throw new Error("Complete or cancel active orders before migrating");
  }

  // 2. Delete all seats
  await seatService.deleteSeatsForTable(tableId);

  // 3. Update table mode
  await tableService.updateTable(tableId, {
    qrMode: "table",
    seatCount: 0,
  });

  // 4. Regenerate table QR code
  await qrService.regenerateTableQRCode(tableId);
}
```

---

## Troubleshooting

### Issue: Seats not showing in admin dashboard

**Cause**: Table is still in 'table' mode
**Solution**: Switch table to 'seat' mode first

```typescript
await tableService.updateTable(tableId, { qrMode: "seat" });
```

### Issue: QR code scan not working

**Cause**: QR code format mismatch
**Solution**: Verify QR code contains correct data structure

```typescript
// Expected QR code data
{
  type: 'seat',
  restaurantId: 1,
  tableId: 10,
  seatNumber: '01',
  timestamp: 1704835200000,
  version: '2.0'
}
```

### Issue: Cannot occupy seat (already occupied)

**Cause**: Previous order not properly released
**Solution**: Manually release seat

```typescript
await seatService.releaseSeat(seatId);
```

---

## Performance Metrics

### Target Performance

- **Seat Creation**: < 500ms for 10 seats
- **QR Generation**: < 1s for batch of 20 seats
- **Occupy/Release**: < 100ms
- **Statistics Query**: < 200ms

### Monitoring

```typescript
// Track seat operations
await metrics.track("seat.created", { tableId, seatCount });
await metrics.track("seat.occupied", { seatId, duration });
await metrics.track("qr.regenerated", { count });
```

---

## Security Considerations

1. **QR Code Security**:
   - QR codes include timestamp to prevent replay attacks
   - Versioning system allows invalidation of old codes

2. **Access Control**:
   - Only Admin and Owner can create/delete seats
   - Service staff can occupy/release seats

3. **Data Isolation**:
   - Seat data scoped to restaurant_id
   - Cross-restaurant seat access prevented

---

## References

- **Migration File**: `packages/database/migrations/0027_seat_management_system.sql`
- **Schema**: `packages/database/src/schema/seats.ts`
- **Service**: `packages/database/src/services/seat.ts`
- **Types**: `packages/shared-types/src/seat.ts`
- **API Routes**: `apps/api/src/routes/seats.ts`
- **UI Components**: `apps/admin-dashboard/src/components/tables/`

---

**Document Version**: 1.0
**Last Updated**: 2025-10-09
**Status**: ✅ Complete
