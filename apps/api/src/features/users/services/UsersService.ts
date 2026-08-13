import { UserService, AuthService, USER_ROLES } from "@makanmasak/database";
import type { UserPreferences } from "@makanmasak/shared-types";
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
import { ManagementTenantClient } from "../../../services/managementTenantClient";

interface CurrentUser {
  id: string;
  role: number;
  restaurantId?: string | number | null;
}

/**
 * What the user queries actually hand back, which is not what this interface
 * used to claim. Nullable columns arrive as `null`, not absent, and the list
 * and search projections select different subsets — `searchUsers` returns six
 * columns, so everything outside that set is genuinely missing rather than
 * merely empty. `updatedAt` is a `Date` from `updateUser`'s `returning()` and a
 * serialized string from the read paths.
 *
 * Widening it here documents what already reaches `formatUser`; it does not
 * change any response. Narrowing it back is a query change, not a type change:
 * the projections have to select the columns first. See TODOS.
 */
interface UserRecord {
  id: string;
  username: string;
  role: number;
  restaurantId?: string | null;
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  profileImageUrl?: string | null;
  isActive?: boolean;
  isVerified?: boolean;
  preferences?: UserPreferences | string | null;
  totalOrders?: number | null;
  totalSpent?: number | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | Date | null;
}

export class UsersService {
  private userService: UserService;
  private authService: AuthService;
  private managementTenantClient: ManagementTenantClient;

  constructor(private env: Env) {
    this.userService = new UserService(env.DB, env);
    this.authService = new AuthService(env.DB, env);
    this.managementTenantClient = new ManagementTenantClient(env);
  }

  canManageUser(
    currentUser: CurrentUser,
    targetRole: number,
    // Nullable column, so `null` reaches here as readily as `undefined`.
    // Neither can equal an owner's restaurant id, which is the refusal the
    // comparison below already produces.
    targetRestaurantId?: string | null,
  ): boolean {
    if (currentUser.role === USER_ROLES.ADMIN) return true;
    if (currentUser.role === USER_ROLES.OWNER) {
      return (
        targetRole >= USER_ROLES.CHEF &&
        targetRole <= USER_ROLES.CASHIER &&
        targetRestaurantId === currentUser.restaurantId
      );
    }
    return false;
  }

  canViewUser(
    currentUser: CurrentUser,
    targetUser: { id: string; restaurantId?: string | number | null },
  ): boolean {
    return (
      currentUser.role === USER_ROLES.ADMIN ||
      currentUser.id === targetUser.id ||
      (currentUser.role === USER_ROLES.OWNER &&
        targetUser.restaurantId === currentUser.restaurantId)
    );
  }

  canUpdateUser(
    currentUser: CurrentUser,
    targetUser: {
      id: string;
      role: number;
      restaurantId?: string | number | null;
    },
  ): boolean {
    return (
      currentUser.role === USER_ROLES.ADMIN ||
      currentUser.id === targetUser.id ||
      (currentUser.role === USER_ROLES.OWNER &&
        this.canManageUser(
          currentUser,
          targetUser.role,
          targetUser.restaurantId == null
            ? undefined
            : String(targetUser.restaurantId),
        ))
    );
  }

  formatUser(user: UserRecord): FormattedUser {
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
  private async requireUser(userId: string): Promise<UserRecord> {
    const user = await this.userService.getUserById(userId);
    if (!user) throw notFound("User not found");
    return user as UserRecord;
  }

  /** Fetch user + verify caller can manage them, or throw. */
  private async requireManagedUser(
    currentUser: CurrentUser,
    userId: string,
  ): Promise<UserRecord> {
    const target = await this.requireUser(userId);
    if (!this.canManageUser(currentUser, target.role, target.restaurantId)) {
      throw forbidden("Insufficient permissions");
    }
    return target;
  }

  async getUsers(currentUser: CurrentUser, filters: UserFilters) {
    if (currentUser.role === USER_ROLES.OWNER) {
      filters.restaurantId =
        currentUser.restaurantId !== undefined
          ? String(currentUser.restaurantId)
          : undefined;
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
      data: result.users.map((user: UserRecord) => this.formatUser(user)),
      pagination: result.pagination,
    };
  }

  async getUserById(
    currentUser: CurrentUser,
    userId: string,
  ): Promise<FormattedUser> {
    const targetUser = await this.requireUser(userId);

    if (!this.canViewUser(currentUser, targetUser)) {
      throw forbidden("Access denied");
    }

    return this.formatUser(targetUser);
  }

  async createUser(
    currentUser: CurrentUser,
    userData: CreateUserData,
  ): Promise<FormattedUser> {
    // Roles 1-4 are restaurant-scoped; role 0 is the platform and owns no
    // restaurant. The same rule guards POST /auth/register-staff — both entry
    // points must enforce it, or an orphan just moves to the other one (#67).
    // A row with a NULL restaurant_id belongs to nobody, and manageability is
    // decided by that column, so no owner can ever administer it.
    const isPlatformRole = userData.role === USER_ROLES.ADMIN;

    const effectiveRestaurantId = isPlatformRole
      ? undefined
      : userData.restaurantId != null
        ? String(userData.restaurantId)
        : currentUser.restaurantId == null
          ? undefined
          : String(currentUser.restaurantId);

    if (
      !this.canManageUser(currentUser, userData.role, effectiveRestaurantId)
    ) {
      throw forbidden("Insufficient permissions to create this type of user");
    }

    // canManageUser waves an admin through unconditionally, so the check above
    // does not catch this on its own.
    if (!isPlatformRole && !effectiveRestaurantId) {
      throw badRequest(
        "Restaurant ID is required for restaurant-scoped roles",
        "RESTAURANT_ID_REQUIRED",
      );
    }

    const dbUserData = {
      ...userData,
      restaurantId: effectiveRestaurantId,
    };
    const newUser = await this.userService.createUser(dbUserData);
    if (
      currentUser.role === USER_ROLES.ADMIN &&
      newUser.role === USER_ROLES.OWNER &&
      newUser.restaurantId
    ) {
      try {
        await this.managementTenantClient.linkRestaurantOwner({
          restaurantId: String(newUser.restaurantId),
          ownerUserId: String(newUser.id),
          ownerUsername: newUser.username,
        });
      } catch (error) {
        await this.userService
          .updateUser(String(newUser.id), { isActive: false })
          .catch((deactivateError) => {
            console.error(
              "Failed to deactivate owner user after management owner link failure",
              deactivateError,
              {
                userId: newUser.id,
                restaurantId: newUser.restaurantId,
              },
            );
          });
        throw error;
      }
    }

    return this.formatUser(newUser);
  }

  async updateUser(
    currentUser: CurrentUser,
    userId: string,
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
    currentUser: CurrentUser,
    userId: string,
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
    currentUser: CurrentUser,
    userId: string,
    isActive: boolean,
  ): Promise<string> {
    const _targetUser = await this.requireManagedUser(currentUser, userId);

    if (currentUser.id === userId && !isActive) {
      throw badRequest("Cannot deactivate your own account");
    }

    await this.userService.updateUser(userId, { isActive });
    return `User ${isActive ? "activated" : "deactivated"} successfully`;
  }

  async verifyUser(currentUser: CurrentUser, userId: string): Promise<void> {
    await this.requireManagedUser(currentUser, userId);

    const success = await this.userService.verifyUser(userId);
    if (!success) {
      throw new ApiError("INTERNAL_ERROR", "Failed to verify user", 500);
    }
  }

  async resetPassword(
    currentUser: CurrentUser,
    userId: string,
    newPassword: string,
  ): Promise<void> {
    await this.requireManagedUser(currentUser, userId);

    const success = await this.userService.resetPassword(userId, newPassword);
    if (!success) {
      throw new ApiError("INTERNAL_ERROR", "Failed to reset password", 500);
    }
  }

  async getUserStats(
    currentUser: CurrentUser,
    restaurantId?: string,
  ): Promise<UserStats> {
    let targetRestaurantId: string | undefined;
    if (currentUser.role === USER_ROLES.OWNER) {
      targetRestaurantId =
        currentUser.restaurantId !== undefined
          ? String(currentUser.restaurantId)
          : undefined;
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
    currentUser: CurrentUser,
    query: string,
    restaurantId?: string,
    limit?: number,
  ) {
    let targetRestaurantId: string | undefined;
    if (currentUser.role === USER_ROLES.OWNER) {
      targetRestaurantId =
        currentUser.restaurantId !== undefined
          ? String(currentUser.restaurantId)
          : undefined;
    } else if (restaurantId) {
      targetRestaurantId = restaurantId;
    }

    const results = await this.userService.searchUsers(
      query,
      targetRestaurantId,
      limit,
    );

    return results.map((user: UserRecord) => this.formatUser(user));
  }
}
