import { beforeEach, describe, expect, it, vi } from "vitest";

const drizzleState = vi.hoisted(() => ({
  db: undefined as unknown,
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => drizzleState.db),
}));

import { BackupSchedulerService } from "./BackupSchedulerService";

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function createDb(options?: {
  selectResults?: unknown[];
  runResults?: unknown[];
  throwOnRun?: Error;
  throwOnUpdate?: Error;
}) {
  const selectResults = [...(options?.selectResults ?? [])];
  const runResults = [...(options?.runResults ?? [])];
  const updates: unknown[] = [];

  return {
    updates,
    select: vi.fn(() => createQuery(selectResults.shift() ?? [])),
    update: vi.fn(() => {
      const builder = {
        set: vi.fn((payload: unknown) => {
          updates.push(payload);
          return builder;
        }),
        where: vi.fn(async () => {
          if (options?.throwOnUpdate) throw options.throwOnUpdate;
          return undefined;
        }),
      };
      return builder;
    }),
    run: vi.fn(async () => {
      if (options?.throwOnRun) throw options.throwOnRun;
      return runResults.shift() ?? { results: [] };
    }),
  };
}

function config(overrides: Record<string, unknown> = {}) {
  return {
    id: "config-1",
    restaurant_id: "restaurant-1",
    name: "Daily",
    backup_type: "full",
    include_tables: ["orders"],
    exclude_tables: ["audit_logs"],
    schedule_enabled: true,
    schedule_cron: "0 2 * * *",
    ...overrides,
  } as any;
}

function createService(options?: {
  db?: ReturnType<typeof createDb>;
  backupService?: { createBackup: ReturnType<typeof vi.fn> };
  analytics?: { writeDataPoint: ReturnType<typeof vi.fn> };
}) {
  const db = options?.db ?? createDb();
  drizzleState.db = db;
  const backupService = options?.backupService ?? {
    createBackup: vi.fn(async () => ({ backup_id: "backup-1" })),
  };
  const configService = {};
  const analytics = options?.analytics;
  const service = new BackupSchedulerService(
    {} as D1Database,
    backupService as never,
    configService as never,
    analytics as never,
  );
  return { service, db, backupService, analytics };
}

function currentIso() {
  return new Date().toISOString();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 7, 10, 0, 0));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "schedule-uuid") });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(console.log).mockRestore();
  vi.mocked(console.warn).mockRestore();
  vi.mocked(console.error).mockRestore();
  vi.useRealTimers();
});

describe("BackupSchedulerService", () => {
  it("processes due scheduled backups and records success analytics", async () => {
    const analytics = { writeDataPoint: vi.fn() };
    const db = createDb({
      selectResults: [
        [config({ schedule_cron: "0 10 * * *" })],
        [
          {
            id: "schedule-1",
            configurationId: "config-1",
            restaurantId: "restaurant-1",
            lastRunAt: undefined,
            nextRunAt: currentIso(),
            consecutiveFailures: 0,
            enabled: true,
          },
        ],
      ],
    });
    const { service, backupService } = createService({ db, analytics });

    await expect(service.processScheduledBackups()).resolves.toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0,
      errors: [],
    });
    expect(backupService.createBackup).toHaveBeenCalledWith(
      {
        restaurant_id: "restaurant-1",
        configuration_id: "config-1",
        name: `Scheduled_Daily_${currentIso().split("T")[0]}`,
        description: `Automated backup created by scheduler at ${currentIso()}`,
        backup_type: "full",
        include_tables: ["orders"],
        exclude_tables: ["audit_logs"],
        force_immediate: false,
      },
      "system",
    );
    expect(db.updates[0]).toMatchObject({
      lastRunAt: expect.any(Date),
      consecutiveFailures: 0,
    });
    expect(db.updates).toHaveLength(1);
    expect(analytics.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: ["scheduled_backup_created", "restaurant-1", "config-1"],
      }),
    );
  });

  it("skips disabled, invalid, recently-run, and failure-throttled schedules", async () => {
    const recentRun = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { service } = createService({
      db: createDb({
        selectResults: [
          [
            {
              id: "schedule-1",
              configurationId: "config-1",
              restaurantId: "restaurant-1",
              lastRunAt: recentRun,
              consecutiveFailures: 0,
              enabled: true,
            },
          ],
          [
            {
              id: "schedule-1",
              configurationId: "config-1",
              restaurantId: "restaurant-1",
              lastRunAt: undefined,
              consecutiveFailures: 5,
              enabled: true,
            },
          ],
        ],
      }),
    });
    const now = new Date();

    await expect(
      service.shouldRunBackup(config({ schedule_enabled: false }), now),
    ).resolves.toBe(false);
    await expect(
      service.shouldRunBackup(config({ schedule_cron: undefined }), now),
    ).resolves.toBe(false);
    await expect(
      service.shouldRunBackup(config({ schedule_cron: "bad cron" }), now),
    ).resolves.toBe(false);
    await expect(service.shouldRunBackup(config(), now)).resolves.toBe(false);
    await expect(service.shouldRunBackup(config(), now)).resolves.toBe(false);
  });

  it("records failed scheduled backup processing and continues", async () => {
    const analytics = { writeDataPoint: vi.fn() };
    const backupService = {
      createBackup: vi.fn(async () => {
        throw new Error("backup failed");
      }),
    };
    const db = createDb({
      selectResults: [
        [config({ schedule_cron: "0 10 * * *" })],
        [
          {
            id: "schedule-1",
            configurationId: "config-1",
            restaurantId: "restaurant-1",
            lastRunAt: undefined,
            consecutiveFailures: 0,
            enabled: true,
          },
        ],
      ],
    });
    const { service } = createService({ db, backupService, analytics });

    await expect(service.processScheduledBackups()).resolves.toMatchObject({
      processed: 1,
      succeeded: 0,
      failed: 1,
      errors: [
        "Failed to process scheduled backup for restaurant-1: backup failed",
      ],
    });
    expect(db.run).toHaveBeenCalledTimes(1);
    expect(analytics.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: [
          "scheduled_backup_failed",
          "restaurant-1",
          "config-1",
          "Failed to process scheduled backup for restaurant-1: backup failed",
        ],
      }),
    );
  });

  it("wraps top-level scheduled processing failures", async () => {
    const service = createService().service;
    vi.spyOn(service, "getScheduledConfigurations").mockRejectedValue(
      new Error("config query failed"),
    );

    await expect(service.processScheduledBackups()).rejects.toThrow(
      "Failed to process scheduled backups: config query failed",
    );
  });

  it("creates, updates, and disables schedules with wrapped errors", async () => {
    const db = createDb();
    const { service } = createService({ db });

    await expect(
      service.createOrUpdateSchedule("config-1", "restaurant-1", "0 * * * *"),
    ).resolves.toBeUndefined();
    expect(db.run).toHaveBeenCalledTimes(1);

    await expect(service.disableSchedule("config-1")).resolves.toBeUndefined();
    expect(db.updates[0]).toMatchObject({ enabled: false });

    await expect(
      createService({ db: createDb({ throwOnRun: new Error("run failed") }) })
        .service.createOrUpdateSchedule("config-1", "restaurant-1", "* * * * *"),
    ).rejects.toThrow("Failed to create/update backup schedule");
    await expect(
      createService({
        db: createDb({ throwOnUpdate: new Error("update failed") }),
      }).service.disableSchedule("config-1"),
    ).rejects.toThrow("Failed to disable backup schedule");
  });

  it("fetches scheduled configurations and schedule info with parsing fallbacks", async () => {
    const { service } = createService({
      db: createDb({
        selectResults: [
          [
            {
              id: "config-1",
              restaurant_id: "restaurant-1",
              name: "Daily",
              backup_type: "incremental",
              schedule_enabled: 1,
              schedule_cron: "0 * * * *",
              retention_days: 7,
              compression_enabled: 1,
              encryption_enabled: 0,
              storage_provider: "r2",
              include_tables: ["orders"],
              exclude_tables: [],
              notification_channels: ["email"],
            },
          ],
          [
            {
              id: "schedule-1",
              configurationId: "config-1",
              restaurantId: "restaurant-1",
              lastRunAt: null,
              nextRunAt: "2026-06-07T03:00:00.000Z",
              consecutiveFailures: 2,
              enabled: true,
            },
          ],
          [],
        ],
      }),
    });

    await expect(service.getScheduledConfigurations()).resolves.toMatchObject([
      {
        restaurant_id: "restaurant-1",
        backup_type: "incremental",
        schedule_enabled: true,
        compression_enabled: true,
        encryption_enabled: false,
      },
    ]);
    await expect(service.getScheduleInfo("config-1")).resolves.toEqual({
      id: "schedule-1",
      configuration_id: "config-1",
      restaurant_id: "restaurant-1",
      last_run_at: undefined,
      next_run_at: "2026-06-07T03:00:00.000Z",
      consecutive_failures: 2,
      enabled: true,
    });
    await expect(service.getScheduleInfo("missing")).resolves.toBeNull();
  });

  it("handles scheduled configuration and schedule info query errors", async () => {
    const throwingDb = {
      select: vi.fn(() => {
        throw new Error("select failed");
      }),
    };
    drizzleState.db = throwingDb;
    const service = new BackupSchedulerService(
      {} as D1Database,
      { createBackup: vi.fn() } as never,
      {} as never,
    );

    await expect(service.getScheduledConfigurations()).rejects.toThrow(
      "Failed to fetch scheduled configurations",
    );
    await expect(service.getScheduleInfo("config-1")).resolves.toBeNull();
  });

  it("returns upcoming backups and wraps upcoming query failures", async () => {
    const db = createDb({
      runResults: [
        {
          results: [
            {
              id: "config-1",
              restaurantId: "restaurant-1",
              name: "Daily",
              backupType: "full",
              scheduleEnabled: true,
              scheduleCron: "0 2 * * *",
              includeTables: ["orders"],
              excludeTables: [],
              next_run_at: "2026-06-07T03:00:00.000Z",
              restaurant_name: "Makan",
            },
          ],
        },
      ],
    });
    const { service } = createService({ db });

    await expect(service.getUpcomingBackups(2)).resolves.toMatchObject([
      {
        configuration: {
          restaurant_id: "restaurant-1",
          backup_type: "full",
          schedule_enabled: true,
        },
        scheduled_time: "2026-06-07T03:00:00.000Z",
        restaurant_name: "Makan",
      },
    ]);

    await expect(
      createService({ db: createDb({ throwOnRun: new Error("run failed") }) })
        .service.getUpcomingBackups(),
    ).rejects.toThrow("Failed to fetch upcoming backups");
  });

  it("executes scheduled backups without next-run updates for unsupported cron", async () => {
    const db = createDb();
    const { service, backupService } = createService({ db });

    await expect(
      service.executeScheduledBackup(
        config({ schedule_cron: "*/5 * * * *" }),
        new Date("2026-06-07T02:00:00.000Z"),
      ),
    ).resolves.toBe("backup-1");
    expect(backupService.createBackup).toHaveBeenCalledTimes(1);
    expect(db.updates).toHaveLength(1);
  });
});
