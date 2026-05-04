import { computed, type ComputedRef } from "vue";
import { useI18n as useVueI18n } from "vue-i18n";
import {
  switchLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/i18n";
import type { LocaleInfo } from "@makanmasak/i18n";

interface UseI18nReturn {
  t: (key: string) => string;
  safeT: (key: string, defaultValue?: string) => string;
  tWithParams: (key: string, params: Record<string, any>) => string;
  tPlural: (key: string, count: number, params?: Record<string, any>) => string;
  currentLanguage: ComputedRef<SupportedLanguage>;
  currentLanguageInfo: ComputedRef<LocaleInfo | undefined>;
  supportedLanguages: ComputedRef<typeof SUPPORTED_LANGUAGES>;
  changeLanguage: (language: SupportedLanguage) => void;
  hasTranslation: (key: string) => boolean;
}

export function useI18n(): UseI18nReturn {
  const { t, locale, te } = useVueI18n();

  const currentLanguage = computed(() => locale.value as SupportedLanguage);

  const currentLanguageInfo = computed(() =>
    SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLanguage.value),
  );

  const supportedLanguages = computed(() => SUPPORTED_LANGUAGES);

  const changeLanguage = (language: SupportedLanguage) => {
    switchLanguage(language);
  };

  const hasTranslation = (key: string) => {
    return te(key);
  };

  const safeT = (key: string, defaultValue?: string) => {
    return hasTranslation(key) ? t(key) : defaultValue || key;
  };

  const tWithParams = (key: string, params: Record<string, any>) => {
    return t(key, params);
  };

  const tPlural = (
    key: string,
    count: number,
    params?: Record<string, any>,
  ) => {
    return t(key, { count, ...params }, count);
  };

  return {
    t,
    safeT,
    tWithParams,
    tPlural,
    currentLanguage,
    currentLanguageInfo,
    supportedLanguages,
    changeLanguage,
    hasTranslation,
  };
}
