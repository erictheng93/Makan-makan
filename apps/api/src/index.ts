import { createApp } from "./app-factory";
import type { Env } from "./types/env";

const app = createApp();

// 匯出應用
export default {
  fetch: app.fetch,

  // 計畫任務處理器 (Cron Jobs)
  scheduled: async (
    event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ) => {
    console.log("Scheduled event triggered:", event.cron);

    // Import scheduled tasks dynamically
    const { cleanupExpiredTokens, cleanupOldLogs } =
      await import("./scheduled/cleanup-tokens");

    try {
      // Daily cleanup at 2 AM UTC: Clean expired verification tokens
      if (event.cron === "0 2 * * *") {
        console.log("[Cron] Running daily token cleanup...");
        const result = await cleanupExpiredTokens(env);
        console.log("[Cron] Token cleanup result:", result);
      }

      // Weekly cleanup on Sunday at 3 AM UTC: Clean old logs
      if (event.cron === "0 3 * * 0") {
        console.log("[Cron] Running weekly log cleanup...");
        await cleanupOldLogs(env);
      }

      // Daily forecast warmup at 2:30 AM UTC
      if (event.cron === "30 2 * * *") {
        console.log("[Cron] Running daily forecast warmup...");
        const { ForecastService } =
          await import("./features/forecast/services/ForecastService");
        const forecastService = new ForecastService(env.DB, env.CACHE_KV);

        // Get active restaurants
        const restaurants = await env.DB.prepare(
          "SELECT id FROM restaurants WHERE is_active = 1 AND deleted_at_ms IS NULL",
        ).all<{ id: string }>();

        const tomorrow = new Date(Date.now() + 86400000);
        const day3 = new Date(Date.now() + 3 * 86400000);
        const formatDate = (d: Date) => d.toISOString().split("T")[0];

        let successCount = 0;
        for (const restaurant of restaurants.results) {
          try {
            await forecastService.generateForecast(restaurant.id, {
              startDate: formatDate(tomorrow),
              endDate: formatDate(day3),
            });
            successCount++;
          } catch (error) {
            console.error(
              `[Cron] Forecast warmup failed for restaurant ${restaurant.id}:`,
              error,
            );
          }
        }
        console.log(
          `[Cron] Forecast warmup complete: ${successCount}/${restaurants.results.length} restaurants`,
        );
      }

      if (event.cron === "*/5 * * * *") {
        console.log("[Cron] Running usage aggregation...");
        const { aggregateUsageMeters } =
          await import("./workers/usage-aggregator");
        await aggregateUsageMeters(env);
      }

      if (event.cron === "0 2 * * *") {
        console.log("[Cron] Running storage usage snapshot...");
        const { snapshotStorageUsage } =
          await import("./workers/storage-snapshot");
        await snapshotStorageUsage(env);
      }

      if (event.cron === "15 2 * * *") {
        console.log("[Cron] Running billing cycle closer...");
        const { BillingCycleService, TrialReaperService } =
          await import("./features/billing/services/BillingCycleService");
        const { BillingReminderService } =
          await import("./features/billing/services/BillingNotificationService");
        const cycleCloser = new BillingCycleService(env);
        const trialReaper = new TrialReaperService(env);
        const reminderService = new BillingReminderService(env);
        const [cycleResult, trialResult, reminderResult] = await Promise.all([
          cycleCloser.closeDueCycles(),
          trialReaper.downgradeExpiredTrials(),
          reminderService.sendTrialEndingReminders(),
        ]);
        console.log("[Cron] Billing lifecycle result:", {
          ...cycleResult,
          ...trialResult,
          ...reminderResult,
        });
      }
    } catch (error) {
      console.error("[Cron] Scheduled task error:", error);

      // Send alert for cron job failures
      const { AlertService } = await import("./services/AlertService");
      const alertService = new AlertService(env);
      await alertService.systemError(
        error instanceof Error ? error : new Error(String(error)),
        "Cron Job Execution",
      );
    }
  },
};
