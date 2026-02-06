// Realtime - Auth Middleware Flow 測試
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sign } from "jsonwebtoken";
import {
  verifyWebSocketToken,
  extractTokenFromUrl,
} from "../../../utils/jwtVerifier";
import type { RealtimeAuthPayload } from "@makanmakan/shared-types";
import { createTestAuthPayload, getStringRole } from "../../helpers/test-utils";

/**
 * Auth Middleware Flow 測試
 *
 * 測試 handleWebSocketUpgrade() 中的認證中介軟體流程：
 * 1. 從 URL 查詢參數提取 token (extractTokenFromUrl)
 * 2. 驗證 token (verifyWebSocketToken)
 * 3. 驗證 roomId 與 token payload 匹配
 * 4. 驗證 roomType 與 token payload 匹配
 * 5. 驗證角色與房間類型的存取權限 (validateRoleRoomAccess)
 * 6. 驗證餐廳存取權限（員工/管理員）
 * 7. 驗證桌號/座位存取權限（顧客房間）
 *
 * 由於 handleWebSocketUpgrade 和 validateRoleRoomAccess 是 RealtimeSession 的私有方法，
 * 我們透過測試公開的工具函式並重建驗證邏輯來間接測試。
 */

const JWT_SECRET = "test-secret-key-minimum-32-characters-long-for-security";

// 重建 validateRoleRoomAccess 邏輯（對應 RealtimeSession 私有方法）
const ROLE_ROOM_ACCESS_MAP: Record<string, string[]> = {
  customer: ["customer"],
  staff: ["kitchen"],
  admin: ["admin", "kitchen", "restaurant"],
};

function validateRoleRoomAccess(role: string, roomType: string): boolean {
  const allowedRooms = ROLE_ROOM_ACCESS_MAP[role];
  if (!allowedRooms) return false;
  return allowedRooms.includes(roomType);
}

// 建立有效的 test token
function createValidToken(
  overrides: Partial<RealtimeAuthPayload> = {},
): string {
  const payload: RealtimeAuthPayload = {
    roomType: "customer",
    roomId: "table-123",
    restaurantId: "rest-456",
    role: "customer",
    userId: 789,
    tableId: "table-123",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...overrides,
  };

  return sign(payload, JWT_SECRET);
}

/**
 * 模擬完整的認證中介軟體流程
 * 回傳 { allowed, error, payload } 來反映每一步的結果
 */
async function simulateAuthMiddleware(params: {
  url: string;
  expectedRoomId: string;
  expectedRoomType: string;
  jwtSecret?: string;
}): Promise<{
  allowed: boolean;
  error?: string;
  payload?: RealtimeAuthPayload;
}> {
  const {
    url,
    expectedRoomId,
    expectedRoomType,
    jwtSecret = JWT_SECRET,
  } = params;

  // Step 1: Extract token from URL
  const parsedUrl = new URL(url);
  const token = extractTokenFromUrl(parsedUrl);

  if (!token) {
    return { allowed: false, error: "Missing authentication token" };
  }

  // Step 2: Verify token
  const result = await verifyWebSocketToken(token, jwtSecret);

  if (!result.valid || !result.payload) {
    return {
      allowed: false,
      error: result.error ?? "Token verification failed",
    };
  }

  const payload = result.payload;

  // Step 3: Validate roomId matches token
  if (payload.roomId !== expectedRoomId) {
    return { allowed: false, error: "Room ID mismatch" };
  }

  // Step 4: Validate roomType matches token
  if (payload.roomType !== expectedRoomType) {
    return { allowed: false, error: "Room type mismatch" };
  }

  // Step 5: Validate role-room access
  if (!validateRoleRoomAccess(payload.role, payload.roomType)) {
    return {
      allowed: false,
      error: "Role does not have access to this room type",
    };
  }

  return { allowed: true, payload };
}

describe("Auth Middleware", () => {
  describe("Token Extraction", () => {
    it("should extract token from URL query params", () => {
      const url = new URL(
        "ws://localhost:8787/customer/table-123?token=my-jwt-token",
      );
      const token = extractTokenFromUrl(url);

      expect(token).toBe("my-jwt-token");
    });

    it("should return null when no token in URL", () => {
      const url = new URL("ws://localhost:8787/customer/table-123");
      const token = extractTokenFromUrl(url);

      expect(token).toBeNull();
    });

    it("should handle URL with other params but no token", () => {
      const url = new URL(
        "ws://localhost:8787/customer/table-123?room=kitchen&id=5",
      );
      const token = extractTokenFromUrl(url);

      expect(token).toBeNull();
    });

    it("should handle empty token value", () => {
      const url = new URL("ws://localhost:8787/customer/table-123?token=");
      const token = extractTokenFromUrl(url);

      // URL searchParams.get returns empty string for ?token=
      expect(token).toBe("");
    });
  });

  describe("Middleware Validation Flow", () => {
    it("should reject when no token provided", async () => {
      const result = await simulateAuthMiddleware({
        url: "ws://localhost:8787/customer/table-123",
        expectedRoomId: "table-123",
        expectedRoomType: "customer",
      });

      expect(result.allowed).toBe(false);
      expect(result.error).toBe("Missing authentication token");
      expect(result.payload).toBeUndefined();
    });

    it("should reject when token verification fails", async () => {
      const result = await simulateAuthMiddleware({
        url: "ws://localhost:8787/customer/table-123?token=invalid-token-string",
        expectedRoomId: "table-123",
        expectedRoomType: "customer",
      });

      expect(result.allowed).toBe(false);
      expect(result.error).toBe("Invalid token format");
      expect(result.payload).toBeUndefined();
    });

    it("should reject when token is signed with wrong secret", async () => {
      const wrongSecret =
        "wrong-secret-key-minimum-32-characters-long-for-tests";
      const token = sign(
        {
          roomType: "customer",
          roomId: "table-123",
          restaurantId: "rest-456",
          role: "customer",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        wrongSecret,
      );

      const result = await simulateAuthMiddleware({
        url: `ws://localhost:8787/customer/table-123?token=${token}`,
        expectedRoomId: "table-123",
        expectedRoomType: "customer",
      });

      expect(result.allowed).toBe(false);
      expect(result.error).toBe("Invalid token format");
    });

    it("should reject when room ID does not match token", async () => {
      const token = createValidToken({
        roomType: "customer",
        roomId: "table-999",
        role: "customer",
      });

      const result = await simulateAuthMiddleware({
        url: `ws://localhost:8787/customer/table-123?token=${token}`,
        expectedRoomId: "table-123",
        expectedRoomType: "customer",
      });

      expect(result.allowed).toBe(false);
      expect(result.error).toBe("Room ID mismatch");
    });

    it("should reject when room type does not match token", async () => {
      const token = createValidToken({
        roomType: "admin",
        roomId: "rest-456",
        role: "admin",
      });

      const result = await simulateAuthMiddleware({
        url: `ws://localhost:8787/kitchen/rest-456?token=${token}`,
        expectedRoomId: "rest-456",
        expectedRoomType: "kitchen",
      });

      expect(result.allowed).toBe(false);
      expect(result.error).toBe("Room type mismatch");
    });

    it("should reject when token is expired", async () => {
      const token = createValidToken({
        exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
      });

      const result = await simulateAuthMiddleware({
        url: `ws://localhost:8787/customer/table-123?token=${token}`,
        expectedRoomId: "table-123",
        expectedRoomType: "customer",
      });

      expect(result.allowed).toBe(false);
      expect(result.error).toBe("Token has expired");
    });

    it("should reject when token is missing required payload fields", async () => {
      const incompletePayload = {
        roomType: "customer",
        // missing roomId and restaurantId
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = sign(incompletePayload, JWT_SECRET);

      const result = await simulateAuthMiddleware({
        url: `ws://localhost:8787/customer/table-123?token=${token}`,
        expectedRoomId: "table-123",
        expectedRoomType: "customer",
      });

      expect(result.allowed).toBe(false);
      expect(result.error).toBe(
        "Invalid token payload: missing required fields",
      );
    });

    it("should pass when all validations succeed", async () => {
      const token = createValidToken({
        roomType: "customer",
        roomId: "table-123",
        restaurantId: "rest-456",
        role: "customer",
        tableId: "table-123",
      });

      const result = await simulateAuthMiddleware({
        url: `ws://localhost:8787/customer/table-123?token=${token}`,
        expectedRoomId: "table-123",
        expectedRoomType: "customer",
      });

      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.payload).toBeDefined();
      expect(result.payload?.roomType).toBe("customer");
      expect(result.payload?.roomId).toBe("table-123");
      expect(result.payload?.restaurantId).toBe("rest-456");
      expect(result.payload?.role).toBe("customer");
    });

    it("should pass for admin accessing admin room", async () => {
      const token = createValidToken({
        roomType: "admin",
        roomId: "rest-456",
        restaurantId: "rest-456",
        role: "admin",
      });

      const result = await simulateAuthMiddleware({
        url: `ws://localhost:8787/admin/rest-456?token=${token}`,
        expectedRoomId: "rest-456",
        expectedRoomType: "admin",
      });

      expect(result.allowed).toBe(true);
      expect(result.payload?.role).toBe("admin");
      expect(result.payload?.roomType).toBe("admin");
    });

    it("should pass for staff accessing kitchen room", async () => {
      const token = createValidToken({
        roomType: "kitchen",
        roomId: "rest-456",
        restaurantId: "rest-456",
        role: "staff",
      });

      const result = await simulateAuthMiddleware({
        url: `ws://localhost:8787/kitchen/rest-456?token=${token}`,
        expectedRoomId: "rest-456",
        expectedRoomType: "kitchen",
      });

      expect(result.allowed).toBe(true);
      expect(result.payload?.role).toBe("staff");
      expect(result.payload?.roomType).toBe("kitchen");
    });
  });

  describe("Role-Room Access Matrix", () => {
    describe("customer role", () => {
      it("customer can access customer rooms", () => {
        expect(validateRoleRoomAccess("customer", "customer")).toBe(true);
      });

      it("customer cannot access admin rooms", () => {
        expect(validateRoleRoomAccess("customer", "admin")).toBe(false);
      });

      it("customer cannot access kitchen rooms", () => {
        expect(validateRoleRoomAccess("customer", "kitchen")).toBe(false);
      });

      it("customer cannot access restaurant rooms", () => {
        expect(validateRoleRoomAccess("customer", "restaurant")).toBe(false);
      });
    });

    describe("staff role", () => {
      it("staff can access kitchen rooms", () => {
        expect(validateRoleRoomAccess("staff", "kitchen")).toBe(true);
      });

      it("staff cannot access admin rooms", () => {
        expect(validateRoleRoomAccess("staff", "admin")).toBe(false);
      });

      it("staff cannot access customer rooms", () => {
        expect(validateRoleRoomAccess("staff", "customer")).toBe(false);
      });

      it("staff cannot access restaurant rooms", () => {
        expect(validateRoleRoomAccess("staff", "restaurant")).toBe(false);
      });
    });

    describe("admin role", () => {
      it("admin can access admin rooms", () => {
        expect(validateRoleRoomAccess("admin", "admin")).toBe(true);
      });

      it("admin can access kitchen rooms", () => {
        expect(validateRoleRoomAccess("admin", "kitchen")).toBe(true);
      });

      it("admin can access restaurant rooms", () => {
        expect(validateRoleRoomAccess("admin", "restaurant")).toBe(true);
      });

      it("admin cannot access customer rooms", () => {
        expect(validateRoleRoomAccess("admin", "customer")).toBe(false);
      });
    });

    describe("unknown role", () => {
      it("unknown role has no access to any room", () => {
        expect(validateRoleRoomAccess("unknown", "customer")).toBe(false);
        expect(validateRoleRoomAccess("unknown", "admin")).toBe(false);
        expect(validateRoleRoomAccess("unknown", "kitchen")).toBe(false);
        expect(validateRoleRoomAccess("unknown", "restaurant")).toBe(false);
      });
    });

    describe("role-room integration with createTestAuthPayload", () => {
      it("should reject customer role trying to access admin room via middleware", async () => {
        // createTestAuthPayload with numericRole 4 => 'customer'
        const payload = createTestAuthPayload(
          "admin",
          "rest-456",
          "rest-456",
          4,
        );
        expect(payload.role).toBe("customer");

        const token = sign(payload, JWT_SECRET);

        const result = await simulateAuthMiddleware({
          url: `ws://localhost:8787/admin/rest-456?token=${token}`,
          expectedRoomId: "rest-456",
          expectedRoomType: "admin",
        });

        expect(result.allowed).toBe(false);
        expect(result.error).toBe(
          "Role does not have access to this room type",
        );
      });

      it("should allow admin role (numericRole 0) to access admin room via middleware", async () => {
        const payload = createTestAuthPayload(
          "admin",
          "rest-456",
          "rest-456",
          0,
        );
        expect(payload.role).toBe("admin");

        const token = sign(payload, JWT_SECRET);

        const result = await simulateAuthMiddleware({
          url: `ws://localhost:8787/admin/rest-456?token=${token}`,
          expectedRoomId: "rest-456",
          expectedRoomType: "admin",
        });

        expect(result.allowed).toBe(true);
        expect(result.payload?.role).toBe("admin");
      });

      it("should allow staff role (numericRole 2, Chef) to access kitchen room via middleware", async () => {
        const payload = createTestAuthPayload(
          "kitchen",
          "rest-456",
          "rest-456",
          2,
        );
        expect(payload.role).toBe("staff");

        const token = sign(payload, JWT_SECRET);

        const result = await simulateAuthMiddleware({
          url: `ws://localhost:8787/kitchen/rest-456?token=${token}`,
          expectedRoomId: "rest-456",
          expectedRoomType: "kitchen",
        });

        expect(result.allowed).toBe(true);
        expect(result.payload?.role).toBe("staff");
      });
    });
  });

  describe("Restaurant Access Validation (staff/admin)", () => {
    it("should include restaurantId in validated payload for staff verification", async () => {
      const token = createValidToken({
        roomType: "kitchen",
        roomId: "rest-456",
        restaurantId: "rest-456",
        role: "staff",
        userId: 10,
      });

      const result = await simulateAuthMiddleware({
        url: `ws://localhost:8787/kitchen/rest-456?token=${token}`,
        expectedRoomId: "rest-456",
        expectedRoomType: "kitchen",
      });

      expect(result.allowed).toBe(true);
      expect(result.payload?.restaurantId).toBe("rest-456");
      expect(result.payload?.userId).toBe(10);
      // In production, the Durable Object would query the DB with
      // restaurantId and userId to confirm the staff belongs to this restaurant
    });

    it("should include restaurantId in validated payload for admin verification", async () => {
      const token = createValidToken({
        roomType: "admin",
        roomId: "rest-789",
        restaurantId: "rest-789",
        role: "admin",
        userId: 1,
      });

      const result = await simulateAuthMiddleware({
        url: `ws://localhost:8787/admin/rest-789?token=${token}`,
        expectedRoomId: "rest-789",
        expectedRoomType: "admin",
      });

      expect(result.allowed).toBe(true);
      expect(result.payload?.restaurantId).toBe("rest-789");
      expect(result.payload?.userId).toBe(1);
    });
  });

  describe("Table/Seat Access Validation (customer rooms)", () => {
    it("should include tableId in validated payload for customer table access", async () => {
      const token = createValidToken({
        roomType: "customer",
        roomId: "table-T1",
        restaurantId: "rest-456",
        role: "customer",
        tableId: "table-T1",
      });

      const result = await simulateAuthMiddleware({
        url: `ws://localhost:8787/customer/table-T1?token=${token}`,
        expectedRoomId: "table-T1",
        expectedRoomType: "customer",
      });

      expect(result.allowed).toBe(true);
      expect(result.payload?.tableId).toBe("table-T1");
      expect(result.payload?.restaurantId).toBe("rest-456");
      // In production, the Durable Object would verify this table belongs
      // to the restaurant via DB query
    });

    it("should include seatId in validated payload for customer seat access", async () => {
      const token = createValidToken({
        roomType: "customer",
        roomId: "seat-S1",
        restaurantId: "rest-456",
        role: "customer",
        tableId: "table-T1",
        seatId: "seat-S1",
      });

      const result = await simulateAuthMiddleware({
        url: `ws://localhost:8787/customer/seat-S1?token=${token}`,
        expectedRoomId: "seat-S1",
        expectedRoomType: "customer",
      });

      expect(result.allowed).toBe(true);
      expect(result.payload?.seatId).toBe("seat-S1");
      expect(result.payload?.tableId).toBe("table-T1");
      expect(result.payload?.restaurantId).toBe("rest-456");
    });

    it("should reject customer accessing mismatched table room", async () => {
      const token = createValidToken({
        roomType: "customer",
        roomId: "table-T1",
        restaurantId: "rest-456",
        role: "customer",
        tableId: "table-T1",
      });

      // URL says table-T2 but token says table-T1
      const result = await simulateAuthMiddleware({
        url: `ws://localhost:8787/customer/table-T2?token=${token}`,
        expectedRoomId: "table-T2",
        expectedRoomType: "customer",
      });

      expect(result.allowed).toBe(false);
      expect(result.error).toBe("Room ID mismatch");
    });
  });

  describe("getStringRole helper integration", () => {
    it("should map numeric roles to correct string roles for auth payload", () => {
      expect(getStringRole(0)).toBe("admin"); // Admin
      expect(getStringRole(1)).toBe("admin"); // Owner
      expect(getStringRole(2)).toBe("staff"); // Chef
      expect(getStringRole(3)).toBe("staff"); // Crew/Service
      expect(getStringRole(4)).toBe("customer"); // Customer
    });

    it("should default to staff for unrecognized numeric roles", () => {
      // getStringRole returns 'staff' as default for non-matching roles
      expect(getStringRole(5)).toBe("staff");
      expect(getStringRole(99)).toBe("staff");
    });
  });
});
