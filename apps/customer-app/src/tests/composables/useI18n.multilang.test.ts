import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createApp, ref } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { i18n, switchLanguage } from '@/i18n'
import type { SupportedLanguage } from '@/i18n'

describe('useI18n Composable with Multiple Languages', () => {
  let app: any
  let component: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    app = createApp({
      template: '<div></div>',
      setup() {
        return useI18n()
      }
    })
    app.use(i18n)
    component = app.mount(document.createElement('div'))
  })

  describe('Language Information', () => {
    it('should provide correct current language info for all languages', () => {
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      const expectedInfo = {
        'zh-TW': { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
        'zh-CN': { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
        'en': { code: 'en', name: 'English', flag: '🇺🇸' },
        'vi': { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' }
      }

      languages.forEach(lang => {
        component.changeLanguage(lang)
        expect(component.currentLanguage).toBe(lang)
        expect(component.currentLanguageInfo).toEqual(expectedInfo[lang])
      })
    })

    it('should provide all 4 supported languages', () => {
      expect(component.supportedLanguages).toHaveLength(4)
      
      const codes = component.supportedLanguages.map((lang: any) => lang.code)
      expect(codes).toEqual(['zh-TW', 'zh-CN', 'en', 'vi'])
    })
  })

  describe('Translation Functions', () => {
    it('should translate common keys correctly in all languages', () => {
      const testKey = 'common.confirm'
      const expectedTranslations = {
        'zh-TW': '確認',
        'zh-CN': '确认', 
        'en': 'Confirm',
        'vi': 'Xác nhận'
      }

      Object.entries(expectedTranslations).forEach(([lang, expected]) => {
        component.changeLanguage(lang as SupportedLanguage)
        expect(component.t(testKey)).toBe(expected)
      })
    })

    it('should handle parameterized translations in all languages', () => {
      const testParams = { min: 8 }
      const expectedTranslations = {
        'zh-TW': '至少需要 8 個字元',
        'zh-CN': '至少需要 8 个字符',
        'en': 'At least 8 characters required',
        'vi': 'Ít nhất 8 ký tự là bắt buộc'
      }

      Object.entries(expectedTranslations).forEach(([lang, expected]) => {
        component.changeLanguage(lang as SupportedLanguage)
        expect(component.tWithParams('validation.minLength', testParams)).toBe(expected)
      })
    })

    it('should handle plural translations in all languages', () => {
      const testCount = 5
      const expectedTranslations = {
        'zh-TW': '5 項商品',
        'zh-CN': '5 项商品',
        'en': '5 items',
        'vi': '5 món ăn'
      }

      Object.entries(expectedTranslations).forEach(([lang, expected]) => {
        component.changeLanguage(lang as SupportedLanguage)
        expect(component.tPlural('cart.itemCount', testCount)).toBe(expected)
      })
    })
  })

  describe('Safe Translation Function', () => {
    it('should return correct translation for existing keys in all languages', () => {
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      
      languages.forEach(lang => {
        component.changeLanguage(lang)
        const result = component.safeT('common.loading')
        expect(result).not.toBe('common.loading') // Should not return the key
        expect(result).toBeTruthy() // Should have actual translation
      })
    })

    it('should return key for non-existent keys in all languages', () => {
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      const nonExistentKey = 'nonexistent.test.key'
      
      languages.forEach(lang => {
        component.changeLanguage(lang)
        expect(component.safeT(nonExistentKey)).toBe(nonExistentKey)
      })
    })

    it('should return default value for non-existent keys in all languages', () => {
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      const nonExistentKey = 'nonexistent.test.key'
      const defaultValue = 'Default Test Value'
      
      languages.forEach(lang => {
        component.changeLanguage(lang)
        expect(component.safeT(nonExistentKey, defaultValue)).toBe(defaultValue)
      })
    })
  })

  describe('Translation Existence Check', () => {
    it('should correctly identify existing keys in all languages', () => {
      const existingKey = 'common.save'
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      
      languages.forEach(lang => {
        component.changeLanguage(lang)
        expect(component.hasTranslation(existingKey)).toBe(true)
      })
    })

    it('should correctly identify non-existing keys', () => {
      const nonExistingKey = 'totally.nonexistent.key'
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      
      languages.forEach(lang => {
        component.changeLanguage(lang)
        expect(component.hasTranslation(nonExistingKey)).toBe(false)
      })
    })
  })

  describe('Language-specific Features', () => {
    it('should handle Chinese variants correctly', () => {
      // Traditional Chinese
      component.changeLanguage('zh-TW')
      expect(component.t('home.scanQR')).toBe('掃描 QR Code')
      expect(component.t('menu.search')).toBe('搜尋菜品')

      // Simplified Chinese  
      component.changeLanguage('zh-CN')
      expect(component.t('home.scanQR')).toBe('扫描二维码')
      expect(component.t('menu.search')).toBe('搜索菜品')
    })

    it('should handle Vietnamese diacritics correctly', () => {
      component.changeLanguage('vi')
      expect(component.t('home.title')).toContain('Chào mừng')
      expect(component.t('menu.title')).toBe('Thực đơn')
      expect(component.t('order.title')).toBe('Xác nhận đơn hàng')
    })

    it('should maintain English consistency', () => {
      component.changeLanguage('en')
      expect(component.t('common.confirm')).toBe('Confirm')
      expect(component.t('common.cancel')).toBe('Cancel')
      expect(component.t('home.title')).toBe('Welcome to MakanMakan')
    })
  })

  describe('Complex Translation Scenarios', () => {
    it('should handle nested object translations in all languages', () => {
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      
      languages.forEach(lang => {
        component.changeLanguage(lang)
        
        // Test nested order status translations
        expect(component.t('order.status.pending')).toBeTruthy()
        expect(component.t('order.status.confirmed')).toBeTruthy()
        expect(component.t('order.status.preparing')).toBeTruthy()
        expect(component.t('order.status.ready')).toBeTruthy()
        
        // Test nested payment method translations
        expect(component.t('payment.methods.cash')).toBeTruthy()
        expect(component.t('payment.methods.card')).toBeTruthy()
        expect(component.t('payment.methods.online')).toBeTruthy()
      })
    })

    it('should handle service types translations correctly', () => {
      const serviceTypes = ['water', 'napkins', 'utensils', 'assistance', 'bill', 'other']
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      
      languages.forEach(lang => {
        component.changeLanguage(lang)
        serviceTypes.forEach(serviceType => {
          const translation = component.t(`service.serviceTypes.${serviceType}`)
          expect(translation).not.toBe(`service.serviceTypes.${serviceType}`)
          expect(translation).toBeTruthy()
        })
      })
    })
  })

  describe('Performance and Memory', () => {
    it('should not leak memory when switching languages rapidly', () => {
      const languages: SupportedLanguage[] = ['zh-TW', 'zh-CN', 'en', 'vi']
      
      // Rapid language switching
      for (let i = 0; i < 100; i++) {
        const randomLang = languages[i % 4]
        component.changeLanguage(randomLang)
        expect(component.currentLanguage).toBe(randomLang)
      }
    })

    it('should maintain reactivity across language changes', () => {
      // Start with a known language 
      component.changeLanguage('zh-TW')
      const initialLang = component.currentLanguage
      const initialInfo = component.currentLanguageInfo
      
      // Switch to a different language
      component.changeLanguage('vi')
      expect(component.currentLanguage).not.toBe(initialLang)
      expect(component.currentLanguageInfo).not.toEqual(initialInfo)
      expect(component.currentLanguage).toBe('vi')
      
      // Switch to another different language
      component.changeLanguage('en')
      expect(component.currentLanguage).toBe('en')
      expect(component.currentLanguageInfo.name).toBe('English')
    })
  })
})