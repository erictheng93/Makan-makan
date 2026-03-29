/**
 * LeaveService Unit Tests
 * Test coverage for employee leave management functionality
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { LeaveService } from "../LeaveService";
import type { LeaveType, LeaveBalance, LeaveRequest } from "../LeaveService";
import {
  createMockDatabase,
  createMockEnv,
  createQueryChain,
} from "./helpers/mockD1";
import { resetAllFactories } from "@makanmakan/testing-utils";

describe("LeaveService", () => {
  let service: LeaveService;
  let mockDb: any;
  let mockEnv: any;

  beforeEach(() => {
    resetAllFactories();
    mockDb = createMockDatabase();
    mockEnv = createMockEnv();
    service = new LeaveService(mockDb as any, mockEnv);
    vi.clearAllMocks();
  });

  describe("Leave Type Management", () => {
    it("should get leave types for a restaurant", async () => {
      const mockLeaveTypes: LeaveType[] = [
        {
          id: 1,
          restaurantId: "R-001",
          code: "ANNUAL",
          name: "年假",
          description: "年度休假",
          accrualType: "yearly",
          accrualAmount: 14,
          accrualBasedOnSeniority: false,
          requiresApproval: true,
          requiredApprovalLevels: 1,
          minNoticeDays: 3,
          maxConsecutiveDays: 14,
          canCarryover: true,
          carryoverMaxDays: 7,
          carryoverExpiryMonths: 3,
          requiresDocumentation: false,
          documentationRequiredAfterDays: null,
          isPaid: true,
          paymentRate: 100,
          allowHalfDay: true,
          gender: "any",
          applicableToRoles: null,
          maxUsagePerYear: null,
          isSystemDefined: true,
          isActive: true,
          sortOrder: 1,
          color: "#3B82F6",
          icon: "🏖️",
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ];

      // Mock the select query to return mockLeaveTypes
      mockDb.select.mockReturnValue(createQueryChain(mockLeaveTypes));

      const result = await service.getLeaveTypes("R-001");

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("ANNUAL");
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should get leave types including system-level types", async () => {
      const mockLeaveTypes: LeaveType[] = [
        {
          id: 1,
          restaurantId: null,
          code: "SYSTEM_ANNUAL",
          name: "系統年假",
          description: "系統層級年假",
          accrualType: "yearly",
          accrualAmount: 10,
          accrualBasedOnSeniority: false,
          requiresApproval: true,
          requiredApprovalLevels: 1,
          minNoticeDays: 0,
          maxConsecutiveDays: null,
          canCarryover: false,
          carryoverMaxDays: null,
          carryoverExpiryMonths: null,
          requiresDocumentation: false,
          documentationRequiredAfterDays: null,
          isPaid: true,
          paymentRate: 1.0,
          allowHalfDay: true,
          gender: "any",
          applicableToRoles: null,
          maxUsagePerYear: null,
          isSystemDefined: true,
          isActive: true,
          sortOrder: 0,
          color: null,
          icon: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ];

      mockDb.select.mockReturnValue(createQueryChain(mockLeaveTypes));

      const result = await service.getLeaveTypes("R-001");

      expect(result).toHaveLength(1);
      expect(result[0].restaurantId).toBeNull();
      expect(result[0].isSystemDefined).toBe(true);
    });

    it("should get a specific leave type by ID", async () => {
      const mockLeaveType: LeaveType = {
        id: 1,
        restaurantId: "R-001",
        code: "ANNUAL",
        name: "年假",
        description: "年度休假",
        accrualType: "yearly",
        accrualAmount: 14,
        accrualBasedOnSeniority: false,
        requiresApproval: true,
        requiredApprovalLevels: 1,
        minNoticeDays: 3,
        maxConsecutiveDays: 14,
        canCarryover: true,
        carryoverMaxDays: 7,
        carryoverExpiryMonths: 3,
        requiresDocumentation: false,
        documentationRequiredAfterDays: null,
        isPaid: true,
        paymentRate: 1.0,
        allowHalfDay: true,
        gender: "any",
        applicableToRoles: null,
        maxUsagePerYear: null,
        isSystemDefined: false,
        isActive: true,
        sortOrder: 0,
        color: null,
        icon: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      mockDb.select.mockReturnValue(createQueryChain([mockLeaveType]));

      const result = await service.getLeaveType(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.code).toBe("ANNUAL");
    });

    it("should return null when leave type not found", async () => {
      mockDb.select.mockReturnValue(createQueryChain([]));

      const result = await service.getLeaveType(999);

      expect(result).toBeNull();
    });

    it("should not delete system-defined leave types", async () => {
      const systemType = {
        id: 1,
        isSystemDefined: true,
        isActive: true,
      };

      mockDb.select.mockReturnValue(createQueryChain([systemType]));

      await expect(service.deleteLeaveType(1)).rejects.toThrow(
        "Cannot delete system-defined leave type",
      );
    });

    it("should create a new leave type", async () => {
      const newLeaveType = {
        restaurantId: "R-001",
        code: "SICK",
        name: "病假",
        description: "因病休假",
        accrualType: "yearly" as const,
        accrualAmount: 10,
        accrualBasedOnSeniority: false,
        requiresApproval: true,
        requiredApprovalLevels: 1,
        minNoticeDays: 1,
        maxConsecutiveDays: null,
        canCarryover: false,
        carryoverMaxDays: null,
        carryoverExpiryMonths: null,
        requiresDocumentation: false,
        documentationRequiredAfterDays: null,
        isPaid: true,
        paymentRate: 100,
        allowHalfDay: true,
        gender: "any" as const,
        applicableToRoles: null,
        maxUsagePerYear: null,
        isSystemDefined: false,
        isActive: true,
        sortOrder: 0,
        color: null,
        icon: null,
      };

      const mockCreatedLeaveType = {
        id: 2,
        ...newLeaveType,
        accrualBasedOnSeniority: false,
        maxConsecutiveDays: null,
        canCarryover: false,
        carryoverMaxDays: null,
        carryoverExpiryMonths: null,
        requiresDocumentation: false,
        documentationRequiredAfterDays: null,
        gender: "any",
        applicableToRoles: null,
        maxUsagePerYear: null,
        isSystemDefined: false,
        isActive: true,
        sortOrder: 0,
        color: null,
        icon: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCreatedLeaveType]),
        }),
      });

      const result = await service.createLeaveType(newLeaveType);

      expect(result.id).toBe(2);
      expect(result.code).toBe("SICK");
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should update a leave type", async () => {
      const updates = {
        name: "病假（更新）",
        accrualAmount: 12,
      };

      const mockUpdatedLeaveType = {
        id: 1,
        name: "病假（更新）",
        accrualAmount: 12,
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([mockUpdatedLeaveType])),
      });

      const result = await service.updateLeaveType(1, updates);

      expect(result.name).toBe("病假（更新）");
      expect(result.accrualAmount).toBe(12);
    });

    it("should soft delete a leave type", async () => {
      // Mock select to return a non-system-defined leave type
      const existingType = {
        id: 1,
        isSystemDefined: false,
        isActive: true,
      };
      mockDb.select.mockReturnValue(createQueryChain([existingType]));

      // Mock update operation
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([])),
      });

      const result = await service.deleteLeaveType(1);

      expect(result).toBe(true);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("Leave Balance Management", () => {
    it("should get employee leave balances for a year", async () => {
      // Mock data structure matching select query result with innerJoin
      const mockQueryResult = [
        {
          balance: {
            id: 1,
            employeeId: 1,
            leaveTypeId: 1,
            restaurantId: "R-001",
            year: 2025,
            totalDays: 14,
            usedDays: 3,
            pendingDays: 2,
            carryoverFromPrevious: 0,
            carryoverToNext: 0,
            carryoverExpiresAt: null,
            manualAdjustment: 0,
            adjustmentReason: null,
            adjustedBy: null,
            adjustedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastUpdatedBy: null,
          },
          leaveType: {
            id: 1,
            code: "ANNUAL",
            name: "年假",
            accrualType: "yearly",
            isPaid: true,
            color: "#3B82F6",
            icon: "🏖️",
          },
        },
      ];

      mockDb.select.mockReturnValue(createQueryChain(mockQueryResult));

      const result = await service.getEmployeeLeaveBalances(1, 2025);

      expect(result).toHaveLength(1);
      expect(result[0].totalDays).toBe(14);
      expect(result[0].usedDays).toBe(3);
      expect(result[0].remainingDays).toBe(9);
    });

    it("should return empty array when employee has no balances", async () => {
      mockDb.select.mockReturnValue(createQueryChain([]));

      const result = await service.getEmployeeLeaveBalances(999, 2025);

      expect(result).toHaveLength(0);
    });

    it("should correctly calculate remaining days", async () => {
      const mockQueryResult = [
        {
          balance: {
            id: 1,
            employeeId: 1,
            leaveTypeId: 1,
            restaurantId: "R-001",
            year: 2025,
            totalDays: 20,
            usedDays: 5,
            pendingDays: 3,
            carryoverFromPrevious: 0,
            carryoverToNext: 0,
            carryoverExpiresAt: null,
            manualAdjustment: 0,
            adjustmentReason: null,
            adjustedBy: null,
            adjustedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastUpdatedBy: null,
          },
          leaveType: {
            id: 1,
            code: "ANNUAL",
            name: "年假",
            accrualType: "yearly",
            isPaid: true,
            color: "#3B82F6",
            icon: "🏖️",
          },
        },
      ];

      mockDb.select.mockReturnValue(createQueryChain(mockQueryResult));

      const result = await service.getEmployeeLeaveBalances(1, 2025);

      // remainingDays = totalDays - usedDays - pendingDays = 20 - 5 - 3 = 12
      expect(result[0].remainingDays).toBe(12);
    });

    it("should get specific leave balance for employee", async () => {
      const mockBalance = {
        id: 1,
        employeeId: 1,
        leaveTypeId: 1,
        restaurantId: "R-001",
        year: 2025,
        totalDays: 14,
        usedDays: 3,
        pendingDays: 2,
        carryoverFromPrevious: 0,
        carryoverToNext: 0,
        carryoverExpiresAt: null,
        manualAdjustment: 0,
        adjustmentReason: null,
        adjustedBy: null,
        adjustedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUpdatedBy: null,
      };

      mockDb.select.mockReturnValue(createQueryChain([mockBalance]));

      const result = await service.getLeaveBalance(1, 1, 2025);

      expect(result).toBeDefined();
      expect(result?.employeeId).toBe(1);
      expect(result?.leaveTypeId).toBe(1);
      expect(result?.remainingDays).toBe(9);
    });

    it("should return null when balance not found", async () => {
      mockDb.select.mockReturnValue(createQueryChain([]));

      const result = await service.getLeaveBalance(999, 1, 2025);

      expect(result).toBeNull();
    });

    it("should create new balance when adjusting non-existent balance", async () => {
      const adjustment = {
        employeeId: 1,
        leaveTypeId: 1,
        year: 2025,
        adjustment: 5,
        reason: "Initial allocation",
        adjustedBy: 1,
      };

      const mockUser = {
        id: 1,
        restaurantId: "R-001",
      };

      // Mock select to return no existing balance (first call)
      mockDb.select.mockReturnValueOnce(createQueryChain([]));
      // Mock select to return user (second call)
      mockDb.select.mockReturnValueOnce(createQueryChain([mockUser]));

      const newBalance = {
        id: 1,
        employeeId: 1,
        leaveTypeId: 1,
        restaurantId: "R-001",
        year: 2025,
        totalDays: 5,
        usedDays: 0,
        pendingDays: 0,
        carryoverFromPrevious: 0,
        carryoverToNext: 0,
        manualAdjustment: 5,
        adjustmentReason: "Initial allocation",
        adjustedBy: 1,
        adjustedAt: Date.now(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUpdatedBy: 1,
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newBalance]),
        }),
      });

      const result = await service.adjustLeaveBalance(adjustment);

      expect(result.totalDays).toBe(5);
      expect(result.manualAdjustment).toBe(5);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should adjust leave balance manually", async () => {
      const adjustment = {
        employeeId: 1,
        leaveTypeId: 1,
        year: 2025,
        adjustment: 5,
        reason: "Extra annual leave",
        adjustedBy: 1,
      };

      // Mock existing balance
      const existingBalance = {
        id: 1,
        employeeId: 1,
        leaveTypeId: 1,
        restaurantId: "R-001",
        year: 2025,
        totalDays: 14,
        usedDays: 3,
        pendingDays: 2,
        remainingDays: 9,
        manualAdjustment: 0,
      };

      // Mock select to return existing balance
      mockDb.select.mockReturnValue(createQueryChain([existingBalance]));

      const updatedBalance = {
        ...existingBalance,
        totalDays: 19,
        remainingDays: 14,
        manualAdjustment: 5,
        adjustmentReason: "Extra annual leave",
      };

      // Mock update to return updated balance
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([updatedBalance])),
      });

      const result = await service.adjustLeaveBalance(adjustment);

      expect(result.totalDays).toBe(19);
      expect(result.manualAdjustment).toBe(5);
    });
  });

  describe("Leave Request Management", () => {
    it("should get leave requests with filters", async () => {
      const mockRequests = [
        {
          request: {
            id: 1,
            restaurantId: "R-001",
            employeeId: 1,
            leaveTypeId: 1,
            startDate: "2025-12-20",
            endDate: "2025-12-24",
            status: "pending",
            totalDays: 5,
          },
          employee: {
            id: 1,
            fullName: "Test Employee",
            email: "test@example.com",
            role: 2,
          },
          leaveType: {
            id: 1,
            code: "ANNUAL",
            name: "年假",
            isPaid: true,
            color: "#3B82F6",
          },
        },
      ];

      // Mock count query
      mockDb.select.mockReturnValueOnce(createQueryChain([{ count: 1 }]));
      // Mock data query
      mockDb.select.mockReturnValueOnce(createQueryChain(mockRequests));

      const result = await service.getLeaveRequests({
        employeeId: 1,
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].employeeId).toBe(1);
    });

    it("should get leave request by ID with relations", async () => {
      const mockRequest = {
        request: {
          id: 1,
          restaurantId: "R-001",
          employeeId: 1,
          leaveTypeId: 1,
          startDate: "2025-12-20",
          endDate: "2025-12-24",
          status: "pending",
          totalDays: 5,
        },
        employee: {
          id: 1,
          fullName: "Test Employee",
          email: "test@example.com",
          role: 2,
        },
        leaveType: {
          id: 1,
          code: "ANNUAL",
          name: "年假",
          isPaid: true,
          color: "#3B82F6",
        },
      };

      mockDb.select.mockReturnValue(createQueryChain([mockRequest]));

      const result = await service.getLeaveRequest(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.employee.fullName).toBe("Test Employee");
      expect(result?.leaveType.name).toBe("年假");
    });

    it("should return null when leave request not found", async () => {
      mockDb.select.mockReturnValue(createQueryChain([]));

      const result = await service.getLeaveRequest(999);

      expect(result).toBeNull();
    });

    it("should create a leave request with pending status", async () => {
      const newRequest = {
        restaurantId: "R-001",
        employeeId: 1,
        leaveTypeId: 1,
        startDate: "2025-12-20",
        endDate: "2025-12-24",
        startPeriod: "full" as const,
        endPeriod: "full" as const,
        totalDays: 5,
        reason: "Family vacation",
        attachmentUrl: null,
        emergencyContact: null,
      };

      const mockCreatedRequest: LeaveRequest = {
        id: 1,
        restaurantId: "R-001",
        employeeId: 1,
        leaveTypeId: 1,
        startDate: "2025-12-20",
        endDate: "2025-12-24",
        startPeriod: "full",
        endPeriod: "full",
        totalDays: 5,
        reason: "Family vacation",
        attachmentUrl: null,
        emergencyContact: null,
        status: "pending",
        approvalChain: "[]",
        currentApprovalLevel: 0,
        finalApproverId: null,
        finalApprovedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        cancelledBy: null,
        cancelledAt: null,
        cancellationReason: null,
        affectedScheduleIds: null,
        replacementNotified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        submittedAt: Date.now(),
      };

      // Mock balance check
      mockDb.select.mockReturnValue(
        createQueryChain([
          {
            totalDays: 14,
            usedDays: 3,
            pendingDays: 0,
            remainingDays: 11,
          },
        ]),
      );

      // Mock insert
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCreatedRequest]),
        }),
      });

      // Mock update balance
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([])),
      });

      const result = await service.createLeaveRequest(newRequest);

      expect(result.status).toBe("pending");
      expect(result.totalDays).toBe(5);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should approve leave request and update balance", async () => {
      const existingRequest = {
        id: 1,
        restaurantId: "R-001",
        employeeId: 1,
        leaveTypeId: 1,
        status: "pending",
        totalDays: 5,
        startDate: "2025-12-20",
        endDate: "2025-12-24",
        currentApprovalLevel: 0,
        requiredApprovalLevels: 1,
      };

      // Mock get request (first select call) - matching getLeaveRequest structure
      mockDb.select.mockReturnValueOnce(
        createQueryChain([
          {
            request: {
              ...existingRequest,
            },
            employee: {
              id: 1,
              fullName: "Test Employee",
              email: "test@example.com",
              role: 2,
            },
            leaveType: {
              id: 1,
              code: "ANNUAL",
              name: "年假",
              isPaid: true,
              color: "#3B82F6",
              requiredApprovalLevels: 1,
            },
          },
        ]),
      );

      // Mock get balance (second select call)
      mockDb.select.mockReturnValueOnce(
        createQueryChain([
          {
            id: 1,
            totalDays: 14,
            usedDays: 3,
            pendingDays: 5,
            remainingDays: 6,
          },
        ]),
      );

      const approvedRequest = {
        ...existingRequest,
        status: "approved",
        finalApproverId: 1,
        finalApprovedAt: Date.now(),
      };

      // Mock update request (first update call)
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue(createQueryChain([approvedRequest])),
      });

      // Mock update balance (second update call)
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue(createQueryChain([])),
      });

      const result = await service.approveLeaveRequest(1, 1, "Approved");

      expect(result.status).toBe("approved");
      expect(result.finalApproverId).toBe(1);
    });

    it("should reject leave request with reason", async () => {
      const existingRequest = {
        id: 1,
        restaurantId: "R-001",
        employeeId: 1,
        leaveTypeId: 1,
        status: "pending",
        totalDays: 5,
      };

      // Mock get request (first select call) - matching getLeaveRequest structure
      mockDb.select.mockReturnValueOnce(
        createQueryChain([
          {
            request: {
              ...existingRequest,
            },
            employee: {
              id: 1,
              fullName: "Test Employee",
              email: "test@example.com",
              role: 2,
            },
            leaveType: {
              id: 1,
              code: "ANNUAL",
              name: "年假",
              isPaid: true,
              color: "#3B82F6",
              requiredApprovalLevels: 1,
            },
          },
        ]),
      );

      // Mock get balance (second select call)
      mockDb.select.mockReturnValueOnce(
        createQueryChain([
          {
            id: 1,
            pendingDays: 5,
          },
        ]),
      );

      const rejectedRequest = {
        ...existingRequest,
        status: "rejected",
        rejectedBy: 1,
        rejectionReason: "Insufficient coverage",
        rejectedAt: Date.now(),
      };

      // Mock update request (first update call)
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue(createQueryChain([rejectedRequest])),
      });

      // Mock update balance (second update call)
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue(createQueryChain([])),
      });

      const result = await service.rejectLeaveRequest(
        1,
        1,
        "Insufficient coverage",
      );

      expect(result.status).toBe("rejected");
      expect(result.rejectionReason).toBe("Insufficient coverage");
    });

    it("should cancel leave request", async () => {
      const existingRequest = {
        id: 1,
        restaurantId: "R-001",
        employeeId: 1,
        leaveTypeId: 1,
        status: "approved",
        totalDays: 5,
      };

      // Mock get request (first select call) - matching getLeaveRequest structure
      mockDb.select.mockReturnValueOnce(
        createQueryChain([
          {
            request: {
              ...existingRequest,
            },
            employee: {
              id: 1,
              fullName: "Test Employee",
              email: "test@example.com",
              role: 2,
            },
            leaveType: {
              id: 1,
              code: "ANNUAL",
              name: "年假",
              isPaid: true,
              color: "#3B82F6",
              requiredApprovalLevels: 1,
            },
          },
        ]),
      );

      // Mock get balance (second select call)
      mockDb.select.mockReturnValueOnce(
        createQueryChain([
          {
            id: 1,
            usedDays: 5,
          },
        ]),
      );

      const cancelledRequest = {
        ...existingRequest,
        status: "cancelled",
        cancelledBy: 1,
        cancellationReason: "Plans changed",
        cancelledAt: Date.now(),
      };

      // Mock update request (first update call)
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue(createQueryChain([cancelledRequest])),
      });

      // Mock update balance (second update call)
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue(createQueryChain([])),
      });

      const result = await service.cancelLeaveRequest(1, 1, "Plans changed");

      expect(result.status).toBe("cancelled");
      expect(result.cancellationReason).toBe("Plans changed");
    });

    it("should create leave request with half-day periods", async () => {
      const halfDayRequest = {
        restaurantId: "R-001",
        employeeId: 1,
        leaveTypeId: 1,
        startDate: "2025-12-20",
        endDate: "2025-12-20",
        startPeriod: "am" as const,
        endPeriod: "am" as const,
        totalDays: 0.5,
        reason: "Medical appointment",
        attachmentUrl: null,
        emergencyContact: null,
      };

      const mockLeaveType = {
        id: 1,
        code: "SICK",
        name: "病假",
        allowHalfDay: true,
        requiredApprovalLevels: 1,
      };

      // Mock get leave type
      mockDb.select.mockReturnValueOnce(createQueryChain([mockLeaveType]));
      // Mock get balance
      mockDb.select.mockReturnValueOnce(
        createQueryChain([
          {
            totalDays: 10,
            usedDays: 2,
            pendingDays: 0,
            remainingDays: 8,
          },
        ]),
      );

      const createdRequest = {
        id: 1,
        ...halfDayRequest,
        status: "pending",
        approvalChain: "[]",
        currentApprovalLevel: 0,
        replacementNotified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        submittedAt: Date.now(),
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdRequest]),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue(createQueryChain([])),
      });

      const result = await service.createLeaveRequest(halfDayRequest);

      expect(result.totalDays).toBe(0.5);
      expect(result.startPeriod).toBe("am");
      expect(result.status).toBe("pending");
    });

    it("should handle multi-level approval workflow", async () => {
      const existingRequest = {
        id: 1,
        restaurantId: "R-001",
        employeeId: 1,
        leaveTypeId: 1,
        status: "pending",
        totalDays: 5,
        startDate: "2025-12-20",
        endDate: "2025-12-24",
        currentApprovalLevel: 0,
      };

      const mockLeaveType = {
        id: 1,
        code: "ANNUAL",
        name: "年假",
        isPaid: true,
        color: "#3B82F6",
        requiredApprovalLevels: 2, // Multi-level approval
      };

      // Mock get request (first select call)
      mockDb.select.mockReturnValueOnce(
        createQueryChain([
          {
            request: existingRequest,
            employee: {
              id: 1,
              fullName: "Test Employee",
              email: "test@example.com",
              role: 2,
            },
            leaveType: mockLeaveType,
          },
        ]),
      );

      // Mock get leave type (second select call)
      mockDb.select.mockReturnValueOnce(createQueryChain([mockLeaveType]));

      const partiallyApprovedRequest = {
        ...existingRequest,
        currentApprovalLevel: 1,
        updatedAt: new Date(),
      };

      // Mock update to move to next level
      mockDb.update.mockReturnValue({
        set: vi
          .fn()
          .mockReturnValue(createQueryChain([partiallyApprovedRequest])),
      });

      const result = await service.approveLeaveRequest(1, 1);

      expect(result.currentApprovalLevel).toBe(1);
      expect(result.status).toBe("pending"); // Still pending, not final approval
    });

    it("should fail to reject already approved request", async () => {
      const approvedRequest = {
        id: 1,
        restaurantId: "R-001",
        employeeId: 1,
        leaveTypeId: 1,
        status: "approved", // Already approved
        totalDays: 5,
      };

      mockDb.select.mockReturnValue(
        createQueryChain([
          {
            request: approvedRequest,
            employee: {
              id: 1,
              fullName: "Test Employee",
              email: "test@example.com",
              role: 2,
            },
            leaveType: {
              id: 1,
              code: "ANNUAL",
              name: "年假",
              isPaid: true,
              color: "#3B82F6",
            },
          },
        ]),
      );

      await expect(
        service.rejectLeaveRequest(1, 1, "Too late"),
      ).rejects.toThrow("Leave request is not in pending status");
    });

    it("should fail to cancel already rejected request", async () => {
      const rejectedRequest = {
        id: 1,
        restaurantId: "R-001",
        employeeId: 1,
        leaveTypeId: 1,
        status: "rejected", // Already rejected
        totalDays: 5,
      };

      mockDb.select.mockReturnValue(
        createQueryChain([
          {
            request: rejectedRequest,
            employee: {
              id: 1,
              fullName: "Test Employee",
              email: "test@example.com",
              role: 2,
            },
            leaveType: {
              id: 1,
              code: "ANNUAL",
              name: "年假",
              isPaid: true,
              color: "#3B82F6",
            },
          },
        ]),
      );

      await expect(
        service.cancelLeaveRequest(1, 1, "Want to cancel"),
      ).rejects.toThrow("Leave request cannot be cancelled");
    });
  });

  describe("Working Day Calculation", () => {
    it("should identify weekday as working day", async () => {
      // Monday 2025-12-01
      // Mock select to return no holidays
      mockDb.select.mockReturnValue(createQueryChain([]));

      const result = await service.isWorkingDay("R-001", "2025-12-01");

      expect(result).toBe(true);
    });

    it("should identify weekend as non-working day", async () => {
      // Saturday 2025-12-06 - Mock as weekend event in calendar
      mockDb.select.mockReturnValue(
        createQueryChain([
          {
            id: 1,
            eventDate: "2025-12-06",
            isWorkingDay: false,
            eventType: "weekend",
          },
        ]),
      );

      const result = await service.isWorkingDay("R-001", "2025-12-06");

      expect(result).toBe(false);
    });

    it("should identify holiday as non-working day", async () => {
      // Mock holiday exists with isWorkingDay = false
      mockDb.select.mockReturnValue(
        createQueryChain([
          {
            id: 1,
            eventDate: "2025-12-25",
            isWorkingDay: false,
            eventType: "public_holiday",
          },
        ]),
      );

      const result = await service.isWorkingDay("R-001", "2025-12-25");

      expect(result).toBe(false);
    });
  });

  describe("Leave Accrual", () => {
    it("should accrue yearly leave balances for all employees", async () => {
      const mockEmployees = [
        { id: 1, restaurantId: "R-001", role: 1 },
        { id: 2, restaurantId: "R-001", role: 2 },
      ];

      const mockLeaveTypes = [
        {
          id: 1,
          code: "ANNUAL",
          accrualType: "yearly",
          accrualAmount: 14,
        },
      ];

      // Mock get employees
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockEmployees),
        }),
      });

      // Mock get leave types
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockLeaveTypes),
        }),
      });

      // Mock existing balance check (none exist)
      mockDb.select.mockReturnValue(createQueryChain([]));

      // Mock insert balance
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{}]),
        }),
      });

      const result = await service.accrueLeaveBalances("R-001", 2025);

      expect(result).toBeGreaterThan(0);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
