/**
 * Realtime Broadcast Service
 * Bridges API/service-layer code to the realtime worker's Durable Object,
 * which holds WebSocket connections per `${roomType}:${roomId}` instance.
 *
 * Lives in packages/database (not apps/api/src/services) so both
 * WaitingListService and the future QueueService can import directly
 * without crossing the apps→packages dependency boundary.
 */

import type {
  RealtimeEvent,
  NewOrderEvent,
  OrderStatusUpdateEvent,
  OrderItemStatusUpdateEvent,
  KitchenItemStatusEvent,
  MenuAvailabilityUpdateEvent,
} from "@makanmakan/shared-types";

/** Minimal env shape — avoids depending on apps/api's full Env type. */
interface BroadcastEnv {
  REALTIME_SESSION?: DurableObjectNamespace;
}

export interface BroadcastResult {
  success: boolean;
  eventId?: string;
  recipientCount?: number;
  error?: string;
}

export class RealtimeBroadcastService {
  private env: BroadcastEnv;

  constructor(env: BroadcastEnv) {
    this.env = env;
  }

  async broadcastEvent(
    roomType: string,
    roomId: string,
    event: RealtimeEvent,
  ): Promise<BroadcastResult> {
    try {
      // REALTIME_SESSION may be undefined in tests / unconfigured envs.
      // Returning success=true here is intentional: we treat broadcast
      // as best-effort and never fail the originating mutation. The
      // production binding is verified at deploy time (see INC-001).
      if (!this.env.REALTIME_SESSION) {
        console.warn(
          "[RealtimeBroadcastService] REALTIME_SESSION not configured, skipping broadcast",
        );
        return {
          success: true,
          eventId: event.eventId,
          recipientCount: 0,
        };
      }

      const durableObjectId = this.env.REALTIME_SESSION.idFromName(
        `${roomType}:${roomId}`,
      );
      const durableObjectStub = this.env.REALTIME_SESSION.get(durableObjectId);

      const response = await durableObjectStub.fetch(
        `https://realtime-internal/broadcast`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        },
      );

      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        eventId?: string;
        recipientCount?: number;
      };

      if (!result.success) {
        console.error("[RealtimeBroadcastService] broadcast failed", {
          roomType,
          roomId,
          eventType: event.type,
          error: result.error,
        });
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        eventId: result.eventId,
        recipientCount: result.recipientCount,
      };
    } catch (error) {
      console.error("[RealtimeBroadcastService] broadcast error", {
        roomType,
        roomId,
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "unknown",
      };
    }
  }

  async broadcastNewOrder(event: NewOrderEvent): Promise<BroadcastResult> {
    return this.broadcastEvent("restaurant", event.restaurantId, event);
  }

  async broadcastOrderStatusUpdate(
    event: OrderStatusUpdateEvent,
  ): Promise<BroadcastResult> {
    return this.broadcastEvent("restaurant", event.restaurantId, event);
  }

  async broadcastOrderItemStatusUpdate(
    event: OrderItemStatusUpdateEvent,
  ): Promise<BroadcastResult> {
    return this.broadcastEvent("restaurant", event.restaurantId, event);
  }

  async broadcastKitchenItemStatus(
    event: KitchenItemStatusEvent,
  ): Promise<BroadcastResult> {
    return this.broadcastEvent("restaurant", event.restaurantId, event);
  }

  async broadcastMenuAvailabilityUpdate(
    event: MenuAvailabilityUpdateEvent,
  ): Promise<BroadcastResult> {
    return this.broadcastEvent("restaurant", event.restaurantId, event);
  }

  generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
