import * as bcrypt from "bcryptjs";
import { and, asc, count, desc, eq, gte, like, ne, or, sql } from "drizzle-orm";
import { USER_ROLES, users, type UserRole } from "../schema";
import type { UserPreferences } from "@makanmasak/shared-types";
import { BaseService } from "./base";

/**
 * `last_login_at_ms`, `created_at_ms` and `updated_at_ms` are `timestamp_ms`
 * columns, so Drizzle hands them over as `Date`. `String(date)` emits the
 * engine's locale form — "Wed Aug 13 2026 22:00:00 GMT+0800 (台北標準時間)" —
 * which is neither sortable nor parseable by anything expecting the ISO-8601
 * instant these responses have always been typed as.
 *
 * `dateOfBirth` deliberately does not go through here: it is a `text` column
 * that already holds an ISO date, so it is a string on arrival.
 */
function isoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export interface CreateUserData {
  username: string;
  email?: string;
  phone?: string;
  fullName: string;
  password: string;
  role: number;
  restaurantId?: string;
  address?: string;
  dateOfBirth?: string;
  profileImageUrl?: string;
  preferences?: UserPreferences;
}

export interface UpdateUserData {
  email?: string;
  phone?: string;
  fullName?: string;
  address?: string;
  dateOfBirth?: string;
  profileImageUrl?: string;
  preferences?: UserPreferences;
  isActive?: boolean;
  isVerified?: boolean;
}

export interface UserFilters {
  restaurantId?: string;
  role?: number;
  isActive?: boolean;
  isVerified?: boolean;
  search?: string; // 搜尋用戶名或全名
  page?: number;
  limit?: number;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  byRole: Record<number, number>;
  recentRegistrations: number; // 最近30天註冊
}

export class UserService extends BaseService {
  // 創建新用戶
  async createUser(data: CreateUserData) {
    try {
      // 檢查用戶名是否已存在
      const existingUser = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, data.username))
        .get();

      if (existingUser) {
        throw new Error("Username already exists");
      }

      // 檢查 email 是否已存在（如果提供）
      if (data.email) {
        const existingEmail = await this.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, data.email))
          .get();

        if (existingEmail) {
          throw new Error("Email already exists");
        }
      }

      // 加密密碼
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(data.password, saltRounds);

      // 插入新用戶
      const [newUser] = await this.db
        .insert(users)
        .values({
          username: data.username,
          email: data.email,
          phone: data.phone,
          fullName: data.fullName,
          passwordHash,
          role: data.role,
          restaurantId: data.restaurantId,
          address: data.address,
          dateOfBirth: data.dateOfBirth,
          profileImageUrl: data.profileImageUrl,
          preferences: data.preferences,
          isActive: true,
          isVerified: false,
        })
        .returning();

      // Convert Drizzle objects to primitive values to avoid circular references
      // Also remove sensitive information (passwordHash)
      const userWithoutPassword = {
        id: String(newUser.id),
        username: String(newUser.username),
        email: newUser.email ? String(newUser.email) : null,
        phone: newUser.phone ? String(newUser.phone) : null,
        fullName: newUser.fullName ? String(newUser.fullName) : null,
        role: Number(newUser.role),
        restaurantId: newUser.restaurantId
          ? String(newUser.restaurantId)
          : null,
        address: newUser.address ? String(newUser.address) : null,
        dateOfBirth: newUser.dateOfBirth ? String(newUser.dateOfBirth) : null,
        profileImageUrl: newUser.profileImageUrl
          ? String(newUser.profileImageUrl)
          : null,
        preferences: newUser.preferences ? String(newUser.preferences) : null,
        isActive: Boolean(Number(newUser.isActive)),
        isVerified: Boolean(Number(newUser.isVerified)),
        totalOrders: newUser.totalOrders ? Number(newUser.totalOrders) : 0,
        totalSpent: newUser.totalSpent ? Number(newUser.totalSpent) : 0,
        lastLoginAt: isoOrNull(newUser.lastLoginAt),
        createdAt: isoOrNull(newUser.createdAt),
        updatedAt: isoOrNull(newUser.updatedAt),
      };

      return userWithoutPassword;
    } catch (error) {
      this.handleError(error, "createUser");
    }
  }

  // 取得用戶詳細資訊
  async getUserById(id: string) {
    try {
      const user = await this.db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          phone: users.phone,
          fullName: users.fullName,
          role: users.role,
          restaurantId: users.restaurantId,
          address: users.address,
          dateOfBirth: users.dateOfBirth,
          profileImageUrl: users.profileImageUrl,
          isActive: users.isActive,
          isVerified: users.isVerified,
          preferences: users.preferences,
          totalOrders: users.totalOrders,
          totalSpent: users.totalSpent,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, id))
        .get();

      if (!user) return null;

      // Convert Drizzle objects to primitive values to avoid circular references
      return {
        id: String(user.id),
        username: String(user.username),
        email: user.email ? String(user.email) : null,
        phone: user.phone ? String(user.phone) : null,
        fullName: user.fullName ? String(user.fullName) : null,
        role: Number(user.role),
        restaurantId: user.restaurantId ? String(user.restaurantId) : null,
        address: user.address ? String(user.address) : null,
        dateOfBirth: user.dateOfBirth ? String(user.dateOfBirth) : null,
        profileImageUrl: user.profileImageUrl
          ? String(user.profileImageUrl)
          : null,
        isActive: Boolean(Number(user.isActive)),
        isVerified: Boolean(Number(user.isVerified)),
        preferences: user.preferences ? String(user.preferences) : null,
        totalOrders: user.totalOrders ? Number(user.totalOrders) : 0,
        totalSpent: user.totalSpent ? Number(user.totalSpent) : 0,
        lastLoginAt: isoOrNull(user.lastLoginAt),
        createdAt: isoOrNull(user.createdAt),
        updatedAt: isoOrNull(user.updatedAt),
      };
    } catch (error) {
      this.handleError(error, "getUserById");
    }
  }

  // 根據用戶名取得用戶
  async getUserByUsername(username: string) {
    try {
      const user = await this.db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          phone: users.phone,
          fullName: users.fullName,
          role: users.role,
          restaurantId: users.restaurantId,
          isActive: users.isActive,
          isVerified: users.isVerified,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.username, username))
        .get();

      if (!user) return null;

      // Convert Drizzle objects to primitive values to avoid circular references
      return {
        id: String(user.id),
        username: String(user.username),
        email: user.email ? String(user.email) : null,
        phone: user.phone ? String(user.phone) : null,
        fullName: user.fullName ? String(user.fullName) : null,
        role: Number(user.role),
        restaurantId: user.restaurantId ? String(user.restaurantId) : null,
        isActive: Boolean(Number(user.isActive)),
        isVerified: Boolean(Number(user.isVerified)),
        lastLoginAt: isoOrNull(user.lastLoginAt),
        createdAt: isoOrNull(user.createdAt),
      };
    } catch (error) {
      this.handleError(error, "getUserByUsername");
    }
  }

  // 更新用戶資訊
  async updateUser(id: string, data: UpdateUserData) {
    try {
      // 檢查 email 是否已被其他用戶使用
      if (data.email) {
        const existingEmail = await this.db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, data.email), ne(users.id, id)))
          .get();

        if (existingEmail) {
          throw new Error("Email already exists");
        }
      }

      const shouldBumpTokenVersion = data.isActive === false;
      const [updatedUser] = await this.db
        .update(users)
        .set({
          ...data,
          ...(shouldBumpTokenVersion
            ? { tokenVersion: sql`${users.tokenVersion} + 1` }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          username: users.username,
          email: users.email,
          phone: users.phone,
          fullName: users.fullName,
          role: users.role,
          restaurantId: users.restaurantId,
          address: users.address,
          dateOfBirth: users.dateOfBirth,
          profileImageUrl: users.profileImageUrl,
          isActive: users.isActive,
          isVerified: users.isVerified,
          preferences: users.preferences,
          updatedAt: users.updatedAt,
        });

      return updatedUser;
    } catch (error) {
      this.handleError(error, "updateUser");
    }
  }

  // 刪除用戶（軟刪除 - 設為不活躍）
  async deleteUser(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(users)
        .set({
          isActive: false,
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({ id: users.id });

      return result.length > 0;
    } catch (error) {
      console.error("Delete user error:", error);
      return false;
    }
  }

  // 取得餐廳的所有用戶
  async getRestaurantUsers(
    restaurantId: string,
    filters: Omit<UserFilters, "restaurantId"> = {},
  ) {
    try {
      const {
        page = 1,
        limit = 20,
        role,
        isActive,
        isVerified,
        search,
      } = filters;
      const { offset } = this.createPagination(page, limit);

      // 建構查詢條件
      const conditions = [eq(users.restaurantId, restaurantId)];

      if (role !== undefined) {
        conditions.push(eq(users.role, role));
      }

      if (isActive !== undefined) {
        conditions.push(eq(users.isActive, isActive));
      }

      if (isVerified !== undefined) {
        conditions.push(eq(users.isVerified, isVerified));
      }

      if (search) {
        conditions.push(
          or(
            like(users.username, `%${search}%`),
            like(users.fullName, `%${search}%`),
            like(users.email, `%${search}%`),
          )!,
        );
      }

      // 查詢用戶列表
      const usersList = await this.db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          phone: users.phone,
          fullName: users.fullName,
          role: users.role,
          restaurantId: users.restaurantId,
          isActive: users.isActive,
          isVerified: users.isVerified,
          totalOrders: users.totalOrders,
          totalSpent: users.totalSpent,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(and(...conditions))
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      // 計算總數 (使用安全解構避免 undefined 錯誤)
      const countResult = await this.db
        .select({ total: count() })
        .from(users)
        .where(and(...conditions));

      const total = countResult?.[0]?.total ?? 0;
      const totalPages = Math.ceil(total / limit);

      // Convert Drizzle objects to primitive values
      const serializedUsers = usersList.map((user) => ({
        id: String(user.id),
        username: String(user.username),
        email: user.email ? String(user.email) : null,
        phone: user.phone ? String(user.phone) : null,
        fullName: user.fullName ? String(user.fullName) : null,
        role: Number(user.role),
        restaurantId: user.restaurantId ? String(user.restaurantId) : null,
        isActive: Boolean(Number(user.isActive)),
        isVerified: Boolean(Number(user.isVerified)),
        totalOrders: user.totalOrders ? Number(user.totalOrders) : 0,
        totalSpent: user.totalSpent ? Number(user.totalSpent) : 0,
        lastLoginAt: isoOrNull(user.lastLoginAt),
        createdAt: isoOrNull(user.createdAt),
        updatedAt: isoOrNull(user.updatedAt),
      }));

      return {
        users: serializedUsers,
        total,
        pagination: { page, limit, totalPages },
      };
    } catch (error) {
      this.handleError(error, "getRestaurantUsers");
    }
  }

  // 取得系統中所有用戶（管理員功能）
  async getAllUsers(filters: UserFilters = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        restaurantId,
        role,
        isActive,
        isVerified,
        search,
      } = filters;
      const { offset } = this.createPagination(page, limit);

      // 建構查詢條件
      const conditions = [];

      if (restaurantId) {
        conditions.push(eq(users.restaurantId, restaurantId));
      }

      if (role !== undefined) {
        conditions.push(eq(users.role, role));
      }

      if (isActive !== undefined) {
        conditions.push(eq(users.isActive, isActive));
      }

      if (isVerified !== undefined) {
        conditions.push(eq(users.isVerified, isVerified));
      }

      if (search) {
        conditions.push(
          or(
            like(users.username, `%${search}%`),
            like(users.fullName, `%${search}%`),
            like(users.email, `%${search}%`),
          ),
        );
      }

      // 查詢用戶列表
      const usersList = await this.db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          phone: users.phone,
          fullName: users.fullName,
          role: users.role,
          restaurantId: users.restaurantId,
          isActive: users.isActive,
          isVerified: users.isVerified,
          totalOrders: users.totalOrders,
          totalSpent: users.totalSpent,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      // 計算總數 (使用安全解構避免 undefined 錯誤)
      const countResult = await this.db
        .select({ total: count() })
        .from(users)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = countResult?.[0]?.total ?? 0;
      const totalPages = Math.ceil(total / limit);

      // Convert Drizzle objects to primitive values
      const serializedUsers = usersList.map((user) => ({
        id: String(user.id),
        username: String(user.username),
        email: user.email ? String(user.email) : null,
        phone: user.phone ? String(user.phone) : null,
        fullName: user.fullName ? String(user.fullName) : null,
        role: Number(user.role),
        restaurantId: user.restaurantId ? String(user.restaurantId) : null,
        isActive: Boolean(Number(user.isActive)),
        isVerified: Boolean(Number(user.isVerified)),
        totalOrders: user.totalOrders ? Number(user.totalOrders) : 0,
        totalSpent: user.totalSpent ? Number(user.totalSpent) : 0,
        lastLoginAt: isoOrNull(user.lastLoginAt),
        createdAt: isoOrNull(user.createdAt),
        updatedAt: isoOrNull(user.updatedAt),
      }));

      return {
        users: serializedUsers,
        total,
        pagination: { page, limit, totalPages },
      };
    } catch (error) {
      this.handleError(error, "getAllUsers");
    }
  }

  // 更新用戶角色
  async updateUserRole(id: string, role: number, _updatedBy: string) {
    try {
      // 驗證角色是否有效
      const validRoles = Object.values(USER_ROLES);
      if (!validRoles.includes(role as UserRole)) {
        throw new Error("Invalid role");
      }

      const [updatedUser] = await this.db
        .update(users)
        .set({
          role,
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          role: users.role,
          updatedAt: users.updatedAt,
        });

      return updatedUser;
    } catch (error) {
      this.handleError(error, "updateUserRole");
    }
  }

  // 驗證用戶
  async verifyUser(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(users)
        .set({
          isVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({ id: users.id });

      return result.length > 0;
    } catch (error) {
      console.error("Verify user error:", error);
      return false;
    }
  }

  // 重設密碼
  async resetPassword(id: string, newPassword: string): Promise<boolean> {
    try {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      const result = await this.db
        .update(users)
        .set({
          passwordHash,
          passwordChangedAt: new Date(),
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({ id: users.id });

      return result.length > 0;
    } catch (error) {
      console.error("Reset password error:", error);
      return false;
    }
  }

  // 更新用戶統計資訊（訂單數量和消費金額）
  async updateUserStats(
    userId: string,
    orderCount: number,
    orderAmount: number,
  ): Promise<void> {
    try {
      await this.db
        .update(users)
        .set({
          totalOrders: orderCount,
          totalSpent: orderAmount,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } catch (error) {
      this.handleError(error, "updateUserStats");
    }
  }

  // 取得用戶統計資訊
  async getUserStats(restaurantId?: string): Promise<UserStats> {
    try {
      const conditions = restaurantId
        ? [eq(users.restaurantId, restaurantId)]
        : [];
      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        totalUsersResult,
        activeUsersResult,
        roleStats,
        recentRegistrationsResult,
      ] = await Promise.all([
        this.db.select({ totalUsers: count() }).from(users).where(whereClause),
        this.db
          .select({ activeUsers: count() })
          .from(users)
          .where(and(...conditions, eq(users.isActive, true))),
        this.db
          .select({ role: users.role, count: count() })
          .from(users)
          .where(whereClause)
          .groupBy(users.role),
        this.db
          .select({ recentRegistrations: count() })
          .from(users)
          .where(and(...conditions, gte(users.createdAt, thirtyDaysAgo))),
      ]);

      const totalUsers = totalUsersResult?.[0]?.totalUsers ?? 0;
      const activeUsers = activeUsersResult?.[0]?.activeUsers ?? 0;
      const recentRegistrations =
        recentRegistrationsResult?.[0]?.recentRegistrations ?? 0;

      const byRole: Record<number, number> = {};
      for (const stat of roleStats) {
        byRole[Number(stat.role)] = Number(stat.count);
      }

      return {
        totalUsers,
        activeUsers,
        byRole,
        recentRegistrations,
      };
    } catch (error) {
      this.handleError(error, "getUserStats");
    }
  }

  // 搜尋用戶
  async searchUsers(query: string, restaurantId?: string, limit = 10) {
    try {
      const conditions = [
        or(
          like(users.username, `%${query}%`),
          like(users.fullName, `%${query}%`),
          like(users.email, `%${query}%`),
        ),
      ];

      if (restaurantId) {
        conditions.push(eq(users.restaurantId, restaurantId));
      }

      const results = await this.db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          profileImageUrl: users.profileImageUrl,
          // Search results run through the same formatter as the list
          // endpoints, which reads these. Leaving them out published
          // `isActive: undefined` on every hit.
          restaurantId: users.restaurantId,
          isActive: users.isActive,
          isVerified: users.isVerified,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(and(...conditions))
        .orderBy(asc(users.fullName))
        .limit(limit);

      // Convert Drizzle objects to primitive values
      return results.map((user) => ({
        id: String(user.id),
        username: String(user.username),
        fullName: user.fullName ? String(user.fullName) : null,
        email: user.email ? String(user.email) : null,
        role: Number(user.role),
        profileImageUrl: user.profileImageUrl
          ? String(user.profileImageUrl)
          : null,
        restaurantId: user.restaurantId ? String(user.restaurantId) : null,
        isActive: Boolean(Number(user.isActive)),
        isVerified: Boolean(Number(user.isVerified)),
        createdAt: isoOrNull(user.createdAt),
        updatedAt: isoOrNull(user.updatedAt),
      }));
    } catch (error) {
      this.handleError(error, "searchUsers");
    }
  }

  // 取得特定角色的用戶
  async getUsersByRole(role: number, restaurantId?: string) {
    try {
      const conditions = [eq(users.role, role), eq(users.isActive, true)];

      if (restaurantId) {
        conditions.push(eq(users.restaurantId, restaurantId));
      }

      const results = await this.db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          role: users.role,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(and(...conditions))
        .orderBy(asc(users.fullName));

      // Convert Drizzle objects to primitive values
      return results.map((user) => ({
        id: String(user.id),
        username: String(user.username),
        fullName: user.fullName ? String(user.fullName) : null,
        email: user.email ? String(user.email) : null,
        phone: user.phone ? String(user.phone) : null,
        role: Number(user.role),
        lastLoginAt: isoOrNull(user.lastLoginAt),
        createdAt: isoOrNull(user.createdAt),
      }));
    } catch (error) {
      this.handleError(error, "getUsersByRole");
    }
  }
}
