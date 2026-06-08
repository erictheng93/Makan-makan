import {
  SUPPORTED_LOCALES,
  type LocaleInfo,
  type SupportedLocale,
} from "./types";

/**
 * Locale detection and storage utilities.
 */
export class LocaleManager {
  private static readonly STORAGE_KEY = "makanmakan_locale";
  private static readonly DEFAULT_LOCALE: SupportedLocale = "en-US";

  static getStoredLocale(): SupportedLocale {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored && this.isValidLocale(stored)) {
        return stored as SupportedLocale;
      }

      const browserLang = navigator.language || navigator.languages?.[0];
      if (browserLang) {
        if (this.isValidLocale(browserLang)) {
          return browserLang as SupportedLocale;
        }

        const langCode = browserLang.split("-")[0];
        switch (langCode) {
          case "zh":
            return browserLang.includes("TW") || browserLang.includes("HK")
              ? "zh-TW"
              : "zh-CN";
          case "ms":
            return "ms-MY";
          case "id":
            return "id-ID";
          case "vi":
            return "vi-VN";
          case "en":
          default:
            return "en-US";
        }
      }
    }

    return this.DEFAULT_LOCALE;
  }

  static setLocale(locale: SupportedLocale): void {
    if (!this.isValidLocale(locale)) {
      console.warn(
        `Invalid locale: ${locale}. Falling back to ${this.DEFAULT_LOCALE}`,
      );
      locale = this.DEFAULT_LOCALE;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(this.STORAGE_KEY, locale);
      document.documentElement.lang = locale;

      const localeInfo = this.getLocaleInfo(locale);
      document.documentElement.dir = localeInfo.direction;
    }
  }

  static getLocaleInfo(locale: SupportedLocale): LocaleInfo {
    return (
      SUPPORTED_LOCALES.find((l) => l.code === locale) || SUPPORTED_LOCALES[0]
    );
  }

  static isValidLocale(locale: string): boolean {
    return SUPPORTED_LOCALES.some((l) => l.code === locale);
  }

  static getAvailableLocales(): LocaleInfo[] {
    return SUPPORTED_LOCALES;
  }
}
