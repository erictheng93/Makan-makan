import { createI18n, type AppLocaleConfig } from "@makanmasak/i18n";
import type { Messages } from "./types";
import zhTWMessages from "./locales/zh-TW";
import { mergeLocaleMessages } from "./merge-locale-messages";

export type Locale = "zh-TW" | "zh-CN" | "en-US" | "ja-JP" | "vi-VN" | "id-ID";

export interface LocaleConfig extends AppLocaleConfig<Locale> {
  dateFormat: string;
  timeFormat: string;
  dateTimeFormat: string;
}

export type { Messages } from "./types";

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

const localeLoaders: Record<
  Exclude<Locale, "zh-TW">,
  () => Promise<Messages>
> = {
  "zh-CN": async () => (await import("./locales/zh-CN")).default,
  "en-US": async () => (await import("./locales/en-US")).default,
  "ja-JP": async () => (await import("./locales/ja-JP")).default,
  "vi-VN": async () => (await import("./locales/vi-VN")).default,
  "id-ID": async () => (await import("./locales/id-ID")).default,
};

const runtime = createI18n<Locale, Messages>({
  defaultLocale: "zh-TW",
  fallbackLocale: "zh-TW",
  supportedLocales: SUPPORTED_LOCALES,
  initialMessages: { "zh-TW": zhTWMessages },
  loadMessages: async (locale) => {
    if (locale === "zh-TW") {
      return zhTWMessages;
    }

    return mergeLocaleMessages(zhTWMessages, await localeLoaders[locale]());
  },
});

export const getCurrentLocaleConfig = runtime.getCurrentLocaleConfig;
export const isLocaleLoaded = runtime.isLocaleLoaded;
export const setLocaleMessages = runtime.setLocaleMessages;
export const t = runtime.t;
export const setLocale = runtime.setLocale;
export const loadLocaleMessages = runtime.loadLocaleMessages;
export const initI18n = runtime.initI18n;
export const useI18n = runtime.useI18n;

/**
 * Admin i18n Composable（為 Admin Dashboard 提供兼容性介面）
 */
export function useAdminI18n() {
  const i18n = useI18n();

  return {
    ...i18n,
    getCurrentLocaleInfo: () => i18n.localeConfig.value,
    getAvailableLocales: () => i18n.supportedLocales,
    switchLocale: async () => true,
  };
}
