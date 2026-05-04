# Queue Modular API Documentation

## 概述

Queue Modular API 是 MakanMasak 平台的新一代排隊管理系統，採用模組化設計，提供完整的餐廳排隊功能，包括加入排隊、位置查詢、呼叫客戶、座位安排等功能。

## 基本資訊

- **Base URL**: `/api/v1/queue`
- **API 版本**: 2.0.0
- **認證方式**: JWT Bearer Token (部分端點)
- **回應格式**: JSON
- **支援語言**: 繁體中文、英文

## 通用回應格式

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

## 端點列表

### 🏥 健康檢查

#### GET `/health`

檢查排隊系統健康狀態

**權限**: 公開
**回應**:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-09-28T02:45:46.631Z",
    "version": "2.0.0",
    "systems": {
      "modular": "available",
      "legacy": "available"
    }
  }
}
```

---

### 👥 客戶排隊功能

#### POST `/join`

加入排隊

**權限**: 公開
**請求體**:

```typescript
interface JoinQueueRequest {
  restaurantId: number; // 餐廳ID (必填)
  customerName: string; // 客戶姓名 (必填)
  customerPhone: string; // 客戶電話 (必填)
  customerEmail?: string; // 客戶電子郵件 (選填)
  partySize: number; // 用餐人數 (必填, 1-20)
  specialRequests?: string; // 特殊需求 (選填)
  queueType?: QueueType; // 排隊類型 (預設: 'online')
  tablePreferences?: number[]; // 偏好桌位 (選填)
  notificationMethods?: NotificationType[]; // 通知方式 (選填)
}
```

**回應**:

```json
{
  "success": true,
  "data": {
    "queueId": "uuid-string",
    "queueNumber": 1,
    "estimatedWaitMinutes": 45,
    "checkInCode": "ABC123",
    "position": 1,
    "restaurantId": 1
  }
}
```

**錯誤回應**:

- `400`: 驗證失敗、排隊已滿、系統未開放
- `500`: 系統錯誤

---

#### GET `/{restaurantId}/status`

獲取餐廳排隊狀態

**權限**: 公開
**參數**:

- `restaurantId` (path): 餐廳ID

**回應**:

```json
{
  "success": true,
  "data": {
    "queue": {
      "total_waiting": 8,
      "avg_estimated_wait": 35,
      "min_wait": 15,
      "max_wait": 60,
      "online_count": 5,
      "walkin_count": 3,
      "priority_count": 1
    },
    "activity": {
      "seated_today": 45,
      "cancelled_today": 3,
      "no_show_today": 1,
      "avg_actual_wait": 32
    },
    "settings": {
      "isEnabled": true,
      "maxQueueSize": 50,
      "avgServiceTime": 45,
      "maxWaitTime": 120
    }
  }
}
```

---

#### GET `/{queueId}/position`

查詢排隊位置

**權限**: 公開
**參數**:

- `queueId` (path): 排隊ID

**回應**:

```json
{
  "success": true,
  "data": {
    "queueId": "uuid-string",
    "queueNumber": 1,
    "currentPosition": 3,
    "estimatedWaitMinutes": 25,
    "status": "waiting",
    "canCancel": true,
    "customerName": "測試顧客",
    "partySize": 4,
    "joinedAt": "2025-09-28T02:30:00.000Z"
  }
}
```

**錯誤回應**:

- `404`: 找不到排隊記錄

---

### 🔧 員工操作功能

#### POST `/call-next`

呼叫下一位客戶

**權限**: 需要認證 (Admin, Owner, Chef, Service)
**請求體**:

```typescript
interface CallNextRequest {
  restaurantId: number; // 餐廳ID (必填)
  tableId?: number; // 指定桌位 (選填)
  specificQueueId?: string; // 指定客戶ID (選填)
}
```

**回應**:

```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "queueNumber": 1,
    "customerName": "測試顧客",
    "customerPhone": "012-3456789",
    "partySize": 4,
    "status": "called",
    "calledAt": "2025-09-28T02:45:00.000Z",
    "servedBy": 123,
    "assignedTableId": 5
  }
}
```

---

#### GET `/{restaurantId}/current`

獲取當前排隊列表

**權限**: 需要認證 (Admin, Owner, Chef, Service)
**參數**:

- `restaurantId` (path): 餐廳ID
- `status` (query): 狀態篩選 (選填)
- `limit` (query): 回傳數量限制 (預設: 50)

**回應**:

```json
{
  "success": true,
  "data": {
    "queue": [
      {
        "id": "uuid-string",
        "queue_number": 1,
        "customer_name": "測試顧客",
        "customer_phone": "012-3456789",
        "party_size": 4,
        "status": "waiting",
        "joined_at": "2025-09-28T02:30:00.000Z",
        "estimated_wait_minutes": 25,
        "priority": 0,
        "current_position": 1,
        "table_preferences": [1, 2],
        "notification_methods": ["sms"],
        "special_requests": "需要兒童座椅"
      }
    ],
    "totalCount": 8
  }
}
```

---

#### POST `/{queueId}/seat`

安排客戶入座

**權限**: 需要認證 (Admin, Owner, Chef, Service)
**參數**:

- `queueId` (path): 排隊ID

**請求體**:

```typescript
interface SeatCustomerRequest {
  tableId: number; // 桌位ID (必填)
}
```

**回應**:

```json
{
  "success": true,
  "data": {
    "queueId": "uuid-string",
    "tableId": 5,
    "seatedAt": "2025-09-28T02:50:00.000Z",
    "actualWaitMinutes": 28
  }
}
```

---

#### POST `/{queueId}/cancel`

取消排隊

**權限**: 可選認證 (客戶可提供取消代碼)
**參數**:

- `queueId` (path): 排隊ID

**請求體**:

```typescript
interface CancelQueueRequest {
  reason?: string; // 取消原因 (選填)
  checkInCode?: string; // 取消代碼 (客戶必填)
}
```

**回應**:

```json
{
  "success": true,
  "data": {
    "queueId": "uuid-string",
    "cancelledAt": "2025-09-28T02:35:00.000Z",
    "reason": "客戶主動取消"
  }
}
```

---

### ⚙️ 設定管理

#### GET `/{restaurantId}/settings`

獲取排隊設定

**權限**: 需要認證 (Admin, Owner)
**參數**:

- `restaurantId` (path): 餐廳ID

**回應**:

```json
{
  "success": true,
  "data": {
    "restaurantId": 1,
    "isEnabled": true,
    "maxQueueSize": 50,
    "avgServiceTime": 45,
    "maxWaitTime": 120,
    "minAdvanceNotice": 5,
    "notificationMethods": ["sms", "app"],
    "autoCallEnabled": true,
    "autoCallInterval": 10,
    "noShowTimeout": 15,
    "queueNumberReset": "daily",
    "businessHours": {
      "monday": { "open": "09:00", "close": "22:00" }
    }
  }
}
```

---

#### PUT `/{restaurantId}/settings`

更新排隊設定

**權限**: 需要認證 (Admin, Owner)
**參數**:

- `restaurantId` (path): 餐廳ID

**請求體**:

```typescript
interface UpdateQueueSettingsRequest {
  isEnabled?: boolean;
  maxQueueSize?: number;
  avgServiceTime?: number;
  maxWaitTime?: number;
  minAdvanceNotice?: number;
  autoCallEnabled?: boolean;
  autoCallInterval?: number;
  noShowTimeout?: number;
  // ... 其他設定欄位
}
```

---

### 📊 統計與分析

#### GET `/{restaurantId}/stats`

獲取排隊統計

**權限**: 需要認證 (Admin, Owner)
**參數**:

- `restaurantId` (path): 餐廳ID
- `dateFrom` (query): 開始日期 (選填)
- `dateTo` (query): 結束日期 (選填)

**回應**:

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalQueued": 156,
      "totalSeated": 142,
      "totalCancelled": 12,
      "totalNoShow": 2,
      "avgWaitTime": 32,
      "avgServiceTime": 48
    },
    "daily": [
      {
        "date": "2025-09-28",
        "queued": 45,
        "seated": 42,
        "cancelled": 2,
        "avgWait": 28
      }
    ],
    "hourly": {
      "12": { "queued": 15, "avgWait": 25 },
      "13": { "queued": 20, "avgWait": 35 }
    }
  }
}
```

---

#### GET `/{restaurantId}/history`

獲取排隊歷史

**權限**: 需要認證 (Admin, Owner)
**參數**:

- `restaurantId` (path): 餐廳ID
- `status` (query): 狀態篩選 (選填)
- `dateFrom` (query): 開始日期 (選填)
- `dateTo` (query): 結束日期 (選填)
- `page` (query): 頁數 (預設: 1)
- `limit` (query): 每頁數量 (預設: 20)

**回應**:

```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid-string",
        "queue_number": 1,
        "customer_name": "測試顧客",
        "customer_phone": "012-3456789",
        "party_size": 4,
        "status": "seated",
        "joined_at": "2025-09-28T02:30:00.000Z",
        "called_at": "2025-09-28T02:45:00.000Z",
        "seated_at": "2025-09-28T02:50:00.000Z",
        "actual_wait_minutes": 20,
        "served_by": 123,
        "served_by_name": "服務員A"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "hasMore": true
    }
  }
}
```

---

### 🔧 系統管理

#### POST `/{restaurantId}/optimize`

優化排隊位置

**權限**: 需要認證 (Admin, Owner)
**參數**:

- `restaurantId` (path): 餐廳ID

**回應**:

```json
{
  "success": true,
  "data": {
    "message": "隊列位置已優化更新",
    "timestamp": "2025-09-28T02:45:00.000Z"
  }
}
```

---

#### GET `/performance`

獲取性能指標

**權限**: 需要認證 (Admin)

**回應**:

```json
{
  "success": true,
  "data": {
    "cacheHitRate": 0.85,
    "avgResponseTime": 120,
    "activeConnections": 45,
    "queuedOperations": 3,
    "systemLoad": 0.35
  }
}
```

---

#### POST `/cleanup/expired`

清理過期記錄

**權限**: 需要認證 (Admin)

**回應**:

```json
{
  "success": true,
  "data": {
    "cleanedCount": 156
  }
}
```

---

## 資料類型定義

### QueueStatus

```typescript
enum QueueStatus {
  WAITING = "waiting", // 等待中
  CALLED = "called", // 已呼叫
  NOTIFIED = "notified", // 已通知
  SEATED = "seated", // 已入座
  CANCELLED = "cancelled", // 已取消
  NO_SHOW = "no_show", // 未出現
}
```

### QueueType

```typescript
enum QueueType {
  ONLINE = "online", // 線上排隊
  WALKIN = "walkin", // 現場排隊
  PHONE = "phone", // 電話排隊
  RESERVATION = "reservation", // 預約排隊
}
```

### NotificationType

```typescript
enum NotificationType {
  SMS = "sms", // 簡訊通知
  EMAIL = "email", // 電子郵件
  APP = "app", // App推播
  CALL = "call", // 電話通知
}
```

---

## 錯誤處理

### 錯誤格式

```json
{
  "success": false,
  "error": "錯誤訊息",
  "code": "ERROR_CODE",
  "timestamp": "2025-09-28T02:45:00.000Z"
}
```

### 常見錯誤碼

- `QUEUE_DISABLED`: 排隊系統未開放
- `QUEUE_FULL`: 排隊隊列已滿
- `INVALID_REQUEST`: 請求資料無效
- `QUEUE_NOT_FOUND`: 找不到排隊記錄
- `PERMISSION_DENIED`: 權限不足
- `SYSTEM_ERROR`: 系統錯誤

---

## 即時更新

系統支援 Server-Sent Events (SSE) 即時推送排隊狀態更新：

### 事件類型

- `queue-joined`: 有新客戶加入排隊
- `queue-called`: 客戶被呼叫
- `customer-seated`: 客戶已入座
- `queue-cancelled`: 排隊被取消
- `queue-updated`: 排隊資訊更新

### 連接端點

```
GET /api/v1/sse/queue/{restaurantId}
Authorization: Bearer {token}
```

---

## 使用範例

### JavaScript/TypeScript 範例

```typescript
// 加入排隊
const joinQueue = async (restaurantId: number, customerData: any) => {
  const response = await fetch("/api/v1/queue/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      restaurantId,
      ...customerData,
    }),
  });

  return await response.json();
};

// 查詢排隊位置
const getQueuePosition = async (queueId: string) => {
  const response = await fetch(`/api/v1/queue/${queueId}/position`);
  return await response.json();
};

// 呼叫下一位客戶 (需要認證)
const callNext = async (restaurantId: number, authToken: string) => {
  const response = await fetch("/api/v1/queue/call-next", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ restaurantId }),
  });

  return await response.json();
};
```

### cURL 範例

```bash
# 加入排隊
curl -X POST http://localhost:8787/api/v1/queue/join \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": 1,
    "customerName": "測試顧客",
    "customerPhone": "012-3456789",
    "partySize": 4
  }'

# 查詢排隊狀態
curl http://localhost:8787/api/v1/queue/1/status

# 呼叫下一位客戶
curl -X POST http://localhost:8787/api/v1/queue/call-next \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"restaurantId": 1}'
```

---

## 版本歷史

### v2.0.0 (2025-09-28)

- 全新模組化架構
- 完整的即時更新支援
- 增強的權限控制
- 統一的錯誤處理
- 完整的測試覆蓋率

### v1.0.0 (Legacy)

- 基本排隊功能
- 已棄用，請使用 v2.0.0

---

## 支援

如有問題或建議，請聯繫開發團隊或在 GitHub 上提交 Issue。

**文檔更新**: 2025-09-28
**API 版本**: 2.0.0
**維護團隊**: MakanMasak Development Team
