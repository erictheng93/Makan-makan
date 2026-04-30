import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { ManagementEnv } from "../../types";
import {
  managementAuthMiddleware,
  type ManagementUser,
} from "../../middleware/auth";
import { ApiError } from "@makanmakan/utils";

const JWT_SECRET = "test-jwt-secret-for-auth-middleware-tests";
const testEnv = { JWT_SECRET } as ManagementEnv;

type ManagementAuthResponse = {
  success: boolean;
  error: {
    code: string;
  };
  user: ManagementUser;
};

// Helper to create a valid JWT
async function createTestToken(
  payload: Record<string, unknown> = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      id: "admin-001",
      email: "admin@makanmakan.app",
      iat: now,
      exp: now + 3600,
      ...payload,
    },
    JWT_SECRET,
  );
}

function createTestApp() {
  const app = new Hono<{
    Bindings: ManagementEnv;
    Variables: { managementUser: ManagementUser };
  }>();

  // Add error handler so ApiError is formatted as JSON
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: { code: err.code, message: err.message },
        },
        err.status as 400 | 401 | 403 | 404 | 409 | 500,
      );
    }
    return c.json({ success: false, error: { code: "INTERNAL_ERROR" } }, 500);
  });

  app.use("*", managementAuthMiddleware);

  app.get("/test", (c) => {
    const user = c.get("managementUser");
    return c.json({ success: true, user });
  });

  return app;
}

describe("managementAuthMiddleware", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should reject request without Authorization header", async () => {
    const res = await app.request("/test", {}, testEnv);
    expect(res.status).toBe(401);
    const body = (await res.json()) as ManagementAuthResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("should reject request with non-Bearer token", async () => {
    const res = await app.request(
      "/test",
      { headers: { Authorization: "Basic abc123" } },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it("should reject request with invalid JWT", async () => {
    const res = await app.request(
      "/test",
      { headers: { Authorization: "Bearer invalid-token" } },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it("should reject request with expired JWT", async () => {
    const expiredToken = await sign(
      {
        id: "admin-001",
        email: "admin@makanmakan.app",
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600,
      },
      JWT_SECRET,
    );

    const res = await app.request(
      "/test",
      { headers: { Authorization: `Bearer ${expiredToken}` } },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it("should reject token missing required claims", async () => {
    const token = await sign(
      {
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      JWT_SECRET,
    );

    const res = await app.request(
      "/test",
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it("should allow request with valid JWT and set managementUser", async () => {
    const token = await createTestToken();
    const res = await app.request(
      "/test",
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ManagementAuthResponse;
    expect(body.success).toBe(true);
    expect(body.user).toEqual({
      id: "admin-001",
      email: "admin@makanmakan.app",
      role: "admin",
    });
  });
});
