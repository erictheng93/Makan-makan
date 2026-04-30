/**
 * CSRF Middleware Tests
 * CSRF 中間件測試
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  csrfProtection,
  generateCSRFTokenHandler,
  attachCSRFToken,
} from "../csrf";
import { mockEnv } from "../../__tests__/setup";

describe("CSRF Protection Middleware", () => {
  let app: Hono<{ Bindings: typeof mockEnv }>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.CACHE_KV.get.mockResolvedValue(null);
    mockEnv.CACHE_KV.put.mockResolvedValue(undefined);

    app = new Hono<{ Bindings: typeof mockEnv }>();
    // Inject env into context properly
    app.use("*", async (c, next) => {
      // @ts-ignore - Inject env for testing
      c.env = mockEnv;
      await next();
    });
  });

  describe("Safe Methods", () => {
    beforeEach(() => {
      app.use("*", csrfProtection());
      app.get("/test", (c) => c.json({ success: true }));
      // Hono doesn't have app.head, use app.on instead
      app.on("HEAD", "/test", (c) => c.json({ success: true }));
      app.on("OPTIONS", "/test", (c) => c.json({ success: true }));
    });

    it("should allow GET requests without CSRF token", async () => {
      const req = new Request("http://localhost/test", {
        headers: { Host: "localhost" },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.status).toBe(200);
    });

    it("should allow HEAD requests without CSRF token", async () => {
      const req = new Request("http://localhost/test", {
        method: "HEAD",
        headers: { Host: "localhost" },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.status).toBe(200);
    });

    it("should allow OPTIONS requests without CSRF token", async () => {
      const req = new Request("http://localhost/test", {
        method: "OPTIONS",
        headers: { Host: "localhost" },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.status).toBe(200);
    });
  });

  describe("Protected Methods", () => {
    beforeEach(() => {
      app.use("*", csrfProtection());
      app.post("/test", (c) => c.json({ success: true }));
      app.put("/test", (c) => c.json({ success: true }));
      app.delete("/test", (c) => c.json({ success: true }));
      app.patch("/test", (c) => c.json({ success: true }));
    });

    it("should reject POST without CSRF token", async () => {
      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: {
          Host: "localhost",
          Origin: "http://localhost",
        },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);
      const result = (await res.json()) as ApiTestResponse;

      expect(res.status).toBe(403);
      expect(result.error).toContain("CSRF token missing");
    });

    it("should reject PUT without CSRF token", async () => {
      const req = new Request("http://localhost/test", {
        method: "PUT",
        headers: {
          Host: "localhost",
          Origin: "http://localhost",
        },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.status).toBe(403);
    });

    it("should reject DELETE without CSRF token", async () => {
      const req = new Request("http://localhost/test", {
        method: "DELETE",
        headers: {
          Host: "localhost",
          Origin: "http://localhost",
        },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.status).toBe(403);
    });

    it("should reject PATCH without CSRF token", async () => {
      const req = new Request("http://localhost/test", {
        method: "PATCH",
        headers: {
          Host: "localhost",
          Origin: "http://localhost",
        },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.status).toBe(403);
    });
  });

  describe("Origin Validation", () => {
    beforeEach(() => {
      app.use("*", csrfProtection());
      app.post("/test", (c) => c.json({ success: true }));
    });

    it("should reject requests with mismatched origin", async () => {
      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: {
          Host: "localhost",
          Origin: "http://malicious-site.com",
        },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);
      const result = (await res.json()) as ApiTestResponse;

      expect(res.status).toBe(403);
      expect(result.error).toContain("Invalid request origin");
    });

    it("should accept requests with matching origin", async () => {
      const validToken = "a".repeat(64);

      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: {
          Host: "localhost",
          Origin: "http://localhost",
          "X-CSRF-Token": validToken,
          Cookie: `csrf_token=${validToken}`,
        },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.status).toBe(200);
    });

    it("should validate referer when origin is missing", async () => {
      const validToken = "a".repeat(64);

      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: {
          Host: "localhost",
          Referer: "http://localhost/page",
          "X-CSRF-Token": validToken,
          Cookie: `csrf_token=${validToken}`,
        },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.status).toBe(200);
    });
  });

  describe("Token Validation", () => {
    beforeEach(() => {
      app.use("*", csrfProtection());
      app.post("/test", (c) => c.json({ success: true }));
    });

    it("should reject invalid token format", async () => {
      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: {
          Host: "localhost",
          Origin: "http://localhost",
          "X-CSRF-Token": "invalid-token",
        },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);
      const result = (await res.json()) as ApiTestResponse;

      expect(res.status).toBe(403);
      expect(result.error).toContain("CSRF token invalid format");
    });

    it("should accept valid 64-character hex token", async () => {
      const validToken = "a".repeat(64);

      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: {
          Host: "localhost",
          Origin: "http://localhost",
          "X-CSRF-Token": validToken,
          Cookie: `csrf_token=${validToken}`,
        },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.status).toBe(200);
    });
  });

  describe("Double Submit Cookie Pattern", () => {
    beforeEach(() => {
      app.use("*", csrfProtection({ useDoubleSubmit: true }));
      app.post("/test", (c) => c.json({ success: true }));
    });

    it("should reject when cookie token does not match header", async () => {
      const headerToken = "a".repeat(64);
      const cookieToken = "b".repeat(64);

      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: {
          Host: "localhost",
          Origin: "http://localhost",
          "X-CSRF-Token": headerToken,
          Cookie: `csrf_token=${cookieToken}`,
        },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);
      const result = (await res.json()) as ApiTestResponse;

      expect(res.status).toBe(403);
      expect(result.error).toContain("CSRF token invalid");
    });

    it("should accept when cookie token matches header", async () => {
      const token = "a".repeat(64);

      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: {
          Host: "localhost",
          Origin: "http://localhost",
          "X-CSRF-Token": token,
          Cookie: `csrf_token=${token}`,
        },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.status).toBe(200);
    });
  });

  describe("Excluded Paths", () => {
    beforeEach(() => {
      app.use(
        "*",
        csrfProtection({
          excludePaths: ["/api/v1/auth/login", "/api/v1/health"],
        }),
      );
      app.post("/api/v1/auth/login", (c) => c.json({ success: true }));
      app.post("/api/v1/health", (c) => c.json({ success: true }));
      app.post("/api/v1/protected", (c) => c.json({ success: true }));
    });

    it("should skip CSRF check for excluded paths", async () => {
      const req = new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { Host: "localhost" },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.status).toBe(200);
    });

    it("should still check CSRF for non-excluded paths", async () => {
      const req = new Request("http://localhost/api/v1/protected", {
        method: "POST",
        headers: {
          Host: "localhost",
          Origin: "http://localhost",
        },
      });

      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.status).toBe(403);
    });
  });
});

describe("Generate CSRF Token Handler", () => {
  let app: Hono<{ Bindings: typeof mockEnv }>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.CACHE_KV.put.mockResolvedValue(undefined);

    app = new Hono<{ Bindings: typeof mockEnv }>();
    // Inject env into context properly
    app.use("*", async (c, next) => {
      // @ts-ignore - Inject env for testing
      c.env = mockEnv;
      await next();
    });
    app.get("/csrf-token", generateCSRFTokenHandler);
  });

  it("should generate CSRF token", async () => {
    const req = new Request("http://localhost/csrf-token");

    const res = await app.request(req, { env: mockEnv } as ApiTestRequestInit);
    const result = (await res.json()) as ApiTestResponse;

    expect(res.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.csrfToken).toBeTruthy();
    expect(result.data.csrfToken).toHaveLength(64);
  });

  it("should set CSRF cookie with SameSite=Lax", async () => {
    const req = new Request("http://localhost/csrf-token");

    const res = await app.request(req, { env: mockEnv } as ApiTestRequestInit);

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("csrf_token=");
    // In dev mode (localhost), Secure flag is omitted
    expect(setCookie).not.toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("should include Secure flag in production mode", async () => {
    const prodEnv = {
      ...mockEnv,
      API_BASE_URL: "https://api.makanmakan.com",
      NODE_ENV: "production",
    };

    const prodApp = new Hono<{ Bindings: typeof prodEnv }>();
    prodApp.use("*", async (c, next) => {
      // @ts-ignore
      c.env = prodEnv;
      await next();
    });
    prodApp.get("/csrf-token", generateCSRFTokenHandler as never);

    const req = new Request("http://api.makanmakan.com/csrf-token");
    const res = await prodApp.request(req, { env: prodEnv } as never);

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("csrf_token=");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("should store token in KV", async () => {
    const req = new Request("http://localhost/csrf-token");

    await app.request(req, { env: mockEnv } as ApiTestRequestInit);

    expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
      expect.stringContaining("csrf:"),
      expect.any(String),
      expect.objectContaining({ expirationTtl: expect.any(Number) }),
    );
  });

  it("should include expiry time in response", async () => {
    const req = new Request("http://localhost/csrf-token");

    const res = await app.request(req, { env: mockEnv } as ApiTestRequestInit);
    const result = (await res.json()) as ApiTestResponse;

    expect(result.data.expiresIn).toBe(3600000); // 1 hour
  });
});

describe("Attach CSRF Token Middleware", () => {
  let app: Hono<{ Bindings: typeof mockEnv }>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.CACHE_KV.put.mockResolvedValue(undefined);

    app = new Hono<{ Bindings: typeof mockEnv }>();
    // Inject env into context properly
    app.use("*", async (c, next) => {
      // @ts-ignore - Inject env for testing
      c.env = mockEnv;
      await next();
    });
    app.use("*", attachCSRFToken());
    app.post("/auth/login", (c) => c.json({ success: true }));
    app.get("/other", (c) => c.json({ success: true }));
  });

  it("should attach CSRF token to auth responses", async () => {
    const req = new Request("http://localhost/auth/login", {
      method: "POST",
    });

    const res = await app.request(req, { env: mockEnv } as ApiTestRequestInit);

    expect(res.headers.get("X-CSRF-Token")).toBeTruthy();
    expect(res.headers.get("X-CSRF-Token")).toHaveLength(64);
  });

  it("should set CSRF cookie on auth responses", async () => {
    const req = new Request("http://localhost/auth/login", {
      method: "POST",
    });

    const res = await app.request(req, { env: mockEnv } as ApiTestRequestInit);

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("csrf_token=");
  });

  it("should not attach token to non-auth responses", async () => {
    const req = new Request("http://localhost/other");

    const res = await app.request(req, { env: mockEnv } as ApiTestRequestInit);

    expect(res.headers.get("X-CSRF-Token")).toBeNull();
  });
});
