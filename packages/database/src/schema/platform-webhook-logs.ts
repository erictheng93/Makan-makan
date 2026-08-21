/**
 * Platform Webhook Logs Table
 * 外送平台 Webhook 事件記錄 — 用於除錯和稽核
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { PlatformType } from "./platform-integrations";

// ================================================
// CONSTANTS
// ================================================

export const WEBHOOK_LOG_STATUS = {
  RECEIVED: "received",
  PROCESSED: "processed",
  FAILED: "failed",
} as const;

export type WebhookLogStatus =
  (typeof WEBHOOK_LOG_STATUS)[keyof typeof WEBHOOK_LOG_STATUS];

// ================================================
// TABLE DEFINITION
// ================================================

export const platformWebhookLogs = sqliteTable(
  "platform_webhook_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Platform info
    platform: text("platform").$type<PlatformType>().notNull(),
    eventType: text("event_type").notNull(),
    // Provider event IDs are stable across redelivery and reserve processing
    // before any order-side effects are written.
    platformEventId: text("platform_event_id"),

    // Restaurant reference (nullable — may not be determined yet)
    restaurantId: text("restaurant_id"),

    // Raw payload
    payload: text("payload", { mode: "json" }),

    // Processing status
    status: text("status")
      .$type<WebhookLogStatus>()
      .notNull()
      .default(WEBHOOK_LOG_STATUS.RECEIVED),
    error: text("error"),

    // Timing
    processedAt: integer("processed_at_ms", { mode: "timestamp_ms" }),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    // Query by platform + event type
    platformEventIdx: index("platform_webhook_logs_platform_event_idx").on(
      table.platform,
      table.eventType,
      table.createdAt,
    ),
    eventUniqueIdx: uniqueIndex("platform_webhook_logs_event_unique")
      .on(table.platform, table.platformEventId)
      .where(sql`${table.platformEventId} IS NOT NULL`),
    // Query by restaurant
    restaurantIdx: index("platform_webhook_logs_restaurant_idx").on(
      table.restaurantId,
      table.createdAt,
    ),
    // Query by status for retry processing
    statusIdx: index("platform_webhook_logs_status_idx").on(
      table.status,
      table.createdAt,
    ),
  }),
);
