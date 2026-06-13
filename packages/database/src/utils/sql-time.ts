import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

export function dateFromUnixMs(column: SQLWrapper): SQL<string> {
  return sql<string>`DATE(${column} / 1000, 'unixepoch', 'localtime')`;
}

export function strftimeFromUnixMs(
  format: string,
  column: SQLWrapper,
): SQL<string> {
  return sql<string>`strftime(${format}, ${column} / 1000, 'unixepoch', 'localtime')`;
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
