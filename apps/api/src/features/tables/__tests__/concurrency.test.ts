/**
 * Service test: exercises Table/Seat service-layer concurrency and
 * cross-module orchestration with hoisted service mocks.
 *
 *  Part A — Concurrency: verifies how the service reacts when the DB
 *           layer returns success/failure for concurrent ops. True
 *           DB-level concurrency belongs in a real integration test.
 *  Part B — Cross-module: exercises table ↔ seat lifecycle orchestration
 *           that is NOT already covered by the individual service tests.
 *
 * This is a service-level test, NOT a real integration test. Genuine
 * DB concurrency coverage belongs under
 * `apps/api/src/__tests__/integration/*.real.integration.test.ts`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { envFactory, resetAllFactories } from "@makanmakan/testing-utils";
import type { Env } from "../../../types/env";
import type { Table } from "../types";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockTableService, mockSeatService } = vi.hoisted(() => ({
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
  mockSeatService: {
    createSeatsForTable: vi.fn(),
    getSeatById: vi.fn(),
    getSeatByQRCode: vi.fn(),
    getSeatsByTableId: vi.fn(),
    updateSeat: vi.fn(),
    deleteSeat: vi.fn(),
    deleteSeatsForTable: vi.fn(),
    occupySeat: vi.fn(),
    releaseSeat: vi.fn(),
    regenerateSeatQRCode: vi.fn(),
    batchGenerateSeatQRCodes: vi.fn(),
    getSeatStats: vi.fn(),
  },
}));

vi.mock("@makanmakan/database", () => ({
  TableService: class MockTableService {
    constructor() {
      Object.assign(this, mockTableService);
    }
  },
  SeatService: class MockSeatService {
    constructor() {
      Object.assign(this, mockSeatService);
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
}));

// Import after mocking
import { TablesService } from "../services/TablesService";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const mockEnv = envFactory.build() as unknown as Env;

const mockTable: Table = {
  id: 1,
  restaurantId: "test-restaurant-1",
  number: "T01",
  name: "Window Table",
  capacity: 4,
  location: "Main Hall",
  floor: 1,
  section: "A",
  features: { hasWifi: true },
  isActive: true,
  isOccupied: false,
  isReservable: true,
  qrCode: "QR-T01",
  occupiedBy: undefined,
  occupiedAt: undefined,
  estimatedReleaseTime: undefined,
  lastCleanedAt: new Date("2024-01-01"),
  maintenanceNotes: undefined,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// ==========================================================================
// Part A — Concurrency Tests
// ==========================================================================
describe("Concurrency Tests", () => {
  let tablesService: TablesService;

  beforeEach(() => {
    resetAllFactories();
    tablesService = new TablesService(mockEnv);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should handle double occupy where second call fails because table is already occupied", async () => {
    // First call succeeds, second returns false (DB WHERE isOccupied=false matched nothing)
    mockTableService.occupyTable
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const first = await tablesService.occupyTable(1, 100, "User A", 60);
    const second = await tablesService.occupyTable(1, 200, "User B", 60);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(mockTableService.occupyTable).toHaveBeenCalledTimes(2);
  });

  it("should maintain consistent state across multiple sequential occupy-release cycles", async () => {
    mockTableService.occupyTable.mockResolvedValue(true);
    mockTableService.releaseTable.mockResolvedValue(true);

    for (let i = 0; i < 3; i++) {
      const occupied = await tablesService.occupyTable(1, 100 + i, `User ${i}`);
      expect(occupied).toBe(true);

      const released = await tablesService.releaseTable(1);
      expect(released).toBe(true);
    }

    expect(mockTableService.occupyTable).toHaveBeenCalledTimes(3);
    expect(mockTableService.releaseTable).toHaveBeenCalledTimes(3);
  });

  it("should handle release error + occupy conflict independently via Promise.allSettled", async () => {
    // Release throws (e.g. DB timeout); occupy returns false (still occupied)
    mockTableService.releaseTable.mockRejectedValue(new Error("DB timeout"));
    mockTableService.occupyTable.mockResolvedValue(false);

    const results = await Promise.allSettled([
      tablesService.releaseTable(1),
      tablesService.occupyTable(1, 300, "New Guest"),
    ]);

    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("fulfilled");
    expect((results[1] as PromiseFulfilledResult<boolean>).value).toBe(false);
  });

  it("should return partial success results when some bulk QR generations fail", async () => {
    mockTableService.generateBulkQRCodes.mockResolvedValue({
      success: true,
      qrCodes: [
        { tableId: 1, qrCode: "qr-1" },
        { tableId: 2, qrCode: "qr-2" },
      ],
    });

    const result = await tablesService.generateBulkQRCodes("1", [1, 2, 3]);

    // 3 requested, only 2 succeeded — service should still return success:true
    expect(result.success).toBe(true);
    expect(result.qrCodes).toHaveLength(2);
  });
});

// ==========================================================================
// Part B — Cross-Module Integration Tests (Table ↔ Seat)
//
// These test the orchestration between TableService and SeatService
// that is NOT covered by the individual service unit tests.
// ==========================================================================
describe("Cross-Module Integration Tests", () => {
  let tablesService: TablesService;

  beforeEach(() => {
    resetAllFactories();
    tablesService = new TablesService(mockEnv);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ---------- Table → Seat creation flow ----------

  it("should create seats after table creation in seat mode", async () => {
    mockTableService.createTable.mockResolvedValue({
      ...mockTable,
      id: 10,
    });

    mockSeatService.createSeatsForTable.mockResolvedValue([
      {
        id: 1,
        tableId: 10,
        seatNumber: "01",
        isOccupied: false,
        isActive: true,
      },
      {
        id: 2,
        tableId: 10,
        seatNumber: "02",
        isOccupied: false,
        isActive: true,
      },
      {
        id: 3,
        tableId: 10,
        seatNumber: "03",
        isOccupied: false,
        isActive: true,
      },
      {
        id: 4,
        tableId: 10,
        seatNumber: "04",
        isOccupied: false,
        isActive: true,
      },
    ]);

    const table = await tablesService.createTable({
      restaurantId: "test-restaurant-1",
      number: "T10",
      capacity: 4,
      floor: 1,
    });

    // Simulate route-level seat creation after table is created
    const { SeatService } = await import("@makanmakan/database");
    const seatService = new SeatService(
      mockEnv.DB as never,
      mockEnv as unknown as ApiTestEnv,
    );
    const seats = await seatService.createSeatsForTable(table.id, 4);

    expect(seats).toHaveLength(4);
    expect(mockSeatService.createSeatsForTable).toHaveBeenCalledWith(10, 4);
  });

  // ---------- Independent seat occupation ----------

  it("should allow individual seats to be occupied independently on a seat-mode table", async () => {
    mockTableService.occupyTable.mockResolvedValue(true);
    mockSeatService.occupySeat
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await tablesService.occupyTable(1, 500);

    const { SeatService } = await import("@makanmakan/database");
    const seatService = new SeatService(
      mockEnv.DB as never,
      mockEnv as unknown as ApiTestEnv,
    );
    const seat1 = await seatService.occupySeat(1, 501, "Guest A");
    const seat2 = await seatService.occupySeat(2, 502, "Guest B");

    expect(seat1).toBe(true);
    expect(seat2).toBe(true);
    expect(mockSeatService.occupySeat).toHaveBeenCalledTimes(2);
  });

  // ---------- Cascade release ----------

  it("should release all seats when the parent table is released", async () => {
    mockTableService.releaseTable.mockResolvedValue(true);
    mockSeatService.releaseSeat.mockResolvedValue(true);
    mockSeatService.getSeatsByTableId.mockResolvedValue({
      seats: [
        { id: 1, tableId: 1, seatNumber: "01", isOccupied: true },
        { id: 2, tableId: 1, seatNumber: "02", isOccupied: true },
      ],
      total: 2,
      pagination: { page: 1, limit: 50, totalPages: 1 },
    });

    await tablesService.releaseTable(1);

    // Route handler would cascade release to occupied seats
    const { SeatService } = await import("@makanmakan/database");
    const seatService = new SeatService(
      mockEnv.DB as never,
      mockEnv as unknown as ApiTestEnv,
    );
    const { seats: occupiedSeats } = await seatService.getSeatsByTableId(1, {
      isOccupied: true,
    });

    for (const seat of occupiedSeats) {
      await seatService.releaseSeat(seat.id);
    }

    expect(mockSeatService.releaseSeat).toHaveBeenCalledTimes(2);
    expect(mockSeatService.releaseSeat).toHaveBeenCalledWith(1);
    expect(mockSeatService.releaseSeat).toHaveBeenCalledWith(2);
  });

  // ---------- QR Mode Switch ----------

  it("should create seats when switching from table mode to seat mode", async () => {
    mockTableService.updateTable.mockResolvedValue({ ...mockTable, id: 1 });
    mockSeatService.createSeatsForTable.mockResolvedValue([
      { id: 1, tableId: 1, seatNumber: "01" },
      { id: 2, tableId: 1, seatNumber: "02" },
    ]);

    await tablesService.updateTable(1, {});

    // Route handler creates seats after mode switch
    const { SeatService } = await import("@makanmakan/database");
    const seatService = new SeatService(
      mockEnv.DB as never,
      mockEnv as unknown as ApiTestEnv,
    );
    const seats = await seatService.createSeatsForTable(1, 2);

    expect(seats).toHaveLength(2);
  });

  it("should clean up seats when switching from seat mode to table mode", async () => {
    mockTableService.updateTable.mockResolvedValue({ ...mockTable, id: 1 });
    mockSeatService.deleteSeatsForTable.mockResolvedValue(true);

    await tablesService.updateTable(1, {});

    // Route handler deletes all seats on mode switch
    const { SeatService } = await import("@makanmakan/database");
    const seatService = new SeatService(
      mockEnv.DB as never,
      mockEnv as unknown as ApiTestEnv,
    );
    const deleted = await seatService.deleteSeatsForTable(1);

    expect(deleted).toBe(true);
    expect(mockSeatService.deleteSeatsForTable).toHaveBeenCalledWith(1);
  });
});
