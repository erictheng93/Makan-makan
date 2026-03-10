import { useI18n } from "@/i18n";

/**
 * Date Formatter Composable
 * Provides date formatting utilities
 */
export function useDateFormatter() {
  const { locale } = useI18n();

  /**
   * r�~��o
   */
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

  /**
   * <�
   * @param date Date 
a ISO W2
   * @param includeWeekday /&+~
   */
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
        formatted = `${year}t${parseInt(month)}${parseInt(day)}�`;
        break;
      case "ja-JP":
        formatted = `${year}t${parseInt(month)}${parseInt(day)}�`;
        break;
      case "en-US":
        formatted = `${month}/${day}/${year}`;
        break;
      default:
        formatted = `${year}-${month}-${day}`;
    }

    if (includeWeekday) {
      const weekday = getWeekdayName(dateObj, "short");

      if (locale.value === "en-US") {
        formatted = `${formatted} (${weekday})`;
      } else {
        formatted = `${formatted} (${weekday})`;
      }
    }

    return formatted;
  };

  /**
   * <B�
   * @param date Date 
aB�W2 (HH:mm)
   */
  const formatTime = (date: Date | string): string => {
    let hours: number;
    let minutes: number;

    if (typeof date === "string") {
      // G-/ "HH:mm" <
      const parts = date.split(":");
      hours = parseInt(parts[0]);
      minutes = parseInt(parts[1]);
    } else {
      hours = date.getHours();
      minutes = date.getMinutes();
    }

    if (locale.value === "en-US") {
      // 12B6
      const period = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
    } else {
      // 24B6
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  };

  /**
   * <�B�
   * @param date Date 
a ISO W2
   */
  const formatDateTime = (date: Date | string): string => {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return "Invalid Date";
    }

    const datePart = formatDate(dateObj, false);
    const timePart = formatTime(dateObj);

    return `${datePart} ${timePart}`;
  };

  /**
   * <��
B�EKM	
   */
  const formatRelativeTime = (date: Date | string): string => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return locale.value === "en-US" ? "Just now" : "[[";
    } else if (diffMins < 60) {
      return locale.value === "en-US"
        ? `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`
        : `${diffMins}M`;
    } else if (diffHours < 24) {
      return locale.value === "en-US"
        ? `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
        : `${diffHours}BM`;
    } else if (diffDays < 7) {
      return locale.value === "en-US"
        ? `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
        : `${diffDays})M`;
    } else {
      return formatDate(dateObj, false);
    }
  };

  /**
   * <��
   */
  const formatDateRange = (
    startDate: Date | string,
    endDate: Date | string,
  ): string => {
    const start = formatDate(startDate, false);
    const end = formatDate(endDate, false);

    if (locale.value === "en-US") {
      return `${start} - ${end}`;
    } else {
      return `${start} � ${end}`;
    }
  };

  /**
   * r��
1
   */
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

  /**
   * <� ISO 8601 W2
   */
  const toISOString = (date: Date | string): string => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toISOString();
  };

  /**
   * � ISO W2� Date
   */
  const fromISOString = (isoString: string): Date => {
    return new Date(isoString);
  };

  /**
   * <Bw
   */
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
        return `${hours}B${mins}`;
      } else if (hours > 0) {
        return `${hours}B`;
      } else {
        return `${mins}`;
      }
    }
  };

  /**
   * �i�K���B
   */
  const calculateWorkHours = (startTime: string, endTime: string): number => {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    let diffMinutes = endMinutes - startMinutes;

    // �H���
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }

    return diffMinutes / 60;
  };

  /**
   * <�B
   */
  const formatWorkHours = (hours: number): string => {
    if (locale.value === "en-US") {
      return `${hours.toFixed(1)}h`;
    } else {
      return `${hours.toFixed(1)}B`;
    }
  };

  /**
   * r��)���B
   */
  const getToday = (): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  /**
   * ��/&/�)
   */
  const isToday = (date: Date | string): boolean => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const today = getToday();

    return (
      dateObj.getFullYear() === today.getFullYear() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getDate() === today.getDate()
    );
  };

  /**
   * ��/&/,1
   */
  const isThisWeek = (date: Date | string): boolean => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const today = getToday();

    // r�,1���1�
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    // r�,1�P_1m
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return dateObj >= weekStart && dateObj <= weekEnd;
  };

  /**
   * r�����B��B
   */
  const startOfDay = (date: Date | string): Date => {
    const dateObj = typeof date === "string" ? new Date(date) : new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    return dateObj;
  };

  /**
   * r���P_B�23:59:59.999
   */
  const endOfDay = (date: Date | string): Date => {
    const dateObj = typeof date === "string" ? new Date(date) : new Date(date);
    dateObj.setHours(23, 59, 59, 999);
    return dateObj;
  };

  /**
   * ��)x
   */
  const addDays = (date: Date | string, days: number): Date => {
    const dateObj = typeof date === "string" ? new Date(date) : new Date(date);
    dateObj.setDate(dateObj.getDate() + days);
    return dateObj;
  };

  /**
   * <�8eF�(��W2 (YYYY-MM-DD)
   */
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
