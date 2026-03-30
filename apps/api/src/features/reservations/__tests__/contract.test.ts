/**
 * Contract Tests for Reservations API
 *
 * Validates that response shapes match declared Zod schemas.
 * Any schema drift (field added, removed, or renamed) causes a test failure.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  CreateReservationResponse,
  ListReservationsResponse,
  GetReservationResponse,
  VerifyReservationResponse,
  ConfirmReservationResponse,
  CancelReservationResponse,
} from "../../../contracts/schemas/reservations";

// ---------------------------------------------------------------------------
// Fixture — a realistic reservation object reused across tests
// ---------------------------------------------------------------------------

function buildMockReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    restaurantId: "rest-001",
    customerName: "Alice Tan",
    customerPhone: "+60198765432",
    customerEmail: "alice@example.com",
    partySize: 4,
    status: "confirmed",
    reservationDate: "2026-04-15",
    reservationTime: "19:30",
    tableId: 10,
    confirmationCode: "RES-ABC123",
    notes: "Birthday celebration",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Reservations API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // =========================================================================
  // Create Reservation
  // =========================================================================
  describe("Create Reservation Response Contract", () => {
    it("should match CreateReservationResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockReservation({ id: 99, status: "pending" }),
        message: "Reservation created",
      };

      assertMatchesSchema(
        CreateReservationResponse,
        mockResponse,
        "POST /reservations",
      );
    });

    it("should accept response without optional message", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockReservation(),
      };

      assertMatchesSchema(
        CreateReservationResponse,
        mockResponse,
        "POST /reservations (no message)",
      );
    });
  });

  // =========================================================================
  // List Reservations
  // =========================================================================
  describe("List Reservations Response Contract", () => {
    it("should match ListReservationsResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: [
          buildMockReservation({ id: 1 }),
          buildMockReservation({
            id: 2,
            customerName: "Bob Lee",
            reservationTime: "20:00",
          }),
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      assertMatchesSchema(
        ListReservationsResponse,
        mockResponse,
        "GET /reservations",
      );
    });

    it("should accept response without pagination", () => {
      const mockResponse = {
        success: true as const,
        data: [buildMockReservation()],
      };

      assertMatchesSchema(
        ListReservationsResponse,
        mockResponse,
        "GET /reservations (no pagination)",
      );
    });

    it("should accept empty list", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListReservationsResponse,
        mockResponse,
        "GET /reservations (empty)",
      );
    });
  });

  // =========================================================================
  // Get Single Reservation
  // =========================================================================
  describe("Get Reservation Response Contract", () => {
    it("should match GetReservationResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockReservation(),
      };

      assertMatchesSchema(
        GetReservationResponse,
        mockResponse,
        "GET /reservations/:id",
      );
    });

    it("should accept reservation with null optional fields", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockReservation({
          customerEmail: null,
          tableId: null,
          notes: null,
        }),
      };

      assertMatchesSchema(
        GetReservationResponse,
        mockResponse,
        "GET /reservations/:id (nullable fields)",
      );
    });

    it("should accept reservation with string id", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockReservation({ id: "res-uuid-001" }),
      };

      assertMatchesSchema(
        GetReservationResponse,
        mockResponse,
        "GET /reservations/:id (string id)",
      );
    });
  });

  // =========================================================================
  // Verify Reservation
  // =========================================================================
  describe("Verify Reservation Response Contract", () => {
    it("should match VerifyReservationResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockReservation({ status: "confirmed" }),
      };

      assertMatchesSchema(
        VerifyReservationResponse,
        mockResponse,
        "POST /reservations/verify",
      );
    });
  });

  // =========================================================================
  // Confirm Reservation
  // =========================================================================
  describe("Confirm Reservation Response Contract", () => {
    it("should match ConfirmReservationResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockReservation({ status: "confirmed" }),
        message: "Reservation confirmed",
      };

      assertMatchesSchema(
        ConfirmReservationResponse,
        mockResponse,
        "POST /reservations/:id/confirm",
      );
    });

    it("should accept response without optional message", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockReservation({ status: "confirmed" }),
      };

      assertMatchesSchema(
        ConfirmReservationResponse,
        mockResponse,
        "POST /reservations/:id/confirm (no message)",
      );
    });
  });

  // =========================================================================
  // Cancel Reservation
  // =========================================================================
  describe("Cancel Reservation Response Contract", () => {
    it("should match CancelReservationResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockReservation({ status: "cancelled" }),
        message: "Reservation cancelled",
      };

      assertMatchesSchema(
        CancelReservationResponse,
        mockResponse,
        "POST /reservations/:id/cancel",
      );
    });

    it("should accept response without optional message", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockReservation({ status: "cancelled" }),
      };

      assertMatchesSchema(
        CancelReservationResponse,
        mockResponse,
        "POST /reservations/:id/cancel (no message)",
      );
    });
  });
});
