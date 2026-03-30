/**
 * Contract Tests for Authentication API Responses
 *
 * These tests verify that authentication endpoints return STABLE response
 * shapes. The customer app and admin dashboard depend on these shapes --
 * if someone accidentally adds or removes fields, these tests will break.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import {
  assertMatchesSchema,
  assertNoSensitiveFields,
} from "../../../contracts/helpers";
import {
  LoginResponse,
  RegisterResponse,
  RefreshTokenResponse,
  MeResponse,
  GuestTokenResponse,
  LogoutResponse,
  ChangePasswordResponse,
  AuthUserSchema,
  AUTH_SENSITIVE_FIELDS,
} from "../../../contracts/schemas/authentication";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = new Date().toISOString();

const mockUser = {
  id: 1,
  username: "testuser",
  fullName: "Test User",
  email: "test@example.com",
  phone: null,
  role: 1,
  restaurantId: "rest-001",
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

// =========================================================================
// Tests
// =========================================================================

describe("Authentication API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // =======================================================================
  // Login Response Contract
  // =======================================================================
  describe("Login Response Contract", () => {
    it("should match LoginResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          token: "jwt-token-abc123",
          refreshToken: "refresh-token-xyz789",
          expiresAt: "2026-04-01T00:00:00Z",
          user: { ...mockUser },
        },
      };

      assertMatchesSchema(LoginResponse, mockResponse, "POST /auth/login");
    });

    it("should match LoginResponse without optional fields", () => {
      const mockResponse = {
        success: true as const,
        data: {
          token: "jwt-token-abc123",
          user: {
            id: 1,
            username: "testuser",
            role: 1,
            createdAt: now,
            updatedAt: now,
          },
        },
      };

      assertMatchesSchema(
        LoginResponse,
        mockResponse,
        "POST /auth/login (minimal)",
      );
    });

    it("should NOT contain sensitive fields in user object", () => {
      assertNoSensitiveFields(
        mockUser,
        AUTH_SENSITIVE_FIELDS,
        "Login user object",
      );
    });

    it("should NOT leak password, passwordHash, salt, or totpSecret", () => {
      const leakyUser = {
        ...mockUser,
        password: "secret123",
        passwordHash: "$2b$10$hash",
        salt: "random-salt",
        totpSecret: "JBSWY3DPEHPK3PXP",
        recoveryKeys: ["key1", "key2"],
      };

      // Verify the sensitive fields detector catches all of them
      const leaked = AUTH_SENSITIVE_FIELDS.filter((f) => f in leakyUser);
      expect(leaked).toEqual([
        "password",
        "passwordHash",
        "salt",
        "totpSecret",
        "recoveryKeys",
      ]);
    });
  });

  // =======================================================================
  // Register Response Contract
  // =======================================================================
  describe("Register Response Contract", () => {
    it("should match RegisterResponse schema with user + tokens", () => {
      const mockResponse = {
        success: true as const,
        data: {
          user: { ...mockUser },
          tokens: {
            token: "jwt-token-abc123",
            refreshToken: "refresh-token-xyz789",
            expiresAt: "2026-04-01T00:00:00Z",
          },
        },
      };

      assertMatchesSchema(
        RegisterResponse,
        mockResponse,
        "POST /auth/register",
      );
    });

    it("should match RegisterResponse with token only", () => {
      const mockResponse = {
        success: true as const,
        data: {
          token: "jwt-token-abc123",
        },
      };

      assertMatchesSchema(
        RegisterResponse,
        mockResponse,
        "POST /auth/register (token only)",
      );
    });
  });

  // =======================================================================
  // Refresh Token Response Contract
  // =======================================================================
  describe("Refresh Token Response Contract", () => {
    it("should match RefreshTokenResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          token: "new-jwt-token",
          refreshToken: "new-refresh-token",
          expiresAt: 1743465600000,
          user: { ...mockUser },
        },
      };

      assertMatchesSchema(
        RefreshTokenResponse,
        mockResponse,
        "POST /auth/refresh",
      );
    });

    it("should match RefreshTokenResponse without optional user", () => {
      const mockResponse = {
        success: true as const,
        data: {
          token: "new-jwt-token",
        },
      };

      assertMatchesSchema(
        RefreshTokenResponse,
        mockResponse,
        "POST /auth/refresh (token only)",
      );
    });
  });

  // =======================================================================
  // Me Response Contract
  // =======================================================================
  describe("Me Response Contract", () => {
    it("should match MeResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockUser },
      };

      assertMatchesSchema(MeResponse, mockResponse, "GET /auth/me");
    });

    it("should NOT contain sensitive fields in me response", () => {
      assertNoSensitiveFields(
        mockUser,
        AUTH_SENSITIVE_FIELDS,
        "Me response user",
      );
    });

    it("should accept user with numeric id", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockUser, id: 42 },
      };

      assertMatchesSchema(
        MeResponse,
        mockResponse,
        "GET /auth/me (numeric id)",
      );
    });

    it("should accept user with string id", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockUser, id: "user-uuid-001" },
      };

      assertMatchesSchema(MeResponse, mockResponse, "GET /auth/me (string id)");
    });
  });

  // =======================================================================
  // Guest Token Response Contract
  // =======================================================================
  describe("Guest Token Response Contract", () => {
    it("should match GuestTokenResponse schema", () => {
      const mockResponse = {
        success: true as const,
        token: "guest-jwt-token-abc123",
        expiresIn: 3600,
      };

      assertMatchesSchema(
        GuestTokenResponse,
        mockResponse,
        "POST /auth/guest-token",
      );
    });

    it("should match GuestTokenResponse without optional expiresIn", () => {
      const mockResponse = {
        success: true as const,
        token: "guest-jwt-token-abc123",
      };

      assertMatchesSchema(
        GuestTokenResponse,
        mockResponse,
        "POST /auth/guest-token (no expiresIn)",
      );
    });
  });

  // =======================================================================
  // Message-only Response Contracts
  // =======================================================================
  describe("Logout Response Contract", () => {
    it("should match message-only response", () => {
      const mockResponse = {
        success: true as const,
        message: "Logged out successfully",
      };

      assertMatchesSchema(LogoutResponse, mockResponse, "POST /auth/logout");
    });
  });

  describe("Change Password Response Contract", () => {
    it("should match message-only response", () => {
      const mockResponse = {
        success: true as const,
        message: "Password changed successfully",
      };

      assertMatchesSchema(
        ChangePasswordResponse,
        mockResponse,
        "POST /auth/change-password",
      );
    });
  });

  // =======================================================================
  // AuthUserSchema field validation
  // =======================================================================
  describe("AuthUserSchema field validation", () => {
    it("should require id, username, role, createdAt, updatedAt", () => {
      const minimalUser = {
        id: 1,
        username: "testuser",
        role: 0,
        createdAt: now,
        updatedAt: now,
      };

      const result = AuthUserSchema.safeParse(minimalUser);
      expect(result.success).toBe(true);
    });

    it("should reject role outside 0-5 range", () => {
      const invalidUser = {
        id: 1,
        username: "testuser",
        role: 10,
        createdAt: now,
        updatedAt: now,
      };

      const result = AuthUserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    it("should accept role values 0 through 5", () => {
      for (let role = 0; role <= 5; role++) {
        const user = {
          id: 1,
          username: "testuser",
          role,
          createdAt: now,
          updatedAt: now,
        };

        const result = AuthUserSchema.safeParse(user);
        expect(result.success).toBe(true);
      }
    });

    it("should accept both numeric and string timestamps", () => {
      const userWithNumericTs = {
        id: 1,
        username: "testuser",
        role: 1,
        createdAt: 1711929600000,
        updatedAt: 1711929600000,
      };

      const result = AuthUserSchema.safeParse(userWithNumericTs);
      expect(result.success).toBe(true);
    });
  });

  // =======================================================================
  // Response Envelope Contract
  // =======================================================================
  describe("Response Envelope Contract", () => {
    it("should wrap login data in { success: true, data: {...} } envelope", () => {
      const mockResponse = {
        success: true as const,
        data: {
          token: "jwt-token",
          user: { ...mockUser },
        },
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse).toHaveProperty("data");
      expect(mockResponse.data).toHaveProperty("token");
      expect(mockResponse.data).toHaveProperty("user");
    });

    it("should have guest token at top level (not in data)", () => {
      const mockResponse = {
        success: true as const,
        token: "guest-jwt-token",
        expiresIn: 3600,
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse).toHaveProperty("token");
      expect(mockResponse).not.toHaveProperty("data");
    });
  });
});
