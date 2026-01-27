/**
 * Authentication Service
 * Business logic for authentication feature
 */

import type { Env } from "../../../shared/types";
import { getDatabaseConnection } from "../../../core/database";
import { KVCacheService } from "../../../core/cache";
import {
  ConsoleLogger,
  SimplePerformanceTracker,
} from "../../../core/monitoring";
import { CACHE_TTL, USER_ROLES } from "../../../shared/constants";
import type { UserRole } from "../../../shared/constants";
import { AuthService as DatabaseAuthService } from "@makanmakan/database";

// Import types
import type {
  AuthUser,
  AuthResult,
  LoginData,
  RegisterData,
  TokenValidation,
  UserProfile,
  SessionSummary,
  TwoFactorBackupCodes,
  SecurityEvent,
  AccountSecurity,
  AuthStatistics,
  IAuthService,
} from "../types";

export class AuthService implements IAuthService {
  private db: ReturnType<typeof getDatabaseConnection>;
  private dbAuthService: DatabaseAuthService;
  private cache: KVCacheService;
  private logger: ConsoleLogger;
  private performance: SimplePerformanceTracker;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.db = getDatabaseConnection(env);
    this.dbAuthService = new DatabaseAuthService(env.DB, env);
    this.cache = new KVCacheService(env.CACHE_KV);
    this.logger = new ConsoleLogger("auth-service");
    this.performance = new SimplePerformanceTracker();
  }

  // Core Authentication Methods
  async login(data: LoginData): Promise<AuthResult> {
    const timer = this.performance.startTimer("auth.login");

    try {
      // Rate limiting check
      await this.checkRateLimit(
        data.deviceInfo?.ipAddress || "unknown",
        "login",
      );

      // Call the existing DatabaseAuthService
      const dbResult = await this.dbAuthService.login(data);

      // Transform database result to match our interface
      const result: AuthResult = {
        success: dbResult.success,
        user: dbResult.user
          ? {
              ...dbResult.user,
              role: dbResult.user.role as UserRole,
              restaurantId: dbResult.user.restaurantId || undefined, // Keep as string
              isVerified: false, // Would need to be fetched from database
              twoFactorEnabled: false, // Would need to be fetched from database
              createdAt: new Date(), // Would need to be fetched from database
              updatedAt: new Date(), // Would need to be fetched from database
            }
          : undefined,
        tokens: dbResult.tokens
          ? {
              ...dbResult.tokens,
              expiresIn: Math.floor(
                (dbResult.tokens.expiresAt.getTime() - Date.now()) / 1000,
              ),
            }
          : undefined,
        error: dbResult.error,
      };

      if (result.success && result.user && result.tokens) {
        // Cache user session information
        await this.cacheUserSession(result.user.id, result.tokens.accessToken);

        // Log security event
        await this.logSecurityEvent({
          type: "LOGIN",
          userId: result.user.id,
          username: result.user.username,
          ipAddress: data.deviceInfo?.ipAddress,
          userAgent: data.deviceInfo?.userAgent,
          location: data.location,
          severity: "LOW",
        });

        // Clear any previous failed login attempts
        await this.clearFailedLoginAttempts(result.user.username);

        this.logger.info("User login successful", {
          userId: result.user.id,
          username: result.user.username,
          role: result.user.role,
        });

        this.performance.recordMetric("auth.login.success", 1);
      } else {
        // Log failed login attempt
        await this.logFailedLoginAttempt(
          data.username,
          data.deviceInfo?.ipAddress,
        );

        await this.logSecurityEvent({
          type: "LOGIN_FAILED",
          username: data.username,
          ipAddress: data.deviceInfo?.ipAddress,
          userAgent: data.deviceInfo?.userAgent,
          location: data.location,
          severity: "MEDIUM",
        });

        this.performance.recordMetric("auth.login.failed", 1);
      }

      return result;
    } catch (error) {
      this.logger.error("Login failed", error as Error, {
        username: data.username,
      });
      this.performance.recordMetric("auth.login.error", 1);

      // Log security event for system errors
      await this.logSecurityEvent({
        type: "LOGIN_FAILED",
        username: data.username,
        ipAddress: data.deviceInfo?.ipAddress,
        metadata: { error: (error as Error).message },
        severity: "HIGH",
      });

      throw error;
    } finally {
      const duration = this.performance.endTimer(timer);
      this.performance.recordMetric("auth.login.duration", duration, "ms");
    }
  }

  async register(data: RegisterData, createdBy?: number): Promise<AuthResult> {
    const timer = this.performance.startTimer("auth.register");

    try {
      // Validate role permissions
      if (createdBy) {
        await this.validateRoleCreationPermissions(createdBy, data.role);
      }

      // Call the existing DatabaseAuthService
      const dbRegisterData = {
        ...data,
        restaurantId: data.restaurantId || undefined,
      };
      const dbResult = await this.dbAuthService.register(dbRegisterData);

      // Transform database result to match our interface
      const result: AuthResult = {
        success: dbResult.success,
        user: dbResult.user
          ? {
              ...dbResult.user,
              role: dbResult.user.role as UserRole,
              restaurantId: dbResult.user.restaurantId || undefined, // Keep as string
              email: data.email,
              phone: data.phone,
              isVerified: false,
              twoFactorEnabled: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : undefined,
        tokens: dbResult.tokens
          ? {
              ...dbResult.tokens,
              expiresIn: Math.floor(
                (dbResult.tokens.expiresAt.getTime() - Date.now()) / 1000,
              ),
            }
          : undefined,
        error: dbResult.error,
      };

      if (result.success && result.user) {
        // Would log security event for user registration
        // Note: 'USER_REGISTERED' is not in the SecurityEvent type enum
        // This is a placeholder for future implementation

        // Clear registration cache
        await this.cache.delete(`user:${result.user.username}`);

        this.logger.info("User registration successful", {
          userId: result.user.id,
          username: result.user.username,
          role: result.user.role,
          createdBy,
        });

        this.performance.recordMetric("auth.register.success", 1);
      } else {
        this.performance.recordMetric("auth.register.failed", 1);
      }

      return result;
    } catch (error) {
      this.logger.error("Registration failed", error as Error, {
        username: data.username,
      });
      this.performance.recordMetric("auth.register.error", 1);
      throw error;
    } finally {
      const duration = this.performance.endTimer(timer);
      this.performance.recordMetric("auth.register.duration", duration, "ms");
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    const timer = this.performance.startTimer("auth.refreshToken");

    try {
      // Call the existing DatabaseAuthService
      const dbResult = await this.dbAuthService.refreshToken(refreshToken);

      // Transform database result to match our interface
      const result: AuthResult = {
        success: dbResult.success,
        user: dbResult.user
          ? {
              ...dbResult.user,
              role: dbResult.user.role as UserRole,
              restaurantId: dbResult.user.restaurantId || undefined, // Keep as string
              isVerified: false,
              twoFactorEnabled: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : undefined,
        tokens: dbResult.tokens
          ? {
              ...dbResult.tokens,
              expiresIn: Math.floor(
                (dbResult.tokens.expiresAt.getTime() - Date.now()) / 1000,
              ),
            }
          : undefined,
        error: dbResult.error,
      };

      if (result.success && result.user && result.tokens) {
        // Update cached session
        await this.cacheUserSession(result.user.id, result.tokens.accessToken);

        this.logger.debug("Token refresh successful", {
          userId: result.user.id,
        });
        this.performance.recordMetric("auth.refreshToken.success", 1);
      } else {
        this.performance.recordMetric("auth.refreshToken.failed", 1);
      }

      return result;
    } catch (error) {
      this.logger.error("Token refresh failed", error as Error);
      this.performance.recordMetric("auth.refreshToken.error", 1);
      throw error;
    } finally {
      const duration = this.performance.endTimer(timer);
      this.performance.recordMetric(
        "auth.refreshToken.duration",
        duration,
        "ms",
      );
    }
  }

  async logout(
    userId: number,
    token?: string,
    allSessions?: boolean,
  ): Promise<boolean> {
    const timer = this.performance.startTimer("auth.logout");

    try {
      // Call the existing DatabaseAuthService
      const success = await this.dbAuthService.logout(userId, token);

      if (success) {
        // Clear cached sessions
        if (allSessions) {
          await this.cache.clear(`user-session:${userId}`);
        } else if (token) {
          await this.cache.delete(`token:${token}`);
        }

        // Log security event
        await this.logSecurityEvent({
          type: "LOGOUT",
          userId,
          metadata: { allSessions },
          severity: "LOW",
        });

        this.logger.info("User logout successful", { userId, allSessions });
        this.performance.recordMetric("auth.logout.success", 1);
      } else {
        this.performance.recordMetric("auth.logout.failed", 1);
      }

      return success;
    } catch (error) {
      this.logger.error("Logout failed", error as Error, { userId });
      this.performance.recordMetric("auth.logout.error", 1);
      return false;
    } finally {
      const duration = this.performance.endTimer(timer);
      this.performance.recordMetric("auth.logout.duration", duration, "ms");
    }
  }

  async validateToken(token: string): Promise<TokenValidation> {
    const timer = this.performance.startTimer("auth.validateToken");

    try {
      // Check cache first - handle cache errors gracefully
      const cacheKey = `token-validation:${token}`;
      let cached: TokenValidation | null = null;

      try {
        cached = await this.cache.get<TokenValidation>(cacheKey);
        if (cached) {
          this.logger.debug("Token validation retrieved from cache");
          return cached;
        }
      } catch (cacheError) {
        this.logger.warn("Cache retrieval failed, falling back to database", {
          error: (cacheError as Error).message,
        });
      }

      // Call the existing DatabaseAuthService
      const result = await this.dbAuthService.validateToken(token);

      // Transform result to match our interface
      const validation: TokenValidation = {
        valid: result.valid,
        user: result.user
          ? {
              id: result.user.id,
              username: result.user.username,
              fullName: result.user.fullName,
              role: result.user.role,
              restaurantId: result.user.restaurantId,
              isActive: result.user.isActive,
              isVerified: false, // Would need to be fetched from user record
              twoFactorEnabled: false, // Would need to be fetched from user record
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : undefined,
        error: result.error,
      };

      // Cache the result for a short time - handle cache errors gracefully
      if (validation.valid) {
        try {
          await this.cache.set(cacheKey, validation, CACHE_TTL.SHORT);
        } catch (cacheError) {
          this.logger.warn("Cache storage failed, but validation succeeded", {
            error: (cacheError as Error).message,
          });
        }
      }

      this.performance.recordMetric("auth.validateToken.success", 1);
      return validation;
    } catch (error) {
      this.logger.error("Token validation failed", error as Error);
      this.performance.recordMetric("auth.validateToken.error", 1);

      return {
        valid: false,
        error: "Token validation failed",
      };
    } finally {
      const duration = this.performance.endTimer(timer);
      this.performance.recordMetric(
        "auth.validateToken.duration",
        duration,
        "ms",
      );
    }
  }

  // User Management Methods
  async getUserProfile(userId: number): Promise<UserProfile | null> {
    const timer = this.performance.startTimer("auth.getUserProfile");

    try {
      // Try cache first
      const cacheKey = `user-profile:${userId}`;
      const cached = await this.cache.get<UserProfile>(cacheKey);

      if (cached) {
        this.logger.debug("User profile retrieved from cache", { userId });
        return cached;
      }

      // Get user sessions
      const sessions = await this.getUserSessions(userId);

      // This would need to be implemented with proper user fetching from database
      // For now, return a mock profile structure
      const profile: UserProfile = {
        id: userId,
        username: "placeholder",
        fullName: "Placeholder User",
        role: USER_ROLES.CHEF,
        isActive: true,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        twoFactorEnabled: false,
        sessions,
      };

      // Cache the result
      await this.cache.set(cacheKey, profile, CACHE_TTL.MEDIUM);

      this.performance.recordMetric("auth.getUserProfile.success", 1);
      return profile;
    } catch (error) {
      this.logger.error("Failed to get user profile", error as Error, {
        userId,
      });
      this.performance.recordMetric("auth.getUserProfile.error", 1);
      return null;
    } finally {
      const duration = this.performance.endTimer(timer);
      this.performance.recordMetric(
        "auth.getUserProfile.duration",
        duration,
        "ms",
      );
    }
  }

  async updateUserProfile(
    userId: number,
    data: Partial<AuthUser>,
  ): Promise<AuthUser | null> {
    const timer = this.performance.startTimer("auth.updateUserProfile");

    try {
      // This would need to be implemented with proper user updating in database
      // For now, return null to indicate not implemented
      this.logger.warn("updateUserProfile not fully implemented", {
        userId,
        data,
      });

      // Clear user cache
      await this.cache.delete(`user-profile:${userId}`);
      await this.cache.delete(`user:${userId}`);

      return null;
    } catch (error) {
      this.logger.error("Failed to update user profile", error as Error, {
        userId,
      });
      this.performance.recordMetric("auth.updateUserProfile.error", 1);
      return null;
    } finally {
      const duration = this.performance.endTimer(timer);
      this.performance.recordMetric(
        "auth.updateUserProfile.duration",
        duration,
        "ms",
      );
    }
  }

  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    const timer = this.performance.startTimer("auth.changePassword");

    try {
      // Call the existing DatabaseAuthService
      const result = await this.dbAuthService.changePassword(
        userId,
        oldPassword,
        newPassword,
      );

      if (result.success) {
        // Log security event
        await this.logSecurityEvent({
          type: "PASSWORD_CHANGED",
          userId,
          severity: "MEDIUM",
        });

        // Clear user caches
        await this.cache.delete(`user-profile:${userId}`);
        await this.cache.clear(`user-session:${userId}`);

        this.logger.info("Password change successful", { userId });
        this.performance.recordMetric("auth.changePassword.success", 1);
      } else {
        this.performance.recordMetric("auth.changePassword.failed", 1);
      }

      return result;
    } catch (error) {
      this.logger.error("Password change failed", error as Error, { userId });
      this.performance.recordMetric("auth.changePassword.error", 1);
      return {
        success: false,
        error: "Failed to change password",
      };
    } finally {
      const duration = this.performance.endTimer(timer);
      this.performance.recordMetric(
        "auth.changePassword.duration",
        duration,
        "ms",
      );
    }
  }

  // Session Management Methods
  async getUserSessions(userId: number): Promise<SessionSummary[]> {
    const timer = this.performance.startTimer("auth.getUserSessions");

    try {
      // Call the existing DatabaseAuthService
      const sessions = await this.dbAuthService.getUserSessions(userId);

      // Transform to match our interface
      const sessionSummaries: SessionSummary[] = sessions.map(
        (session: any) => ({
          id: session.id,
          deviceInfo: session.deviceInfo,
          location: session.location,
          lastAccessedAt: session.lastAccessedAt
            ? new Date(session.lastAccessedAt)
            : undefined,
          expiresAt: new Date(session.expiresAt),
          isCurrent: false, // Would need to be determined based on current request
          createdAt: new Date(session.createdAt),
        }),
      );

      this.performance.recordMetric("auth.getUserSessions.success", 1);
      return sessionSummaries;
    } catch (error) {
      this.logger.error("Failed to get user sessions", error as Error, {
        userId,
      });
      this.performance.recordMetric("auth.getUserSessions.error", 1);
      return [];
    } finally {
      const duration = this.performance.endTimer(timer);
      this.performance.recordMetric(
        "auth.getUserSessions.duration",
        duration,
        "ms",
      );
    }
  }

  async terminateSession(userId: number, sessionId: string): Promise<boolean> {
    const timer = this.performance.startTimer("auth.terminateSession");

    try {
      // This would need to be implemented in the database service
      // For now, return false to indicate not implemented
      this.logger.warn("terminateSession not fully implemented", {
        userId,
        sessionId,
      });
      return false;
    } catch (error) {
      this.logger.error("Failed to terminate session", error as Error, {
        userId,
        sessionId,
      });
      this.performance.recordMetric("auth.terminateSession.error", 1);
      return false;
    } finally {
      const duration = this.performance.endTimer(timer);
      this.performance.recordMetric(
        "auth.terminateSession.duration",
        duration,
        "ms",
      );
    }
  }

  async terminateAllSessions(userId: number): Promise<boolean> {
    const timer = this.performance.startTimer("auth.terminateAllSessions");

    try {
      // Call logout with no specific token to terminate all sessions
      const result = await this.logout(userId, undefined, true);

      this.performance.recordMetric("auth.terminateAllSessions.success", 1);
      return result;
    } catch (error) {
      this.logger.error("Failed to terminate all sessions", error as Error, {
        userId,
      });
      this.performance.recordMetric("auth.terminateAllSessions.error", 1);
      return false;
    } finally {
      const duration = this.performance.endTimer(timer);
      this.performance.recordMetric(
        "auth.terminateAllSessions.duration",
        duration,
        "ms",
      );
    }
  }

  // Two-Factor Authentication Methods (Placeholder implementations)
  async setupTwoFactor(
    userId: number,
    _password: string,
  ): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    this.logger.warn("setupTwoFactor not implemented", { userId });
    throw new Error("Two-factor authentication not yet implemented");
  }

  async verifyTwoFactor(
    userId: number,
    _token: string,
    _backupCode?: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.warn("verifyTwoFactor not implemented", { userId });
    return {
      success: false,
      error: "Two-factor authentication not yet implemented",
    };
  }

  async disableTwoFactor(
    userId: number,
    _password: string,
    _token?: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.warn("disableTwoFactor not implemented", { userId });
    return {
      success: false,
      error: "Two-factor authentication not yet implemented",
    };
  }

  async generateBackupCodes(userId: number): Promise<TwoFactorBackupCodes> {
    this.logger.warn("generateBackupCodes not implemented", { userId });
    throw new Error("Two-factor authentication not yet implemented");
  }

  // Password Reset Methods (Placeholder implementations)
  async requestPasswordReset(
    identifier: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.warn("requestPasswordReset not implemented", { identifier });
    return { success: false, error: "Password reset not yet implemented" };
  }

  async resetPassword(
    _token: string,
    _newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.warn("resetPassword not implemented");
    return { success: false, error: "Password reset not yet implemented" };
  }

  // Email Verification Methods (Placeholder implementations)
  async requestEmailVerification(
    userId: number,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.warn("requestEmailVerification not implemented", { userId });
    return { success: false, error: "Email verification not yet implemented" };
  }

  async verifyEmail(
    _token: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.warn("verifyEmail not implemented");
    return { success: false, error: "Email verification not yet implemented" };
  }

  // Security and Monitoring Methods
  async logSecurityEvent(
    event: Omit<SecurityEvent, "timestamp">,
  ): Promise<void> {
    try {
      const securityEvent: SecurityEvent = {
        ...event,
        timestamp: new Date(),
      };

      // Store in cache for quick access
      const eventKey = `security-event:${Date.now()}`;
      await this.cache.set(eventKey, securityEvent, CACHE_TTL.LONG);

      this.logger.info("Security event logged", {
        type: securityEvent.type,
        userId: securityEvent.userId,
        severity: securityEvent.severity,
        timestamp: securityEvent.timestamp.toISOString(),
      });
    } catch (error) {
      this.logger.error("Failed to log security event", error as Error, {
        event,
      });
    }
  }

  async getSecurityEvents(
    userId?: number,
    limit = 50,
  ): Promise<SecurityEvent[]> {
    this.logger.warn("getSecurityEvents not fully implemented", {
      userId,
      limit,
    });
    return [];
  }

  async checkAccountSecurity(userId: number): Promise<AccountSecurity> {
    this.logger.warn("checkAccountSecurity not implemented", { userId });
    return {
      failedLoginAttempts: 0,
      passwordStrength: "MEDIUM",
      suspiciousActivity: false,
    };
  }

  async getAuthStatistics(timeRange = "30d"): Promise<AuthStatistics> {
    this.logger.warn("getAuthStatistics not implemented", { timeRange });
    return {
      totalUsers: 0,
      activeUsers: 0,
      dailyLogins: 0,
      uniqueDevices: 0,
      topCountries: [],
      platformDistribution: {},
      twoFactorAdoptionRate: 0,
      recentSecurityEvents: [],
    };
  }

  // Private Helper Methods
  private async validateRoleCreationPermissions(
    creatorId: number,
    targetRole: number,
  ): Promise<void> {
    // Implementation would check if creator has permission to create users with target role
    // For now, just log the check
    this.logger.debug("Role creation permission check", {
      creatorId,
      targetRole,
    });
  }

  private async cacheUserSession(userId: number, token: string): Promise<void> {
    try {
      const sessionKey = `user-session:${userId}:${token}`;
      await this.cache.set(
        sessionKey,
        { userId, token, cached: true },
        CACHE_TTL.MEDIUM,
      );
    } catch (error) {
      this.logger.error("Failed to cache user session", error as Error, {
        userId,
      });
    }
  }

  private async checkRateLimit(
    identifier: string,
    operation: string,
  ): Promise<void> {
    // Implementation would check rate limits
    // For now, just log the check
    this.logger.debug("Rate limit check", { identifier, operation });
  }

  private async logFailedLoginAttempt(
    username: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      const key = `failed-login:${username}:${ipAddress || "unknown"}`;
      const attempts = (await this.cache.get<number>(key)) || 0;
      await this.cache.set(key, attempts + 1, CACHE_TTL.LONG);
    } catch (error) {
      this.logger.error("Failed to log failed login attempt", error as Error);
    }
  }

  private async clearFailedLoginAttempts(username: string): Promise<void> {
    try {
      await this.cache.clear(`failed-login:${username}`);
    } catch (error) {
      this.logger.error(
        "Failed to clear failed login attempts",
        error as Error,
      );
    }
  }
}
