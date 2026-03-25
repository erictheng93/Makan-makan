/**
 * TableService Unit Tests
 *
 * Tests table management including:
 * - Table CRUD operations
 * - Table occupancy management
 * - QR code generation
 * - Table availability and statistics
 * - Dual-mode QR support (table/seat)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock query-cache utilities
vi.mock("../../utils/query-cache", () => {
  class MockQueryCache {
    constructor(_kv: any) {}
    async getOrExecute<T>(
      _cacheKey: string,
      queryFn: () => Promise<T>,
      _options?: any,
    ): Promise<T> {
      return await queryFn();
    }
    async invalidate(
      _keyOrTags: string | string[],
      _type: "key" | "tag" = "key",
    ): Promise<void> {}
    async getStats() {
      return { total_keys: 0, hit_rate: 0, popular_queries: [] };
    }
  }
  return {
    QueryCache: MockQueryCache,
    buildCacheKey: (
      _resource: string,
      _identifier: string | number,
      _suffix?: string,
    ) => {
      const key = `query:${_resource}:${_identifier}`;
      return _suffix ? `${key}:${_suffix}` : key;
    },
  };
});

// Mock connection-manager
vi.mock("../../utils/connection-manager", () => ({
  getConnectionManager: vi.fn(() => ({
    executeQuery: vi.fn(async (queryFn) => await queryFn()),
  })),
}));

// Mock seat service - use a class mock for proper constructor support
vi.mock("../seat", () => {
  return {
    SeatService: class MockSeatService {
      createSeatsForTable = vi.fn().mockResolvedValue([
        { id: 1, tableId: 1, seatNumber: "1", isOccupied: false },
        { id: 2, tableId: 1, seatNumber: "2", isOccupied: false },
      ]);
      deleteSeatsForTable = vi.fn().mockResolvedValue(true);
      getSeatsByTableId = vi.fn().mockResolvedValue({ seats: [], total: 0 });
    },
  };
});

import { TableService } from "../table";
import {
  createMockDatabase,
  createMockEnv,
  setupMockDbResponses,
  createQueryChain,
} from "./helpers/mockD1";
import type { CreateTableData, UpdateTableData, TableFilters } from "../table";

describe("TableService", () => {
  let tableService: TableService;
  let mockDb: any;
  let mockEnv: any;

  // Mock data
  const mockRestaurant = {
    id: 1,
    name: "Test Restaurant",
    isAvailable: true,
  };

  const mockTable = {
    id: 1,
    restaurantId: "R-001",
    number: "T1",
    name: "Table 1",
    capacity: 4,
    location: "Main Hall",
    floor: 1,
    section: "Window",
    features: {
      hasChargingPort: true,
      hasWifi: true,
      isAccessible: false,
    },
    isActive: true,
    isOccupied: false,
    isReservable: true,
    qrCode: "QR-1-T1",
    qrMode: "table",
    seatCount: 0,
    occupiedBy: null,
    occupiedAt: null,
    estimatedReleaseTime: null,
    lastCleanedAt: new Date("2024-01-01"),
    lastOccupiedAt: null,
    totalOrders: 0,
    totalRevenue: 0,
    averageOccupancyMinutes: 0,
    maintenanceNotes: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const validTableData: CreateTableData = {
    restaurantId: "R-001",
    number: "T1",
    name: "Table 1",
    capacity: 4,
    location: "Main Hall",
    floor: 1,
    section: "Window",
    features: {
      hasChargingPort: true,
      hasWifi: true,
    },
    isReservable: true,
    qrMode: "table",
    seatCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDatabase();
    mockEnv = createMockEnv({
      JWT_SECRET: "test-jwt-secret-key",
    });
    tableService = new TableService(mockDb, mockEnv);
  });

  describe("createTable", () => {
    it("should create table successfully", async () => {
      // Arrange
      mockDb.select.mockReturnValue(createQueryChain([]));

      setupMockDbResponses(mockDb, {
        insert: [mockTable],
      });

      // Act
      const result = await tableService.createTable(validTableData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.number).toBe("T1");
      expect(result.capacity).toBe(4);
    });

    it("should throw error when table number already exists", async () => {
      // Arrange - select().from().where().get() returns existing table
      mockDb.select.mockReturnValue(createQueryChain([{ id: 1 }]));

      // Act & Assert - service throws directly before handleError translates it
      await expect(tableService.createTable(validTableData)).rejects.toThrow(
        "Table number already exists in this restaurant",
      );
    });

    it("should create table with seat mode", async () => {
      // Arrange
      const tableWithSeats: CreateTableData = {
        ...validTableData,
        qrMode: "seat",
        seatCount: 4,
        seatNumberingStyle: "numeric",
      };

      mockDb.select.mockReturnValue(createQueryChain([]));

      setupMockDbResponses(mockDb, {
        insert: [{ ...mockTable, qrMode: "seat", seatCount: 4 }],
      });

      // Act
      const result = await tableService.createTable(tableWithSeats);

      // Assert
      expect(result).toBeDefined();
      expect(result.qrMode).toBe("seat");
      expect(result.seatCount).toBe(4);
    });

    it("should create table with default values", async () => {
      // Arrange
      const minimalData: CreateTableData = {
        restaurantId: "R-001",
        number: "T2",
        capacity: 2,
      };

      mockDb.select.mockReturnValue(createQueryChain([]));

      setupMockDbResponses(mockDb, {
        insert: [
          {
            ...mockTable,
            number: "T2",
            capacity: 2,
            qrMode: "table",
            seatCount: 0,
          },
        ],
      });

      // Act
      const result = await tableService.createTable(minimalData);

      // Assert
      expect(result).toBeDefined();
      expect(result.qrMode).toBe("table");
      expect(result.seatCount).toBe(0);
    });
  });

  describe("getTableById", () => {
    it("should fetch table by id with related data", async () => {
      // Arrange - getTableById uses select().from().leftJoin().where().get()
      mockDb.select.mockReturnValue(
        createQueryChain([
          {
            ...mockTable,
            restaurantName: mockRestaurant.name,
          },
        ]),
      );

      // Act
      const result = await tableService.getTableById(1);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.number).toBe("T1");
    });

    it("should return null when table not found", async () => {
      // Arrange - .get() returns null when no results
      mockDb.select.mockReturnValue(createQueryChain([]));

      // Act
      const result = await tableService.getTableById(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getTableByQRCode", () => {
    it("should fetch table by QR code", async () => {
      // Arrange - getTableByQRCode uses select().from().where().get()
      mockDb.select.mockReturnValue(createQueryChain([mockTable]));

      // Act
      const result = await tableService.getTableByQRCode("QR-1-T1");

      // Assert
      expect(result).toBeDefined();
      expect(result.qrCode).toBe("QR-1-T1");
    });

    it("should return null when QR code not found", async () => {
      // Arrange - .get() returns null when no results
      mockDb.select.mockReturnValue(createQueryChain([]));

      // Act
      const result = await tableService.getTableByQRCode("INVALID-QR");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("updateTable", () => {
    it("should update table successfully", async () => {
      // Arrange
      const updateData: UpdateTableData = {
        name: "Updated Table",
        capacity: 6,
        location: "VIP Section",
      };

      const updatedTable = {
        ...mockTable,
        ...updateData,
      };

      setupMockDbResponses(mockDb, {
        update: [updatedTable],
      });

      // Act
      const result = await tableService.updateTable(1, updateData);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe("Updated Table");
      expect(result.capacity).toBe(6);
      expect(result.location).toBe("VIP Section");
    });

    it("should return undefined when table not found", async () => {
      // Arrange - updateTable returns undefined when no rows updated
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([])),
      });

      // Act
      const result = await tableService.updateTable(999, { name: "Test" });

      // Assert
      expect(result).toBeUndefined();
    });

    it("should update table status", async () => {
      // Arrange
      const updatedTable = {
        ...mockTable,
        isActive: false,
      };

      setupMockDbResponses(mockDb, {
        update: [updatedTable],
      });

      // Act
      const result = await tableService.updateTable(1, { isActive: false });

      // Assert
      expect(result.isActive).toBe(false);
    });
  });

  describe("deleteTable", () => {
    it("should delete table successfully", async () => {
      // Arrange - deleteTable uses update, not delete
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([{ id: 1 }])),
      });

      // Act
      const result = await tableService.deleteTable(1);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when no rows matched (non-existent table)", async () => {
      // Arrange - returning() returns empty array when no rows matched
      const chain = createQueryChain([]);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(chain),
      });

      // Act
      const result = await tableService.deleteTable(999);

      // Assert
      expect(result).toBe(false); // No rows returned from .returning()
    });
  });

  describe("getRestaurantTables", () => {
    it("should fetch all tables for a restaurant", async () => {
      // Arrange - getRestaurantTables uses select for both tables and count
      const tables = [mockTable, { ...mockTable, id: 2, number: "T2" }];

      // First select: table list
      mockDb.select.mockReturnValueOnce(createQueryChain(tables));
      // Second select: count
      mockDb.select.mockReturnValueOnce(createQueryChain([{ total: 2 }]));

      // Act
      const result = await tableService.getRestaurantTables("1");

      // Assert
      expect(result.tables).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
    });

    it("should filter by floor", async () => {
      // Arrange
      mockDb.select.mockReturnValueOnce(createQueryChain([mockTable]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ total: 1 }]));

      const filters: Omit<TableFilters, "restaurantId"> = {
        floor: 1,
      };

      // Act
      const result = await tableService.getRestaurantTables("1", filters);

      // Assert
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].floor).toBe(1);
    });

    it("should filter by occupied status", async () => {
      // Arrange
      mockDb.select.mockReturnValueOnce(createQueryChain([mockTable]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ total: 1 }]));

      const filters: Omit<TableFilters, "restaurantId"> = {
        isOccupied: false,
      };

      // Act
      const result = await tableService.getRestaurantTables("1", filters);

      // Assert
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].isOccupied).toBe(false);
    });

    it("should filter by capacity range", async () => {
      // Arrange
      mockDb.select.mockReturnValueOnce(createQueryChain([mockTable]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ total: 1 }]));

      const filters: Omit<TableFilters, "restaurantId"> = {
        minCapacity: 2,
        maxCapacity: 6,
      };

      // Act
      const result = await tableService.getRestaurantTables("1", filters);

      // Assert
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].capacity).toBeGreaterThanOrEqual(2);
      expect(result.tables[0].capacity).toBeLessThanOrEqual(6);
    });

    it("should search by table number or name", async () => {
      // Arrange
      mockDb.select.mockReturnValueOnce(createQueryChain([mockTable]));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ total: 1 }]));

      const filters: Omit<TableFilters, "restaurantId"> = {
        search: "T1",
      };

      // Act
      const result = await tableService.getRestaurantTables("1", filters);

      // Assert
      expect(result.tables).toHaveLength(1);
    });
  });

  describe("occupyTable", () => {
    it("should occupy table successfully", async () => {
      // Arrange
      const occupiedTable = {
        ...mockTable,
        isOccupied: true,
        occupiedBy: "Customer A",
        occupiedAt: new Date(),
      };

      setupMockDbResponses(mockDb, {
        update: [occupiedTable],
      });

      // Act
      const result = await tableService.occupyTable(1, 1, "Customer A", 60);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when no rows matched", async () => {
      // Arrange - returning() returns empty array when no rows matched
      const chain = createQueryChain([]);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(chain),
      });

      // Act
      const result = await tableService.occupyTable(1, 1);

      // Assert
      expect(result).toBe(false); // No rows returned from .returning()
    });
  });

  describe("releaseTable", () => {
    it("should release table successfully", async () => {
      // Arrange
      mockDb.query = {
        tables: {
          findFirst: vi.fn().mockResolvedValue(mockTable),
        },
      };

      mockDb.update.mockReturnValue({
        set: vi
          .fn()
          .mockReturnValue(
            createQueryChain([{ ...mockTable, isOccupied: false }]),
          ),
      });

      // Act
      const result = await tableService.releaseTable(1);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when no rows matched", async () => {
      // Arrange - select().from().where().get() returns null (no table found)
      mockDb.select.mockReturnValue(createQueryChain([]));

      // update().set().where().returning() returns empty (no rows matched)
      const chain = createQueryChain([]);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(chain),
      });

      // Act
      const result = await tableService.releaseTable(999);

      // Assert
      expect(result).toBe(false); // No rows returned from .returning()
    });
  });

  describe("markTableCleaned", () => {
    it("should mark table as cleaned", async () => {
      // Arrange
      mockDb.update.mockReturnValue({
        set: vi
          .fn()
          .mockReturnValue(
            createQueryChain([{ ...mockTable, lastCleanedAt: new Date() }]),
          ),
      });

      // Act
      const result = await tableService.markTableCleaned(
        1,
        "Cleaned and sanitized",
      );

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when no rows matched", async () => {
      // Arrange - returning() returns empty array when no rows matched
      const chain = createQueryChain([]);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(chain),
      });

      // Act
      const result = await tableService.markTableCleaned(999);

      // Assert
      expect(result).toBe(false); // No rows returned from .returning()
    });
  });

  describe("getAvailableTables", () => {
    it("should fetch available tables", async () => {
      // Arrange
      const availableTables = [
        mockTable,
        { ...mockTable, id: 2, number: "T2", capacity: 6 },
      ];

      mockDb.select.mockReturnValue(createQueryChain(availableTables));

      // Act
      const result = await tableService.getAvailableTables("R-001");

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].isOccupied).toBe(false);
      expect(result[0].isActive).toBe(true);
    });

    it("should filter by minimum capacity", async () => {
      // Arrange
      const largeTables = [{ ...mockTable, id: 2, capacity: 6 }];

      mockDb.select.mockReturnValue(createQueryChain(largeTables));

      // Act
      const result = await tableService.getAvailableTables("1", 6);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].capacity).toBeGreaterThanOrEqual(6);
    });

    it("should return empty array when no tables available", async () => {
      // Arrange
      mockDb.select.mockReturnValue(createQueryChain([]));

      // Act
      const result = await tableService.getAvailableTables("R-001");

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe("getTableStats", () => {
    it("should return table statistics", async () => {
      // Arrange - Multiple select queries with correct aliases
      // Query 1: Conditional aggregation counts + avgOccupancyMinutes
      mockDb.select.mockReturnValueOnce(
        createQueryChain([
          {
            totalTables: 10,
            occupiedTables: 3,
            availableTables: 7,
            inactiveTables: 0,
            avgOccupancyMinutes: 35,
          },
        ]),
      );
      // Query 2: Distribution rows (floor, section, capacity)
      mockDb.select.mockReturnValueOnce(
        createQueryChain([
          { floor: 1, section: "Window", capacity: 2 },
          { floor: 1, section: "Window", capacity: 4 },
          { floor: 1, section: "Center", capacity: 4 },
          { floor: 1, section: "Center", capacity: 4 },
          { floor: 1, section: "Center", capacity: 4 },
          { floor: 2, section: "Center", capacity: 4 },
          { floor: 2, section: "Window", capacity: 4 },
          { floor: 2, section: "Window", capacity: 6 },
          { floor: 2, section: "Center", capacity: 6 },
          { floor: 2, section: "Center", capacity: 2 },
        ]),
      );

      // Act
      const result = await tableService.getTableStats("R-001");

      // Assert
      expect(result.totalTables).toBe(10);
      expect(result.occupiedTables).toBe(3);
      expect(result.availableTables).toBe(7);
      expect(result.byFloor[1]).toBe(5);
      expect(result.byFloor[2]).toBe(5);
      expect(result.bySection["Window"]).toBe(4);
      expect(result.bySection["Center"]).toBe(6);
      expect(result.byCapacity[4]).toBe(6);
      expect(result.avgOccupancyMinutes).toBe(35);
    });

    it("should return zero stats when no tables exist", async () => {
      // Arrange - Query 1: aggregation returns zeros
      mockDb.select.mockReturnValueOnce(
        createQueryChain([
          {
            totalTables: 0,
            occupiedTables: 0,
            availableTables: 0,
            inactiveTables: 0,
            avgOccupancyMinutes: 0,
          },
        ]),
      );
      // Query 2: no distribution rows
      mockDb.select.mockReturnValueOnce(createQueryChain([]));

      // Act
      const result = await tableService.getTableStats("R-001");

      // Assert
      expect(result.totalTables).toBe(0);
      expect(result.occupiedTables).toBe(0);
      expect(result.averageOccupancyRate).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors in createTable", async () => {
      // Arrange - select() throws a database error
      mockDb.select.mockImplementation(() => {
        throw new Error("Database error");
      });

      // Act & Assert - handleError re-throws the original error message
      await expect(tableService.createTable(validTableData)).rejects.toThrow(
        "Database error",
      );
    });

    it("should handle database errors in getRestaurantTables", async () => {
      // Arrange - getRestaurantTables uses this.db.select(), not query API
      mockDb.select.mockImplementation(() => {
        throw new Error("Database error");
      });

      // Act & Assert
      await expect(tableService.getRestaurantTables("1")).rejects.toThrow(
        "Database error",
      );
    });

    it("should handle database errors in getTableStats", async () => {
      // Arrange
      mockDb.select.mockImplementation(() => {
        throw new Error("Database error");
      });

      // Act & Assert
      await expect(tableService.getTableStats("R-001")).rejects.toThrow(
        "Database error",
      );
    });
  });
});
