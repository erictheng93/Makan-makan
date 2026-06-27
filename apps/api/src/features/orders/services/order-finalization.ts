import { RealtimeBroadcastService } from "@makanmakan/database";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import type {
  OrderStatus,
  OrderStatusUpdateEvent,
} from "@makanmakan/shared-types";
import { RealtimeEventType as EventType } from "@makanmakan/shared-types";

interface KVLike {
  delete(key: string): Promise<unknown>;
}

interface FinalizationEnv {
  CACHE_KV: KVLike;
  REALTIME_SESSION?: DurableObjectNamespace;
}

export interface OrderStatusBroadcastSnapshot {
  id: string;
  restaurantId: string | number;
  orderNumber?: string | null;
}

export interface FinalizeOrderStatusSideEffectsOptions {
  env: FinalizationEnv;
  order: OrderStatusBroadcastSnapshot;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  updatedBy?: string;
  updatedByRole?: string;
  notes?: string;
  estimatedReadyTime?: Date;
}

export async function invalidateOrderCache(
  cacheKV: KVLike,
  orderId: string,
): Promise<void> {
  await Promise.all([
    cacheKV.delete(`order:${orderId}:full`),
    cacheKV.delete(`order:${orderId}:basic`),
  ]);
}

export async function finalizeOrderStatusSideEffects({
  env,
  order,
  previousStatus,
  newStatus,
  updatedBy,
  updatedByRole = "system",
  notes,
  estimatedReadyTime,
}: FinalizeOrderStatusSideEffectsOptions): Promise<void> {
  await Promise.all([
    invalidateOrderCache(env.CACHE_KV, order.id),
    broadcastOrderStatusUpdate({
      env,
      order,
      previousStatus,
      newStatus,
      updatedBy,
      updatedByRole,
      notes,
      estimatedReadyTime,
    }),
  ]);
}

async function broadcastOrderStatusUpdate({
  env,
  order,
  previousStatus,
  newStatus,
  updatedBy,
  updatedByRole,
  notes,
  estimatedReadyTime,
}: FinalizeOrderStatusSideEffectsOptions): Promise<void> {
  const realtimeBroadcastService = new RealtimeBroadcastService(env);
  const realtimeEvent: OrderStatusUpdateEvent = {
    type: EventType.ORDER_STATUS_UPDATE,
    eventId: realtimeBroadcastService.generateEventId(),
    timestamp: Date.now(),
    restaurantId: String(order.restaurantId),
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber || `#${order.id}`,
      status: newStatus,
      previousStatus,
      estimatedTime: estimatedReadyTime
        ? Math.floor(
            (new Date(estimatedReadyTime).getTime() - Date.now()) / 60000,
          )
        : undefined,
      message: notes,
      updatedBy: updatedBy
        ? {
            userId: updatedBy,
            userName: "System",
            role: updatedByRole ?? "system",
          }
        : undefined,
    },
  };

  await realtimeBroadcastService.broadcastOrderStatusUpdate(realtimeEvent);
}
