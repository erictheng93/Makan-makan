import { ref, computed } from "vue";
import type { Messages } from "./types";
import zhTWMessages from "./locales/zh-TW";

/**
 * i18n 多語言系統 — Kitchen Display
 * 支持繁體中文、簡體中文、英文、越南語、馬來語、印尼語
 */

export type Locale = "zh-TW" | "zh-CN" | "en-US" | "vi-VN" | "ms-MY" | "id-ID";

export interface LocaleConfig {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
}

export type { Messages } from "./types";

export const SUPPORTED_LOCALES: LocaleConfig[] = [
  { code: "zh-TW", name: "繁體中文", nativeName: "繁體中文", flag: "🇹🇼" },
  { code: "zh-CN", name: "简体中文", nativeName: "简体中文", flag: "🇨🇳" },
  { code: "en-US", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "vi-VN", name: "Tiếng Việt", nativeName: "Tiếng Việt", flag: "🇻🇳" },
  {
    code: "ms-MY",
    name: "Bahasa Malaysia",
    nativeName: "Bahasa Malaysia",
    flag: "🇲🇾",
  },
  {
    code: "id-ID",
    name: "Bahasa Indonesia",
    nativeName: "Bahasa Indonesia",
    flag: "🇮🇩",
  },
];

const currentLocale = ref<Locale>("zh-TW");

const messages = ref<Record<Locale, Messages>>({
  "zh-TW": zhTWMessages,
  "zh-CN": {},
  "en-US": {},
  "vi-VN": {},
  "ms-MY": {},
  "id-ID": {},
});

const loadedLocales = new Set<Locale>(["zh-TW"]);

export function getCurrentLocaleConfig(): LocaleConfig {
  return (
    SUPPORTED_LOCALES.find((l) => l.code === currentLocale.value) ||
    SUPPORTED_LOCALES[0]
  );
}

export function isLocaleLoaded(locale: Locale): boolean {
  return loadedLocales.has(locale);
}

export function setLocaleMessages(locale: Locale, newMessages: Messages): void {
  messages.value[locale] = deepMerge(messages.value[locale], newMessages);
}

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
 * 取得翻譯文本
 * @param key 翻譯鍵（支持點號分隔路徑，如 'common.save'）
 * @param params 參數物件（用於插值替換 {key} 佔位符）
 */
export function t(key: string, params?: Record<string, any>): string {
  const targetLocale = currentLocale.value;
  const keys = key.split(".");

  let value: any = messages.value[targetLocale];

  for (const k of keys) {
    if (value && typeof value === "object") {
      value = value[k];
    } else {
      break;
    }
  }

  // Fallback to zh-TW
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

  if (typeof value !== "string") {
    console.warn(`Translation key not found: ${key}`);
    return key;
  }

  if (params) {
    return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey]?.toString() || match;
    });
  }

  return value;
}

export function setLocale(locale: Locale): void {
  if (!SUPPORTED_LOCALES.find((l) => l.code === locale)) {
    console.error(`Unsupported locale: ${locale}`);
    return;
  }

  currentLocale.value = locale;

  try {
    localStorage.setItem("locale", locale);
  } catch (error) {
    console.error("Failed to save locale to localStorage:", error);
  }
}

export async function loadLocaleMessages(locale: Locale): Promise<void> {
  if (loadedLocales.has(locale)) {
    return;
  }

  try {
    const module = await import(`./locales/${locale}.ts`);
    setLocaleMessages(locale, module.default);
    loadedLocales.add(locale);
  } catch (error) {
    console.error(`Failed to load locale messages for ${locale}:`, error);
    throw error;
  }
}

export async function initI18n(): Promise<void> {
  let savedLocale: Locale | null = null;

  try {
    savedLocale = localStorage.getItem("locale") as Locale;
  } catch (error) {
    console.error("Failed to read locale from localStorage:", error);
  }

  const browserLocale = navigator.language;

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
  } else if (browserLocale.startsWith("en")) {
    targetLocale = "en-US";
  } else if (browserLocale.startsWith("vi")) {
    targetLocale = "vi-VN";
  } else if (browserLocale.startsWith("ms")) {
    targetLocale = "ms-MY";
  } else if (browserLocale.startsWith("id")) {
    targetLocale = "id-ID";
  }

  if (targetLocale !== "zh-TW") {
    await loadLocaleMessages(targetLocale);
  }

  setLocale(targetLocale);
}

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
