/**
 * SeatService Unit Tests
 *
 * Tests seat management including:
 * - Seat creation with numbering styles (numeric, alphabetic, custom)
 * - Seat retrieval by ID and QR code (with joined data)
 * - Paginated seat listing with filters
 * - Seat update and soft/hard delete
 * - Seat occupy and release lifecycle
 * - QR code regeneration (single and batch)
 * - Seat statistics calculation
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

import { SeatService } from "../seat";
import {
  createMockDatabase,
  createMockEnv,
  setupMockDbResponses,
  createQueryChain,
} from "./helpers/mockD1";

describe("SeatService", () => {
  let seatService: SeatService;
  let mockDb: any;
  let mockEnv: any;

  // Mock data
  const mockTable = {
    id: 1,
    restaurantId: "R-001",
    number: "T1",
  };

  const mockSeat = {
    id: 1,
    tableId: 1,
    seatNumber: "01",
    seatName: null,
    position: null,
    qrCode: "https://makanmakan.com/order?data=eyJ0eXBlIjoic2VhdCJ9",
    qrCodeImageUrl: null,
    qrCodeVersion: 1,
    isOccupied: false,
    isActive: true,
    currentOrderId: null,
    occupiedAt: null,
    occupiedBy: null,
    totalUsage: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockSeatWithJoins = {
    ...mockSeat,
    tableNumber: "T1",
    restaurantId: "R-001",
    restaurantName: "Test Restaurant",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDatabase();
    mockEnv = createMockEnv({
      JWT_SECRET: "test-jwt-secret-key",
    });
    seatService = new SeatService(mockDb, mockEnv);
  });

  // ============================================
  // createSeatsForTable
  // ============================================
  describe("createSeatsForTable", () => {
    it("should create seats with numeric numbering", async () => {
      // Arrange - first select: table lookup via .get()
      mockDb.select.mockReturnValue(createQueryChain([mockTable]));

      // insert().values().returning() returns created seat
      const createdSeat1 = { ...mockSeat, id: 1, seatNumber: "01" };
      const createdSeat2 = { ...mockSeat, id: 2, seatNumber: "02" };
      const createdSeat3 = { ...mockSeat, id: 3, seatNumber: "03" };

      mockDb.insert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([createdSeat1]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([createdSeat2]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([createdSeat3]),
          }),
        });

      // Act
      const result = await seatService.createSeatsForTable(1, 3, {
        numberingStyle: "numeric",
      });

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].seatNumber).toBe("01");
      expect(result[1].seatNumber).toBe("02");
      expect(result[2].seatNumber).toBe("03");
      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });

    it("should create seats with alphabetic numbering", async () => {
      // Arrange
      mockDb.select.mockReturnValue(createQueryChain([mockTable]));

      const seatA = { ...mockSeat, id: 1, seatNumber: "A" };
      const seatB = { ...mockSeat, id: 2, seatNumber: "B" };

      mockDb.insert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([seatA]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([seatB]),
          }),
        });

      // Act
      const result = await seatService.createSeatsForTable(1, 2, {
        numberingStyle: "alphabetic",
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].seatNumber).toBe("A");
      expect(result[1].seatNumber).toBe("B");
    });

    it("should create seats with custom numbers when provided", async () => {
      // Arrange
      mockDb.select.mockReturnValue(createQueryChain([mockTable]));

      const seatVIP1 = { ...mockSeat, id: 1, seatNumber: "VIP-1" };
      const seatVIP2 = { ...mockSeat, id: 2, seatNumber: "VIP-2" };

      mockDb.insert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([seatVIP1]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([seatVIP2]),
          }),
        });

      // Act
      const result = await seatService.createSeatsForTable(1, 2, {
        numberingStyle: "custom",
        customNumbers: ["VIP-1", "VIP-2"],
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].seatNumber).toBe("VIP-1");
      expect(result[1].seatNumber).toBe("VIP-2");
    });

    it("should throw 'Table not found' when table does not exist", async () => {
      // Arrange - select().from().where().get() returns null (no table)
      mockDb.select.mockReturnValue(createQueryChain([]));

      // Act & Assert
      await expect(seatService.createSeatsForTable(999, 2)).rejects.toThrow(
        "Table not found",
      );
    });

    it("should handle prefix in numbering options", async () => {
      // Arrange
      mockDb.select.mockReturnValue(createQueryChain([mockTable]));

      const seatS01 = { ...mockSeat, id: 1, seatNumber: "S-01" };
      const seatS02 = { ...mockSeat, id: 2, seatNumber: "S-02" };

      mockDb.insert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([seatS01]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([seatS02]),
          }),
        });

      // Act
      const result = await seatService.createSeatsForTable(1, 2, {
        numberingStyle: "numeric",
        prefix: "S-",
      });

      // Assert
      expect(result).toHaveLength(2);
      // Verify insert was called (prefix is applied internally by generateSeatNumbers)
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it("should generate correct number of seats", async () => {
      // Arrange
      mockDb.select.mockReturnValue(createQueryChain([mockTable]));

      // Setup 5 insert calls
      for (let i = 0; i < 5; i++) {
        mockDb.insert.mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                ...mockSeat,
                id: i + 1,
                seatNumber: String(i + 1).padStart(2, "0"),
              },
            ]),
          }),
        });
      }

      // Act
      const result = await seatService.createSeatsForTable(1, 5);

      // Assert
      expect(result).toHaveLength(5);
      expect(mockDb.insert).toHaveBeenCalledTimes(5);
    });

    it("should handle DB error gracefully", async () => {
      // Arrange - table lookup succeeds
      mockDb.select.mockReturnValue(createQueryChain([mockTable]));

      // But insert throws
      mockDb.insert.mockImplementation(() => {
        throw new Error("D1 write error");
      });

      // Act & Assert
      await expect(seatService.createSeatsForTable(1, 2)).rejects.toThrow(
        "D1 write error",
      );
    });
  });

  // ============================================
  // getSeatById
  // ============================================
  describe("getSeatById", () => {
    it("should return seat with table and restaurant info (joined data)", async () => {
      // Arrange - select().from().leftJoin().leftJoin().where().get()
      mockDb.select.mockReturnValue(createQueryChain([mockSeatWithJoins]));

      // Act
      const result = await seatService.getSeatById(1);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.seatNumber).toBe("01");
      expect(result.tableNumber).toBe("T1");
      expect(result.restaurantId).toBe("R-001");
      expect(result.restaurantName).toBe("Test Restaurant");
    });

    it("should return null when seat not found", async () => {
      // Arrange - .get() returns null when no results
      mockDb.select.mockReturnValue(createQueryChain([]));

      // Act
      const result = await seatService.getSeatById(999);

      // Assert
      expect(result).toBeNull();
    });

    it("should handle DB error", async () => {
      // Arrange
      mockDb.select.mockImplementation(() => {
        throw new Error("Database connection lost");
      });

      // Act & Assert
      await expect(seatService.getSeatById(1)).rejects.toThrow(
        "Database connection lost",
      );
    });
  });

  // ============================================
  // getSeatByQRCode
  // ============================================
  describe("getSeatByQRCode", () => {
    it("should return seat by QR code with joined info", async () => {
      // Arrange
      const seatWithQR = {
        id: 1,
        tableId: 1,
        seatNumber: "01",
        seatName: null,
        position: null,
        qrCode: "https://makanmakan.com/order?data=abc123",
        isOccupied: false,
        isActive: true,
        currentOrderId: null,
        tableNumber: "T1",
        capacity: 4,
        restaurantId: "R-001",
        restaurantName: "Test Restaurant",
      };

      mockDb.select.mockReturnValue(createQueryChain([seatWithQR]));

      // Act
      const result = await seatService.getSeatByQRCode(
        "https://makanmakan.com/order?data=abc123",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.qrCode).toBe("https://makanmakan.com/order?data=abc123");
      expect(result.tableNumber).toBe("T1");
      expect(result.restaurantName).toBe("Test Restaurant");
    });

    it("should return null when QR not found", async () => {
      // Arrange
      mockDb.select.mockReturnValue(createQueryChain([]));

      // Act
      const result = await seatService.getSeatByQRCode("invalid-qr-code");

      // Assert
      expect(result).toBeNull();
    });

    it("should handle DB error", async () => {
      // Arrange
      mockDb.select.mockImplementation(() => {
        throw new Error("Query timeout");
      });

      // Act & Assert
      await expect(seatService.getSeatByQRCode("some-qr-code")).rejects.toThrow(
        "Query timeout",
      );
    });
  });

  // ============================================
  // getSeatsByTableId
  // ============================================
  describe("getSeatsByTableId", () => {
    it("should return paginated seats list with total count", async () => {
      // Arrange
      const seatsList = [
        { ...mockSeat, id: 1, seatNumber: "01" },
        { ...mockSeat, id: 2, seatNumber: "02" },
        { ...mockSeat, id: 3, seatNumber: "03" },
      ];

      // First select: seat list
      mockDb.select.mockReturnValueOnce(createQueryChain(seatsList));
      // Second select: count
      mockDb.select.mockReturnValueOnce(createQueryChain([{ total: 3 }]));

      // Act
      const result = await seatService.getSeatsByTableId(1);

      // Assert
      expect(result.seats).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.pagination).toBeDefined();
      expect(result.pagination!.page).toBe(1);
      expect(result.pagination!.limit).toBe(50);
      expect(result.pagination!.totalPages).toBe(1);
    });

    it("should apply isOccupied filter", async () => {
      // Arrange
      const occupiedSeats = [
        { ...mockSeat, id: 1, seatNumber: "01", isOccupied: true },
      ];

      mockDb.select.mockReturnValueOnce(createQueryChain(occupiedSeats));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ total: 1 }]));

      // Act
      const result = await seatService.getSeatsByTableId(1, {
        isOccupied: true,
      });

      // Assert
      expect(result.seats).toHaveLength(1);
      expect(result.seats[0].isOccupied).toBe(true);
      expect(result.total).toBe(1);
    });

    it("should apply isActive filter", async () => {
      // Arrange
      const activeSeats = [
        { ...mockSeat, id: 1, isActive: true },
        { ...mockSeat, id: 2, isActive: true },
      ];

      mockDb.select.mockReturnValueOnce(createQueryChain(activeSeats));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ total: 2 }]));

      // Act
      const result = await seatService.getSeatsByTableId(1, {
        isActive: true,
      });

      // Assert
      expect(result.seats).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("should filter by seatNumbers array", async () => {
      // Arrange
      const filteredSeats = [
        { ...mockSeat, id: 1, seatNumber: "01" },
        { ...mockSeat, id: 3, seatNumber: "03" },
      ];

      mockDb.select.mockReturnValueOnce(createQueryChain(filteredSeats));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ total: 2 }]));

      // Act
      const result = await seatService.getSeatsByTableId(1, {
        seatNumbers: ["01", "03"],
      });

      // Assert
      expect(result.seats).toHaveLength(2);
      expect(result.seats[0].seatNumber).toBe("01");
      expect(result.seats[1].seatNumber).toBe("03");
      expect(result.total).toBe(2);
    });

    it("should apply custom page and limit", async () => {
      // Arrange
      const pageSeats = [
        { ...mockSeat, id: 3, seatNumber: "03" },
        { ...mockSeat, id: 4, seatNumber: "04" },
      ];

      mockDb.select.mockReturnValueOnce(createQueryChain(pageSeats));
      mockDb.select.mockReturnValueOnce(createQueryChain([{ total: 10 }]));

      // Act
      const result = await seatService.getSeatsByTableId(1, {
        page: 2,
        limit: 2,
      });

      // Assert
      expect(result.seats).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.pagination!.page).toBe(2);
      expect(result.pagination!.limit).toBe(2);
      expect(result.pagination!.totalPages).toBe(5);
    });
  });

  // ============================================
  // updateSeat
  // ============================================
  describe("updateSeat", () => {
    it("should update seat fields successfully", async () => {
      // Arrange
      const updatedSeat = {
        ...mockSeat,
        seatName: "Window Seat",
        position: "left",
      };

      setupMockDbResponses(mockDb, {
        update: [updatedSeat],
      });

      // Act
      const result = await seatService.updateSeat(1, {
        seatName: "Window Seat",
        position: "left",
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.seatName).toBe("Window Seat");
      expect(result.position).toBe("left");
    });

    it("should return undefined when seat not found", async () => {
      // Arrange - returning() returns empty array
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([])),
      });

      // Act
      const result = await seatService.updateSeat(999, { seatName: "Test" });

      // Assert
      expect(result).toBeUndefined();
    });

    it("should handle DB error", async () => {
      // Arrange
      mockDb.update.mockImplementation(() => {
        throw new Error("D1 update error");
      });

      // Act & Assert
      await expect(
        seatService.updateSeat(1, { seatName: "Test" }),
      ).rejects.toThrow("D1 update error");
    });
  });

  // ============================================
  // deleteSeat (soft delete)
  // ============================================
  describe("deleteSeat", () => {
    it("should soft delete (set isActive=false)", async () => {
      // Arrange
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([{ id: 1 }])),
      });

      // Act
      const result = await seatService.deleteSeat(1);

      // Assert
      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should handle DB error", async () => {
      // Arrange
      mockDb.update.mockImplementation(() => {
        throw new Error("D1 delete error");
      });

      // Act & Assert
      await expect(seatService.deleteSeat(1)).rejects.toThrow(
        "D1 delete error",
      );
    });
  });

  // ============================================
  // deleteSeatsForTable (hard delete)
  // ============================================
  describe("deleteSeatsForTable", () => {
    it("should hard delete all seats for table", async () => {
      // Arrange - db.delete(seats).where() is awaitable
      mockDb.delete.mockReturnValue(createQueryChain([]));

      // Act
      const result = await seatService.deleteSeatsForTable(1);

      // Assert
      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should handle DB error", async () => {
      // Arrange
      mockDb.delete.mockImplementation(() => {
        throw new Error("D1 bulk delete error");
      });

      // Act & Assert
      await expect(seatService.deleteSeatsForTable(1)).rejects.toThrow(
        "D1 bulk delete error",
      );
    });
  });

  // ============================================
  // occupySeat
  // ============================================
  describe("occupySeat", () => {
    it("should set occupied state with orderId and occupiedBy", async () => {
      // Arrange - update for occupy
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([{ id: 1 }])),
      });

      // For updateSeatUsageStats: select then update
      // After occupy update, the private method fetches seat and updates usage
      mockDb.select.mockReturnValue(createQueryChain([{ totalUsage: 0 }]));

      // Act
      const result = await seatService.occupySeat(1, 100, "Customer A");

      // Assert
      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should update usage stats after occupy", async () => {
      // Arrange
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([{ id: 1 }])),
      });

      // updateSeatUsageStats calls select then update
      mockDb.select.mockReturnValue(createQueryChain([{ totalUsage: 5 }]));

      // Act
      const result = await seatService.occupySeat(1, 200);

      // Assert
      expect(result).toBe(true);
      // update called at least twice: once for occupy, once for usage stats
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should handle DB error", async () => {
      // Arrange
      mockDb.update.mockImplementation(() => {
        throw new Error("D1 update failed");
      });

      // Act & Assert
      await expect(
        seatService.occupySeat(1, 100, "Customer A"),
      ).rejects.toThrow("D1 update failed");
    });
  });

  // ============================================
  // releaseSeat
  // ============================================
  describe("releaseSeat", () => {
    it("should clear occupied state and increment totalUsage", async () => {
      // Arrange - first select: get seat usage data
      mockDb.select.mockReturnValue(
        createQueryChain([{ occupiedAt: new Date(), totalUsage: 3 }]),
      );

      // update: clear occupied state
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([{ id: 1 }])),
      });

      // Act
      const result = await seatService.releaseSeat(1);

      // Assert
      expect(result).toBe(true);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should handle missing seat gracefully (totalUsage defaults to 0)", async () => {
      // Arrange - select returns null for seat (via .get())
      mockDb.select.mockReturnValue(createQueryChain([]));

      // update still runs with (null?.totalUsage || 0) + 1 = 1
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([{ id: 1 }])),
      });

      // Act
      const result = await seatService.releaseSeat(999);

      // Assert
      expect(result).toBe(true);
    });

    it("should handle DB error", async () => {
      // Arrange
      mockDb.select.mockImplementation(() => {
        throw new Error("D1 read error");
      });

      // Act & Assert
      await expect(seatService.releaseSeat(1)).rejects.toThrow("D1 read error");
    });
  });

  // ============================================
  // regenerateSeatQRCode
  // ============================================
  describe("regenerateSeatQRCode", () => {
    it("should regenerate QR and increment version", async () => {
      // Arrange
      // First select: get seat data
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ tableId: 1, seatNumber: "01", qrCodeVersion: 1 }]),
      );
      // Second select: get table data
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ restaurantId: "R-001" }]),
      );

      // update: set new QR code
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([{ id: 1 }])),
      });

      // Act
      const result = await seatService.regenerateSeatQRCode(1);

      // Assert
      expect(result.success).toBe(true);
      expect(result.qrCode).toBeDefined();
      expect(result.qrCode).toContain("makanmakan.com/order?data=");
    });

    it("should return error when seat not found", async () => {
      // Arrange - select().from().where().get() returns null
      mockDb.select.mockReturnValue(createQueryChain([]));

      // Act
      const result = await seatService.regenerateSeatQRCode(999);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Seat not found");
    });

    it("should return error when table not found", async () => {
      // Arrange - seat found, but table not
      mockDb.select.mockReturnValueOnce(
        createQueryChain([
          { tableId: 999, seatNumber: "01", qrCodeVersion: 1 },
        ]),
      );
      // Table lookup returns null
      mockDb.select.mockReturnValueOnce(createQueryChain([]));

      // Act
      const result = await seatService.regenerateSeatQRCode(1);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Table not found");
    });

    it("should handle DB error and return failure", async () => {
      // Arrange - the method catches errors internally and returns { success: false }
      mockDb.select.mockImplementation(() => {
        throw new Error("D1 error");
      });

      // Act
      const result = await seatService.regenerateSeatQRCode(1);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to regenerate QR code");
    });
  });

  // ============================================
  // batchGenerateSeatQRCodes
  // ============================================
  describe("batchGenerateSeatQRCodes", () => {
    it("should regenerate QR codes for all seats of table", async () => {
      // Arrange
      // First select: table lookup via .get()
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ restaurantId: "R-001" }]),
      );
      // Second select: seat list (awaitable, returns array)
      mockDb.select.mockReturnValueOnce(
        createQueryChain([
          { id: 1, seatNumber: "01", qrCodeVersion: 1 },
          { id: 2, seatNumber: "02", qrCodeVersion: 1 },
        ]),
      );

      // Two update calls (one per seat)
      mockDb.update
        .mockReturnValueOnce({
          set: vi.fn().mockReturnValue(createQueryChain([{ id: 1 }])),
        })
        .mockReturnValueOnce({
          set: vi.fn().mockReturnValue(createQueryChain([{ id: 2 }])),
        });

      // Act
      const result = await seatService.batchGenerateSeatQRCodes(1);

      // Assert
      expect(result.success).toBe(true);
      expect(result.qrCodes).toHaveLength(2);
      expect(result.qrCodes![0].seatId).toBe(1);
      expect(result.qrCodes![0].seatNumber).toBe("01");
      expect(result.qrCodes![0].qrCode).toContain("makanmakan.com/order?data=");
      expect(result.qrCodes![1].seatId).toBe(2);
      expect(result.qrCodes![1].seatNumber).toBe("02");
    });

    it("should return error when table not found", async () => {
      // Arrange - table lookup returns null
      mockDb.select.mockReturnValue(createQueryChain([]));

      // Act
      const result = await seatService.batchGenerateSeatQRCodes(999);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Table not found");
    });

    it("should handle empty seats list", async () => {
      // Arrange
      // Table found
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ restaurantId: "R-001" }]),
      );
      // No seats for this table
      mockDb.select.mockReturnValueOnce(createQueryChain([]));

      // Act
      const result = await seatService.batchGenerateSeatQRCodes(1);

      // Assert
      expect(result.success).toBe(true);
      expect(result.qrCodes).toHaveLength(0);
    });
  });

  // ============================================
  // getSeatStats
  // ============================================
  describe("getSeatStats", () => {
    it("should return correct statistics", async () => {
      // Arrange - 4 separate count queries
      mockDb.select.mockReturnValueOnce(createQueryChain([{ totalSeats: 10 }]));
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ occupiedSeats: 3 }]),
      );
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ availableSeats: 6 }]),
      );
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ inactiveSeats: 1 }]),
      );

      // Act
      const result = await seatService.getSeatStats(1);

      // Assert
      expect(result.totalSeats).toBe(10);
      expect(result.occupiedSeats).toBe(3);
      expect(result.availableSeats).toBe(6);
      expect(result.inactiveSeats).toBe(1);
    });

    it("should calculate occupancy rate correctly", async () => {
      // Arrange
      mockDb.select.mockReturnValueOnce(createQueryChain([{ totalSeats: 8 }]));
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ occupiedSeats: 6 }]),
      );
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ availableSeats: 2 }]),
      );
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ inactiveSeats: 0 }]),
      );

      // Act
      const result = await seatService.getSeatStats(1);

      // Assert
      // occupancyRate = (6 / 8) * 100 = 75, rounded to 2 decimals
      expect(result.averageOccupancyRate).toBe(75);
    });

    it("should return zeros when no seats", async () => {
      // Arrange
      mockDb.select.mockReturnValueOnce(createQueryChain([{ totalSeats: 0 }]));
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ occupiedSeats: 0 }]),
      );
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ availableSeats: 0 }]),
      );
      mockDb.select.mockReturnValueOnce(
        createQueryChain([{ inactiveSeats: 0 }]),
      );

      // Act
      const result = await seatService.getSeatStats(1);

      // Assert
      expect(result.totalSeats).toBe(0);
      expect(result.occupiedSeats).toBe(0);
      expect(result.availableSeats).toBe(0);
      expect(result.inactiveSeats).toBe(0);
      expect(result.averageOccupancyRate).toBe(0);
    });
  });

  // ============================================
  // Error Handling (cross-cutting)
  // ============================================
  describe("Error Handling", () => {
    it("should handle DB errors in createSeatsForTable", async () => {
      // Arrange - select throws during table lookup
      mockDb.select.mockImplementation(() => {
        throw new Error("Database unavailable");
      });

      // Act & Assert
      await expect(seatService.createSeatsForTable(1, 3)).rejects.toThrow(
        "Database unavailable",
      );
    });

    it("should handle DB errors in getSeatsByTableId", async () => {
      // Arrange
      mockDb.select.mockImplementation(() => {
        throw new Error("Query execution failed");
      });

      // Act & Assert
      await expect(seatService.getSeatsByTableId(1)).rejects.toThrow(
        "Query execution failed",
      );
    });

    it("should handle DB errors in getSeatStats", async () => {
      // Arrange
      mockDb.select.mockImplementation(() => {
        throw new Error("Stats query failed");
      });

      // Act & Assert
      await expect(seatService.getSeatStats(1)).rejects.toThrow(
        "Stats query failed",
      );
    });
  });
});
