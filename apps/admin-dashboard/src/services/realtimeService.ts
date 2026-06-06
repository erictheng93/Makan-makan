import { computed } from "vue";
import {
  RealtimeEventType,
  type RealtimeEvent,
} from "@makanmakan/shared-types";
import { useWebSocketService } from "./websocketService";

export interface RealtimeMessage {
  id: string;
  type: string;
  data: any;
  timestamp: string;
  restaurantId?: string;
}

export interface RealtimeSubscription {
  id: string;
  types: string[];
  callback: (message: RealtimeMessage) => void;
  restaurantId?: string;
  websocketSubscriptionId: string;
}

export type RealtimeConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

const CANONICAL_EVENT_ALIASES: Record<string, RealtimeEventType> = {
  order_created: RealtimeEventType.NEW_ORDER,
  order_updated: RealtimeEventType.ORDER_STATUS_UPDATE,
  order_status_changed: RealtimeEventType.ORDER_STATUS_UPDATE,
  order_cancelled: RealtimeEventType.ORDER_CANCELLED,
  menu_updated: RealtimeEventType.MENU_ITEM_UPDATE,
  queue_joined: RealtimeEventType.WAITING_LIST_JOINED,
  queue_called: RealtimeEventType.WAITING_LIST_CALLED,
  queue_notified: RealtimeEventType.WAITING_LIST_CALLED,
  queue_seated: RealtimeEventType.WAITING_LIST_SEATED,
  queue_no_show: RealtimeEventType.WAITING_LIST_EXPIRED,
  queue_cancelled: RealtimeEventType.WAITING_LIST_CANCELLED,
  table_occupied: RealtimeEventType.TABLE_STATUS_UPDATE,
  table_available: RealtimeEventType.TABLE_STATUS_UPDATE,
  table_reserved: RealtimeEventType.TABLE_STATUS_UPDATE,
  table_cleaning: RealtimeEventType.TABLE_STATUS_UPDATE,
  system_notification: RealtimeEventType.SYSTEM_NOTIFICATION,
};

function normalizeEventType(type: string): RealtimeEventType {
  return (
    CANONICAL_EVENT_ALIASES[type] ?? (type as unknown as RealtimeEventType)
  );
}

function toRealtimeMessage(event: RealtimeEvent): RealtimeMessage {
  return {
    id: event.eventId,
    type: event.type,
    data: event.data,
    timestamp: new Date(event.timestamp).toISOString(),
    restaurantId: String(event.restaurantId),
  };
}

function resolveRealtimeHttpBase(): string {
  const realtimeBase =
    import.meta.env.VITE_REALTIME_HTTP_URL ||
    import.meta.env.VITE_REALTIME_URL ||
    import.meta.env.VITE_REALTIME_WS_URL;

  if (!realtimeBase) {
    throw new Error("Realtime service URL is not configured");
  }

  return String(realtimeBase)
    .replace(/^wss:/, "https:")
    .replace(/^ws:/, "http:")
    .replace(/\/$/, "");
}

class RealtimeService {
  private websocketService = useWebSocketService();
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  private lastEventId: string | null = null;
  private messageBuffer: RealtimeMessage[] = [];
  private maxBufferSize = 100;
  private currentRestaurantId: string | null = null;
  private connectionStatus = computed<RealtimeConnectionStatus>(() => {
    const status = this.websocketService.status.value;
    if (status === "connected") return "connected";
    if (status === "connecting" || status === "reconnecting") {
      return "connecting";
    }
    if (status === "error") return "error";
    return "disconnected";
  });

  async connect(restaurantId?: string): Promise<void> {
    const targetRestaurantId = restaurantId ?? this.currentRestaurantId;
    if (!targetRestaurantId) {
      console.warn("Realtime WebSocket requires a restaurant ID");
      return;
    }

    this.currentRestaurantId = targetRestaurantId;
    await this.websocketService.connect(targetRestaurantId);
  }

  subscribe(
    types: string | string[],
    callback: (message: RealtimeMessage) => void,
    restaurantId?: string,
  ): string {
    const subscriptionTypes = Array.isArray(types) ? types : [types];
    const normalizedTypes = subscriptionTypes
      .filter((type) => type !== "*")
      .map(normalizeEventType);
    const websocketTypes =
      normalizedTypes.length > 0
        ? normalizedTypes
        : (Object.values(RealtimeEventType) as RealtimeEventType[]);
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const websocketSubscriptionId = this.websocketService.subscribe(
      websocketTypes,
      (event) => {
        const message = toRealtimeMessage(event);
        this.handleMessage(message);
        callback(message);
      },
      (event) =>
        !restaurantId || String(event.restaurantId) === String(restaurantId),
    );

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      types: subscriptionTypes,
      callback,
      restaurantId,
      websocketSubscriptionId,
    });

    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    this.websocketService.unsubscribe(subscription.websocketSubscriptionId);
    return this.subscriptions.delete(subscriptionId);
  }

  disconnect(): void {
    for (const subscription of this.subscriptions.values()) {
      this.websocketService.unsubscribe(subscription.websocketSubscriptionId);
    }
    this.subscriptions.clear();
    this.websocketService.disconnect();
  }

  reconnect(): void {
    const restaurantId = this.currentRestaurantId;
    this.websocketService.disconnect();
    if (restaurantId) {
      void this.websocketService.connect(restaurantId);
    }
  }

  async ping(): Promise<boolean> {
    if (this.websocketService.isConnected.value) {
      this.websocketService.send({ type: "ping", timestamp: Date.now() });
      return true;
    }
    return false;
  }

  async getServerTime(): Promise<Date> {
    return new Date();
  }

  async broadcastToGroup(
    groupOrderId: string,
    event: {
      type: string;
      data: any;
      excludeSessionId?: string;
    },
  ): Promise<boolean> {
    try {
      await this.postRealtimeRoom("group_order", groupOrderId, event);
      return true;
    } catch (error) {
      console.error("Failed to broadcast to group:", error);
      return false;
    }
  }

  async sendGroupNotification(
    groupOrderId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      targetMembers?: string[];
      priority?: "low" | "normal" | "high" | "urgent";
    },
  ): Promise<boolean> {
    return this.broadcastToGroup(groupOrderId, {
      type: "group_notification",
      data: {
        ...notification,
        groupOrderId,
        timestamp: Date.now(),
        id: crypto.randomUUID(),
      },
    });
  }

  async checkGroupConnectionHealth(groupOrderId: string): Promise<{
    connected: boolean;
    memberCount: number;
    activeMembers: number;
    lastActivity: number;
  }> {
    try {
      const stats = await this.getRealtimeRoomStats(
        "group_order",
        groupOrderId,
      );
      const connectionCount = Number(stats.connectionCount ?? 0);
      return {
        connected: connectionCount > 0,
        memberCount: connectionCount,
        activeMembers: connectionCount,
        lastActivity: Date.now(),
      };
    } catch (error) {
      console.error("Failed to check group connection health:", error);
      return {
        connected: false,
        memberCount: 0,
        activeMembers: 0,
        lastActivity: 0,
      };
    }
  }

  async syncGroupState(_groupOrderId: string): Promise<any> {
    return null;
  }

  getConnectionStatus() {
    return this.connectionStatus;
  }

  getMessageBuffer(): RealtimeMessage[] {
    return [...this.messageBuffer];
  }

  getMessageLatency(): number {
    const lastMessage = this.messageBuffer[this.messageBuffer.length - 1];
    if (!lastMessage) return 0;

    const messageTime = new Date(lastMessage.timestamp).getTime();
    return Math.max(0, Date.now() - messageTime);
  }

  getConnectionStats() {
    return {
      status: this.connectionStatus.value,
      totalMessages: this.messageBuffer.length,
      subscriptions: this.subscriptions.size,
      lastEventId: this.lastEventId,
      reconnectAttempts: 0,
      latency: this.getMessageLatency(),
    };
  }

  cleanup(): void {
    this.disconnect();
    this.messageBuffer = [];
  }

  private handleMessage(message: RealtimeMessage): void {
    this.lastEventId = message.id;
    this.messageBuffer.push(message);
    if (this.messageBuffer.length > this.maxBufferSize) {
      this.messageBuffer.shift();
    }
  }

  private async postRealtimeRoom(
    roomType: string,
    roomId: string,
    payload: unknown,
  ): Promise<void> {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(
      `${resolveRealtimeHttpBase()}/broadcast/${encodeURIComponent(roomType)}/${encodeURIComponent(roomId)}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(`Realtime broadcast failed with ${response.status}`);
    }
  }

  private async getRealtimeRoomStats(
    roomType: string,
    roomId: string,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(
      `${resolveRealtimeHttpBase()}/stats/${encodeURIComponent(roomType)}/${encodeURIComponent(roomId)}`,
    );

    if (!response.ok) {
      throw new Error(`Realtime stats failed with ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

export const realtimeService = new RealtimeService();

export function useRealtime() {
  return {
    connectionStatus: realtimeService.getConnectionStatus(),
    connect: (restaurantId?: string) => realtimeService.connect(restaurantId),
    disconnect: () => realtimeService.disconnect(),
    subscribe: (
      types: string | string[],
      callback: (message: RealtimeMessage) => void,
      restaurantId?: string,
    ) => realtimeService.subscribe(types, callback, restaurantId),
    unsubscribe: (subscriptionId: string) =>
      realtimeService.unsubscribe(subscriptionId),
    reconnect: () => realtimeService.reconnect(),
    ping: () => realtimeService.ping(),
    getMessageBuffer: () => realtimeService.getMessageBuffer(),
  };
}

export const REALTIME_EVENTS = {
  ORDER_CREATED: RealtimeEventType.NEW_ORDER,
  ORDER_UPDATED: RealtimeEventType.ORDER_STATUS_UPDATE,
  ORDER_STATUS_CHANGED: RealtimeEventType.ORDER_STATUS_UPDATE,
  ORDER_CANCELLED: RealtimeEventType.ORDER_CANCELLED,
  GROUP_ORDER_CREATED: RealtimeEventType.GROUP_ORDER_CREATED,
  GROUP_ORDER_UPDATED: "group_order_updated",
  GROUP_ORDER_EXPIRED: "group_order_expired",
  GROUP_ORDER_COMPLETED: "group_order_completed",
  GROUP_ORDER_CANCELLED: "group_order_cancelled",
  GROUP_MEMBER_JOINED: RealtimeEventType.GROUP_MEMBER_JOINED,
  GROUP_MEMBER_LEFT: "group_member_left",
  GROUP_MEMBER_PROMOTED: "group_member_promoted",
  GROUP_MEMBER_ACTIVITY: "group_member_activity",
  GROUP_CART_ITEM_ADDED: RealtimeEventType.GROUP_CART_ITEM_ADDED,
  GROUP_CART_ITEM_UPDATED: RealtimeEventType.GROUP_CART_ITEM_UPDATED,
  GROUP_CART_ITEM_REMOVED: RealtimeEventType.GROUP_CART_ITEM_REMOVED,
  GROUP_CART_CONFLICT: "group_cart_conflict",
  GROUP_CART_SYNCED: "group_cart_synced",
  GROUP_SPLIT_INITIATED: "group_split_initiated",
  GROUP_SPLIT_UPDATED: "group_split_updated",
  GROUP_PAYMENT_COMPLETED: "group_payment_completed",
  GROUP_PAYMENT_FAILED: "group_payment_failed",
  GROUP_PAYMENT_REMINDER: "group_payment_reminder",
  QUEUE_JOINED: RealtimeEventType.WAITING_LIST_JOINED,
  QUEUE_CALLED: RealtimeEventType.WAITING_LIST_CALLED,
  QUEUE_NOTIFIED: RealtimeEventType.WAITING_LIST_CALLED,
  QUEUE_SEATED: RealtimeEventType.WAITING_LIST_SEATED,
  QUEUE_NO_SHOW: RealtimeEventType.WAITING_LIST_EXPIRED,
  QUEUE_CANCELLED: RealtimeEventType.WAITING_LIST_CANCELLED,
  POS_TRANSACTION: "pos_transaction",
  CASH_MOVEMENT: "cash_movement",
  SHIFT_STARTED: "shift_started",
  SHIFT_ENDED: "shift_ended",
  REGISTER_STATUS_CHANGED: "register_status_changed",
  TABLE_OCCUPIED: RealtimeEventType.TABLE_STATUS_UPDATE,
  TABLE_AVAILABLE: RealtimeEventType.TABLE_STATUS_UPDATE,
  TABLE_RESERVED: RealtimeEventType.TABLE_STATUS_UPDATE,
  TABLE_CLEANING: RealtimeEventType.TABLE_STATUS_UPDATE,
  MENU_UPDATED: RealtimeEventType.MENU_ITEM_UPDATE,
  USER_ACTIVITY: "user_activity",
  SYSTEM_NOTIFICATION: RealtimeEventType.SYSTEM_NOTIFICATION,
  CONNECTION_STATUS: RealtimeEventType.CONNECTION_ACK,
  HEARTBEAT: RealtimeEventType.HEARTBEAT,
  ALL: "*",
} as const;

export default realtimeService;
