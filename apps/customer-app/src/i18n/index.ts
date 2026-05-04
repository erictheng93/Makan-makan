import { createI18n } from "vue-i18n";
import type { App } from "vue";
import {
  LocaleManager,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  type LocaleInfo,
} from "@makanmakan/i18n";
import { getCustomerMessages } from "@makanmakan/i18n/static-messages";
import { waitingListEn } from "@/locales/en";
import { waitingListZhTw } from "@/locales/zh-TW";
import { waitingListZhCn } from "@/locales/zh-CN";
import { waitingListMsMy } from "@/locales/ms-MY";
import { waitingListIdId } from "@/locales/id-ID";
import { waitingListViVn } from "@/locales/vi-VN";

// Load all translations statically
const messages = getCustomerMessages();
messages["en-US"] = {
  ...messages["en-US"],
  ...waitingListEn,
};
messages["zh-TW"] = {
  ...messages["zh-TW"],
  ...waitingListZhTw,
};
messages["zh-CN"] = {
  ...messages["zh-CN"],
  ...waitingListZhCn,
};
messages["ms-MY"] = {
  ...messages["ms-MY"],
  ...waitingListMsMy,
};
messages["id-ID"] = {
  ...messages["id-ID"],
  ...waitingListIdId,
};
messages["vi-VN"] = {
  ...messages["vi-VN"],
  ...waitingListViVn,
};

// Supported languages for this app
export const SUPPORTED_LANGUAGES = SUPPORTED_LOCALES;

export type SupportedLanguage = SupportedLocale;

export const DEFAULT_LANGUAGE: SupportedLanguage = "zh-TW";

// Create i18n instance
export const i18n = createI18n({
  legacy: false,
  locale: LocaleManager.getStoredLocale(),
  fallbackLocale: "en-US",
  globalInjection: true,
  messages,
});

// Vue plugin install
export function setupI18n(app: App) {
  app.use(i18n);
}

// Switch language
export function switchLanguage(language: SupportedLanguage) {
  i18n.global.locale.value = language;
  LocaleManager.setLocale(language);
}

// Get current language info
export function getLanguageInfo(locale: SupportedLanguage): LocaleInfo {
  return LocaleManager.getLocaleInfo(locale);
}
