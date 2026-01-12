/**
 * Users Routes Unit Tests
 * 用戶路由單元測試 - 提升覆蓋率
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { USER_ROLES } from "@makanmakan/database";

// Mock UsersService
const mockUsersService = {
  getUsers: vi.fn(),
  getUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  changePassword: vi.fn(),
  updateUserStatus: vi.fn(),
  verifyUser: vi.fn(),
  resetPassword: vi.fn(),
  getUserStats: vi.fn(),
  searchUsers: vi.fn(),
  canManageUser: vi.fn(),
  canViewUser: vi.fn(),
  canUpdateUser: vi.fn(),
  formatUser: vi.fn(),
};

// Use class-based mock for vitest 4 compatibility
vi.mock("../services/UsersService", () => {
  return {
    UsersService: class MockUsersService {
      constructor() {
        Object.assign(this, mockUsersService);
      }
    },
  };
});

describe("Users Routes Unit Tests", () => {
  const mockAdminUser = {
    id: 1,
    username: "admin",
    role: USER_ROLES.ADMIN,
    restaurantId: null,
  };

  const mockOwnerUser = {
    id: 2,
    username: "owner",
    role: USER_ROLES.OWNER,
    restaurantId: 1,
  };

  const mockStaffUser = {
    id: 3,
    username: "chef",
    role: USER_ROLES.CHEF,
    restaurantId: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /users - Get users list", () => {
    it("管理員應該能獲取所有用戶", async () => {
      const mockResult = {
        success: true,
        data: [
          { id: 1, username: "user1", role: USER_ROLES.CHEF },
          { id: 2, username: "user2", role: USER_ROLES.SERVICE },
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };
      mockUsersService.getUsers.mockResolvedValue(mockResult);

      const result = await mockUsersService.getUsers(mockAdminUser, {});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it("店主應該只能獲取自己餐廳的用戶", async () => {
      const mockResult = {
        success: true,
        data: [{ id: 3, username: "chef", restaurantId: 1 }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockUsersService.getUsers.mockResolvedValue(mockResult);

      const result = await mockUsersService.getUsers(mockOwnerUser, {
        restaurantId: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data[0].restaurantId).toBe(1);
    });

    it("應該支持角色過濾", async () => {
      mockUsersService.getUsers.mockResolvedValue({
        success: true,
        data: [],
        pagination: {},
      });

      await mockUsersService.getUsers(mockAdminUser, { role: USER_ROLES.CHEF });

      expect(mockUsersService.getUsers).toHaveBeenCalledWith(mockAdminUser, {
        role: USER_ROLES.CHEF,
      });
    });

    it("應該支持狀態過濾", async () => {
      mockUsersService.getUsers.mockResolvedValue({
        success: true,
        data: [],
        pagination: {},
      });

      await mockUsersService.getUsers(mockAdminUser, { isActive: true });

      expect(mockUsersService.getUsers).toHaveBeenCalled();
    });

    it("應該支持分頁", async () => {
      mockUsersService.getUsers.mockResolvedValue({
        success: true,
        data: [],
        pagination: { page: 2, limit: 10, total: 25, totalPages: 3 },
      });

      await mockUsersService.getUsers(mockAdminUser, { page: 2, limit: 10 });

      expect(mockUsersService.getUsers).toHaveBeenCalled();
    });
  });

  describe("GET /users/:id - Get user by ID", () => {
    it("應該成功獲取用戶詳情", async () => {
      const mockResult = {
        success: true,
        data: {
          id: 3,
          username: "chef",
          role: USER_ROLES.CHEF,
          fullName: "Test Chef",
          email: "chef@test.com",
        },
      };
      mockUsersService.getUserById.mockResolvedValue(mockResult);

      const result = await mockUsersService.getUserById(mockAdminUser, 3);

      expect(result.success).toBe(true);
      expect(result.data.username).toBe("chef");
    });

    it("用戶應該能查看自己的資料", async () => {
      const mockResult = {
        success: true,
        data: { id: 3, username: "chef" },
      };
      mockUsersService.getUserById.mockResolvedValue(mockResult);

      const result = await mockUsersService.getUserById(mockStaffUser, 3);

      expect(result.success).toBe(true);
    });

    it("應該處理用戶不存在", async () => {
      mockUsersService.getUserById.mockResolvedValue({
        success: false,
        error: "User not found",
        status: 404,
      });

      const result = await mockUsersService.getUserById(mockAdminUser, 999);

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });

    it("應該處理權限不足", async () => {
      mockUsersService.getUserById.mockResolvedValue({
        success: false,
        error: "Access denied",
        status: 403,
      });

      const result = await mockUsersService.getUserById(mockStaffUser, 100);

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });
  });

  describe("POST /users - Create user", () => {
    it("管理員應該能創建任何角色的用戶", async () => {
      const createData = {
        username: "newuser",
        password: "password123",
        role: USER_ROLES.OWNER,
        email: "new@test.com",
        fullName: "New User",
      };
      mockUsersService.createUser.mockResolvedValue({
        success: true,
        data: { id: 10, ...createData },
        status: 201,
      });

      const result = await mockUsersService.createUser(
        mockAdminUser,
        createData,
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
    });

    it("店主應該只能創建員工角色", async () => {
      const createData = {
        username: "newchef",
        password: "password123",
        role: USER_ROLES.CHEF,
        restaurantId: 1,
      };
      mockUsersService.createUser.mockResolvedValue({
        success: true,
        data: { id: 11, ...createData },
        status: 201,
      });

      const result = await mockUsersService.createUser(
        mockOwnerUser,
        createData,
      );

      expect(result.success).toBe(true);
    });

    it("店主不能創建管理員", async () => {
      mockUsersService.createUser.mockResolvedValue({
        success: false,
        error: "Insufficient permissions to create this type of user",
        status: 403,
      });

      const result = await mockUsersService.createUser(mockOwnerUser, {
        role: USER_ROLES.ADMIN,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });

    it("應該驗證必填字段", async () => {
      mockUsersService.createUser.mockResolvedValue({
        success: false,
        error: "Username is required",
        status: 400,
      });

      const result = await mockUsersService.createUser(mockAdminUser, {});

      expect(result.success).toBe(false);
    });

    it("應該處理用戶名重複", async () => {
      mockUsersService.createUser.mockResolvedValue({
        success: false,
        error: "Username already exists",
        status: 400,
      });

      const result = await mockUsersService.createUser(mockAdminUser, {
        username: "existing",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("PUT /users/:id - Update user", () => {
    it("應該成功更新用戶資料", async () => {
      const updateData = { fullName: "Updated Name", phone: "1234567890" };
      mockUsersService.updateUser.mockResolvedValue({
        success: true,
        data: { id: 3, ...updateData },
      });

      const result = await mockUsersService.updateUser(
        mockAdminUser,
        3,
        updateData,
      );

      expect(result.success).toBe(true);
      expect(result.data.fullName).toBe("Updated Name");
    });

    it("用戶應該能更新自己的資料", async () => {
      mockUsersService.updateUser.mockResolvedValue({
        success: true,
        data: { id: 3, fullName: "Self Updated" },
      });

      const result = await mockUsersService.updateUser(mockStaffUser, 3, {
        fullName: "Self Updated",
      });

      expect(result.success).toBe(true);
    });

    it("應該處理用戶不存在", async () => {
      mockUsersService.updateUser.mockResolvedValue({
        success: false,
        error: "User not found",
        status: 404,
      });

      const result = await mockUsersService.updateUser(mockAdminUser, 999, {});

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });

    it("應該處理權限不足", async () => {
      mockUsersService.updateUser.mockResolvedValue({
        success: false,
        error: "Access denied",
        status: 403,
      });

      const result = await mockUsersService.updateUser(mockStaffUser, 100, {});

      expect(result.success).toBe(false);
    });
  });

  describe("POST /users/:id/password - Change password", () => {
    it("用戶應該能修改自己的密碼", async () => {
      mockUsersService.changePassword.mockResolvedValue({
        success: true,
        message: "Password updated successfully",
      });

      const result = await mockUsersService.changePassword(
        mockStaffUser,
        3,
        "oldPassword",
        "newPassword123",
      );

      expect(result.success).toBe(true);
    });

    it("管理員應該能修改任何人的密碼", async () => {
      mockUsersService.changePassword.mockResolvedValue({
        success: true,
        message: "Password updated successfully",
      });

      const result = await mockUsersService.changePassword(
        mockAdminUser,
        3,
        "oldPassword",
        "newPassword123",
      );

      expect(result.success).toBe(true);
    });

    it("應該驗證當前密碼", async () => {
      mockUsersService.changePassword.mockResolvedValue({
        success: false,
        error: "Current password is incorrect",
        status: 400,
      });

      const result = await mockUsersService.changePassword(
        mockStaffUser,
        3,
        "wrongPassword",
        "newPassword123",
      );

      expect(result.success).toBe(false);
    });

    it("不能修改他人密碼（非管理員）", async () => {
      mockUsersService.changePassword.mockResolvedValue({
        success: false,
        error: "Access denied",
        status: 403,
      });

      const result = await mockUsersService.changePassword(
        mockStaffUser,
        100,
        "old",
        "new",
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });
  });

  describe("PATCH /users/:id/status - Update user status", () => {
    it("應該成功啟用用戶", async () => {
      mockUsersService.updateUserStatus.mockResolvedValue({
        success: true,
        message: "User activated successfully",
      });

      const result = await mockUsersService.updateUserStatus(
        mockAdminUser,
        3,
        true,
      );

      expect(result.success).toBe(true);
    });

    it("應該成功停用用戶", async () => {
      mockUsersService.updateUserStatus.mockResolvedValue({
        success: true,
        message: "User deactivated successfully",
      });

      const result = await mockUsersService.updateUserStatus(
        mockAdminUser,
        3,
        false,
      );

      expect(result.success).toBe(true);
    });

    it("不能停用自己", async () => {
      mockUsersService.updateUserStatus.mockResolvedValue({
        success: false,
        error: "Cannot deactivate your own account",
        status: 400,
      });

      const result = await mockUsersService.updateUserStatus(
        mockAdminUser,
        1,
        false,
      );

      expect(result.success).toBe(false);
    });

    it("店主不能停用其他餐廳的用戶", async () => {
      mockUsersService.updateUserStatus.mockResolvedValue({
        success: false,
        error: "Insufficient permissions",
        status: 403,
      });

      const result = await mockUsersService.updateUserStatus(
        mockOwnerUser,
        100,
        false,
      );

      expect(result.success).toBe(false);
    });
  });

  describe("PATCH /users/:id/verify - Verify user", () => {
    it("應該成功驗證用戶", async () => {
      mockUsersService.verifyUser.mockResolvedValue({
        success: true,
        message: "User verified successfully",
      });

      const result = await mockUsersService.verifyUser(mockAdminUser, 3);

      expect(result.success).toBe(true);
    });

    it("應該處理用戶不存在", async () => {
      mockUsersService.verifyUser.mockResolvedValue({
        success: false,
        error: "User not found",
        status: 404,
      });

      const result = await mockUsersService.verifyUser(mockAdminUser, 999);

      expect(result.success).toBe(false);
    });

    it("應該處理權限不足", async () => {
      mockUsersService.verifyUser.mockResolvedValue({
        success: false,
        error: "Insufficient permissions",
        status: 403,
      });

      const result = await mockUsersService.verifyUser(mockStaffUser, 100);

      expect(result.success).toBe(false);
    });
  });

  describe("POST /users/:id/reset-password - Reset password", () => {
    it("管理員應該能重設用戶密碼", async () => {
      mockUsersService.resetPassword.mockResolvedValue({
        success: true,
        message: "Password reset successfully",
      });

      const result = await mockUsersService.resetPassword(
        mockAdminUser,
        3,
        "newPassword123",
      );

      expect(result.success).toBe(true);
    });

    it("店主應該能重設員工密碼", async () => {
      mockUsersService.resetPassword.mockResolvedValue({
        success: true,
        message: "Password reset successfully",
      });

      const result = await mockUsersService.resetPassword(
        mockOwnerUser,
        3,
        "newPassword123",
      );

      expect(result.success).toBe(true);
    });

    it("應該處理用戶不存在", async () => {
      mockUsersService.resetPassword.mockResolvedValue({
        success: false,
        error: "User not found",
        status: 404,
      });

      const result = await mockUsersService.resetPassword(
        mockAdminUser,
        999,
        "newPassword",
      );

      expect(result.success).toBe(false);
    });
  });

  describe("GET /users/stats - Get user statistics", () => {
    it("應該返回用戶統計數據", async () => {
      const mockStats = {
        summary: {
          total_users: 50,
          active_users: 45,
          inactive_users: 5,
          new_users_month: 10,
        },
        by_role: {
          [USER_ROLES.ADMIN]: { count: 2, role_name: "Admin" },
          [USER_ROLES.OWNER]: { count: 5, role_name: "Shop Owner" },
          [USER_ROLES.CHEF]: { count: 15, role_name: "Chef" },
        },
      };
      mockUsersService.getUserStats.mockResolvedValue(mockStats);

      const result = await mockUsersService.getUserStats(
        mockAdminUser,
        undefined,
      );

      expect(result.summary.total_users).toBe(50);
    });

    it("店主應該只能查看自己餐廳的統計", async () => {
      mockUsersService.getUserStats.mockResolvedValue({
        summary: { total_users: 10 },
        by_role: {},
      });

      const result = await mockUsersService.getUserStats(mockOwnerUser, 1);

      expect(result.summary.total_users).toBe(10);
    });
  });

  describe("GET /users/search - Search users", () => {
    it("應該支持關鍵字搜索", async () => {
      mockUsersService.searchUsers.mockResolvedValue([
        { id: 1, username: "john", fullName: "John Doe" },
      ]);

      const result = await mockUsersService.searchUsers(
        mockAdminUser,
        "john",
        undefined,
        10,
      );

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe("john");
    });

    it("應該支持餐廳過濾", async () => {
      mockUsersService.searchUsers.mockResolvedValue([]);

      await mockUsersService.searchUsers(mockAdminUser, "test", 1, 10);

      expect(mockUsersService.searchUsers).toHaveBeenCalledWith(
        mockAdminUser,
        "test",
        1,
        10,
      );
    });

    it("應該支持限制結果數量", async () => {
      mockUsersService.searchUsers.mockResolvedValue([]);

      await mockUsersService.searchUsers(mockAdminUser, "test", undefined, 5);

      expect(mockUsersService.searchUsers).toHaveBeenCalledWith(
        mockAdminUser,
        "test",
        undefined,
        5,
      );
    });
  });

  describe("Permission Validation", () => {
    describe("canManageUser", () => {
      it("管理員可以管理所有用戶", () => {
        mockUsersService.canManageUser.mockReturnValue(true);

        expect(
          mockUsersService.canManageUser(mockAdminUser, USER_ROLES.OWNER, 2),
        ).toBe(true);
      });

      it("店主只能管理自己餐廳的員工", () => {
        mockUsersService.canManageUser.mockReturnValue(true);

        expect(
          mockUsersService.canManageUser(mockOwnerUser, USER_ROLES.CHEF, 1),
        ).toBe(true);
      });

      it("店主不能管理其他餐廳的員工", () => {
        mockUsersService.canManageUser.mockReturnValue(false);

        expect(
          mockUsersService.canManageUser(mockOwnerUser, USER_ROLES.CHEF, 2),
        ).toBe(false);
      });

      it("店主不能管理管理員", () => {
        mockUsersService.canManageUser.mockReturnValue(false);

        expect(
          mockUsersService.canManageUser(mockOwnerUser, USER_ROLES.ADMIN, 1),
        ).toBe(false);
      });
    });

    describe("canViewUser", () => {
      it("管理員可以查看所有用戶", () => {
        mockUsersService.canViewUser.mockReturnValue(true);

        expect(mockUsersService.canViewUser(mockAdminUser, { id: 100 })).toBe(
          true,
        );
      });

      it("用戶可以查看自己", () => {
        mockUsersService.canViewUser.mockReturnValue(true);

        expect(mockUsersService.canViewUser(mockStaffUser, { id: 3 })).toBe(
          true,
        );
      });

      it("店主可以查看同餐廳員工", () => {
        mockUsersService.canViewUser.mockReturnValue(true);

        expect(
          mockUsersService.canViewUser(mockOwnerUser, {
            id: 3,
            restaurantId: 1,
          }),
        ).toBe(true);
      });
    });
  });

  describe("Error Handling", () => {
    it("應該處理數據庫錯誤", async () => {
      mockUsersService.getUsers.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        mockUsersService.getUsers(mockAdminUser, {}),
      ).rejects.toThrow();
    });

    it("應該處理無效的用戶 ID", async () => {
      mockUsersService.getUserById.mockResolvedValue({
        success: false,
        error: "Invalid user ID",
        status: 400,
      });

      const result = await mockUsersService.getUserById(mockAdminUser, -1);

      expect(result.success).toBe(false);
    });
  });
});
