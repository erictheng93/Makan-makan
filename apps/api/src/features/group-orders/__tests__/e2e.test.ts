/**
 * Group Orders End-to-End Tests
 *
 * Tests the complete group ordering workflow from creating a group
 * to splitting bills and processing payments
 *
 * Coverage:
 * - POST /api/v1/orders/group/create - Create group order
 * - POST /api/v1/orders/group/join/:shareCode - Join group
 * - POST /api/v1/orders/group/:groupOrderId/cart - Add cart item
 * - PUT /api/v1/orders/group/:groupOrderId/cart/:itemId - Update cart item
 * - DELETE /api/v1/orders/group/:groupOrderId/cart/:itemId - Remove cart item
 * - GET /api/v1/orders/group/:groupOrderId - Get group details
 * - GET /api/v1/orders/group/:groupOrderId/activities - Get activities
 * - POST /api/v1/orders/group/:groupOrderId/split - Split bill
 * - POST /api/v1/orders/group/:groupOrderId/payment/:memberId - Process payment
 * - POST /api/v1/orders/group/:groupOrderId/leave/:memberId - Leave group
 * - GET /api/v1/orders/group/statistics - Get statistics
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createTestApp,
  createTestDB,
  cleanupTestDB,
  generateTestToken,
  type TestDB,
} from "../../../__tests__/helpers/test-utils";
import type { Hono } from "hono";
import type { Env } from "../../../types/env";

describe("Group Orders E2E Tests", () => {
  let app: Hono<{ Bindings: Env }>;
  let db: TestDB;
  let adminToken: string;
  let ownerToken: string;
  let testRestaurantId: string;
  let testTableId: number;
  let testMenuItemId: number;

  beforeAll(async () => {
    // Create test database
    db = await createTestDB();

    // Create test app with the database
    app = await createTestApp(db);

    // Generate test tokens
    adminToken = generateTestToken({
      id: 1,
      username: "admin",
      role: 0,
      restaurantId: null,
    });
    ownerToken = generateTestToken({
      id: 2,
      username: "owner",
      role: 1,
      restaurantId: "1", // Must match transformed restaurantId from statisticsQuerySchema
    });

    // Seed test data
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestDB(db);
  });

  beforeEach(async () => {
    // Clean up group-related tables before each test
    await db.exec("DELETE FROM group_orders");
    await db.exec("DELETE FROM group_members");
    await db.exec("DELETE FROM group_cart_items");
    await db.exec("DELETE FROM split_bills");
    await db.exec("DELETE FROM group_activity_logs");
  });

  async function seedTestData() {
    // Use ISO timestamp format compatible with sql.js (strftime instead of unixepoch)
    const now = new Date().toISOString();

    // Create test restaurant
    const restaurantResult = await db
      .prepare(
        `
      INSERT INTO restaurants (
        name, type, category, description, address, district, city, phone,
        is_available, is_active, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        "Test Restaurant",
        "restaurant",
        "chinese",
        "Test Description",
        "123 Test St",
        "Central",
        "Taichung",
        "04-1234-5678",
        1,
        1,
        1,
        now,
        now,
      )
      .run();

    testRestaurantId = String(restaurantResult.meta?.last_row_id);
    console.log(
      "[E2E Setup] Restaurant created, ID:",
      testRestaurantId,
      "Result:",
      restaurantResult,
    );

    // Create test table
    const tableResult = await db
      .prepare(
        `
      INSERT INTO tables (
        restaurant_id, number, name, capacity, location, qr_code,
        is_occupied, is_active, is_reservable, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        testRestaurantId,
        "T1",
        "Table 1",
        4,
        "Main Hall",
        "QR-TABLE-1",
        0,
        1,
        1,
        now,
        now,
      )
      .run();

    testTableId = tableResult.meta?.last_row_id as number;
    console.log(
      "[E2E Setup] Table created, ID:",
      testTableId,
      "Result:",
      tableResult,
    );

    // Create test category
    const categoryResult = await db
      .prepare(
        `
      INSERT INTO categories (
        restaurant_id, name, description, sort_order, is_active, is_visible,
        item_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        testRestaurantId,
        "Main Dishes",
        "Popular main dishes",
        0,
        1,
        1,
        0,
        now,
        now,
      )
      .run();

    const testCategoryId = categoryResult.meta?.last_row_id as number;
    console.log(
      "[E2E Setup] Category created, ID:",
      testCategoryId,
      "Result:",
      categoryResult,
    );

    // Create test menu item
    const menuItemResult = await db
      .prepare(
        `
      INSERT INTO menu_items (
        restaurant_id, category_id, name, description, price,
        is_available, is_featured, is_popular, sort_order,
        preparation_time, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        testRestaurantId,
        testCategoryId,
        "Kung Pao Chicken",
        "Spicy stir-fried chicken",
        150.0,
        1,
        1,
        1,
        0,
        20,
        now,
        now,
      )
      .run();

    testMenuItemId = menuItemResult.meta?.last_row_id as number;
    console.log(
      "[E2E Setup] Menu item created, ID:",
      testMenuItemId,
      "Result:",
      menuItemResult,
    );

    console.log("[E2E Setup] Created test data:", {
      restaurantId: Number(testRestaurantId),
      tableId: testTableId,
      categoryId: testCategoryId,
      menuItemId: testMenuItemId,
    });
  }

  describe("POST /api/v1/orders/group/create - Create Group Order", () => {
    it("should create a new group order successfully", async () => {
      const response = await app.request("/api/v1/orders/group/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          restaurantId: Number(testRestaurantId),
          tableId: testTableId,
          maxMembers: 6,
          expirationHours: 2,
          permissions: {
            canInviteMembers: true,
            canModifyOthersCart: false,
            canFinalizeOrder: true,
            canSplitBill: true,
            canProcessPayment: true,
          },
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.groupOrderId).toBeDefined();
      expect(data.data.shareCode).toBeDefined();
      expect(data.data.shareCode).toMatch(/^[A-Z0-9]{8}$/);
      expect(data.data.host).toBeDefined();
      expect(data.data.host.isHost).toBe(true);
      expect(data.data.expiresAt).toBeDefined();
    });

    it("should reject group order creation without authentication", async () => {
      const response = await app.request("/api/v1/orders/group/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantId: Number(testRestaurantId),
          tableId: testTableId,
        }),
      });

      expect(response.status).toBe(401);
    });

    it("should reject group order creation with missing required fields", async () => {
      const response = await app.request("/api/v1/orders/group/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          // Missing restaurantId
          tableId: testTableId,
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/v1/orders/group/join/:shareCode - Join Group", () => {
    let shareCode: string;
    let groupOrderId: string;

    beforeEach(async () => {
      // Create a group order first
      const createResponse = await app.request("/api/v1/orders/group/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          restaurantId: Number(testRestaurantId),
          tableId: testTableId,
          maxMembers: 4,
        }),
      });

      const createData = (await createResponse.json()) as any;
      shareCode = createData.data.shareCode;
      groupOrderId = createData.data.groupOrderId;
    });

    it("should allow a new member to join group successfully", async () => {
      const response = await app.request(
        `/api/v1/orders/group/join/${shareCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: "John Doe",
            phone: "0912-345-678",
            email: "john@example.com",
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.member).toBeDefined();
      expect(data.data.member.memberName).toBe("John Doe");
      expect(data.data.member.isHost).toBe(false);
      expect(data.data.groupOrder).toBeDefined();
      expect(data.data.groupOrder.groupOrderId).toBe(groupOrderId);
    });

    it("should reject joining with invalid share code", async () => {
      const response = await app.request("/api/v1/orders/group/join/INVALID1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberName: "John Doe",
        }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.success).toBe(false);
      expect(data.error.message).toMatch(/not found|expired/i);
    });

    it("should reject duplicate member names in the same group", async () => {
      // First member joins
      await app.request(`/api/v1/orders/group/join/${shareCode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberName: "John Doe",
        }),
      });

      // Second member tries to join with same name
      const response = await app.request(
        `/api/v1/orders/group/join/${shareCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: "John Doe",
          }),
        },
      );

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.success).toBe(false);
      expect(data.error.message).toMatch(/already exists/i);
    });

    it("should reject joining when group is full", async () => {
      // Fill up the group (maxMembers = 4, 1 host + 3 members)
      const memberNames = ["Member 1", "Member 2", "Member 3"];

      for (const name of memberNames) {
        await app.request(`/api/v1/orders/group/join/${shareCode}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: name,
          }),
        });
      }

      // Try to join when full
      const response = await app.request(
        `/api/v1/orders/group/join/${shareCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: "Member 4",
          }),
        },
      );

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.success).toBe(false);
      expect(data.error.message).toMatch(/full/i);
    });
  });

  describe("POST /api/v1/orders/group/:groupOrderId/cart - Add Cart Item", () => {
    let groupOrderId: string;
    let memberId: string;

    beforeEach(async () => {
      // Create group and join
      const createResponse = await app.request("/api/v1/orders/group/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          restaurantId: Number(testRestaurantId),
          tableId: testTableId,
        }),
      });

      const createData = (await createResponse.json()) as any;
      groupOrderId = createData.data.groupOrderId;
      const shareCode = createData.data.shareCode;

      // Join as a member
      const joinResponse = await app.request(
        `/api/v1/orders/group/join/${shareCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: "Jane Doe",
          }),
        },
      );

      const joinData = (await joinResponse.json()) as any;
      memberId = joinData.data.member.memberId;
    });

    it("should add item to cart successfully", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/cart`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberId,
            menuItemId: testMenuItemId,
            quantity: 2,
            customizations: {
              spiceLevel: "medium",
              extraIngredients: ["peanuts"],
            },
            specialInstructions: "No MSG please",
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.itemId).toBeDefined();
      expect(data.data.quantity).toBe(2);
      expect(data.data.unitPrice).toBe(150.0);
      expect(data.data.totalPrice).toBe(300.0);
      expect(data.data.customizations).toEqual({
        spiceLevel: "medium",
        extraIngredients: ["peanuts"],
      });
    });

    it("should reject adding item with invalid member ID", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/cart`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberId: "invalid-member-id",
            menuItemId: testMenuItemId,
            quantity: 1,
          }),
        },
      );

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.success).toBe(false);
    });

    it("should reject adding item with invalid menu item ID", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/cart`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberId,
            menuItemId: 99999,
            quantity: 1,
          }),
        },
      );

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.success).toBe(false);
      expect(data.error.message).toMatch(/not found/i);
    });

    it("should reject adding item with invalid quantity", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/cart`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberId,
            menuItemId: testMenuItemId,
            quantity: 0, // Invalid quantity
          }),
        },
      );

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/v1/orders/group/:groupOrderId/cart/:itemId - Update Cart Item", () => {
    let groupOrderId: string;
    let memberId: string;
    let itemId: string;

    beforeEach(async () => {
      // Create group, join, and add item
      const createResponse = await app.request("/api/v1/orders/group/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          restaurantId: Number(testRestaurantId),
          tableId: testTableId,
        }),
      });

      const createData = (await createResponse.json()) as any;
      groupOrderId = createData.data.groupOrderId;
      const shareCode = createData.data.shareCode;

      const joinResponse = await app.request(
        `/api/v1/orders/group/join/${shareCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: "Jane Doe",
          }),
        },
      );

      const joinData = (await joinResponse.json()) as any;
      memberId = joinData.data.member.memberId;

      // Add item to cart
      const addResponse = await app.request(
        `/api/v1/orders/group/${groupOrderId}/cart`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberId,
            menuItemId: testMenuItemId,
            quantity: 1,
          }),
        },
      );

      const addData = (await addResponse.json()) as any;
      itemId = addData.data.itemId;
    });

    it("should update cart item quantity successfully", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/cart/${itemId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quantity: 3,
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.quantity).toBe(3);
      expect(data.data.totalPrice).toBe(450.0); // 150 * 3
    });

    it("should update cart item customizations successfully", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/cart/${itemId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customizations: {
              spiceLevel: "hot",
            },
            specialInstructions: "Extra spicy please",
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
      expect(data.data.customizations).toEqual({ spiceLevel: "hot" });
      expect(data.data.specialInstructions).toBe("Extra spicy please");
    });

    it("should reject updating non-existent cart item", async () => {
      // Use a valid UUID that doesn't exist
      const nonExistentItemId = "00000000-0000-0000-0000-000000000000";
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/cart/${nonExistentItemId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quantity: 2,
          }),
        },
      );

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.success).toBe(false);
      expect(data.error.message).toMatch(/not found/i);
    });
  });

  describe("DELETE /api/v1/orders/group/:groupOrderId/cart/:itemId - Remove Cart Item", () => {
    let groupOrderId: string;
    let memberId: string;
    let itemId: string;

    beforeEach(async () => {
      // Create group, join, and add item
      const createResponse = await app.request("/api/v1/orders/group/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          restaurantId: Number(testRestaurantId),
          tableId: testTableId,
        }),
      });

      const createData = (await createResponse.json()) as any;
      groupOrderId = createData.data.groupOrderId;
      const shareCode = createData.data.shareCode;

      const joinResponse = await app.request(
        `/api/v1/orders/group/join/${shareCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: "Jane Doe",
          }),
        },
      );

      const joinData = (await joinResponse.json()) as any;
      memberId = joinData.data.member.memberId;

      const addResponse = await app.request(
        `/api/v1/orders/group/${groupOrderId}/cart`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberId,
            menuItemId: testMenuItemId,
            quantity: 1,
          }),
        },
      );

      const addData = (await addResponse.json()) as any;
      itemId = addData.data.itemId;
    });

    it("should remove cart item successfully", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/cart/${itemId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberId,
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
      expect(data.message).toMatch(/removed successfully/i);
    });

    it("should reject removing item not owned by member", async () => {
      // Use a valid UUID that is different from the actual member
      const differentMemberId = "00000000-0000-0000-0000-000000000001";
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/cart/${itemId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberId: differentMemberId,
          }),
        },
      );

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.success).toBe(false);
      expect(data.error.message).toMatch(/not found|not owned/i);
    });
  });

  describe("GET /api/v1/orders/group/:groupOrderId - Get Group Details", () => {
    let groupOrderId: string;
    let memberId: string;

    beforeEach(async () => {
      // Create group, join, and add item
      const createResponse = await app.request("/api/v1/orders/group/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          restaurantId: Number(testRestaurantId),
          tableId: testTableId,
        }),
      });

      const createData = (await createResponse.json()) as any;
      groupOrderId = createData.data.groupOrderId;
      const shareCode = createData.data.shareCode;

      const joinResponse = await app.request(
        `/api/v1/orders/group/join/${shareCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: "Jane Doe",
          }),
        },
      );

      const joinData = (await joinResponse.json()) as any;
      memberId = joinData.data.member.memberId;

      // Add item to cart
      await app.request(`/api/v1/orders/group/${groupOrderId}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId,
          menuItemId: testMenuItemId,
          quantity: 2,
        }),
      });
    });

    it("should get group details with members and cart items", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.groupOrder).toBeDefined();
      expect(data.data.members).toBeInstanceOf(Array);
      expect(data.data.members.length).toBeGreaterThanOrEqual(2); // Host + 1 member
      expect(data.data.cartItems).toBeInstanceOf(Array);
      expect(data.data.cartItems.length).toBe(1);
      expect(data.data.totalAmount).toBe(300.0); // 150 * 2
      expect(data.data.activities).toBeInstanceOf(Array);
    });

    it("should return 404 for non-existent group order", async () => {
      // Use a valid UUID format that doesn't exist
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const response = await app.request(
        `/api/v1/orders/group/${nonExistentId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.success).toBe(false);
      expect(data.error.message).toMatch(/not found/i);
    });
  });

  describe("GET /api/v1/orders/group/:groupOrderId/activities - Get Activities", () => {
    let groupOrderId: string;

    beforeEach(async () => {
      // Create group with multiple activities
      const createResponse = await app.request("/api/v1/orders/group/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          restaurantId: Number(testRestaurantId),
          tableId: testTableId,
        }),
      });

      const createData = (await createResponse.json()) as any;
      groupOrderId = createData.data.groupOrderId;
      const shareCode = createData.data.shareCode;

      // Multiple members join
      await app.request(`/api/v1/orders/group/join/${shareCode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberName: "Member 1",
        }),
      });

      await app.request(`/api/v1/orders/group/join/${shareCode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberName: "Member 2",
        }),
      });
    });

    it("should get all activities for the group", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/activities`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
      expect(data.data.length).toBeGreaterThanOrEqual(3); // group_created + 2 member_joined

      // Check activity structure
      const activity = data.data[0];
      expect(activity).toHaveProperty("activityId");
      expect(activity).toHaveProperty("groupOrderId");
      expect(activity).toHaveProperty("type");
      expect(activity).toHaveProperty("description");
      expect(activity).toHaveProperty("timestamp");
    });

    it("should return activities in chronological order (newest first)", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/activities`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const data = (await response.json()) as any;
      const activities = data.data;

      // Check timestamps are in descending order
      for (let i = 1; i < activities.length; i++) {
        const prevTimestamp = new Date(activities[i - 1].timestamp).getTime();
        const currTimestamp = new Date(activities[i].timestamp).getTime();
        expect(prevTimestamp).toBeGreaterThanOrEqual(currTimestamp);
      }
    });
  });

  describe("POST /api/v1/orders/group/:groupOrderId/split - Split Bill", () => {
    let groupOrderId: string;
    let member1Id: string;
    let member2Id: string;

    beforeEach(async () => {
      // Create group with 2 members and items
      const createResponse = await app.request("/api/v1/orders/group/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          restaurantId: Number(testRestaurantId),
          tableId: testTableId,
        }),
      });

      const createData = (await createResponse.json()) as any;
      groupOrderId = createData.data.groupOrderId;
      const shareCode = createData.data.shareCode;

      // Member 1 joins and adds item
      const join1Response = await app.request(
        `/api/v1/orders/group/join/${shareCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: "Member 1",
          }),
        },
      );

      const join1Data = (await join1Response.json()) as any;
      member1Id = join1Data.data.member.memberId;

      await app.request(`/api/v1/orders/group/${groupOrderId}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: member1Id,
          menuItemId: testMenuItemId,
          quantity: 2,
        }),
      });

      // Member 2 joins and adds item
      const join2Response = await app.request(
        `/api/v1/orders/group/join/${shareCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: "Member 2",
          }),
        },
      );

      const join2Data = (await join2Response.json()) as any;
      member2Id = join2Data.data.member.memberId;

      await app.request(`/api/v1/orders/group/${groupOrderId}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: member2Id,
          menuItemId: testMenuItemId,
          quantity: 1,
        }),
      });
    });

    it("should split bill by items successfully", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/split`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            splitType: "by_item",
            serviceChargeRate: 10,
            taxRate: 5,
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it("should split bill equally among all members", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/split`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            splitType: "equal",
            serviceChargeRate: 10,
            taxRate: 5,
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
    });

    it("should handle custom split amounts", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/split`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            splitType: "custom",
            customAmounts: [
              { memberId: member1Id, amount: 300 },
              { memberId: member2Id, amount: 150 },
            ],
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
    });
  });

  describe("POST /api/v1/orders/group/:groupOrderId/payment/:memberId - Process Payment", () => {
    let groupOrderId: string;
    let memberId: string;

    beforeEach(async () => {
      // Create group, join, add item, and split bill
      const createResponse = await app.request("/api/v1/orders/group/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          restaurantId: Number(testRestaurantId),
          tableId: testTableId,
        }),
      });

      const createData = (await createResponse.json()) as any;
      groupOrderId = createData.data.groupOrderId;
      const shareCode = createData.data.shareCode;

      const joinResponse = await app.request(
        `/api/v1/orders/group/join/${shareCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: "Jane Doe",
          }),
        },
      );

      const joinData = (await joinResponse.json()) as any;
      memberId = joinData.data.member.memberId;

      await app.request(`/api/v1/orders/group/${groupOrderId}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId,
          menuItemId: testMenuItemId,
          quantity: 1,
        }),
      });

      // Split bill
      await app.request(`/api/v1/orders/group/${groupOrderId}/split`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          splitType: "by_item",
        }),
      });
    });

    it("should process payment successfully", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/payment/${memberId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentMethod: "credit_card",
            paymentDetails: {
              last4: "4242",
              brand: "visa",
            },
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it("should reject payment without valid payment method", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/payment/${memberId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // Missing paymentMethod
            paymentDetails: {},
          }),
        },
      );

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/v1/orders/group/:groupOrderId/leave/:memberId - Leave Group", () => {
    let groupOrderId: string;
    let memberId: string;

    beforeEach(async () => {
      const createResponse = await app.request("/api/v1/orders/group/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          restaurantId: Number(testRestaurantId),
          tableId: testTableId,
        }),
      });

      const createData = (await createResponse.json()) as any;
      groupOrderId = createData.data.groupOrderId;
      const shareCode = createData.data.shareCode;

      const joinResponse = await app.request(
        `/api/v1/orders/group/join/${shareCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: "Jane Doe",
          }),
        },
      );

      const joinData = (await joinResponse.json()) as any;
      memberId = joinData.data.member.memberId;
    });

    it("should allow member to leave group successfully", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/leave/${memberId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
      expect(data.message).toMatch(/left group/i);
    });

    it("should reject leaving with invalid member ID", async () => {
      const response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/leave/invalid-id`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.success).toBe(false);
    });
  });

  describe("GET /api/v1/orders/group/statistics - Get Statistics", () => {
    beforeEach(async () => {
      // Create a few group orders for statistics
      for (let i = 0; i < 3; i++) {
        await app.request("/api/v1/orders/group/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ownerToken}`,
          },
          body: JSON.stringify({
            restaurantId: Number(testRestaurantId),
            tableId: testTableId,
          }),
        });
      }
    });

    it("should get statistics for admin", async () => {
      const response = await app.request("/api/v1/orders/group/statistics", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.totalGroupOrders).toBeGreaterThanOrEqual(3);
    });

    it("should get statistics for restaurant owner", async () => {
      const response = await app.request(
        `/api/v1/orders/group/statistics?restaurantId=${testRestaurantId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ownerToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it("should reject statistics request without authentication", async () => {
      const response = await app.request("/api/v1/orders/group/statistics", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(401);
    });

    it("should reject owner accessing other restaurant statistics", async () => {
      const response = await app.request(
        "/api/v1/orders/group/statistics?restaurantId=999",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ownerToken}`,
          },
        },
      );

      expect(response.status).toBe(403);
      const data = (await response.json()) as any;
      expect(data.success).toBe(false);
      expect(data.error.message).toMatch(/access denied/i);
    });
  });

  describe("Integration Test: Complete Group Order Workflow", () => {
    it("should complete full group ordering workflow from creation to payment", async () => {
      // Step 1: Host creates group order
      const createResponse = await app.request("/api/v1/orders/group/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          restaurantId: Number(testRestaurantId),
          tableId: testTableId,
          maxMembers: 3,
        }),
      });

      expect(createResponse.status).toBe(200);
      const createData = (await createResponse.json()) as any;
      const { groupOrderId, shareCode } = createData.data;

      // Step 2: Two members join
      const member1Response = await app.request(
        `/api/v1/orders/group/join/${shareCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: "Alice",
          }),
        },
      );

      const member1Data = (await member1Response.json()) as any;
      const member1Id = member1Data.data.member.memberId;

      const member2Response = await app.request(
        `/api/v1/orders/group/join/${shareCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberName: "Bob",
          }),
        },
      );

      const member2Data = (await member2Response.json()) as any;
      const member2Id = member2Data.data.member.memberId;

      // Step 3: Members add items to cart
      await app.request(`/api/v1/orders/group/${groupOrderId}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: member1Id,
          menuItemId: testMenuItemId,
          quantity: 2,
        }),
      });

      await app.request(`/api/v1/orders/group/${groupOrderId}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: member2Id,
          menuItemId: testMenuItemId,
          quantity: 1,
        }),
      });

      // Step 4: Get group details to verify
      const detailsResponse = await app.request(
        `/api/v1/orders/group/${groupOrderId}`,
        {
          method: "GET",
        },
      );

      expect(detailsResponse.status).toBe(200);
      const detailsData = (await detailsResponse.json()) as any;
      expect(detailsData.data.members.length).toBe(3); // Host + 2 members
      expect(detailsData.data.cartItems.length).toBe(2);
      expect(detailsData.data.totalAmount).toBe(450.0); // (150 * 2) + (150 * 1)

      // Step 5: Split bill
      const splitResponse = await app.request(
        `/api/v1/orders/group/${groupOrderId}/split`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            splitType: "by_item",
          }),
        },
      );

      expect(splitResponse.status).toBe(200);

      // Step 6: Members process payment
      const payment1Response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/payment/${member1Id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentMethod: "credit_card",
          }),
        },
      );

      expect(payment1Response.status).toBe(200);

      const payment2Response = await app.request(
        `/api/v1/orders/group/${groupOrderId}/payment/${member2Id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentMethod: "cash",
          }),
        },
      );

      expect(payment2Response.status).toBe(200);

      // Step 7: Verify activities were logged
      const activitiesResponse = await app.request(
        `/api/v1/orders/group/${groupOrderId}/activities`,
        {
          method: "GET",
        },
      );

      expect(activitiesResponse.status).toBe(200);
      const activitiesData = (await activitiesResponse.json()) as any;
      expect(activitiesData.data.length).toBeGreaterThanOrEqual(6); // Creation, 2 joins, 2 items added, split
    });
  });
});
