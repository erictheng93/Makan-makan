/**
 * Scheduling Rules Schema (排班規則)
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "../restaurants";
import { users } from "../users";
import { schedulingConflicts } from "./scheduling-conflicts";

// ========================================
// Scheduling Rules (排班規則)
// ========================================

export const schedulingRules = sqliteTable(
  "scheduling_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.id (UUID v7)

    // Rule Definition
    name: text("name").notNull(),
    description: text("description"),
    ruleType: text("rule_type", {
      enum: [
        "max_hours_per_day",
        "max_hours_per_week",
        "min_rest_period",
        "max_consecutive_days",
        "skill_requirement",
        "custom",
      ],
    }).notNull(),

    // Rule Configuration (JSON)
    ruleConfig: text("rule_config").notNull(), // JSON object with rule-specific parameters

    // Applicability
    appliesToRoles: text("applies_to_roles"), // JSON array of role IDs
    appliesToEmployees: text("applies_to_employees"), // JSON array of employee IDs

    // Priority & Severity
    priority: integer("priority").default(0), // Higher number = higher priority
    severity: text("severity", { enum: ["error", "warning", "info"] })
      .notNull()
      .default("warning"),

    // System Rule Flag
    isSystemRule: integer("is_system_rule", { mode: "boolean" })
      .notNull()
      .default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

    // Audit
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    restaurantTypeActiveIdx: index(
      "idx_scheduling_rules_restaurant_type_active",
    ).on(table.restaurantId, table.ruleType, table.isActive),
  }),
);

export const schedulingRulesRelations = relations(
  schedulingRules,
  ({ one, many }) => ({
    restaurant: one(restaurants, {
      fields: [schedulingRules.restaurantId],
      references: [restaurants.id], // UUID v7 primary key,
    }),
    creator: one(users, {
      fields: [schedulingRules.createdBy],
      references: [users.id],
      relationName: "createdRules",
    }),
    conflicts: many(schedulingConflicts),
  }),
);
