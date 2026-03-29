/**
 * Realtime Factory for Test Data Generation
 *
 * 提供即時通訊/WebSocket 系統的測試數據工廠，
 * 包含認證資料、事件資料、以及 MockWebSocket 工具。
 */

import { vi } from "vitest";
import {
  BaseFactory,
  type FactoryOptions,
  randomUUID,
  randomNumber,
  currentTimestamp,
} from "./base.factory";

// ============================================================================
// 型別定義
// ============================================================================

/**
 * 即時通訊認證資料
 */
export interface RealtimeAuthTestData {
  /** 房間類型 */
  roomType: "customer" | "kitchen" | "admin" | "restaurant";
  /** 房間 ID */
  roomId: string;
  /** 餐廳 ID */
  restaurantId: string;
  /** 使用者角色 */
  role: "customer" | "staff" | "admin";
  /** 桌號 ID（顧客連線時使用） */
  tableId?: string;
  /** 座位 ID（座位級別連線時使用） */
  seatId?: string;
  /** 使用者 ID（已登入使用者） */
  userId?: number;
  /** Token 過期時間（Unix timestamp 秒） */
  exp: number;
  /** Token 發行時間（Unix timestamp 秒） */
  iat: number;
}

// ============================================================================
// RealtimeAuthFactory — 認證資料工廠
// ============================================================================

/**
 * 即時通訊認證資料工廠
 *
 * 生成符合 RealtimeAuthPayload 介面的測試認證資料，
 * 提供顧客、廚房、管理員、餐廳等不同角色的快速建構方法。
 */
export class RealtimeAuthFactory extends BaseFactory<RealtimeAuthTestData> {
  /**
   * 生成預設的認證測試數據（顧客房間）
   */
  build(options?: FactoryOptions<RealtimeAuthTestData>): RealtimeAuthTestData {
    const seq = options?.sequence ?? this.getNextSequence();
    const restaurantId = options?.overrides?.restaurantId ?? `rest-${seq + 1}`;
    const roomType = options?.overrides?.roomType ?? "customer";
    const nowSec = Math.floor(Date.now() / 1000);

    const baseData: RealtimeAuthTestData = {
      roomType,
      roomId: `${roomType}-${restaurantId}-${seq}`,
      restaurantId,
      role: "customer",
      tableId: undefined,
      seatId: undefined,
      userId: seq,
      exp: nowSec + 3600,
      iat: nowSec,
    };

    return {
      ...baseData,
      ...options?.overrides,
    };
  }

  /**
   * 生成顧客認證資料
   *
   * roomType 設為 "customer"，role 設為 "customer"，
   * 自動帶入 tableId 和 seatId。
   */
  buildCustomer(
    restaurantId: string,
    options?: FactoryOptions<RealtimeAuthTestData>,
  ): RealtimeAuthTestData {
    const seq = this.getNextSequence();
    return this.build({
      ...options,
      sequence: options?.sequence ?? seq,
      overrides: {
        roomType: "customer",
        roomId: `customer-${restaurantId}-${seq}`,
        restaurantId,
        role: "customer",
        tableId: `table-${seq + 1}`,
        seatId: `seat-${seq + 1}`,
        userId: seq,
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成廚房認證資料
   *
   * roomType 設為 "kitchen"，role 設為 "staff"。
   */
  buildKitchen(
    restaurantId: string,
    options?: FactoryOptions<RealtimeAuthTestData>,
  ): RealtimeAuthTestData {
    const seq = this.getNextSequence();
    return this.build({
      ...options,
      sequence: options?.sequence ?? seq,
      overrides: {
        roomType: "kitchen",
        roomId: `kitchen-${restaurantId}-${seq}`,
        restaurantId,
        role: "staff",
        userId: seq,
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成管理員認證資料
   *
   * roomType 設為 "admin"，role 設為 "admin"。
   */
  buildAdmin(
    restaurantId: string,
    options?: FactoryOptions<RealtimeAuthTestData>,
  ): RealtimeAuthTestData {
    const seq = this.getNextSequence();
    return this.build({
      ...options,
      sequence: options?.sequence ?? seq,
      overrides: {
        roomType: "admin",
        roomId: `admin-${restaurantId}-${seq}`,
        restaurantId,
        role: "admin",
        userId: seq,
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成餐廳級別認證資料
   *
   * roomType 設為 "restaurant"，role 設為 "staff"。
   */
  buildRestaurant(
    restaurantId: string,
    options?: FactoryOptions<RealtimeAuthTestData>,
  ): RealtimeAuthTestData {
    const seq = this.getNextSequence();
    return this.build({
      ...options,
      sequence: options?.sequence ?? seq,
      overrides: {
        roomType: "restaurant",
        roomId: `restaurant-${restaurantId}-${seq}`,
        restaurantId,
        role: "staff",
        userId: seq,
        ...options?.overrides,
      },
    });
  }
}

// ============================================================================
// RealtimeEventFactory — 事件資料工廠（純物件，非 class）
// ============================================================================

/**
 * 即時通訊事件工廠
 *
 * 提供各類 WebSocket 事件的快速建構方法，
 * 對應 packages/shared-types/src/realtime-events.ts 定義的事件型別。
 */
export const realtimeEventFactory = {
  /**
   * 建構基礎事件資料
   */
  buildBase(type: string, restaurantId: string = "rest-1") {
    return {
      type,
      eventId: randomUUID(),
      timestamp: Date.now(),
      restaurantId,
    };
  },

  /**
   * 建構新訂單事件
   */
  buildNewOrder(restaurantId?: string, overrides?: Record<string, any>) {
    return {
      ...this.buildBase("new_order", restaurantId),
      data: {
        orderId: randomNumber(1, 1000),
        orderNumber: `ORD-${randomNumber(100, 999)}`,
        tableId: "table-1",
        tableName: "T1",
        items: [
          {
            orderItemId: 1,
            menuItemId: 1,
            menuItemName: "測試餐點",
            quantity: 1,
            price: 100,
          },
        ],
        totalAmount: 100,
        ...overrides,
      },
    };
  },

  /**
   * 建構訂單狀態更新事件
   */
  buildOrderStatusUpdate(
    restaurantId?: string,
    overrides?: Record<string, any>,
  ) {
    return {
      ...this.buildBase("order_status_update", restaurantId),
      data: {
        orderId: randomNumber(1, 1000),
        orderNumber: `ORD-${randomNumber(100, 999)}`,
        status: 2, // PREPARING
        previousStatus: 1, // CONFIRMED
        ...overrides,
      },
    };
  },

  /**
   * 建構廚房佇列更新事件
   */
  buildKitchenQueueUpdate(
    restaurantId?: string,
    overrides?: Record<string, any>,
  ) {
    return {
      ...this.buildBase("kitchen_queue_update", restaurantId),
      data: {
        pendingCount: randomNumber(0, 10),
        cookingCount: randomNumber(0, 5),
        readyCount: randomNumber(0, 3),
        averageWaitTime: randomNumber(5, 20),
        ...overrides,
      },
    };
  },

  /**
   * 建構心跳事件
   */
  buildHeartbeat(restaurantId?: string) {
    return {
      ...this.buildBase("heartbeat", restaurantId),
      data: { serverTime: Date.now() },
    };
  },

  /**
   * 建構連線確認事件
   */
  buildConnectionAck(restaurantId?: string, overrides?: Record<string, any>) {
    return {
      ...this.buildBase("connection_ack", restaurantId),
      data: {
        connectionId: randomUUID(),
        roomType: "customer",
        roomId: "customer-rest-1-1",
        connectedAt: Date.now(),
        activeConnections: 1,
        ...overrides,
      },
    };
  },
};

// ============================================================================
// MockWebSocket — WebSocket 模擬工具
// ============================================================================

/**
 * 模擬 WebSocket 物件
 *
 * 提供 send/close 的 vi.fn() mock，
 * 以及 simulateMessage / simulateClose 輔助方法來模擬接收訊息與斷線。
 */
export class MockWebSocket {
  /** 連線狀態（1 = OPEN） */
  readyState: number = 1;

  /** 接收訊息回呼 */
  onmessage: ((event: any) => void) | null = null;

  /** 連線關閉回呼 */
  onclose: ((event: any) => void) | null = null;

  /** 錯誤回呼 */
  onerror: ((event: any) => void) | null = null;

  /** 發送訊息（mock） */
  send = vi.fn();

  /** 關閉連線（mock） */
  close = vi.fn();

  /**
   * 模擬接收訊息
   *
   * @param data - 訊息內容，字串或物件（物件會自動 JSON 序列化）
   */
  simulateMessage(data: any): void {
    if (this.onmessage) {
      this.onmessage({
        data: typeof data === "string" ? data : JSON.stringify(data),
      });
    }
  }

  /**
   * 模擬連線關閉
   *
   * @param code - WebSocket 關閉代碼（預設 1000 正常關閉）
   * @param reason - 關閉原因（預設空字串）
   */
  simulateClose(code: number = 1000, reason: string = ""): void {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }
}

/**
 * 建立 MockWebSocket 配對（模擬 client/server）
 *
 * @returns 包含 client 和 server 兩個 MockWebSocket 的物件
 */
export const createMockWebSocketPair = (): {
  client: MockWebSocket;
  server: MockWebSocket;
} => {
  const client = new MockWebSocket();
  const server = new MockWebSocket();
  return { client, server };
};

// ============================================================================
// 輔助函式
// ============================================================================

/**
 * 將數字角色轉換為字串角色
 *
 * 對應 UserRole 列舉：
 * - 0 (Admin), 1 (Owner) → "admin"
 * - 2 (Chef), 3 (Service Crew) → "staff"
 * - 4 (Customer) 及其他 → "customer"
 *
 * @param numericRole - 數字角色值
 * @returns 字串角色
 */
export function getStringRole(
  numericRole: number,
): "customer" | "staff" | "admin" {
  if (numericRole === 0 || numericRole === 1) return "admin";
  if (numericRole >= 2 && numericRole <= 3) return "staff";
  return "customer";
}

// ============================================================================
// 導出單例實例
// ============================================================================

/** 即時通訊認證工廠單例 */
export const realtimeAuthFactory = new RealtimeAuthFactory();
