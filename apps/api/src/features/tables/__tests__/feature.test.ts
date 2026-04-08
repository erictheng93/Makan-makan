/**
 * Tables Feature Tests
 *
 * Comprehensive test suite for the tables management feature
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { envFactory, resetAllFactories } from "@makanmakan/testing-utils";
import type { Env } from "../../../types/env";
import type { CreateTableData, UpdateTableData } from "../types";

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
    },
  };
});

// Import after mocking
import { TablesService } from "../services/TablesService";

// Mock environment
const mockEnv = envFactory.build() as unknown as Env;

describe("TablesService", () => {
  let tablesService: TablesService;

  beforeEach(() => {
    resetAllFactories();
    tablesService = new TablesService(mockEnv);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getRestaurantTables", () => {
    it("should fetch restaurant tables successfully", async () => {
      const mockDbResult = {
        tables: [
          {
            id: 1,
            restaurantId: "test-restaurant-1",
            number: "T01",
            capacity: 4,
            isOccupied: false,
            floor: 1,
          },
        ],
        total: 1,
        pagination: {
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      const expectedResult = {
        tables: [
          {
            id: 1,
            restaurantId: "test-restaurant-1",
            number: "T01",
            capacity: 4,
            isOccupied: false,
            floor: 1,
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      mockTableService.getRestaurantTables.mockResolvedValue(mockDbResult);

      const result = await tablesService.getRestaurantTables("1", {
        page: 1,
        limit: 20,
      });

      // Service converts restaurantId to string for database layer
      expect(mockTableService.getRestaurantTables).toHaveBeenCalledWith("1", {
        page: 1,
        limit: 20,
      });
      expect(result).toEqual(expectedResult);
    });

    it("should handle errors when fetching restaurant tables", async () => {
      mockTableService.getRestaurantTables.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(tablesService.getRestaurantTables("1", {})).rejects.toThrow(
        "Failed to fetch restaurant tables",
      );
    });
  });

  describe("getTableById", () => {
    it("should fetch table by ID successfully", async () => {
      const mockTable = {
        id: 1,
        restaurantId: "test-restaurant-1",
        number: "T01",
        capacity: 4,
        isOccupied: false,
      };

      mockTableService.getTableById.mockResolvedValue(mockTable);

      const result = await tablesService.getTableById(1);

      expect(mockTableService.getTableById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockTable);
    });

    it("should return null when table not found", async () => {
      mockTableService.getTableById.mockResolvedValue(null);

      const result = await tablesService.getTableById(999);

      expect(result).toBeNull();
    });
  });

  describe("createTable", () => {
    it("should create table successfully", async () => {
      const tableData: CreateTableData = {
        restaurantId: "test-restaurant-1",
        number: "T01",
        capacity: 4,
        floor: 1,
      };

      const mockCreatedTable = {
        id: 1,
        ...tableData,
        isOccupied: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTableService.createTable.mockResolvedValue(mockCreatedTable);

      const result = await tablesService.createTable(tableData);

      // Service converts restaurantId to string for database layer
      expect(mockTableService.createTable).toHaveBeenCalledWith({
        ...tableData,
        restaurantId: "test-restaurant-1",
      });
      expect(result).toEqual(mockCreatedTable);
    });

    it("should handle errors when creating table", async () => {
      const tableData: CreateTableData = {
        restaurantId: "test-restaurant-1",
        number: "T01",
        capacity: 4,
      };

      mockTableService.createTable.mockRejectedValue(
        new Error("Duplicate table number"),
      );

      await expect(tablesService.createTable(tableData)).rejects.toThrow(
        "Failed to create table",
      );
    });
  });

  describe("updateTable", () => {
    it("should update table successfully", async () => {
      const updateData: UpdateTableData = {
        capacity: 6,
        maintenanceNotes: "Updated capacity",
      };

      const mockUpdatedTable = {
        id: 1,
        restaurantId: "test-restaurant-1",
        number: "T01",
        capacity: 6,
        maintenanceNotes: "Updated capacity",
        isOccupied: false,
        isActive: true,
      };

      mockTableService.updateTable.mockResolvedValue(mockUpdatedTable);

      const result = await tablesService.updateTable(1, updateData);

      expect(mockTableService.updateTable).toHaveBeenCalledWith(1, updateData);
      expect(result).toEqual(mockUpdatedTable);
    });
  });

  describe("deleteTable", () => {
    it("should delete table successfully", async () => {
      mockTableService.deleteTable.mockResolvedValue(true);

      const result = await tablesService.deleteTable(1);

      expect(mockTableService.deleteTable).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it("should return false when deletion fails", async () => {
      mockTableService.deleteTable.mockResolvedValue(false);

      const result = await tablesService.deleteTable(1);

      expect(result).toBe(false);
    });
  });

  describe("occupyTable", () => {
    it("should occupy table successfully", async () => {
      mockTableService.occupyTable.mockResolvedValue(true);

      const result = await tablesService.occupyTable(1, 100, "John Doe", 60);

      expect(mockTableService.occupyTable).toHaveBeenCalledWith(
        1,
        100,
        "John Doe",
        60,
      );
      expect(result).toBe(true);
    });
  });

  describe("releaseTable", () => {
    it("should release table successfully", async () => {
      mockTableService.releaseTable.mockResolvedValue(true);

      const result = await tablesService.releaseTable(1);

      expect(mockTableService.releaseTable).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });

  describe("permission validation", () => {
    it("should validate table access for admin users", () => {
      const table = { id: 1, restaurantId: "test-restaurant-1" } as any;

      const result = tablesService.validateTableAccess(
        table,
        "test-restaurant-2",
        true,
      );

      expect(result).toBe(true);
    });

    it("should validate table access for restaurant owners", () => {
      const table = { id: 1, restaurantId: "test-restaurant-1" } as any;

      const result = tablesService.validateTableAccess(
        table,
        "test-restaurant-1",
        false,
      );

      expect(result).toBe(true);
    });

    it("should deny table access for different restaurant", () => {
      const table = { id: 1, restaurantId: "test-restaurant-1" } as any;

      const result = tablesService.validateTableAccess(
        table,
        "test-restaurant-2",
        false,
      );

      expect(result).toBe(false);
    });

    it("should validate restaurant access for admin users", () => {
      const result = tablesService.validateRestaurantAccess(
        "test-restaurant-1",
        "test-restaurant-2",
        true,
      );

      expect(result).toBe(true);
    });

    it("should validate restaurant access for same restaurant", () => {
      const result = tablesService.validateRestaurantAccess(
        "test-restaurant-1",
        "test-restaurant-1",
        false,
      );

      expect(result).toBe(true);
    });

    it("should deny restaurant access for different restaurant", () => {
      const result = tablesService.validateRestaurantAccess(
        "test-restaurant-1",
        "test-restaurant-2",
        false,
      );

      expect(result).toBe(false);
    });
  });

  describe("getPublicTableInfo", () => {
    it("should return only public table information", () => {
      const table = {
        id: 1,
        restaurantId: "test-restaurant-1",
        number: "T01",
        name: "Window Table",
        capacity: 4,
        location: "Near window",
        floor: 1,
        section: "Main dining",
        features: { hasView: true },
        isActive: true,
        isOccupied: false,
        // Private fields that should not be included
        orderId: 100,
        occupiedBy: "John Doe",
        maintenanceNotes: "Private notes",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const result = tablesService.getPublicTableInfo(table);

      expect(result).toEqual({
        id: 1,
        restaurantId: "test-restaurant-1",
        number: "T01",
        name: "Window Table",
        capacity: 4,
        location: "Near window",
        floor: 1,
        section: "Main dining",
        features: { hasView: true },
        isActive: true,
        isOccupied: false,
      });

      // Ensure private fields are not included
      expect(result).not.toHaveProperty("orderId");
      expect(result).not.toHaveProperty("occupiedBy");
      expect(result).not.toHaveProperty("maintenanceNotes");
      expect(result).not.toHaveProperty("createdAt");
      expect(result).not.toHaveProperty("updatedAt");
    });
  });

  describe("response helpers", () => {
    it("should create success response", () => {
      const data = { id: 1, name: "Test Table" };
      const message = "Success";

      const result = tablesService.createSuccessResponse(data, message);

      expect(result).toEqual({
        success: true,
        data,
        message,
      });
    });

    it("should create error response", () => {
      const error = "Something went wrong";

      const result = tablesService.createErrorResponse(error);

      expect(result).toEqual({
        success: false,
        error,
      });
    });
  });
});
