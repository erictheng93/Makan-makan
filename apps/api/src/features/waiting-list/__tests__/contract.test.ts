/**
 * Contract Tests for Waiting List API
 *
 * Validates that response shapes match declared Zod schemas.
 * Any schema drift (field added, removed, or renamed) causes a test failure.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  JoinQueueResponse,
  GetEntryResponse,
  QueueStatusResponse,
  ListWaitingResponse,
  CallNextResponse,
  SeatEntryResponse,
} from "../../../contracts/schemas/waiting-list";

// ---------------------------------------------------------------------------
// Fixture — a realistic waiting list entry reused across tests
// ---------------------------------------------------------------------------

function buildMockEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    restaurantId: "rest-001",
    customerName: "John Doe",
    customerPhone: "+60123456789",
    partySize: 4,
    status: "waiting",
    position: 3,
    estimatedWaitMinutes: 15,
    notes: "Window seat preferred",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Waiting List API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // =========================================================================
  // Join Queue
  // =========================================================================
  describe("Join Queue Response Contract", () => {
    it("should match JoinQueueResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockEntry({ id: 10, position: 5 }),
        message: "Added to queue",
      };

      assertMatchesSchema(
        JoinQueueResponse,
        mockResponse,
        "POST /waiting-list",
      );
    });

    it("should accept response without message", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockEntry(),
      };

      assertMatchesSchema(
        JoinQueueResponse,
        mockResponse,
        "POST /waiting-list (no message)",
      );
    });
  });

  // =========================================================================
  // Get Single Entry
  // =========================================================================
  describe("Get Entry Response Contract", () => {
    it("should match GetEntryResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockEntry(),
      };

      assertMatchesSchema(
        GetEntryResponse,
        mockResponse,
        "GET /waiting-list/:id",
      );
    });

    it("should accept entry with null optional fields", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockEntry({
          estimatedWaitMinutes: null,
          notes: null,
        }),
      };

      assertMatchesSchema(
        GetEntryResponse,
        mockResponse,
        "GET /waiting-list/:id (nullable fields)",
      );
    });
  });

  // =========================================================================
  // Queue Status
  // =========================================================================
  describe("Queue Status Response Contract", () => {
    it("should match QueueStatusResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          totalWaiting: 8,
          estimatedWait: 25,
        },
      };

      assertMatchesSchema(
        QueueStatusResponse,
        mockResponse,
        "GET /waiting-list/status",
      );
    });

    it("should accept status with zero waiting", () => {
      const mockResponse = {
        success: true as const,
        data: {
          totalWaiting: 0,
          estimatedWait: 0,
        },
      };

      assertMatchesSchema(
        QueueStatusResponse,
        mockResponse,
        "GET /waiting-list/status (empty queue)",
      );
    });
  });

  // =========================================================================
  // List Waiting
  // =========================================================================
  describe("List Waiting Response Contract", () => {
    it("should match ListWaitingResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: [
          buildMockEntry({ id: 1, position: 1 }),
          buildMockEntry({ id: 2, position: 2, customerName: "Jane Doe" }),
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      assertMatchesSchema(
        ListWaitingResponse,
        mockResponse,
        "GET /waiting-list",
      );
    });

    it("should accept response without pagination", () => {
      const mockResponse = {
        success: true as const,
        data: [buildMockEntry()],
      };

      assertMatchesSchema(
        ListWaitingResponse,
        mockResponse,
        "GET /waiting-list (no pagination)",
      );
    });

    it("should accept empty list", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListWaitingResponse,
        mockResponse,
        "GET /waiting-list (empty)",
      );
    });
  });

  // =========================================================================
  // Call Next
  // =========================================================================
  describe("Call Next Response Contract", () => {
    it("should match CallNextResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockEntry({ status: "called", position: 1 }),
        message: "Customer called",
      };

      assertMatchesSchema(
        CallNextResponse,
        mockResponse,
        "POST /waiting-list/call-next",
      );
    });

    it("should accept response without optional message", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockEntry({ status: "called" }),
      };

      assertMatchesSchema(
        CallNextResponse,
        mockResponse,
        "POST /waiting-list/call-next (no message)",
      );
    });
  });

  // =========================================================================
  // Seat Entry
  // =========================================================================
  describe("Seat Entry Response Contract", () => {
    it("should match SeatEntryResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockEntry({ status: "seated", position: 0 }),
        message: "Customer seated",
      };

      assertMatchesSchema(
        SeatEntryResponse,
        mockResponse,
        "POST /waiting-list/:id/seat",
      );
    });

    it("should accept response without optional message", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockEntry({ status: "seated" }),
      };

      assertMatchesSchema(
        SeatEntryResponse,
        mockResponse,
        "POST /waiting-list/:id/seat (no message)",
      );
    });
  });
});
