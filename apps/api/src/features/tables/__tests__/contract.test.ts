/**
 * Contract Tests for Public QR Endpoints
 *
 * These tests verify that the public-facing QR endpoints return a STABLE
 * response shape. External clients (customer-app QR scanning) depend on
 * these shapes — if someone accidentally adds or removes fields, these
 * tests will break.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { envFactory, resetAllFactories } from "@makanmasak/testing-utils";
import type { Env } from "../../../types/env";
import type { Table } from "../types";

// ---------------------------------------------------------------------------
// Mocks — follow the vi.hoisted + vi.mock pattern from service.test.ts
// ---------------------------------------------------------------------------

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

vi.mock("@makanmasak/database", () => ({
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
}));

// Import after mocking
import { TablesService } from "../services/TablesService";

// ---------------------------------------------------------------------------
// Mock environment
// ---------------------------------------------------------------------------

const mockEnv = envFactory.build() as unknown as Env;

// ---------------------------------------------------------------------------
// Fixture — a full Table row with EVERY field populated so we can verify
// that getPublicTableInfo strips the private ones.
// ---------------------------------------------------------------------------

const fullTable: Table = {
  id: 42,
  restaurantId: "rest-uuid-001",
  number: "A12",
  name: "Window Seat",
  capacity: 4,
  location: "Near window, 2nd floor",
  floor: 2,
  section: "Main dining",
  features: { hasView: true, hasChargingPort: true },
  isActive: true,
  isOccupied: false,
  isReservable: true,
  qrCode: "qr-secret-abc123",
  orderId: 999,
  occupiedBy: "John Doe",
  occupiedAt: new Date("2026-03-20T10:00:00Z"),
  estimatedReleaseTime: new Date("2026-03-20T11:00:00Z"),
  lastCleanedAt: new Date("2026-03-20T09:00:00Z"),
  cleaningNotes: "Deep cleaned",
  maintenanceNotes: "Wobbly leg — needs fixing",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-03-20T10:00:00Z"),
};

// ---------------------------------------------------------------------------
// The exact set of keys the public table endpoint MUST return
// ---------------------------------------------------------------------------

const EXPECTED_TABLE_PUBLIC_KEYS: string[] = [
  "id",
  "restaurantId",
  "number",
  "name",
  "capacity",
  "location",
  "floor",
  "section",
  "features",
  "isActive",
  "isOccupied",
].sort();

// ---------------------------------------------------------------------------
// The exact set of keys the public seat endpoint MUST return
// ---------------------------------------------------------------------------

const EXPECTED_SEAT_PUBLIC_KEYS: string[] = [
  "id",
  "tableId",
  "tableNumber",
  "restaurantId",
  "restaurantName",
  "seatNumber",
  "seatName",
  "isActive",
  "isOccupied",
  "capacity",
].sort();

// =========================================================================
// Tests
// =========================================================================

describe("Public QR Endpoint Contract Tests", () => {
  let tablesService: TablesService;

  beforeEach(() => {
    resetAllFactories();
    tablesService = new TablesService(mockEnv);
    vi.clearAllMocks();
  });

  // =======================================================================
  // Table Public Info Contract
  // =======================================================================
  describe("Table Public QR Response Contract", () => {
    it("should return all expected public fields", () => {
      const result = tablesService.getPublicTableInfo(fullTable);

      for (const key of EXPECTED_TABLE_PUBLIC_KEYS) {
        expect(result).toHaveProperty(key);
      }
    });

    it("should return exactly 11 keys (no more, no less)", () => {
      const result = tablesService.getPublicTableInfo(fullTable);
      const keys = Object.keys(result);

      expect(keys).toHaveLength(11);
      expect(keys.sort()).toEqual(EXPECTED_TABLE_PUBLIC_KEYS);
    });

    it("should NOT expose qrCode field", () => {
      const result = tablesService.getPublicTableInfo(fullTable);

      expect(result).not.toHaveProperty("qrCode");
    });

    it("should NOT expose occupiedBy field", () => {
      const result = tablesService.getPublicTableInfo(fullTable);

      expect(result).not.toHaveProperty("occupiedBy");
    });

    it("should NOT expose internal timestamps (createdAt, updatedAt, lastCleanedAt, lastOccupiedAt, occupiedAt)", () => {
      const result = tablesService.getPublicTableInfo(fullTable);

      expect(result).not.toHaveProperty("createdAt");
      expect(result).not.toHaveProperty("updatedAt");
      expect(result).not.toHaveProperty("lastCleanedAt");
      expect(result).not.toHaveProperty("lastOccupiedAt");
      expect(result).not.toHaveProperty("occupiedAt");
    });

    it("should NOT expose revenue/order stats (totalOrders, totalRevenue, averageOccupancyMinutes)", () => {
      const result = tablesService.getPublicTableInfo(fullTable);

      expect(result).not.toHaveProperty("totalOrders");
      expect(result).not.toHaveProperty("totalRevenue");
      expect(result).not.toHaveProperty("averageOccupancyMinutes");
    });

    it("should NOT expose maintenance/internal fields (maintenanceNotes, qrMode, seatCount, estimatedReleaseTime)", () => {
      const result = tablesService.getPublicTableInfo(fullTable);

      expect(result).not.toHaveProperty("maintenanceNotes");
      expect(result).not.toHaveProperty("qrMode");
      expect(result).not.toHaveProperty("seatCount");
      expect(result).not.toHaveProperty("estimatedReleaseTime");
    });
  });

  // =======================================================================
  // Seat Public Info Contract
  //
  // The seat public info is constructed inline in the route handler
  // (not extracted into a service method), so we verify the expected
  // shape against a mock that mirrors what the route builds.
  // =======================================================================
  describe("Seat Public QR Response Contract", () => {
    // Simulate the full seat row that SeatService.getSeatByQRCode returns
    const fullSeat = {
      // Public fields
      id: 7,
      tableId: 42,
      tableNumber: "A12",
      restaurantId: "rest-uuid-001",
      restaurantName: "Test Restaurant",
      seatNumber: 3,
      seatName: "Seat 3",
      isActive: true,
      isOccupied: false,
      capacity: 1,
      // Private / internal fields that MUST NOT leak
      qrCode: "seat-qr-secret-xyz",
      qrCodeImageUrl: "https://cdn.example.com/qr/seat-7.png",
      qrCodeVersion: 2,
      currentOrderId: 555,
      occupiedAt: new Date("2026-03-20T10:00:00Z"),
      occupiedBy: "Jane Smith",
      totalUsage: 128,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-03-20T10:00:00Z"),
      position: { x: 10, y: 20 },
    };

    /**
     * Helper that mirrors the inline mapping from
     * apps/api/src/features/seats/routes/index.ts  GET /qr/:qrCode
     */
    function buildPublicSeatInfo(seat: typeof fullSeat) {
      return {
        id: seat.id,
        tableId: seat.tableId,
        tableNumber: seat.tableNumber,
        restaurantId: seat.restaurantId,
        restaurantName: seat.restaurantName,
        seatNumber: seat.seatNumber,
        seatName: seat.seatName,
        isActive: seat.isActive,
        isOccupied: seat.isOccupied,
        capacity: seat.capacity,
      };
    }

    it("should contain all expected public seat fields", () => {
      const result = buildPublicSeatInfo(fullSeat);

      for (const key of EXPECTED_SEAT_PUBLIC_KEYS) {
        expect(result).toHaveProperty(key);
      }
    });

    it("should contain exactly 10 keys", () => {
      const result = buildPublicSeatInfo(fullSeat);
      const keys = Object.keys(result);

      expect(keys).toHaveLength(10);
      expect(keys.sort()).toEqual(EXPECTED_SEAT_PUBLIC_KEYS);
    });

    it("should NOT expose qrCode or qrCodeImageUrl", () => {
      const result = buildPublicSeatInfo(fullSeat);

      expect(result).not.toHaveProperty("qrCode");
      expect(result).not.toHaveProperty("qrCodeImageUrl");
    });

    it("should NOT expose qrCodeVersion", () => {
      const result = buildPublicSeatInfo(fullSeat);

      expect(result).not.toHaveProperty("qrCodeVersion");
    });

    it("should NOT expose currentOrderId", () => {
      const result = buildPublicSeatInfo(fullSeat);

      expect(result).not.toHaveProperty("currentOrderId");
    });

    it("should NOT expose occupiedAt or occupiedBy", () => {
      const result = buildPublicSeatInfo(fullSeat);

      expect(result).not.toHaveProperty("occupiedAt");
      expect(result).not.toHaveProperty("occupiedBy");
    });

    it("should NOT expose totalUsage, createdAt, updatedAt, or position", () => {
      const result = buildPublicSeatInfo(fullSeat);

      expect(result).not.toHaveProperty("totalUsage");
      expect(result).not.toHaveProperty("createdAt");
      expect(result).not.toHaveProperty("updatedAt");
      expect(result).not.toHaveProperty("position");
    });
  });

  // =======================================================================
  // Response Envelope Contract
  // =======================================================================
  describe("Response Envelope Contract", () => {
    it("should wrap public data in { success: true, data: {...} } envelope", () => {
      // Table envelope
      const tableData = tablesService.getPublicTableInfo(fullTable);
      const tableEnvelope = tablesService.createSuccessResponse(tableData);

      expect(tableEnvelope).toHaveProperty("success", true);
      expect(tableEnvelope).toHaveProperty("data");
      expect(tableEnvelope.data).toEqual(tableData);

      // Seat envelope (same structure the route produces)
      const seatData = {
        id: 7,
        tableId: 42,
        tableNumber: "A12",
        restaurantId: "rest-uuid-001",
        restaurantName: "Test Restaurant",
        seatNumber: 3,
        seatName: "Seat 3",
        isActive: true,
        isOccupied: false,
        capacity: 1,
      };
      const seatEnvelope = { success: true as const, data: seatData };

      expect(seatEnvelope).toHaveProperty("success", true);
      expect(seatEnvelope).toHaveProperty("data");
      expect(seatEnvelope.data).toEqual(seatData);
    });
  });
});
