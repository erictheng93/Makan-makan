import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { restaurants } from "./restaurants";

export const FEEDBACK_CATEGORIES = [
  "bug_report",
  "feature_request",
  "usability",
  "performance",
  "billing",
  "other",
] as const;

export const FEEDBACK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const FEEDBACK_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "closed",
] as const;

export const FEEDBACK_MODULES = [
  "menu",
  "orders",
  "pos",
  "tables",
  "reservations",
  "scheduling",
  "analytics",
  "settings",
  "integrations",
  "other",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type FeedbackModule = (typeof FEEDBACK_MODULES)[number];

export const shopFeedback = sqliteTable(
  "shop_feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(),
    userId: integer("user_id").notNull(),
    category: text("category", {
      enum: FEEDBACK_CATEGORIES,
    }).notNull(),
    priority: text("priority", {
      enum: FEEDBACK_PRIORITIES,
    })
      .notNull()
      .default("medium"),
    status: text("status", {
      enum: FEEDBACK_STATUSES,
    })
      .notNull()
      .default("open"),
    relatedModule: text("related_module", {
      enum: FEEDBACK_MODULES,
    })
      .notNull()
      .default("other"),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    attachmentUrls: text("attachment_urls"), // JSON array of URLs
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    resolvedAt: integer("resolved_at_ms", { mode: "timestamp_ms" }),
    resolvedBy: integer("resolved_by"),
  },
  (table) => ({
    restaurantIdIdx: index("idx_shop_feedback_restaurant_id").on(
      table.restaurantId,
    ),
    userIdIdx: index("idx_shop_feedback_user_id").on(table.userId),
    statusIdx: index("idx_shop_feedback_status").on(table.status),
    categoryIdx: index("idx_shop_feedback_category").on(table.category),
    createdAtIdx: index("idx_shop_feedback_created_at").on(table.createdAt),
    restaurantStatusIdx: index("idx_shop_feedback_restaurant_status").on(
      table.restaurantId,
      table.status,
    ),
    categoryStatusIdx: index("idx_shop_feedback_category_status").on(
      table.category,
      table.status,
    ),
  }),
);

export const feedbackResponses = sqliteTable(
  "feedback_responses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    feedbackId: integer("feedback_id").notNull(),
    userId: integer("user_id").notNull(),
    message: text("message").notNull(),
    isInternal: integer("is_internal", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    feedbackIdIdx: index("idx_feedback_responses_feedback_id").on(
      table.feedbackId,
    ),
  }),
);

// Relations
export const shopFeedbackRelations = relations(
  shopFeedback,
  ({ one, many }) => ({
    restaurant: one(restaurants, {
      fields: [shopFeedback.restaurantId],
      references: [restaurants.id],
    }),
    user: one(users, {
      fields: [shopFeedback.userId],
      references: [users.id],
    }),
    resolvedByUser: one(users, {
      fields: [shopFeedback.resolvedBy],
      references: [users.id],
    }),
    responses: many(feedbackResponses),
  }),
);

export const feedbackResponsesRelations = relations(
  feedbackResponses,
  ({ one }) => ({
    feedback: one(shopFeedback, {
      fields: [feedbackResponses.feedbackId],
      references: [shopFeedback.id],
    }),
    user: one(users, {
      fields: [feedbackResponses.userId],
      references: [users.id],
    }),
  }),
);

// Types
export type ShopFeedback = typeof shopFeedback.$inferSelect;
export type NewShopFeedback = typeof shopFeedback.$inferInsert;
export type FeedbackResponse = typeof feedbackResponses.$inferSelect;
export type NewFeedbackResponse = typeof feedbackResponses.$inferInsert;
