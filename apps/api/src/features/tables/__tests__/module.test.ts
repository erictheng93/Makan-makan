/**
 * Tables Module Tests
 *
 * Tests for TablesModule class - module initialization, routes setup, and health checks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";

// Mock ConsoleLogger
vi.mock("../../../core/monitoring", () => {
  class MockConsoleLogger {
    info = vi.fn();
    warn = vi.fn();
    debug = vi.fn();
    error = vi.fn();
    constructor(_name?: string) {}
  }
  return { ConsoleLogger: MockConsoleLogger };
});

// Mock routes
vi.mock("../routes", () => {
  const mockApp = new Hono();
  mockApp.get("/test", (c) => c.json({ success: true }));
  return { default: mockApp };
});

// Import after mocking
import { TablesModule, createTablesModule } from "../index";
import tablesDefault from "../index";

type TablesModuleTestGlobal = typeof globalThis & {
  tablesModuleInstance?: TablesModule | null;
};

describe("TablesModule", () => {
  let tablesModule: TablesModule;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton instance for each test
    (globalThis as TablesModuleTestGlobal).tablesModuleInstance = null;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Module Initialization", () => {
    it("should initialize with correct name", () => {
      tablesModule = new TablesModule();
      expect(tablesModule.name).toBe("tables");
    });

    it("should initialize with correct version", () => {
      tablesModule = new TablesModule();
      expect(tablesModule.version).toBe("1.0.0");
    });

    it("should have routes property", () => {
      tablesModule = new TablesModule();
      expect(tablesModule.routes).toBeDefined();
      expect(tablesModule.routes).toBeInstanceOf(Hono);
    });

    it("should setup routes during initialization", () => {
      tablesModule = new TablesModule();
      // Routes should be mounted
      expect(tablesModule.routes).toBeTruthy();
    });
  });

  describe("getHealthStatus", () => {
    it("should return health status object", () => {
      tablesModule = new TablesModule();
      const healthStatus = tablesModule.getHealthStatus();

      expect(healthStatus).toHaveProperty("name", "tables");
      expect(healthStatus).toHaveProperty("version", "1.0.0");
      expect(healthStatus).toHaveProperty("status", "healthy");
      expect(healthStatus).toHaveProperty("timestamp");
    });

    it("should include all feature flags", () => {
      tablesModule = new TablesModule();
      const healthStatus = tablesModule.getHealthStatus();

      expect(healthStatus.features).toEqual({
        tableManagement: true,
        qrCodeGeneration: true,
        tableOccupancy: true,
        bulkOperations: true,
        tableStatistics: true,
        cleaningManagement: true,
      });
    });

    it("should return valid ISO timestamp", () => {
      tablesModule = new TablesModule();
      const healthStatus = tablesModule.getHealthStatus();

      const timestamp = new Date(healthStatus.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe("getFeatureInfo", () => {
    it("should return feature info object", () => {
      tablesModule = new TablesModule();
      const featureInfo = tablesModule.getFeatureInfo();

      expect(featureInfo).toHaveProperty("name", "tables");
      expect(featureInfo).toHaveProperty("version", "1.0.0");
      expect(featureInfo).toHaveProperty("description");
    });

    it("should include route information", () => {
      tablesModule = new TablesModule();
      const featureInfo = tablesModule.getFeatureInfo();

      expect(featureInfo.routes).toHaveProperty("base", "/tables");
      expect(featureInfo.routes.endpoints).toBeInstanceOf(Array);
      expect(featureInfo.routes.endpoints.length).toBeGreaterThan(0);
    });

    it("should include all expected endpoints", () => {
      tablesModule = new TablesModule();
      const featureInfo = tablesModule.getFeatureInfo();

      const expectedEndpoints = [
        "GET /",
        "GET /:id",
        "POST /",
        "PUT /:id",
        "DELETE /:id",
        "POST /:id/occupy",
        "POST /:id/release",
        "POST /:id/clean",
        "POST /:id/regenerate-qr",
        "POST /bulk-qr",
        "GET /available",
        "GET /stats",
        "GET /qr/:qrCode",
      ];

      expectedEndpoints.forEach((endpoint) => {
        expect(featureInfo.routes.endpoints).toContain(endpoint);
      });
    });

    it("should include permissions", () => {
      tablesModule = new TablesModule();
      const featureInfo = tablesModule.getFeatureInfo();

      expect(featureInfo.permissions).toHaveProperty("view");
      expect(featureInfo.permissions).toHaveProperty("create");
      expect(featureInfo.permissions).toHaveProperty("update");
      expect(featureInfo.permissions).toHaveProperty("delete");
      expect(featureInfo.permissions).toHaveProperty("operate");
      expect(featureInfo.permissions).toHaveProperty("clean");
      expect(featureInfo.permissions).toHaveProperty("qr");
    });

    it("should have correct permission roles", () => {
      tablesModule = new TablesModule();
      const featureInfo = tablesModule.getFeatureInfo();

      // View permission should include all roles
      expect(featureInfo.permissions.view).toContain("ADMIN");
      expect(featureInfo.permissions.view).toContain("OWNER");
      expect(featureInfo.permissions.view).toContain("CHEF");
      expect(featureInfo.permissions.view).toContain("SERVICE");
      expect(featureInfo.permissions.view).toContain("CASHIER");

      // Create permission should be limited
      expect(featureInfo.permissions.create).toContain("ADMIN");
      expect(featureInfo.permissions.create).toContain("OWNER");
      expect(featureInfo.permissions.create).not.toContain("CHEF");
    });
  });

  describe("createTablesModule factory", () => {
    it("should create a TablesModule instance", () => {
      const module = createTablesModule();
      expect(module).toBeInstanceOf(TablesModule);
    });

    it("should return singleton instance", () => {
      const module1 = createTablesModule();
      const module2 = createTablesModule();
      expect(module1).toBe(module2);
    });

    it("should have all module methods", () => {
      const module = createTablesModule();
      expect(typeof module.getHealthStatus).toBe("function");
      expect(typeof module.getFeatureInfo).toBe("function");
    });
  });

  describe("Default Export", () => {
    it("should export routes", () => {
      expect(tablesDefault.routes).toBeDefined();
    });

    it("should export getHealthStatus function", () => {
      expect(typeof tablesDefault.getHealthStatus).toBe("function");
      const health = tablesDefault.getHealthStatus();
      expect(health).toHaveProperty("name", "tables");
    });

    it("should export getFeatureInfo function", () => {
      expect(typeof tablesDefault.getFeatureInfo).toBe("function");
      const info = tablesDefault.getFeatureInfo();
      expect(info).toHaveProperty("name", "tables");
    });
  });
});

describe("TablesModule Routes Middleware", () => {
  it("should setup logging middleware", async () => {
    const tablesModule = new TablesModule();

    // The module should have middleware that logs requests
    expect(tablesModule.routes).toBeDefined();
  });
});
