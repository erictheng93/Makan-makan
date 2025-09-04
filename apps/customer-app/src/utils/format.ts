import dayjs from "dayjs";
import "dayjs/locale/zh-tw";
import relativeTime from "dayjs/plugin/relativeTime";
import localizedFormat from "dayjs/plugin/localizedFormat";

// 設定 dayjs
dayjs.locale("zh-tw");
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

/**
 * 格式化價格 - 將分轉換為元並格式化
 * @param cents 以分為單位的價格
 * @returns 格式化後的價格字串
 */
export const formatPrice = (cents: number): string => {
  if (typeof cents !== "number" || isNaN(cents)) {
    return "0.00";
  }

  const dollars = cents / 100;
  return dollars.toLocaleString("zh-TW", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * 格式化貨幣 - 包含貨幣符號
 * @param cents 以分為單位的價格
 * @param currency 貨幣符號，預設為 $
 * @returns 格式化後的貨幣字串
 */
export const formatCurrency = (
  cents: number,
  currency: string = "$",
): string => {
  return `${currency}${formatPrice(cents)}`;
};

/**
 * 格式化日期時間
 * @param date 日期字串或 Date 物件
 * @param format 格式化模式，預設為 'YYYY-MM-DD HH:mm'
 * @returns 格式化後的日期字串
 */
export const formatDateTime = (
  date: string | Date,
  format: string = "YYYY-MM-DD HH:mm",
): string => {
  if (!date) return "";

  try {
    return dayjs(date).format(format);
  } catch (error) {
    console.warn("日期格式化失敗:", error);
    return String(date);
  }
};

/**
 * 格式化相對時間
 * @param date 日期字串或 Date 物件
 * @returns 相對時間字串（如：3分鐘前）
 */
export const formatRelativeTime = (date: string | Date): string => {
  if (!date) return "";

  try {
    return dayjs(date).fromNow();
  } catch (error) {
    console.warn("相對時間格式化失敗:", error);
    return String(date);
  }
};

/**
 * 格式化日期 - 僅日期部分
 * @param date 日期字串或 Date 物件
 * @returns 格式化後的日期字串
 */
export const formatDate = (date: string | Date): string => {
  return formatDateTime(date, "YYYY-MM-DD");
};

/**
 * 格式化時間 - 僅時間部分
 * @param date 日期字串或 Date 物件
 * @returns 格式化後的時間字串
 */
export const formatTime = (date: string | Date): string => {
  return formatDateTime(date, "HH:mm");
};

/**
 * 格式化電話號碼
 * @param phone 電話號碼字串
 * @returns 格式化後的電話號碼
 */
export const formatPhone = (phone: string): string => {
  if (!phone) return "";

  // 移除所有非數字字符
  const numbers = phone.replace(/\D/g, "");

  // 台灣手機號碼格式化 (09XX-XXX-XXX)
  if (numbers.length === 10 && numbers.startsWith("09")) {
    return `${numbers.slice(0, 4)}-${numbers.slice(4, 7)}-${numbers.slice(7)}`;
  }

  // 台灣市話號碼格式化 (0X-XXXX-XXXX)
  if (numbers.length === 9 || numbers.length === 10) {
    if (numbers.length === 9) {
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    } else {
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    }
  }

  return phone;
};

/**
 * 格式化數量
 * @param count 數量
 * @param singular 單數形式
 * @param plural 複數形式（可選）
 * @returns 格式化後的數量字串
 */
export const formatCount = (
  count: number,
  singular: string,
  plural?: string,
): string => {
  if (count === 0) {
    return `無${singular}`;
  }

  if (count === 1) {
    return `1 ${singular}`;
  }

  return `${count.toLocaleString()} ${plural || singular}`;
};

/**
 * 格式化檔案大小
 * @param bytes 位元組數
 * @returns 格式化後的檔案大小字串
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * 格式化百分比
 * @param value 數值 (0-1 之間)
 * @param decimals 小數位數
 * @returns 格式化後的百分比字串
 */
export const formatPercentage = (
  value: number,
  decimals: number = 1,
): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * 截斷文字
 * @param text 原始文字
 * @param maxLength 最大長度
 * @param suffix 後綴，預設為 '...'
 * @returns 截斷後的文字
 */
export const truncateText = (
  text: string,
  maxLength: number,
  suffix: string = "...",
): string => {
  if (!text || text.length <= maxLength) {
    return text || "";
  }

  return text.slice(0, maxLength - suffix.length) + suffix;
};

/**
 * 格式化地址
 * @param address 地址物件或字串
 * @returns 格式化後的地址字串
 */
export const formatAddress = (address: any): string => {
  if (typeof address === "string") {
    return address;
  }

  if (typeof address === "object" && address !== null) {
    const parts = [
      address.city,
      address.district,
      address.street,
      address.number,
    ].filter(Boolean);

    return parts.join("");
  }

  return "";
};

/**
 * 格式化營業時間
 * @param businessHours 營業時間物件
 * @returns 格式化後的營業時間字串
 */
export const formatBusinessHours = (businessHours: any): string => {
  if (!businessHours || typeof businessHours !== "object") {
    return "營業時間未設定";
  }

  const dayNames = {
    monday: "週一",
    tuesday: "週二",
    wednesday: "週三",
    thursday: "週四",
    friday: "週五",
    saturday: "週六",
    sunday: "週日",
  };

  const hours = Object.entries(businessHours)
    .map(([day, time]) => {
      const dayName = dayNames[day as keyof typeof dayNames];
      return dayName ? `${dayName}: ${time || "休息"}` : null;
    })
    .filter(Boolean);

  return hours.join(", ");
};

/**
 * 格式化辣度級別
 * @param spiceLevel 辣度級別 (0-4)
 * @returns 辣度描述字串
 */
export const formatSpiceLevel = (spiceLevel: number): string => {
  const levels = ["不辣", "微辣", "小辣", "中辣", "大辣"];
  return levels[spiceLevel] || "未知";
};

/**
 * 格式化訂單狀態
 * @param status 訂單狀態代碼
 * @returns 狀態描述字串
 */
export const formatOrderStatus = (status: number): string => {
  const statuses = {
    0: "待確認",
    1: "已確認",
    2: "製作中",
    3: "準備完成",
    4: "已送達",
    5: "已完成",
    6: "已取消",
  };

  return statuses[status as keyof typeof statuses] || "未知狀態";
};
