import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/**
 * Render a UTC offset as a SQLite date modifier.
 *
 * Minutes rather than hours because that is the unit a timezone offset is
 * actually defined in; every currently supported zone is a whole number of
 * hours, but the helpers should not be the thing that breaks if a half-hour
 * market is ever added.
 */
export function businessOffsetModifier(offsetMinutes: number): string {
  const minutes = Math.round(offsetMinutes);
  return `${minutes < 0 ? "-" : "+"}${Math.abs(minutes)} minutes`;
}

// SQLite's 'localtime' modifier follows the host timezone. Workers and GitHub
// Actions run in UTC, so the business day has to be cut at an explicit offset.
//
// The offset is a required argument, not a defaulted one. #329 was exactly a
// helper that quietly meant +8 for every caller, including reports for shops
// that had chosen otherwise and had that choice displayed back to them.
// Restaurant-scoped callers resolve it from `restaurants.timezone` (see
// BusinessTimezoneResolver); platform-wide aggregates pass
// PLATFORM_BUSINESS_TIMEZONE_OFFSET_MINUTES to say so out loud.
export function dateFromUnixMs(
  column: SQLWrapper,
  offsetMinutes: number,
): SQL<string> {
  return sql<string>`DATE(${column} / 1000, 'unixepoch', ${businessOffsetModifier(offsetMinutes)})`;
}

export function strftimeFromUnixMs(
  format: string,
  column: SQLWrapper,
  offsetMinutes: number,
): SQL<string> {
  return sql<string>`strftime(${format}, ${column} / 1000, 'unixepoch', ${businessOffsetModifier(offsetMinutes)})`;
}

export function businessDateNow(offsetMinutes: number): SQL<string> {
  return sql<string>`DATE('now', ${businessOffsetModifier(offsetMinutes)})`;
}

/** `strftime` over the current instant, cut at the same business boundary. */
export function strftimeNow(
  format: string,
  offsetMinutes: number,
  ...modifiers: string[]
): SQL<string> {
  const trailing = modifiers.map((modifier) => sql`, ${modifier}`);
  return sql<string>`strftime(${format}, 'now', ${businessOffsetModifier(offsetMinutes)}${sql.join(trailing, sql``)})`;
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
