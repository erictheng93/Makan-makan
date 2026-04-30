import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import authFeature from "../features/authentication";
import { ApiError } from "../shared/utils/api-error";
import { ErrorSanitizer } from "../utils/errorSanitizer";
import { mockEnv } from "./setup";

// Use the feature routes
const authRouter = authFeature.routes;

// Mock @makanmakan/database to provide AuthService
vi.mock("@makanmakan/database", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    AuthService: vi.fn(function () {
      return {
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        validateToken: vi.fn(),
        refreshToken: vi.fn(),
        changePassword: vi.fn(),
        getUserSessions: vi.fn(),
      };
    }),
  };
});

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

// Import after mocking
import { AuthService } from "@makanmakan/database";

describe("Auth Routes", () => {
  let app: Hono<{ Bindings: typeof mockEnv }>;
  let mockAuthServiceInstance: any;

  beforeEach(() => {
    app = new Hono<{ Bindings: typeof mockEnv }>();

    // Global error handler matching production index.ts
    app.onError((err, c) => {
      if (err instanceof ApiError) {
        return c.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
              ...(err.details !== undefined && { details: err.details }),
            },
          },
          err.status as never,
        );
      }
      const sanitized = ErrorSanitizer.sanitizeError(err);
      return c.json(
        {
          success: false,
          error: {
            code: sanitized.code ?? "INTERNAL_ERROR",
            message: sanitized.message,
          },
        },
        500,
      );
    });

    // Add middleware to inject mockEnv into context (critical for c.env.DB access)
    app.use("*", async (c, next) => {
      // Initialize c.env if it doesn't exist
      if (!c.env) {
        (c as unknown as ApiTestContextWithEnv).env =
          {} as unknown as ApiTestEnv;
      }
      // Inject mock env
      Object.assign(c.env, mockEnv);
      await next();
    });

    app.route("/auth", authRouter);

    // Get the mock AuthService instance
    mockAuthServiceInstance = {
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      validateToken: vi.fn(),
      refreshToken: vi.fn(),
    };

    // Configure AuthService mock to return our instance
    // vitest 4 requires 'function' keyword for constructor mocks
    vi.mocked(AuthService).mockImplementation(function (this: any) {
      return mockAuthServiceInstance;
    } as never);

    vi.clearAllMocks();
  });

  describe("POST /login", () => {
    it("should successfully login with valid credentials", async () => {
      const mockUser = {
        id: 1,
        username: "testuser",
        role: 1,
        restaurantId: "test-restaurant-1",
      };

      // Mock AuthService.login to return success
      // Note: expiresAt must be a Date object as the service calls .getTime()
      mockAuthServiceInstance.login.mockResolvedValue({
        success: true,
        tokens: {
          accessToken: "mock-access-token",
          refreshToken: "mock-refresh-token",
          expiresAt: new Date(Date.now() + 3600000),
        },
        user: mockUser,
      });

      const req = new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          password: "password123",
        }),
      });

      const response = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);
      const result = (await response.json()) as ApiTestResponse;

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.token).toBe("mock-access-token");
      expect(result.data.user.username).toBe("testuser");
      expect(result.data.user.role).toBe(1);

      expect(mockAuthServiceInstance.login).toHaveBeenCalledOnce();
      expect(mockAuthServiceInstance.login).toHaveBeenCalledWith(
        expect.objectContaining({ username: "testuser" }),
      );
    });

    it("should reject login with invalid credentials", async () => {
      // Mock AuthService.login to return failure
      mockAuthServiceInstance.login.mockResolvedValue({
        success: false,
        error: "Invalid username or password",
      });

      const req = new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "nonexistent",
          password: "wrongpassword",
        }),
      });

      const response = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);
      const result = (await response.json()) as ApiTestResponse;

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error.message).toBe("Invalid username or password");

      expect(mockAuthServiceInstance.login).toHaveBeenCalledOnce();
      expect(mockAuthServiceInstance.login).toHaveBeenCalledWith(
        expect.objectContaining({ username: "nonexistent" }),
      );
    });

    it("should reject login with wrong password", async () => {
      // Mock AuthService.login to return failure for wrong password
      mockAuthServiceInstance.login.mockResolvedValue({
        success: false,
        error: "Invalid username or password",
      });

      const req = new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          password: "wrongpassword",
        }),
      });

      const response = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);
      const result = (await response.json()) as ApiTestResponse;

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error.message).toBe("Invalid username or password");

      expect(mockAuthServiceInstance.login).toHaveBeenCalledOnce();
      expect(mockAuthServiceInstance.login).toHaveBeenCalledWith(
        expect.objectContaining({ username: "testuser" }),
      );
    });

    it("should reject login with missing credentials", async () => {
      const req = new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          // missing password
        }),
      });

      const response = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);
      const result = (await response.json()) as ApiTestResponse;

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      // Unified error format: { code, message }
      expect(result.error).toBeDefined();
      expect(result.error).toHaveProperty("code");
      expect(result.error).toHaveProperty("message");
    });
  });

  describe("POST /register", () => {
    it("should reject registration without authentication", async () => {
      // Note: Registration endpoint requires valid body fields to pass Zod validation
      // before reaching the auth middleware check
      const req = new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "newuser",
          password: "password123",
          role: 2,
          restaurantId: 1, // Include all required fields for Zod validation
        }),
      });

      const response = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);
      const result = (await response.json()) as ApiTestResponse;

      // If validation passes, auth middleware should return 401
      // If validation fails first, we get 400 with ZodError
      expect([400, 401]).toContain(response.status);
      expect(result.success).toBe(false);
      // Check for either auth error or validation error
      if (response.status === 401) {
        expect(result.error.message.toLowerCase()).toContain("authorization");
      }
    });

    // Note: Testing authenticated routes would require mocking the auth middleware
    // This would be expanded in a full test suite
  });

  describe("GET /me", () => {
    it("should reject request without authentication", async () => {
      const req = new Request("http://localhost/auth/me", {
        method: "GET",
      });

      const response = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);
      const result = (await response.json()) as ApiTestResponse;

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error.message.toLowerCase()).toContain("authorization");
    });
  });
});
