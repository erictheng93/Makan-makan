/**
 * TablesService Unit Tests
 *
 * Comprehensive test suite for TablesService - targeting 80%+ coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Env } from "../../../types/env";
import type { CreateTableData, UpdateTableData, Table } from "../types";

// Use vi.hoisted to define mocks BEFORE vi.mock is executed
// This ensures the mock object is available when the mock factory runs
const { mockTableService } = vi.hoisted(() => ({
  mockTableService: {
    getRestaurantTables: vi.fn(),
    getTableById: vi.fn(),
    createTable: vi.fn(),
    updateTable: vi.fn(),
    deleteTable: vi.fn(),
    occupyTable: vi.fn(),
    releaseTable: vi.fn(),
    markTableCleaned: vi.fn(),
    regenerateQRCode: vi.fn(),
    generateBulkQRCodes: vi.fn(),
    getAvailableTables: vi.fn(),
    getTableStats: vi.fn(),
    getTableByQRCode: vi.fn(),
  },
}));

// Mock the database service - uses the hoisted mockTableService
// Use class-based mock for vitest 4 compatibility
vi.mock("@makanmakan/database", () => {
  return {
    TableService: class MockTableService {
      constructor() {
        Object.assign(this, mockTableService);
      }
    },
    USER_ROLES: {
      ADMIN: 0,
      OWNER: 1,
      CHEF: 2,
      SERVICE: 3,
      CASHIER: 4,
      CUSTOMER: 5,
    },
  };
});

// Import after mocking
import { TablesService } from "../services/TablesService";

// Mock environment
const mockEnv: Env = {
  DB: {} as any,
  JWT_SECRET: "test-secret",
  ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars",
  CACHE_KV: {} as any,
  SLACK_WEBHOOK_URL: "https://hooks.slack.com/test",
  NODE_ENV: "test",
  API_VERSION: "v1",
  TOKEN_BLACKLIST: {} as any,
  IMAGES_BUCKET: {} as any,
  BACKUP_STORAGE: {} as any,
  JOB_QUEUE: {} as any,
  REALTIME_ORDERS: {} as any,
  ANALYTICS_ENGINE: {} as any,
  RATE_LIMIT_KV: {} as any,
  REALTIME_SESSION: {} as any,
  CLOUDFLARE_IMAGES_KEY: "test-key",
  CLOUDFLARE_ACCOUNT_ID: "test-account",
};

// Mock table data
const mockTable: Table = {
  id: 1,
  restaurantId: "test-restaurant-1",
  number: "T01",
  name: "Window Table",
  capacity: 4,
  location: "Near window",
  floor: 1,
  section: "Main dining",
  features: { hasView: true, hasChargingPort: true },
  isActive: true,
  isOccupied: false,
  isReservable: true,
  qrCode: "qr-code-12345",
  orderId: undefined,
  occupiedBy: undefined,
  occupiedAt: undefined,
  estimatedReleaseTime: undefined,
  lastCleanedAt: undefined,
  maintenanceNotes: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("TablesService", () => {
  let tablesService: TablesService;

  beforeEach(() => {
    tablesService = new TablesService(mockEnv);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ========================================
  // Get Restaurant Tables Tests
  // ========================================
  describe("getRestaurantTables", () => {
    it("should fetch restaurant tables with pagination", async () => {
      const mockDbResult = {
        tables: [mockTable],
        total: 1,
        pagination: {
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      mockTableService.getRestaurantTables.mockResolvedValue(mockDbResult);

      const result = await tablesService.getRestaurantTables(1, {
        page: 1,
        limit: 20,
      });

      expect(result.tables).toHaveLength(1);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it("should return hasNext when there are more pages", async () => {
      const mockDbResult = {
        tables: Array(20).fill(mockTable),
        total: 50,
        pagination: {
          page: 1,
          limit: 20,
          totalPages: 3,
        },
      };

      mockTableService.getRestaurantTables.mockResolvedValue(mockDbResult);

      const result = await tablesService.getRestaurantTables(1, {
        page: 1,
        limit: 20,
      });

      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it("should return hasPrev when on later pages", async () => {
      const mockDbResult = {
        tables: Array(20).fill(mockTable),
        total: 50,
        pagination: {
          page: 2,
          limit: 20,
          totalPages: 3,
        },
      };

      mockTableService.getRestaurantTables.mockResolvedValue(mockDbResult);

      const result = await tablesService.getRestaurantTables(1, {
        page: 2,
        limit: 20,
      });

      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it("should handle database errors gracefully", async () => {
      mockTableService.getRestaurantTables.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(tablesService.getRestaurantTables(1, {})).rejects.toThrow(
        "Failed to fetch restaurant tables",
      );
    });

    it("should pass filters to database service", async () => {
      const filters = { floor: 1, section: "Main", isOccupied: false };
      mockTableService.getRestaurantTables.mockResolvedValue({
        tables: [],
        total: 0,
        pagination: { page: 1, limit: 20, totalPages: 0 },
      });

      await tablesService.getRestaurantTables(1, filters);

      // Service converts restaurantId to string for database layer
      expect(mockTableService.getRestaurantTables).toHaveBeenCalledWith(
        "1",
        filters,
      );
    });
  });

  // ========================================
  // Get Table By ID Tests
  // ========================================
  describe("getTableById", () => {
    it("should fetch table by ID successfully", async () => {
      mockTableService.getTableById.mockResolvedValue(mockTable);

      const result = await tablesService.getTableById(1);

      expect(result).toEqual(mockTable);
      expect(mockTableService.getTableById).toHaveBeenCalledWith(1);
    });

    it("should return null when table not found", async () => {
      mockTableService.getTableById.mockResolvedValue(null);

      const result = await tablesService.getTableById(999);

      expect(result).toBeNull();
    });

    it("should handle errors and throw appropriate message", async () => {
      mockTableService.getTableById.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(tablesService.getTableById(1)).rejects.toThrow(
        "Failed to fetch table",
      );
    });
  });

  // ========================================
  // Create Table Tests
  // ========================================
  describe("createTable", () => {
    it("should create table successfully", async () => {
      const tableData: CreateTableData = {
        restaurantId: "test-restaurant-1",
        number: "T02",
        capacity: 6,
        floor: 2,
      };

      mockTableService.createTable.mockResolvedValue({ id: 2, ...tableData });

      const result = await tablesService.createTable(tableData);

      expect(result.id).toBe(2);
      // Service converts restaurantId to string for database layer
      expect(mockTableService.createTable).toHaveBeenCalledWith({
        ...tableData,
        restaurantId: "test-restaurant-1",
      });
    });

    it("should handle creation errors", async () => {
      const tableData: CreateTableData = {
        restaurantId: "test-restaurant-1",
        number: "T01", // Duplicate
        capacity: 4,
      };

      mockTableService.createTable.mockRejectedValue(
        new Error("Duplicate table number"),
      );

      await expect(tablesService.createTable(tableData)).rejects.toThrow(
        "Failed to create table",
      );
    });

    it("should create table with all optional fields", async () => {
      const tableData: CreateTableData = {
        restaurantId: "test-restaurant-1",
        number: "T03",
        name: "VIP Table",
        capacity: 8,
        location: "Corner",
        floor: 3,
        section: "VIP",
        features: { hasView: true, hasChargingPort: true, isQuietZone: true },
        isReservable: true,
      };

      mockTableService.createTable.mockResolvedValue({ id: 3, ...tableData });

      const result = await tablesService.createTable(tableData);

      expect(result.features).toEqual(tableData.features);
    });
  });

  // ========================================
  // Update Table Tests
  // ========================================
  describe("updateTable", () => {
    it("should update table successfully", async () => {
      const updateData: UpdateTableData = {
        capacity: 8,
        maintenanceNotes: "Updated capacity",
      };

      mockTableService.updateTable.mockResolvedValue({
        ...mockTable,
        ...updateData,
      });

      const result = await tablesService.updateTable(1, updateData);

      expect(result.capacity).toBe(8);
      expect(result.maintenanceNotes).toBe("Updated capacity");
    });

    it("should handle update errors", async () => {
      mockTableService.updateTable.mockRejectedValue(
        new Error("Update failed"),
      );

      await expect(
        tablesService.updateTable(1, { capacity: 10 }),
      ).rejects.toThrow("Failed to update table");
    });

    it("should update table features", async () => {
      const updateData: UpdateTableData = {
        features: { hasChargingPort: false, isAccessible: true },
      };

      mockTableService.updateTable.mockResolvedValue({
        ...mockTable,
        features: updateData.features,
      });

      const result = await tablesService.updateTable(1, updateData);

      expect(result.features).toEqual(updateData.features);
    });

    it("should update table status", async () => {
      const updateData: UpdateTableData = {
        isActive: false,
        isReservable: false,
      };

      mockTableService.updateTable.mockResolvedValue({
        ...mockTable,
        ...updateData,
      });

      const result = await tablesService.updateTable(1, updateData);

      expect(result.isActive).toBe(false);
      expect(result.isReservable).toBe(false);
    });
  });

  // ========================================
  // Delete Table Tests
  // ========================================
  describe("deleteTable", () => {
    it("should delete table successfully", async () => {
      mockTableService.deleteTable.mockResolvedValue(true);

      const result = await tablesService.deleteTable(1);

      expect(result).toBe(true);
      expect(mockTableService.deleteTable).toHaveBeenCalledWith(1);
    });

    it("should return false when deletion fails", async () => {
      mockTableService.deleteTable.mockResolvedValue(false);

      const result = await tablesService.deleteTable(999);

      expect(result).toBe(false);
    });

    it("should handle deletion errors", async () => {
      mockTableService.deleteTable.mockRejectedValue(
        new Error("Deletion error"),
      );

      await expect(tablesService.deleteTable(1)).rejects.toThrow(
        "Failed to delete table",
      );
    });
  });

  // ========================================
  // Occupy Table Tests
  // ========================================
  describe("occupyTable", () => {
    it("should occupy table successfully with all parameters", async () => {
      mockTableService.occupyTable.mockResolvedValue(true);

      const result = await tablesService.occupyTable(1, 100, "John Doe", 60);

      expect(result).toBe(true);
      expect(mockTableService.occupyTable).toHaveBeenCalledWith(
        1,
        100,
        "John Doe",
        60,
      );
    });

    it("should occupy table with minimal parameters", async () => {
      mockTableService.occupyTable.mockResolvedValue(true);

      const result = await tablesService.occupyTable(1, 100);

      expect(result).toBe(true);
      expect(mockTableService.occupyTable).toHaveBeenCalledWith(
        1,
        100,
        undefined,
        undefined,
      );
    });

    it("should return false when occupation fails", async () => {
      mockTableService.occupyTable.mockResolvedValue(false);

      const result = await tablesService.occupyTable(1, 100);

      expect(result).toBe(false);
    });

    it("should handle occupation errors", async () => {
      mockTableService.occupyTable.mockRejectedValue(
        new Error("Occupation error"),
      );

      await expect(tablesService.occupyTable(1, 100)).rejects.toThrow(
        "Failed to occupy table",
      );
    });
  });

  // ========================================
  // Release Table Tests
  // ========================================
  describe("releaseTable", () => {
    it("should release table successfully", async () => {
      mockTableService.releaseTable.mockResolvedValue(true);

      const result = await tablesService.releaseTable(1);

      expect(result).toBe(true);
      expect(mockTableService.releaseTable).toHaveBeenCalledWith(1);
    });

    it("should return false when release fails", async () => {
      mockTableService.releaseTable.mockResolvedValue(false);

      const result = await tablesService.releaseTable(999);

      expect(result).toBe(false);
    });

    it("should handle release errors", async () => {
      mockTableService.releaseTable.mockRejectedValue(
        new Error("Release error"),
      );

      await expect(tablesService.releaseTable(1)).rejects.toThrow(
        "Failed to release table",
      );
    });
  });

  // ========================================
  // Mark Table Cleaned Tests
  // ========================================
  describe("markTableCleaned", () => {
    it("should mark table as cleaned successfully", async () => {
      mockTableService.markTableCleaned.mockResolvedValue(true);

      const result = await tablesService.markTableCleaned(1, "Deep cleaned");

      expect(result).toBe(true);
      expect(mockTableService.markTableCleaned).toHaveBeenCalledWith(
        1,
        "Deep cleaned",
      );
    });

    it("should mark table as cleaned without notes", async () => {
      mockTableService.markTableCleaned.mockResolvedValue(true);

      const result = await tablesService.markTableCleaned(1);

      expect(result).toBe(true);
      expect(mockTableService.markTableCleaned).toHaveBeenCalledWith(
        1,
        undefined,
      );
    });

    it("should return false when marking fails", async () => {
      mockTableService.markTableCleaned.mockResolvedValue(false);

      const result = await tablesService.markTableCleaned(999);

      expect(result).toBe(false);
    });

    it("should handle marking errors", async () => {
      mockTableService.markTableCleaned.mockRejectedValue(
        new Error("Marking error"),
      );

      await expect(tablesService.markTableCleaned(1)).rejects.toThrow(
        "Failed to mark table as cleaned",
      );
    });
  });

  // ========================================
  // Regenerate QR Code Tests
  // ========================================
  describe("regenerateQRCode", () => {
    it("should regenerate QR code successfully", async () => {
      mockTableService.regenerateQRCode.mockResolvedValue({
        success: true,
        qrCode: "new-qr-code-12345",
      });

      const result = await tablesService.regenerateQRCode(1);

      expect(result.success).toBe(true);
      expect(result.qrCode).toBe("new-qr-code-12345");
    });

    it("should regenerate QR code with custom data", async () => {
      const customData = { style: "modern", color: "#FF0000" };
      mockTableService.regenerateQRCode.mockResolvedValue({
        success: true,
        qrCode: "custom-qr-code",
      });

      const result = await tablesService.regenerateQRCode(1, customData);

      expect(result.success).toBe(true);
      expect(mockTableService.regenerateQRCode).toHaveBeenCalledWith(
        1,
        customData,
      );
    });

    it("should handle regeneration failure from service", async () => {
      mockTableService.regenerateQRCode.mockResolvedValue({
        success: false,
        error: "QR generation failed",
      });

      const result = await tablesService.regenerateQRCode(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("QR generation failed");
    });

    it("should handle regeneration errors and return error response", async () => {
      mockTableService.regenerateQRCode.mockRejectedValue(
        new Error("QR service error"),
      );

      const result = await tablesService.regenerateQRCode(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to regenerate QR code");
    });
  });

  // ========================================
  // Generate Bulk QR Codes Tests
  // ========================================
  describe("generateBulkQRCodes", () => {
    it("should generate bulk QR codes successfully", async () => {
      const tableIds = [1, 2, 3];
      mockTableService.generateBulkQRCodes.mockResolvedValue({
        success: true,
        qrCodes: [
          { tableId: 1, qrCode: "qr-1" },
          { tableId: 2, qrCode: "qr-2" },
          { tableId: 3, qrCode: "qr-3" },
        ],
      });

      const result = await tablesService.generateBulkQRCodes(1, tableIds);

      expect(result.success).toBe(true);
      expect(result.qrCodes).toHaveLength(3);
    });

    it("should generate bulk QR codes with options", async () => {
      const tableIds = [1, 2];
      const options = { size: "large" as const, format: "svg" as const };
      mockTableService.generateBulkQRCodes.mockResolvedValue({
        success: true,
        qrCodes: [
          { tableId: 1, qrCode: "qr-1" },
          { tableId: 2, qrCode: "qr-2" },
        ],
      });

      const result = await tablesService.generateBulkQRCodes(
        1,
        tableIds,
        options,
      );

      expect(result.success).toBe(true);
      expect(result.qrCodes?.[0].format).toBe("svg");
      expect(result.qrCodes?.[0].size).toBe("large");
    });

    it("should handle bulk generation failure", async () => {
      mockTableService.generateBulkQRCodes.mockResolvedValue({
        success: false,
        error: "Bulk generation failed",
      });

      const result = await tablesService.generateBulkQRCodes(1, [1, 2]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Bulk generation failed");
    });

    it("should handle bulk generation errors", async () => {
      mockTableService.generateBulkQRCodes.mockRejectedValue(
        new Error("Bulk service error"),
      );

      const result = await tablesService.generateBulkQRCodes(1, [1, 2]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to generate bulk QR codes");
    });

    it("should use default options when not provided", async () => {
      mockTableService.generateBulkQRCodes.mockResolvedValue({
        success: true,
        qrCodes: [{ tableId: 1, qrCode: "qr-1" }],
      });

      const result = await tablesService.generateBulkQRCodes(1, [1]);

      expect(result.qrCodes?.[0].format).toBe("png");
      expect(result.qrCodes?.[0].size).toBe("medium");
    });
  });

  // ========================================
  // Get Available Tables Tests
  // ========================================
  describe("getAvailableTables", () => {
    it("should fetch available tables successfully", async () => {
      const availableTables = [
        { ...mockTable, id: 1, isOccupied: false },
        { ...mockTable, id: 2, isOccupied: false },
      ];
      mockTableService.getAvailableTables.mockResolvedValue(availableTables);

      const result = await tablesService.getAvailableTables(1);

      expect(result).toHaveLength(2);
      // Service converts restaurantId to string for database layer
      expect(mockTableService.getAvailableTables).toHaveBeenCalledWith(
        "1",
        undefined,
      );
    });

    it("should filter by capacity", async () => {
      const availableTables = [{ ...mockTable, capacity: 6 }];
      mockTableService.getAvailableTables.mockResolvedValue(availableTables);

      const result = await tablesService.getAvailableTables(1, 6);

      expect(result).toHaveLength(1);
      // Service converts restaurantId to string for database layer
      expect(mockTableService.getAvailableTables).toHaveBeenCalledWith("1", 6);
    });

    it("should return empty array when no tables available", async () => {
      mockTableService.getAvailableTables.mockResolvedValue([]);

      const result = await tablesService.getAvailableTables(1);

      expect(result).toEqual([]);
    });

    it("should handle errors", async () => {
      mockTableService.getAvailableTables.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(tablesService.getAvailableTables(1)).rejects.toThrow(
        "Failed to fetch available tables",
      );
    });
  });

  // ========================================
  // Get Table Stats Tests
  // ========================================
  describe("getTableStats", () => {
    it("should fetch table statistics successfully", async () => {
      mockTableService.getTableStats.mockResolvedValue({
        totalTables: 20,
        occupiedTables: 12,
        availableTables: 8,
        inactiveTables: 2,
        averageOccupancyRate: 60,
        byFloor: { 1: 10, 2: 8, 3: 2 },
        byCapacity: { 2: 5, 4: 10, 6: 5 },
      });

      const result = await tablesService.getTableStats(1);

      expect(result.total).toBe(20);
      expect(result.occupied).toBe(12);
      expect(result.available).toBe(8);
      expect(result.outOfService).toBe(2);
      expect(result.utilizationRate).toBe(60);
    });

    it("should transform floor distribution correctly", async () => {
      mockTableService.getTableStats.mockResolvedValue({
        totalTables: 10,
        occupiedTables: 5,
        availableTables: 5,
        inactiveTables: 0,
        averageOccupancyRate: 50,
        byFloor: { 1: 6, 2: 4 },
        byCapacity: {},
      });

      const result = await tablesService.getTableStats(1);

      expect(result.floorDistribution).toHaveLength(2);
      expect(result.floorDistribution[0].floor).toBe(1);
      expect(result.floorDistribution[0].total).toBe(6);
    });

    it("should handle errors", async () => {
      mockTableService.getTableStats.mockRejectedValue(
        new Error("Stats error"),
      );

      await expect(tablesService.getTableStats(1)).rejects.toThrow(
        "Failed to fetch table statistics",
      );
    });
  });

  // ========================================
  // Get Table By QR Code Tests
  // ========================================
  describe("getTableByQRCode", () => {
    it("should fetch table by QR code successfully", async () => {
      mockTableService.getTableByQRCode.mockResolvedValue(mockTable);

      const result = await tablesService.getTableByQRCode("qr-code-12345");

      expect(result).toEqual(mockTable);
      expect(mockTableService.getTableByQRCode).toHaveBeenCalledWith(
        "qr-code-12345",
      );
    });

    it("should return null for invalid QR code", async () => {
      mockTableService.getTableByQRCode.mockResolvedValue(null);

      const result = await tablesService.getTableByQRCode("invalid-qr");

      expect(result).toBeNull();
    });

    it("should handle errors", async () => {
      mockTableService.getTableByQRCode.mockRejectedValue(
        new Error("QR lookup error"),
      );

      await expect(tablesService.getTableByQRCode("qr-code")).rejects.toThrow(
        "Failed to fetch table by QR code",
      );
    });
  });

  // ========================================
  // Permission Validation Tests
  // ========================================
  describe("validateTableAccess", () => {
    it("should grant access to admin users", () => {
      const table = { ...mockTable, restaurantId: "test-restaurant-1" };
      const result = tablesService.validateTableAccess(
        table as Table,
        "test-restaurant-2",
        true,
      );
      expect(result).toBe(true);
    });

    it("should grant access to same restaurant", () => {
      const table = { ...mockTable, restaurantId: "test-restaurant-1" };
      const result = tablesService.validateTableAccess(
        table as Table,
        "test-restaurant-1",
        false,
      );
      expect(result).toBe(true);
    });

    it("should deny access to different restaurant for non-admin", () => {
      const table = { ...mockTable, restaurantId: "test-restaurant-1" };
      const result = tablesService.validateTableAccess(
        table as Table,
        "test-restaurant-2",
        false,
      );
      expect(result).toBe(false);
    });
  });

  describe("validateRestaurantAccess", () => {
    it("should grant access to admin users", () => {
      const result = tablesService.validateRestaurantAccess(
        "test-restaurant-1",
        "test-restaurant-2",
        true,
      );
      expect(result).toBe(true);
    });

    it("should grant access to same restaurant", () => {
      const result = tablesService.validateRestaurantAccess(
        "test-restaurant-1",
        "test-restaurant-1",
        false,
      );
      expect(result).toBe(true);
    });

    it("should deny access to different restaurant for non-admin", () => {
      const result = tablesService.validateRestaurantAccess(
        "test-restaurant-1",
        "test-restaurant-2",
        false,
      );
      expect(result).toBe(false);
    });
  });

  // ========================================
  // Public Table Info Tests
  // ========================================
  describe("getPublicTableInfo", () => {
    it("should return only public fields", () => {
      const table = {
        ...mockTable,
        orderId: 100,
        occupiedBy: "John Doe",
        maintenanceNotes: "Private notes",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = tablesService.getPublicTableInfo(
        table as unknown as Table,
      );

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("number");
      expect(result).toHaveProperty("capacity");
      expect(result).not.toHaveProperty("orderId");
      expect(result).not.toHaveProperty("occupiedBy");
      expect(result).not.toHaveProperty("maintenanceNotes");
      expect(result).not.toHaveProperty("createdAt");
      expect(result).not.toHaveProperty("updatedAt");
    });

    it("should include all public fields", () => {
      const result = tablesService.getPublicTableInfo(mockTable);

      expect(result.id).toBe(mockTable.id);
      expect(result.restaurantId).toBe(mockTable.restaurantId);
      expect(result.number).toBe(mockTable.number);
      expect(result.name).toBe(mockTable.name);
      expect(result.capacity).toBe(mockTable.capacity);
      expect(result.location).toBe(mockTable.location);
      expect(result.floor).toBe(mockTable.floor);
      expect(result.section).toBe(mockTable.section);
      expect(result.features).toEqual(mockTable.features);
      expect(result.isActive).toBe(mockTable.isActive);
      expect(result.isOccupied).toBe(mockTable.isOccupied);
    });
  });

  // ========================================
  // Response Helper Tests
  // ========================================
  describe("createSuccessResponse", () => {
    it("should create success response with data", () => {
      const data = { id: 1, name: "Test Table" };
      const result = tablesService.createSuccessResponse(data);

      expect(result).toEqual({
        success: true,
        data,
        message: undefined,
      });
    });

    it("should create success response with message", () => {
      const data = { id: 1 };
      const message = "Operation successful";
      const result = tablesService.createSuccessResponse(data, message);

      expect(result).toEqual({
        success: true,
        data,
        message,
      });
    });

    it("should handle null data", () => {
      const result = tablesService.createSuccessResponse(null);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("should handle array data", () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = tablesService.createSuccessResponse(data);

      expect(result.data).toHaveLength(2);
    });
  });

  describe("createErrorResponse", () => {
    it("should create error response", () => {
      const error = "Something went wrong";
      const result = tablesService.createErrorResponse(error);

      expect(result).toEqual({
        success: false,
        error,
      });
    });

    it("should handle empty error message", () => {
      const result = tablesService.createErrorResponse("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("");
    });
  });

  // ========================================
  // Error Logging Tests
  // ========================================
  describe("error logging", () => {
    it("should log errors with operation name", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockTableService.getTableById.mockRejectedValue(new Error("Test error"));

      await expect(tablesService.getTableById(1)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        "TablesService.getTableById error:",
        "Test error",
      );
      consoleSpy.mockRestore();
    });

    it("should handle non-Error objects in error logging", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockTableService.getTableById.mockRejectedValue("String error");

      await expect(tablesService.getTableById(1)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        "TablesService.getTableById error:",
        "String error",
      );
      consoleSpy.mockRestore();
    });
  });
});
