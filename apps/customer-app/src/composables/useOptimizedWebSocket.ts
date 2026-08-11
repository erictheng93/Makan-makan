/**
 * Optimized WebSocket Connection Manager
 *
 * Improvements over basic implementation:
 * 1. Connection pooling - Share connections across components
 * 2. Exponential backoff - Prevent reconnection storms
 * 3. Message queuing - Buffer messages during disconnection
 * 4. Visibility API integration - Pause when tab is hidden
 * 5. Memory leak prevention - Automatic cleanup
 * 6. Circuit breaker pattern - Fail fast after repeated failures
 */

import { ref, onMounted, onUnmounted, type Ref } from "vue";
import type { WebSocketMessage } from "@makanmasak/shared-types";

export interface OptimizedWSOptions {
  url: string;
  protocols?: string | string[];
  reconnectAttempts?: number;
  minReconnectDelay?: number;
  maxReconnectDelay?: number;
  heartbeatInterval?: number;
  messageQueueSize?: number;
  enableVisibilityPause?: boolean;
  circuitBreakerThreshold?: number;
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
}

interface QueuedMessage {
  data: any;
  timestamp: number;
  retries: number;
}

interface ConnectionMetrics {
  totalConnections: number;
  totalReconnections: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  totalErrors: number;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  averageLatency: number;
}

class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private threshold: number,
    private resetTimeout: number = 30000,
  ) {}

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = "open";
      setTimeout(() => {
        this.state = "half-open";
      }, this.resetTimeout);
    }
  }

  canAttempt(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "half-open") return true;
    return false; // open state
  }

  getState(): string {
    return this.state;
  }
}

// Global connection pool to share connections
const connectionPool = new Map<string, WebSocket>();
const connectionSubscribers = new Map<string, Set<string>>();

export function useOptimizedWebSocket(options: OptimizedWSOptions) {
  const {
    url,
    protocols,
    reconnectAttempts = 10,
    minReconnectDelay = 1000,
    maxReconnectDelay = 30000,
    heartbeatInterval = 30000,
    messageQueueSize = 100,
    enableVisibilityPause = true,
    circuitBreakerThreshold = 5,
    onMessage,
    onError,
    onOpen,
    onClose,
  } = options;

  // State
  const ws = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const lastError = ref<Event | null>(null);
  const reconnectCount = ref(0);
  const messageQueue = ref<QueuedMessage[]>([]);
  const metrics = ref<ConnectionMetrics>({
    totalConnections: 0,
    totalReconnections: 0,
    totalMessagesSent: 0,
    totalMessagesReceived: 0,
    totalErrors: 0,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    averageLatency: 0,
  });

  // Timers
  let reconnectTimer: NodeJS.Timeout | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let queueProcessTimer: NodeJS.Timeout | null = null;
  const subscriberId = crypto.randomUUID();

  // Circuit breaker
  const circuitBreaker = new CircuitBreaker(circuitBreakerThreshold);

  // Visibility API - Pause connections when tab is hidden
  const isTabVisible = ref(true);
  let visibilityHandler: (() => void) | null = null;

  /**
   * Calculate exponential backoff delay
   */
  const getReconnectDelay = (): number => {
    const exponentialDelay = Math.min(
      minReconnectDelay * Math.pow(2, reconnectCount.value),
      maxReconnectDelay,
    );
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  };

  /**
   * Connect to WebSocket with connection pooling
   */
  const connect = () => {
    if (!circuitBreaker.canAttempt()) {
      console.warn("Circuit breaker is open, skipping connection attempt");
      return;
    }

    if (isConnecting.value || isConnected.value) {
      return;
    }

    // Check if connection already exists in pool
    const existingConnection = connectionPool.get(url);
    if (
      existingConnection &&
      existingConnection.readyState === WebSocket.OPEN
    ) {
      ws.value = existingConnection;
      isConnected.value = true;
      registerSubscriber();
      return;
    }

    isConnecting.value = true;
    lastError.value = null;

    try {
      const socket = new WebSocket(url, protocols);
      ws.value = socket;

      socket.onopen = (event) => {
        isConnected.value = true;
        isConnecting.value = false;
        reconnectCount.value = 0;
        metrics.value.totalConnections++;
        metrics.value.lastConnectedAt = Date.now();

        // Add to connection pool
        connectionPool.set(url, socket);
        registerSubscriber();

        // Start heartbeat
        startHeartbeat();

        // Process queued messages
        processMessageQueue();

        // Record success in circuit breaker
        circuitBreaker.recordSuccess();

        onOpen?.(event);
        console.log("[WS] Connected:", url);
      };

      socket.onmessage = (event) => {
        if (event.data === "pong") {
          return;
        }

        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          metrics.value.totalMessagesReceived++;

          // Handle pong
          if (data.type === "pong") {
            return;
          }

          onMessage?.(data);
        } catch (error) {
          console.error("[WS] Failed to parse message:", error);
        }
      };

      socket.onclose = (event) => {
        isConnected.value = false;
        isConnecting.value = false;
        metrics.value.lastDisconnectedAt = Date.now();

        stopHeartbeat();
        unregisterSubscriber();

        // Remove from pool if this is the pooled connection
        if (connectionPool.get(url) === socket) {
          connectionPool.delete(url);
        }

        onClose?.(event);

        // Reconnect if not clean close
        if (!event.wasClean && reconnectCount.value < reconnectAttempts) {
          if (isTabVisible.value || !enableVisibilityPause) {
            scheduleReconnect();
          }
        }

        console.log("[WS] Disconnected:", event.code, event.reason);
      };

      socket.onerror = (event) => {
        lastError.value = event;
        isConnecting.value = false;
        metrics.value.totalErrors++;

        circuitBreaker.recordFailure();

        onError?.(event);
        console.error("[WS] Error:", event);
      };
    } catch (error) {
      isConnecting.value = false;
      metrics.value.totalErrors++;
      circuitBreaker.recordFailure();
      console.error("[WS] Connection creation failed:", error);
    }
  };

  /**
   * Disconnect WebSocket
   */
  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    stopHeartbeat();
    stopQueueProcessing();
    unregisterSubscriber();

    // Only close if this is the last subscriber
    const subscribers = connectionSubscribers.get(url);
    if (subscribers && subscribers.size === 0) {
      if (ws.value) {
        ws.value.close(1000, "Manual disconnect");
        connectionPool.delete(url);
      }
    }

    ws.value = null;
    isConnected.value = false;
    isConnecting.value = false;
    reconnectCount.value = 0;
  };

  /**
   * Send message with queuing support
   */
  const send = (data: any, priority = false): boolean => {
    const message = typeof data === "string" ? data : JSON.stringify(data);

    if (ws.value?.readyState === WebSocket.OPEN) {
      try {
        ws.value.send(message);
        metrics.value.totalMessagesSent++;
        return true;
      } catch (error) {
        console.error("[WS] Send failed:", error);
        queueMessage(data, priority);
        return false;
      }
    } else {
      queueMessage(data, priority);
      return false;
    }
  };

  /**
   * Queue message for later delivery
   */
  const queueMessage = (data: any, priority = false) => {
    const queuedMsg: QueuedMessage = {
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    if (priority) {
      messageQueue.value.unshift(queuedMsg);
    } else {
      messageQueue.value.push(queuedMsg);
    }

    // Limit queue size
    if (messageQueue.value.length > messageQueueSize) {
      messageQueue.value.shift();
    }
  };

  /**
   * Process queued messages
   */
  const processMessageQueue = () => {
    if (queueProcessTimer) {
      clearInterval(queueProcessTimer);
    }

    queueProcessTimer = setInterval(() => {
      if (!isConnected.value || messageQueue.value.length === 0) {
        return;
      }

      const msg = messageQueue.value.shift();
      if (msg) {
        const sent = send(msg.data);
        if (!sent) {
          msg.retries++;
          if (msg.retries < 3) {
            messageQueue.value.unshift(msg);
          }
        }
      }
    }, 100);
  };

  /**
   * Stop queue processing
   */
  const stopQueueProcessing = () => {
    if (queueProcessTimer) {
      clearInterval(queueProcessTimer);
      queueProcessTimer = null;
    }
  };

  /**
   * Schedule reconnection with exponential backoff
   */
  const scheduleReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }

    reconnectCount.value++;
    metrics.value.totalReconnections++;

    const delay = getReconnectDelay();
    console.log(
      `[WS] Reconnecting in ${delay}ms (attempt ${reconnectCount.value}/${reconnectAttempts})`,
    );

    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  };

  /**
   * Start heartbeat
   */
  const startHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }

    heartbeatTimer = setInterval(() => {
      if (ws.value?.readyState === WebSocket.OPEN) {
        send("ping");
      }
    }, heartbeatInterval);
  };

  /**
   * Stop heartbeat
   */
  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  /**
   * Register this component as a subscriber
   */
  const registerSubscriber = () => {
    if (!connectionSubscribers.has(url)) {
      connectionSubscribers.set(url, new Set());
    }
    connectionSubscribers.get(url)!.add(subscriberId);
  };

  /**
   * Unregister this component
   */
  const unregisterSubscriber = () => {
    const subscribers = connectionSubscribers.get(url);
    if (subscribers) {
      subscribers.delete(subscriberId);
    }
  };

  /**
   * Setup visibility API
   */
  const setupVisibilityHandler = () => {
    if (!enableVisibilityPause) return;

    visibilityHandler = () => {
      isTabVisible.value = !document.hidden;

      if (isTabVisible.value && !isConnected.value) {
        // Tab became visible, reconnect
        connect();
      } else if (!isTabVisible.value && isConnected.value) {
        // Tab became hidden, disconnect to save resources
        disconnect();
      }
    };

    document.addEventListener("visibilitychange", visibilityHandler);
  };

  /**
   * Manual reconnect
   */
  const reconnect = () => {
    disconnect();
    reconnectCount.value = 0;
    connect();
  };

  /**
   * Get connection health status
   */
  const getHealthStatus = () => {
    return {
      isHealthy: isConnected.value && circuitBreaker.getState() === "closed",
      circuitBreakerState: circuitBreaker.getState(),
      queuedMessages: messageQueue.value.length,
      reconnectAttempts: reconnectCount.value,
      metrics: metrics.value,
    };
  };

  // Setup
  onMounted(() => {
    setupVisibilityHandler();
  });

  // Cleanup
  onUnmounted(() => {
    disconnect();
    if (visibilityHandler) {
      document.removeEventListener("visibilitychange", visibilityHandler);
    }
  });

  return {
    // State
    ws,
    isConnected,
    isConnecting,
    lastError,
    reconnectCount,
    messageQueue: messageQueue as Readonly<Ref<QueuedMessage[]>>,
    metrics: metrics as Readonly<Ref<ConnectionMetrics>>,

    // Methods
    connect,
    disconnect,
    reconnect,
    send,
    getHealthStatus,
  };
}
