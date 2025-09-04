import { computed, type ComputedRef } from "vue";
import { useI18n as useVueI18n } from "vue-i18n";
import {
  switchLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/i18n";

interface UseI18nReturn {
  t: (key: string) => string;
  safeT: (key: string, defaultValue?: string) => string;
  tWithParams: (key: string, params: Record<string, any>) => string;
  tPlural: (key: string, count: number, params?: Record<string, any>) => string;
  currentLanguage: ComputedRef<SupportedLanguage>;
  currentLanguageInfo: ComputedRef<
    (typeof SUPPORTED_LANGUAGES)[number] | undefined
  >;
  supportedLanguages: ComputedRef<typeof SUPPORTED_LANGUAGES>;
  changeLanguage: (language: SupportedLanguage) => void;
  hasTranslation: (key: string) => boolean;
}

/**
 * 國際化 composable
 * 提供翻譯函數和語言切換功能
 */
export function useI18n(): UseI18nReturn {
  const { t, locale, te } = useVueI18n();

  // 當前語言
  const currentLanguage = computed(() => locale.value as SupportedLanguage);

  // 當前語言資訊
  const currentLanguageInfo = computed(() =>
    SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLanguage.value),
  );

  // 支援的語言列表
  const supportedLanguages = computed(() => SUPPORTED_LANGUAGES);

  /**
   * 切換語言
   */
  const changeLanguage = (language: SupportedLanguage) => {
    switchLanguage(language);
  };

  /**
   * 檢查翻譯鍵是否存在
   */
  const hasTranslation = (key: string) => {
    return te(key);
  };

  /**
   * 安全翻譯函數 - 如果翻譯不存在，返回鍵名
   */
  const safeT = (key: string, defaultValue?: string) => {
    return hasTranslation(key) ? t(key) : defaultValue || key;
  };

  /**
   * 帶參數的翻譯函數
   */
  const tWithParams = (key: string, params: Record<string, any>) => {
    return t(key, params);
  };

  /**
   * 複數形式翻譯
   */
  const tPlural = (
    key: string,
    count: number,
    params?: Record<string, any>,
  ) => {
    return t(key, { count, ...params }, count);
  };

  return {
    // 翻譯函數
    t,
    safeT,
    tWithParams,
    tPlural,

    // 語言資訊
    currentLanguage,
    currentLanguageInfo,
    supportedLanguages,

    // 語言切換
    changeLanguage,

    // 工具函數
    hasTranslation,
  };
}
