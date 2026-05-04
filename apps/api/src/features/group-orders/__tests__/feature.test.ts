/**
 * Group Orders Feature Tests
 * Comprehensive test suite for group orders functionality
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GroupOrdersService } from "../services/GroupOrdersService";
import { groupOrderSchemas } from "../schemas/validation";
import type { CreateGroupOrderRequest, JoinGroupRequest } from "../types";

// Mock drizzle-orm/d1
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
  sql: vi.fn(),
  count: vi.fn(),
  isNull: vi.fn(),
  gte: vi.fn(),
}));

vi.mock("@makanmasak/database", () => ({
  groupOrders: {},
  groupMembers: {},
  groupCartItems: {},
  splitBills: {},
  groupActivityLogs: {},
  shareCodes: {},
  menuItems: {},
}));

// Helper to set up mock chain for select queries
function setupSelectChain(returnValue: any) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnValue),
    innerJoin: vi.fn().mockReturnThis(),
  };
  // If limit is not called, the promise should resolve from where/orderBy/from
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  // Make it thenable so await works at any point in the chain
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(returnValue).then(resolve, reject);
  return chain;
}

// Helper to set up mock chain for insert queries
function setupInsertChain() {
  const chain: any = {
    values: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

// Helper to set up mock chain for update queries
function setupUpdateChain() {
  const chain: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  chain.set.mockReturnValue(chain);
  return chain;
}

// Helper to set up mock chain for delete queries
function setupDeleteChain() {
  const chain: any = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

describe("Group Orders Feature", () => {
  let groupOrderService: GroupOrdersService;
  let mockD1: any;
  let mockKV: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock D1 database (passed to drizzle constructor)
    mockD1 = {};

    // Mock KV store
    mockKV = {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
    };

    // Default mock behaviors - select returns empty arrays
    mockDb.select.mockImplementation(() => setupSelectChain([]));
    mockDb.insert.mockImplementation(() => setupInsertChain());
    mockDb.update.mockImplementation(() => setupUpdateChain());
    mockDb.delete.mockImplementation(() => setupDeleteChain());

    groupOrderService = new GroupOrdersService(mockD1, mockKV, "info");
  });

  describe("Validation", () => {
    it("should sanitize executable markup from free-text fields", () => {
      const payload = `<scri<script>pt>alert(1)</script><img src=x ononerror=alert(1)>`;
      const createResult = groupOrderSchemas.createGroupOrder.safeParse({
        restaurantId: "1",
        hostName: "Host",
        notes: payload,
      });
      const addItemResult = groupOrderSchemas.addCartItem.safeParse({
        memberId: "123e4567-e89b-12d3-a456-426614174000",
        menuItemId: 1,
        quantity: 1,
        specialInstructions: payload,
      });

      expect(createResult.success).toBe(true);
      expect(addItemResult.success).toBe(true);
      if (!createResult.success || !addItemResult.success) return;
      expect(createResult.data.notes).not.toContain("<");
      expect(createResult.data.notes).not.toContain(">");
      expect(createResult.data.notes).not.toContain("=");
      expect(addItemResult.data.specialInstructions).not.toContain("<");
      expect(addItemResult.data.specialInstructions).not.toContain(">");
      expect(addItemResult.data.specialInstructions).not.toContain("=");
    });
  });

  describe("Group Order Creation", () => {
    it("should create a group order successfully", async () => {
      // Mock: insert succeeds, select returns host member
      mockDb.insert.mockImplementation(() => setupInsertChain());
      mockDb.select.mockImplementation(() =>
        setupSelectChain([
          {
            id: "member-001",
            groupOrderId: "group-001",
            sessionId: "session-001",
            name: "Host",
            role: "creator",
            joinedAt: new Date(),
            lastActiveAt: new Date(),
            isActive: true,
            leftAt: null,
          },
        ]),
      );

      const createData: CreateGroupOrderRequest = {
        restaurantId: "1",
        tableId: 5,
        expirationHours: 24,
        maxMembers: 8,
        permissions: {
          canInviteMembers: true,
          canModifyOthersCart: false,
          canFinalizeOrder: true,
          canSplitBill: true,
          canProcessPayment: true,
        },
      };

      const result = await groupOrderService.createGroupOrder(createData, 1);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.shareCode).toBeDefined();
      expect(result.data?.groupOrderId).toBeDefined();

      // Verify DB mocks were called
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should validate required fields", () => {
      const invalidData = {
        // Missing restaurantId
        tableId: 5,
      };

      const result = groupOrderSchemas.createGroupOrder.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should validate expiration hours range", () => {
      const invalidData = {
        restaurantId: "1",
        expirationHours: 200, // Too long
      };

      const result = groupOrderSchemas.createGroupOrder.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("Group Joining", () => {
    it("should allow members to join with valid share code", async () => {
      const shareCode = "ABC12345";
      const memberData: JoinGroupRequest = {
        memberName: "John Doe",
        phone: "123-456-7890",
        email: "john@example.com",
      };

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Group order lookup
          return setupSelectChain([
            {
              id: "group-001",
              restaurantId: "1",
              status: "active",
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              settings: { maxMembers: 8, permissions: {} },
              shareCode: "ABC12345",
              createdBy: 1,
              totalAmount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]);
        } else if (selectCallCount === 2) {
          // Member count
          return setupSelectChain([{ count: 1 }]);
        } else if (selectCallCount === 3) {
          // Existing member check (empty = no duplicate)
          return setupSelectChain([]);
        } else if (selectCallCount === 4) {
          // Get created member
          return setupSelectChain([
            {
              id: "member-001",
              groupOrderId: "group-001",
              sessionId: "session-001",
              name: "John Doe",
              phone: "123-456-7890",
              email: "john@example.com",
              role: "member",
              joinedAt: new Date(),
              lastActiveAt: new Date(),
              isActive: true,
              leftAt: null,
            },
          ]);
        }
        return setupSelectChain([]);
      });

      mockDb.insert.mockImplementation(() => setupInsertChain());

      const result = await groupOrderService.joinGroup(shareCode, memberData);
      expect(result.success).toBe(true);

      // Verify DB mocks were called for lookups and insert
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should validate member name requirements", () => {
      const invalidData = {
        memberName: "", // Empty name
        phone: "123-456-7890",
      };

      const result = groupOrderSchemas.joinGroup.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should validate email format", () => {
      const invalidData = {
        memberName: "John Doe",
        email: "invalid-email", // Invalid format
      };

      const result = groupOrderSchemas.joinGroup.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("Cart Management", () => {
    it("should validate cart item data", () => {
      const validData = {
        memberId: "123e4567-e89b-12d3-a456-426614174000",
        menuItemId: 1,
        quantity: 2,
        customizations: { size: "large" },
        specialInstructions: "No onions",
      };

      const result = groupOrderSchemas.addCartItem.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid member ID format", () => {
      const invalidData = {
        memberId: "invalid-uuid",
        menuItemId: 1,
        quantity: 2,
      };

      const result = groupOrderSchemas.addCartItem.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should validate quantity limits", () => {
      const invalidData = {
        memberId: "123e4567-e89b-12d3-a456-426614174000",
        menuItemId: 1,
        quantity: 0, // Invalid quantity
      };

      const result = groupOrderSchemas.addCartItem.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("Bill Splitting", () => {
    it("should validate split bill data", () => {
      const validData = {
        splitType: "equal" as const,
      };

      const result = groupOrderSchemas.splitBill.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should require custom splits for custom split type", () => {
      const invalidData = {
        splitType: "custom" as const,
        // Missing customSplits
      };

      const result = groupOrderSchemas.splitBill.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should validate custom split amounts", () => {
      const validData = {
        splitType: "custom" as const,
        customSplits: [
          {
            memberId: "123e4567-e89b-12d3-a456-426614174000",
            amount: 25.5,
            items: [],
          },
        ],
      };

      const result = groupOrderSchemas.splitBill.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("Payment Processing", () => {
    it("should validate payment data", () => {
      const validData = {
        paymentMethod: "credit_card",
        amount: 29.99,
        transactionId: "txn_123456",
      };

      const result = groupOrderSchemas.processPayment.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject negative payment amounts", () => {
      const invalidData = {
        paymentMethod: "credit_card",
        amount: -10.0, // Negative amount
      };

      const result = groupOrderSchemas.processPayment.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should validate payment amount limits", () => {
      const invalidData = {
        paymentMethod: "credit_card",
        amount: 100000.0, // Too large
      };

      const result = groupOrderSchemas.processPayment.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("Parameter Validation", () => {
    it("should validate UUID parameters", () => {
      const validUUID = "123e4567-e89b-12d3-a456-426614174000";
      const result = groupOrderSchemas.groupOrderIdParam.safeParse({
        groupOrderId: validUUID,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID format", () => {
      const invalidUUID = "not-a-uuid";
      const result = groupOrderSchemas.groupOrderIdParam.safeParse({
        groupOrderId: invalidUUID,
      });
      expect(result.success).toBe(false);
    });

    it("should validate share code format", () => {
      const validCode = "ABC12345";
      const result = groupOrderSchemas.shareCodeParam.safeParse({
        shareCode: validCode,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid share code format", () => {
      const invalidCode = "abc123"; // Should be uppercase
      const result = groupOrderSchemas.shareCodeParam.safeParse({
        shareCode: invalidCode,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Query Validation", () => {
    it("should validate activities query parameters", () => {
      const validQuery = {
        limit: 25,
        offset: 0,
        type: "member_joined" as const,
      };

      const result = groupOrderSchemas.activitiesQuery.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it("should apply default values for optional parameters", () => {
      const minimalQuery = {};

      const result = groupOrderSchemas.activitiesQuery.safeParse(minimalQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it("should validate statistics query parameters", () => {
      const validQuery = {
        timeRange: "month" as const,
        restaurantId: "1", // Schema expects string that transforms to number
        startDate: "2023-01-01T00:00:00Z",
        endDate: "2023-01-31T23:59:59Z",
      };

      const result = groupOrderSchemas.statisticsQuery.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it("should validate date range logic", () => {
      const invalidQuery = {
        startDate: "2023-01-31T00:00:00Z",
        endDate: "2023-01-01T00:00:00Z", // End before start
      };

      const result = groupOrderSchemas.statisticsQuery.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });
  });

  describe("Service Integration", () => {
    it("should handle database errors gracefully", async () => {
      // Mock database error - insert throws
      mockDb.insert.mockImplementation(() => ({
        values: vi.fn().mockRejectedValue(new Error("Database error")),
      }));

      const createData: CreateGroupOrderRequest = {
        restaurantId: "1",
      };

      const result = await groupOrderService.createGroupOrder(createData, 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create group order");

      // Verify DB insert was attempted
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should generate unique share codes", async () => {
      const codes = new Set();

      // Mock: insert succeeds, select returns host member
      mockDb.insert.mockImplementation(() => setupInsertChain());
      mockDb.select.mockImplementation(() =>
        setupSelectChain([
          {
            id: "member-001",
            groupOrderId: "group-001",
            sessionId: "session-001",
            name: "Host",
            role: "creator",
            joinedAt: new Date(),
            lastActiveAt: new Date(),
            isActive: true,
            leftAt: null,
          },
        ]),
      );

      // Generate multiple share codes and check uniqueness
      for (let i = 0; i < 100; i++) {
        const createData: CreateGroupOrderRequest = { restaurantId: "1" };
        const result = await groupOrderService.createGroupOrder(createData, 1);

        if (result.success && result.data?.shareCode) {
          codes.add(result.data.shareCode);
        }
      }

      // All codes should be unique
      expect(codes.size).toBe(100);

      // Verify DB was called for each creation
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.select).toHaveBeenCalled();
    });
  });
});
