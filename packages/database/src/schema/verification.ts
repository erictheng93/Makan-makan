/**
 * Verification System Schema
 * Defines tables for password reset, email verification, and phone verification
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { users } from "./users";

// ============================================
// Password Reset Tokens Table
// ============================================
export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Token information
    token: text("token").notNull().unique(), // UUID v4
    tokenType: text("token_type", { enum: ["email", "sms"] })
      .notNull()
      .default("email"),
    otpCode: text("otp_code"), // 6-digit OTP for SMS (optional)

    // Expiry and usage tracking
    expiresAt: integer("expires_at_ms", { mode: "timestamp_ms" }).notNull(), // 15 minutes
    usedAt: integer("used_at_ms", { mode: "timestamp_ms" }), // Mark as used

    // Security tracking
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    // Timestamps
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    tokenIdx: index("idx_password_reset_token").on(table.token),
    userExpiresIdx: index("idx_password_reset_user_expires").on(
      table.userId,
      table.expiresAt,
    ),
    expiresIdx: index("idx_password_reset_expires").on(table.expiresAt),
  }),
);

export const passwordResetTokenRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

// Type exports
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ============================================
// Email Verification Tokens Table
// ============================================
export const emailVerificationTokens = sqliteTable(
  "email_verification_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Token and email
    token: text("token").notNull().unique(), // UUID v4
    email: text("email").notNull(), // Email to verify

    // Verification tracking
    expiresAt: integer("expires_at_ms", { mode: "timestamp_ms" }).notNull(), // 24 hours
    verifiedAt: integer("verified_at_ms", { mode: "timestamp_ms" }),

    // Security tracking
    ipAddress: text("ip_address"),

    // Timestamps
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    tokenIdx: index("idx_email_verification_token").on(table.token),
    userIdx: index("idx_email_verification_user").on(table.userId),
    expiresIdx: index("idx_email_verification_expires").on(table.expiresAt),
  }),
);

export const emailVerificationTokenRelations = relations(
  emailVerificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerificationTokens.userId],
      references: [users.id],
    }),
  }),
);

// Type exports
export type EmailVerificationToken =
  typeof emailVerificationTokens.$inferSelect;
export type NewEmailVerificationToken =
  typeof emailVerificationTokens.$inferInsert;

// ============================================
// Phone Verification Tokens Table
// ============================================
export const phoneVerificationTokens = sqliteTable(
  "phone_verification_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Phone and OTP
    phone: text("phone").notNull(), // International format (+60xxxxxxxxx)
    otpCode: text("otp_code").notNull(), // 6-digit OTP

    // Verification tracking
    expiresAt: integer("expires_at_ms", { mode: "timestamp_ms" }).notNull(), // 5 minutes
    verifiedAt: integer("verified_at_ms", { mode: "timestamp_ms" }),
    attemptCount: integer("attempt_count").notNull().default(0), // Max 3 attempts

    // Security tracking
    ipAddress: text("ip_address"),

    // Timestamps
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    userPhoneIdx: index("idx_phone_verification_user_phone").on(
      table.userId,
      table.phone,
    ),
    otpExpiresIdx: index("idx_phone_verification_otp_expires").on(
      table.otpCode,
      table.expiresAt,
    ),
  }),
);

export const phoneVerificationTokenRelations = relations(
  phoneVerificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [phoneVerificationTokens.userId],
      references: [users.id],
    }),
  }),
);

// Type exports
export type PhoneVerificationToken =
  typeof phoneVerificationTokens.$inferSelect;
export type NewPhoneVerificationToken =
  typeof phoneVerificationTokens.$inferInsert;

// ============================================
// Password Change Logs Table (Audit Trail)
// ============================================
export const passwordChangeLogs = sqliteTable(
  "password_change_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Change information
    changeMethod: text("change_method", {
      enum: ["reset_email", "reset_sms", "manual", "admin_reset"],
    }).notNull(),

    // Result tracking
    success: integer("success", { mode: "boolean" }).notNull().default(true),
    failureReason: text("failure_reason"),

    // Security tracking
    ipAddress: text("ip_address").notNull(),
    userAgent: text("user_agent"),

    // Timestamps
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    userCreatedIdx: index("idx_password_change_user_created").on(
      table.userId,
      table.createdAt,
    ),
    createdIdx: index("idx_password_change_created").on(table.createdAt),
  }),
);

export const passwordChangeLogRelations = relations(
  passwordChangeLogs,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordChangeLogs.userId],
      references: [users.id],
    }),
  }),
);

// Type exports
export type PasswordChangeLog = typeof passwordChangeLogs.$inferSelect;
export type NewPasswordChangeLog = typeof passwordChangeLogs.$inferInsert;
