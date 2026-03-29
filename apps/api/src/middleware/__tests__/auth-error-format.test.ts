import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../shared/utils/api-error";

// Mock hono/jwt before importing auth
vi.mock("hono/jwt", () => ({
  verify: vi.fn(),
}));

import { authMiddleware, requireRole } from "../auth";
import { verify } from "hono/jwt";

/** Mini onError handler matching the global handler in index.ts */
function addErrorHandler(app: Hono) {
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
        err.status as any,
      );
    }
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: err.message },
      },
      500,
    );
  });
}

function createApp() {
  const app = new Hono();
  addErrorHandler(app);
  app.use("*", async (c, next) => {
    c.env = {
      JWT_SECRET: "a".repeat(32),
      TOKEN_BLACKLIST: null,
    } as any;
    await next();
  });
  app.get("/protected", authMiddleware, (c) =>
    c.json({ success: true, data: "ok" }),
  );
  return app;
}

describe("auth middleware error format", () => {
  it("should return unified error shape for missing auth header", async () => {
    const app = createApp();
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toHaveProperty("code", "MISSING_AUTH_HEADER");
    expect(body.error).toHaveProperty("message");
  });

  it("should return unified error shape for expired token", async () => {
    const app = createApp();
    vi.mocked(verify).mockResolvedValue({
      id: 1,
      username: "test",
      role: 1,
      iat: Math.floor(Date.now() / 1000) - 100,
      exp: Math.floor(Date.now() / 1000) - 10,
    });

    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer valid-token" },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error).toHaveProperty("code", "TOKEN_EXPIRED");

    expect(verify).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledWith(
      "valid-token",
      expect.any(String),
      expect.any(String),
    );
  });
});

describe("requireRole error format", () => {
  it("should return unified error shape for insufficient permissions", async () => {
    const app = new Hono();
    addErrorHandler(app);
    app.use("*", async (c, next) => {
      c.env = { JWT_SECRET: "a".repeat(32) } as any;
      c.set("user", { id: 1, username: "test", role: 2 });
      await next();
    });
    app.get("/admin", requireRole([0, 1]), (c) => c.json({ success: true }));

    const res = await app.request("/admin");
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error).toHaveProperty("code", "INSUFFICIENT_ROLE");
    expect(body.error).toHaveProperty("message");
  });
});
