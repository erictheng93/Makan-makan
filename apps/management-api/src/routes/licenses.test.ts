/**
 * Bug-inventory #9: `POST /api/v1/licenses/verify` must be publicly reachable
 * (cross-service callers authenticate via the licenseKey payload), while every
 * other `/licenses/*` route stays behind the management Bearer middleware.
 */
import { describe, expect, it } from "vitest";
import app from "../index";
import type { ManagementEnv } from "../types";

function createEnv(): ManagementEnv {
  return {
    NODE_ENV: "test",
    API_VERSION: "v1",
    API_BASE_URL: "http://localhost",
    CORS_ORIGIN: "http://localhost:3010",
    LOG_LEVEL: "error",
    JWT_SECRET: "test-secret",
    ENCRYPTION_KEY: "a".repeat(32),
    CF_API_TOKEN: "test-token",
    CF_ACCOUNT_ID: "test-account",
    // Minimal D1 stub: the verify handler only needs prepare().bind().first().
    MANAGEMENT_DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          run: async () => ({}),
        }),
      }),
    } as unknown as D1Database,
    CACHE_KV: {} as KVNamespace,
    DEPLOYMENT_STATUS_KV: {} as KVNamespace,
    BUNDLE_STORAGE: {} as R2Bucket,
  };
}

describe("licenses route auth exemption (bug #9)", () => {
  it("allows POST /licenses/verify without a Bearer token", async () => {
    const response = await app.fetch(
      new Request("https://management.test/api/v1/licenses/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "tenant-1",
          licenseKey: "MK-STANDARD-XXXX",
          version: "1.0.0",
          timestamp: Date.now(),
        }),
      }),
      createEnv(),
    );

    // Reaches the handler (no 401). Unknown license → { valid: false }.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ valid: false });
  });

  it("still protects GET /licenses/:tenantId without a Bearer token", async () => {
    const response = await app.fetch(
      new Request("https://management.test/api/v1/licenses/tenant-1"),
      createEnv(),
    );

    expect(response.status).toBe(401);
  });

  it("still protects POST /licenses/generate without a Bearer token", async () => {
    const response = await app.fetch(
      new Request("https://management.test/api/v1/licenses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: "tenant-1", tier: "standard" }),
      }),
      createEnv(),
    );

    expect(response.status).toBe(401);
  });
});
