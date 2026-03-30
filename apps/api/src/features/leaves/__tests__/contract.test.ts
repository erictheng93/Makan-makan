/**
 * Contract Tests for Leaves API
 *
 * Validates that leave management API responses match their declared
 * Zod schemas. Covers leave types, balances, and leave requests
 * (including approval/rejection flows).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  ListLeaveTypesResponse,
  CreateLeaveTypeResponse,
  GetLeaveTypeResponse,
  UpdateLeaveTypeResponse,
  DeleteLeaveTypeResponse,
  GetBalancesResponse,
  AdjustBalanceResponse,
  ListLeaveRequestsResponse,
  CreateLeaveRequestResponse,
  GetLeaveRequestResponse,
  ApproveLeaveResponse,
  RejectLeaveResponse,
  CancelLeaveResponse,
} from "../../../contracts/schemas/leaves";

describe("Leaves API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Leave Types
  // -------------------------------------------------------------------------
  describe("ListLeaveTypesResponse", () => {
    it("should match schema with leave types list", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "lt-001",
            restaurantId: "rest-001",
            name: "Annual Leave",
            maxDays: 14,
            isPaid: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "lt-002",
            restaurantId: "rest-001",
            name: "Sick Leave",
            maxDays: 10,
            isPaid: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "lt-003",
            restaurantId: "rest-001",
            name: "Unpaid Leave",
            maxDays: 30,
            isPaid: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        ListLeaveTypesResponse,
        mockResponse,
        "GET /leaves/types",
      );
    });

    it("should match schema with empty list", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListLeaveTypesResponse,
        mockResponse,
        "GET /leaves/types (empty)",
      );
    });
  });

  describe("GetLeaveTypeResponse", () => {
    it("should match schema for single leave type", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 1,
          restaurantId: "rest-001",
          name: "Annual Leave",
          maxDays: 14,
          isPaid: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        GetLeaveTypeResponse,
        mockResponse,
        "GET /leaves/types/:id",
      );
    });
  });

  describe("CreateLeaveTypeResponse", () => {
    it("should match schema with message for new leave type", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "lt-004",
          restaurantId: "rest-001",
          name: "Compassionate Leave",
          maxDays: 3,
          isPaid: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Leave type created successfully",
      };

      assertMatchesSchema(
        CreateLeaveTypeResponse,
        mockResponse,
        "POST /leaves/types",
      );
    });
  });

  describe("UpdateLeaveTypeResponse", () => {
    it("should match schema with message for updated leave type", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "lt-001",
          restaurantId: "rest-001",
          name: "Annual Leave (Updated)",
          maxDays: 16,
          isPaid: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: new Date().toISOString(),
        },
        message: "Leave type updated successfully",
      };

      assertMatchesSchema(
        UpdateLeaveTypeResponse,
        mockResponse,
        "PUT /leaves/types/:id",
      );
    });
  });

  describe("DeleteLeaveTypeResponse", () => {
    it("should match message-only schema", () => {
      const mockResponse = {
        success: true as const,
        message: "Leave type deleted successfully",
      };

      assertMatchesSchema(
        DeleteLeaveTypeResponse,
        mockResponse,
        "DELETE /leaves/types/:id",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Leave Balances
  // -------------------------------------------------------------------------
  describe("GetBalancesResponse", () => {
    it("should match schema with balances list", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "bal-001",
            userId: 1,
            leaveTypeId: "lt-001",
            balance: 10,
            used: 4,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "bal-002",
            userId: 1,
            leaveTypeId: "lt-002",
            balance: 8,
            used: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        GetBalancesResponse,
        mockResponse,
        "GET /leaves/balances",
      );
    });

    it("should match schema with empty balances", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        GetBalancesResponse,
        mockResponse,
        "GET /leaves/balances (empty)",
      );
    });
  });

  describe("AdjustBalanceResponse", () => {
    it("should match schema with message for adjusted balance", () => {
      const mockResponse = {
        success: true as const,
        data: {
          userId: 1,
          leaveTypeId: "lt-001",
          balance: 12,
          used: 4,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Balance adjusted successfully",
      };

      assertMatchesSchema(
        AdjustBalanceResponse,
        mockResponse,
        "PUT /leaves/balances/adjust",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Leave Requests
  // -------------------------------------------------------------------------
  describe("ListLeaveRequestsResponse", () => {
    it("should match schema with leave requests list", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "req-001",
            userId: 1,
            leaveTypeId: "lt-001",
            startDate: "2026-04-01",
            endDate: "2026-04-03",
            status: "approved",
            reason: "Family vacation",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "req-002",
            userId: 2,
            leaveTypeId: "lt-002",
            startDate: "2026-04-10",
            endDate: "2026-04-10",
            status: "pending",
            reason: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      assertMatchesSchema(
        ListLeaveRequestsResponse,
        mockResponse,
        "GET /leaves/requests",
      );
    });

    it("should match schema without optional pagination", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListLeaveRequestsResponse,
        mockResponse,
        "GET /leaves/requests (no pagination)",
      );
    });
  });

  describe("GetLeaveRequestResponse", () => {
    it("should match schema for single leave request", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "req-001",
          userId: 1,
          leaveTypeId: "lt-001",
          startDate: "2026-04-01",
          endDate: "2026-04-03",
          status: "approved",
          reason: "Family vacation",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        GetLeaveRequestResponse,
        mockResponse,
        "GET /leaves/requests/:id",
      );
    });
  });

  describe("CreateLeaveRequestResponse", () => {
    it("should match schema with message for new leave request", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "req-003",
          userId: 3,
          leaveTypeId: "lt-001",
          startDate: "2026-05-01",
          endDate: "2026-05-05",
          status: "pending",
          reason: "Holiday trip",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Leave request submitted successfully",
      };

      assertMatchesSchema(
        CreateLeaveRequestResponse,
        mockResponse,
        "POST /leaves/requests",
      );
    });
  });

  describe("ApproveLeaveResponse", () => {
    it("should match schema with message for approved leave", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "req-002",
          userId: 2,
          leaveTypeId: "lt-002",
          startDate: "2026-04-10",
          endDate: "2026-04-10",
          status: "approved",
          reason: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Leave request approved",
      };

      assertMatchesSchema(
        ApproveLeaveResponse,
        mockResponse,
        "PUT /leaves/requests/:id/approve",
      );
    });
  });

  describe("RejectLeaveResponse", () => {
    it("should match schema with message for rejected leave", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "req-003",
          userId: 3,
          leaveTypeId: "lt-001",
          startDate: "2026-05-01",
          endDate: "2026-05-05",
          status: "rejected",
          reason: "Holiday trip",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Leave request rejected",
      };

      assertMatchesSchema(
        RejectLeaveResponse,
        mockResponse,
        "PUT /leaves/requests/:id/reject",
      );
    });
  });

  describe("CancelLeaveResponse", () => {
    it("should match schema with message for cancelled leave", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "req-001",
          userId: 1,
          leaveTypeId: "lt-001",
          startDate: "2026-04-01",
          endDate: "2026-04-03",
          status: "cancelled",
          reason: "Family vacation",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Leave request cancelled",
      };

      assertMatchesSchema(
        CancelLeaveResponse,
        mockResponse,
        "PUT /leaves/requests/:id/cancel",
      );
    });
  });
});
