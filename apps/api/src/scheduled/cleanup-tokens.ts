/**
 * Scheduled Token Cleanup
 * Runs daily to clean up expired verification tokens
 * Cloudflare Workers Cron Trigger
 */

import { VerificationService } from "@makanmasak/database";
import type { Env } from "../types/env";
import { AlertService } from "../services/AlertService";

export interface CleanupResult {
  success: boolean;
  deletedTokens?: {
    passwordReset: number;
    emailVerification: number;
    phoneVerification: number;
  };
  error?: string;
  timestamp: Date;
}

/**
 * Clean up expired tokens
 * This function is called by Cloudflare Workers cron trigger
 */
export async function cleanupExpiredTokens(env: Env): Promise<CleanupResult> {
  const startTime = Date.now();

  try {
    console.log("[Cron] Starting token cleanup...");

    const verificationService = new VerificationService(env.DB, env);

    // Clean up all expired tokens
    await verificationService.cleanupExpiredTokens();

    // Query to count deleted tokens (optional, for reporting)
    const stats = await getCleanupStats(env.DB);

    const duration = Date.now() - startTime;

    console.log(`[Cron] Token cleanup completed in ${duration}ms`, stats);

    // Send success notification (info level)
    if (env.SLACK_WEBHOOK_URL || env.ALERT_EMAIL_TO) {
      const alertService = new AlertService(env);
      await alertService.sendAlert({
        title: "Token Cleanup Completed",
        message: "Scheduled cleanup of expired tokens completed successfully",
        severity: "info",
        metadata: {
          Duration: `${duration}ms`,
          "Password Reset Tokens": stats.passwordReset || "N/A",
          "Email Verification Tokens": stats.emailVerification || "N/A",
          "Phone Verification Tokens": stats.phoneVerification || "N/A",
        },
      });
    }

    return {
      success: true,
      deletedTokens: stats,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("[Cron] Token cleanup error:", error);

    // Send error alert
    const alertService = new AlertService(env);
    await alertService.systemError(
      error instanceof Error ? error : new Error(String(error)),
      "Token Cleanup Cron Job",
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date(),
    };
  }
}

/**
 * Get cleanup statistics (count of expired tokens before cleanup)
 */
async function getCleanupStats(db: D1Database): Promise<{
  passwordReset: number;
  emailVerification: number;
  phoneVerification: number;
}> {
  try {
    const now = Math.floor(Date.now() / 1000);

    const [
      passwordResetResult,
      emailVerificationResult,
      phoneVerificationResult,
    ] = await Promise.all([
      db
        .prepare(
          "SELECT COUNT(*) as count FROM password_reset_tokens WHERE expires_at < ?",
        )
        .bind(now)
        .first<{ count: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) as count FROM email_verification_tokens WHERE expires_at < ?",
        )
        .bind(now)
        .first<{ count: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) as count FROM phone_verification_tokens WHERE expires_at < ?",
        )
        .bind(now)
        .first<{ count: number }>(),
    ]);

    return {
      passwordReset: passwordResetResult?.count || 0,
      emailVerification: emailVerificationResult?.count || 0,
      phoneVerification: phoneVerificationResult?.count || 0,
    };
  } catch (error) {
    console.error("Error getting cleanup stats:", error);
    return {
      passwordReset: 0,
      emailVerification: 0,
      phoneVerification: 0,
    };
  }
}

/**
 * Clean up old password change logs (keep last 90 days)
 */
export async function cleanupOldLogs(env: Env): Promise<void> {
  try {
    const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;

    await env.DB.prepare(
      "DELETE FROM password_change_logs WHERE created_at < ?",
    )
      .bind(ninetyDaysAgo)
      .run();

    console.log("[Cron] Old password change logs cleaned up (90+ days)");
  } catch (error) {
    console.error("[Cron] Error cleaning up old logs:", error);
  }
}
