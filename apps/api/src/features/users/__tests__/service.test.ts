/**
 * UsersService Unit Tests
 *
 * Comprehensive test suite for UsersService - targeting 80%+ coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Env } from "../../../types/env";
import type { CreateUserData, UpdateUserData, UserFilters } from "../types";

// Use vi.hoisted to define mocks BEFORE vi.mock is executed
// This ensures the mock objects are available when the mock factory runs
const { mockUserService, mockAuthService, USER_ROLES } = vi.hoisted(() => ({
  mockUserService: {
    getAllUsers: vi.fn(),
    getRestaurantUsers: vi.fn(),
    getUserById: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    verifyUser: vi.fn(),
    resetPassword: vi.fn(),
    getUserStats: vi.fn(),
    searchUsers: vi.fn(),
  },
  mockAuthService: {
    changePassword: vi.fn(),
  },
  USER_ROLES: {
    ADMIN: 0,
    OWNER: 1,
    CHEF: 2,
    SERVICE: 3,
    CASHIER: 4,
    CUSTOMER: 5,
  },
}));

// Mock the database service - uses the hoisted mocks
// Use class-based mock for vitest 4 compatibility
vi.mock("@makanmakan/database", () => {
  return {
    UserService: class MockUserService {
      constructor() {
        Object.assign(this, mockUserService);
      }
    },
    AuthService: class MockAuthService {
      constructor() {
        Object.assign(this, mockAuthService);
      }
    },
    USER_ROLES: {
      ADMIN: 0,
      OWNER: 1,
      CHEF: 2,
      SERVICE: 3,
      CASHIER: 4,
      CUSTOMER: 5,
    },
  };
});

// Import after mocking
import { UsersService } from "../services/UsersService";

// Mock environment
const mockEnv: Env = {
  DB: {} as any,
  JWT_SECRET: "test-secret",
  ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars",
  CACHE_KV: {} as any,
  SLACK_WEBHOOK_URL: "https://hooks.slack.com/test",
  NODE_ENV: "test",
  API_VERSION: "v1",
  TOKEN_BLACKLIST: {} as any,
  IMAGES_BUCKET: {} as any,
  BACKUP_STORAGE: {} as any,
  JOB_QUEUE: {} as any,
  REALTIME_ORDERS: {} as any,
  ANALYTICS_ENGINE: {} as any,
  RATE_LIMIT_KV: {} as any,
  REALTIME_SESSION: {} as any,
  CLOUDFLARE_IMAGES_KEY: "test-key",
  CLOUDFLARE_ACCOUNT_ID: "test-account",
};

// Mock user data
const mockUser = {
  id: 1,
  username: "testuser",
  email: "test@example.com",
  fullName: "Test User",
  phone: "1234567890",
  role: USER_ROLES.CHEF,
  restaurantId: 1,
  isActive: true,
  isVerified: true,
  preferences: { theme: "dark" },
  totalOrders: 50,
  totalSpent: 500.0,
  lastLoginAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAdminUser = {
  id: 100,
  username: "admin",
  role: USER_ROLES.ADMIN,
  restaurantId: null,
};

const mockOwnerUser = {
  id: 101,
  username: "owner",
  role: USER_ROLES.OWNER,
  restaurantId: 1,
};

const mockChefUser = {
  id: 102,
  username: "chef",
  role: USER_ROLES.CHEF,
  restaurantId: 1,
};

describe("UsersService", () => {
  let usersService: UsersService;

  beforeEach(() => {
    usersService = new UsersService(mockEnv);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ========================================
  // Permission Tests
  // ========================================
  describe("canManageUser", () => {
    it("admin can manage all users", () => {
      expect(
        usersService.canManageUser(mockAdminUser, USER_ROLES.OWNER, '2'),
      ).toBe(true);
      expect(
        usersService.canManageUser(mockAdminUser, USER_ROLES.ADMIN, '1'),
      ).toBe(true);
      expect(
        usersService.canManageUser(mockAdminUser, USER_ROLES.CHEF, '1'),
      ).toBe(true);
      expect(
        usersService.canManageUser(mockAdminUser, USER_ROLES.CUSTOMER, '1'),
      ).toBe(true);
    });

    it("owner can manage staff in same restaurant", () => {
      expect(
        usersService.canManageUser(mockOwnerUser, USER_ROLES.CHEF, '1'),
      ).toBe(true);
      expect(
        usersService.canManageUser(mockOwnerUser, USER_ROLES.SERVICE, '1'),
      ).toBe(true);
      expect(
        usersService.canManageUser(mockOwnerUser, USER_ROLES.CASHIER, '1'),
      ).toBe(true);
      expect(
        usersService.canManageUser(mockOwnerUser, USER_ROLES.CUSTOMER, '1'),
      ).toBe(true);
    });

    it("owner cannot manage admin or other owners", () => {
      expect(
        usersService.canManageUser(mockOwnerUser, USER_ROLES.ADMIN, '1'),
      ).toBe(false);
      expect(
        usersService.canManageUser(mockOwnerUser, USER_ROLES.OWNER, '1'),
      ).toBe(false);
    });

    it("owner cannot manage staff in different restaurant", () => {
      expect(
        usersService.canManageUser(mockOwnerUser, USER_ROLES.CHEF, '2'),
      ).toBe(false);
      expect(
        usersService.canManageUser(mockOwnerUser, USER_ROLES.SERVICE, '2'),
      ).toBe(false);
    });

    it("other roles cannot manage users", () => {
      expect(usersService.canManageUser(mockChefUser, USER_ROLES.CHEF, '1')).toBe(
        false,
      );
      expect(
        usersService.canManageUser(mockChefUser, USER_ROLES.CUSTOMER, '1'),
      ).toBe(false);
    });
  });

  describe("canViewUser", () => {
    it("admin can view all users", () => {
      const targetUser = { id: 200, restaurantId: 5 };
      expect(usersService.canViewUser(mockAdminUser, targetUser)).toBe(true);
    });

    it("user can view themselves", () => {
      const sameUser = { id: 102, restaurantId: 1 };
      expect(usersService.canViewUser(mockChefUser, sameUser)).toBe(true);
    });

    it("owner can view users in same restaurant", () => {
      const targetUser = { id: 200, restaurantId: 1 };
      expect(usersService.canViewUser(mockOwnerUser, targetUser)).toBe(true);
    });

    it("owner cannot view users in different restaurant", () => {
      const targetUser = { id: 200, restaurantId: 2 };
      expect(usersService.canViewUser(mockOwnerUser, targetUser)).toBe(false);
    });

    it("regular user cannot view other users", () => {
      const targetUser = { id: 200, restaurantId: 1 };
      expect(usersService.canViewUser(mockChefUser, targetUser)).toBe(false);
    });
  });

  describe("canUpdateUser", () => {
    it("admin can update all users", () => {
      expect(
        usersService.canUpdateUser(mockAdminUser, {
          id: 200,
          role: USER_ROLES.OWNER,
          restaurantId: 5,
        }),
      ).toBe(true);
    });

    it("user can update themselves", () => {
      expect(
        usersService.canUpdateUser(mockChefUser, {
          id: 102,
          role: USER_ROLES.CHEF,
          restaurantId: 1,
        }),
      ).toBe(true);
    });

    it("owner can update manageable users", () => {
      expect(
        usersService.canUpdateUser(mockOwnerUser, {
          id: 200,
          role: USER_ROLES.CHEF,
          restaurantId: 1,
        }),
      ).toBe(true);
    });

    it("owner cannot update non-manageable users", () => {
      expect(
        usersService.canUpdateUser(mockOwnerUser, {
          id: 200,
          role: USER_ROLES.ADMIN,
          restaurantId: 1,
        }),
      ).toBe(false);
    });
  });

  // ========================================
  // Format User Tests
  // ========================================
  describe("formatUser", () => {
    it("should format user data correctly", () => {
      const formatted = usersService.formatUser(mockUser);

      expect(formatted.id).toBe(mockUser.id);
      expect(formatted.username).toBe(mockUser.username);
      expect(formatted.role).toBe(mockUser.role);
      expect(formatted.role_name).toBe("Chef");
      expect(formatted.email).toBe(mockUser.email);
      expect(formatted.fullName).toBe(mockUser.fullName);
      expect(formatted.preferences).toEqual(mockUser.preferences);
    });

    it("should format Admin role correctly", () => {
      const adminUser = { ...mockUser, role: USER_ROLES.ADMIN };
      const formatted = usersService.formatUser(adminUser);
      expect(formatted.role_name).toBe("Admin");
    });

    it("should format Shop Owner role correctly", () => {
      const ownerUser = { ...mockUser, role: USER_ROLES.OWNER };
      const formatted = usersService.formatUser(ownerUser);
      expect(formatted.role_name).toBe("Shop Owner");
    });

    it("should format Service Crew role correctly", () => {
      const serviceUser = { ...mockUser, role: USER_ROLES.SERVICE };
      const formatted = usersService.formatUser(serviceUser);
      expect(formatted.role_name).toBe("Service Crew");
    });

    it("should format Cashier role correctly", () => {
      const cashierUser = { ...mockUser, role: USER_ROLES.CASHIER };
      const formatted = usersService.formatUser(cashierUser);
      expect(formatted.role_name).toBe("Cashier");
    });

    it("should format Customer role correctly", () => {
      const customerUser = { ...mockUser, role: USER_ROLES.CUSTOMER };
      const formatted = usersService.formatUser(customerUser);
      expect(formatted.role_name).toBe("Customer");
    });

    it("should handle unknown role", () => {
      const unknownUser = { ...mockUser, role: 999 };
      const formatted = usersService.formatUser(unknownUser);
      expect(formatted.role_name).toBe("Unknown");
    });

    it("should include all expected fields", () => {
      const formatted = usersService.formatUser(mockUser);

      expect(formatted).toHaveProperty("id");
      expect(formatted).toHaveProperty("username");
      expect(formatted).toHaveProperty("role");
      expect(formatted).toHaveProperty("role_name");
      expect(formatted).toHaveProperty("restaurantId");
      expect(formatted).toHaveProperty("email");
      expect(formatted).toHaveProperty("fullName");
      expect(formatted).toHaveProperty("phone");
      expect(formatted).toHaveProperty("isActive");
      expect(formatted).toHaveProperty("isVerified");
      expect(formatted).toHaveProperty("preferences");
      expect(formatted).toHaveProperty("totalOrders");
      expect(formatted).toHaveProperty("totalSpent");
      expect(formatted).toHaveProperty("lastLoginAt");
      expect(formatted).toHaveProperty("createdAt");
      expect(formatted).toHaveProperty("updatedAt");
    });
  });

  // ========================================
  // Get Users Tests
  // ========================================
  describe("getUsers", () => {
    it("admin should get all users", async () => {
      const mockResult = {
        users: [mockUser],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockUserService.getAllUsers.mockResolvedValue(mockResult);

      const result = await usersService.getUsers(mockAdminUser, {});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockUserService.getAllUsers).toHaveBeenCalled();
    });

    it("owner should get only restaurant users", async () => {
      const mockResult = {
        users: [mockUser],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockUserService.getRestaurantUsers.mockResolvedValue(mockResult);

      const result = await usersService.getUsers(mockOwnerUser, {});

      expect(result.success).toBe(true);
      // Service converts restaurantId to string for database layer
      expect(mockUserService.getRestaurantUsers).toHaveBeenCalledWith(
        "1",
        expect.any(Object),
      );
    });

    it("should apply owner restaurant filter", async () => {
      const mockResult = { users: [], pagination: {} };
      mockUserService.getRestaurantUsers.mockResolvedValue(mockResult);

      const filters: UserFilters = { restaurantId: '999' }; // Different from owner's restaurant
      await usersService.getUsers(mockOwnerUser, filters);

      // Should override with owner's restaurant
      expect(filters.restaurantId).toBe('1');
    });

    it("should format all users in response", async () => {
      const mockResult = {
        users: [
          { ...mockUser, id: 1 },
          { ...mockUser, id: 2 },
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };
      mockUserService.getAllUsers.mockResolvedValue(mockResult);

      const result = await usersService.getUsers(mockAdminUser, {});

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toHaveProperty("role_name");
      expect(result.data[1]).toHaveProperty("role_name");
    });
  });

  // ========================================
  // Get User By ID Tests
  // ========================================
  describe("getUserById", () => {
    it("should return user when found and accessible", async () => {
      mockUserService.getUserById.mockResolvedValue(mockUser);

      const result = await usersService.getUserById(mockAdminUser, 1);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("role_name");
    });

    it("should return 404 when user not found", async () => {
      mockUserService.getUserById.mockResolvedValue(null);

      const result = await usersService.getUserById(mockAdminUser, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("User not found");
      expect(result.status).toBe(404);
    });

    it("should return 403 when access denied", async () => {
      const targetUser = { ...mockUser, restaurantId: 2 }; // Different restaurant
      mockUserService.getUserById.mockResolvedValue(targetUser);

      const result = await usersService.getUserById(mockOwnerUser, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Access denied");
      expect(result.status).toBe(403);
    });

    it("user can view themselves", async () => {
      const selfUser = { ...mockUser, id: 102, restaurantId: 1 };
      mockUserService.getUserById.mockResolvedValue(selfUser);

      const result = await usersService.getUserById(mockChefUser, 102);

      expect(result.success).toBe(true);
    });
  });

  // ========================================
  // Create User Tests
  // ========================================
  describe("createUser", () => {
    it("admin should create any user", async () => {
      const userData: CreateUserData = {
        username: "newuser",
        password: "password123",
        role: USER_ROLES.OWNER,
        email: "new@example.com",
        fullName: "New User",
        restaurantId: '1',
      };
      mockUserService.createUser.mockResolvedValue({ id: 10, ...userData });

      const result = await usersService.createUser(mockAdminUser, userData);

      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
    });

    it("owner should create staff in own restaurant", async () => {
      const userData: CreateUserData = {
        username: "newchef",
        password: "password123",
        role: USER_ROLES.CHEF,
        restaurantId: '1',
        fullName: "New Chef",
      };
      mockUserService.createUser.mockResolvedValue({ id: 11, ...userData });

      const result = await usersService.createUser(mockOwnerUser, userData);

      expect(result.success).toBe(true);
    });

    it("owner should not create admin", async () => {
      const userData: CreateUserData = {
        username: "newadmin",
        password: "password123",
        role: USER_ROLES.ADMIN,
        fullName: "New Admin",
      };

      const result = await usersService.createUser(mockOwnerUser, userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Insufficient permissions to create this type of user",
      );
      expect(result.status).toBe(403);
    });

    it("owner should not create user in different restaurant", async () => {
      const userData: CreateUserData = {
        username: "newchef",
        password: "password123",
        role: USER_ROLES.CHEF,
        restaurantId: '2', // Different restaurant
        fullName: "New Chef",
      };

      const result = await usersService.createUser(mockOwnerUser, userData);

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });
  });

  // ========================================
  // Update User Tests
  // ========================================
  describe("updateUser", () => {
    it("should update user successfully", async () => {
      mockUserService.getUserById.mockResolvedValue(mockUser);
      mockUserService.updateUser.mockResolvedValue({
        ...mockUser,
        fullName: "Updated Name",
      });

      const result = await usersService.updateUser(mockAdminUser, 1, {
        fullName: "Updated Name",
      });

      expect(result.success).toBe(true);
      expect(result.data?.fullName).toBe("Updated Name");
    });

    it("should return 404 when user not found", async () => {
      mockUserService.getUserById.mockResolvedValue(null);

      const result = await usersService.updateUser(mockAdminUser, 999, {
        fullName: "Updated",
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });

    it("should return 403 when access denied", async () => {
      const targetUser = { ...mockUser, role: USER_ROLES.ADMIN };
      mockUserService.getUserById.mockResolvedValue(targetUser);

      const result = await usersService.updateUser(mockOwnerUser, 1, {
        fullName: "Updated",
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });

    it("user can update themselves", async () => {
      const selfUser = { ...mockUser, id: 102 };
      mockUserService.getUserById.mockResolvedValue(selfUser);
      mockUserService.updateUser.mockResolvedValue({
        ...selfUser,
        fullName: "Self Updated",
      });

      const result = await usersService.updateUser(mockChefUser, 102, {
        fullName: "Self Updated",
      });

      expect(result.success).toBe(true);
    });
  });

  // ========================================
  // Change Password Tests
  // ========================================
  describe("changePassword", () => {
    it("user can change own password", async () => {
      mockAuthService.changePassword.mockResolvedValue({ success: true });

      const result = await usersService.changePassword(
        mockChefUser,
        102,
        "oldPass",
        "newPass",
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Password updated successfully");
    });

    it("admin can change any password", async () => {
      mockAuthService.changePassword.mockResolvedValue({ success: true });

      const result = await usersService.changePassword(
        mockAdminUser,
        1,
        "oldPass",
        "newPass",
      );

      expect(result.success).toBe(true);
    });

    it("should deny non-admin changing other passwords", async () => {
      const result = await usersService.changePassword(
        mockChefUser,
        200,
        "old",
        "new",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Access denied");
      expect(result.status).toBe(403);
    });

    it("should handle incorrect current password", async () => {
      mockAuthService.changePassword.mockResolvedValue({
        success: false,
        error: "Incorrect password",
      });

      const result = await usersService.changePassword(
        mockChefUser,
        102,
        "wrong",
        "new",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Incorrect password");
      expect(result.status).toBe(400);
    });
  });

  // ========================================
  // Update User Status Tests
  // ========================================
  describe("updateUserStatus", () => {
    it("should activate user successfully", async () => {
      mockUserService.getUserById.mockResolvedValue({
        ...mockUser,
        role: USER_ROLES.CHEF,
      });
      mockUserService.updateUser.mockResolvedValue({
        ...mockUser,
        isActive: true,
      });

      const result = await usersService.updateUserStatus(
        mockAdminUser,
        1,
        true,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("User activated successfully");
    });

    it("should deactivate user successfully", async () => {
      mockUserService.getUserById.mockResolvedValue({
        ...mockUser,
        role: USER_ROLES.CHEF,
      });
      mockUserService.updateUser.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const result = await usersService.updateUserStatus(
        mockAdminUser,
        1,
        false,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("User deactivated successfully");
    });

    it("should return 404 when user not found", async () => {
      mockUserService.getUserById.mockResolvedValue(null);

      const result = await usersService.updateUserStatus(
        mockAdminUser,
        999,
        false,
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });

    it("should not allow deactivating self", async () => {
      mockUserService.getUserById.mockResolvedValue({
        id: 100,
        role: USER_ROLES.ADMIN,
      });

      const result = await usersService.updateUserStatus(
        mockAdminUser,
        100,
        false,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot deactivate your own account");
      expect(result.status).toBe(400);
    });

    it("should deny insufficient permissions", async () => {
      mockUserService.getUserById.mockResolvedValue({
        ...mockUser,
        role: USER_ROLES.ADMIN,
      });

      const result = await usersService.updateUserStatus(
        mockOwnerUser,
        1,
        false,
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });
  });

  // ========================================
  // Verify User Tests
  // ========================================
  describe("verifyUser", () => {
    it("should verify user successfully", async () => {
      mockUserService.getUserById.mockResolvedValue({
        ...mockUser,
        role: USER_ROLES.CHEF,
      });
      mockUserService.verifyUser.mockResolvedValue(true);

      const result = await usersService.verifyUser(mockAdminUser, 1);

      expect(result.success).toBe(true);
      expect(result.message).toBe("User verified successfully");
    });

    it("should return 404 when user not found", async () => {
      mockUserService.getUserById.mockResolvedValue(null);

      const result = await usersService.verifyUser(mockAdminUser, 999);

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });

    it("should deny insufficient permissions", async () => {
      mockUserService.getUserById.mockResolvedValue({
        ...mockUser,
        role: USER_ROLES.ADMIN,
      });

      const result = await usersService.verifyUser(mockOwnerUser, 1);

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });

    it("should handle verification failure", async () => {
      mockUserService.getUserById.mockResolvedValue({
        ...mockUser,
        role: USER_ROLES.CHEF,
      });
      mockUserService.verifyUser.mockResolvedValue(false);

      const result = await usersService.verifyUser(mockAdminUser, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to verify user");
      expect(result.status).toBe(500);
    });
  });

  // ========================================
  // Reset Password Tests
  // ========================================
  describe("resetPassword", () => {
    it("admin should reset password successfully", async () => {
      mockUserService.getUserById.mockResolvedValue({
        ...mockUser,
        role: USER_ROLES.CHEF,
      });
      mockUserService.resetPassword.mockResolvedValue(true);

      const result = await usersService.resetPassword(
        mockAdminUser,
        1,
        "newPassword123",
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Password reset successfully");
    });

    it("owner should reset staff password", async () => {
      mockUserService.getUserById.mockResolvedValue({
        ...mockUser,
        role: USER_ROLES.CHEF,
        restaurantId: 1,
      });
      mockUserService.resetPassword.mockResolvedValue(true);

      const result = await usersService.resetPassword(
        mockOwnerUser,
        1,
        "newPassword123",
      );

      expect(result.success).toBe(true);
    });

    it("should return 404 when user not found", async () => {
      mockUserService.getUserById.mockResolvedValue(null);

      const result = await usersService.resetPassword(
        mockAdminUser,
        999,
        "newPassword",
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });

    it("should deny insufficient permissions", async () => {
      mockUserService.getUserById.mockResolvedValue({
        ...mockUser,
        role: USER_ROLES.ADMIN,
      });

      const result = await usersService.resetPassword(
        mockOwnerUser,
        1,
        "newPassword",
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });

    it("should handle reset failure", async () => {
      mockUserService.getUserById.mockResolvedValue({
        ...mockUser,
        role: USER_ROLES.CHEF,
      });
      mockUserService.resetPassword.mockResolvedValue(false);

      const result = await usersService.resetPassword(
        mockAdminUser,
        1,
        "newPassword",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to reset password");
      expect(result.status).toBe(500);
    });
  });

  // ========================================
  // Get User Stats Tests
  // ========================================
  describe("getUserStats", () => {
    it("should return formatted stats for admin", async () => {
      mockUserService.getUserStats.mockResolvedValue({
        totalUsers: 100,
        activeUsers: 90,
        recentRegistrations: 15,
        byRole: {
          [USER_ROLES.ADMIN]: 2,
          [USER_ROLES.OWNER]: 10,
          [USER_ROLES.CHEF]: 30,
        },
      });

      const result = await usersService.getUserStats(mockAdminUser);

      expect(result.summary.total_users).toBe(100);
      expect(result.summary.active_users).toBe(90);
      expect(result.summary.inactive_users).toBe(10);
      expect(result.summary.new_users_month).toBe(15);
    });

    it("should return formatted by_role with role names", async () => {
      mockUserService.getUserStats.mockResolvedValue({
        totalUsers: 50,
        activeUsers: 45,
        recentRegistrations: 5,
        byRole: {
          [USER_ROLES.CHEF]: 20,
          [USER_ROLES.SERVICE]: 15,
        },
      });

      const result = await usersService.getUserStats(mockAdminUser);

      expect(result.by_role[USER_ROLES.CHEF].count).toBe(20);
      expect(result.by_role[USER_ROLES.CHEF].role_name).toBe("Chef");
      expect(result.by_role[USER_ROLES.SERVICE].role_name).toBe("Service Crew");
    });

    it("owner should get filtered stats", async () => {
      mockUserService.getUserStats.mockResolvedValue({
        totalUsers: 20,
        activeUsers: 18,
        recentRegistrations: 3,
        byRole: {},
      });

      await usersService.getUserStats(mockOwnerUser);

      // Service converts restaurantId to string for database layer
      expect(mockUserService.getUserStats).toHaveBeenCalledWith("1"); // Owner's restaurant
    });

    it("admin with specific restaurant should filter", async () => {
      mockUserService.getUserStats.mockResolvedValue({
        totalUsers: 10,
        activeUsers: 8,
        recentRegistrations: 2,
        byRole: {},
      });

      await usersService.getUserStats(mockAdminUser, '5');

      // Service converts restaurantId to string for database layer
      expect(mockUserService.getUserStats).toHaveBeenCalledWith("5");
    });
  });

  // ========================================
  // Search Users Tests
  // ========================================
  describe("searchUsers", () => {
    it("admin should search all users", async () => {
      mockUserService.searchUsers.mockResolvedValue([mockUser]);

      const result = await usersService.searchUsers(mockAdminUser, "test");

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("role_name");
    });

    it("owner should search only restaurant users", async () => {
      mockUserService.searchUsers.mockResolvedValue([mockUser]);

      await usersService.searchUsers(mockOwnerUser, "test");

      // Service converts restaurantId to string for database layer
      expect(mockUserService.searchUsers).toHaveBeenCalledWith(
        "test",
        "1",
        undefined,
      );
    });

    it("should apply restaurant filter for admin", async () => {
      mockUserService.searchUsers.mockResolvedValue([]);

      await usersService.searchUsers(mockAdminUser, "test", '5');

      // Service converts restaurantId to string for database layer
      expect(mockUserService.searchUsers).toHaveBeenCalledWith(
        "test",
        "5",
        undefined,
      );
    });

    it("should apply limit", async () => {
      mockUserService.searchUsers.mockResolvedValue([]);

      await usersService.searchUsers(mockAdminUser, "test", undefined, 10);

      expect(mockUserService.searchUsers).toHaveBeenCalledWith(
        "test",
        undefined,
        10,
      );
    });

    it("should format all search results", async () => {
      mockUserService.searchUsers.mockResolvedValue([
        { ...mockUser, id: 1 },
        { ...mockUser, id: 2 },
      ]);

      const result = await usersService.searchUsers(mockAdminUser, "test");

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("role_name");
      expect(result[1]).toHaveProperty("role_name");
    });
  });
});
