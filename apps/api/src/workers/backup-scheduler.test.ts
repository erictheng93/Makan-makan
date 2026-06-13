import { beforeEach, describe, expect, it, vi } from "vitest";

const backupServiceState = vi.hoisted(() => ({
  instances: [] as Array<{
    getSystemHealth: ReturnType<typeof vi.fn>;
    createBackup: ReturnType<typeof vi.fn>;
    deleteBackup: ReturnType<typeof vi.fn>;
    createAlertPublicPublic: ReturnType<typeof vi.fn>;
  }>,
  health: {
    overall_status: "healthy",
    running_backups: 0,
    failed_backups_24h: 0,
    alerts_summary: { critical: 0, high: 0, medium: 0, low: 0 },
  },
}));

vi.mock("../services/BackupService", () => ({
  BackupService: function MockBackupService() {
    const instance = {
      getSystemHealth: vi.fn(async () => backupServiceState.health),
      createBackup: vi.fn(async () => ({ backup_id: "backup-1" })),
      deleteBackup: vi.fn(async () => undefined),
      createAlertPublicPublic: vi.fn(async () => undefined),
    };
    backupServiceState.instances.push(instance);
    return instance;
  },
}));

import worker, {
  buildRestoreDrillPlan,
  executeRestoreDrill,
  shouldRunBackup,
} from "./backup-scheduler";

function createDb(
  results: Record<string, unknown>[] = [],
  shouldFail?: (sql: string) => boolean,
) {
  return {
    prepare: vi.fn((sql: string) => {
      const maybeThrow = async () => {
        if (shouldFail?.(sql)) {
          throw new Error(`query failed: ${sql}`);
        }
      };

      return {
        bind: vi.fn(() => ({
          run: vi.fn(async () => {
            await maybeThrow();
            return { meta: { changes: 1 } };
          }),
          all: vi.fn(async () => {
            await maybeThrow();
            return { results };
          }),
        })),
        run: vi.fn(async () => {
          await maybeThrow();
          return { meta: { changes: 1 } };
        }),
        all: vi.fn(async () => {
          await maybeThrow();
          return { results };
        }),
      };
    }),
  };
}

function createEnv(db = createDb()) {
  return {
    DB: db,
    BACKUP_STORAGE: {},
    BACKUP_KV: {},
    ANALYTICS: {
      writeDataPoint: vi.fn(),
    },
  };
}

describe("backup scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    backupServiceState.instances.length = 0;
    backupServiceState.health = {
      overall_status: "healthy",
      running_backups: 0,
      failed_backups_24h: 0,
      alerts_summary: { critical: 0, high: 0, medium: 0, low: 0 },
    };
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("dispatches the exact Cloudflare SUN weekly cron trigger", async () => {
    const db = createDb([
      {
        restaurant_id: "restaurant-1",
        total_backups: 10,
        successful_backups: 7,
        failed_backups: 3,
        avg_size: 1024,
      },
    ]);
    const env = createEnv(db);

    await worker.scheduled(
      { cron: "0 0 * * SUN" } as ScheduledEvent,
      env as never,
      {} as ExecutionContext,
    );

    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("FROM backup_records"),
    );
    expect(
      backupServiceState.instances[0].createAlertPublicPublic,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurant_id: "restaurant-1",
        alert_type: "performance_degraded",
        severity: "medium",
        title: "Poor Backup Performance",
      }),
    );
    expect(env.ANALYTICS.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: ["weekly_report_generated"],
        indexes: ["weekly_report"],
      }),
    );
  });

  it("runs daily backup schedules only during their configured hour", () => {
    const config = {
      id: "config-1",
      restaurant_id: "restaurant-1",
      name: "Nightly",
      schedule_cron: "0 2 * * *",
    };

    expect(
      shouldRunBackup(config as never, new Date(2026, 5, 12, 1, 0, 0)),
    ).toBe(false);
    expect(
      shouldRunBackup(config as never, new Date(2026, 5, 12, 2, 0, 0)),
    ).toBe(true);
    expect(
      shouldRunBackup(
        {
          ...config,
          last_run_at: new Date(2026, 5, 11, 4, 0, 0).toISOString(),
        } as never,
        new Date(2026, 5, 12, 2, 0, 0),
      ),
    ).toBe(false);
    expect(
      shouldRunBackup(
        {
          ...config,
          last_run_at: new Date(2026, 5, 11, 2, 0, 0).toISOString(),
        } as never,
        new Date(2026, 5, 12, 2, 0, 0),
      ),
    ).toBe(true);
  });

  it("keeps daily maintenance running when one step fails", async () => {
    const db = createDb([], (sql) =>
      sql.includes("LEFT JOIN backup_configurations"),
    );
    const env = createEnv(db);

    await expect(
      worker.scheduled(
        { cron: "0 2 * * *" } as ScheduledEvent,
        env as never,
        {} as ExecutionContext,
      ),
    ).resolves.toBeUndefined();

    const preparedSql = db.prepare.mock.calls.map(([sql]) => sql);
    expect(preparedSql.some((sql) => sql.includes("expires_at"))).toBe(false);
    expect(
      preparedSql.some((sql) => sql.includes("backup_metrics_daily")),
    ).toBe(false);
    expect(
      preparedSql.some((sql) => sql.includes("DELETE FROM backup_audit_logs")),
    ).toBe(true);
    expect(
      preparedSql.some((sql) => sql.includes("DELETE FROM backup_alerts")),
    ).toBe(true);
    expect(env.ANALYTICS.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: ["daily_maintenance_completed"],
        indexes: ["maintenance"],
      }),
    );
  });

  it("builds a safe dry-run restore drill command plan", () => {
    const plan = buildRestoreDrillPlan({
      environment: "staging",
      backupFile: "artifacts/backup.sql",
      restoreDatabase: "makanmasak-restore-drill-20260612",
    });

    expect(plan).toMatchObject({
      mode: "dry-run",
      environment: "staging",
      restoreDatabase: "makanmasak-restore-drill-20260612",
      evidenceKey: "restore-drills/staging/makanmasak-restore-drill-20260612",
    });
    expect(plan.commands.map((step) => step.command)).toEqual([
      "rtk pnpm exec wrangler d1 create makanmasak-restore-drill-20260612",
      "rtk pnpm exec wrangler d1 execute makanmasak-restore-drill-20260612 --remote --file artifacts/backup.sql",
      'rtk pnpm exec wrangler d1 execute makanmasak-restore-drill-20260612 --remote --command "SELECT COUNT(*) AS count FROM restaurants;"',
      'rtk pnpm exec wrangler d1 execute makanmasak-restore-drill-20260612 --remote --command "SELECT COUNT(*) AS count FROM users;"',
      'rtk pnpm exec wrangler d1 execute makanmasak-restore-drill-20260612 --remote --command "SELECT COUNT(*) AS count FROM menu_items;"',
      'rtk pnpm exec wrangler d1 execute makanmasak-restore-drill-20260612 --remote --command "SELECT COUNT(*) AS count FROM orders;"',
    ]);
  });

  it("executes staging restore drills through an injected command runner", async () => {
    const executor = vi.fn(async (command: string) => ({
      stdout: `ran ${command}`,
    }));

    const result = await executeRestoreDrill(
      {
        environment: "staging",
        backupFile: "backup.sql",
        restoreDatabase: "makanmasak-restore-drill-20260612",
        dryRun: false,
        validationTables: ["restaurants"],
      },
      executor,
    );

    expect(result.mode).toBe("executed");
    expect(executor).toHaveBeenCalledTimes(3);
    expect(result.commandResults).toEqual([
      expect.objectContaining({ stdout: expect.stringContaining("d1 create") }),
      expect.objectContaining({
        stdout: expect.stringContaining("--file backup.sql"),
      }),
      expect.objectContaining({
        stdout: expect.stringContaining("FROM restaurants"),
      }),
    ]);
  });

  it("refuses production restore drill execution without explicit approval", async () => {
    await expect(
      executeRestoreDrill(
        {
          environment: "production",
          backupFile: "backup.sql",
          restoreDatabase: "makanmasak-restore-drill-prod",
          dryRun: false,
        },
        vi.fn(),
      ),
    ).rejects.toThrow("Production restore drills require productionApproval");
  });
});
