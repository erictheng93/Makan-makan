/**
 * MakanMakan Shared i18n System
 * Type-safe, multi-app internationalization
 */

import { createI18n, type I18n, type I18nOptions } from 'vue-i18n'
import type {
  SupportedLocale,
  LocaleInfo,
  AdminDashboardMessages,
  CustomerAppMessages,
  KitchenDisplayMessages,
  TranslationCompletenessCheck
} from './types'

// Import locale configurations
export * from './types'
export { SUPPORTED_LOCALES } from './types'

/**
 * Locale detection and storage utilities
 */
export class LocaleManager {
  private static readonly STORAGE_KEY = 'makanmakan_locale'
  private static readonly DEFAULT_LOCALE: SupportedLocale = 'en-US'

  /**
   * Get stored locale with intelligent fallback
   */
  static getStoredLocale(): SupportedLocale {
    // Check localStorage first
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored && this.isValidLocale(stored)) {
        return stored as SupportedLocale
      }

      // Auto-detect from browser
      const browserLang = navigator.language || navigator.languages?.[0]
      if (browserLang) {
        // Exact match
        if (this.isValidLocale(browserLang)) {
          return browserLang as SupportedLocale
        }

        // Language family match
        const langCode = browserLang.split('-')[0]
        switch (langCode) {
          case 'zh':
            // Prefer Traditional Chinese in Taiwan/Hong Kong, Simplified in mainland
            return browserLang.includes('TW') || browserLang.includes('HK') ? 'zh-TW' : 'zh-CN'
          case 'ms':
            return 'ms-MY'
          case 'id':
            return 'id-ID'
          case 'en':
          default:
            return 'en-US'
        }
      }
    }

    return this.DEFAULT_LOCALE
  }

  /**
   * Set and persist locale
   */
  static setLocale(locale: SupportedLocale): void {
    if (!this.isValidLocale(locale)) {
      console.warn(`Invalid locale: ${locale}. Falling back to ${this.DEFAULT_LOCALE}`)
      locale = this.DEFAULT_LOCALE
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, locale)
      document.documentElement.lang = locale

      // Set direction for RTL languages (future-proofing)
      const localeInfo = this.getLocaleInfo(locale)
      document.documentElement.dir = localeInfo.direction
    }
  }

  /**
   * Get locale information
   */
  static getLocaleInfo(locale: SupportedLocale): LocaleInfo {
    const { SUPPORTED_LOCALES } = require('./types')
    return SUPPORTED_LOCALES.find(l => l.code === locale) || SUPPORTED_LOCALES[0]
  }

  /**
   * Check if locale is valid
   */
  static isValidLocale(locale: string): boolean {
    const validLocales: SupportedLocale[] = ['en-US', 'zh-TW', 'zh-CN', 'ms-MY', 'id-ID']
    return validLocales.includes(locale as SupportedLocale)
  }

  /**
   * Get available locales for selection UI
   */
  static getAvailableLocales(): LocaleInfo[] {
    const { SUPPORTED_LOCALES } = require('./types')
    return SUPPORTED_LOCALES
  }
}

/**
 * Dynamic message loader for lazy loading
 */
export class MessageLoader {
  private static cache = new Map<string, any>()

  /**
   * Load messages for specific app and locale
   */
  static async loadMessages(
    app: 'admin' | 'customer' | 'kitchen',
    locale: SupportedLocale
  ): Promise<any> {
    const cacheKey = `${app}-${locale}`

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const [common, specific] = await Promise.all([
        import(`./locales/${locale}/common.json`),
        import(`./locales/${locale}/${app}.json`)
      ])

      const messages = {
        ...common.default,
        ...specific.default
      }

      this.cache.set(cacheKey, messages)
      return messages
    } catch (error) {
      console.error(`Failed to load messages for ${app}-${locale}:`, error)

      // Fallback to English
      if (locale !== 'en-US') {
        return this.loadMessages(app, 'en-US')
      }

      throw error
    }
  }

  /**
   * Preload messages for better UX
   */
  static async preloadMessages(
    app: 'admin' | 'customer' | 'kitchen',
    locales: SupportedLocale[] = ['en-US', 'zh-TW']
  ): Promise<void> {
    const promises = locales.map(locale => this.loadMessages(app, locale))
    await Promise.allSettled(promises)
  }
}

/**
 * Create type-safe i18n instance for specific app
 */
export function createAppI18n<T = any>(
  app: 'admin' | 'customer' | 'kitchen',
  options: Partial<I18nOptions> = {}
): I18n<T> {
  const locale = LocaleManager.getStoredLocale()

  return createI18n<T>({
    legacy: false,
    locale,
    fallbackLocale: 'en-US',
    messages: {}, // Will be loaded dynamically
    silentTranslationWarn: false,
    silentFallbackWarn: false,
    ...options
  })
}

/**
 * Vue composable for i18n with app-specific types
 */
export function createI18nComposable(i18nInstance: I18n) {
  return {
    /**
     * Switch locale with persistence
     */
    async switchLocale(locale: SupportedLocale, app: 'admin' | 'customer' | 'kitchen') {
      try {
        // Load messages if not already loaded
        const messages = await MessageLoader.loadMessages(app, locale)

        // Update i18n instance
        i18nInstance.global.setLocaleMessage(locale, messages)
        i18nInstance.global.locale.value = locale

        // Persist the change
        LocaleManager.setLocale(locale)

        return true
      } catch (error) {
        console.error('Failed to switch locale:', error)
        return false
      }
    },

    /**
     * Get current locale info
     */
    getCurrentLocaleInfo(): LocaleInfo {
      const currentLocale = i18nInstance.global.locale.value as SupportedLocale
      return LocaleManager.getLocaleInfo(currentLocale)
    },

    /**
     * Get available locales for UI
     */
    getAvailableLocales: LocaleManager.getAvailableLocales
  }
}

/**
 * Anti-pattern prevention: Enforce i18n usage
 * This utility helps catch hardcoded strings in development
 */
export function createTranslationValidator() {
  if (process.env.NODE_ENV === 'development') {
    // In development, we can add debugging helpers
    const originalConsoleWarn = console.warn
    console.warn = (...args) => {
      const message = args.join(' ')
      if (message.includes('translation') && message.includes('not found')) {
        console.trace('Missing translation detected:', message)
      }
      originalConsoleWarn.apply(console, args)
    }
  }
}

// Default export for convenience
export default {
  LocaleManager,
  MessageLoader,
  createAppI18n,
  createI18nComposable,
  createTranslationValidator
}