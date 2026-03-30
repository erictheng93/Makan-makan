/**
 * Contract Tests for Seats API
 *
 * Validates that response shapes match declared Zod schemas.
 * Any schema drift (field added, removed, or renamed) causes a test failure.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import {
  assertMatchesSchema,
  assertNoSensitiveFields,
} from "../../../contracts/helpers";
import {
  ListSeatsResponse,
  GetSeatResponse,
  GetPublicSeatResponse,
  BatchCreateSeatsResponse,
  UpdateSeatResponse,
  DeleteSeatResponse,
  OccupySeatResponse,
  ReleaseSeatResponse,
  RegenerateQRResponse,
  SEAT_SENSITIVE_FIELDS,
} from "../../../contracts/schemas/seats";

describe("Seats API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // =========================================================================
  // List Seats
  // =========================================================================
  describe("List Seats Response Contract", () => {
    it("should match ListSeatsResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: 1,
            tableId: 42,
            restaurantId: "rest-001",
            seatNumber: 1,
            seatName: "Seat 1",
            qrCode: "qr-abc-123",
            isActive: true,
            isOccupied: false,
            capacity: 1,
            orderId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        total: 1,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      assertMatchesSchema(ListSeatsResponse, mockResponse, "GET /seats");
    });

    it("should accept empty data array", () => {
      const mockResponse = {
        success: true as const,
        data: [],
        total: 0,
      };

      assertMatchesSchema(
        ListSeatsResponse,
        mockResponse,
        "GET /seats (empty)",
      );
    });
  });

  // =========================================================================
  // Get Single Seat
  // =========================================================================
  describe("Get Seat Response Contract", () => {
    it("should match GetSeatResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 7,
          tableId: 42,
          restaurantId: "rest-001",
          seatNumber: 3,
          seatName: "Seat 3",
          qrCode: "qr-seat-xyz",
          isActive: true,
          isOccupied: false,
          capacity: 1,
          orderId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(GetSeatResponse, mockResponse, "GET /seats/:id");
    });
  });

  // =========================================================================
  // Get Public Seat (QR Code scan)
  // =========================================================================
  describe("Public Seat Response Contract", () => {
    it("should match GetPublicSeatResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 7,
          tableId: 42,
          tableNumber: "A12",
          restaurantId: "rest-001",
          restaurantName: "Test Restaurant",
          seatNumber: 3,
          seatName: "Seat 3",
          isActive: true,
          isOccupied: false,
          capacity: 1,
        },
      };

      assertMatchesSchema(
        GetPublicSeatResponse,
        mockResponse,
        "GET /seats/qr/:qrCode",
      );
    });

    it("should NOT contain sensitive fields", () => {
      const publicSeat = {
        id: 7,
        tableId: 42,
        tableNumber: "A12",
        restaurantId: "rest-001",
        restaurantName: "Test Restaurant",
        seatNumber: 3,
        seatName: "Seat 3",
        isActive: true,
        isOccupied: false,
        capacity: 1,
      };

      assertNoSensitiveFields(
        publicSeat,
        SEAT_SENSITIVE_FIELDS,
        "Public seat info",
      );
    });

    it("should reject response that leaks qrCode", () => {
      const leakyResponse = {
        id: 7,
        tableId: 42,
        tableNumber: "A12",
        restaurantId: "rest-001",
        restaurantName: "Test Restaurant",
        seatNumber: 3,
        seatName: "Seat 3",
        isActive: true,
        isOccupied: false,
        capacity: 1,
        qrCode: "leaked-secret",
      };

      expect(() =>
        assertNoSensitiveFields(
          leakyResponse,
          SEAT_SENSITIVE_FIELDS,
          "Public seat info",
        ),
      ).toThrow(/leaks sensitive fields.*qrCode/);
    });
  });

  // =========================================================================
  // Batch Create Seats
  // =========================================================================
  describe("Batch Create Seats Response Contract", () => {
    it("should match BatchCreateSeatsResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: 10,
            tableId: 42,
            seatNumber: 1,
            seatName: "Seat 1",
            isActive: true,
            isOccupied: false,
            capacity: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 11,
            tableId: 42,
            seatNumber: 2,
            seatName: "Seat 2",
            isActive: true,
            isOccupied: false,
            capacity: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        message: "2 seats created",
      };

      assertMatchesSchema(
        BatchCreateSeatsResponse,
        mockResponse,
        "POST /seats/batch",
      );
    });
  });

  // =========================================================================
  // Update Seat
  // =========================================================================
  describe("Update Seat Response Contract", () => {
    it("should match UpdateSeatResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 7,
          tableId: 42,
          seatNumber: 3,
          seatName: "Updated Seat 3",
          isActive: true,
          isOccupied: false,
          capacity: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Seat updated",
      };

      assertMatchesSchema(UpdateSeatResponse, mockResponse, "PUT /seats/:id");
    });
  });

  // =========================================================================
  // Delete / Occupy / Release Seats (message-only responses)
  // =========================================================================
  describe("Delete Seat Response Contract", () => {
    it("should match DeleteSeatResponse schema", () => {
      const mockResponse = {
        success: true as const,
        message: "Seat deleted",
      };

      assertMatchesSchema(
        DeleteSeatResponse,
        mockResponse,
        "DELETE /seats/:id",
      );
    });
  });

  describe("Occupy Seat Response Contract", () => {
    it("should match OccupySeatResponse schema", () => {
      const mockResponse = {
        success: true as const,
        message: "Seat occupied",
      };

      assertMatchesSchema(
        OccupySeatResponse,
        mockResponse,
        "POST /seats/:id/occupy",
      );
    });
  });

  describe("Release Seat Response Contract", () => {
    it("should match ReleaseSeatResponse schema", () => {
      const mockResponse = {
        success: true as const,
        message: "Seat released",
      };

      assertMatchesSchema(
        ReleaseSeatResponse,
        mockResponse,
        "POST /seats/:id/release",
      );
    });
  });

  // =========================================================================
  // Regenerate QR Code
  // =========================================================================
  describe("Regenerate QR Response Contract", () => {
    it("should match RegenerateQRResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          qrCode: "new-qr-code-abc123",
        },
        message: "QR code regenerated",
      };

      assertMatchesSchema(
        RegenerateQRResponse,
        mockResponse,
        "POST /seats/:id/regenerate-qr",
      );
    });
  });
});
