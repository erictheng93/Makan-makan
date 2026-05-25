import type { D1Database } from "@cloudflare/workers-types";
import { normalizeE164Phone } from "@makanmakan/utils";

export type CustomerIdentityPreflightIssueType =
  | "duplicate_phone"
  | "duplicate_email";

export interface CustomerIdentityPreflightSource {
  table: "users" | "customers";
  id: string | number;
}

export interface CustomerIdentityPreflightIssue {
  type: CustomerIdentityPreflightIssueType;
  value: string;
  sources: CustomerIdentityPreflightSource[];
}

export interface CustomerIdentityPreflightReport {
  ok: boolean;
  issues: CustomerIdentityPreflightIssue[];
}

interface IdentityCandidate extends CustomerIdentityPreflightSource {
  phone: string | null;
  email: string | null;
}

export async function runCustomerIdentityPreflight(
  db: D1Database,
): Promise<CustomerIdentityPreflightReport> {
  const candidates = [
    ...(await loadLegacyCustomerUsers(db)),
    ...(await loadExistingCustomers(db)),
  ];

  const issues = [
    ...findDuplicates(candidates, "phone"),
    ...findDuplicates(candidates, "email"),
  ];

  return {
    ok: issues.length === 0,
    issues,
  };
}

async function loadLegacyCustomerUsers(
  db: D1Database,
): Promise<IdentityCandidate[]> {
  const result = await db
    .prepare(
      `SELECT id, phone, email
         FROM users
        WHERE role = 5 OR role IS NULL`,
    )
    .all<{ id: number; phone: string | null; email: string | null }>();

  return (result.results ?? []).map((row) => ({
    table: "users",
    id: row.id,
    phone: row.phone,
    email: row.email,
  }));
}

async function loadExistingCustomers(
  db: D1Database,
): Promise<IdentityCandidate[]> {
  const columns = await db
    .prepare(`PRAGMA table_info(customers)`)
    .all<{ name: string }>();
  const columnNames = new Set((columns.results ?? []).map((row) => row.name));
  const phoneColumn = columnNames.has("primary_phone")
    ? "primary_phone"
    : "phone";
  const emailColumn = columnNames.has("primary_email")
    ? "primary_email"
    : "email";

  const result = await db
    .prepare(
      `SELECT id, ${phoneColumn} AS phone, ${emailColumn} AS email
         FROM customers`,
    )
    .all<{ id: string; phone: string | null; email: string | null }>();

  return (result.results ?? []).map((row) => ({
    table: "customers",
    id: row.id,
    phone: row.phone,
    email: row.email,
  }));
}

function findDuplicates(
  candidates: IdentityCandidate[],
  field: "phone" | "email",
): CustomerIdentityPreflightIssue[] {
  const byValue = new Map<string, CustomerIdentityPreflightSource[]>();

  for (const candidate of candidates) {
    const value = normalizeIdentityValue(candidate[field], field);
    if (!value) continue;
    const sources = byValue.get(value) ?? [];
    sources.push({ table: candidate.table, id: candidate.id });
    byValue.set(value, sources);
  }

  return Array.from(byValue.entries())
    .filter(([, sources]) => sources.length > 1)
    .map(([value, sources]) => ({
      type: field === "phone" ? "duplicate_phone" : "duplicate_email",
      value,
      sources,
    }));
}

function normalizeIdentityValue(
  value: string | null,
  field: "phone" | "email",
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return field === "phone"
    ? normalizeE164Phone(trimmed)
    : trimmed.toLowerCase();
}
