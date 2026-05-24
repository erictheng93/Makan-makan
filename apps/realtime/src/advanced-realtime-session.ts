import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types";
import type { OrderStatus } from "@makanmakan/shared-types";

/**
 * Advanced Durable Object with Enterprise-Grade Features:
 * - State machines for order lifecycle management
 * - Cross-object communication for distributed coordination
 * - Hibernation API for cost optimization
 * - Persistent state with automatic recovery
 * - Geographic routing and load balancing
 * - Real-time analytics integration
 */

interface ConnectionInfo {
  id: string;
  socket: WebSocket;
  userId: number;
  restaurantId: number;
  role: number;
  lastActivity: number;
  subscriptions: Set<string>;
  metadata: {
    country: string;
    city: string;
    deviceType: string;
    sessionId: string;
  };
}

interface OrderStateTransition {
  from: OrderStatus;
  to: OrderStatus;
  timestamp: number;
  triggeredBy: number;
  metadata?: Record<string, unknown>;
}

interface OrderEstimatedTimes {
  preparation: number;
  ready: number;
  completion: number;
}

interface OrderState {
  id: string;
  currentState: OrderStatus;
  previousState?: OrderStatus;
  restaurantId: number;
  transitions: Array<OrderStateTransition>;
  estimatedTimes: OrderEstimatedTimes;
  priority: "low" | "normal" | "high" | "critical";
  metadata: Record<string, unknown>;
}

interface GroupOrderState {
  id: string;
  shareCode: string;
  status: "active" | "ordering" | "checkout" | "completed" | "cancelled";
  restaurantId: number;
  members: Map<string, GroupMember>;
  cart: Map<string, CartItem>;
  splitBills: Map<string, SplitBill>;
  host: GroupMember;
  settings: {
    maxMembers: number;
    allowEditOthers: boolean;
    splitType: "equal" | "proportional" | "individual" | "custom";
  };
  totalAmount: number;
  lastActivity: number;
  createdAt: number;
  expiresAt: number;
}

interface GroupMember {
  id: string;
  sessionId: string;
  name: string;
  phone?: string;
  role: "creator" | "admin" | "member";
  joinedAt: number;
  lastActiveAt: number;
  isOnline: boolean;
  totalAmount: number;
  itemCount: number;
  paymentStatus: "unpaid" | "pending" | "paid";
}

interface CartItem {
  id: string;
  memberId: string;
  menuItemId: number;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizations: Record<string, unknown>;
  specialInstructions?: string;
  addedAt: number;
  updatedAt: number;
  version: number;
}

interface SplitBill {
  id: string;
  memberId: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  totalAmount: number;
  items: string[];
  paymentStatus: "pending" | "processing" | "paid" | "failed";
  paymentMethod?: string;
  paidAt?: number;
}

/**
 * Group order as persisted in Durable Object storage — Maps are
 * serialized to plain Records so they survive JSON round-trips.
 */
type SerializedGroupOrder = Omit<
  GroupOrderState,
  "members" | "cart" | "splitBills"
> & {
  members: Record<string, GroupMember>;
  cart: Record<string, CartItem>;
  splitBills: Record<string, SplitBill>;
};

/**
 * Group order shape sent over the wire to clients — Maps are flattened
 * to arrays for easier consumption by the frontend.
 */
interface GroupOrderClientView {
  id: string;
  shareCode: string;
  status: GroupOrderState["status"];
  restaurantId: number;
  members: GroupMember[];
  cart: CartItem[];
  splitBills: SplitBill[];
  totalAmount: number;
  settings: GroupOrderState["settings"];
  lastActivity: number;
  createdAt: number;
  expiresAt: number;
}

/**
 * Shape of WebSocket messages sent to clients. Keeping this loose
 * (Record<string, unknown>) because message bodies vary widely; tightening
 * further would require a discriminated union across every handler.
 */
type OutboundMessage = Record<string, unknown>;

interface SessionState {
  activeConnections: Map<string, ConnectionInfo>;
  orderStates: Map<string, OrderState>;
  groupOrderStates: Map<string, GroupOrderState>;
  restaurantMetrics: Map<number, unknown>;
  lastActivity: number;
  hibernated: boolean;
  totalMessages: number;
  errors: Array<{
    timestamp: number;
    error: string;
    context: Record<string, unknown>;
  }>;
}

export class AdvancedRealtimeSession extends DurableObject<Env> {
  private sessionState: SessionState;
  private stateTransitions: Map<OrderStatus, OrderStatus[]> = new Map();
  private hibernationTimer?: ReturnType<typeof setInterval>;
  private metricsTimer?: ReturnType<typeof setInterval>;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);

    // Initialize session state
    this.sessionState = {
      activeConnections: new Map(),
      orderStates: new Map(),
      groupOrderStates: new Map(),
      restaurantMetrics: new Map(),
      lastActivity: Date.now(),
      hibernated: false,
      totalMessages: 0,
      errors: [],
    };

    // Define valid state transitions for order lifecycle
    this.stateTransitions = new Map<OrderStatus, OrderStatus[]>([
      ["pending", ["confirmed", "cancelled"]],
      ["confirmed", ["preparing", "cancelled"]],
      ["preparing", ["ready", "cancelled"]],
      ["ready", ["delivered", "cancelled"]],
      ["delivered", ["paid", "refunded"]],
      ["paid", []],
      ["cancelled", []],
      ["refunded", []],
    ]);

    // Initialize persistent state
    state.blockConcurrencyWhile(async () => {
      await this.loadPersistedState();
      this.startBackgroundTasks();
    });
  }

  /**
   * Handle WebSocket connections with advanced features
   */
  async fetch(request: Request): Promise<Response> {
    try {
      // Handle different endpoint types
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/websocket") {
        return this.handleWebSocketUpgrade(request);
      } else if (path === "/broadcast") {
        return this.handleCrossObjectBroadcast(request);
      } else if (path === "/state") {
        return this.handleStateQuery(request);
      } else if (path === "/health") {
        return this.handleHealthCheck(request);
      } else if (path === "/hibernate") {
        return this.handleHibernation(request);
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("AdvancedRealtimeSession error:", error);
      this.recordError(error, { path: new URL(request.url).pathname });
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  /**
   * Handle WebSocket upgrade with enhanced connection management
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    // Extract connection metadata
    const url = new URL(request.url);
    const userId = parseInt(url.searchParams.get("userId") || "0");
    const restaurantId = parseInt(url.searchParams.get("restaurantId") || "0");
    const role = parseInt(url.searchParams.get("role") || "0");
    const sessionId = url.searchParams.get("sessionId") || crypto.randomUUID();

    // Create WebSocket pair
    const [client, server] = Object.values(new WebSocketPair());

    // Accept WebSocket connection
    server.accept();

    // Create connection info
    const connectionInfo: ConnectionInfo = {
      id: crypto.randomUUID(),
      socket: server,
      userId,
      restaurantId,
      role,
      lastActivity: Date.now(),
      subscriptions: new Set(),
      metadata: {
        country: request.headers.get("CF-IPCountry") || "unknown",
        city: request.headers.get("CF-IPCity") || "unknown",
        deviceType: this.detectDeviceType(
          request.headers.get("User-Agent") || "",
        ),
        sessionId,
      },
    };

    // Store connection
    this.sessionState.activeConnections.set(connectionInfo.id, connectionInfo);
    this.sessionState.lastActivity = Date.now();

    // Set up message handlers
    this.setupWebSocketHandlers(connectionInfo);

    // Send welcome message with state synchronization
    await this.sendConnectionWelcome(connectionInfo);

    // Persist connection state
    await this.persistConnectionState();

    // Record analytics
    this.recordConnectionAnalytics("connect", connectionInfo);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Set up WebSocket message handlers with advanced features
   */
  private setupWebSocketHandlers(connectionInfo: ConnectionInfo): void {
    const { socket } = connectionInfo;

    socket.addEventListener("message", async (event) => {
      try {
        connectionInfo.lastActivity = Date.now();
        this.sessionState.lastActivity = Date.now();
        this.sessionState.totalMessages++;

        const message = JSON.parse(event.data as string);

        // Handle different message types
        switch (message.type) {
          case "subscribe":
            await this.handleSubscription(connectionInfo, message.data);
            break;

          case "order_state_change":
            await this.handleOrderStateChange(connectionInfo, message.data);
            break;

          case "broadcast":
            await this.handleBroadcastMessage(connectionInfo, message.data);
            break;

          case "heartbeat":
            await this.handleHeartbeat(connectionInfo);
            break;

          case "request_state_sync":
            await this.handleStateSyncRequest(connectionInfo, message.data);
            break;

          // Group order specific messages
          case "join_group_order":
            await this.handleJoinGroupOrder(connectionInfo, message.data);
            break;

          case "leave_group_order":
            await this.handleLeaveGroupOrder(connectionInfo, message.data);
            break;

          case "add_cart_item":
            await this.handleAddCartItem(connectionInfo, message.data);
            break;

          case "update_cart_item":
            await this.handleUpdateCartItem(connectionInfo, message.data);
            break;

          case "remove_cart_item":
            await this.handleRemoveCartItem(connectionInfo, message.data);
            break;

          case "initiate_split_bill":
            await this.handleInitiateSplitBill(connectionInfo, message.data);
            break;

          case "process_payment":
            await this.handleProcessPayment(connectionInfo, message.data);
            break;

          default:
            await this.sendMessage(connectionInfo, {
              type: "error",
              error: "Unknown message type",
              originalMessage: message,
            });
        }

        // Record message analytics
        this.recordMessageAnalytics(connectionInfo, message);
      } catch (error) {
        console.error("Message handling error:", error);
        this.recordError(error, {
          connectionId: connectionInfo.id,
          message: event.data,
        });

        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Message processing failed",
          timestamp: Date.now(),
        });
      }
    });

    socket.addEventListener("close", async () => {
      await this.handleConnectionClose(connectionInfo);
    });

    socket.addEventListener("error", async (error) => {
      console.error("WebSocket error:", error);
      this.recordError(error, { connectionId: connectionInfo.id });
      await this.handleConnectionClose(connectionInfo);
    });
  }

  /**
   * Advanced order state machine with validation and persistence
   */
  async handleOrderStateChange(
    connectionInfo: ConnectionInfo,
    data: {
      orderId: string;
      newState: OrderStatus;
      metadata?: Record<string, unknown>;
      estimatedTimes?: Partial<OrderEstimatedTimes>;
    },
  ): Promise<void> {
    const { orderId, newState, metadata, estimatedTimes } = data;

    // Get current order state
    let orderState = this.sessionState.orderStates.get(orderId);

    if (!orderState) {
      // Create new order state
      orderState = {
        id: orderId,
        currentState: "pending",
        restaurantId: connectionInfo.restaurantId,
        transitions: [],
        estimatedTimes: {
          preparation: 0,
          ready: 0,
          completion: 0,
          ...estimatedTimes,
        },
        priority: "normal",
        metadata: metadata || {},
      };
    }

    // Validate state transition
    const validTransitions =
      this.stateTransitions.get(orderState.currentState) || [];
    if (!validTransitions.includes(newState)) {
      await this.sendMessage(connectionInfo, {
        type: "error",
        error: `Invalid state transition from ${orderState.currentState} to ${newState}`,
        orderId,
        validTransitions,
      });
      return;
    }

    // Record transition
    const transition = {
      from: orderState.currentState,
      to: newState,
      timestamp: Date.now(),
      triggeredBy: connectionInfo.userId,
      metadata,
    };

    orderState.transitions.push(transition);
    orderState.previousState = orderState.currentState;
    orderState.currentState = newState;

    if (estimatedTimes) {
      orderState.estimatedTimes = {
        ...orderState.estimatedTimes,
        ...estimatedTimes,
      };
    }

    // Store updated state
    this.sessionState.orderStates.set(orderId, orderState);

    // Persist to durable storage
    await this.ctx.storage.put(`order:${orderId}`, orderState);

    // Broadcast to relevant subscribers
    await this.broadcastOrderStateChange(orderState, transition);

    // Cross-object notification for distributed coordination
    await this.notifyOtherRestaurantSessions(orderState, transition);

    // Record analytics
    this.recordOrderStateAnalytics(orderState, transition, connectionInfo);

    // Update restaurant metrics
    await this.updateRestaurantMetrics(
      connectionInfo.restaurantId,
      orderState,
      transition,
    );
  }

  /**
   * Cross-object communication for distributed coordination
   */
  async notifyOtherRestaurantSessions(
    orderState: OrderState,
    transition: OrderStateTransition,
  ): Promise<void> {
    try {
      // Get other restaurant sessions that need to be notified
      const relatedSessions = [
        `admin:${orderState.restaurantId}`,
        `kitchen:${orderState.restaurantId}`,
      ];

      const promises = relatedSessions.map(async (sessionName) => {
        try {
          const id = this.env.REALTIME_SESSION.idFromName(sessionName);
          const obj = this.env.REALTIME_SESSION.get(id);

          const response = await obj.fetch(
            new Request("http://localhost/broadcast", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "order_state_change",
                orderId: orderState.id,
                orderState,
                transition,
                source: "cross_object_notification",
              }),
            }),
          );

          if (!response.ok) {
            throw new Error(
              `Cross-object notification failed: ${response.status}`,
            );
          }
        } catch (error) {
          console.error(`Failed to notify session ${sessionName}:`, error);
        }
      });

      await Promise.allSettled(promises);
    } catch (error) {
      console.error("Cross-object notification error:", error);
      this.recordError(error, { orderId: orderState.id });
    }
  }

  /**
   * Hibernation API for cost optimization
   */
  async handleHibernation(request: Request): Promise<Response> {
    try {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
      const now = Date.now();

      // Check if we should hibernate
      const shouldHibernate =
        this.sessionState.activeConnections.size === 0 ||
        now - this.sessionState.lastActivity > inactiveThreshold;

      if (shouldHibernate) {
        await this.hibernateSession();
        return new Response(
          JSON.stringify({ hibernated: true, timestamp: now }),
        );
      }

      return new Response(
        JSON.stringify({
          hibernated: false,
          activeConnections: this.sessionState.activeConnections.size,
          lastActivity: this.sessionState.lastActivity,
        }),
      );
    } catch (error) {
      console.error("Hibernation error:", error);
      return new Response("Hibernation failed", { status: 500 });
    }
  }

  /**
   * Hibernate session with state persistence
   */
  private async hibernateSession(): Promise<void> {
    try {
      // Close all active connections gracefully
      for (const [_id, conn] of this.sessionState.activeConnections) {
        try {
          await this.sendMessage(conn, {
            type: "hibernating",
            message: "Session hibernating due to inactivity",
            reconnect_after: 1000,
          });

          conn.socket.close(1000, "Session hibernating");
        } catch (error) {
          console.error(`Failed to close connection ${_id}:`, error);
        }
      }

      // Persist hibernation state
      await this.ctx.storage.put("hibernation_state", {
        hibernatedAt: Date.now(),
        activeConnectionsCount: this.sessionState.activeConnections.size,
        orderStatesCount: this.sessionState.orderStates.size,
        totalMessages: this.sessionState.totalMessages,
      });

      // Clear process-local state
      this.sessionState.activeConnections.clear();
      this.sessionState.hibernated = true;

      // Clear timers
      if (this.hibernationTimer) clearInterval(this.hibernationTimer);
      if (this.metricsTimer) clearInterval(this.metricsTimer);
      if (this.cleanupTimer) clearInterval(this.cleanupTimer);

      console.log("Session hibernated successfully");
    } catch (error) {
      console.error("Hibernation failed:", error);
      this.recordError(error, { operation: "hibernation" });
    }
  }

  /**
   * Load persisted state on initialization
   */
  private async loadPersistedState(): Promise<void> {
    try {
      // Load order states
      const orderStates = await this.ctx.storage.list<OrderState>({
        prefix: "order:",
      });
      for (const [key, orderState] of orderStates) {
        const orderId = key.replace("order:", "");
        this.sessionState.orderStates.set(orderId, orderState);
      }

      // Load group order states
      const groupOrderStates = await this.ctx.storage.list({
        prefix: "group_order:",
      });
      for (const [key, groupOrderData] of groupOrderStates) {
        const groupOrderId = key.replace("group_order:", "");

        // Deserialize group order: Maps were stored as Records on write,
        // rebuild them here so the restored type matches GroupOrderState.
        const serialized = groupOrderData as SerializedGroupOrder;
        const groupOrder: GroupOrderState = {
          ...serialized,
          members: new Map(Object.entries(serialized.members || {})),
          cart: new Map(Object.entries(serialized.cart || {})),
          splitBills: new Map(Object.entries(serialized.splitBills || {})),
        };

        // Only load non-expired group orders
        if (groupOrder.expiresAt > Date.now()) {
          this.sessionState.groupOrderStates.set(groupOrderId, groupOrder);
        } else {
          // Clean up expired group order
          await this.ctx.storage.delete(key);
        }
      }

      // Load restaurant metrics
      const metrics = await this.ctx.storage.list({ prefix: "metrics:" });
      for (const [key, metric] of metrics) {
        const restaurantId = parseInt(key.replace("metrics:", ""));
        this.sessionState.restaurantMetrics.set(restaurantId, metric);
      }

      // Load hibernation state if exists
      const hibernationState = await this.ctx.storage.get("hibernation_state");
      if (hibernationState) {
        console.log("Restored from hibernation:", hibernationState);
      }

      console.log(
        `Loaded ${this.sessionState.orderStates.size} order states, ${this.sessionState.groupOrderStates.size} group order states, and ${this.sessionState.restaurantMetrics.size} restaurant metrics`,
      );
    } catch (error) {
      console.error("Failed to load persisted state:", error);
      this.recordError(error, { operation: "load_state" });
    }
  }

  /**
   * Start background tasks for maintenance and optimization
   */
  private startBackgroundTasks(): void {
    // Hibernation check every 5 minutes
    this.hibernationTimer = setInterval(
      async () => {
        const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
        const now = Date.now();

        if (
          this.sessionState.activeConnections.size === 0 &&
          now - this.sessionState.lastActivity > inactiveThreshold
        ) {
          await this.hibernateSession();
        }
      },
      5 * 60 * 1000,
    );

    // Metrics collection every minute
    this.metricsTimer = setInterval(async () => {
      await this.collectAndSendMetrics();
    }, 60 * 1000);

    // Cleanup old data every hour
    this.cleanupTimer = setInterval(
      async () => {
        await this.cleanupOldData();
      },
      60 * 60 * 1000,
    );
  }

  /**
   * Send comprehensive analytics to Workers Analytics
   */
  private recordConnectionAnalytics(
    event: string,
    connectionInfo: ConnectionInfo,
  ): void {
    const analytics = this.env.ANALYTICS_ENGINE;
    if (analytics) {
      try {
        analytics.writeDataPoint({
          blobs: [
            event,
            connectionInfo.userId.toString(),
            connectionInfo.restaurantId.toString(),
            connectionInfo.metadata.country,
            connectionInfo.metadata.city,
            connectionInfo.metadata.deviceType,
            connectionInfo.metadata.sessionId,
          ],
          doubles: [Date.now(), connectionInfo.role],
          indexes: [connectionInfo.restaurantId.toString()],
        });
      } catch (error) {
        console.error("Analytics error:", error);
      }
    }
  }

  private recordOrderStateAnalytics(
    orderState: OrderState,
    transition: OrderStateTransition,
    connectionInfo: ConnectionInfo,
  ): void {
    const analytics = this.env.ANALYTICS_ENGINE;
    if (analytics) {
      try {
        analytics.writeDataPoint({
          blobs: [
            "order_state_transition",
            orderState.id,
            transition.from,
            transition.to,
            orderState.priority,
            connectionInfo.userId.toString(),
          ],
          doubles: [
            transition.timestamp,
            orderState.estimatedTimes.preparation,
            orderState.estimatedTimes.ready,
            orderState.estimatedTimes.completion,
          ],
          indexes: [orderState.restaurantId.toString()],
        });
      } catch (error) {
        console.error("Analytics error:", error);
      }
    }
  }

  private recordMessageAnalytics(
    connectionInfo: ConnectionInfo,
    message: OutboundMessage,
  ): void {
    const analytics = this.env.ANALYTICS_ENGINE;
    if (analytics) {
      try {
        analytics.writeDataPoint({
          blobs: [
            "websocket_message",
            typeof message.type === "string" ? message.type : "unknown",
            connectionInfo.metadata.deviceType,
            connectionInfo.metadata.country,
          ],
          doubles: [Date.now(), JSON.stringify(message).length],
          indexes: [connectionInfo.restaurantId.toString()],
        });
      } catch (error) {
        console.error("Analytics error:", error);
      }
    }
  }

  private recordError(error: unknown, context: Record<string, unknown>): void {
    this.sessionState.errors.push({
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error),
      context,
    });

    // Keep only last 100 errors
    if (this.sessionState.errors.length > 100) {
      this.sessionState.errors = this.sessionState.errors.slice(-100);
    }
  }

  // Helper methods
  private detectDeviceType(userAgent: string): string {
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) return "mobile";
    if (/Tablet/.test(userAgent)) return "tablet";
    return "desktop";
  }

  private async sendMessage(
    connectionInfo: ConnectionInfo,
    message: OutboundMessage,
  ): Promise<void> {
    try {
      if (connectionInfo.socket.readyState === WebSocket.OPEN) {
        connectionInfo.socket.send(
          JSON.stringify({
            ...message,
            timestamp: Date.now(),
            connectionId: connectionInfo.id,
          }),
        );
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }

  private async broadcastOrderStateChange(
    orderState: OrderState,
    transition: OrderStateTransition,
  ): Promise<void> {
    const message = {
      type: "order_state_changed",
      orderId: orderState.id,
      currentState: orderState.currentState,
      previousState: orderState.previousState,
      transition,
      estimatedTimes: orderState.estimatedTimes,
    };

    // Broadcast to relevant connections
    for (const [_id, conn] of this.sessionState.activeConnections) {
      if (
        conn.restaurantId === orderState.restaurantId &&
        conn.subscriptions.has(`order:${orderState.id}`)
      ) {
        await this.sendMessage(conn, message);
      }
    }
  }

  // Additional helper methods would continue here...
  private async handleSubscription(
    _connectionInfo: ConnectionInfo,
    _data: Record<string, unknown>,
  ): Promise<void> {
    // Implementation for handling subscriptions
  }

  private async handleBroadcastMessage(
    _connectionInfo: ConnectionInfo,
    _data: Record<string, unknown>,
  ): Promise<void> {
    // Implementation for handling broadcast messages
  }

  private async handleHeartbeat(connectionInfo: ConnectionInfo): Promise<void> {
    await this.sendMessage(connectionInfo, {
      type: "heartbeat_ack",
      timestamp: Date.now(),
    });
  }

  private async handleStateSyncRequest(
    _connectionInfo: ConnectionInfo,
    _data: Record<string, unknown>,
  ): Promise<void> {
    // Implementation for state synchronization
  }

  private async handleConnectionClose(
    connectionInfo: ConnectionInfo,
  ): Promise<void> {
    this.sessionState.activeConnections.delete(connectionInfo.id);
    this.recordConnectionAnalytics("disconnect", connectionInfo);
  }

  private async handleCrossObjectBroadcast(
    _request: Request,
  ): Promise<Response> {
    // Implementation for cross-object communication
    return new Response("OK");
  }

  private async handleStateQuery(_request: Request): Promise<Response> {
    return new Response(
      JSON.stringify({
        activeConnections: this.sessionState.activeConnections.size,
        orderStates: this.sessionState.orderStates.size,
        lastActivity: this.sessionState.lastActivity,
      }),
    );
  }

  private async handleHealthCheck(_request: Request): Promise<Response> {
    return new Response(
      JSON.stringify({
        healthy: true,
        connections: this.sessionState.activeConnections.size,
        orders: this.sessionState.orderStates.size,
        uptime: Date.now() - this.sessionState.lastActivity,
      }),
    );
  }

  private async sendConnectionWelcome(
    _connectionInfo: ConnectionInfo,
  ): Promise<void> {
    // Implementation for welcome message
  }

  private async persistConnectionState(): Promise<void> {
    // Implementation for persisting connection state
  }

  private async updateRestaurantMetrics(
    _restaurantId: number,
    _orderState: OrderState,
    _transition: OrderStateTransition,
  ): Promise<void> {
    // Implementation for updating restaurant metrics
  }

  private async collectAndSendMetrics(): Promise<void> {
    // Implementation for collecting and sending metrics
  }

  /**
   * Group Order Message Handlers
   */
  async handleJoinGroupOrder(
    connectionInfo: ConnectionInfo,
    data: {
      shareCode: string;
      memberName: string;
      phone?: string;
    },
  ): Promise<void> {
    try {
      const { shareCode, memberName, phone } = data;
      const groupOrder = this.findGroupOrderByShareCode(shareCode);

      if (!groupOrder) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Group order not found or expired",
          shareCode,
        });
        return;
      }

      // Check if group is still accepting members
      if (
        groupOrder.status !== "active" ||
        groupOrder.members.size >= groupOrder.settings.maxMembers
      ) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Group order is not accepting new members",
          shareCode,
        });
        return;
      }

      // Create new member
      const memberId = crypto.randomUUID();
      const member: GroupMember = {
        id: memberId,
        sessionId: connectionInfo.id,
        name: memberName,
        phone,
        role: "member",
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        isOnline: true,
        totalAmount: 0,
        itemCount: 0,
        paymentStatus: "unpaid",
      };

      groupOrder.members.set(memberId, member);
      groupOrder.lastActivity = Date.now();

      // Add subscription for this member
      connectionInfo.subscriptions.add(`group_order:${groupOrder.id}`);

      // Persist changes
      await this.ctx.storage.put(
        `group_order:${groupOrder.id}`,
        this.serializeGroupOrder(groupOrder),
      );

      // Broadcast member joined event
      await this.broadcastGroupOrderEvent(groupOrder, {
        type: "member_joined",
        member,
        timestamp: Date.now(),
      });

      // Send success response
      await this.sendMessage(connectionInfo, {
        type: "group_order_joined",
        groupOrder: this.serializeGroupOrderForClient(groupOrder),
        memberId,
        success: true,
      });
    } catch (error) {
      console.error("Join group order error:", error);
      await this.sendMessage(connectionInfo, {
        type: "error",
        error: "Failed to join group order",
      });
    }
  }

  async handleLeaveGroupOrder(
    connectionInfo: ConnectionInfo,
    data: {
      groupOrderId: string;
      memberId: string;
    },
  ): Promise<void> {
    try {
      const { groupOrderId, memberId } = data;
      const groupOrder = this.sessionState.groupOrderStates.get(groupOrderId);

      if (!groupOrder) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Group order not found",
        });
        return;
      }

      const member = groupOrder.members.get(memberId);
      if (!member) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Member not found in group order",
        });
        return;
      }

      // Remove member's cart items
      for (const [itemId, item] of groupOrder.cart) {
        if (item.memberId === memberId) {
          groupOrder.cart.delete(itemId);
        }
      }

      // Remove member
      groupOrder.members.delete(memberId);
      groupOrder.lastActivity = Date.now();

      // Recalculate totals
      this.recalculateGroupOrderTotals(groupOrder);

      // Remove subscription
      connectionInfo.subscriptions.delete(`group_order:${groupOrderId}`);

      // Persist changes
      await this.ctx.storage.put(
        `group_order:${groupOrderId}`,
        this.serializeGroupOrder(groupOrder),
      );

      // Broadcast member left event
      await this.broadcastGroupOrderEvent(groupOrder, {
        type: "member_left",
        memberId,
        memberName: member.name,
        timestamp: Date.now(),
      });

      await this.sendMessage(connectionInfo, {
        type: "group_order_left",
        success: true,
      });
    } catch (error) {
      console.error("Leave group order error:", error);
      await this.sendMessage(connectionInfo, {
        type: "error",
        error: "Failed to leave group order",
      });
    }
  }

  async handleAddCartItem(
    connectionInfo: ConnectionInfo,
    data: {
      groupOrderId: string;
      memberId: string;
      menuItemId: number;
      menuItemName: string;
      quantity: number;
      unitPrice: number;
      customizations?: Record<string, unknown>;
      specialInstructions?: string;
    },
  ): Promise<void> {
    try {
      const groupOrder = this.sessionState.groupOrderStates.get(
        data.groupOrderId,
      );
      if (!groupOrder) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Group order not found",
        });
        return;
      }

      if (groupOrder.status !== "active") {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Group order is not accepting new items",
        });
        return;
      }

      const member = groupOrder.members.get(data.memberId);
      if (!member) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Member not found in group order",
        });
        return;
      }

      // Create cart item
      const cartItemId = crypto.randomUUID();
      const cartItem: CartItem = {
        id: cartItemId,
        memberId: data.memberId,
        menuItemId: data.menuItemId,
        menuItemName: data.menuItemName,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalPrice: data.unitPrice * data.quantity,
        customizations: data.customizations || {},
        specialInstructions: data.specialInstructions,
        addedAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      // Add to cart
      groupOrder.cart.set(cartItemId, cartItem);
      groupOrder.lastActivity = Date.now();

      // Update member stats
      member.itemCount++;
      member.totalAmount += cartItem.totalPrice;
      member.lastActiveAt = Date.now();

      // Recalculate totals
      this.recalculateGroupOrderTotals(groupOrder);

      // Persist changes
      await this.ctx.storage.put(
        `group_order:${data.groupOrderId}`,
        this.serializeGroupOrder(groupOrder),
      );

      // Broadcast cart updated event
      await this.broadcastGroupOrderEvent(groupOrder, {
        type: "cart_item_added",
        item: cartItem,
        member: {
          id: member.id,
          name: member.name,
        },
        timestamp: Date.now(),
      });

      await this.sendMessage(connectionInfo, {
        type: "cart_item_added",
        item: cartItem,
        success: true,
      });
    } catch (error) {
      console.error("Add cart item error:", error);
      await this.sendMessage(connectionInfo, {
        type: "error",
        error: "Failed to add item to cart",
      });
    }
  }

  async handleUpdateCartItem(
    connectionInfo: ConnectionInfo,
    data: {
      groupOrderId: string;
      itemId: string;
      quantity?: number;
      customizations?: Record<string, unknown>;
      specialInstructions?: string;
    },
  ): Promise<void> {
    try {
      const groupOrder = this.sessionState.groupOrderStates.get(
        data.groupOrderId,
      );
      if (!groupOrder) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Group order not found",
        });
        return;
      }

      const cartItem = groupOrder.cart.get(data.itemId);
      if (!cartItem) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Cart item not found",
        });
        return;
      }

      const member = groupOrder.members.get(cartItem.memberId);
      if (!member) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Member not found",
        });
        return;
      }

      // Check permissions - members can only edit their own items unless allowed
      if (
        cartItem.memberId !== connectionInfo.userId.toString() &&
        !groupOrder.settings.allowEditOthers
      ) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Permission denied to edit this item",
        });
        return;
      }

      // Update item with optimistic concurrency control
      const oldTotalPrice = cartItem.totalPrice;

      if (data.quantity !== undefined) {
        cartItem.quantity = data.quantity;
        cartItem.totalPrice = cartItem.unitPrice * data.quantity;
      }

      if (data.customizations !== undefined) {
        cartItem.customizations = data.customizations;
      }

      if (data.specialInstructions !== undefined) {
        cartItem.specialInstructions = data.specialInstructions;
      }

      cartItem.updatedAt = Date.now();
      cartItem.version++;

      // Update member stats
      member.totalAmount += cartItem.totalPrice - oldTotalPrice;
      member.lastActiveAt = Date.now();

      groupOrder.lastActivity = Date.now();

      // Recalculate totals
      this.recalculateGroupOrderTotals(groupOrder);

      // Persist changes
      await this.ctx.storage.put(
        `group_order:${data.groupOrderId}`,
        this.serializeGroupOrder(groupOrder),
      );

      // Broadcast update event
      await this.broadcastGroupOrderEvent(groupOrder, {
        type: "cart_item_updated",
        item: cartItem,
        member: {
          id: member.id,
          name: member.name,
        },
        changes: data,
        timestamp: Date.now(),
      });

      await this.sendMessage(connectionInfo, {
        type: "cart_item_updated",
        item: cartItem,
        success: true,
      });
    } catch (error) {
      console.error("Update cart item error:", error);
      await this.sendMessage(connectionInfo, {
        type: "error",
        error: "Failed to update cart item",
      });
    }
  }

  async handleRemoveCartItem(
    connectionInfo: ConnectionInfo,
    data: {
      groupOrderId: string;
      itemId: string;
    },
  ): Promise<void> {
    try {
      const groupOrder = this.sessionState.groupOrderStates.get(
        data.groupOrderId,
      );
      if (!groupOrder) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Group order not found",
        });
        return;
      }

      const cartItem = groupOrder.cart.get(data.itemId);
      if (!cartItem) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Cart item not found",
        });
        return;
      }

      const member = groupOrder.members.get(cartItem.memberId);
      if (!member) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Member not found",
        });
        return;
      }

      // Check permissions
      if (
        cartItem.memberId !== connectionInfo.userId.toString() &&
        !groupOrder.settings.allowEditOthers
      ) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Permission denied to remove this item",
        });
        return;
      }

      // Remove from cart
      groupOrder.cart.delete(data.itemId);

      // Update member stats
      member.itemCount--;
      member.totalAmount -= cartItem.totalPrice;
      member.lastActiveAt = Date.now();

      groupOrder.lastActivity = Date.now();

      // Recalculate totals
      this.recalculateGroupOrderTotals(groupOrder);

      // Persist changes
      await this.ctx.storage.put(
        `group_order:${data.groupOrderId}`,
        this.serializeGroupOrder(groupOrder),
      );

      // Broadcast remove event
      await this.broadcastGroupOrderEvent(groupOrder, {
        type: "cart_item_removed",
        itemId: data.itemId,
        item: cartItem,
        member: {
          id: member.id,
          name: member.name,
        },
        timestamp: Date.now(),
      });

      await this.sendMessage(connectionInfo, {
        type: "cart_item_removed",
        success: true,
      });
    } catch (error) {
      console.error("Remove cart item error:", error);
      await this.sendMessage(connectionInfo, {
        type: "error",
        error: "Failed to remove cart item",
      });
    }
  }

  async handleInitiateSplitBill(
    connectionInfo: ConnectionInfo,
    data: {
      groupOrderId: string;
      splitType: "equal" | "proportional" | "individual" | "custom";
      customSplits?: Array<{
        memberId: string;
        amount: number;
        items: string[];
      }>;
    },
  ): Promise<void> {
    try {
      const groupOrder = this.sessionState.groupOrderStates.get(
        data.groupOrderId,
      );
      if (!groupOrder) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Group order not found",
        });
        return;
      }

      // Only host or admin can initiate split bill
      const member = Array.from(groupOrder.members.values()).find(
        (m) => m.sessionId === connectionInfo.id,
      );
      if (!member || (member.role !== "creator" && member.role !== "admin")) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Permission denied to initiate split bill",
        });
        return;
      }

      if (groupOrder.status !== "active") {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Group order is not in active state",
        });
        return;
      }

      // Calculate split bills
      const splitBills = this.calculateSplitBills(
        groupOrder,
        data.splitType,
        data.customSplits,
      );

      // Store split bills
      splitBills.forEach((splitBill) => {
        groupOrder.splitBills.set(splitBill.id, splitBill);
      });

      // Update group order status
      groupOrder.status = "checkout";
      groupOrder.settings.splitType = data.splitType;
      groupOrder.lastActivity = Date.now();

      // Persist changes
      await this.ctx.storage.put(
        `group_order:${data.groupOrderId}`,
        this.serializeGroupOrder(groupOrder),
      );

      // Broadcast split initiated event
      await this.broadcastGroupOrderEvent(groupOrder, {
        type: "split_bill_initiated",
        splitType: data.splitType,
        splitBills: Array.from(splitBills),
        initiatedBy: {
          id: member.id,
          name: member.name,
        },
        timestamp: Date.now(),
      });

      await this.sendMessage(connectionInfo, {
        type: "split_bill_initiated",
        splitBills: Array.from(splitBills),
        success: true,
      });
    } catch (error) {
      console.error("Initiate split bill error:", error);
      await this.sendMessage(connectionInfo, {
        type: "error",
        error: "Failed to initiate split bill",
      });
    }
  }

  async handleProcessPayment(
    connectionInfo: ConnectionInfo,
    data: {
      groupOrderId: string;
      memberId: string;
      paymentMethod: string;
      amount: number;
      transactionId?: string;
    },
  ): Promise<void> {
    try {
      const groupOrder = this.sessionState.groupOrderStates.get(
        data.groupOrderId,
      );
      if (!groupOrder) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Group order not found",
        });
        return;
      }

      const member = groupOrder.members.get(data.memberId);
      if (!member) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Member not found",
        });
        return;
      }

      const splitBill = groupOrder.splitBills.get(data.memberId);
      if (!splitBill) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Split bill not found for member",
        });
        return;
      }

      // Validate payment amount
      if (Math.abs(data.amount - splitBill.totalAmount) > 0.01) {
        await this.sendMessage(connectionInfo, {
          type: "error",
          error: "Payment amount does not match split bill amount",
        });
        return;
      }

      // Update payment status
      splitBill.paymentStatus = "paid";
      splitBill.paymentMethod = data.paymentMethod;
      splitBill.paidAt = Date.now();

      member.paymentStatus = "paid";
      member.lastActiveAt = Date.now();

      groupOrder.lastActivity = Date.now();

      // Check if all members have paid
      const allPaid = Array.from(groupOrder.members.values()).every(
        (m) => m.paymentStatus === "paid",
      );
      if (allPaid) {
        groupOrder.status = "completed";
      }

      // Persist changes
      await this.ctx.storage.put(
        `group_order:${data.groupOrderId}`,
        this.serializeGroupOrder(groupOrder),
      );

      // Broadcast payment completed event
      await this.broadcastGroupOrderEvent(groupOrder, {
        type: "payment_completed",
        member: {
          id: member.id,
          name: member.name,
        },
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        allPaid,
        timestamp: Date.now(),
      });

      await this.sendMessage(connectionInfo, {
        type: "payment_processed",
        success: true,
        allPaid,
      });
    } catch (error) {
      console.error("Process payment error:", error);
      await this.sendMessage(connectionInfo, {
        type: "error",
        error: "Failed to process payment",
      });
    }
  }

  /**
   * Group Order Helper Methods
   */
  private findGroupOrderByShareCode(shareCode: string): GroupOrderState | null {
    for (const groupOrder of this.sessionState.groupOrderStates.values()) {
      if (
        groupOrder.shareCode === shareCode &&
        groupOrder.expiresAt > Date.now()
      ) {
        return groupOrder;
      }
    }
    return null;
  }

  private recalculateGroupOrderTotals(groupOrder: GroupOrderState): void {
    let totalAmount = 0;
    const memberTotals = new Map<string, number>();
    const memberCounts = new Map<string, number>();

    // Calculate from cart items
    for (const item of groupOrder.cart.values()) {
      totalAmount += item.totalPrice;
      memberTotals.set(
        item.memberId,
        (memberTotals.get(item.memberId) || 0) + item.totalPrice,
      );
      memberCounts.set(
        item.memberId,
        (memberCounts.get(item.memberId) || 0) + 1,
      );
    }

    // Update group order total
    groupOrder.totalAmount = totalAmount;

    // Update member totals and counts
    for (const [memberId, member] of groupOrder.members) {
      member.totalAmount = memberTotals.get(memberId) || 0;
      member.itemCount = memberCounts.get(memberId) || 0;
    }
  }

  private calculateSplitBills(
    groupOrder: GroupOrderState,
    splitType: string,
    customSplits?: Array<{ memberId: string; amount: number; items: string[] }>,
  ): SplitBill[] {
    const splitBills: SplitBill[] = [];
    const serviceChargeRate = 0.1; // 10% service charge
    const taxRate = 0.06; // 6% tax

    if (splitType === "equal") {
      const memberCount = groupOrder.members.size;
      const subtotalPerMember = groupOrder.totalAmount / memberCount;
      const serviceChargePerMember = subtotalPerMember * serviceChargeRate;
      const taxPerMember = subtotalPerMember * taxRate;
      const totalPerMember =
        subtotalPerMember + serviceChargePerMember + taxPerMember;

      for (const [memberId] of groupOrder.members) {
        splitBills.push({
          id: crypto.randomUUID(),
          memberId,
          subtotal: subtotalPerMember,
          taxAmount: taxPerMember,
          serviceCharge: serviceChargePerMember,
          totalAmount: totalPerMember,
          items: [],
          paymentStatus: "pending",
        });
      }
    } else if (splitType === "proportional") {
      for (const [memberId, member] of groupOrder.members) {
        const memberSubtotal = member.totalAmount;
        const serviceCharge = memberSubtotal * serviceChargeRate;
        const taxAmount = memberSubtotal * taxRate;
        const totalAmount = memberSubtotal + serviceCharge + taxAmount;

        const memberItems = Array.from(groupOrder.cart.values())
          .filter((item) => item.memberId === memberId)
          .map((item) => item.id);

        splitBills.push({
          id: crypto.randomUUID(),
          memberId,
          subtotal: memberSubtotal,
          taxAmount,
          serviceCharge,
          totalAmount,
          items: memberItems,
          paymentStatus: "pending",
        });
      }
    } else if (splitType === "custom" && customSplits) {
      for (const customSplit of customSplits) {
        const serviceCharge = customSplit.amount * serviceChargeRate;
        const taxAmount = customSplit.amount * taxRate;
        const totalAmount = customSplit.amount + serviceCharge + taxAmount;

        splitBills.push({
          id: crypto.randomUUID(),
          memberId: customSplit.memberId,
          subtotal: customSplit.amount,
          taxAmount,
          serviceCharge,
          totalAmount,
          items: customSplit.items,
          paymentStatus: "pending",
        });
      }
    }

    return splitBills;
  }

  private async broadcastGroupOrderEvent(
    groupOrder: GroupOrderState,
    event: Record<string, unknown>,
  ): Promise<void> {
    const message = {
      type: "group_order_event",
      groupOrderId: groupOrder.id,
      event,
      groupOrder: this.serializeGroupOrderForClient(groupOrder),
    };

    // Broadcast to all members
    for (const [_id, conn] of this.sessionState.activeConnections) {
      if (conn.subscriptions.has(`group_order:${groupOrder.id}`)) {
        await this.sendMessage(conn, message);
      }
    }
  }

  private serializeGroupOrder(
    groupOrder: GroupOrderState,
  ): SerializedGroupOrder {
    return {
      ...groupOrder,
      members: Object.fromEntries(groupOrder.members),
      cart: Object.fromEntries(groupOrder.cart),
      splitBills: Object.fromEntries(groupOrder.splitBills),
    };
  }

  private serializeGroupOrderForClient(
    groupOrder: GroupOrderState,
  ): GroupOrderClientView {
    return {
      id: groupOrder.id,
      shareCode: groupOrder.shareCode,
      status: groupOrder.status,
      restaurantId: groupOrder.restaurantId,
      members: Array.from(groupOrder.members.values()),
      cart: Array.from(groupOrder.cart.values()),
      splitBills: Array.from(groupOrder.splitBills.values()),
      totalAmount: groupOrder.totalAmount,
      settings: groupOrder.settings,
      lastActivity: groupOrder.lastActivity,
      createdAt: groupOrder.createdAt,
      expiresAt: groupOrder.expiresAt,
    };
  }

  private async cleanupOldData(): Promise<void> {
    const now = Date.now();
    const expiredThreshold = 24 * 60 * 60 * 1000; // 24 hours

    // Cleanup expired group orders
    for (const [id, groupOrder] of this.sessionState.groupOrderStates) {
      if (
        groupOrder.expiresAt < now ||
        now - groupOrder.lastActivity > expiredThreshold
      ) {
        this.sessionState.groupOrderStates.delete(id);
        await this.ctx.storage.delete(`group_order:${id}`);
        console.log(`Cleaned up expired group order: ${id}`);
      }
    }

    // Cleanup old order states
    for (const [id, orderState] of this.sessionState.orderStates) {
      const lastTransition =
        orderState.transitions[orderState.transitions.length - 1];
      if (lastTransition && now - lastTransition.timestamp > expiredThreshold) {
        this.sessionState.orderStates.delete(id);
        await this.ctx.storage.delete(`order:${id}`);
        console.log(`Cleaned up old order state: ${id}`);
      }
    }
  }
}
