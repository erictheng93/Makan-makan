/**
 * Backup Scheduler Worker
 * Handles automated backup scheduling and monitoring via Cloudflare Cron Triggers
 */

import { BackupService } from "../services/BackupService";
import { cronMatches } from "../utils/cron";
import type { BackupConfiguration } from "@makanmakan/shared-types";
import type {
  D1Database,
  R2Bucket,
  KVNamespace,
  ScheduledEvent,
  ExecutionContext,
  AnalyticsEngineDataset,
} from "@cloudflare/workers-types";

interface Env {
  DB: D1Database;
  BACKUP_STORAGE: R2Bucket;
  BACKUP_KV: KVNamespace;
  ANALYTICS: AnalyticsEngineDataset;
}

type RestoreDrillEnvironment = "development" | "production";

export interface RestoreDrillOptions {
  environment: RestoreDrillEnvironment;
  backupFile: string;
  restoreDatabase: string;
  dryRun?: boolean;
  validationTables?: string[];
  remote?: boolean;
  productionApproval?: string;
}

export interface RestoreDrillCommand {
  name: string;
  command: string;
}

export interface RestoreDrillPlan {
  mode: "dry-run" | "ready";
  environment: RestoreDrillEnvironment;
  restoreDatabase: string;
  evidenceKey: string;
  validationTables: string[];
  commands: RestoreDrillCommand[];
}

export interface RestoreDrillExecutionResult extends Omit<
  RestoreDrillPlan,
  "mode"
> {
  mode: "dry-run" | "executed";
  commandResults: Array<{
    name: string;
    command: string;
    stdout?: string;
    stderr?: string;
  }>;
}

type RestoreDrillExecutor = (
  command: string,
  step: RestoreDrillCommand,
) => Promise<{ stdout?: string; stderr?: string }>;

const DEFAULT_RESTORE_DRILL_TABLES = [
  "restaurants",
  "users",
  "menu_items",
  "orders",
] as const;
const PRODUCTION_RESTORE_DRILL_APPROVAL = "RESTORE DRILL APPROVED";

function assertSafeIdentifier(identifier: string, label: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid ${label}: ${identifier}`);
  }
}

function assertSafeDatabaseName(databaseName: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(databaseName)) {
    throw new Error(`Invalid restore database name: ${databaseName}`);
  }
}

function shellArg(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

export function buildRestoreDrillPlan(
  options: RestoreDrillOptions,
): RestoreDrillPlan {
  if (!options.backupFile.trim()) {
    throw new Error("backupFile is required");
  }
  assertSafeDatabaseName(options.restoreDatabase);

  const validationTables =
    options.validationTables && options.validationTables.length > 0
      ? options.validationTables
      : [...DEFAULT_RESTORE_DRILL_TABLES];
  for (const table of validationTables) {
    assertSafeIdentifier(table, "validation table");
  }

  const remote = options.remote ?? options.environment !== "development";
  const locationFlag = remote ? "--remote" : "--local";
  const restoreDatabase = shellArg(options.restoreDatabase);
  const backupFile = shellArg(options.backupFile);
  const commands: RestoreDrillCommand[] = [
    {
      name: "create_restore_database",
      command: `pnpm exec wrangler d1 create ${restoreDatabase}`,
    },
    {
      name: "import_backup",
      command: `pnpm exec wrangler d1 execute ${restoreDatabase} ${locationFlag} --file ${backupFile}`,
    },
    ...validationTables.map((table) => ({
      name: `validate_${table}`,
      command: `pnpm exec wrangler d1 execute ${restoreDatabase} ${locationFlag} --command "SELECT COUNT(*) AS count FROM ${table};"`,
    })),
  ];

  return {
    mode: options.dryRun === false ? "ready" : "dry-run",
    environment: options.environment,
    restoreDatabase: options.restoreDatabase,
    evidenceKey: `restore-drills/${options.environment}/${options.restoreDatabase}`,
    validationTables,
    commands,
  };
}

export async function executeRestoreDrill(
  options: RestoreDrillOptions,
  executor: RestoreDrillExecutor,
): Promise<RestoreDrillExecutionResult> {
  if (
    options.environment === "production" &&
    options.dryRun === false &&
    options.productionApproval !== PRODUCTION_RESTORE_DRILL_APPROVAL
  ) {
    throw new Error(
      "Production restore drills require productionApproval before execution",
    );
  }

  const plan = buildRestoreDrillPlan(options);
  if (plan.mode === "dry-run") {
    return {
      ...plan,
      mode: "dry-run",
      commandResults: [],
    };
  }

  const commandResults: RestoreDrillExecutionResult["commandResults"] = [];
  for (const step of plan.commands) {
    const result = await executor(step.command, step);
    commandResults.push({
      name: step.name,
      command: step.command,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  return {
    ...plan,
    mode: "executed",
    commandResults,
  };
}

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const trigger = event.cron;
    console.log(`Backup scheduler triggered: ${trigger}`);

    try {
      const backupService = new BackupService(
        env.DB,
        env.BACKUP_STORAGE,
        env.BACKUP_KV,
      );

      if (cronMatches(trigger, "*/5 * * * *")) {
        await handleHealthCheck(backupService, env, env.ANALYTICS);
      } else if (cronMatches(trigger, "0 */6 * * *")) {
        await handleScheduledBackups(backupService, env, env.ANALYTICS);
      } else if (cronMatches(trigger, "0 2 * * *")) {
        await handleDailyMaintenance(backupService, env, env.ANALYTICS);
      } else if (cronMatches(trigger, "0 0 * * SUN")) {
        await handleWeeklyReports(backupService, env, env.ANALYTICS);
      } else {
        console.log(`Unknown cron trigger: ${trigger}`);
      }
    } catch (error: unknown) {
      console.error("Backup scheduler error:", error);

      // Track error in analytics
      env.ANALYTICS?.writeDataPoint({
        blobs: [
          "backup_scheduler_error",
          error instanceof Error
            ? error.message
            : String(error) || "Unknown error",
        ],
        doubles: [Date.now()],
        indexes: ["error"],
      });

      throw error;
    }
  },
};

/**
 * Health Check - Monitor system health and running backups
 */

// The health cron fires every 5 minutes; throttle persisted system alerts so
// a sustained outage produces one alert per window instead of 288 per day.
const HEALTH_ALERT_THROTTLE_KEY_PREFIX = "backup-health:last-system-alert";
const HEALTH_ALERT_THROTTLE_SECONDS = 3600;

async function handleHealthCheck(
  backupService: BackupService,
  env: Env,
  analytics?: AnalyticsEngineDataset,
): Promise<void> {
  try {
    console.log("Running backup system health check...");

    // Get system health
    const health = await backupService.getSystemHealth();

    // Check for critical issues
    const criticalIssues =
      health.alerts_summary.critical + health.failed_backups_24h;
    const warningIssues =
      health.alerts_summary.high + health.alerts_summary.medium;

    // Log health metrics
    analytics?.writeDataPoint({
      blobs: ["backup_health_check", health.overall_status],
      doubles: [
        Date.now(),
        health.running_backups,
        health.failed_backups_24h,
        criticalIssues,
        warningIssues,
      ],
      indexes: ["health"],
    });

    // Create alerts when the system is degraded or unhealthy
    const needsCriticalAlert =
      health.overall_status === "critical" || criticalIssues > 5;
    const needsWarningAlert = health.overall_status === "warning";

    if (needsCriticalAlert || needsWarningAlert) {
      const alertSeverity = needsCriticalAlert ? "critical" : "high";
      const throttleKey = `${HEALTH_ALERT_THROTTLE_KEY_PREFIX}:${alertSeverity}`;
      const lastAlertAt = await env.BACKUP_KV.get(throttleKey);
      if (!lastAlertAt) {
        await createSystemAlert(backupService, {
          severity: alertSeverity,
          title: needsCriticalAlert
            ? "Backup System Unhealthy"
            : "Backup System Degraded",
          message: `Backup system status: ${health.overall_status}. ${health.failed_backups_24h} failed backups in the last 24 hours, ${health.running_backups} running, success rate ${health.performance_metrics.average_success_rate_percentage.toFixed(1)}%`,
          alert_type: needsCriticalAlert
            ? "backup_failed"
            : "performance_degraded",
        });
        await env.BACKUP_KV.put(throttleKey, new Date().toISOString(), {
          expirationTtl: HEALTH_ALERT_THROTTLE_SECONDS,
        });
      }
    }

    console.log(
      `Health check completed - Status: ${health.overall_status}, Running: ${health.running_backups}, Failed 24h: ${health.failed_backups_24h}, Success rate: ${health.performance_metrics.average_success_rate_percentage.toFixed(1)}%, Last success: ${health.last_successful_backup_at ?? "never"}`,
    );
  } catch (error: unknown) {
    console.error("Health check failed:", error);
    throw error;
  }
}

/**
 * Process Scheduled Backups - Execute automated backups based on configurations
 */
async function handleScheduledBackups(
  backupService: BackupService,
  env: Env,
  analytics?: AnalyticsEngineDataset,
): Promise<void> {
  try {
    console.log("Processing scheduled backups...");

    const now = new Date();
    let processedCount = 0;
    let errorCount = 0;

    // Get all restaurants with scheduled backup configurations
    const scheduledConfigs = await getScheduledConfigurations(env.DB);

    for (const config of scheduledConfigs) {
      try {
        // Check if backup should run now
        if (shouldRunBackup(config, now)) {
          console.log(
            `Starting scheduled backup for restaurant ${config.restaurant_id}, config: ${config.name}`,
          );

          const backupRequest = {
            restaurant_id: config.restaurant_id,
            configuration_id: config.id,
            name: `Scheduled_${config.name}_${now.toISOString().split("T")[0]}`,
            description: `Automated backup created by scheduler`,
            backup_type: config.backup_type,
            include_tables: config.include_tables,
            exclude_tables: config.exclude_tables,
            force_immediate: false,
          };

          const response = await backupService.createBackup(
            backupRequest,
            "system",
          );

          // Update schedule's last run time
          await updateScheduleLastRun(env.DB, config.id, now);

          processedCount++;

          // Track successful scheduling
          analytics?.writeDataPoint({
            blobs: [
              "scheduled_backup_created",
              config.restaurant_id,
              response.backup_id,
            ],
            doubles: [Date.now()],
            indexes: ["scheduled_backup"],
          });
        }
      } catch (error: unknown) {
        errorCount++;
        console.error(
          `Failed to process scheduled backup for ${config.restaurant_id}:`,
          error,
        );

        // Create alert for failed scheduled backup
        await createRestaurantAlert(backupService, config.restaurant_id, {
          severity: "high",
          title: "Scheduled Backup Failed",
          message: `Failed to start scheduled backup "${config.name}": ${error instanceof Error ? error.message : String(error)}`,
          alert_type: "schedule_missed",
        });

        // Update consecutive failures count
        await updateConsecutiveFailures(env.DB, config.id);
      }
    }

    console.log(
      `Scheduled backups processed: ${processedCount} successful, ${errorCount} failed`,
    );
  } catch (error: unknown) {
    console.error("Failed to process scheduled backups:", error);
    throw error;
  }
}

/**
 * Daily Maintenance - Cleanup expired backups and update metrics
 */
async function handleDailyMaintenance(
  backupService: BackupService,
  env: Env,
  analytics?: AnalyticsEngineDataset,
): Promise<void> {
  console.log("Running daily maintenance...");

  let cleanupCount = 0;
  let auditCleanupCount = 0;
  let alertCleanupCount = 0;
  let errorCount = 0;

  const runStep = async <T>(
    step: string,
    action: () => Promise<T>,
    fallback: T,
  ): Promise<T> => {
    try {
      return await action();
    } catch (error: unknown) {
      errorCount++;
      console.error(`Daily maintenance step failed: ${step}`, error);
      return fallback;
    }
  };

  await runStep(
    "expired_backup_cleanup",
    async () => {
      // Clean up expired backups
      const expiredBackups = await getExpiredBackups(env.DB);

      for (const backup of expiredBackups) {
        try {
          await backupService.deleteBackup(backup.id, "system");
          cleanupCount++;

          console.log(
            `Cleaned up expired backup: ${backup.name} (${backup.id})`,
          );
        } catch (error: unknown) {
          errorCount++;
          console.error(`Failed to cleanup backup ${backup.id}:`, error);
        }
      }

      return cleanupCount;
    },
    0,
  );

  await runStep(
    "aggregate_daily_metrics",
    async () => {
      // Aggregate daily metrics for all restaurants
      await aggregateDailyMetrics(env.DB, analytics);
      return undefined;
    },
    undefined,
  );

  auditCleanupCount = await runStep(
    "audit_log_cleanup",
    () => cleanupOldAuditLogs(env.DB),
    0,
  );

  alertCleanupCount = await runStep(
    "alert_cleanup",
    () => cleanupOldAlerts(env.DB),
    0,
  );

  // Track maintenance metrics
  analytics?.writeDataPoint({
    blobs: ["daily_maintenance_completed"],
    doubles: [
      Date.now(),
      cleanupCount,
      auditCleanupCount,
      alertCleanupCount,
      errorCount,
    ],
    indexes: ["maintenance"],
  });

  console.log(
    `Daily maintenance completed: ${cleanupCount} backups cleaned, ${auditCleanupCount} audit logs cleaned, ${alertCleanupCount} alerts cleaned, ${errorCount} errors`,
  );
}

/**
 * Weekly Reports - Generate summary reports and performance analysis
 */
async function handleWeeklyReports(
  backupService: BackupService,
  env: Env,
  analytics?: AnalyticsEngineDataset,
): Promise<void> {
  try {
    console.log("Generating weekly reports...");

    // Get weekly statistics for all restaurants
    const weeklyStats = await getWeeklyStatistics(env.DB);

    // Check for restaurants with concerning backup patterns
    for (const stat of weeklyStats) {
      const successRate =
        (stat.successful_backups / Math.max(stat.total_backups, 1)) * 100;

      if (successRate < 80 && stat.total_backups > 0) {
        // Create alert for poor backup performance
        await createRestaurantAlert(backupService, stat.restaurant_id, {
          severity: "medium",
          title: "Poor Backup Performance",
          message: `Backup success rate this week: ${successRate.toFixed(1)}% (${stat.successful_backups}/${stat.total_backups})`,
          alert_type: "performance_degraded",
        });
      }
    }

    // Track weekly report generation
    analytics?.writeDataPoint({
      blobs: ["weekly_report_generated"],
      doubles: [Date.now(), weeklyStats.length],
      indexes: ["weekly_report"],
    });

    console.log(
      `Weekly reports generated for ${weeklyStats.length} restaurants`,
    );
  } catch (error: unknown) {
    console.error("Weekly report generation failed:", error);
    throw error;
  }
}

// Helper Functions

async function getScheduledConfigurations(db: D1Database) {
  const result = await db
    .prepare(
      `
    SELECT bc.*, bs.last_run_at, bs.consecutive_failures
    FROM backup_configurations bc
    LEFT JOIN backup_schedules bs ON bc.id = bs.configuration_id
    WHERE bc.schedule_enabled = true AND bc.schedule_cron IS NOT NULL
  `,
    )
    .all<
      BackupConfiguration & {
        last_run_at?: string;
        consecutive_failures?: number;
      }
    >();

  return result.results || [];
}

export function shouldRunBackup(
  config: BackupConfiguration & {
    last_run_at?: string;
    consecutive_failures?: number;
  },
  now: Date,
): boolean {
  if (!config.schedule_cron) return false;

  // Simple cron parsing - in production, use a proper cron parser
  const cronParts = config.schedule_cron.split(" ");
  if (cronParts.length !== 5) return false;

  const [minute, hour] = cronParts;

  // For this example, only handle simple daily backups (0 2 * * *)
  if (hour === "2" && minute === "0") {
    const lastRun = config.last_run_at ? new Date(config.last_run_at) : null;

    if (now.getHours() !== 2) return false;
    if (!lastRun) return true; // Never run before

    // Check if it's been at least 23 hours since last run
    const hoursSinceLastRun =
      (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastRun >= 23;
  }

  return false;
}

async function updateScheduleLastRun(
  db: D1Database,
  configId: string,
  timestamp: Date,
) {
  await db
    .prepare(
      `
    UPDATE backup_schedules
    SET last_run_at = ?, consecutive_failures = 0
    WHERE configuration_id = ?
  `,
    )
    .bind(timestamp.toISOString(), configId)
    .run();
}

async function updateConsecutiveFailures(db: D1Database, configId: string) {
  await db
    .prepare(
      `
    UPDATE backup_schedules
    SET consecutive_failures = consecutive_failures + 1
    WHERE configuration_id = ?
  `,
    )
    .bind(configId)
    .run();
}

async function getExpiredBackups(db: D1Database) {
  const result = await db
    .prepare(
      `
    SELECT br.id, br.name
    FROM backup_records br
    LEFT JOIN backup_configurations bc ON bc.id = br.configuration_id
    WHERE br.started_at IS NOT NULL
      AND datetime(
        br.started_at,
        '+' || COALESCE(bc.retention_days, 30) || ' days'
      ) < datetime('now')
      AND br.status = 'completed'
  `,
    )
    .all<{ id: string; name: string }>();

  return result.results || [];
}

async function aggregateDailyMetrics(
  db: D1Database,
  analytics?: AnalyticsEngineDataset,
) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];

  const result = await db
    .prepare(
      `
    SELECT
      restaurant_id,
      COUNT(*) as total_backups,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_backups,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_backups,
      SUM(COALESCE(file_size, 0)) as total_size_bytes,
      AVG(CASE WHEN completed_at IS NOT NULL THEN
        (julianday(completed_at) - julianday(started_at)) * 24 * 3600
      END) as average_duration_seconds
    FROM backup_records
    WHERE date(started_at) = ?
    GROUP BY restaurant_id
  `,
    )
    .bind(dateStr)
    .all<{
      restaurant_id: string;
      total_backups: number;
      successful_backups: number;
      failed_backups: number;
      total_size_bytes: number | null;
      average_duration_seconds: number | null;
    }>();

  for (const metric of result.results || []) {
    analytics?.writeDataPoint({
      blobs: ["backup_daily_metrics", metric.restaurant_id, dateStr],
      doubles: [
        Date.now(),
        metric.total_backups,
        metric.successful_backups,
        metric.failed_backups,
        metric.total_size_bytes ?? 0,
        metric.average_duration_seconds ?? 0,
      ],
      indexes: ["backup_daily_metrics"],
    });
  }
}

async function cleanupOldAuditLogs(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `
    DELETE FROM backup_audit_logs
    WHERE timestamp < datetime('now', '-90 days')
  `,
    )
    .run();

  return result.meta.changes || 0;
}

async function cleanupOldAlerts(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `
    DELETE FROM backup_alerts
    WHERE resolved = true AND resolved_at < datetime('now', '-30 days')
  `,
    )
    .run();

  return result.meta.changes || 0;
}

async function getWeeklyStatistics(db: D1Database) {
  const result = await db
    .prepare(
      `
    SELECT
      restaurant_id,
      COUNT(*) as total_backups,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_backups,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_backups,
      AVG(CASE WHEN file_size > 0 THEN file_size END) as avg_size
    FROM backup_records
    WHERE started_at >= datetime('now', '-7 days')
    GROUP BY restaurant_id
  `,
    )
    .all<{
      restaurant_id: string;
      total_backups: number;
      successful_backups: number;
      failed_backups: number;
      avg_size: number;
    }>();

  return result.results || [];
}

async function createSystemAlert(
  backupService: BackupService,
  alert: {
    alert_type:
      | "backup_failed"
      | "storage_quota_exceeded"
      | "schedule_missed"
      | "restoration_completed"
      | "performance_degraded";
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    message: string;
    related_backup_id?: string;
  },
) {
  // Create system-wide alert (restaurant_id = 'system')
  await backupService.createAlert({
    ...alert,
    restaurant_id: "system",
  });
}

async function createRestaurantAlert(
  backupService: BackupService,
  restaurantId: string,
  alert: {
    alert_type:
      | "backup_failed"
      | "storage_quota_exceeded"
      | "schedule_missed"
      | "restoration_completed"
      | "performance_degraded";
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    message: string;
    related_backup_id?: string;
  },
) {
  await backupService.createAlert({
    ...alert,
    restaurant_id: restaurantId,
  });
}
