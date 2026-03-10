/**
 * Realtime Broadcast Service
 * 用於從 API 向 Realtime Durable Object 廣播事件
 */

import type { Env } from "../shared/types";
import { ConsoleLogger } from "../core/monitoring";
import type {
  RealtimeEvent,
  NewOrderEvent,
  OrderStatusUpdateEvent,
  OrderItemStatusUpdateEvent,
  KitchenItemStatusEvent,
  MenuAvailabilityUpdateEvent,
} from "@makanmakan/shared-types";

export interface BroadcastResult {
  success: boolean;
  eventId?: string;
  recipientCount?: number;
  error?: string;
}

/**
 * Realtime 廣播服務
 */
export class RealtimeBroadcastService {
  private env: Env;
  private logger: ConsoleLogger;

  constructor(env: Env) {
    this.env = env;
    this.logger = new ConsoleLogger("realtime-broadcast");
  }

  /**
   * 廣播事件到指定的房間
   */
  async broadcastEvent(
    roomType: string,
    roomId: string,
    event: RealtimeEvent,
  ): Promise<BroadcastResult> {
    try {
      // 檢查 REALTIME_SESSION 是否可用（測試環境可能未配置）
      if (!this.env.REALTIME_SESSION) {
        this.logger.warn("REALTIME_SESSION not configured, skipping broadcast");
        return {
          success: true,
          eventId: event.eventId,
          recipientCount: 0,
        };
      }

      // 獲取 Durable Object 實例
      const durableObjectId = this.env.REALTIME_SESSION.idFromName(
        `${roomType}:${roomId}`,
      );
      const durableObjectStub = this.env.REALTIME_SESSION.get(durableObjectId);

      // 發送廣播請求到 Durable Object
      const response = await durableObjectStub.fetch(
        `https://realtime-internal/broadcast`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        },
      );

      const result = (await response.json()) as any;

      if (!result.success) {
        this.logger.error(
          "Failed to broadcast event",
          new Error(result.error),
          {
            roomType,
            roomId,
            eventType: event.type,
          },
        );
        return {
          success: false,
          error: result.error,
        };
      }

      this.logger.info("Event broadcast successful", {
        roomType,
        roomId,
        eventType: event.type,
        eventId: result.eventId,
        recipientCount: result.recipientCount,
      });

      return {
        success: true,
        eventId: result.eventId,
        recipientCount: result.recipientCount,
      };
    } catch (error) {
      this.logger.error("Broadcast error", error as Error, {
        roomType,
        roomId,
        eventType: event.type,
      });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 廣播新訂單事件
   */
  async broadcastNewOrder(event: NewOrderEvent): Promise<BroadcastResult> {
    // 廣播到餐廳房間（所有連線都會收到）
    return this.broadcastEvent("restaurant", event.restaurantId, event);
  }

  /**
   * 廣播訂單狀態更新事件
   */
  async broadcastOrderStatusUpdate(
    event: OrderStatusUpdateEvent,
  ): Promise<BroadcastResult> {
    return this.broadcastEvent("restaurant", event.restaurantId, event);
  }

  /**
   * 廣播訂單項目狀態更新事件
   */
  async broadcastOrderItemStatusUpdate(
    event: OrderItemStatusUpdateEvent,
  ): Promise<BroadcastResult> {
    return this.broadcastEvent("restaurant", event.restaurantId, event);
  }

  /**
   * 廣播廚房項目狀態事件
   */
  async broadcastKitchenItemStatus(
    event: KitchenItemStatusEvent,
  ): Promise<BroadcastResult> {
    return this.broadcastEvent("restaurant", event.restaurantId, event);
  }

  /**
   * 廣播菜單可用性更新事件
   */
  async broadcastMenuAvailabilityUpdate(
    event: MenuAvailabilityUpdateEvent,
  ): Promise<BroadcastResult> {
    return this.broadcastEvent("restaurant", event.restaurantId, event);
  }

  /**
   * 生成唯一的事件 ID
   */
  generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
