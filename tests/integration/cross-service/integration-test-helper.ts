/**
 * Cross-Service Integration Test Helper
 *
 * Provides utilities for testing interactions between:
 * - API Layer (Hono)
 * - Realtime Layer (Durable Objects)
 * - Database Layer (D1)
 *
 * Supports:
 * - Service lifecycle management
 * - Inter-service communication testing
 * - End-to-end scenario validation
 * - Performance tracking across services
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

export interface ServiceConfig {
  api: {
    url: string;
    port: number;
    healthEndpoint: string;
  };
  realtime: {
    url: string;
    wsUrl: string;
    port: number;
  };
  database: {
    connectionString?: string;
    type: "local" | "staging" | "mock";
  };
}

export interface TestUser {
  id: number;
  username: string;
  email: string;
  role: number;
  restaurantId: number;
  token?: string;
}

export interface TestRestaurant {
  id: number;
  name: string;
  tables: TestTable[];
}

export interface TestTable {
  id: number;
  number: string;
  restaurantId: number;
}

export interface TestOrder {
  id: number;
  restaurantId: number;
  tableId: number;
  status: string;
  items: TestOrderItem[];
}

export interface TestOrderItem {
  id: number;
  menuItemId: number;
  quantity: number;
  unitPrice: number;
}

/**
 * Integration Test Helper
 * Manages test environment and provides utilities for cross-service testing
 */
export class IntegrationTestHelper {
  private config: ServiceConfig;
  private apiClient: any;
  private wsClient: any;
  private dbClient: any;
  private testData: {
    users: Map<string, TestUser>;
    restaurants: Map<number, TestRestaurant>;
    orders: Map<number, TestOrder>;
  };

  constructor(config: ServiceConfig) {
    this.config = config;
    this.testData = {
      users: new Map(),
      restaurants: new Map(),
      orders: new Map(),
    };
  }

  /**
   * Initialize test environment
   */
  async initialize(): Promise<void> {
    console.log("🚀 Initializing Integration Test Environment...");

    // Wait for services to be ready
    await this.waitForServices();

    // Setup test data
    await this.setupTestData();

    console.log("✅ Integration Test Environment Ready");
  }

  /**
   * Cleanup test environment
   */
  async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up Integration Test Environment...");

    // Close WebSocket connections
    if (this.wsClient) {
      this.wsClient.close();
    }

    // Clean test data
    await this.cleanupTestData();

    console.log("✅ Cleanup Complete");
  }

  /**
   * Wait for all services to be ready
   */
  private async waitForServices(): Promise<void> {
    const maxRetries = 30;
    const retryDelay = 1000; // 1 second

    // Wait for API
    console.log("  ⏳ Waiting for API service...");
    await this.waitForService(
      this.config.api.url + this.config.api.healthEndpoint,
      maxRetries,
      retryDelay,
    );
    console.log("  ✅ API service ready");

    // Wait for Realtime (if configured)
    if (this.config.realtime.url) {
      console.log("  ⏳ Waiting for Realtime service...");
      await this.waitForService(
        this.config.realtime.url + "/health",
        maxRetries,
        retryDelay,
      );
      console.log("  ✅ Realtime service ready");
    }
  }

  /**
   * Wait for a specific service endpoint
   */
  private async waitForService(
    url: string,
    maxRetries: number,
    retryDelay: number,
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Service not ready yet
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    throw new Error(`Service at ${url} did not become ready`);
  }

  /**
   * Setup test data
   */
  private async setupTestData(): Promise<void> {
    // Create test users
    const adminUser = await this.createTestUser({
      username: "test_admin",
      email: "admin@test.com",
      role: 0, // Admin
      restaurantId: 1,
    });
    this.testData.users.set("admin", adminUser);

    const ownerUser = await this.createTestUser({
      username: "test_owner",
      email: "owner@test.com",
      role: 1, // Owner
      restaurantId: 1,
    });
    this.testData.users.set("owner", ownerUser);

    // Create test restaurant
    const restaurant = await this.createTestRestaurant({
      name: "Integration Test Restaurant",
      tables: [
        { number: "T1", capacity: 4 },
        { number: "T2", capacity: 2 },
        { number: "T3", capacity: 6 },
      ],
    });
    this.testData.restaurants.set(restaurant.id, restaurant);
  }

  /**
   * Cleanup test data
   */
  private async cleanupTestData(): Promise<void> {
    // Delete test orders
    for (const [orderId] of this.testData.orders) {
      await this.deleteOrder(orderId);
    }

    // Delete test restaurants
    for (const [restaurantId] of this.testData.restaurants) {
      await this.deleteRestaurant(restaurantId);
    }

    // Delete test users
    for (const [_, user] of this.testData.users) {
      await this.deleteUser(user.id);
    }
  }

  /**
   * Create test user
   */
  private async createTestUser(data: Partial<TestUser>): Promise<TestUser> {
    // Mock implementation - in real tests, this would call the API
    const user: TestUser = {
      id: Math.floor(Math.random() * 1000000),
      username: data.username || "test_user",
      email: data.email || "test@test.com",
      role: data.role || 0,
      restaurantId: data.restaurantId || 1,
      token: "test_token_" + Date.now(),
    };

    return user;
  }

  /**
   * Create test restaurant
   */
  private async createTestRestaurant(data: any): Promise<TestRestaurant> {
    // Mock implementation
    const restaurant: TestRestaurant = {
      id: Math.floor(Math.random() * 1000000),
      name: data.name,
      tables: data.tables.map((t: any, index: number) => ({
        id: index + 1,
        number: t.number,
        restaurantId: 0, // Will be set
      })),
    };

    restaurant.tables.forEach((t) => (t.restaurantId = restaurant.id));

    return restaurant;
  }

  /**
   * Delete test user
   */
  private async deleteUser(userId: number): Promise<void> {
    // Mock implementation
  }

  /**
   * Delete test restaurant
   */
  private async deleteRestaurant(restaurantId: number): Promise<void> {
    // Mock implementation
  }

  /**
   * Delete test order
   */
  private async deleteOrder(orderId: number): Promise<void> {
    // Mock implementation
  }

  /**
   * Get test user by role
   */
  getTestUser(
    role: "admin" | "owner" | "chef" | "cashier",
  ): TestUser | undefined {
    return this.testData.users.get(role);
  }

  /**
   * Get test restaurant
   */
  getTestRestaurant(id?: number): TestRestaurant | undefined {
    if (id) {
      return this.testData.restaurants.get(id);
    }
    // Return first restaurant
    return Array.from(this.testData.restaurants.values())[0];
  }

  /**
   * Make API request
   */
  async apiRequest(
    method: string,
    path: string,
    options: {
      body?: any;
      headers?: Record<string, string>;
      user?: TestUser;
    } = {},
  ): Promise<Response> {
    const url = this.config.api.url + path;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (options.user?.token) {
      headers["Authorization"] = `Bearer ${options.user.token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    return response;
  }

  /**
   * Create WebSocket connection
   */
  async createWebSocketConnection(
    type: "customer" | "admin" | "kitchen",
    roomId: string | number,
    token: string,
  ): Promise<WebSocket> {
    const wsUrl = `${this.config.realtime.wsUrl}/${type}/${roomId}?token=${token}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        this.wsClient = ws;
        resolve(ws);
      };

      ws.onerror = (error) => {
        reject(error);
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          reject(new Error("WebSocket connection timeout"));
        }
      }, 10000);
    });
  }

  /**
   * Wait for WebSocket message
   */
  async waitForWebSocketMessage(
    ws: WebSocket,
    predicate: (message: any) => boolean,
    timeout: number = 5000,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Timeout waiting for WebSocket message"));
      }, timeout);

      const messageHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (predicate(data)) {
            clearTimeout(timeoutId);
            ws.removeEventListener("message", messageHandler);
            resolve(data);
          }
        } catch (error) {
          // Invalid JSON, ignore
        }
      };

      ws.addEventListener("message", messageHandler);
    });
  }

  /**
   * Send WebSocket message
   */
  sendWebSocketMessage(ws: WebSocket, message: any): void {
    ws.send(JSON.stringify(message));
  }

  /**
   * Execute database query
   */
  async executeDbQuery(query: string, params: any[] = []): Promise<any> {
    // Mock implementation - in real tests, this would execute against test DB
    return { results: [], success: true };
  }

  /**
   * Track performance across services
   */
  async trackCrossServicePerformance(
    scenario: string,
    execution: () => Promise<void>,
  ): Promise<{
    scenario: string;
    totalTime: number;
    breakdown: {
      apiTime: number;
      realtimeTime: number;
      dbTime: number;
    };
  }> {
    const startTime = performance.now();
    let apiTime = 0;
    let realtimeTime = 0;
    let dbTime = 0;

    // Execute scenario with instrumentation
    await execution();

    const totalTime = performance.now() - startTime;

    return {
      scenario,
      totalTime,
      breakdown: {
        apiTime,
        realtimeTime,
        dbTime,
      },
    };
  }
}

/**
 * Default test configuration
 */
export const DEFAULT_TEST_CONFIG: ServiceConfig = {
  api: {
    url: process.env.TEST_API_URL || "http://localhost:8787",
    port: 8787,
    healthEndpoint: "/api/v1/health",
  },
  realtime: {
    url: process.env.TEST_REALTIME_URL || "http://localhost:8788",
    wsUrl: process.env.TEST_WS_URL || "ws://localhost:8788",
    port: 8788,
  },
  database: {
    type: "mock",
  },
};

/**
 * Create integration test helper instance
 */
export function createIntegrationTestHelper(
  config: Partial<ServiceConfig> = {},
): IntegrationTestHelper {
  const mergedConfig = {
    ...DEFAULT_TEST_CONFIG,
    ...config,
  };

  return new IntegrationTestHelper(mergedConfig);
}
