import { i18n } from "@/i18n";

type TranslationParams = Record<string, unknown>;

type CustomerI18nGlobal = {
  t: (key: string, named?: TranslationParams) => string;
};

const globalI18n = (i18n as unknown as { global: CustomerI18nGlobal }).global;

export const translate = (key: string, named?: TranslationParams): string =>
  globalI18n.t(key, named);
