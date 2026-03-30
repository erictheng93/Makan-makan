/**
 * Contract Tests for Partnerships API
 *
 * Validates that partnership-related API responses match their declared
 * Zod schemas. Covers partnerships, plans, members, and usage logs.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  CreatePartnershipResponse,
  ListPartnershipsResponse,
  GetPartnershipResponse,
  UpdatePartnershipResponse,
  DeletePartnershipResponse,
  CreatePlanResponse,
  ListPlansResponse,
  VerifyMemberResponse,
  ListMembersResponse,
  ApproveMemberResponse,
  LogUsageResponse,
  ListUsageResponse,
} from "../../../contracts/schemas/partnerships";

describe("Partnerships API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Partnerships
  // -------------------------------------------------------------------------
  describe("CreatePartnershipResponse", () => {
    it("should match schema for newly created partnership", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "part-001",
          restaurantId: "rest-001",
          partnerName: "Corporate Partner A",
          organizationName: "Acme Corp",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        CreatePartnershipResponse,
        mockResponse,
        "POST /partnerships",
      );
    });
  });

  describe("ListPartnershipsResponse", () => {
    it("should match schema with partnership list", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "part-001",
            restaurantId: "rest-001",
            partnerName: "Corporate Partner A",
            status: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "part-002",
            restaurantId: "rest-001",
            organizationName: "Tech Inc",
            status: "pending",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        ListPartnershipsResponse,
        mockResponse,
        "GET /partnerships",
      );
    });

    it("should match schema with empty list", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListPartnershipsResponse,
        mockResponse,
        "GET /partnerships (empty)",
      );
    });
  });

  describe("GetPartnershipResponse", () => {
    it("should match schema for single partnership", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 1,
          restaurantId: "rest-001",
          partnerName: "Hotel Chain X",
          organizationName: "Hotel Chain X Group",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        GetPartnershipResponse,
        mockResponse,
        "GET /partnerships/:id",
      );
    });
  });

  describe("UpdatePartnershipResponse", () => {
    it("should match schema for updated partnership", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "part-001",
          restaurantId: "rest-001",
          partnerName: "Updated Partner Name",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        UpdatePartnershipResponse,
        mockResponse,
        "PUT /partnerships/:id",
      );
    });
  });

  describe("DeletePartnershipResponse", () => {
    it("should match message-only schema", () => {
      const mockResponse = {
        success: true as const,
        message: "Partnership deleted successfully",
      };

      assertMatchesSchema(
        DeletePartnershipResponse,
        mockResponse,
        "DELETE /partnerships/:id",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Plans
  // -------------------------------------------------------------------------
  describe("CreatePlanResponse", () => {
    it("should match schema for newly created plan", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "plan-001",
          partnershipId: "part-001",
          name: "Employee Lunch Plan",
          discountType: "percentage",
          discountValue: 15,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        CreatePlanResponse,
        mockResponse,
        "POST /partnerships/:id/plans",
      );
    });
  });

  describe("ListPlansResponse", () => {
    it("should match schema with plans list", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "plan-001",
            partnershipId: "part-001",
            name: "Employee Lunch Plan",
            discountType: "percentage",
            discountValue: 15,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "plan-002",
            partnershipId: "part-001",
            name: "Weekend Special",
            discountType: "fixed",
            discountValue: 5,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        ListPlansResponse,
        mockResponse,
        "GET /partnerships/:id/plans",
      );
    });

    it("should match schema with empty plans list", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListPlansResponse,
        mockResponse,
        "GET /partnerships/:id/plans (empty)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Members
  // -------------------------------------------------------------------------
  describe("VerifyMemberResponse", () => {
    it("should match schema with message for verified member", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "mem-001",
          partnershipId: "part-001",
          name: "John Doe",
          email: "john@acme.com",
          phone: "+60123456789",
          status: "verified",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Member verified successfully",
      };

      assertMatchesSchema(
        VerifyMemberResponse,
        mockResponse,
        "POST /partnerships/members/verify",
      );
    });
  });

  describe("ListMembersResponse", () => {
    it("should match schema with members list", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "mem-001",
            partnershipId: "part-001",
            name: "John Doe",
            email: "john@acme.com",
            status: "verified",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "mem-002",
            partnershipId: "part-001",
            name: "Jane Smith",
            email: "jane@acme.com",
            status: "pending",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        ListMembersResponse,
        mockResponse,
        "GET /partnerships/:id/members",
      );
    });
  });

  describe("ApproveMemberResponse", () => {
    it("should match schema with message for approved member", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "mem-002",
          partnershipId: "part-001",
          name: "Jane Smith",
          email: "jane@acme.com",
          status: "approved",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Member approved successfully",
      };

      assertMatchesSchema(
        ApproveMemberResponse,
        mockResponse,
        "PUT /partnerships/members/:id/approve",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Usage Logs
  // -------------------------------------------------------------------------
  describe("LogUsageResponse", () => {
    it("should match schema with message for logged usage", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "usage-001",
          memberId: "mem-001",
          amount: 45.5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        message: "Usage logged successfully",
      };

      assertMatchesSchema(
        LogUsageResponse,
        mockResponse,
        "POST /partnerships/usage",
      );
    });
  });

  describe("ListUsageResponse", () => {
    it("should match schema with usage list", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "usage-001",
            memberId: "mem-001",
            amount: 45.5,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "usage-002",
            memberId: "mem-001",
            amount: 30.0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        ListUsageResponse,
        mockResponse,
        "GET /partnerships/usage",
      );
    });

    it("should match schema with empty usage list", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListUsageResponse,
        mockResponse,
        "GET /partnerships/usage (empty)",
      );
    });
  });
});
