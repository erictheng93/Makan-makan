import { sql } from "drizzle-orm";

export const DEFAULT_BUSINESS_TIMEZONE_OFFSET_MINUTES = 8 * 60;

export function getBusinessDate(
  date = new Date(),
  offsetMinutes = DEFAULT_BUSINESS_TIMEZONE_OFFSET_MINUTES,
): string {
  return new Date(date.getTime() + offsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function businessDateSql(
  offsetMinutes = DEFAULT_BUSINESS_TIMEZONE_OFFSET_MINUTES,
) {
  const hours = offsetMinutes / 60;
  const modifier = `${hours >= 0 ? "+" : ""}${hours} hours`;
  return sql`DATE('now', ${modifier})`;
}

export function businessDateFromUnixMsSql(
  unixMs: number,
  offsetMinutes = DEFAULT_BUSINESS_TIMEZONE_OFFSET_MINUTES,
) {
  const hours = offsetMinutes / 60;
  const modifier = `${hours >= 0 ? "+" : ""}${hours} hours`;
  return sql`DATE(${unixMs} / 1000, 'unixepoch', ${modifier})`;
}
