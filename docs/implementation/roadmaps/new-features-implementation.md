# MakanMasak 新功能實施技術文檔

## 文檔概述

本文檔詳細說明 MakanMasak 系統新增功能的技術實施方案，包括群組點餐、完整POS系統、候位系統等功能。

**創建日期**: 2025-09-07  
**版本**: 1.0  
**狀態**: 開發中

---

## 📋 目錄

1. [群組點餐與分帳系統](#1-群組點餐與分帳系統)
2. [完整POS系統](#2-完整pos系統)
3. [候位系統](#3-候位系統)
4. [資料庫設計](#4-資料庫設計)
5. [API 設計](#5-api-設計)
6. [前端組件設計](#6-前端組件設計)
7. [實時同步設計](#7-實時同步設計)

---

## 1. 群組點餐與分帳系統

### 1.1 功能需求

#### 核心功能

- **分享機制**: 透過分享代碼或QR碼邀請朋友加入群組點餐
- **群組管理**: 管理群組成員，設定群組訂單權限
- **實時同步**: 群組內成員的點餐操作即時同步
- **分帳選項**:
  - 平分帳單
  - 按比例分帳
  - 個人點餐項目分帳
  - 自定義分帐

#### 用戶流程

1. 主要用戶掃描桌台QR碼進入點餐
2. 選擇"群組點餐"模式
3. 系統生成分享代碼/鏈接
4. 朋友通過代碼/鏈接加入群組
5. 群組內共同點餐
6. 結帳時選擇分帳方式

### 1.2 技術架構

#### 資料結構

```typescript
interface GroupOrder {
  id: string;
  shareCode: string;
  masterOrderId: number;
  createdBy: number;
  restaurantId: number;
  tableId: number;
  status: "active" | "ordering" | "checkout" | "completed" | "cancelled";
  splitType: "equal" | "proportional" | "individual" | "custom";
  expiresAt: Date;
  createdAt: Date;
}

interface GroupMember {
  id: string;
  groupOrderId: string;
  userId?: number;
  sessionId: string;
  name: string;
  joinedAt: Date;
  isActive: boolean;
}

interface SplitBill {
  id: string;
  groupOrderId: string;
  memberId: string;
  amount: number;
  items: CartItem[];
  paymentStatus: "pending" | "paid" | "failed";
  paymentMethod?: string;
  paidAt?: Date;
}
```

---

## 2. 完整POS系統

### 2.1 功能需求

#### 核心功能

- **現金管理**: 開班/關班、現金盤點、找零計算
- **收據管理**: 熱敏打印機整合、電子收據
- **銷售報表**: 班次報表、日/週/月銷售統計
- **退款處理**: 部分退款、全額退款、退款記錄
- **促銷管理**: 折扣券、會員優惠、時段優惠

#### 硬件整合

- **收銀機**: 錢箱控制
- **打印機**: ESC/POS 熱敏打印
- **掃描器**: 商品條碼掃描
- **顯示器**: 客戶顯示屏

### 2.2 技術架構

#### 資料結構

```typescript
interface CashRegister {
  id: string;
  name: string;
  location: string;
  restaurantId: number;
  isActive: boolean;
  currentShiftId?: string;
  peripherals: {
    printer?: PrinterConfig;
    cashDrawer?: CashDrawerConfig;
    customerDisplay?: DisplayConfig;
  };
}

interface CashShift {
  id: string;
  registerId: string;
  operatorId: number;
  startAmount: number;
  endAmount?: number;
  startedAt: Date;
  endedAt?: Date;
  status: "active" | "closed";
}

interface CashMovement {
  id: string;
  shiftId: string;
  type: "sale" | "refund" | "cash_in" | "cash_out" | "count";
  amount: number;
  description: string;
  referenceId?: number;
  createdAt: Date;
}

interface Receipt {
  id: string;
  orderId: number;
  registerId: string;
  template: "standard" | "kitchen" | "customer";
  printStatus: "pending" | "printed" | "failed";
  printedAt?: Date;
}
```

---

## 3. 候位系統

### 3.1 功能需求

#### 核心功能

- **線上取號**: 客戶掃描QR碼取號
- **隊列管理**: 自動分配等待順序
- **預估時間**: 智能預估等待時間
- **通知系統**: SMS/推送通知到號提醒
- **顯示系統**: 大屏幕顯示等候資訊

#### 業務邏輯

- 優先級規則：VIP客戶、大桌優先等
- 動態時間調整：根據歷史數據預估
- 自動釋放：超時未響應的號碼

### 3.2 技術架構

#### 資料結構

```typescript
interface WaitingQueue {
  id: string;
  restaurantId: number;
  customerName: string;
  customerPhone?: string;
  partySize: number;
  queueNumber: number;
  priority: number;
  estimatedWaitMinutes: number;
  status: "waiting" | "called" | "seated" | "cancelled" | "no_show";
  notificationSent: boolean;
  joinedAt: Date;
  calledAt?: Date;
  seatedAt?: Date;
}

interface QueueNotification {
  id: string;
  queueId: string;
  type: "sms" | "push" | "email";
  message: string;
  status: "pending" | "sent" | "failed";
  sentAt?: Date;
}

interface QueueSettings {
  restaurantId: number;
  isEnabled: boolean;
  avgServiceTime: number; // minutes per table
  maxWaitTime: number; // minutes
  notificationMethods: ("sms" | "push" | "email")[];
  autoCallInterval: number; // minutes
}
```

---

## 4. 資料庫設計

### 4.1 新增資料表

#### 群組點餐相關表格

```sql
-- 群組訂單
CREATE TABLE group_orders (
    id TEXT PRIMARY KEY,
    share_code TEXT UNIQUE NOT NULL,
    master_order_id INTEGER,
    created_by INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    table_id INTEGER,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ordering', 'checkout', 'completed', 'cancelled')),
    split_type TEXT DEFAULT 'equal' CHECK (split_type IN ('equal', 'proportional', 'individual', 'custom')),
    total_amount DECIMAL(10,2) DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (master_order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL
);

-- 群組成員
CREATE TABLE group_members (
    id TEXT PRIMARY KEY,
    group_order_id TEXT NOT NULL,
    user_id INTEGER,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (group_order_id) REFERENCES group_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 分帳記錄
CREATE TABLE split_bills (
    id TEXT PRIMARY KEY,
    group_order_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    items TEXT DEFAULT '{}', -- JSON array of cart items
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
    payment_method TEXT,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (group_order_id) REFERENCES group_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES group_members(id) ON DELETE CASCADE
);
```

#### POS系統相關表格

```sql
-- 收銀機
CREATE TABLE cash_registers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    restaurant_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    current_shift_id TEXT,
    peripherals TEXT DEFAULT '{}', -- JSON config
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- 班次管理
CREATE TABLE cash_shifts (
    id TEXT PRIMARY KEY,
    register_id TEXT NOT NULL,
    operator_id INTEGER NOT NULL,
    start_amount DECIMAL(10,2) NOT NULL,
    end_amount DECIMAL(10,2),
    expected_amount DECIMAL(10,2),
    difference_amount DECIMAL(10,2) DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    notes TEXT,

    FOREIGN KEY (register_id) REFERENCES cash_registers(id) ON DELETE CASCADE,
    FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 現金流動記錄
CREATE TABLE cash_movements (
    id TEXT PRIMARY KEY,
    shift_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sale', 'refund', 'cash_in', 'cash_out', 'count', 'opening', 'closing')),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    reference_id INTEGER, -- order_id, transaction_id, etc.
    reference_type TEXT, -- 'order', 'refund', 'adjustment'
    recorded_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 收據記錄
CREATE TABLE receipts (
    id TEXT PRIMARY KEY,
    order_id INTEGER NOT NULL,
    register_id TEXT NOT NULL,
    template TEXT DEFAULT 'standard' CHECK (template IN ('standard', 'kitchen', 'customer')),
    content TEXT NOT NULL, -- Receipt content/template data
    print_status TEXT DEFAULT 'pending' CHECK (print_status IN ('pending', 'printed', 'failed')),
    print_attempts INTEGER DEFAULT 0,
    printed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (register_id) REFERENCES cash_registers(id) ON DELETE CASCADE
);
```

#### 候位系統相關表格

```sql
-- 等候隊列
CREATE TABLE waiting_queue (
    id TEXT PRIMARY KEY,
    restaurant_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    party_size INTEGER NOT NULL,
    queue_number INTEGER NOT NULL,
    priority INTEGER DEFAULT 0,
    estimated_wait_minutes INTEGER NOT NULL,
    actual_wait_minutes INTEGER,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'seated', 'cancelled', 'no_show')),
    notification_sent BOOLEAN DEFAULT FALSE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    called_at DATETIME,
    seated_at DATETIME,
    cancelled_at DATETIME,
    notes TEXT,

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, queue_number, DATE(joined_at))
);

-- 隊列通知記錄
CREATE TABLE queue_notifications (
    id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sms', 'push', 'email')),
    recipient TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (queue_id) REFERENCES waiting_queue(id) ON DELETE CASCADE
);

-- 隊列設定
CREATE TABLE queue_settings (
    restaurant_id INTEGER PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT TRUE,
    avg_service_time INTEGER DEFAULT 45, -- minutes per table
    max_wait_time INTEGER DEFAULT 120, -- minutes
    notification_methods TEXT DEFAULT '["sms"]', -- JSON array
    auto_call_interval INTEGER DEFAULT 5, -- minutes
    max_queue_size INTEGER DEFAULT 50,
    queue_number_reset TEXT DEFAULT 'daily' CHECK (queue_number_reset IN ('daily', 'weekly', 'monthly', 'never')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);
```

---

## 5. API 設計

### 5.1 群組點餐 API

#### 基礎端點

```typescript
// 創建群組訂單
POST /api/v1/orders/group/create
Body: {
  restaurantId: number
  tableId?: number
  expirationHours?: number // 默認24小時
}
Response: {
  success: boolean
  data: {
    groupOrderId: string
    shareCode: string
    shareUrl: string
    qrCodeUrl: string
  }
}

// 加入群組
POST /api/v1/orders/group/join/{shareCode}
Body: {
  memberName: string
}
Response: {
  success: boolean
  data: {
    groupOrder: GroupOrder
    memberId: string
    sessionId: string
  }
}

// 獲取群組資訊
GET /api/v1/orders/group/{groupOrderId}
Response: {
  success: boolean
  data: {
    groupOrder: GroupOrder
    members: GroupMember[]
    totalItems: CartItem[]
    totalAmount: number
  }
}

// 更新群組購物車
POST /api/v1/orders/group/{groupOrderId}/cart
Body: {
  memberId: string
  action: 'add' | 'update' | 'remove'
  item: CartItem
}

// 開始分帳
POST /api/v1/orders/group/{groupOrderId}/split
Body: {
  splitType: 'equal' | 'proportional' | 'individual' | 'custom'
  customSplits?: {
    memberId: string
    amount: number
    items: CartItem[]
  }[]
}

// 處理個別付款
POST /api/v1/orders/group/{groupOrderId}/payment/{memberId}
Body: {
  paymentMethod: string
  amount: number
}
```

### 5.2 POS系統 API

```typescript
// 收銀機管理
GET / api / v1 / pos / registers;
POST / api / v1 / pos / registers;
PUT / api / v1 / pos / registers / { registerId };

// 班次管理
POST / api / v1 / pos / shifts / start;
POST / api / v1 / pos / shifts / { shiftId } / end;
GET / api / v1 / pos / shifts / { shiftId } / report;

// 現金操作
POST / api / v1 / pos / cash / count;
POST / api / v1 / pos / cash / adjustment;

// 收據打印
POST / api / v1 / pos / receipts / print / { orderId };
GET / api / v1 / pos / receipts / { receiptId } / status;

// 退款處理
POST / api / v1 / pos / refunds / create;
POST / api / v1 / pos / refunds / { refundId } / approve;
```

### 5.3 候位系統 API

```typescript
// 取號
POST /api/v1/queue/join
Body: {
  restaurantId: number
  customerName: string
  customerPhone?: string
  partySize: number
}

// 查詢隊列狀態
GET /api/v1/queue/{restaurantId}/status
GET /api/v1/queue/{queueId}/position

// 管理操作（員工使用）
POST /api/v1/queue/{queueId}/call
POST /api/v1/queue/{queueId}/seat
POST /api/v1/queue/{queueId}/cancel

// 隊列設定
GET /api/v1/queue/{restaurantId}/settings
PUT /api/v1/queue/{restaurantId}/settings
```

---

## 6. 前端組件設計

### 6.1 Customer App 新組件

#### GroupOrderingView

- 創建/加入群組介面
- 分享代碼/QR碼展示
- 群組成員列表
- 實時購物車同步

#### SplitBillView

- 分帳方式選擇
- 個人帳單預覽
- 付款介面整合

#### QueueJoinView

- 取號表單
- 隊列狀態顯示
- 預估等待時間

### 6.2 Admin Dashboard 新組件

#### POSSystemView

- 收銀機操作界面
- 班次管理
- 現金操作記錄
- 銷售報表

#### QueueManagementView

- 隊列監控面板
- 號碼呼叫操作
- 等候時間統計
- 設定管理

### 6.3 新增應用：Queue Display

專門的候位顯示系統

- 大屏幕顯示介面
- 即時更新等候資訊
- 多語言支援
- 自定義顯示樣式

---

## 7. 實時同步設計

### 7.1 Durable Objects 擴展

#### GroupOrderSession

處理群組訂單的實時同步

```typescript
class GroupOrderSession {
  // 成員管理
  addMember(memberId: string, memberInfo: any);
  removeMember(memberId: string);

  // 購物車同步
  syncCart(memberId: string, cartItems: CartItem[]);
  broadcastCartUpdate(cartData: any);

  // 分帳處理
  initiateSplit(splitConfig: SplitConfig);
  updatePaymentStatus(memberId: string, status: string);
}
```

#### QueueSession

處理候位系統的實時更新

```typescript
class QueueSession {
  // 隊列管理
  addToQueue(queueData: QueueEntry);
  updatePosition(queueId: string);
  callNext();

  // 通知推送
  broadcastQueueUpdate();
  sendNotification(queueId: string, type: string);
}
```

### 7.2 WebSocket 事件

#### 群組點餐事件

```typescript
// 發送事件
"group:member_joined" | "group:member_left";
"group:cart_updated" | "group:order_placed";
"group:split_initiated" | "group:payment_completed";

// 監聽事件
client.on("group:cart_updated", (data) => {
  updateGroupCart(data);
});
```

#### 候位系統事件

```typescript
// 發送事件
"queue:number_called" | "queue:position_updated";
"queue:customer_seated" | "queue:queue_reset";

// 監聽事件
client.on("queue:position_updated", (data) => {
  updateQueuePosition(data);
});
```

---

## 8. 部署與配置

### 8.1 環境變數

```env
# 群組訂單配置
GROUP_ORDER_EXPIRY_HOURS=24
GROUP_ORDER_MAX_MEMBERS=10

# POS系統配置
POS_PRINTER_TYPE=thermal
POS_CASH_DRAWER_ENABLED=true
POS_RECEIPT_TEMPLATES_PATH=/templates/receipts

# 候位系統配置
QUEUE_SMS_PROVIDER=twilio
QUEUE_MAX_SIZE=50
QUEUE_NOTIFICATION_ADVANCE_MINUTES=5

# 支付整合
PAYMENT_GATEWAY_ENDPOINT=https://api.payment.com
PAYMENT_WEBHOOK_SECRET=your_webhook_secret
```

### 8.2 Wrangler 配置更新

```toml
# apps/api/wrangler.toml 新增綁定
[[durable_objects.bindings]]
name = "GROUP_ORDER_SESSION"
class_name = "GroupOrderSession"

[[durable_objects.bindings]]
name = "QUEUE_SESSION"
class_name = "QueueSession"

[[kv_namespaces]]
binding = "GROUP_ORDERS_CACHE"
id = "your_kv_namespace_id"
```

---

## 9. 測試策略

### 9.1 單元測試

- 群組訂單邏輯測試
- 分帳計算算法測試
- 候位隊列管理測試
- POS現金計算測試

### 9.2 整合測試

- API端點測試
- 資料庫操作測試
- 實時同步測試
- 支付流程測試

### 9.3 端到端測試

- 完整群組點餐流程
- POS系統操作流程
- 候位到入座流程
- 多用戶併發測試

---

## 10. 監控與維護

### 10.1 性能監控

- 群組訂單併發數量
- WebSocket連接狀態
- 資料庫查詢性能
- API響應時間

### 10.2 業務監控

- 群組訂單轉換率
- 平均分帳金額
- 候位平均等待時間
- POS系統故障率

### 10.3 錯誤追蹤

- 分帳計算錯誤
- 支付處理失敗
- 實時同步失敗
- 硬件連接問題

---

**文檔狀態**: ✅ 完成  
**下一步**: 開始實施資料庫遷移腳本
