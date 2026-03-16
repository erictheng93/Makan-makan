/**
 * Tests for License Management Routes
 *
 * Covers: generate, verify, get, renew, upgrade license operations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../../index";
import {
  createMockEnv,
  createMockD1Statement,
  createTestAuthHeader,
} from "../setup";
import type { ManagementEnv } from "../../types";

let env: ManagementEnv;
let authHeader: string;

function mockDb() {
  return env.MANAGEMENT_DB as unknown as {
    prepare: ReturnType<typeof vi.fn>;
  };
}

async function fetchApp(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", authHeader);
  }
  const request = new Request(`http://localhost${path}`, {
    ...options,
    headers,
  });
  return app.fetch(request, env);
}

function jsonBody(data: unknown, method = "POST") {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

describe("License Routes", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    env = createMockEnv();
    authHeader = await createTestAuthHeader(env.JWT_SECRET);
  });

  // ============================================================
  // POST /api/v1/licenses/generate
  // ============================================================
  describe("POST /api/v1/licenses/generate", () => {
    it("should generate a license key for valid request", async () => {
      const db = mockDb();

      // Insert license + update tenant
      const insertStmt = createMockD1Statement();
      insertStmt.run.mockResolvedValue({ success: true });

      const updateStmt = createMockD1Statement();
      updateStmt.run.mockResolvedValue({ success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return insertStmt;
        return updateStmt;
      });

      const res = await fetchApp(
        "/api/v1/licenses/generate",
        jsonBody({
          tenantId: "T-20240101-ABC",
          tier: "professional",
          validityMonths: 12,
        }),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.licenseKey).toMatch(/^MKM-PRO-/);
      expect(body.data.tier).toBe("professional");
      expect(body.data.features.maxRestaurants).toBe(3);
      expect(body.data.features.aiAnalytics).toBe(true);
      expect(body.data.expiresAt).toBeDefined();
    });

    it("should generate standard tier license with correct features", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.run.mockResolvedValue({ success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/licenses/generate",
        jsonBody({
          tenantId: "T-20240101-ABC",
          tier: "standard",
          validityMonths: 6,
        }),
      );

      const body: any = await res.json();
      expect(body.data.licenseKey).toMatch(/^MKM-STD-/);
      expect(body.data.features.maxRestaurants).toBe(1);
      expect(body.data.features.aiAnalytics).toBe(false);
      expect(body.data.features.partnerships).toBe(false);
    });

    it("should generate enterprise tier license with all features", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.run.mockResolvedValue({ success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/licenses/generate",
        jsonBody({
          tenantId: "T-20240101-ABC",
          tier: "enterprise",
          validityMonths: 24,
        }),
      );

      const body: any = await res.json();
      expect(body.data.licenseKey).toMatch(/^MKM-ENT-/);
      expect(body.data.features.maxRestaurants).toBe(10);
      expect(body.data.features.apiAccess).toBe(true);
      expect(body.data.features.prioritySupport).toBe(true);
    });

    it("should return 400 for missing tenantId", async () => {
      const res = await fetchApp(
        "/api/v1/licenses/generate",
        jsonBody({ tier: "standard", validityMonths: 12 }),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for invalid tier", async () => {
      const res = await fetchApp(
        "/api/v1/licenses/generate",
        jsonBody({
          tenantId: "T-123",
          tier: "mega",
          validityMonths: 12,
        }),
      );

      expect(res.status).toBe(400);
    });

    it("should return 400 for validityMonths > 36", async () => {
      const res = await fetchApp(
        "/api/v1/licenses/generate",
        jsonBody({
          tenantId: "T-123",
          tier: "standard",
          validityMonths: 48,
        }),
      );

      expect(res.status).toBe(400);
    });

    it("should return 500 on database error", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.run.mockRejectedValue(new Error("DB error"));
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/licenses/generate",
        jsonBody({
          tenantId: "T-123",
          tier: "standard",
          validityMonths: 12,
        }),
      );

      expect(res.status).toBe(500);
      const body: any = await res.json();
      expect(body.code).toBe("GENERATE_FAILED");
    });
  });

  // ============================================================
  // POST /api/v1/licenses/verify
  // ============================================================
  describe("POST /api/v1/licenses/verify", () => {
    it("should return valid for active tenant with valid license", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue({
        id: "T-123",
        license_key: "MKM-STD-ABC123-XY12",
        license_tier: "standard",
        license_expires_at: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        status: "active",
      });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/licenses/verify",
        jsonBody({
          tenantId: "T-123",
          licenseKey: "MKM-STD-ABC123-XY12",
          version: "1.0.0",
          timestamp: Date.now(),
        }),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.valid).toBe(true);
      expect(body.tier).toBe("standard");
      expect(body.features).toBeDefined();
    });

    it("should return invalid for non-existent license", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/licenses/verify",
        jsonBody({
          tenantId: "T-123",
          licenseKey: "MKM-STD-INVALID-KEY",
          version: "1.0.0",
          timestamp: Date.now(),
        }),
      );

      const body: any = await res.json();
      expect(body.valid).toBe(false);
      expect(body.error).toContain("Invalid license");
    });

    it("should return invalid for suspended tenant", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue({
        id: "T-123",
        license_key: "MKM-STD-ABC123-XY12",
        license_tier: "standard",
        license_expires_at: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        status: "suspended",
      });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/licenses/verify",
        jsonBody({
          tenantId: "T-123",
          licenseKey: "MKM-STD-ABC123-XY12",
          version: "1.0.0",
          timestamp: Date.now(),
        }),
      );

      const body: any = await res.json();
      expect(body.valid).toBe(false);
      expect(body.error).toContain("suspended");
    });

    it("should return invalid for expired license", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue({
        id: "T-123",
        license_key: "MKM-STD-ABC123-XY12",
        license_tier: "standard",
        license_expires_at: "2020-01-01T00:00:00.000Z", // expired
        status: "active",
      });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/licenses/verify",
        jsonBody({
          tenantId: "T-123",
          licenseKey: "MKM-STD-ABC123-XY12",
          version: "1.0.0",
          timestamp: Date.now(),
        }),
      );

      const body: any = await res.json();
      expect(body.valid).toBe(false);
      expect(body.error).toContain("expired");
    });

    it("should return 400 for invalid request format", async () => {
      const res = await fetchApp(
        "/api/v1/licenses/verify",
        jsonBody({
          tenantId: "T-123",
          // missing licenseKey
          version: "1.0.0",
          timestamp: Date.now(),
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // GET /api/v1/licenses/:tenantId
  // ============================================================
  describe("GET /api/v1/licenses/:tenantId", () => {
    it("should return license info for tenant", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue({
        id: "T-123",
        license_key: "MKM-PRO-ABC123-XY12",
        license_tier: "professional",
        license_expires_at: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        status: "active",
      });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/licenses/T-123");
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.tier).toBe("professional");
      expect(body.data.isExpired).toBe(false);
      expect(body.data.features.maxRestaurants).toBe(3);
    });

    it("should mark expired licenses", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue({
        id: "T-123",
        license_key: "MKM-STD-ABC123-XY12",
        license_tier: "standard",
        license_expires_at: "2020-01-01T00:00:00.000Z",
        status: "active",
      });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/licenses/T-123");
      const body: any = await res.json();
      expect(body.data.isExpired).toBe(true);
    });

    it("should return 404 for non-existent tenant", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/licenses/T-NONEXISTENT");
      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // POST /api/v1/licenses/:tenantId/renew
  // ============================================================
  describe("POST /api/v1/licenses/:tenantId/renew", () => {
    it("should renew license and extend expiration", async () => {
      const db = mockDb();
      const futureDate = new Date(
        Date.now() + 180 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const getStmt = createMockD1Statement();
      getStmt.first.mockResolvedValue({
        id: "T-123",
        license_tier: "standard",
        license_expires_at: futureDate,
      });

      const updateStmt = createMockD1Statement();
      updateStmt.run.mockResolvedValue({ success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getStmt;
        return updateStmt;
      });

      const res = await fetchApp(
        "/api/v1/licenses/T-123/renew",
        jsonBody({ validityMonths: 12 }),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.addedMonths).toBe(12);
      expect(body.data.tier).toBe("standard");
    });

    it("should default to 12 months when validityMonths not provided", async () => {
      const db = mockDb();
      const getStmt = createMockD1Statement();
      getStmt.first.mockResolvedValue({
        id: "T-123",
        license_tier: "standard",
        license_expires_at: new Date().toISOString(),
      });

      const updateStmt = createMockD1Statement();
      updateStmt.run.mockResolvedValue({ success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getStmt;
        return updateStmt;
      });

      const res = await fetchApp("/api/v1/licenses/T-123/renew", jsonBody({}));

      const body: any = await res.json();
      expect(body.data.addedMonths).toBe(12);
    });

    it("should return 404 for non-existent tenant", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/licenses/T-NONEXISTENT/renew",
        jsonBody({ validityMonths: 12 }),
      );

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // POST /api/v1/licenses/:tenantId/upgrade
  // ============================================================
  describe("POST /api/v1/licenses/:tenantId/upgrade", () => {
    it("should upgrade license tier", async () => {
      const db = mockDb();

      const getStmt = createMockD1Statement();
      getStmt.first.mockResolvedValue({
        id: "T-123",
        license_tier: "standard",
      });

      const updateStmt = createMockD1Statement();
      updateStmt.run.mockResolvedValue({ success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getStmt;
        return updateStmt;
      });

      const res = await fetchApp(
        "/api/v1/licenses/T-123/upgrade",
        jsonBody({ tier: "professional" }),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.previousTier).toBe("standard");
      expect(body.data.newTier).toBe("professional");
      expect(body.data.newLicenseKey).toMatch(/^MKM-PRO-/);
      expect(body.data.features.maxRestaurants).toBe(3);
    });

    it("should return 400 for invalid tier", async () => {
      const res = await fetchApp(
        "/api/v1/licenses/T-123/upgrade",
        jsonBody({ tier: "ultra-premium" }),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("should return 404 for non-existent tenant", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/licenses/T-NONEXISTENT/upgrade",
        jsonBody({ tier: "enterprise" }),
      );

      expect(res.status).toBe(404);
    });
  });
});
