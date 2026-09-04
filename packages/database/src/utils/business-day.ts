import { sql } from "drizzle-orm";
import { businessOffsetModifier } from "./sql-time";

/**
 * The calendar date an instant falls on for a restaurant that cuts its
 * business day at `offsetMinutes` from UTC.
 *
 * The offset is required for the same reason it is on the SQL helpers: a
 * default of +8 is how #329 produced day boundaries that disagreed with the
 * timezone the shop had picked, silently.
 */
export function getBusinessDate(
  offsetMinutes: number,
  date = new Date(),
): string {
  return new Date(date.getTime() + offsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function businessDateSql(offsetMinutes: number) {
  return sql`DATE('now', ${businessOffsetModifier(offsetMinutes)})`;
}

export function businessDateFromUnixMsSql(
  unixMs: number,
  offsetMinutes: number,
) {
  return sql`DATE(${unixMs} / 1000, 'unixepoch', ${businessOffsetModifier(offsetMinutes)})`;
}
