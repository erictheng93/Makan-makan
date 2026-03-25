import { UserService, AuthService, USER_ROLES } from "@makanmakan/database";
import type { Env } from "../../../types/env";
import {
  notFound,
  forbidden,
  badRequest,
} from "../../../shared/utils/api-error";
import { ApiError } from "../../../shared/utils/api-error";
import {
  USER_ROLE_NAMES,
  type CreateUserData,
  type UpdateUserData,
  type UserFilters,
  type FormattedUser,
  type UserStats,
} from "../types";

export class UsersService {
  private userService: UserService;
  private authService: AuthService;

  constructor(private env: Env) {
    this.userService = new UserService(env.DB as any, env);
    this.authService = new AuthService(env.DB as any, env);
  }

  canManageUser(
    currentUser: any,
    targetRole: number,
    targetRestaurantId?: string,
  ): boolean {
    if (currentUser.role === USER_ROLES.ADMIN) return true;
    if (currentUser.role === USER_ROLES.OWNER) {
      return (
        targetRole >= USER_ROLES.CHEF &&
        targetRole <= USER_ROLES.CUSTOMER &&
        targetRestaurantId === currentUser.restaurantId
      );
    }
    return false;
  }

  canViewUser(currentUser: any, targetUser: any): boolean {
    return (
      currentUser.role === USER_ROLES.ADMIN ||
      currentUser.id === targetUser.id ||
      (currentUser.role === USER_ROLES.OWNER &&
        targetUser.restaurantId === currentUser.restaurantId)
    );
  }

  canUpdateUser(currentUser: any, targetUser: any): boolean {
    return (
      currentUser.role === USER_ROLES.ADMIN ||
      currentUser.id === targetUser.id ||
      (currentUser.role === USER_ROLES.OWNER &&
        this.canManageUser(
          currentUser,
          targetUser.role,
          targetUser.restaurantId,
        ))
    );
  }

  formatUser(user: any): FormattedUser {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      role_name: USER_ROLE_NAMES[user.role] || "Unknown",
      restaurantId: user.restaurantId,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      address: user.address,
      dateOfBirth: user.dateOfBirth,
      profileImageUrl: user.profileImageUrl,
      isActive: user.isActive,
      isVerified: user.isVerified,
      preferences: user.preferences,
      totalOrders: user.totalOrders,
      totalSpent: user.totalSpent,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /** Fetch user or throw 404. Shared by multiple methods. */
  private async requireUser(userId: number) {
    const user = await this.userService.getUserById(userId);
    if (!user) throw notFound("User not found");
    return user;
  }

  /** Fetch user + verify caller can manage them, or throw. */
  private async requireManagedUser(currentUser: any, userId: number) {
    const target = await this.requireUser(userId);
    if (!this.canManageUser(currentUser, target.role, target.restaurantId)) {
      throw forbidden("Insufficient permissions");
    }
    return target;
  }

  async getUsers(currentUser: any, filters: UserFilters) {
    if (currentUser.role === USER_ROLES.OWNER) {
      filters.restaurantId = currentUser.restaurantId;
    }

    const dbFilters = {
      ...filters,
      restaurantId: filters.restaurantId
        ? String(filters.restaurantId)
        : undefined,
    };
    const result =
      currentUser.role === USER_ROLES.ADMIN
        ? await this.userService.getAllUsers(dbFilters)
        : await this.userService.getRestaurantUsers(
            String(currentUser.restaurantId!),
            dbFilters,
          );

    return {
      data: result.users.map((user: any) => this.formatUser(user)),
      pagination: result.pagination,
    };
  }

  async getUserById(currentUser: any, userId: number): Promise<FormattedUser> {
    const targetUser = await this.requireUser(userId);

    if (!this.canViewUser(currentUser, targetUser)) {
      throw forbidden("Access denied");
    }

    return this.formatUser(targetUser);
  }

  async createUser(
    currentUser: any,
    userData: CreateUserData,
  ): Promise<FormattedUser> {
    const effectiveRestaurantId =
      userData.restaurantId != null
        ? String(userData.restaurantId)
        : currentUser.restaurantId;

    if (
      !this.canManageUser(currentUser, userData.role, effectiveRestaurantId)
    ) {
      throw forbidden("Insufficient permissions to create this type of user");
    }

    const dbUserData = {
      ...userData,
      restaurantId: effectiveRestaurantId,
    };
    const newUser = await this.userService.createUser(dbUserData);

    return this.formatUser(newUser);
  }

  async updateUser(
    currentUser: any,
    userId: number,
    updateData: UpdateUserData,
  ): Promise<FormattedUser> {
    const targetUser = await this.requireUser(userId);

    if (!this.canUpdateUser(currentUser, targetUser)) {
      throw forbidden("Access denied");
    }

    const updatedUser = await this.userService.updateUser(userId, updateData);
    return this.formatUser(updatedUser);
  }

  async changePassword(
    currentUser: any,
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (currentUser.id !== userId && currentUser.role !== USER_ROLES.ADMIN) {
      throw forbidden("Access denied");
    }

    const result = await this.authService.changePassword(
      userId,
      currentPassword,
      newPassword,
    );

    if (!result.success) {
      throw badRequest(result.error || "Password change failed");
    }
  }

  async updateUserStatus(
    currentUser: any,
    userId: number,
    isActive: boolean,
  ): Promise<string> {
    const targetUser = await this.requireManagedUser(currentUser, userId);

    if (currentUser.id === userId && !isActive) {
      throw badRequest("Cannot deactivate your own account");
    }

    await this.userService.updateUser(userId, { isActive });
    return `User ${isActive ? "activated" : "deactivated"} successfully`;
  }

  async verifyUser(currentUser: any, userId: number): Promise<void> {
    await this.requireManagedUser(currentUser, userId);

    const success = await this.userService.verifyUser(userId);
    if (!success) {
      throw new ApiError("INTERNAL_ERROR", "Failed to verify user", 500);
    }
  }

  async resetPassword(
    currentUser: any,
    userId: number,
    newPassword: string,
  ): Promise<void> {
    await this.requireManagedUser(currentUser, userId);

    const success = await this.userService.resetPassword(userId, newPassword);
    if (!success) {
      throw new ApiError("INTERNAL_ERROR", "Failed to reset password", 500);
    }
  }

  async getUserStats(
    currentUser: any,
    restaurantId?: string,
  ): Promise<UserStats> {
    let targetRestaurantId: string | undefined;
    if (currentUser.role === USER_ROLES.OWNER) {
      targetRestaurantId = currentUser.restaurantId;
    } else if (restaurantId) {
      targetRestaurantId = restaurantId;
    }

    const stats = await this.userService.getUserStats(targetRestaurantId);

    const formattedByRole: Record<
      number,
      { count: number; role_name: string }
    > = {};
    for (const [role, roleCount] of Object.entries(stats.byRole)) {
      const roleNum = parseInt(role);
      formattedByRole[roleNum] = {
        count: roleCount,
        role_name: USER_ROLE_NAMES[roleNum] || "Unknown",
      };
    }

    return {
      summary: {
        total_users: stats.totalUsers,
        active_users: stats.activeUsers,
        inactive_users: stats.totalUsers - stats.activeUsers,
        new_users_month: stats.recentRegistrations,
      },
      by_role: formattedByRole,
    };
  }

  async searchUsers(
    currentUser: any,
    query: string,
    restaurantId?: string,
    limit?: number,
  ) {
    let targetRestaurantId: string | undefined;
    if (currentUser.role === USER_ROLES.OWNER) {
      targetRestaurantId = currentUser.restaurantId;
    } else if (restaurantId) {
      targetRestaurantId = restaurantId;
    }

    const results = await this.userService.searchUsers(
      query,
      targetRestaurantId,
      limit,
    );

    return results.map((user: any) => this.formatUser(user));
  }
}
