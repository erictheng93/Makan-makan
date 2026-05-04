/**
 * Contract Tests for Users API
 *
 * Validates that user-related API responses match their declared Zod
 * schemas. Any schema drift (field added, removed, or renamed) causes
 * a test-time failure. Also verifies that sensitive fields never leak.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmasak/testing-utils";
import {
  assertMatchesSchema,
  assertNoSensitiveFields,
} from "../../../contracts/helpers";
import {
  ListUsersResponse,
  GetUserResponse,
  CreateUserResponse,
  UpdateUserResponse,
  DeleteUserResponse,
  ChangePasswordResponse,
  UserStatsResponse,
  USER_SENSITIVE_FIELDS,
} from "../../../contracts/schemas/users";

describe("Users API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // List Users
  // -------------------------------------------------------------------------
  describe("ListUsersResponse", () => {
    it("should match schema with populated user list", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: 1,
            email: "admin@example.com",
            username: "admin",
            name: "Admin User",
            role: 0,
            restaurantId: "rest-001",
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 2,
            email: "owner@example.com",
            username: "shopowner",
            name: "Shop Owner",
            role: 1,
            restaurantId: "rest-001",
            phone: "+60123456789",
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        meta: { total: 2, page: 1, pageSize: 20, totalPages: 1 },
      };

      assertMatchesSchema(
        ListUsersResponse,
        mockResponse,
        "GET /users/:restaurantId",
      );
    });

    it("should match schema with empty user list", () => {
      const mockResponse = {
        success: true as const,
        data: [],
        meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 },
      };

      assertMatchesSchema(
        ListUsersResponse,
        mockResponse,
        "GET /users (empty)",
      );
    });

    it("should match schema without optional meta", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: 1,
            email: "user@example.com",
            username: "testuser",
            name: "Test",
            role: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        ListUsersResponse,
        mockResponse,
        "GET /users (no meta)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Get User
  // -------------------------------------------------------------------------
  describe("GetUserResponse", () => {
    it("should match schema for a complete user", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 1,
          email: "chef@example.com",
          username: "chef_lee",
          name: "Chef Lee",
          fullName: "Lee Wei Ming",
          role: 2,
          restaurantId: "rest-001",
          phone: "+60198765432",
          avatar: "https://cdn.example.com/avatars/chef.jpg",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(GetUserResponse, mockResponse, "GET /users/:id");
    });

    it("should match schema with nullable optional fields", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 42,
          role: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          phone: null,
          avatar: null,
          restaurantId: null,
        },
      };

      assertMatchesSchema(
        GetUserResponse,
        mockResponse,
        "GET /users/:id (minimal)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Create User
  // -------------------------------------------------------------------------
  describe("CreateUserResponse", () => {
    it("should match schema for newly created user", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 10,
          email: "new@example.com",
          username: "newuser",
          name: "New User",
          role: 3,
          restaurantId: "rest-002",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(CreateUserResponse, mockResponse, "POST /users");
    });
  });

  // -------------------------------------------------------------------------
  // Update User
  // -------------------------------------------------------------------------
  describe("UpdateUserResponse", () => {
    it("should match schema for updated user", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 1,
          email: "updated@example.com",
          username: "updateduser",
          name: "Updated User",
          role: 1,
          restaurantId: "rest-001",
          isActive: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(UpdateUserResponse, mockResponse, "PUT /users/:id");
    });
  });

  // -------------------------------------------------------------------------
  // Delete User
  // -------------------------------------------------------------------------
  describe("DeleteUserResponse", () => {
    it("should match message-only schema", () => {
      const mockResponse = {
        success: true as const,
        message: "User deleted successfully",
      };

      assertMatchesSchema(
        DeleteUserResponse,
        mockResponse,
        "DELETE /users/:id",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Change Password
  // -------------------------------------------------------------------------
  describe("ChangePasswordResponse", () => {
    it("should match message-only schema", () => {
      const mockResponse = {
        success: true as const,
        message: "Password changed successfully",
      };

      assertMatchesSchema(
        ChangePasswordResponse,
        mockResponse,
        "PUT /users/:id/password",
      );
    });
  });

  // -------------------------------------------------------------------------
  // User Stats
  // -------------------------------------------------------------------------
  describe("UserStatsResponse", () => {
    it("should match schema with stats data", () => {
      const mockResponse = {
        success: true as const,
        data: {
          totalUsers: 25,
          activeUsers: 20,
        },
      };

      assertMatchesSchema(UserStatsResponse, mockResponse, "GET /users/stats");
    });
  });

  // -------------------------------------------------------------------------
  // Sensitive Field Leakage
  // -------------------------------------------------------------------------
  describe("Sensitive Fields", () => {
    it("should NOT contain password in user response", () => {
      const userResponse = {
        id: 1,
        email: "user@example.com",
        username: "testuser",
        role: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      assertNoSensitiveFields(
        userResponse,
        USER_SENSITIVE_FIELDS,
        "User response",
      );
    });

    it("should detect leaked password field", () => {
      const leakedResponse = {
        id: 1,
        email: "user@example.com",
        password: "secret123",
        role: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(() =>
        assertNoSensitiveFields(
          leakedResponse,
          USER_SENSITIVE_FIELDS,
          "User response",
        ),
      ).toThrow("leaks sensitive fields");
    });

    it("should detect leaked passwordHash field", () => {
      const leakedResponse = {
        id: 1,
        email: "user@example.com",
        passwordHash: "$2b$10$abcdef...",
        role: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(() =>
        assertNoSensitiveFields(
          leakedResponse,
          USER_SENSITIVE_FIELDS,
          "User response",
        ),
      ).toThrow("leaks sensitive fields");
    });

    it("should detect leaked salt field", () => {
      const leakedResponse = {
        id: 1,
        email: "user@example.com",
        salt: "random-salt-value",
        role: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(() =>
        assertNoSensitiveFields(
          leakedResponse,
          USER_SENSITIVE_FIELDS,
          "User response",
        ),
      ).toThrow("leaks sensitive fields");
    });

    it("should NOT contain sensitive fields in list response items", () => {
      const users = [
        {
          id: 1,
          email: "a@example.com",
          role: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 2,
          email: "b@example.com",
          role: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      for (const user of users) {
        assertNoSensitiveFields(
          user,
          USER_SENSITIVE_FIELDS,
          `User id=${user.id}`,
        );
      }
    });
  });
});
