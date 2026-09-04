/**
 * Date ranges for the analytics period selector.
 *
 * Extracted from AnalyticsView so the boundaries can be tested directly. They
 * were rolling windows before — "this month" subtracted 30 days, "this year"
 * 365 — so on the 3rd of a month the figure labelled 本月 was mostly the
 * previous month's trade, and nothing on the screen said so (#312).
 *
 * Boundaries are computed in the caller's local time on purpose: a shop reads
 * these against its own calendar, not UTC. `toISOString()` converts to UTC for
 * the wire afterwards. Tests must pin TZ, or they pass locally and describe a
 * different day on a UTC runner.
 */
export type AnalyticsPeriod = "today" | "week" | "month" | "quarter" | "year";

export function analyticsPeriodStart(period: AnalyticsPeriod, now: Date): Date {
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "week": {
      // Weeks start Monday. getDay() calls Sunday 0, and Sunday belongs to the
      // week that began six days earlier, not to one starting that morning.
      const daysSinceMonday = (now.getDay() + 6) % 7;
      return new Date(y, m, now.getDate() - daysSinceMonday);
    }
    case "month":
      return new Date(y, m, 1);
    case "quarter":
      return new Date(y, Math.floor(m / 3) * 3, 1);
    case "year":
      return new Date(y, 0, 1);
    case "today":
    default:
      return new Date(y, m, now.getDate());
  }
}

export function analyticsDateRange(
  period: AnalyticsPeriod,
  now: Date = new Date(),
): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: analyticsPeriodStart(period, now).toISOString(),
    dateTo: now.toISOString(),
  };
}
