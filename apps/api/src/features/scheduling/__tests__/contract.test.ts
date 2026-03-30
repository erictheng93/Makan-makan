/**
 * Contract Tests for Scheduling API
 *
 * Validates that scheduling-related API responses match their declared
 * Zod schemas. Covers shift templates, schedules, clock in/out, and
 * swap requests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  ListTemplatesResponse,
  CreateTemplateResponse,
  GetTemplateResponse,
  UpdateTemplateResponse,
  DeleteTemplateResponse,
  ListSchedulesResponse,
  CreateScheduleResponse,
  GetScheduleResponse,
  ClockInResponse,
  ClockOutResponse,
  ListSwapRequestsResponse,
  SwapRequestResponse,
  AttendanceReportResponse,
} from "../../../contracts/schemas/scheduling";

describe("Scheduling API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Shift Templates
  // -------------------------------------------------------------------------
  describe("ListTemplatesResponse", () => {
    it("should match schema with template list", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "tmpl-001",
            restaurantId: "rest-001",
            name: "Morning Shift",
            startTime: "08:00",
            endTime: "16:00",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "tmpl-002",
            restaurantId: "rest-001",
            name: "Evening Shift",
            startTime: "16:00",
            endTime: "00:00",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        ListTemplatesResponse,
        mockResponse,
        "GET /scheduling/templates",
      );
    });

    it("should match schema with empty template list", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListTemplatesResponse,
        mockResponse,
        "GET /scheduling/templates (empty)",
      );
    });
  });

  describe("GetTemplateResponse", () => {
    it("should match schema for single template", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 1,
          restaurantId: "rest-001",
          name: "Morning Shift",
          startTime: "08:00",
          endTime: "16:00",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        GetTemplateResponse,
        mockResponse,
        "GET /scheduling/templates/:id",
      );
    });
  });

  describe("CreateTemplateResponse", () => {
    it("should match schema with message for new template", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "tmpl-003",
          restaurantId: "rest-001",
          name: "Weekend Special",
          startTime: "10:00",
          endTime: "18:00",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Template created successfully",
      };

      assertMatchesSchema(
        CreateTemplateResponse,
        mockResponse,
        "POST /scheduling/templates",
      );
    });
  });

  describe("UpdateTemplateResponse", () => {
    it("should match schema with message for updated template", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "tmpl-001",
          restaurantId: "rest-001",
          name: "Updated Morning Shift",
          startTime: "07:00",
          endTime: "15:00",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: new Date().toISOString(),
        },
        message: "Template updated successfully",
      };

      assertMatchesSchema(
        UpdateTemplateResponse,
        mockResponse,
        "PUT /scheduling/templates/:id",
      );
    });
  });

  describe("DeleteTemplateResponse", () => {
    it("should match message-only schema", () => {
      const mockResponse = {
        success: true as const,
        message: "Template deleted successfully",
      };

      assertMatchesSchema(
        DeleteTemplateResponse,
        mockResponse,
        "DELETE /scheduling/templates/:id",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Schedules
  // -------------------------------------------------------------------------
  describe("ListSchedulesResponse", () => {
    it("should match schema with schedule list", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "sched-001",
            restaurantId: "rest-001",
            userId: 1,
            shiftTemplateId: "tmpl-001",
            date: "2026-03-30",
            status: "scheduled",
            clockInAt: null,
            clockOutAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "sched-002",
            restaurantId: "rest-001",
            userId: 2,
            shiftTemplateId: "tmpl-002",
            date: "2026-03-30",
            status: "completed",
            clockInAt: "2026-03-30T16:05:00.000Z",
            clockOutAt: "2026-03-30T23:55:00.000Z",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      assertMatchesSchema(
        ListSchedulesResponse,
        mockResponse,
        "GET /scheduling/schedules",
      );
    });

    it("should match schema without optional pagination", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListSchedulesResponse,
        mockResponse,
        "GET /scheduling/schedules (no pagination)",
      );
    });
  });

  describe("GetScheduleResponse", () => {
    it("should match schema for single schedule", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "sched-001",
          restaurantId: "rest-001",
          userId: 1,
          date: "2026-03-30",
          status: "scheduled",
          clockInAt: null,
          clockOutAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        GetScheduleResponse,
        mockResponse,
        "GET /scheduling/schedules/:id",
      );
    });
  });

  describe("CreateScheduleResponse", () => {
    it("should match schema with message for new schedule", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "sched-003",
          restaurantId: "rest-001",
          userId: 3,
          shiftTemplateId: "tmpl-001",
          date: "2026-04-01",
          status: "scheduled",
          clockInAt: null,
          clockOutAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Schedule created successfully",
      };

      assertMatchesSchema(
        CreateScheduleResponse,
        mockResponse,
        "POST /scheduling/schedules",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Clock In / Out
  // -------------------------------------------------------------------------
  describe("ClockInResponse", () => {
    it("should match schema with clock-in timestamp", () => {
      const now = new Date().toISOString();
      const mockResponse = {
        success: true as const,
        data: {
          id: "sched-001",
          restaurantId: "rest-001",
          userId: 1,
          date: "2026-03-30",
          status: "in_progress",
          clockInAt: now,
          clockOutAt: null,
          createdAt: "2026-03-29T00:00:00.000Z",
          updatedAt: now,
        },
        message: "Clocked in successfully",
      };

      assertMatchesSchema(
        ClockInResponse,
        mockResponse,
        "POST /scheduling/clock-in",
      );
    });
  });

  describe("ClockOutResponse", () => {
    it("should match schema with clock-out timestamp", () => {
      const now = new Date().toISOString();
      const mockResponse = {
        success: true as const,
        data: {
          id: "sched-001",
          restaurantId: "rest-001",
          userId: 1,
          date: "2026-03-30",
          status: "completed",
          clockInAt: "2026-03-30T08:00:00.000Z",
          clockOutAt: now,
          createdAt: "2026-03-29T00:00:00.000Z",
          updatedAt: now,
        },
        message: "Clocked out successfully",
      };

      assertMatchesSchema(
        ClockOutResponse,
        mockResponse,
        "POST /scheduling/clock-out",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Swap Requests
  // -------------------------------------------------------------------------
  describe("ListSwapRequestsResponse", () => {
    it("should match schema with swap request list", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "swap-001",
            requesterId: 1,
            targetId: 2,
            status: "pending",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "swap-002",
            requesterId: 3,
            targetId: 1,
            status: "approved",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      assertMatchesSchema(
        ListSwapRequestsResponse,
        mockResponse,
        "GET /scheduling/swaps",
      );
    });

    it("should match schema without optional pagination", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListSwapRequestsResponse,
        mockResponse,
        "GET /scheduling/swaps (empty)",
      );
    });
  });

  describe("SwapRequestResponse", () => {
    it("should match schema with message for swap request", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "swap-003",
          requesterId: 2,
          targetId: 4,
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Swap request created successfully",
      };

      assertMatchesSchema(
        SwapRequestResponse,
        mockResponse,
        "POST /scheduling/swaps",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Attendance Report
  // -------------------------------------------------------------------------
  describe("AttendanceReportResponse", () => {
    it("should match schema for attendance report", () => {
      const mockResponse = {
        success: true as const,
        data: {
          totalShifts: 50,
          completedShifts: 45,
          missedShifts: 5,
          averageHoursPerDay: 7.5,
        },
        message: "Report generated",
      };

      assertMatchesSchema(
        AttendanceReportResponse,
        mockResponse,
        "GET /scheduling/attendance-report",
      );
    });
  });
});
