import { createI18n, type AppLocaleConfig } from "@makanmasak/i18n";
import type { Messages } from "./types";
import zhTWMessages from "./locales/zh-TW";

export type Locale = "zh-TW" | "zh-CN" | "en-US" | "vi-VN" | "ms-MY" | "id-ID";

export type LocaleConfig = AppLocaleConfig<Locale>;
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

// zh-TW is bundled eagerly (static import above); other locales stay lazy.
// Explicit loaders keep zh-TW out of the dynamic-import graph, avoiding the
// Rollup "dynamically imported but also statically imported" warning.
const lazyLocaleLoaders: Record<
  Exclude<Locale, "zh-TW">,
  () => Promise<{ default: Messages }>
> = {
  "zh-CN": () => import("./locales/zh-CN"),
  "en-US": () => import("./locales/en-US"),
  "vi-VN": () => import("./locales/vi-VN"),
  "ms-MY": () => import("./locales/ms-MY"),
  "id-ID": () => import("./locales/id-ID"),
};

const runtime = createI18n<Locale, Messages>({
  defaultLocale: "zh-TW",
  fallbackLocale: "zh-TW",
  supportedLocales: SUPPORTED_LOCALES,
  initialMessages: { "zh-TW": zhTWMessages },
  loadMessages: async (locale) =>
    locale === "zh-TW"
      ? zhTWMessages
      : (await lazyLocaleLoaders[locale]()).default,
});

export const getCurrentLocaleConfig = runtime.getCurrentLocaleConfig;
export const isLocaleLoaded = runtime.isLocaleLoaded;
export const setLocaleMessages = runtime.setLocaleMessages;
export const t = runtime.t;
export const setLocale = runtime.setLocale;
export const loadLocaleMessages = runtime.loadLocaleMessages;
export const initI18n = runtime.initI18n;
export const useI18n = runtime.useI18n;
