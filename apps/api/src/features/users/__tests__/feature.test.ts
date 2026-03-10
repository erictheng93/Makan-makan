import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { UsersService } from "../services/UsersService";
import { USER_ROLES } from "@makanmakan/database";
import { userFactory, resetAllFactories } from "@makanmakan/testing-utils";

// Mock environment for testing
const mockEnv = {
  DB: {}, // Mock database connection
} as any;

describe("Users Feature Module", () => {
  let usersService: UsersService;

  beforeEach(() => {
    resetAllFactories();
    usersService = new UsersService(mockEnv);
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe("UsersService", () => {
    describe("canManageUser", () => {
      test("admin can manage all users", () => {
        const adminUser = userFactory.buildAdmin({
          overrides: { restaurantId: 1 },
        });

        expect(
          usersService.canManageUser(adminUser, USER_ROLES.OWNER, "2"),
        ).toBe(true);
        expect(
          usersService.canManageUser(adminUser, USER_ROLES.CHEF, "2"),
        ).toBe(true);
        expect(
          usersService.canManageUser(adminUser, USER_ROLES.CUSTOMER, "2"),
        ).toBe(true);
      });

      test("owner can only manage restaurant staff", () => {
        const ownerUser = userFactory.buildShopOwner(1);

        // Can manage staff in same restaurant
        expect(
          usersService.canManageUser(ownerUser, USER_ROLES.CHEF, "1"),
        ).toBe(true);
        expect(
          usersService.canManageUser(ownerUser, USER_ROLES.SERVICE, "1"),
        ).toBe(true);
        expect(
          usersService.canManageUser(ownerUser, USER_ROLES.CASHIER, "1"),
        ).toBe(true);
        expect(
          usersService.canManageUser(ownerUser, USER_ROLES.CUSTOMER, "1"),
        ).toBe(true);

        // Cannot manage other owners or admins
        expect(
          usersService.canManageUser(ownerUser, USER_ROLES.ADMIN, "1"),
        ).toBe(false);
        expect(
          usersService.canManageUser(ownerUser, USER_ROLES.OWNER, "1"),
        ).toBe(false);

        // Cannot manage staff in different restaurant
        expect(
          usersService.canManageUser(ownerUser, USER_ROLES.CHEF, "2"),
        ).toBe(false);
      });

      test("other roles cannot manage users", () => {
        const chefUser = userFactory.buildChef(1);

        expect(usersService.canManageUser(chefUser, USER_ROLES.CHEF, "1")).toBe(
          false,
        );
        expect(
          usersService.canManageUser(chefUser, USER_ROLES.CUSTOMER, "1"),
        ).toBe(false);
      });
    });

    describe("canViewUser", () => {
      test("admin can view all users", () => {
        const adminUser = userFactory.buildAdmin({
          overrides: { restaurantId: 1 },
        });
        const targetUser = userFactory.build({
          overrides: { restaurantId: 2 },
        });

        expect(usersService.canViewUser(adminUser, targetUser)).toBe(true);
      });

      test("user can view themselves", () => {
        const user = userFactory.buildChef(1);
        const sameUser = { id: user.id, restaurantId: user.restaurantId };

        expect(usersService.canViewUser(user, sameUser)).toBe(true);
      });

      test("owner can view restaurant staff", () => {
        const ownerUser = userFactory.buildShopOwner(1);
        const staffUser = userFactory.build({ overrides: { restaurantId: 1 } });
        const otherRestaurantUser = userFactory.build({
          overrides: { restaurantId: 2 },
        });

        expect(usersService.canViewUser(ownerUser, staffUser)).toBe(true);
        expect(usersService.canViewUser(ownerUser, otherRestaurantUser)).toBe(
          false,
        );
      });
    });

    describe("formatUser", () => {
      test("formats user data correctly", () => {
        const rawUser = userFactory.buildChef(1, {
          overrides: {
            preferences: { theme: "dark" },
            totalOrders: 10,
            totalSpent: 250.5,
          },
        });

        const formatted = usersService.formatUser(rawUser);

        // Factory 生成的數據已包含所有必要字段
        expect(formatted).toHaveProperty("id", rawUser.id);
        expect(formatted).toHaveProperty("username", rawUser.username);
        expect(formatted).toHaveProperty("role", USER_ROLES.CHEF);
        expect(formatted).toHaveProperty("role_name", "Chef");
        expect(formatted).toHaveProperty("restaurantId", 1);
        expect(formatted).toHaveProperty("email", rawUser.email);
        expect(formatted).toHaveProperty("fullName", rawUser.fullName);
        expect(formatted).toHaveProperty("isActive", true);
        expect(formatted).toHaveProperty("isVerified", true);
        expect(formatted).toHaveProperty("preferences", { theme: "dark" });
        expect(formatted).toHaveProperty("totalOrders", 10);
        expect(formatted).toHaveProperty("totalSpent", 250.5);
      });

      test("handles unknown roles gracefully", () => {
        const rawUser = {
          id: 1,
          username: "testuser",
          role: 999, // Unknown role
          fullName: "Test User",
          isActive: true,
          isVerified: false,
          createdAt: "2022-01-01T00:00:00Z",
          updatedAt: "2023-01-01T00:00:00Z",
        };

        const formatted = usersService.formatUser(rawUser);

        expect(formatted.role_name).toBe("Unknown");
      });
    });
  });

  describe("Permission Validation", () => {
    test("role hierarchy is correctly enforced", () => {
      const roles = [
        USER_ROLES.ADMIN,
        USER_ROLES.OWNER,
        USER_ROLES.CHEF,
        USER_ROLES.SERVICE,
        USER_ROLES.CASHIER,
        USER_ROLES.CUSTOMER,
      ];

      expect(roles).toEqual([0, 1, 2, 3, 4, 5]);
    });
  });
});
