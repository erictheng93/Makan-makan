import { describe, it, expect, beforeEach } from 'vitest'
import { i18n, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, switchLanguage } from '@/i18n'
import type { SupportedLanguage } from '@/i18n'

describe('Comprehensive i18n Tests', () => {
  beforeEach(() => {
    // Reset to default state
    i18n.global.locale.value = DEFAULT_LANGUAGE
  })

  describe('Language Configuration', () => {
    it('should support 4 languages', () => {
      expect(SUPPORTED_LANGUAGES).toHaveLength(4)
      const codes = SUPPORTED_LANGUAGES.map(lang => lang.code)
      expect(codes).toEqual(['zh-TW', 'zh-CN', 'en', 'vi'])
    })

    it('should have correct language information', () => {
      expect(SUPPORTED_LANGUAGES[0]).toEqual({
        code: 'zh-TW',
        name: '繁體中文',
        flag: '🇹🇼'
      })
      
      expect(SUPPORTED_LANGUAGES[1]).toEqual({
        code: 'zh-CN',
        name: '简体中文',
        flag: '🇨🇳'
      })
      
      expect(SUPPORTED_LANGUAGES[2]).toEqual({
        code: 'en',
        name: 'English',
        flag: '🇺🇸'
      })
      
      expect(SUPPORTED_LANGUAGES[3]).toEqual({
        code: 'vi',
        name: 'Tiếng Việt',
        flag: '🇻🇳'
      })
    })

    it('should have zh-TW as default language', () => {
      expect(DEFAULT_LANGUAGE).toBe('zh-TW')
    })
  })

  describe('Language Switching', () => {
    it('should switch between all languages correctly', () => {
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      
      languages.forEach(lang => {
        switchLanguage(lang)
        expect(i18n.global.locale.value).toBe(lang)
      })
    })

    it('should persist language changes in localStorage', () => {
      const mockSetItem = global.localStorageMock.setItem
      
      switchLanguage('vi')
      expect(mockSetItem).toHaveBeenCalledWith('makanmakan_language', 'vi')
    })
  })

  describe('Translation Coverage - Common Keys', () => {
    const commonKeys = [
      'common.confirm',
      'common.cancel',
      'common.save',
      'common.loading',
      'home.title',
      'menu.title',
      'cart.title',
      'order.title'
    ]

    it('should have all common keys in Traditional Chinese', () => {
      switchLanguage('zh-TW')
      commonKeys.forEach(key => {
        const translation = i18n.global.t(key)
        expect(translation).not.toBe(key)
        expect(translation).toBeTruthy()
        expect(typeof translation).toBe('string')
      })
    })

    it('should have all common keys in Simplified Chinese', () => {
      switchLanguage('zh-CN')
      commonKeys.forEach(key => {
        const translation = i18n.global.t(key)
        expect(translation).not.toBe(key)
        expect(translation).toBeTruthy()
        expect(typeof translation).toBe('string')
      })
    })

    it('should have all common keys in English', () => {
      switchLanguage('en')
      commonKeys.forEach(key => {
        const translation = i18n.global.t(key)
        expect(translation).not.toBe(key)
        expect(translation).toBeTruthy()
        expect(typeof translation).toBe('string')
      })
    })

    it('should have all common keys in Vietnamese', () => {
      switchLanguage('vi')
      commonKeys.forEach(key => {
        const translation = i18n.global.t(key)
        expect(translation).not.toBe(key)
        expect(translation).toBeTruthy()
        expect(typeof translation).toBe('string')
      })
    })
  })

  describe('Specific Translation Validation', () => {
    it('should have correct translations for common.confirm', () => {
      switchLanguage('zh-TW')
      expect(i18n.global.t('common.confirm')).toBe('確認')

      switchLanguage('zh-CN')
      expect(i18n.global.t('common.confirm')).toBe('确认')

      switchLanguage('en')
      expect(i18n.global.t('common.confirm')).toBe('Confirm')

      switchLanguage('vi')
      expect(i18n.global.t('common.confirm')).toBe('Xác nhận')
    })

    it('should have correct translations for home.title', () => {
      switchLanguage('zh-TW')
      expect(i18n.global.t('home.title')).toBe('歡迎來到 MakanMakan')

      switchLanguage('zh-CN')
      expect(i18n.global.t('home.title')).toBe('欢迎来到 MakanMakan')

      switchLanguage('en')
      expect(i18n.global.t('home.title')).toBe('Welcome to MakanMakan')

      switchLanguage('vi')
      expect(i18n.global.t('home.title')).toBe('Chào mừng đến với MakanMakan')
    })

    it('should have correct translations for menu.addToCart', () => {
      switchLanguage('zh-TW')
      expect(i18n.global.t('menu.addToCart')).toBe('加入購物車')

      switchLanguage('zh-CN')
      expect(i18n.global.t('menu.addToCart')).toBe('加入购物车')

      switchLanguage('en')
      expect(i18n.global.t('menu.addToCart')).toBe('Add to Cart')

      switchLanguage('vi')
      expect(i18n.global.t('menu.addToCart')).toBe('Thêm vào giỏ hàng')
    })
  })

  describe('Parameterized Translations', () => {
    it('should handle parameterized translations in all languages', () => {
      // Test cart.itemCount with count parameter
      switchLanguage('zh-TW')
      expect(i18n.global.t('cart.itemCount', { count: 3 })).toBe('3 項商品')

      switchLanguage('zh-CN')
      expect(i18n.global.t('cart.itemCount', { count: 3 })).toBe('3 项商品')

      switchLanguage('en')
      expect(i18n.global.t('cart.itemCount', { count: 3 })).toBe('3 items')

      switchLanguage('vi')
      expect(i18n.global.t('cart.itemCount', { count: 3 })).toBe('3 món ăn')
    })

    it('should handle validation messages with parameters', () => {
      switchLanguage('zh-TW')
      expect(i18n.global.t('validation.minLength', { min: 6 })).toBe('至少需要 6 個字元')

      switchLanguage('zh-CN')
      expect(i18n.global.t('validation.minLength', { min: 6 })).toBe('至少需要 6 个字符')

      switchLanguage('en')
      expect(i18n.global.t('validation.minLength', { min: 6 })).toBe('At least 6 characters required')

      switchLanguage('vi')
      expect(i18n.global.t('validation.minLength', { min: 6 })).toBe('Ít nhất 6 ký tự là bắt buộc')
    })
  })

  describe('Menu and Food Related Translations', () => {
    const menuKeys = [
      'menu.categories',
      'menu.featured',
      'menu.search',
      'menu.addToCart',
      'menuItem.description',
      'menuItem.ingredients',
      'customization.size'
    ]

    it('should have all menu keys in all languages', () => {
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      
      languages.forEach(lang => {
        switchLanguage(lang)
        menuKeys.forEach(key => {
          const translation = i18n.global.t(key)
          expect(translation, `Key ${key} should exist in ${lang}`).not.toBe(key)
          expect(translation, `Key ${key} should have value in ${lang}`).toBeTruthy()
        })
      })
    })
  })

  describe('Order and Payment Translations', () => {
    const orderKeys = [
      'order.status.pending',
      'order.status.confirmed',
      'order.status.preparing',
      'order.status.ready',
      'order.placeOrder',
      'payment.methods.cash',
      'payment.methods.card',
      'payment.success',
      'payment.failed'
    ]

    it('should have all order keys in all languages', () => {
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      
      languages.forEach(lang => {
        switchLanguage(lang)
        orderKeys.forEach(key => {
          const translation = i18n.global.t(key)
          expect(translation, `Key ${key} should exist in ${lang}`).not.toBe(key)
          expect(translation, `Key ${key} should have value in ${lang}`).toBeTruthy()
        })
      })
    })
  })

  describe('Error Handling Translations', () => {
    const errorKeys = [
      'errors.general',
      'errors.network',
      'errors.notFound',
      'errors.unauthorized',
      'errors.serverError',
      'validation.required',
      'validation.email',
      'validation.phone'
    ]

    it('should have all error keys in all languages', () => {
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      
      languages.forEach(lang => {
        switchLanguage(lang)
        errorKeys.forEach(key => {
          const translation = i18n.global.t(key)
          expect(translation, `Key ${key} should exist in ${lang}`).not.toBe(key)
          expect(translation, `Key ${key} should have value in ${lang}`).toBeTruthy()
        })
      })
    })
  })

  describe('Navigation and UI Translations', () => {
    const navKeys = [
      'navigation.home',
      'navigation.menu',
      'navigation.cart',
      'navigation.orders',
      'navigation.profile',
      'common.back',
      'common.next',
      'common.close'
    ]

    it('should have all navigation keys in all languages', () => {
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      
      languages.forEach(lang => {
        switchLanguage(lang)
        navKeys.forEach(key => {
          const translation = i18n.global.t(key)
          expect(translation, `Key ${key} should exist in ${lang}`).not.toBe(key)
          expect(translation, `Key ${key} should have value in ${lang}`).toBeTruthy()
        })
      })
    })
  })

  describe('Language Consistency', () => {
    it('should have same number of translation keys in all languages', async () => {
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      const keysCounts: Record<string, number> = {}

      languages.forEach(lang => {
        switchLanguage(lang)
        const messages = i18n.global.getLocaleMessage(lang)
        const flattenKeys = (obj: any, prefix = ''): string[] => {
          let keys: string[] = []
          Object.keys(obj).forEach(key => {
            const newKey = prefix ? `${prefix}.${key}` : key
            if (typeof obj[key] === 'object' && obj[key] !== null) {
              keys = keys.concat(flattenKeys(obj[key], newKey))
            } else {
              keys.push(newKey)
            }
          })
          return keys
        }
        keysCounts[lang] = flattenKeys(messages).length
      })

      // All languages should have the same number of keys
      const counts = Object.values(keysCounts)
      const firstCount = counts[0]
      counts.forEach(count => {
        expect(count).toBe(firstCount)
      })
    })
  })

  describe('Fallback Behavior', () => {
    it('should fallback to default language for missing keys', () => {
      switchLanguage('en')
      // Test with a key that might not exist
      const result = i18n.global.t('nonexistent.test.key', 'fallback')
      expect(result).toBeDefined()
    })
  })
})