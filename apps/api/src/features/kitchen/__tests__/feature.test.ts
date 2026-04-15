/**
 * Kitchen Feature Module Tests
 */

import { describe, test, expect } from "vitest";
import { KitchenService } from "../services/KitchenService";

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
    expect(typeof service.validateChefAccess).toBe("function");
    expect(typeof service.getKitchenOrders).toBe("function");
    expect(typeof service.updateOrderItemStatus).toBe("function");
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
});
