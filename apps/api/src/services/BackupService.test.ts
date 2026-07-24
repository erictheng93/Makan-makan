import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  D1Database,
  KVNamespace,
  R2Bucket,
} from "@cloudflare/workers-types";

const mocks = vi.hoisted(() => {
  const db = {
    select: vi.fn(),
    selectDistinct: vi.fn(),
    insert: vi.fn(),
  };
  return { db };
});

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

import { backupAlerts, systemAlerts } from "@makanmakan/database";
import { BackupService } from "./BackupService";

function createService() {
  return new BackupService({} as D1Database, {} as R2Bucket, {} as KVNamespace);
}

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

type HealthQueryFixture = {
  running?: number;
  failed24h?: number;
  windowFailed?: number;
  windowCompleted?: Array<Record<string, unknown>>;
  lastSuccess?: Array<Record<string, unknown>>;
  restaurants?: Array<Record<string, unknown>>;
  configs?: number;
  totalBytes?: unknown;
  alerts?: Array<Record<string, unknown>>;
};

// Must match the query order inside getSystemHealth.
function mockHealthQueries(fixture: HealthQueryFixture) {
  const selectResults: unknown[] = [
    [{ total: fixture.running ?? 0 }],
    [{ total: fixture.failed24h ?? 0 }],
    [{ total: fixture.windowFailed ?? 0 }],
    fixture.windowCompleted ?? [],
    fixture.lastSuccess ?? [],
    [{ total: fixture.configs ?? 0 }],
    [{ totalBytes: fixture.totalBytes ?? null }],
    fixture.alerts ?? [],
  ];
  mocks.db.select.mockImplementation(() =>
    createQuery(selectResults.shift() ?? []),
  );
  mocks.db.selectDistinct.mockImplementation(() =>
    createQuery(fixture.restaurants ?? []),
  );
}

describe("BackupService (worker monitoring path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  describe("getSystemHealth", () => {
    it("reports an idle healthy system when no backup data exists", async () => {
      // Empty tables: every query resolves to no rows at all.
      mocks.db.select.mockImplementation(() => createQuery([]));
      mocks.db.selectDistinct.mockImplementation(() => createQuery([]));

      const service = createService();
      const health = await service.getSystemHealth();

      expect(health).toMatchObject({
        overall_status: "healthy",
        total_restaurants: 0,
        active_configurations: 0,
        running_backups: 0,
        failed_backups_24h: 0,
        last_successful_backup_at: null,
        storage_usage: { total_bytes: 0 },
        performance_metrics: {
          average_backup_duration_minutes: 0,
          average_success_rate_percentage: 100,
          average_compression_ratio: 1,
        },
        alerts_summary: { critical: 0, high: 0, medium: 0, low: 0 },
      });
      expect(mocks.db.select).toHaveBeenCalledTimes(8);
      expect(mocks.db.selectDistinct).toHaveBeenCalledTimes(1);
    });

    it("aggregates real counts and derives critical status from failures", async () => {
      const startedAt = new Date("2026-07-16T01:00:00Z");
      const completedAt = new Date("2026-07-16T01:02:00Z");
      mockHealthQueries({
        running: 1,
        failed24h: 12,
        windowFailed: 9,
        windowCompleted: [
          {
            startedAt,
            completedAt,
            fileSize: 1000,
            compressedSize: 500,
          },
          {
            startedAt,
            completedAt,
            fileSize: 2000,
            compressedSize: 1000,
          },
          {
            startedAt,
            completedAt,
            fileSize: 0,
            compressedSize: 0,
          },
        ],
        lastSuccess: [{ completedAt }],
        restaurants: [{ restaurantId: "rest-1" }, { restaurantId: "rest-2" }],
        configs: 4,
        totalBytes: "3000",
        alerts: [
          { severity: "critical" },
          { severity: "medium" },
          { severity: "medium" },
        ],
      });

      const service = createService();
      const health = await service.getSystemHealth();

      expect(health).toMatchObject({
        overall_status: "critical",
        total_restaurants: 2,
        active_configurations: 4,
        running_backups: 1,
        failed_backups_24h: 12,
        last_successful_backup_at: completedAt.toISOString(),
        storage_usage: { total_bytes: 3000 },
        alerts_summary: { critical: 1, high: 0, medium: 2, low: 0 },
      });
      // 3 completed vs 9 failed in window → 25% success rate.
      expect(
        health.performance_metrics.average_success_rate_percentage,
      ).toBeCloseTo(25);
      // Every completed backup took 2 minutes.
      expect(
        health.performance_metrics.average_backup_duration_minutes,
      ).toBeCloseTo(2);
      // Compression ratio averaged only over rows with sizes: 0.5.
      expect(health.performance_metrics.average_compression_ratio).toBeCloseTo(
        0.5,
      );
      expect(mocks.db.select).toHaveBeenCalledTimes(8);
      expect(mocks.db.selectDistinct).toHaveBeenCalledTimes(1);
    });

    it("derives warning status when failures in 24h exceed the warning threshold", async () => {
      mockHealthQueries({ failed24h: 6 });

      const service = createService();
      const health = await service.getSystemHealth();

      expect(health.overall_status).toBe("warning");
      expect(health.failed_backups_24h).toBe(6);
    });

    it("derives warning status from a low success rate with enough samples", async () => {
      const startedAt = new Date("2026-07-15T01:00:00Z");
      const completedAt = new Date("2026-07-15T01:01:00Z");
      mockHealthQueries({
        failed24h: 0,
        windowFailed: 3,
        windowCompleted: Array.from({ length: 7 }, () => ({
          startedAt,
          completedAt,
          fileSize: 100,
          compressedSize: 50,
        })),
      });

      const service = createService();
      const health = await service.getSystemHealth();

      expect(health.overall_status).toBe("warning");
      expect(
        health.performance_metrics.average_success_rate_percentage,
      ).toBeCloseTo(70);
    });

    it("stays healthy when a low success rate has too few samples", async () => {
      // 1 completed vs 1 failed = 50%, but only 2 backups in the window.
      const startedAt = new Date("2026-07-15T01:00:00Z");
      mockHealthQueries({
        windowFailed: 1,
        windowCompleted: [
          {
            startedAt,
            completedAt: new Date("2026-07-15T01:01:00Z"),
            fileSize: 100,
            compressedSize: 50,
          },
        ],
      });

      const service = createService();
      const health = await service.getSystemHealth();

      expect(health.overall_status).toBe("healthy");
    });

    it("wraps query errors in a stable error message", async () => {
      mocks.db.select.mockImplementation(() => {
        throw new Error("D1 exploded");
      });

      const service = createService();

      await expect(service.getSystemHealth()).rejects.toThrow(
        "Failed to get backup system health",
      );
    });
  });

  describe("createAlert", () => {
    it("persists restaurant alerts to backup_alerts with title and context in details", async () => {
      const values = vi.fn(async (payload: unknown) => payload);
      mocks.db.insert.mockReturnValue({ values });

      const service = createService();
      await service.createAlert(
        {
          restaurant_id: "rest-1",
          alert_type: "schedule_missed",
          severity: "high",
          title: "Scheduled Backup Failed",
          message: "Failed to start scheduled backup",
          related_backup_id: "backup-9",
        },
        { source: "scheduler" },
      );

      expect(mocks.db.insert).toHaveBeenCalledOnce();
      expect(mocks.db.insert).toHaveBeenCalledWith(backupAlerts);
      expect(values).toHaveBeenCalledOnce();
      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          restaurantId: "rest-1",
          alertType: "schedule_missed",
          severity: "high",
          message: "Failed to start scheduled backup",
          details: expect.objectContaining({
            title: "Scheduled Backup Failed",
            related_backup_id: "backup-9",
            source: "scheduler",
          }),
          acknowledged: false,
          resolved: false,
          triggeredAt: expect.any(Date),
        }),
      );
    });

    it("persists system-wide alerts to system_alerts with a null restaurant scope", async () => {
      // backup_alerts.restaurant_id is guarded by a DB trigger requiring a
      // real restaurants.id, so 'system' alerts must land in system_alerts.
      const values = vi.fn(async (payload: unknown) => payload);
      mocks.db.insert.mockReturnValue({ values });

      const service = createService();
      await service.createAlert(
        {
          restaurant_id: "system",
          alert_type: "backup_failed",
          severity: "critical",
          title: "Backup System Unhealthy",
          message: "12 failed backups in the last 24 hours",
        },
        { failed_backups_24h: 12 },
      );

      expect(mocks.db.insert).toHaveBeenCalledOnce();
      expect(mocks.db.insert).toHaveBeenCalledWith(systemAlerts);
      expect(values).toHaveBeenCalledOnce();
      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Backup System Unhealthy",
          description: expect.stringContaining(
            "12 failed backups in the last 24 hours",
          ),
          severity: "critical",
          alertType: "backup_failed",
          restaurantId: null,
          affectedComponent: "backup",
          createdAt: expect.any(Date),
        }),
      );
      const payload = values.mock.calls[0][0] as { description: string };
      expect(payload.description).toContain('"failed_backups_24h":12');
    });

    it("applies system-wide defaults for sparse alerts", async () => {
      const values = vi.fn(async (payload: unknown) => payload);
      mocks.db.insert.mockReturnValue({ values });

      const service = createService();
      await service.createAlert({ title: "Something happened" });

      expect(mocks.db.insert).toHaveBeenCalledWith(systemAlerts);
      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Something happened",
          description: "Something happened",
          alertType: "backup_failed",
          severity: "medium",
          restaurantId: null,
          affectedComponent: "backup",
        }),
      );
    });
  });
});
