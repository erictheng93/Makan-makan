import { useI18n } from "@/i18n";

/**
 * Date Formatter Composable
 * Provides date formatting utilities
 */
export function useDateFormatter() {
  const { locale } = useI18n();

  const getWeekdayName = (
    date: Date,
    format: "short" | "long" = "short",
  ): string => {
    const weekdayKeys = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayIndex = date.getDay();
    const key = `weekdays.${format}.${weekdayKeys[dayIndex]}`;

    const { t } = useI18n();
    return t(key);
  };

  const formatDate = (
    date: Date | string,
    includeWeekday: boolean = false,
  ): string => {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return "Invalid Date";
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");

    let formatted = "";

    switch (locale.value) {
      case "zh-TW":
      case "zh-CN":
        formatted = `${year}年${parseInt(month)}月${parseInt(day)}日`;
        break;
      case "ja-JP":
        formatted = `${year}年${parseInt(month)}月${parseInt(day)}日`;
        break;
      case "en-US":
        formatted = `${month}/${day}/${year}`;
        break;
      default:
        formatted = `${year}-${month}-${day}`;
    }

    if (includeWeekday) {
      formatted = `${formatted} (${getWeekdayName(dateObj, "short")})`;
    }

    return formatted;
  };

  const formatTime = (date: Date | string): string => {
    let hours: number;
    let minutes: number;

    if (typeof date === "string") {
      const parts = date.split(":");
      hours = parseInt(parts[0]);
      minutes = parseInt(parts[1]);
    } else {
      hours = date.getHours();
      minutes = date.getMinutes();
    }

    if (locale.value === "en-US") {
      const period = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
    } else {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  };

  const formatDateTime = (date: Date | string): string => {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return "Invalid Date";
    }

    const datePart = formatDate(dateObj, false);
    const timePart = formatTime(dateObj);

    return `${datePart} ${timePart}`;
  };

  const formatRelativeTime = (date: Date | string): string => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return locale.value === "en-US" ? "Just now" : "剛剛";
    } else if (diffMins < 60) {
      return locale.value === "en-US"
        ? `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`
        : `${diffMins}分鐘前`;
    } else if (diffHours < 24) {
      return locale.value === "en-US"
        ? `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
        : `${diffHours}小時前`;
    } else if (diffDays < 7) {
      return locale.value === "en-US"
        ? `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
        : `${diffDays}天前`;
    } else {
      return formatDate(dateObj, false);
    }
  };

  const formatDateRange = (
    startDate: Date | string,
    endDate: Date | string,
  ): string => {
    const start = formatDate(startDate, false);
    const end = formatDate(endDate, false);

    if (locale.value === "en-US") {
      return `${start} - ${end}`;
    } else {
      return `${start} 至 ${end}`;
    }
  };

  const getMonthName = (
    monthIndex: number,
    format: "short" | "long" = "long",
  ): string => {
    const date = new Date(2000, monthIndex, 1);

    const localeMap: Record<string, string> = {
      "zh-TW": "zh-TW",
      "zh-CN": "zh-CN",
      "en-US": "en-US",
      "ja-JP": "ja-JP",
    };

    const options: Intl.DateTimeFormatOptions = {
      month: format,
    };

    return new Intl.DateTimeFormat(
      localeMap[locale.value] || "zh-TW",
      options,
    ).format(date);
  };

  const toISOString = (date: Date | string): string => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toISOString();
  };

  const fromISOString = (isoString: string): Date => {
    return new Date(isoString);
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (locale.value === "en-US") {
      if (hours > 0 && mins > 0) {
        return `${hours}h ${mins}m`;
      } else if (hours > 0) {
        return `${hours}h`;
      } else {
        return `${mins}m`;
      }
    } else {
      if (hours > 0 && mins > 0) {
        return `${hours}小時${mins}分鐘`;
      } else if (hours > 0) {
        return `${hours}小時`;
      } else {
        return `${mins}分鐘`;
      }
    }
  };

  const calculateWorkHours = (startTime: string, endTime: string): number => {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    let diffMinutes = endMinutes - startMinutes;

    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }

    return diffMinutes / 60;
  };

  const formatWorkHours = (hours: number): string => {
    if (locale.value === "en-US") {
      return `${hours.toFixed(1)}h`;
    } else {
      return `${hours.toFixed(1)}小時`;
    }
  };

  const getToday = (): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const isToday = (date: Date | string): boolean => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const today = getToday();

    return (
      dateObj.getFullYear() === today.getFullYear() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getDate() === today.getDate()
    );
  };

  const isThisWeek = (date: Date | string): boolean => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const today = getToday();

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return dateObj >= weekStart && dateObj <= weekEnd;
  };

  const startOfDay = (date: Date | string): Date => {
    const dateObj = typeof date === "string" ? new Date(date) : new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    return dateObj;
  };

  const endOfDay = (date: Date | string): Date => {
    const dateObj = typeof date === "string" ? new Date(date) : new Date(date);
    dateObj.setHours(23, 59, 59, 999);
    return dateObj;
  };

  const addDays = (date: Date | string, days: number): Date => {
    const dateObj = typeof date === "string" ? new Date(date) : new Date(date);
    dateObj.setDate(dateObj.getDate() + days);
    return dateObj;
  };

  const toInputDate = (date: Date | string): string => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    formatDate,
    formatTime,
    formatDateTime,
    formatRelativeTime,
    formatDateRange,
    formatDuration,
    formatWorkHours,
    getWeekdayName,
    getMonthName,
    calculateWorkHours,
    toISOString,
    fromISOString,
    getToday,
    isToday,
    isThisWeek,
    startOfDay,
    endOfDay,
    addDays,
    toInputDate,
  };
}
