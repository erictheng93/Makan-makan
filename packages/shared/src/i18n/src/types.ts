/**
 * Shared i18n types for MakanMasak platform
 * Type-safe internationalization system
 */

export type SupportedLocale =
  | "en-US"
  | "zh-TW"
  | "zh-CN"
  | "ms-MY"
  | "id-ID"
  | "vi-VN";

export interface LocaleInfo {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag: string;
  direction: "ltr" | "rtl";
  dateFormat: string;
  currencyCode: string;
  currencySymbol: string;
}

/**
 * Base message schema - ensure all apps follow this structure
 */
export interface BaseMessageSchema {
  common: {
    // Actions
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    view: string;
    create: string;
    update: string;
    search: string;
    confirm: string;
    close: string;

    // States
    loading: string;
    success: string;
    error: string;
    yes: string;
    no: string;
    active: string;
    inactive: string;

    // Navigation
    next: string;
    previous: string;
    finish: string;
    back: string;

    // Data
    total: string;
    count: string;
    name: string;
    description: string;
    status: string;
    date: string;
    time: string;
  };

  validation: {
    required: string;
    email: string;
    password: string;
    passwordConfirm: string;
    minLength: string;
    maxLength: string;
    invalidFormat: string;
  };

  messages: {
    saveSuccess: string;
    saveError: string;
    deleteConfirm: string;
    deleteSuccess: string;
    deleteError: string;
    loadError: string;
    networkError: string;
    permissionDenied: string;
    sessionExpired: string;
  };
}

/**
 * Restaurant-specific message schema
 */
export interface RestaurantMessageSchema extends BaseMessageSchema {
  restaurant: {
    title: string;
    table: string;
    room: string;
    menu: string;
    order: string;
    kitchen: string;
    customer: string;
    staff: string;
  };

  orders: {
    title: string;
    newOrder: string;
    orderNumber: string;
    customer: string;
    table: string;
    items: string;
    subtotal: string;
    tax: string;
    discount: string;
    total: string;
    status: {
      pending: string;
      preparing: string;
      ready: string;
      served: string;
      cancelled: string;
    };
  };

  kitchen: {
    title: string;
    orders: string;
    preparation: string;
    ready: string;
    served: string;
    timer: string;
  };
}

/**
 * Admin-specific message schema
 */
export interface AdminMessageSchema extends BaseMessageSchema {
  nav: {
    dashboard: string;
    restaurants: string;
    users: string;
    analytics: string;
    settings: string;
    backup: string;
  };

  dashboard: {
    title: string;
    totalRestaurants: string;
    totalUsers: string;
    monthlyRevenue: string;
    systemHealth: string;
  };

  backup: {
    title: string;
    createBackup: string;
    restoreBackup: string;
    backupHistory: string;
    autoBackup: string;
    backupStatus: string;
    downloadBackup: string;
  };

  analytics: {
    title: string;
    salesReport: string;
    userActivity: string;
    systemMetrics: string;
    exportData: string;
  };
}

/**
 * Message schemas for different apps
 */
export interface CustomerAppMessages extends BaseMessageSchema {
  navigation: Record<string, string>;
  home: Record<string, unknown>;
  qrScan: Record<string, string>;
  menu: Record<string, string>;
  menuItem: Record<string, string>;
  customization: Record<string, string>;
  cart: Record<string, unknown>;
  order: Record<string, unknown>;
  service: Record<string, unknown>;
  payment: Record<string, unknown>;
  profile: Record<string, string>;
  restaurant: Record<string, string>;
  about: Record<string, unknown>;
  privacy: Record<string, unknown>;
  terms: Record<string, unknown>;
  errors: Record<string, string>;
  time: Record<string, string>;
  auth: Record<string, unknown>;
  toast: Record<string, string>;
  orderTracking: Record<string, unknown>;
  orderHistory: Record<string, unknown>;
  shopCart: Record<string, unknown>;
  errorBoundary: Record<string, string>;
  manualInput: Record<string, string>;
  qrScanView: Record<string, string>;
  shopMenu: Record<string, string>;
  menuItemCard: Record<string, string>;
  menuItemModal: Record<string, unknown>;
  orderItem: Record<string, string>;
}
export type AdminDashboardMessages = AdminMessageSchema &
  RestaurantMessageSchema;
export type KitchenDisplayMessages = RestaurantMessageSchema;

/**
 * Locale configuration
 */
export const SUPPORTED_LOCALES: LocaleInfo[] = [
  {
    code: "en-US",
    name: "English",
    nativeName: "English",
    flag: "🇺🇸",
    direction: "ltr",
    dateFormat: "MM/dd/yyyy",
    currencyCode: "USD",
    currencySymbol: "$",
  },
  {
    code: "zh-TW",
    name: "Traditional Chinese",
    nativeName: "繁體中文",
    flag: "🇹🇼",
    direction: "ltr",
    dateFormat: "yyyy/MM/dd",
    currencyCode: "TWD",
    currencySymbol: "NT$",
  },
  {
    code: "zh-CN",
    name: "Simplified Chinese",
    nativeName: "简体中文",
    flag: "🇨🇳",
    direction: "ltr",
    dateFormat: "yyyy-MM-dd",
    currencyCode: "CNY",
    currencySymbol: "¥",
  },
  {
    code: "ms-MY",
    name: "Malay",
    nativeName: "Bahasa Malaysia",
    flag: "🇲🇾",
    direction: "ltr",
    dateFormat: "dd/MM/yyyy",
    currencyCode: "MYR",
    currencySymbol: "RM",
  },
  {
    code: "id-ID",
    name: "Indonesian",
    nativeName: "Bahasa Indonesia",
    flag: "🇮🇩",
    direction: "ltr",
    dateFormat: "dd/MM/yyyy",
    currencyCode: "IDR",
    currencySymbol: "Rp",
  },
  {
    code: "vi-VN",
    name: "Vietnamese",
    nativeName: "Tiếng Việt",
    flag: "🇻🇳",
    direction: "ltr",
    dateFormat: "dd/MM/yyyy",
    currencyCode: "VND",
    currencySymbol: "₫",
  },
];

/**
 * Helper type for enforcing translation completeness
 */
export type TranslationCompletenessCheck<T> = {
  [K in SupportedLocale]: T;
};
