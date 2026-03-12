/**
 * Tests for AlertService
 *
 * Covers: health check processing, deployment failure alerts,
 *         Slack notification, alert resolution
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AlertService } from "../../services/AlertService";
import { createMockEnv } from "../setup";
import type { ManagementEnv, Tenant, HealthCheck } from "../../types";

let env: ManagementEnv;
let service: AlertService;

function createTestTenant(overrides?: Partial<Tenant>): Tenant {
  return {
    id: "T-20240101-ABC",
    businessName: "Test Restaurant",
    contactEmail: "test@example.com",
    subdomain: "test-restaurant",
    licenseTier: "standard",
    licenseKey: "MKM-STD-TEST-XY12",
    status: "active",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createTestHealthCheck(overrides?: Partial<HealthCheck>): HealthCheck {
  return {
    id: "hc-123",
    tenantId: "T-20240101-ABC",
    status: "healthy",
    responseTimeMs: 120,
    checkedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("AlertService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    service = new AlertService(env);
  });

  // ============================================================
  // processHealthCheck
  // ============================================================
  describe("processHealthCheck", () => {
    it("should return null for healthy status and resolve existing alerts", async () => {
      const tenant = createTestTenant();
      const healthCheck = createTestHealthCheck({ status: "healthy" });

      const alert = await service.processHealthCheck(tenant, healthCheck);
      expect(alert).toBeNull();
    });

    it("should create critical alert for down status", async () => {
      // Mock fetch for Slack notification
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response("ok")) as typeof fetch;

      try {
        const tenant = createTestTenant();
        const healthCheck = createTestHealthCheck({ status: "down" });

        const alert = await service.processHealthCheck(tenant, healthCheck);
        expect(alert).not.toBeNull();
        expect(alert!.severity).toBe("critical");
        expect(alert!.tenantId).toBe("T-20240101-ABC");
        expect(alert!.status).toBe("active");
        expect(alert!.title).toContain("Test Restaurant");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should create warning alert for degraded status", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response("ok")) as typeof fetch;

      try {
        const tenant = createTestTenant();
        const healthCheck = createTestHealthCheck({ status: "degraded" });

        const alert = await service.processHealthCheck(tenant, healthCheck);
        expect(alert).not.toBeNull();
        expect(alert!.severity).toBe("warning");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should include response time in alert message", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response("ok")) as typeof fetch;

      try {
        const tenant = createTestTenant();
        const healthCheck = createTestHealthCheck({
          status: "degraded",
          responseTimeMs: 5000,
        });

        const alert = await service.processHealthCheck(tenant, healthCheck);
        expect(alert!.message).toContain("5000");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should include component details in alert message when present", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response("ok")) as typeof fetch;

      try {
        const tenant = createTestTenant();
        const healthCheck = createTestHealthCheck({
          status: "down",
          details: JSON.stringify({ api: "down", db: "slow" }),
        });

        const alert = await service.processHealthCheck(tenant, healthCheck);
        expect(alert!.message).toContain("api");
        expect(alert!.message).toContain("db");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should send Slack notification when webhook URL is configured", async () => {
      const originalFetch = globalThis.fetch;
      const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
      globalThis.fetch = mockFetch as typeof fetch;

      try {
        const tenant = createTestTenant();
        const healthCheck = createTestHealthCheck({ status: "down" });

        await service.processHealthCheck(tenant, healthCheck);

        expect(mockFetch).toHaveBeenCalledWith(
          "https://hooks.slack.com/test",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }),
        );

        // Verify Slack payload structure
        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.attachments).toBeDefined();
        expect(callBody.attachments[0].color).toBe("#dc2626"); // critical = red
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should not send Slack notification when webhook URL is not configured", async () => {
      env = createMockEnv({ SLACK_WEBHOOK_URL: undefined });
      service = new AlertService(env);

      const originalFetch = globalThis.fetch;
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch as typeof fetch;

      try {
        const tenant = createTestTenant();
        const healthCheck = createTestHealthCheck({ status: "down" });
        await service.processHealthCheck(tenant, healthCheck);

        // Fetch should not be called at all
        expect(mockFetch).not.toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ============================================================
  // processDeploymentFailure
  // ============================================================
  describe("processDeploymentFailure", () => {
    it("should create critical alert for deployment failure", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response("ok")) as typeof fetch;

      try {
        const tenant = createTestTenant();

        const alert = await service.processDeploymentFailure(
          tenant,
          "deploy-123",
          "Worker deploy failed",
        );

        expect(alert.severity).toBe("critical");
        expect(alert.ruleId).toBe("deployment_failed");
        expect(alert.message).toContain("deploy-123");
        expect(alert.message).toContain("Worker deploy failed");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ============================================================
  // getActiveAlerts
  // ============================================================
  describe("getActiveAlerts", () => {
    it("should return empty array (placeholder implementation)", async () => {
      const alerts = await service.getActiveAlerts();
      expect(alerts).toEqual([]);
    });

    it("should accept optional tenantId parameter", async () => {
      const alerts = await service.getActiveAlerts("T-1");
      expect(alerts).toEqual([]);
    });
  });

  // ============================================================
  // resolveAlerts / acknowledgeAlert
  // ============================================================
  describe("resolveAlerts", () => {
    it("should not throw", async () => {
      await expect(
        service.resolveAlerts("T-1", "health"),
      ).resolves.not.toThrow();
    });
  });

  describe("acknowledgeAlert", () => {
    it("should not throw", async () => {
      await expect(service.acknowledgeAlert("alert-1")).resolves.not.toThrow();
    });
  });
});
