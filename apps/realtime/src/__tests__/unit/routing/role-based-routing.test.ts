/**
 * Role-Based Routing Tests
 * 測試 RealtimeSession 的角色路由和存取驗證邏輯
 *
 * Since validateRoleRoomAccess, validateRestaurantAccess, and validateTableAccess
 * are private methods on RealtimeSession, we recreate the validation logic here
 * (same pattern as event-filtering.test.ts).
 */

import { describe, it, expect, vi } from "vitest";
import type { RealtimeAuthPayload } from "@makanmasak/shared-types";
import { createTestAuthPayload, getStringRole } from "../../helpers/test-utils";

// ---------------------------------------------------------------------------
// Recreate private validation functions from RealtimeSession
// ---------------------------------------------------------------------------

/**
 * Validates whether a given role is allowed to access a specific room type.
 * Mirrors the private validateRoleRoomAccess method on RealtimeSession.
 */
function validateRoleRoomAccess(
  role: string,
  roomType: string,
): { valid: boolean; error?: string } {
  const roleRoomMap: Record<string, string[]> = {
    customer: ["customer"],
    staff: ["kitchen"],
    admin: ["admin", "kitchen", "restaurant"],
  };
  const allowedRooms = roleRoomMap[role] || [];
  if (!allowedRooms.includes(roomType)) {
    return {
      valid: false,
      error: `Role "${role}" is not authorized to access "${roomType}" rooms`,
    };
  }
  return { valid: true };
}

/**
 * Creates a mock D1 database that returns preconfigured results for SQL queries.
 */
function createMockDB(queryResults: Record<string, any> = {}) {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((..._args: any[]) => ({
        first: vi.fn().mockResolvedValue(queryResults[sql] ?? null),
      })),
    })),
  };
}

/**
 * Creates a mock D1 database where every query rejects with an error.
 */
function createErrorDB(errorMessage = "Database connection failed") {
  return {
    prepare: vi.fn((_sql: string) => ({
      bind: vi.fn((..._args: any[]) => ({
        first: vi.fn().mockRejectedValue(new Error(errorMessage)),
      })),
    })),
  };
}

/**
 * Validates that the authenticated user belongs to the target restaurant.
 * Mirrors the private validateRestaurantAccess method on RealtimeSession.
 */
async function validateRestaurantAccess(
  authPayload: RealtimeAuthPayload,
  db: any,
): Promise<{ valid: boolean; error?: string }> {
  if (!authPayload.userId) {
    return {
      valid: false,
      error: "User ID is required for staff/admin access",
    };
  }
  try {
    const stmt = db.prepare(
      "SELECT restaurant_id FROM users WHERE id = ? AND is_active = 1",
    );
    const result = await stmt.bind(authPayload.userId).first();
    if (!result) {
      return { valid: false, error: "User not found or inactive" };
    }
    if (result.restaurant_id !== authPayload.restaurantId) {
      return {
        valid: false,
        error: "User does not belong to this restaurant",
      };
    }
    return { valid: true };
  } catch (_error) {
    return { valid: false, error: "Failed to validate restaurant access" };
  }
}

/**
 * Validates that the target table (and optionally seat) belongs to the restaurant.
 * Mirrors the private validateTableAccess method on RealtimeSession.
 */
async function validateTableAccess(
  authPayload: RealtimeAuthPayload,
  db: any,
): Promise<{ valid: boolean; error?: string }> {
  if (!authPayload.tableId) {
    return { valid: true }; // Shop mode - no table required
  }
  try {
    const stmt = db.prepare(
      "SELECT id, restaurant_id FROM tables WHERE id = ? AND is_active = 1",
    );
    const table = await stmt.bind(authPayload.tableId).first();
    if (!table) {
      return { valid: false, error: "Table not found or inactive" };
    }
    if (table.restaurant_id !== authPayload.restaurantId) {
      return {
        valid: false,
        error: "Table does not belong to this restaurant",
      };
    }
    if (authPayload.seatId) {
      const seatStmt = db.prepare(
        "SELECT id, table_id FROM seats WHERE id = ? AND is_active = 1",
      );
      const seat = await seatStmt.bind(authPayload.seatId).first();
      if (!seat) {
        return { valid: false, error: "Seat not found or inactive" };
      }
      if (seat.table_id !== table.id) {
        return { valid: false, error: "Seat does not belong to this table" };
      }
    }
    return { valid: true };
  } catch (_error) {
    return { valid: false, error: "Failed to validate table access" };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Role-Based Routing", () => {
  // -----------------------------------------------------------------------
  // validateRoleRoomAccess
  // -----------------------------------------------------------------------
  describe("validateRoleRoomAccess", () => {
    describe("Customer role", () => {
      it("can access customer rooms", () => {
        const result = validateRoleRoomAccess("customer", "customer");
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("cannot access admin rooms", () => {
        const result = validateRoleRoomAccess("customer", "admin");
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("cannot access kitchen rooms", () => {
        const result = validateRoleRoomAccess("customer", "kitchen");
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("cannot access restaurant rooms", () => {
        const result = validateRoleRoomAccess("customer", "restaurant");
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe("Staff role", () => {
      it("can access kitchen rooms", () => {
        const result = validateRoleRoomAccess("staff", "kitchen");
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("cannot access admin rooms", () => {
        const result = validateRoleRoomAccess("staff", "admin");
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("cannot access customer rooms", () => {
        const result = validateRoleRoomAccess("staff", "customer");
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("cannot access restaurant rooms", () => {
        const result = validateRoleRoomAccess("staff", "restaurant");
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe("Admin role", () => {
      it("can access admin rooms", () => {
        const result = validateRoleRoomAccess("admin", "admin");
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("can access kitchen rooms", () => {
        const result = validateRoleRoomAccess("admin", "kitchen");
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("can access restaurant rooms", () => {
        const result = validateRoleRoomAccess("admin", "restaurant");
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("cannot access customer rooms", () => {
        const result = validateRoleRoomAccess("admin", "customer");
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe("Edge cases", () => {
      it("unknown role has no access to any room", () => {
        const roomTypes = ["customer", "admin", "kitchen", "restaurant"];
        roomTypes.forEach((roomType) => {
          const result = validateRoleRoomAccess("unknown", roomType);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('"unknown"');
        });
      });

      it("returns specific error message with role and room type", () => {
        const result = validateRoleRoomAccess("customer", "admin");
        expect(result.error).toBe(
          'Role "customer" is not authorized to access "admin" rooms',
        );
      });

      it("empty role string has no access", () => {
        const result = validateRoleRoomAccess("", "customer");
        expect(result.valid).toBe(false);
      });

      it("role matching is case-sensitive", () => {
        const result = validateRoleRoomAccess("Admin", "admin");
        expect(result.valid).toBe(false);
      });
    });
  });

  // -----------------------------------------------------------------------
  // validateRestaurantAccess
  // -----------------------------------------------------------------------
  describe("validateRestaurantAccess", () => {
    it("should reject when userId is missing", async () => {
      const { userId: _userId, ...payloadWithoutUserId } =
        createTestAuthPayload("admin", "admin-room", "restaurant-123", 0);
      const payload = payloadWithoutUserId as unknown as RealtimeAuthPayload;
      const db = createMockDB();

      const result = await validateRestaurantAccess(payload, db);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User ID is required for staff/admin access");
      // DB should never be queried when userId is missing
      expect(db.prepare).not.toHaveBeenCalled();
    });

    it("should reject when userId is undefined", async () => {
      const payload: RealtimeAuthPayload = {
        roomType: "admin",
        roomId: "admin-room",
        restaurantId: "restaurant-123",
        role: "admin",
        userId: undefined,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const db = createMockDB();

      const result = await validateRestaurantAccess(payload, db);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User ID is required for staff/admin access");
    });

    it("should reject when user not found in DB", async () => {
      const payload = createTestAuthPayload(
        "admin",
        "admin-room",
        "restaurant-123",
        0,
        {
          userId: 42,
        },
      );
      // Return null for the user query (user not found)
      const db = createMockDB({});

      const result = await validateRestaurantAccess(payload, db);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User not found or inactive");
    });

    it("should reject when user is inactive (query returns null because is_active = 0)", async () => {
      const payload = createTestAuthPayload(
        "kitchen",
        "kitchen-room",
        "restaurant-123",
        2,
        {
          userId: 99,
        },
      );
      // The SQL includes "AND is_active = 1", so an inactive user returns null
      const db = createMockDB({});

      const result = await validateRestaurantAccess(payload, db);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User not found or inactive");
    });

    it("should reject when restaurant_id does not match", async () => {
      const payload = createTestAuthPayload(
        "admin",
        "admin-room",
        "restaurant-123",
        0,
        {
          userId: 42,
        },
      );
      const db = createMockDB({
        "SELECT restaurant_id FROM users WHERE id = ? AND is_active = 1": {
          restaurant_id: "restaurant-999", // Different restaurant
        },
      });

      const result = await validateRestaurantAccess(payload, db);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("User does not belong to this restaurant");
    });

    it("should pass when user belongs to restaurant", async () => {
      const payload = createTestAuthPayload(
        "admin",
        "admin-room",
        "restaurant-123",
        0,
        {
          userId: 42,
        },
      );
      const db = createMockDB({
        "SELECT restaurant_id FROM users WHERE id = ? AND is_active = 1": {
          restaurant_id: "restaurant-123",
        },
      });

      const result = await validateRestaurantAccess(payload, db);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should handle database errors gracefully", async () => {
      const payload = createTestAuthPayload(
        "admin",
        "admin-room",
        "restaurant-123",
        0,
        {
          userId: 42,
        },
      );
      const db = createErrorDB("D1 connection timeout");

      const result = await validateRestaurantAccess(payload, db);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Failed to validate restaurant access");
    });
  });

  // -----------------------------------------------------------------------
  // validateTableAccess
  // -----------------------------------------------------------------------
  describe("validateTableAccess", () => {
    it("should pass when no tableId (shop mode)", async () => {
      const payload: RealtimeAuthPayload = {
        roomType: "customer",
        roomId: "customer-room",
        restaurantId: "restaurant-123",
        role: "customer",
        // tableId intentionally omitted (shop mode)
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const db = createMockDB();

      const result = await validateTableAccess(payload, db);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      // DB should not be queried in shop mode
      expect(db.prepare).not.toHaveBeenCalled();
    });

    it("should reject when table not found", async () => {
      const payload = createTestAuthPayload(
        "customer",
        "table-room",
        "restaurant-123",
        4,
        {
          tableId: "table-999",
        },
      );
      // No matching table in DB
      const db = createMockDB({});

      const result = await validateTableAccess(payload, db);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Table not found or inactive");
    });

    it("should reject when table is inactive (query returns null because is_active = 0)", async () => {
      const payload = createTestAuthPayload(
        "customer",
        "table-room",
        "restaurant-123",
        4,
        {
          tableId: "table-5",
        },
      );
      // Inactive table returns null from the query
      const db = createMockDB({});

      const result = await validateTableAccess(payload, db);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Table not found or inactive");
    });

    it("should reject when table belongs to different restaurant", async () => {
      const payload = createTestAuthPayload(
        "customer",
        "table-room",
        "restaurant-123",
        4,
        {
          tableId: "table-5",
        },
      );
      const db = createMockDB({
        "SELECT id, restaurant_id FROM tables WHERE id = ? AND is_active = 1": {
          id: "table-5",
          restaurant_id: "restaurant-456", // Different restaurant
        },
      });

      const result = await validateTableAccess(payload, db);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Table does not belong to this restaurant");
    });

    it("should pass when table belongs to correct restaurant", async () => {
      const payload = createTestAuthPayload(
        "customer",
        "table-room",
        "restaurant-123",
        4,
        {
          tableId: "table-5",
        },
      );
      const db = createMockDB({
        "SELECT id, restaurant_id FROM tables WHERE id = ? AND is_active = 1": {
          id: "table-5",
          restaurant_id: "restaurant-123",
        },
      });

      const result = await validateTableAccess(payload, db);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject when seat not found", async () => {
      const payload = createTestAuthPayload(
        "customer",
        "table-room",
        "restaurant-123",
        4,
        {
          tableId: "table-5",
          seatId: "seat-999",
        },
      );
      const db = createMockDB({
        "SELECT id, restaurant_id FROM tables WHERE id = ? AND is_active = 1": {
          id: "table-5",
          restaurant_id: "restaurant-123",
        },
        // Seat query returns null (not found)
      });

      const result = await validateTableAccess(payload, db);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Seat not found or inactive");
    });

    it("should reject when seat is inactive (query returns null because is_active = 0)", async () => {
      const payload = createTestAuthPayload(
        "customer",
        "table-room",
        "restaurant-123",
        4,
        {
          tableId: "table-5",
          seatId: "seat-3",
        },
      );
      const db = createMockDB({
        "SELECT id, restaurant_id FROM tables WHERE id = ? AND is_active = 1": {
          id: "table-5",
          restaurant_id: "restaurant-123",
        },
        // Inactive seat returns null
      });

      const result = await validateTableAccess(payload, db);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Seat not found or inactive");
    });

    it("should reject when seat belongs to different table", async () => {
      const payload = createTestAuthPayload(
        "customer",
        "table-room",
        "restaurant-123",
        4,
        {
          tableId: "table-5",
          seatId: "seat-3",
        },
      );
      const db = createMockDB({
        "SELECT id, restaurant_id FROM tables WHERE id = ? AND is_active = 1": {
          id: "table-5",
          restaurant_id: "restaurant-123",
        },
        "SELECT id, table_id FROM seats WHERE id = ? AND is_active = 1": {
          id: "seat-3",
          table_id: "table-99", // Different table
        },
      });

      const result = await validateTableAccess(payload, db);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Seat does not belong to this table");
    });

    it("should pass when seat belongs to correct table", async () => {
      const payload = createTestAuthPayload(
        "customer",
        "table-room",
        "restaurant-123",
        4,
        {
          tableId: "table-5",
          seatId: "seat-3",
        },
      );
      const db = createMockDB({
        "SELECT id, restaurant_id FROM tables WHERE id = ? AND is_active = 1": {
          id: "table-5",
          restaurant_id: "restaurant-123",
        },
        "SELECT id, table_id FROM seats WHERE id = ? AND is_active = 1": {
          id: "seat-3",
          table_id: "table-5",
        },
      });

      const result = await validateTableAccess(payload, db);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should handle database errors gracefully", async () => {
      const payload = createTestAuthPayload(
        "customer",
        "table-room",
        "restaurant-123",
        4,
        {
          tableId: "table-5",
        },
      );
      const db = createErrorDB("D1 connection timeout");

      const result = await validateTableAccess(payload, db);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Failed to validate table access");
    });
  });

  // -----------------------------------------------------------------------
  // Integration: combined role + room + restaurant + table validation
  // -----------------------------------------------------------------------
  describe("Combined Validation Scenarios", () => {
    it("admin accessing admin room with valid restaurant should pass all checks", async () => {
      const payload = createTestAuthPayload(
        "admin",
        "admin-room",
        "restaurant-123",
        0,
        {
          userId: 1,
        },
      );
      const db = createMockDB({
        "SELECT restaurant_id FROM users WHERE id = ? AND is_active = 1": {
          restaurant_id: "restaurant-123",
        },
      });

      const roleCheck = validateRoleRoomAccess(payload.role, payload.roomType);
      const restaurantCheck = await validateRestaurantAccess(payload, db);

      expect(roleCheck.valid).toBe(true);
      expect(restaurantCheck.valid).toBe(true);
    });

    it("staff accessing admin room should fail role check", () => {
      const payload = createTestAuthPayload(
        "admin",
        "admin-room",
        "restaurant-123",
        2,
      );

      const roleCheck = validateRoleRoomAccess(payload.role, payload.roomType);

      // Staff (role 2 maps to 'staff') cannot access admin rooms
      expect(roleCheck.valid).toBe(false);
      expect(roleCheck.error).toContain("staff");
      expect(roleCheck.error).toContain("admin");
    });

    it("customer with valid table and seat should pass all checks", async () => {
      const payload = createTestAuthPayload(
        "customer",
        "table-room",
        "restaurant-123",
        4,
        {
          tableId: "table-10",
          seatId: "seat-2",
        },
      );
      const db = createMockDB({
        "SELECT id, restaurant_id FROM tables WHERE id = ? AND is_active = 1": {
          id: "table-10",
          restaurant_id: "restaurant-123",
        },
        "SELECT id, table_id FROM seats WHERE id = ? AND is_active = 1": {
          id: "seat-2",
          table_id: "table-10",
        },
      });

      const roleCheck = validateRoleRoomAccess(payload.role, payload.roomType);
      const tableCheck = await validateTableAccess(payload, db);

      expect(roleCheck.valid).toBe(true);
      expect(tableCheck.valid).toBe(true);
    });

    it("customer in shop mode (no table) should pass table validation", async () => {
      const payload: RealtimeAuthPayload = {
        roomType: "customer",
        roomId: "shop-room",
        restaurantId: "restaurant-123",
        role: "customer",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const db = createMockDB();

      const roleCheck = validateRoleRoomAccess(payload.role, payload.roomType);
      const tableCheck = await validateTableAccess(payload, db);

      expect(roleCheck.valid).toBe(true);
      expect(tableCheck.valid).toBe(true);
    });

    it("admin accessing kitchen room should pass role check", () => {
      const payload = createTestAuthPayload(
        "kitchen",
        "kitchen-room",
        "restaurant-123",
        0,
      );

      const roleCheck = validateRoleRoomAccess(payload.role, payload.roomType);

      // Admin (role 0) can access kitchen rooms
      expect(roleCheck.valid).toBe(true);
    });

    it("role mapping via getStringRole should align with roleRoomMap", () => {
      // Admin (0) and Owner (1) map to 'admin'
      expect(getStringRole(0)).toBe("admin");
      expect(getStringRole(1)).toBe("admin");

      // Chef (2) and Crew (3) map to 'staff'
      expect(getStringRole(2)).toBe("staff");
      expect(getStringRole(3)).toBe("staff");

      // Customer (4) maps to 'customer'
      expect(getStringRole(4)).toBe("customer");

      // Verify admin can access admin, kitchen, restaurant rooms
      expect(validateRoleRoomAccess("admin", "admin").valid).toBe(true);
      expect(validateRoleRoomAccess("admin", "kitchen").valid).toBe(true);
      expect(validateRoleRoomAccess("admin", "restaurant").valid).toBe(true);

      // Verify staff can access kitchen only
      expect(validateRoleRoomAccess("staff", "kitchen").valid).toBe(true);
      expect(validateRoleRoomAccess("staff", "admin").valid).toBe(false);

      // Verify customer can access customer only
      expect(validateRoleRoomAccess("customer", "customer").valid).toBe(true);
      expect(validateRoleRoomAccess("customer", "kitchen").valid).toBe(false);
    });
  });
});
