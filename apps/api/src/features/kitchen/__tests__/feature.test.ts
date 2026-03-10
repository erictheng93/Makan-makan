/**
 * Kitchen Feature Module Tests
 * Basic tests for kitchen functionality
 */

import { describe, test, expect } from "vitest";
import { KitchenService } from "../services/KitchenService";
import type { KitchenSSEEvent } from "../types";

// Mock environment for testing
const mockEnv = {
  NODE_ENV: "test",
  DB: {},
  CACHE_KV: {},
} as any;

describe("Kitchen Feature Module", () => {
  test("should create KitchenService instance", () => {
    const service = new KitchenService(mockEnv);
    expect(service).toBeDefined();
    expect(typeof service.generateConnectionId).toBe("function");
    expect(typeof service.validateChefAccess).toBe("function");
  });

  test("should generate unique connection IDs", () => {
    const service = new KitchenService(mockEnv);
    const id1 = service.generateConnectionId();
    const id2 = service.generateConnectionId();

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^kitchen_/);
  });

  test("should validate chef access correctly", () => {
    const service = new KitchenService(mockEnv);

    // Kitchen-allowed roles should have access
    expect(service.validateChefAccess(1, 0, "test-restaurant-1")).toBe(true); // Admin
    expect(service.validateChefAccess(1, 1, "test-restaurant-1")).toBe(true); // Owner
    expect(service.validateChefAccess(1, 2, "test-restaurant-1")).toBe(true); // Chef
    expect(service.validateChefAccess(1, 3, "test-restaurant-1")).toBe(true); // Service

    // Cashier role should not have kitchen access
    expect(service.validateChefAccess(1, 4, "test-restaurant-1")).toBe(false); // Cashier
  });

  test("should format SSE events correctly", () => {
    const service = new KitchenService(mockEnv);

    const event: KitchenSSEEvent = {
      id: "test-id",
      event: "test-event",
      data: {
        type: "NEW_ORDER",
        orderId: 123,
        timestamp: "2024-01-01T00:00:00.000Z",
        restaurantId: "test-restaurant-1",
      },
    };

    const formatted = service.formatSSEEvent(event);
    expect(formatted).toContain("id: test-id");
    expect(formatted).toContain("event: test-event");
    expect(formatted).toContain('data: {"type":"NEW_ORDER"');
  });

  test("should get connection status", () => {
    const service = new KitchenService(mockEnv);
    const status = service.getConnectionStatus("test-restaurant-1");

    expect(status).toHaveProperty("totalConnections");
    expect(status).toHaveProperty("restaurantConnections");
    expect(status).toHaveProperty("connections");
    expect(Array.isArray(status.connections)).toBe(true);
  });

  test("should cleanup expired connections", () => {
    const service = new KitchenService(mockEnv);

    // This should not throw an error
    expect(() => service.cleanupExpiredConnections()).not.toThrow();
  });

  test("should register and remove connections", () => {
    const service = new KitchenService(mockEnv);
    const connectionId = "test-connection";

    service.registerConnection(connectionId, {
      restaurantId: "test-restaurant-1",
      userId: 1,
      lastHeartbeat: Date.now(),
    });

    let status = service.getConnectionStatus("test-restaurant-1");
    expect(status.restaurantConnections).toBe(1);

    service.removeConnection(connectionId);
    status = service.getConnectionStatus("test-restaurant-1");
    expect(status.restaurantConnections).toBe(0);
  });
});

describe("Kitchen Module Types", () => {
  test("should have proper type definitions", () => {
    // This test ensures types are properly exported
    const event: KitchenSSEEvent = {
      data: {
        type: "NEW_ORDER",
        timestamp: "2024-01-01T00:00:00.000Z",
        restaurantId: "test-restaurant-1",
      },
    };

    expect(event.data.type).toBe("NEW_ORDER");
    expect(event.data.restaurantId).toBe("test-restaurant-1");
  });
});
