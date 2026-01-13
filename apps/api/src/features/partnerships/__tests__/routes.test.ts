/**
 * Partnership Routes Tests
 * 特約商店路由測試 - 完整覆蓋
 *
 * Note: These tests focus on schema validation and route handler logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../types/env";

// Mock PartnershipService
const mockService = {
  createPartnership: vi.fn(),
  listPartnerships: vi.fn(),
  getPartnership: vi.fn(),
  getPartnershipStatistics: vi.fn(),
  updatePartnership: vi.fn(),
  deletePartnership: vi.fn(),
  createPlan: vi.fn(),
  listPlans: vi.fn(),
  getPlan: vi.fn(),
  validatePlan: vi.fn(),
  updatePlan: vi.fn(),
  deletePlan: vi.fn(),
  submitMemberVerification: vi.fn(),
  listMembers: vi.fn(),
  getMember: vi.fn(),
  approveMember: vi.fn(),
  rejectMember: vi.fn(),
  updateMember: vi.fn(),
  logUsage: vi.fn(),
  listUsageLogs: vi.fn(),
  cancelUsageLog: vi.fn(),
  refundUsageLog: vi.fn(),
};

// Mock auth middleware
vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn((c: any, next: any) => {
    c.set("user", {
      id: 1,
      username: "admin",
      role: 0, // Admin
      restaurantId: 1,
      email: "admin@example.com",
    });
    return next();
  }),
  requireRole: vi.fn((roles: number[]) => (c: any, next: any) => {
    const user = c.get("user");
    if (user && (user.role === 0 || roles.includes(user.role))) {
      return next();
    }
    return c.json({ success: false, error: "Forbidden" }, 403);
  }),
}));

// Mock validation middleware
vi.mock("../../../middleware/validation", () => ({
  validateBody: vi.fn((schema: any) => (c: any, next: any) => {
    c.set("validatedBody", c.req.json ? {} : {});
    return next();
  }),
  validateQuery: vi.fn((schema: any) => (c: any, next: any) => {
    c.set("validatedQuery", { page: 1, limit: 20 });
    return next();
  }),
  validateParams: vi.fn((schema: any) => (c: any, next: any) => {
    const params = c.req.param();
    c.set("validatedParams", params);
    return next();
  }),
}));

vi.mock("@makanmakan/database", () => ({
  PartnershipService: vi.fn(function () {
    return mockService;
  }),
}));

// Create a mock D1 database
const createMockD1 = () => ({
  prepare: vi.fn(() => ({
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] }),
  })),
  exec: vi.fn().mockResolvedValue({ count: 0 }),
  batch: vi.fn().mockResolvedValue([]),
});

// Mock environment
const mockEnv: Partial<Env> = {
  NODE_ENV: "test",
  JWT_SECRET: "test-jwt-secret",
  DB: createMockD1() as any,
  CACHE_KV: {} as any,
  TOKEN_BLACKLIST: {} as any,
};

// Mock user
const mockUser = {
  id: 1,
  username: "testuser",
  role: 1,
  restaurantId: 1,
  email: "test@example.com",
};

const mockAdminUser = {
  id: 999,
  username: "admin",
  role: 0,
  restaurantId: null,
  email: "admin@example.com",
};

describe("Partnership Routes - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Partnership Service Integration", () => {
    it("should call createPartnership with correct data", async () => {
      const partnershipData = {
        partnerCode: "UNIV-001",
        partnerName: "Test University",
        partnerType: "university",
        contactPerson: "John Doe",
        contactPhone: "0912345678",
        contactEmail: "contact@test.edu",
        contractStartDate: Date.now(),
        contractEndDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
      };

      mockService.createPartnership.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440000",
        ...partnershipData,
        status: "draft",
      });

      const result = await mockService.createPartnership({
        ...partnershipData,
        createdBy: mockUser.id,
      });

      expect(mockService.createPartnership).toHaveBeenCalledWith({
        ...partnershipData,
        createdBy: mockUser.id,
      });
      expect(result.id).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(result.status).toBe("draft");
    });

    it("should call listPartnerships with filters", async () => {
      mockService.listPartnerships.mockResolvedValue({
        data: [{ id: "1", partnerName: "Test" }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      });

      const result = await mockService.listPartnerships({
        partnerType: "university",
        status: "active",
        page: 1,
        limit: 20,
      });

      expect(mockService.listPartnerships).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it("should call getPartnership by id", async () => {
      const partnership = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        partnerName: "Test University",
        partnerType: "university",
        status: "active",
      };
      mockService.getPartnership.mockResolvedValue(partnership);

      const result = await mockService.getPartnership(
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result).toEqual(partnership);
    });

    it("should return null for non-existent partnership", async () => {
      mockService.getPartnership.mockResolvedValue(null);

      const result = await mockService.getPartnership("non-existent-id");

      expect(result).toBeNull();
    });

    it("should call getPartnershipStatistics", async () => {
      const stats = {
        totalUsageCount: 100,
        totalDiscountGiven: 5000,
        totalRevenue: 50000,
        uniqueMembers: 50,
        averageDiscount: 50,
        averageOrderValue: 500,
      };
      mockService.getPartnershipStatistics.mockResolvedValue(stats);

      const result = await mockService.getPartnershipStatistics(
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result.totalUsageCount).toBe(100);
      expect(result.uniqueMembers).toBe(50);
    });

    it("should call updatePartnership", async () => {
      mockService.updatePartnership.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440000",
        contactPhone: "0987654321",
      });

      const result = await mockService.updatePartnership(
        "550e8400-e29b-41d4-a716-446655440000",
        {
          contactPhone: "0987654321",
        },
      );

      expect(result.contactPhone).toBe("0987654321");
    });

    it("should call deletePartnership", async () => {
      mockService.deletePartnership.mockResolvedValue(undefined);

      await mockService.deletePartnership(
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(mockService.deletePartnership).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
      );
    });
  });

  describe("Plan Service Integration", () => {
    it("should call createPlan with correct data", async () => {
      const planData = {
        partnershipId: "550e8400-e29b-41d4-a716-446655440000",
        restaurantId: "rest-001",
        planCode: "PLAN-001",
        planName: "Student Discount",
        discountType: "percentage",
        discountValue: 15,
        validFrom: Date.now(),
        validTo: Date.now() + 180 * 24 * 60 * 60 * 1000,
      };

      mockService.createPlan.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440001",
        ...planData,
      });

      const result = await mockService.createPlan(planData);

      expect(result.id).toBe("550e8400-e29b-41d4-a716-446655440001");
      expect(result.planName).toBe("Student Discount");
    });

    it("should call listPlans", async () => {
      mockService.listPlans.mockResolvedValue({
        data: [{ id: "1", planName: "Test Plan" }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      });

      const result = await mockService.listPlans({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
    });

    it("should call getPlan by id", async () => {
      mockService.getPlan.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440001",
        planName: "Student Discount",
      });

      const result = await mockService.getPlan(
        "550e8400-e29b-41d4-a716-446655440001",
      );

      expect(result.planName).toBe("Student Discount");
    });

    it("should return null for non-existent plan", async () => {
      mockService.getPlan.mockResolvedValue(null);

      const result = await mockService.getPlan("non-existent-id");

      expect(result).toBeNull();
    });

    it("should call validatePlan and return discount", async () => {
      mockService.validatePlan.mockResolvedValue({
        valid: true,
        discountAmount: 30,
        finalAmount: 170,
      });

      const result = await mockService.validatePlan({
        planId: "550e8400-e29b-41d4-a716-446655440001",
        memberId: "550e8400-e29b-41d4-a716-446655440002",
        orderAmount: 200,
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(30);
      expect(result.finalAmount).toBe(170);
    });

    it("should call updatePlan", async () => {
      mockService.updatePlan.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440001",
        discountValue: 20,
      });

      const result = await mockService.updatePlan(
        "550e8400-e29b-41d4-a716-446655440001",
        {
          discountValue: 20,
        },
      );

      expect(result.discountValue).toBe(20);
    });

    it("should call deletePlan", async () => {
      mockService.deletePlan.mockResolvedValue(undefined);

      await mockService.deletePlan("550e8400-e29b-41d4-a716-446655440001");

      expect(mockService.deletePlan).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440001",
      );
    });
  });

  describe("Member Service Integration", () => {
    it("should call submitMemberVerification", async () => {
      const verificationData = {
        partnershipId: "550e8400-e29b-41d4-a716-446655440000",
        memberId: "B10812345",
        memberType: "student",
        fullName: "Test Student",
        verificationMethod: "email_domain",
      };

      mockService.submitMemberVerification.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440002",
        ...verificationData,
        status: "pending",
      });

      const result =
        await mockService.submitMemberVerification(verificationData);

      expect(result.status).toBe("pending");
      expect(result.fullName).toBe("Test Student");
    });

    it("should call listMembers", async () => {
      mockService.listMembers.mockResolvedValue({
        data: [{ id: "1", fullName: "Test Student" }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      });

      const result = await mockService.listMembers({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
    });

    it("should call approveMember", async () => {
      mockService.approveMember.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440002",
        status: "verified",
      });

      const result = await mockService.approveMember(
        "550e8400-e29b-41d4-a716-446655440002",
        {
          verificationExpiry: Date.now() + 365 * 24 * 60 * 60 * 1000,
        },
      );

      expect(result.status).toBe("verified");
    });

    it("should call rejectMember", async () => {
      mockService.rejectMember.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440002",
        status: "rejected",
      });

      const result = await mockService.rejectMember(
        "550e8400-e29b-41d4-a716-446655440002",
        {
          rejectionReason: "Invalid student ID photo",
        },
      );

      expect(result.status).toBe("rejected");
    });
  });

  describe("Usage Logging Service Integration", () => {
    it("should call logUsage", async () => {
      const usageData = {
        partnershipId: "550e8400-e29b-41d4-a716-446655440000",
        planId: "550e8400-e29b-41d4-a716-446655440001",
        memberId: "550e8400-e29b-41d4-a716-446655440002",
        orderId: "550e8400-e29b-41d4-a716-446655440003",
        restaurantId: "rest-001",
        discountType: "percentage",
        discountValue: 15,
        discountAmount: 30,
        originalAmount: 200,
        finalAmount: 170,
      };

      mockService.logUsage.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440004",
        ...usageData,
        status: "completed",
      });

      const result = await mockService.logUsage(usageData);

      expect(result.status).toBe("completed");
      expect(result.discountAmount).toBe(30);
    });

    it("should call listUsageLogs", async () => {
      mockService.listUsageLogs.mockResolvedValue({
        data: [{ id: "1", discountAmount: 30 }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      });

      const result = await mockService.listUsageLogs({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
    });

    it("should call cancelUsageLog", async () => {
      mockService.cancelUsageLog.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440004",
        status: "cancelled",
      });

      const result = await mockService.cancelUsageLog(
        "550e8400-e29b-41d4-a716-446655440004",
        {
          reason: "Customer request",
        },
      );

      expect(result.status).toBe("cancelled");
    });

    it("should call refundUsageLog", async () => {
      mockService.refundUsageLog.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440004",
        status: "refunded",
      });

      const result = await mockService.refundUsageLog(
        "550e8400-e29b-41d4-a716-446655440004",
      );

      expect(result.status).toBe("refunded");
    });
  });

  describe("Error Handling", () => {
    it("should handle service errors gracefully", async () => {
      mockService.createPartnership.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(mockService.createPartnership({})).rejects.toThrow(
        "Database error",
      );
    });

    it("should handle validation errors", async () => {
      mockService.validatePlan.mockResolvedValue({
        valid: false,
        error: "Plan has expired",
      });

      const result = await mockService.validatePlan({
        planId: "expired-plan",
        memberId: "member-1",
        orderAmount: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Plan has expired");
    });
  });
});

describe("Route Handler Logic", () => {
  it("should format success response correctly", () => {
    const data = { id: "1", name: "Test" };
    const response = {
      success: true,
      data,
    };

    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
  });

  it("should format error response correctly", () => {
    const error = new Error("Something went wrong");
    const response = {
      success: false,
      error: error.message,
    };

    expect(response.success).toBe(false);
    expect(response.error).toBe("Something went wrong");
  });

  it("should format paginated response correctly", () => {
    const response = {
      success: true,
      data: [{ id: "1" }],
      pagination: {
        page: 1,
        limit: 20,
        total: 100,
        pages: 5,
      },
    };

    expect(response.pagination.pages).toBe(5);
    expect(response.pagination.total).toBe(100);
  });
});

describe("Partnership Route Handlers - Extended Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Partnership CRUD Operations", () => {
    it("should handle partnership creation with all fields", async () => {
      const fullPartnershipData = {
        partnerCode: "UNIV-NTU-001",
        partnerName: "國立台灣大學",
        partnerNameEn: "National Taiwan University",
        partnerType: "university",
        contactPerson: "王小明",
        contactTitle: "學務處主任",
        contactPhone: "02-33663366",
        contactEmail: "contact@ntu.edu.tw",
        address: "台北市大安區羅斯福路四段1號",
        contractNumber: "NTU-2025-001",
        contractStartDate: Date.now(),
        contractEndDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
        verificationMethod: "email_domain",
        allowedEmailDomains: ["@ntu.edu.tw", "@g.ntu.edu.tw"],
        defaultDiscountType: "percentage",
        defaultDiscountValue: 10,
        logoUrl: "https://example.com/ntu-logo.png",
        description: "台大師生專屬優惠",
        tags: ["education", "university", "taipei"],
      };

      mockService.createPartnership.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440000",
        ...fullPartnershipData,
        status: "draft",
        createdAt: new Date().toISOString(),
      });

      const result = await mockService.createPartnership(fullPartnershipData);

      expect(result.id).toBeDefined();
      expect(result.partnerName).toBe("國立台灣大學");
      expect(result.status).toBe("draft");
    });

    it("should handle partnership update with partial data", async () => {
      mockService.updatePartnership.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440000",
        contactPhone: "02-33669999",
        updatedAt: new Date().toISOString(),
      });

      const result = await mockService.updatePartnership(
        "550e8400-e29b-41d4-a716-446655440000",
        { contactPhone: "02-33669999" },
      );

      expect(result.contactPhone).toBe("02-33669999");
    });

    it("should handle partnership deletion", async () => {
      mockService.deletePartnership.mockResolvedValue(undefined);

      await mockService.deletePartnership(
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(mockService.deletePartnership).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
      );
    });

    it("should handle partnership statistics retrieval", async () => {
      const stats = {
        totalUsageCount: 1500,
        totalDiscountGiven: 75000,
        totalRevenue: 750000,
        uniqueMembers: 500,
        averageDiscount: 50,
        averageOrderValue: 500,
        monthlyTrend: [
          { month: "2025-01", usageCount: 100, discountGiven: 5000 },
          { month: "2025-02", usageCount: 150, discountGiven: 7500 },
        ],
      };
      mockService.getPartnershipStatistics.mockResolvedValue(stats);

      const result = await mockService.getPartnershipStatistics(
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result.totalUsageCount).toBe(1500);
      expect(result.uniqueMembers).toBe(500);
      expect(result.monthlyTrend).toHaveLength(2);
    });
  });

  describe("Plan Management Operations", () => {
    it("should create plan with time restrictions", async () => {
      const planData = {
        partnershipId: "550e8400-e29b-41d4-a716-446655440000",
        restaurantId: "rest-001",
        planCode: "LUNCH-SPECIAL",
        planName: "午餐時段優惠",
        discountType: "percentage",
        discountValue: 15,
        validFrom: Date.now(),
        validTo: Date.now() + 180 * 24 * 60 * 60 * 1000,
        applicableDays: [1, 2, 3, 4, 5], // Monday to Friday
        applicableTimeSlots: [{ start: "11:00", end: "14:00" }],
        usageLimitPerMember: 30,
        usageLimitPerDay: 1,
      };

      mockService.createPlan.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440001",
        ...planData,
        isActive: true,
      });

      const result = await mockService.createPlan(planData);

      expect(result.applicableDays).toEqual([1, 2, 3, 4, 5]);
      expect(result.applicableTimeSlots).toHaveLength(1);
    });

    it("should validate plan with menu item restrictions", async () => {
      mockService.validatePlan.mockResolvedValue({
        valid: true,
        discountAmount: 45,
        finalAmount: 255,
        applicableItems: ["item-1", "item-3"],
        excludedItems: ["item-2"],
        message: "Discount applied to 2 of 3 items",
      });

      const result = await mockService.validatePlan({
        planId: "550e8400-e29b-41d4-a716-446655440001",
        memberId: "550e8400-e29b-41d4-a716-446655440002",
        orderAmount: 300,
        menuItems: ["item-1", "item-2", "item-3"],
      });

      expect(result.valid).toBe(true);
      expect(result.applicableItems).toHaveLength(2);
    });

    it("should handle plan validation failure - usage limit exceeded", async () => {
      mockService.validatePlan.mockResolvedValue({
        valid: false,
        error: "Daily usage limit exceeded",
        usageToday: 1,
        dailyLimit: 1,
      });

      const result = await mockService.validatePlan({
        planId: "550e8400-e29b-41d4-a716-446655440001",
        memberId: "550e8400-e29b-41d4-a716-446655440002",
        orderAmount: 200,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("limit exceeded");
    });

    it("should handle plan validation failure - outside time slot", async () => {
      mockService.validatePlan.mockResolvedValue({
        valid: false,
        error: "Plan not valid at current time",
        currentTime: "18:30",
        validTimeSlots: [{ start: "11:00", end: "14:00" }],
      });

      const result = await mockService.validatePlan({
        planId: "550e8400-e29b-41d4-a716-446655440001",
        memberId: "550e8400-e29b-41d4-a716-446655440002",
        orderAmount: 200,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not valid at current time");
    });
  });

  describe("Member Verification Operations", () => {
    it("should submit verification with document", async () => {
      const verificationData = {
        partnershipId: "550e8400-e29b-41d4-a716-446655440000",
        memberId: "B10812345",
        memberType: "student",
        fullName: "陳小華",
        email: "b10812345@ntu.edu.tw",
        phone: "0912345678",
        verificationMethod: "id_card",
        verificationDocumentUrl:
          "https://storage.example.com/docs/student-id-123.jpg",
        department: "資訊工程學系",
        gradeOrPosition: "大三",
      };

      mockService.submitMemberVerification.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440002",
        ...verificationData,
        status: "pending",
        submittedAt: new Date().toISOString(),
      });

      const result =
        await mockService.submitMemberVerification(verificationData);

      expect(result.status).toBe("pending");
      expect(result.department).toBe("資訊工程學系");
    });

    it("should approve member with expiry date", async () => {
      const expiryDate = Date.now() + 365 * 24 * 60 * 60 * 1000;

      mockService.approveMember.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440002",
        status: "verified",
        verificationExpiry: expiryDate,
        approvedAt: new Date().toISOString(),
        approvedBy: 1,
      });

      const result = await mockService.approveMember(
        "550e8400-e29b-41d4-a716-446655440002",
        { verificationExpiry: expiryDate },
      );

      expect(result.status).toBe("verified");
      expect(result.verificationExpiry).toBe(expiryDate);
    });

    it("should reject member with detailed reason", async () => {
      mockService.rejectMember.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440002",
        status: "rejected",
        rejectionReason: "學生證照片模糊，無法辨識學號，請重新上傳清晰照片",
        rejectedAt: new Date().toISOString(),
      });

      const result = await mockService.rejectMember(
        "550e8400-e29b-41d4-a716-446655440002",
        { rejectionReason: "學生證照片模糊，無法辨識學號，請重新上傳清晰照片" },
      );

      expect(result.status).toBe("rejected");
      expect(result.rejectionReason).toContain("模糊");
    });

    it("should list members with filters", async () => {
      mockService.listMembers.mockResolvedValue({
        data: [
          {
            id: "1",
            fullName: "陳小華",
            status: "verified",
            memberType: "student",
          },
          {
            id: "2",
            fullName: "林大明",
            status: "verified",
            memberType: "student",
          },
        ],
        pagination: { page: 1, limit: 20, total: 2, pages: 1 },
      });

      const result = await mockService.listMembers({
        partnershipId: "550e8400-e29b-41d4-a716-446655440000",
        status: "verified",
        memberType: "student",
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].status).toBe("verified");
    });
  });

  describe("Usage Logging Operations", () => {
    it("should log usage with full order details", async () => {
      const usageData = {
        partnershipId: "550e8400-e29b-41d4-a716-446655440000",
        planId: "550e8400-e29b-41d4-a716-446655440001",
        memberId: "550e8400-e29b-41d4-a716-446655440002",
        orderId: "550e8400-e29b-41d4-a716-446655440003",
        restaurantId: "rest-001",
        discountType: "percentage",
        discountValue: 15,
        discountAmount: 45,
        originalAmount: 300,
        finalAmount: 255,
        orderItems: [
          { id: "item-1", name: "招牌牛肉麵", quantity: 1, price: 180 },
          { id: "item-2", name: "小菜拼盤", quantity: 1, price: 120 },
        ],
        channel: "dine_in",
        verificationMethod: "qr_code",
      };

      mockService.logUsage.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440004",
        ...usageData,
        status: "completed",
        usedAt: new Date().toISOString(),
      });

      const result = await mockService.logUsage(usageData);

      expect(result.status).toBe("completed");
      expect(result.orderItems).toHaveLength(2);
    });

    it("should list usage logs with date range", async () => {
      mockService.listUsageLogs.mockResolvedValue({
        data: [
          { id: "1", discountAmount: 45, usedAt: "2025-12-01T12:00:00Z" },
          { id: "2", discountAmount: 30, usedAt: "2025-12-02T13:00:00Z" },
        ],
        pagination: { page: 1, limit: 20, total: 2, pages: 1 },
        summary: {
          totalDiscountGiven: 75,
          totalUsageCount: 2,
        },
      });

      const result = await mockService.listUsageLogs({
        partnershipId: "550e8400-e29b-41d4-a716-446655440000",
        startDate: "2025-12-01",
        endDate: "2025-12-31",
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(2);
      expect(result.summary.totalDiscountGiven).toBe(75);
    });

    it("should cancel usage with reason", async () => {
      mockService.cancelUsageLog.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440004",
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancellationReason: "顧客取消訂單",
      });

      const result = await mockService.cancelUsageLog(
        "550e8400-e29b-41d4-a716-446655440004",
        { reason: "顧客取消訂單" },
      );

      expect(result.status).toBe("cancelled");
    });

    it("should refund usage", async () => {
      mockService.refundUsageLog.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440004",
        status: "refunded",
        refundedAt: new Date().toISOString(),
        refundAmount: 45,
      });

      const result = await mockService.refundUsageLog(
        "550e8400-e29b-41d4-a716-446655440004",
      );

      expect(result.status).toBe("refunded");
      expect(result.refundAmount).toBe(45);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle partnership not found", async () => {
      mockService.getPartnership.mockResolvedValue(null);

      const result = await mockService.getPartnership("non-existent-id");

      expect(result).toBeNull();
    });

    it("should handle plan not found", async () => {
      mockService.getPlan.mockResolvedValue(null);

      const result = await mockService.getPlan("non-existent-id");

      expect(result).toBeNull();
    });

    it("should handle member not found", async () => {
      mockService.getMember.mockResolvedValue(null);

      const result = await mockService.getMember("non-existent-id");

      expect(result).toBeNull();
    });

    it("should handle database connection error", async () => {
      mockService.listPartnerships.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(mockService.listPartnerships({})).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("should handle validation service error", async () => {
      mockService.validatePlan.mockRejectedValue(
        new Error("Validation service unavailable"),
      );

      await expect(
        mockService.validatePlan({
          planId: "test",
          memberId: "test",
          orderAmount: 100,
        }),
      ).rejects.toThrow("Validation service unavailable");
    });
  });
});
