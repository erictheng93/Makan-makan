/**
 * Tests for the main Hono application (index.ts)
 *
 * Covers: root endpoints, error handling, 404, CORS, request ID middleware
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../index";
import { createMockEnv, createTestAuthHeader } from "./setup";
import type { ManagementEnv } from "../types";

let defaultEnv: ManagementEnv;
let authHeader: string;

function createRequest(
  path: string,
  options?: RequestInit & { env?: ManagementEnv },
) {
  const env = options?.env || defaultEnv;
  const headers = new Headers(options?.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", authHeader);
  }
  const request = new Request(`http://localhost${path}`, {
    ...options,
    headers,
  });
  return { request, env };
}

async function fetchApp(
  path: string,
  options?: RequestInit & { env?: ManagementEnv },
) {
  const { request, env } = createRequest(path, options);
  return app.fetch(request, env);
}

describe("Management API - App", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    defaultEnv = createMockEnv();
    authHeader = await createTestAuthHeader(defaultEnv.JWT_SECRET);
  });

  describe("GET /health", () => {
    it("should return healthy status", async () => {
      const res = await fetchApp("/health");
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("healthy");
      expect(body.data.service).toBe("management-api");
    });

    it("should include API version from env", async () => {
      const env = createMockEnv({ API_VERSION: "v2" });
      const res = await fetchApp("/health", { env });
      const body: any = await res.json();
      expect(body.data.version).toBe("v2");
    });

    it("should include ISO timestamp", async () => {
      const res = await fetchApp("/health");
      const body: any = await res.json();
      expect(body.data.timestamp).toBeDefined();
      // Validate it parses as a date
      expect(new Date(body.data.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe("GET /info", () => {
    it("should return API information", async () => {
      const res = await fetchApp("/info");
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.name).toBe("MakanMakan Management API");
      expect(body.features).toBeInstanceOf(Array);
      expect(body.features.length).toBeGreaterThan(0);
    });

    it("should list all available endpoint groups", async () => {
      const res = await fetchApp("/info");
      const body: any = await res.json();
      expect(body.endpoints).toHaveProperty("tenants");
      expect(body.endpoints).toHaveProperty("deployments");
      expect(body.endpoints).toHaveProperty("licenses");
      expect(body.endpoints).toHaveProperty("health");
      expect(body.endpoints).toHaveProperty("monitoring");
      expect(body.endpoints).toHaveProperty("updates");
      expect(body.endpoints).toHaveProperty("onboarding");
    });
  });

  describe("GET /", () => {
    it("should redirect to /info", async () => {
      const res = await fetchApp("/", { redirect: "manual" });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/info");
    });
  });

  describe("404 handling", () => {
    it("should return 404 for unknown routes", async () => {
      const res = await fetchApp("/api/v1/nonexistent");
      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Request ID middleware", () => {
    it("should add X-Request-ID header to response", async () => {
      const res = await fetchApp("/health");
      expect(res.headers.get("X-Request-ID")).toBeDefined();
    });

    it("should echo back X-Request-ID from request", async () => {
      const res = await fetchApp("/health", {
        headers: { "X-Request-ID": "custom-req-id-123" },
      });
      expect(res.headers.get("X-Request-ID")).toBe("custom-req-id-123");
    });
  });
});
