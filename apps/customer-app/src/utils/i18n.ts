import { i18n } from "@/i18n";

type TranslationParams = Record<string, unknown>;

type CustomerI18nGlobal = {
  t: (key: string, named?: TranslationParams) => string;
};

const globalI18n = (i18n as unknown as { global: CustomerI18nGlobal }).global;

export const translate = (key: string, named?: TranslationParams): string =>
  globalI18n.t(key, named);

/**
 * Translate on paths where a failure must not take the app down.
 *
 * The router translates inside `beforeEach`, so a throw there aborts the
 * navigation and leaves a blank page with no rendered route (#60). Cosmetic
 * copy — page titles, error-recovery messages — goes through here instead, so a
 * broken i18n runtime degrades to the fallback rather than stopping routing.
 */
export const safeTranslate = (
  key: string,
  fallback: string,
  named?: TranslationParams,
): string => {
  try {
    const translated = globalI18n.t(key, named);
    return translated && translated !== key ? translated : fallback;
  } catch (error) {
    console.error(`[i18n] translation failed for "${key}"`, error);
    return fallback;
  }
};
