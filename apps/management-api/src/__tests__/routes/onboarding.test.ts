/**
 * Tests for Onboarding Routes
 *
 * Covers: subdomain check, create application, get application,
 *         verify cloudflare, complete application
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../../index";
import {
  createMockEnv,
  createMockD1Statement,
  createTestApplicationRow,
  createTestTenantRow,
} from "../setup";
import type { ManagementEnv } from "../../types";

let env: ManagementEnv;

function mockDb() {
  return env.MANAGEMENT_DB as unknown as {
    prepare: ReturnType<typeof vi.fn>;
  };
}

async function fetchApp(path: string, options?: RequestInit) {
  const request = new Request(`http://localhost${path}`, options);
  return app.fetch(request, env);
}

function jsonBody(data: unknown) {
  return {
    method: "POST" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

describe("Onboarding Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
  });

  // ============================================================
  // GET /api/v1/onboarding/subdomain/check
  // ============================================================
  describe("GET /api/v1/onboarding/subdomain/check", () => {
    it("should return available when subdomain is free", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null); // tenant not found, app not found
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/onboarding/subdomain/check?subdomain=new-shop",
      );
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.available).toBe(true);
      expect(body.data.subdomain).toBe("new-shop");
    });

    it("should return unavailable with suggestions when taken", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      // First call (tenant check) returns a tenant -> taken
      stmt.first.mockResolvedValue(createTestTenantRow());
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/onboarding/subdomain/check?subdomain=test-restaurant",
      );
      const body: any = await res.json();
      expect(body.data.available).toBe(false);
      expect(body.data.suggestions).toBeInstanceOf(Array);
      expect(body.data.suggestions.length).toBeGreaterThan(0);
    });

    it("should return 400 when subdomain param is missing", async () => {
      const res = await fetchApp("/api/v1/onboarding/subdomain/check");
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("MISSING_SUBDOMAIN");
    });

    it("should return 400 for invalid subdomain format", async () => {
      const res = await fetchApp(
        "/api/v1/onboarding/subdomain/check?subdomain=AB",
      );
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("INVALID_SUBDOMAIN");
    });

    it("should return 400 for subdomain with uppercase", async () => {
      const res = await fetchApp(
        "/api/v1/onboarding/subdomain/check?subdomain=UPPER-CASE",
      );
      expect(res.status).toBe(400);
    });

    it("should return 400 for subdomain too long", async () => {
      const longSubdomain = "a".repeat(31);
      const res = await fetchApp(
        `/api/v1/onboarding/subdomain/check?subdomain=${longSubdomain}`,
      );
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // POST /api/v1/onboarding/applications
  // ============================================================
  describe("POST /api/v1/onboarding/applications", () => {
    it("should create an application with valid data", async () => {
      const db = mockDb();
      const appRow = createTestApplicationRow();

      // subdomain checks (tenant + app), insert, getApplication
      const stmt = createMockD1Statement();
      stmt.first
        .mockResolvedValueOnce(null) // tenant check
        .mockResolvedValueOnce(null) // app check
        .mockResolvedValue(appRow); // get after insert
      stmt.run.mockResolvedValue({ success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/onboarding/applications",
        jsonBody({
          businessName: "New Restaurant",
          contactName: "John Doe",
          contactEmail: "john@example.com",
          contactPhone: "+60123456789",
          planId: "standard",
          subdomain: "new-restaurant",
        }),
      );

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.applicationId).toBeDefined();
      expect(body.data.status).toBe("submitted");
    });

    it("should return 400 for invalid email", async () => {
      const res = await fetchApp(
        "/api/v1/onboarding/applications",
        jsonBody({
          businessName: "Restaurant",
          contactName: "John",
          contactEmail: "not-email",
          contactPhone: "+60123456789",
          planId: "standard",
        }),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for phone number too short", async () => {
      const res = await fetchApp(
        "/api/v1/onboarding/applications",
        jsonBody({
          businessName: "Restaurant",
          contactName: "John",
          contactEmail: "john@example.com",
          contactPhone: "123",
          planId: "standard",
        }),
      );

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid plan", async () => {
      const res = await fetchApp(
        "/api/v1/onboarding/applications",
        jsonBody({
          businessName: "Restaurant",
          contactName: "John",
          contactEmail: "john@example.com",
          contactPhone: "+60123456789",
          planId: "gold-plan",
        }),
      );

      expect(res.status).toBe(400);
    });

    it("should return 400 for missing required fields", async () => {
      const res = await fetchApp(
        "/api/v1/onboarding/applications",
        jsonBody({
          businessName: "Restaurant",
          // missing contactName, contactEmail, contactPhone, planId
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // GET /api/v1/onboarding/applications/:id
  // ============================================================
  describe("GET /api/v1/onboarding/applications/:id", () => {
    it("should return application by ID", async () => {
      const db = mockDb();
      const appRow = createTestApplicationRow();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(appRow);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/onboarding/applications/APP-20240101-XYZ",
      );
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("APP-20240101-XYZ");
      expect(body.data.businessName).toBe("New Restaurant");
      // Should not expose sensitive fields
      expect(body.data.ipAddress).toBeUndefined();
      expect(body.data.userAgent).toBeUndefined();
    });

    it("should return 404 for non-existent application", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/onboarding/applications/APP-NONEXISTENT",
      );
      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // POST /api/v1/onboarding/applications/:id/verify-cloudflare
  // ============================================================
  describe("POST /api/v1/onboarding/applications/:id/verify-cloudflare", () => {
    it("should return 404 when application not found", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/onboarding/applications/APP-NONEXISTENT/verify-cloudflare",
        jsonBody({
          accountId: "a".repeat(32),
          apiToken: "t".repeat(40),
        }),
      );

      expect(res.status).toBe(404);
    });

    it("should return 400 when application not in submitted status", async () => {
      const db = mockDb();
      const appRow = createTestApplicationRow({ status: "cf_verified" });
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(appRow);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/onboarding/applications/APP-20240101-XYZ/verify-cloudflare",
        jsonBody({
          accountId: "a".repeat(32),
          apiToken: "t".repeat(40),
        }),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("INVALID_STATUS");
    });

    it("should return 400 for invalid accountId length", async () => {
      const res = await fetchApp(
        "/api/v1/onboarding/applications/APP-20240101-XYZ/verify-cloudflare",
        jsonBody({
          accountId: "too-short",
          apiToken: "t".repeat(40),
        }),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for API token too short", async () => {
      const res = await fetchApp(
        "/api/v1/onboarding/applications/APP-20240101-XYZ/verify-cloudflare",
        jsonBody({
          accountId: "a".repeat(32),
          apiToken: "short",
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // POST /api/v1/onboarding/applications/:id/complete
  // ============================================================
  describe("POST /api/v1/onboarding/applications/:id/complete", () => {
    it("should return 404 when application not found", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/onboarding/applications/APP-NONEXISTENT/complete",
        jsonBody({}),
      );

      expect(res.status).toBe(404);
    });

    it("should return 400 when application not in cf_verified status", async () => {
      const db = mockDb();
      const appRow = createTestApplicationRow({ status: "submitted" });
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(appRow);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/onboarding/applications/APP-20240101-XYZ/complete",
        jsonBody({}),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("INVALID_STATUS");
    });

    it("should return 400 for provisioning status", async () => {
      const db = mockDb();
      const appRow = createTestApplicationRow({ status: "provisioning" });
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(appRow);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/onboarding/applications/APP-20240101-XYZ/complete",
        jsonBody({}),
      );

      expect(res.status).toBe(400);
    });
  });
});
