import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const dataIntegrityAudit = sqliteTable(
  "data_integrity_audit",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scope: text("scope").notNull(),
    tableName: text("table_name").notNull(),
    columnName: text("column_name").notNull(),
    checkName: text("check_name").notNull(),
    severity: text("severity").notNull(),
    violationCount: integer("violation_count").notNull().default(0),
    sampleValues: text("sample_values"),
    details: text("details"),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    checkUniqueIdx: uniqueIndex("data_integrity_audit_check_unique").on(
      table.scope,
      table.tableName,
      table.columnName,
      table.checkName,
    ),
    scopeSeverityIdx: index("data_integrity_audit_scope_severity_idx").on(
      table.scope,
      table.severity,
      table.createdAt,
    ),
  }),
);

export type DataIntegrityAudit = typeof dataIntegrityAudit.$inferSelect;
export type NewDataIntegrityAudit = typeof dataIntegrityAudit.$inferInsert;
