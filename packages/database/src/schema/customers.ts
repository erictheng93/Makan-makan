/**
 * Customers Schema
 * 顧客資料表結構定義
 */

import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ================================================
// TABLE: customers (顧客表)
// ================================================

export const customers = sqliteTable(
  "customers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    displayName: text("display_name").notNull(),
    primaryPhone: text("primary_phone"),
    primaryEmail: text("primary_email"),
    avatarUrl: text("avatar_url"),
    locale: text("locale"),
    status: text("status").notNull().default("active"),
    lastSeenAt: integer("last_seen_at_ms", { mode: "timestamp_ms" }),

    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    primaryPhoneIdx: uniqueIndex("idx_customers_primary_phone")
      .on(table.primaryPhone)
      .where(
        sql`${table.primaryPhone} IS NOT NULL AND ${table.status} = 'active'`,
      ),
    primaryEmailIdx: uniqueIndex("idx_customers_primary_email")
      .on(table.primaryEmail)
      .where(
        sql`${table.primaryEmail} IS NOT NULL AND ${table.status} = 'active'`,
      ),
    statusLastSeenIdx: index("idx_customers_status_last_seen").on(
      table.status,
      table.lastSeenAt,
    ),
    createdAtIdx: index("idx_customers_created_at").on(table.createdAt),
  }),
);

export const customerPreferences = sqliteTable("customer_preferences", {
  customerId: text("customer_id")
    .primaryKey()
    .references(() => customers.id, { onDelete: "cascade" }),
  dietaryTags: text("dietary_tags", { mode: "json" }).$type<string[]>(),
  allergens: text("allergens", { mode: "json" }).$type<string[]>(),
  defaultPartySize: integer("default_party_size"),
  marketingOptIn: integer("marketing_opt_in").notNull().default(0),
  waitingListOptIn: integer("waiting_list_opt_in").notNull().default(1),
  promoFromFavoritesOptIn: integer("promo_from_favorites_opt_in")
    .notNull()
    .default(0),
  quietHoursStart: text("quiet_hours_start"),
  quietHoursEnd: text("quiet_hours_end"),
  preferredPaymentMethodId: text("preferred_payment_method_id"),
  updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

export const customerFavorites = sqliteTable(
  "customer_favorites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    uniqueTargetIdx: uniqueIndex(
      "customer_favorites_customer_target_unique",
    ).on(table.customerId, table.targetType, table.targetId),
    listIdx: index("customer_favorites_customer_type_created_idx").on(
      table.customerId,
      table.targetType,
      table.createdAt,
    ),
    targetIdx: index("customer_favorites_target_idx").on(
      table.targetType,
      table.targetId,
    ),
  }),
);

export const customerPushSubscriptions = sqliteTable(
  "customer_push_subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dhKey: text("p256dh_key").notNull(),
    authKey: text("auth_key").notNull(),
    userAgent: text("user_agent"),
    deviceLabel: text("device_label"),
    lastUsedAt: integer("last_used_at_ms", { mode: "timestamp_ms" }),
    failureCount: integer("failure_count").notNull().default(0),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    customerIdx: index("customer_push_subscriptions_customer_idx").on(
      table.customerId,
    ),
    endpointIdx: uniqueIndex("customer_push_subscriptions_endpoint_unique").on(
      table.endpoint,
    ),
    lastUsedIdx: index("customer_push_subscriptions_last_used_idx").on(
      table.lastUsedAt,
    ),
  }),
);

export const customerConsents = sqliteTable(
  "customer_consents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    consentType: text("consent_type").notNull(),
    version: text("version").notNull(),
    granted: integer("granted").notNull(),
    grantedAt: integer("granted_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    revokedAt: integer("revoked_at_ms", { mode: "timestamp_ms" }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    source: text("source"),
  },
  (table) => ({
    activeIdx: index("customer_consents_customer_type_revoked_idx").on(
      table.customerId,
      table.consentType,
      table.revokedAt,
    ),
    typeVersionIdx: index("customer_consents_type_version_idx").on(
      table.consentType,
      table.version,
    ),
  }),
);

export const customerPhoneVerificationTokens = sqliteTable(
  "customer_phone_verification_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: text("customer_id").references(() => customers.id, {
      onDelete: "cascade",
    }),
    phone: text("phone").notNull(),
    otpCode: text("otp_code").notNull(),
    expiresAt: integer("expires_at_ms", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at_ms", { mode: "timestamp_ms" }),
    attempts: integer("attempts").notNull().default(0),
    ipAddress: text("ip_address"),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    phoneExpiryIdx: index("customer_phone_tokens_phone_expiry_idx").on(
      table.phone,
      table.expiresAt,
    ),
    customerIdx: index("customer_phone_tokens_customer_idx").on(
      table.customerId,
    ),
  }),
);

// ================================================
// RELATIONS
// ================================================

export const customersRelations = relations(customers, ({ one, many }) => ({
  preferences: one(customerPreferences, {
    fields: [customers.id],
    references: [customerPreferences.customerId],
  }),
  favorites: many(customerFavorites),
  pushSubscriptions: many(customerPushSubscriptions),
  consents: many(customerConsents),
  phoneVerificationTokens: many(customerPhoneVerificationTokens),
}));

// ================================================
// TYPE INFERENCE
// ================================================

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
