import { describe, it, expect, vi, beforeEach } from "vitest";
import { MigrationService } from "../../services/MigrationService";
import type { MigrationFile } from "../../services/MigrationService";
import { createMockEnv, createMockD1Statement } from "../setup";
import type { ManagementEnv } from "../../types";

let env: ManagementEnv;
let service: MigrationService;

function mockDb() {
  return env.MANAGEMENT_DB as unknown as {
    prepare: ReturnType<typeof vi.fn>;
  };
}

describe("MigrationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    service = new MigrationService(env);
    // Mock global fetch for CloudflareApiClient
    vi.stubGlobal("fetch", vi.fn());
  });

  describe("getAppliedMigrations", () => {
    it("should return empty array when no migrations applied", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({ results: [], success: true });
      db.prepare.mockReturnValue(stmt);

      const result = await service.getAppliedMigrations("T-123");
      expect(result).toEqual([]);
      expect(stmt.bind).toHaveBeenCalledWith("T-123");
    });

    it("should return migration records", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({
        results: [
          {
            id: "mig-1",
            tenant_id: "T-123",
            migration_name: "0001_initial.sql",
            checksum: "chk-abc123",
            applied_at: "2024-01-01T00:00:00Z",
            success: 1,
            error_message: null,
          },
        ],
        success: true,
      });
      db.prepare.mockReturnValue(stmt);

      const result = await service.getAppliedMigrations("T-123");
      expect(result).toHaveLength(1);
      expect(result[0].migrationName).toBe("0001_initial.sql");
      expect(result[0].success).toBe(true);
    });
  });

  describe("applyPendingMigrations", () => {
    const migrations: MigrationFile[] = [
      {
        name: "0001_create_users.sql",
        sql: "CREATE TABLE users (id TEXT);",
        checksum: "chk-001",
      },
      {
        name: "0002_create_orders.sql",
        sql: "CREATE TABLE orders (id TEXT);",
        checksum: "chk-002",
      },
    ];

    it("should skip already-applied migrations", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({
        results: [
          {
            id: "mig-1",
            tenant_id: "T-123",
            migration_name: "0001_create_users.sql",
            checksum: "chk-001",
            applied_at: "2024-01-01T00:00:00Z",
            success: 1,
            error_message: null,
          },
          {
            id: "mig-2",
            tenant_id: "T-123",
            migration_name: "0002_create_orders.sql",
            checksum: "chk-002",
            applied_at: "2024-01-01T00:00:00Z",
            success: 1,
            error_message: null,
          },
        ],
        success: true,
      });
      db.prepare.mockReturnValue(stmt);

      const result = await service.applyPendingMigrations(
        "T-123",
        "token",
        "acc-123",
        "db-123",
        migrations,
      );

      expect(result.totalSkipped).toBe(2);
      expect(result.totalApplied).toBe(0);
      expect(result.totalFailed).toBe(0);
    });

    it("should apply pending migrations in order", async () => {
      const db = mockDb();
      // First call: getAppliedMigrations returns empty
      const getStmt = createMockD1Statement();
      getStmt.all.mockResolvedValue({ results: [], success: true });

      // Subsequent calls: recordMigration
      const insertStmt = createMockD1Statement();
      insertStmt.run.mockResolvedValue({ success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getStmt;
        return insertStmt;
      });

      // Mock fetch for CF API migration execution
      const mockFetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            errors: [],
            messages: [],
            result: {},
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await service.applyPendingMigrations(
        "T-123",
        "token",
        "acc-123",
        "db-123",
        migrations,
      );

      expect(result.totalApplied).toBe(2);
      expect(result.totalSkipped).toBe(0);
      expect(result.totalFailed).toBe(0);
      expect(result.migrations[0].name).toBe("0001_create_users.sql");
      expect(result.migrations[1].name).toBe("0002_create_orders.sql");
    });

    it("should stop on first failure", async () => {
      const db = mockDb();
      const getStmt = createMockD1Statement();
      getStmt.all.mockResolvedValue({ results: [], success: true });

      const insertStmt = createMockD1Statement();
      insertStmt.run.mockResolvedValue({ success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getStmt;
        return insertStmt;
      });

      // First migration succeeds, second fails
      let fetchCallCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          return {
            json: () =>
              Promise.resolve({
                success: true,
                errors: [],
                messages: [],
                result: {},
              }),
          };
        }
        return {
          json: () =>
            Promise.resolve({
              success: false,
              errors: [{ code: 1, message: "Syntax error" }],
              messages: [],
            }),
        };
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await service.applyPendingMigrations(
        "T-123",
        "token",
        "acc-123",
        "db-123",
        migrations,
      );

      expect(result.totalApplied).toBe(1);
      expect(result.totalFailed).toBe(1);
      expect(result.migrations[1].status).toBe("failed");
      expect(result.migrations[1].error).toContain("Syntax error");
    });
  });

  describe("computeChecksum", () => {
    it("should produce consistent checksums", () => {
      const sql = "CREATE TABLE test (id TEXT);";
      const chk1 = MigrationService.computeChecksum(sql);
      const chk2 = MigrationService.computeChecksum(sql);
      expect(chk1).toBe(chk2);
    });

    it("should produce different checksums for different inputs", () => {
      const chk1 = MigrationService.computeChecksum(
        "CREATE TABLE a (id TEXT);",
      );
      const chk2 = MigrationService.computeChecksum(
        "CREATE TABLE b (id TEXT);",
      );
      expect(chk1).not.toBe(chk2);
    });

    it("should return string starting with chk-", () => {
      const chk = MigrationService.computeChecksum("test");
      expect(chk).toMatch(/^chk-[0-9a-f]{8}$/);
    });
  });
});
