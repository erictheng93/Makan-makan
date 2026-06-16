import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

// SQLite's 'localtime' modifier follows the host timezone. Workers and GitHub
// Actions run in UTC, so keep business-date buckets deterministic.
export function dateFromUnixMs(column: SQLWrapper): SQL<string> {
  return sql<string>`DATE(${column} / 1000, 'unixepoch', '+8 hours')`;
}

export function strftimeFromUnixMs(
  format: string,
  column: SQLWrapper,
): SQL<string> {
  return sql<string>`strftime(${format}, ${column} / 1000, 'unixepoch', '+8 hours')`;
}

export function businessDateNow(): SQL<string> {
  return sql<string>`DATE('now', '+8 hours')`;
}

export function juliandayFromUnixMs(column: SQLWrapper): SQL<number> {
  return sql<number>`julianday(${column} / 1000, 'unixepoch')`;
}

export function unixMsDiffMinutes(
  endColumn: SQLWrapper,
  startColumn: SQLWrapper,
): SQL<number> {
  return sql<number>`(${juliandayFromUnixMs(endColumn)} - ${juliandayFromUnixMs(startColumn)}) * 24 * 60`;
}

export function unixMsDiffSeconds(
  endColumn: SQLWrapper,
  startColumn: SQLWrapper,
): SQL<number> {
  return sql<number>`(${juliandayFromUnixMs(endColumn)} - ${juliandayFromUnixMs(startColumn)}) * 24 * 60 * 60`;
}
