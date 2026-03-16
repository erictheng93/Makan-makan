import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "./restaurants";

// --- AI Configurations ---
export const aiConfigurations = sqliteTable(
  "ai_configurations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull().unique(),
    provider: text("provider").notNull(), // 'openai' | 'anthropic' | 'google' | 'openrouter'
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    model: text("model"),
    customBaseUrl: text("custom_base_url"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    restaurantIdx: uniqueIndex("ai_configurations_restaurant_idx").on(
      table.restaurantId,
    ),
  }),
);

export const aiConfigurationsRelations = relations(
  aiConfigurations,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [aiConfigurations.restaurantId],
      references: [restaurants.id],
    }),
  }),
);

// --- AI Usage Logs ---
export const aiUsageLogs = sqliteTable(
  "ai_usage_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    operation: text("operation").notNull(), // 'generate_report' | 'analyze_products' etc.
    tokensUsed: integer("tokens_used").notNull().default(0),
    latencyMs: integer("latency_ms"),
    success: integer("success", { mode: "boolean" }).notNull().default(true),
    errorMessage: text("error_message"),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    restaurantIdx: index("ai_usage_logs_restaurant_idx").on(table.restaurantId),
    providerModelIdx: index("ai_usage_logs_provider_model_idx").on(
      table.provider,
      table.model,
    ),
    createdAtIdx: index("ai_usage_logs_created_at_idx").on(table.createdAt),
  }),
);

export const aiUsageLogsRelations = relations(aiUsageLogs, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [aiUsageLogs.restaurantId],
    references: [restaurants.id],
  }),
}));
