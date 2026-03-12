/**
 * Tests for CloudflareApiClient
 *
 * Covers: token verification, permission checks, resource creation (D1, KV, R2),
 *         worker deployment, migration execution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CloudflareApiClient } from "../../services/CloudflareApiClient";
import { createMockEnv } from "../setup";
import type { ManagementEnv } from "../../types";

let env: ManagementEnv;
let client: CloudflareApiClient;
let originalFetch: typeof globalThis.fetch;

function mockCfApiResponse(
  success: boolean,
  result: unknown = {},
  errors: Array<{ code: number; message: string }> = [],
) {
  return new Response(
    JSON.stringify({ success, result, errors, messages: [] }),
    { status: success ? 200 : 400 },
  );
}

describe("CloudflareApiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    client = new CloudflareApiClient(env);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ============================================================
  // verifyToken
  // ============================================================
  describe("verifyToken", () => {
    it("should return true when API responds with success", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(mockCfApiResponse(true)) as typeof fetch;

      const result = await client.verifyToken("valid-token", "account-123");
      expect(result).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/accounts/account-123"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer valid-token",
          }),
        }),
      );
    });

    it("should return false when API responds with failure", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(mockCfApiResponse(false)) as typeof fetch;

      const result = await client.verifyToken("bad-token", "account-123");
      expect(result).toBe(false);
    });

    it("should return false when fetch throws", async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error("Network error")) as typeof fetch;

      const result = await client.verifyToken("token", "account");
      expect(result).toBe(false);
    });
  });

  // ============================================================
  // verifyTokenWithPermissions
  // ============================================================
  describe("verifyTokenWithPermissions", () => {
    it("should return invalid when basic account check fails", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(mockCfApiResponse(false)) as typeof fetch;

      const result = await client.verifyTokenWithPermissions(
        "bad-token",
        "account-123",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid");
      expect(result.permissions.workers).toBe(false);
    });

    it("should check all permission endpoints in parallel", async () => {
      const fetchMock = vi.fn();
      // Each call must get its own fresh Response (body can only be consumed once)
      fetchMock.mockImplementation(() =>
        Promise.resolve(mockCfApiResponse(true)),
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const result = await client.verifyTokenWithPermissions(
        "token",
        "account-123",
      );
      expect(result.valid).toBe(true);
      expect(result.permissions.workers).toBe(true);
      expect(result.permissions.d1).toBe(true);
      expect(result.permissions.kv).toBe(true);
      expect(result.permissions.r2).toBe(true);
      expect(result.permissions.pages).toBe(true);

      // Account + 5 permission checks = 6 total calls
      expect(fetchMock).toHaveBeenCalledTimes(6);
    });

    it("should handle partial permissions", async () => {
      const fetchMock = vi.fn();
      // Account check succeeds
      fetchMock.mockResolvedValueOnce(mockCfApiResponse(true));
      // Workers: success
      fetchMock.mockResolvedValueOnce(mockCfApiResponse(true));
      // D1: fail
      fetchMock.mockResolvedValueOnce(mockCfApiResponse(false));
      // KV: success
      fetchMock.mockResolvedValueOnce(mockCfApiResponse(true));
      // R2: fail
      fetchMock.mockResolvedValueOnce(mockCfApiResponse(false));
      // Pages: success
      fetchMock.mockResolvedValueOnce(mockCfApiResponse(true));
      globalThis.fetch = fetchMock as typeof fetch;

      const result = await client.verifyTokenWithPermissions(
        "token",
        "account-123",
      );
      expect(result.valid).toBe(true);
      expect(result.permissions.workers).toBe(true);
      expect(result.permissions.d1).toBe(false);
      expect(result.permissions.kv).toBe(true);
      expect(result.permissions.r2).toBe(false);
      expect(result.permissions.pages).toBe(true);
    });

    it("should handle permission check errors gracefully", async () => {
      const fetchMock = vi.fn();
      fetchMock.mockResolvedValueOnce(mockCfApiResponse(true)); // account
      fetchMock.mockRejectedValue(new Error("timeout")); // all permission checks fail
      globalThis.fetch = fetchMock as typeof fetch;

      const result = await client.verifyTokenWithPermissions(
        "token",
        "account-123",
      );
      // valid is still true (account check passed) but permissions are false
      expect(result.valid).toBe(true);
      expect(result.permissions.workers).toBe(false);
      expect(result.permissions.d1).toBe(false);
    });
  });

  // ============================================================
  // createD1Database
  // ============================================================
  describe("createD1Database", () => {
    it("should create D1 database and return info", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(
          mockCfApiResponse(true, { uuid: "d1-uuid-123", name: "test-db" }),
        ) as typeof fetch;

      const result = await client.createD1Database(
        "token",
        "account-123",
        "test-db",
      );
      expect(result.success).toBe(true);
      expect(result.database).toBeDefined();
      expect(result.database!.uuid).toBe("d1-uuid-123");
    });

    it("should return error on failure", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(
          mockCfApiResponse(false, null, [
            { code: 1000, message: "Database already exists" },
          ]),
        ) as typeof fetch;

      const result = await client.createD1Database(
        "token",
        "account-123",
        "test-db",
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Database already exists");
    });

    it("should handle network errors", async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error("Network error")) as typeof fetch;

      const result = await client.createD1Database(
        "token",
        "account-123",
        "test-db",
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });

  // ============================================================
  // createKVNamespace
  // ============================================================
  describe("createKVNamespace", () => {
    it("should create KV namespace and return info", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(
          mockCfApiResponse(true, { id: "kv-id-123", title: "test-cache" }),
        ) as typeof fetch;

      const result = await client.createKVNamespace(
        "token",
        "account-123",
        "test-cache",
      );
      expect(result.success).toBe(true);
      expect(result.namespace!.id).toBe("kv-id-123");
    });

    it("should return error on failure", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(
          mockCfApiResponse(false, null, [
            { code: 1001, message: "Namespace limit reached" },
          ]),
        ) as typeof fetch;

      const result = await client.createKVNamespace(
        "token",
        "account-123",
        "test-cache",
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Namespace limit reached");
    });
  });

  // ============================================================
  // createR2Bucket
  // ============================================================
  describe("createR2Bucket", () => {
    it("should create R2 bucket and return info", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockCfApiResponse(true, {
          name: "test-storage",
          creation_date: "2024-01-01",
        }),
      ) as typeof fetch;

      const result = await client.createR2Bucket(
        "token",
        "account-123",
        "test-storage",
      );
      expect(result.success).toBe(true);
      expect(result.bucket!.name).toBe("test-storage");
    });

    it("should return error on failure", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(
          mockCfApiResponse(false, null, [
            { code: 1002, message: "Bucket name taken" },
          ]),
        ) as typeof fetch;

      const result = await client.createR2Bucket(
        "token",
        "account-123",
        "test-storage",
      );
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // deployWorker
  // ============================================================
  describe("deployWorker", () => {
    it("should deploy worker successfully", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(mockCfApiResponse(true)) as typeof fetch;

      const result = await client.deployWorker(
        "token",
        "account-123",
        "test-api",
        "export default { fetch() { return new Response('ok') } }",
        [],
      );
      expect(result.success).toBe(true);
    });

    it("should return error on deploy failure", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(
          mockCfApiResponse(false, null, [
            { code: 1003, message: "Script too large" },
          ]),
        ) as typeof fetch;

      const result = await client.deployWorker(
        "token",
        "account-123",
        "test-api",
        "// large script",
        [],
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Script too large");
    });
  });

  // ============================================================
  // runD1Migration
  // ============================================================
  describe("runD1Migration", () => {
    it("should run migration SQL successfully", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(mockCfApiResponse(true)) as typeof fetch;

      const result = await client.runD1Migration(
        "token",
        "account-123",
        "d1-uuid",
        "CREATE TABLE test (id TEXT PRIMARY KEY)",
      );
      expect(result.success).toBe(true);
    });

    it("should return error on migration failure", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(
          mockCfApiResponse(false, null, [
            { code: 1004, message: "SQL syntax error" },
          ]),
        ) as typeof fetch;

      const result = await client.runD1Migration(
        "token",
        "account-123",
        "d1-uuid",
        "INVALID SQL",
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("SQL syntax error");
    });
  });

  // ============================================================
  // getWorkerInfo
  // ============================================================
  describe("getWorkerInfo", () => {
    it("should return worker info on success", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("script-content", {
          status: 200,
          headers: {
            etag: '"abc123"',
            "Content-Type": "application/javascript",
          },
        }),
      ) as typeof fetch;

      const result = await client.getWorkerInfo(
        "token",
        "account-123",
        "test-api",
      );
      expect(result.success).toBe(true);
      expect(result.info).toBeDefined();
    });

    it("should return error for non-existent worker", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(
          new Response("", { status: 404, statusText: "Not Found" }),
        ) as typeof fetch;

      const result = await client.getWorkerInfo(
        "token",
        "account-123",
        "nonexistent",
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("404");
    });
  });

  // ============================================================
  // deleteWorker
  // ============================================================
  describe("deleteWorker", () => {
    it("should delete worker successfully", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(mockCfApiResponse(true)) as typeof fetch;

      const result = await client.deleteWorker(
        "token",
        "account-123",
        "test-api",
      );
      expect(result.success).toBe(true);
    });
  });
});
