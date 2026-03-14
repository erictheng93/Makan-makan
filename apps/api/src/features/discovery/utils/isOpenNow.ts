import type { BusinessHours } from "../types";

/**
 * Check if a restaurant is currently open.
 * Workers run in UTC, so we must convert to the restaurant's timezone.
 */
export function isOpenNow(
  businessHours: BusinessHours | null | undefined,
  timezone: string = "Asia/Taipei",
  now?: Date,
): boolean {
  if (!businessHours) return false;

  const currentTime = now || new Date();

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(currentTime);
  const weekdayPart =
    parts.find((p) => p.type === "weekday")?.value?.toLowerCase() || "";
  const hourPart = parts.find((p) => p.type === "hour")?.value || "00";
  const minutePart = parts.find((p) => p.type === "minute")?.value || "00";

  const dayKey = weekdayPart;
  const todayHours = businessHours[dayKey];

  if (!todayHours || todayHours.closed) return false;

  const currentHHmm = `${hourPart}:${minutePart}`;
  return currentHHmm >= todayHours.open && currentHHmm < todayHours.close;
}
