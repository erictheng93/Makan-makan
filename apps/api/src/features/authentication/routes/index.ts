/**
 * Authentication Routes
 * HTTP routes for authentication feature
 *
 * Uses factory pattern to allow dependency injection for testing.
 * The factory pattern solves the Vitest mock hoisting issue where
 * middleware is bound at module load time before mocks are applied.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Context, Next } from "hono";
import type { Env } from "../../../shared/types";
import { HTTP_STATUS } from "../../../shared/constants";
import type { UserRole } from "../../../shared/constants";
import {
  authMiddleware as defaultAuthMiddleware,
  customerAuthMiddleware,
  blacklistToken as defaultBlacklistToken,
  requireRole as defaultRequireRole,
} from "../../../shared/middleware";
import { ConsoleLogger } from "../../../core/monitoring";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../middleware/validation";
import { unauthorized } from "../../../shared/utils/api-error";

// Import service and validation schemas
import { AuthService as DefaultAuthService } from "../services/AuthService";
import { authSchemas } from "../schemas/validation";
import type {
  LoginData,
  RegisterData,
  DeviceInfo,
  LocationInfo,
  IAuthService,
} from "../types";

// Create feature logger
const _logger = new ConsoleLogger("auth-routes");

/**
 * Middleware type definitions for dependency injection
 */
export type AuthMiddleware = (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => Promise<Response | void>;
export type RequireRoleFactory = (roles: number[]) => AuthMiddleware;
export type BlacklistTokenFn = (
  c: Context<{ Bindings: Env }>,
  token: string,
  expiryTime?: number,
) => Promise<void>;

/**
 * Service factory type for dependency injection
 */
export type AuthServiceFactory = (env: Env) => IAuthService;

/**
 * Dependencies that can be injected for testing
 */
export interface AuthRouteDependencies {
  authMiddleware?: AuthMiddleware;
  requireRole?: RequireRoleFactory;
  blacklistToken?: BlacklistTokenFn;
  AuthService?: AuthServiceFactory;
}

// Helper function to extract device and location info from request
function extractRequestInfo(c: Context<{ Bindings: Env }>): {
  deviceInfo: DeviceInfo;
  location: LocationInfo;
} {
  const userAgent = c.req.header("User-Agent");
  const cfConnectingIp = c.req.header("CF-Connecting-IP");
  const cfIpCountry = c.req.header("CF-IPCountry");

  const deviceInfo: DeviceInfo = {
    userAgent,
    ipAddress: cfConnectingIp,
    platform: userAgent?.includes("Mobile") ? "mobile" : "desktop",
  };

  const location: LocationInfo = {
    country: cfIpCountry,
  };

  return { deviceInfo, location };
}

/**
 * Factory function to create auth routes with injectable dependencies.
 * This allows tests to inject mock middleware and services.
 *
 * @param deps - Optional dependencies to inject (middleware, services)
 * @returns Configured Hono router for authentication routes
 */
export function createAuthRoutes(
  deps: AuthRouteDependencies = {},
): Hono<{ Bindings: Env }> {
  // Use injected dependencies or defaults
  const authMiddleware = deps.authMiddleware ?? defaultAuthMiddleware;
  const requireRole = deps.requireRole ?? defaultRequireRole;
  const blacklistToken = deps.blacklistToken ?? defaultBlacklistToken;
  const AuthService =
    deps.AuthService ?? ((env: Env) => new DefaultAuthService(env));

  // Create router
  const authRoutes = new Hono<{ Bindings: Env }>();

  // User Login - POST /login
  authRoutes.post("/login", validateBody(authSchemas.login), async (c) => {
    const requestData = c.get("validatedBody");
    const { deviceInfo, location } = extractRequestInfo(c);

    // Transform request data to LoginData format
    const loginData: LoginData = {
      username: requestData.username,
      password: requestData.password,
      deviceInfo,
      location,
    };

    // Initialize auth service
    const authService = AuthService(c.env);
    const result = await authService.login(loginData);

    if (!result.success) {
      const message = result.error || "Authentication failed";
      const code = message.toLowerCase().includes("locked")
        ? "ACCOUNT_LOCKED"
        : "INVALID_CREDENTIALS";
      throw unauthorized(message, code);
    }

    return c.json(
      {
        success: true,
        data: {
          token: result.tokens?.accessToken,
          refreshToken: result.tokens?.refreshToken,
          expiresAt: result.tokens?.expiresAt,
          user: result.user,
        },
      },
      HTTP_STATUS.OK,
    );
  });

  // Public Customer Registration - POST /register (for customers only)
  authRoutes.post(
    "/register",
    validateBody(authSchemas.customerRegister),
    async (c) => {
      const requestData = c.get("validatedBody");
      // Device info and location tracking can be added in future if needed

      // Transform request data to RegisterData format
      const registerData: RegisterData = {
        username: requestData.username,
        fullName: requestData.fullName,
        email: requestData.email,
        phone: requestData.phone,
        password: requestData.password,
        role: 5 as UserRole, // Always customer role for public registration
        restaurantId: undefined, // Customers are not associated with specific restaurants
      };

      // Initialize auth service
      const authService = AuthService(c.env);
      const result = await authService.register(registerData, undefined);

      if (!result.success) {
        const statusCode = result.error?.includes("already exists")
          ? HTTP_STATUS.CONFLICT
          : HTTP_STATUS.BAD_REQUEST;
        return c.json(
          {
            success: false,
            error: result.error,
          },
          statusCode,
        );
      }

      // Auto-login after registration
      return c.json(
        {
          success: true,
          data: {
            user: result.user,
            tokens: result.tokens,
          },
        },
        HTTP_STATUS.CREATED,
      );
    },
  );

  // Staff Registration - POST /register-staff (admin/owner only)
  authRoutes.post(
    "/register-staff",
    authMiddleware,
    validateBody(authSchemas.register),
    async (c) => {
      const currentUser = c.get("user");

      // Only admin or shop owner can register new staff users
      if (currentUser.role !== 0 && currentUser.role !== 1) {
        return c.json(
          {
            success: false,
            error: "Insufficient permissions",
          },
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const requestData = c.get("validatedBody");

      // Validate role permissions
      if (currentUser.role === 1 && requestData.role < 2) {
        return c.json(
          {
            success: false,
            error: "Shop owners can only create staff accounts",
          },
          HTTP_STATUS.FORBIDDEN,
        );
      }

      // Transform request data to RegisterData format
      const registerData: RegisterData = {
        username: requestData.username,
        fullName: requestData.fullName,
        email: requestData.email,
        phone: requestData.phone,
        password: requestData.password,
        role: requestData.role as UserRole,
        restaurantId: requestData.restaurantId,
      };

      // Initialize auth service
      const authService = AuthService(c.env);
      const result = await authService.register(registerData, currentUser.id);

      if (!result.success) {
        const statusCode = result.error?.includes("already exists")
          ? HTTP_STATUS.CONFLICT
          : HTTP_STATUS.BAD_REQUEST;
        return c.json(
          {
            success: false,
            error: result.error,
          },
          statusCode,
        );
      }

      return c.json(
        {
          success: true,
          data: result.user,
        },
        HTTP_STATUS.CREATED,
      );
    },
  );

  // Refresh Token - POST /refresh
  authRoutes.post(
    "/refresh",
    zValidator("header", authSchemas.refreshTokenHeader),
    async (c) => {
      const headers = c.req.valid("header");
      const refreshToken = headers["x-refresh-token"];

      if (!refreshToken) {
        return c.json(
          {
            success: false,
            error: "Refresh token is required",
          },
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Initialize auth service
      const authService = AuthService(c.env);
      const result = await authService.refreshToken(refreshToken);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          HTTP_STATUS.UNAUTHORIZED,
        );
      }

      return c.json(
        {
          success: true,
          data: {
            token: result.tokens?.accessToken,
            refreshToken: result.tokens?.refreshToken,
            expiresAt: result.tokens?.expiresAt,
            user: result.user,
          },
        },
        HTTP_STATUS.OK,
      );
    },
  );

  // User Logout - POST /logout
  authRoutes.post("/logout", authMiddleware, async (c) => {
    const user = c.get("user");
    const authHeader = c.req.header("Authorization");

    let token: string | undefined;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);

      // Add token to blacklist (non-critical — don't let failure stop logout)
      try {
        await blacklistToken(c, token);
      } catch {
        // Swallow blacklist errors — logout should still succeed
      }
    }

    // Initialize auth service
    const authService = AuthService(c.env);
    const success = await authService.logout(user.id, token);

    if (success) {
      return c.json(
        {
          success: true,
          message: "Logout successful",
        },
        HTTP_STATUS.OK,
      );
    } else {
      return c.json(
        {
          success: false,
          error: "Logout failed",
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  });

  // Get Current User Info - GET /me
  authRoutes.get("/me", authMiddleware, async (c) => {
    const _user = c.get("user");

    // Initialize auth service
    const authService = AuthService(c.env);

    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        {
          success: false,
          error: "Authorization token required",
        },
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const token = authHeader.substring(7);
    const validation = await authService.validateToken(token);

    if (!validation.valid) {
      return c.json(
        {
          success: false,
          error: validation.error || "Invalid token",
        },
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    return c.json(
      {
        success: true,
        data: validation.user,
      },
      HTTP_STATUS.OK,
    );
  });

  // Get User Profile - GET /profile/:id
  authRoutes.get(
    "/profile/:id",
    authMiddleware,
    validateParams(authSchemas.userIdParam),
    async (c) => {
      const currentUser = c.get("user");
      const { id: userId } = c.get("validatedParams");

      // Users can only view their own profile unless they are admin
      if (currentUser.role !== 0 && currentUser.id !== userId) {
        return c.json(
          {
            success: false,
            error: "Insufficient permissions",
          },
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const authService = AuthService(c.env);
      const profile = await authService.getUserProfile(userId);

      if (!profile) {
        return c.json(
          {
            success: false,
            error: "User not found",
          },
          HTTP_STATUS.NOT_FOUND,
        );
      }

      return c.json(
        {
          success: true,
          data: profile,
        },
        HTTP_STATUS.OK,
      );
    },
  );

  // Update User Profile - PUT /profile/:id
  authRoutes.put(
    "/profile/:id",
    authMiddleware,
    validateParams(authSchemas.userIdParam),
    validateBody(authSchemas.updateProfile),
    async (c) => {
      const currentUser = c.get("user");
      const { id: userId } = c.get("validatedParams");
      const updateData = c.get("validatedBody");

      // Users can only update their own profile unless they are admin
      if (currentUser.role !== 0 && currentUser.id !== userId) {
        return c.json(
          {
            success: false,
            error: "Insufficient permissions",
          },
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const authService = AuthService(c.env);
      const updatedUser = await authService.updateUserProfile(
        userId,
        updateData,
      );

      if (!updatedUser) {
        return c.json(
          {
            success: false,
            error: "Failed to update profile",
          },
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      return c.json(
        {
          success: true,
          data: updatedUser,
        },
        HTTP_STATUS.OK,
      );
    },
  );

  // Change Password - POST /change-password
  authRoutes.post(
    "/change-password",
    authMiddleware,
    validateBody(authSchemas.changePassword),
    async (c) => {
      const user = c.get("user");
      const { currentPassword, newPassword } = c.get("validatedBody");

      const authService = AuthService(c.env);
      const result = await authService.changePassword(
        user.id,
        currentPassword,
        newPassword,
      );

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      return c.json(
        {
          success: true,
          message: "Password changed successfully",
        },
        HTTP_STATUS.OK,
      );
    },
  );

  // Get User Sessions - GET /sessions
  authRoutes.get("/sessions", authMiddleware, async (c) => {
    const user = c.get("user");

    const authService = AuthService(c.env);
    const sessions = await authService.getUserSessions(user.id);

    return c.json(
      {
        success: true,
        data: sessions,
      },
      HTTP_STATUS.OK,
    );
  });

  // Terminate Session - DELETE /sessions/:sessionId
  authRoutes.delete(
    "/sessions/:sessionId",
    authMiddleware,
    validateParams(authSchemas.sessionIdParam),
    async (c) => {
      const user = c.get("user");
      const { sessionId } = c.get("validatedParams");

      const authService = AuthService(c.env);
      const success = await authService.terminateSession(user.id, sessionId);

      if (!success) {
        return c.json(
          {
            success: false,
            error: "Failed to terminate session",
          },
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      return c.json(
        {
          success: true,
          message: "Session terminated successfully",
        },
        HTTP_STATUS.OK,
      );
    },
  );

  // Terminate All Sessions - DELETE /sessions
  authRoutes.delete("/sessions", authMiddleware, async (c) => {
    const user = c.get("user");

    const authService = AuthService(c.env);
    const success = await authService.terminateAllSessions(user.id);

    if (!success) {
      return c.json(
        {
          success: false,
          error: "Failed to terminate sessions",
        },
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    return c.json(
      {
        success: true,
        message: "All sessions terminated successfully",
      },
      HTTP_STATUS.OK,
    );
  });

  // Forgot Password - POST /forgot-password (placeholder)
  authRoutes.post(
    "/forgot-password",
    validateBody(authSchemas.forgotPassword),
    async (c) => {
      const requestData = c.get("validatedBody");

      const authService = AuthService(c.env);
      const result = await authService.requestPasswordReset(
        requestData.email || requestData.username || "",
      );

      return c.json(
        {
          success: result.success,
          message: result.success ? "Password reset email sent" : result.error,
        },
        result.success ? HTTP_STATUS.OK : HTTP_STATUS.BAD_REQUEST,
      );
    },
  );

  // Reset Password - POST /reset-password (placeholder)
  authRoutes.post(
    "/reset-password",
    validateBody(authSchemas.resetPassword),
    async (c) => {
      const { token, newPassword } = c.get("validatedBody");

      const authService = AuthService(c.env);
      const result = await authService.resetPassword(token, newPassword);

      return c.json(
        {
          success: result.success,
          message: result.success
            ? "Password reset successfully"
            : result.error,
        },
        result.success ? HTTP_STATUS.OK : HTTP_STATUS.BAD_REQUEST,
      );
    },
  );

  // Verify Email - POST /verify-email (placeholder)
  authRoutes.post(
    "/verify-email",
    validateBody(authSchemas.verifyEmail),
    async (c) => {
      const { token } = c.get("validatedBody");

      const authService = AuthService(c.env);
      const result = await authService.verifyEmail(token);

      return c.json(
        {
          success: result.success,
          message: result.success
            ? "Email verified successfully"
            : result.error,
        },
        result.success ? HTTP_STATUS.OK : HTTP_STATUS.BAD_REQUEST,
      );
    },
  );

  // Get Authentication Statistics - GET /stats (Admin only)
  authRoutes.get(
    "/stats",
    authMiddleware,
    requireRole([0]), // Admin only
    validateQuery(authSchemas.authStatsQuery),
    async (c) => {
      const { timeRange } = c.get("validatedQuery");

      const authService = AuthService(c.env);
      const stats = await authService.getAuthStatistics(timeRange);

      return c.json(
        {
          success: true,
          data: stats,
        },
        HTTP_STATUS.OK,
      );
    },
  );

  // Get Security Events - GET /security-events (Admin only)
  authRoutes.get(
    "/security-events",
    authMiddleware,
    requireRole([0]), // Admin only
    validateQuery(authSchemas.securityEventsQuery),
    async (c) => {
      const query = c.get("validatedQuery");
      const currentUser = c.get("user");

      const authService = AuthService(c.env);
      const events = await authService.getSecurityEvents(
        currentUser.role === 0 ? undefined : currentUser.id, // Admin sees all, others see only their own
        query.limit,
      );

      return c.json(
        {
          success: true,
          data: events,
        },
        HTTP_STATUS.OK,
      );
    },
  );

  /**
   * Get guest token for shop QR ordering (no auth required)
   * POST /api/v1/auth/guest-token
   */
  authRoutes.post("/guest-token", async (c) => {
    const body = await c.req.json();
    const { restaurantId, phoneLastDigits } = body;

    // Validate inputs
    if (!restaurantId || typeof restaurantId !== "string") {
      return c.json(
        { success: false, error: "restaurantId is required" },
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (
      !phoneLastDigits ||
      typeof phoneLastDigits !== "string" ||
      !/^\d{3,4}$/.test(phoneLastDigits)
    ) {
      return c.json(
        {
          success: false,
          error: "phoneLastDigits must be 3-4 digits",
        },
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // Generate guest token
    const { generateGuestToken } =
      await import("../../../middleware/guestAuth");
    const token = generateGuestToken();

    // Store in KV with 4-hour TTL
    const tokenData = {
      restaurantId,
      phoneLastDigits,
      createdAt: Date.now(),
    };

    await c.env.CACHE_KV.put(
      `guest_token:${token}`,
      JSON.stringify(tokenData),
      { expirationTtl: 14400 },
    );

    return c.json(
      {
        success: true,
        token,
        expiresIn: 14400,
      },
      HTTP_STATUS.OK,
    );
  });

  return authRoutes;
}

// Export default routes using customer-aware auth for customer-facing endpoints.
export default createAuthRoutes({ authMiddleware: customerAuthMiddleware });
