import { ref, computed } from "vue";
import type { Messages } from "./types";
import zhTWMessages from "./locales/zh-TW";

/**
 * i18n 多語言系統
 * 支持繁體中文、簡體中文、英文、日文、越南語、印尼語
 */

// 支持的語言類型
export type Locale = "zh-TW" | "zh-CN" | "en-US" | "ja-JP" | "vi-VN" | "id-ID";

// 語言配置接口
export interface LocaleConfig {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
  dateFormat: string;
  timeFormat: string;
  dateTimeFormat: string;
}

// 翻譯消息接口 — re-exported from types.ts to avoid circular dependency
export type { Messages } from "./types";

// 支持的語言列表
export const SUPPORTED_LOCALES: LocaleConfig[] = [
  {
    code: "zh-TW",
    name: "繁體中文",
    nativeName: "繁體中文",
    flag: "🇹🇼",
    dateFormat: "YYYY年MM月DD日",
    timeFormat: "HH:mm",
    dateTimeFormat: "YYYY年MM月DD日 HH:mm",
  },
  {
    code: "zh-CN",
    name: "简体中文",
    nativeName: "简体中文",
    flag: "🇨🇳",
    dateFormat: "YYYY年MM月DD日",
    timeFormat: "HH:mm",
    dateTimeFormat: "YYYY年MM月DD日 HH:mm",
  },
  {
    code: "en-US",
    name: "English",
    nativeName: "English",
    flag: "🇺🇸",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "hh:mm A",
    dateTimeFormat: "MM/DD/YYYY hh:mm A",
  },
  {
    code: "ja-JP",
    name: "日本語",
    nativeName: "日本語",
    flag: "🇯🇵",
    dateFormat: "YYYY年MM月DD日",
    timeFormat: "HH:mm",
    dateTimeFormat: "YYYY年MM月DD日 HH:mm",
  },
  {
    code: "vi-VN",
    name: "Tiếng Việt",
    nativeName: "Tiếng Việt",
    flag: "🇻🇳",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    dateTimeFormat: "DD/MM/YYYY HH:mm",
  },
  {
    code: "id-ID",
    name: "Bahasa Indonesia",
    nativeName: "Bahasa Indonesia",
    flag: "🇮🇩",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    dateTimeFormat: "DD/MM/YYYY HH:mm",
  },
];

// 當前語言
const currentLocale = ref<Locale>("zh-TW");

// 翻譯消息存儲 — zh-TW is loaded statically as the required fallback
const messages = ref<Record<Locale, Messages>>({
  "zh-TW": zhTWMessages,
  "zh-CN": {},
  "en-US": {},
  "ja-JP": {},
  "vi-VN": {},
  "id-ID": {},
});

// 已加載的語言
const loadedLocales = new Set<Locale>(["zh-TW"]);

/**
 * 獲取當前語言配置
 */
export function getCurrentLocaleConfig(): LocaleConfig {
  return (
    SUPPORTED_LOCALES.find((l) => l.code === currentLocale.value) ||
    SUPPORTED_LOCALES[0]
  );
}

/**
 * 檢查語言是否已加載
 */
export function isLocaleLoaded(locale: Locale): boolean {
  return loadedLocales.has(locale);
}

/**
 * 設置語言消息
 */
export function setLocaleMessages(locale: Locale, newMessages: Messages): void {
  messages.value[locale] = deepMerge(messages.value[locale], newMessages);
}

/**
 * 深度合併對象
 */
function deepMerge(target: any, source: any): any {
  if (!source) return target;
  if (!target) return source;

  const result = { ...target };

  Object.keys(source).forEach((key) => {
    if (source[key] instanceof Object && key in target) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  });

  return result;
}

/**
 * 獲取翻譯文本
 * @param key 翻譯鍵（支持點號分隔的嵌套路徑，如 'common.save'）
 * @param params 參數對象（用於插值替換）
 * @param locale 指定語言（可選，默認使用當前語言）
 */
export function t(
  key: string,
  params?: Record<string, any>,
  locale?: Locale,
): string {
  const targetLocale = locale || currentLocale.value;
  const keys = key.split(".");

  let value: any = messages.value[targetLocale];

  // 遍歷嵌套鍵
  for (const k of keys) {
    if (value && typeof value === "object") {
      value = value[k];
    } else {
      break;
    }
  }

  // 如果找不到翻譯，嘗試使用繁體中文作為備用
  if (typeof value !== "string" && targetLocale !== "zh-TW") {
    value = messages.value["zh-TW"];
    for (const k of keys) {
      if (value && typeof value === "object") {
        value = value[k];
      } else {
        break;
      }
    }
  }

  // 如果仍然找不到，返回原始鍵
  if (typeof value !== "string") {
    console.warn(`Translation key not found: ${key}`);
    return key;
  }

  // 參數插值替換
  if (params) {
    return value.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }

  return value;
}

/**
 * 設置當前語言
 */
export function setLocale(locale: Locale): void {
  if (!SUPPORTED_LOCALES.find((l) => l.code === locale)) {
    console.error(`Unsupported locale: ${locale}`);
    return;
  }

  currentLocale.value = locale;

  // 保存到 localStorage
  try {
    localStorage.setItem("locale", locale);
  } catch (error) {
    console.error("Failed to save locale to localStorage:", error);
  }
}

/**
 * 加載語言包
 */
export async function loadLocaleMessages(locale: Locale): Promise<void> {
  if (loadedLocales.has(locale)) {
    return;
  }

  try {
    // 動態導入語言包
    const module = await import(`./locales/${locale}`);
    setLocaleMessages(locale, module.default);
    loadedLocales.add(locale);
  } catch (error) {
    console.error(`Failed to load locale messages for ${locale}:`, error);
    throw error;
  }
}

/**
 * 初始化 i18n
 */
export async function initI18n(): Promise<void> {
  // 從 localStorage 讀取保存的語言
  let savedLocale: Locale | null = null;

  try {
    savedLocale = localStorage.getItem("locale") as Locale;
  } catch (error) {
    console.error("Failed to read locale from localStorage:", error);
  }

  // 檢測瀏覽器語言
  const browserLocale = navigator.language;

  // 確定要使用的語言
  let targetLocale: Locale = "zh-TW";

  if (savedLocale && SUPPORTED_LOCALES.find((l) => l.code === savedLocale)) {
    targetLocale = savedLocale;
  } else if (
    browserLocale.startsWith("zh-CN") ||
    browserLocale.startsWith("zh-Hans")
  ) {
    targetLocale = "zh-CN";
  } else if (browserLocale.startsWith("zh")) {
    targetLocale = "zh-TW";
  } else if (browserLocale.startsWith("ja")) {
    targetLocale = "ja-JP";
  } else if (browserLocale.startsWith("en")) {
    targetLocale = "en-US";
  } else if (browserLocale.startsWith("vi")) {
    targetLocale = "vi-VN";
  } else if (browserLocale.startsWith("id")) {
    targetLocale = "id-ID";
  }

  // zh-TW is already loaded statically via import at module top level

  // 如果目標語言不是繁體中文，加載目標語言包
  if (targetLocale !== "zh-TW") {
    await loadLocaleMessages(targetLocale);
  }

  setLocale(targetLocale);
}

/**
 * i18n Composable（用於 Vue 組件）
 */
export function useI18n() {
  const locale = computed(() => currentLocale.value);
  const localeConfig = computed(() => getCurrentLocaleConfig());

  const switchLocale = async (newLocale: Locale) => {
    if (!isLocaleLoaded(newLocale)) {
      await loadLocaleMessages(newLocale);
    }
    setLocale(newLocale);
  };

  return {
    locale,
    localeConfig,
    t,
    setLocale,
    switchLocale,
    supportedLocales: SUPPORTED_LOCALES,
  };
}

/**
 * Admin i18n Composable（為 Admin Dashboard 提供兼容性介面）
 */
export function useAdminI18n() {
  const i18n = useI18n();

  return {
    ...i18n,
    getCurrentLocaleInfo: () => i18n.localeConfig.value,
    getAvailableLocales: () => i18n.supportedLocales,
    switchLocale: async () => {
      // For now, just return true. The actual locale switching
      // is handled by the LanguageSwitcher component
      return true;
    },
  };
}
