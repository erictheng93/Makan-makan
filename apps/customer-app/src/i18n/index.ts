import { createI18n } from "vue-i18n";
import type { App } from "vue";

// 導入語言檔案
import zhTW from "./locales/zh-TW.json";
import zhCN from "./locales/zh-CN.json";
import en from "./locales/en.json";
import vi from "./locales/vi.json";

// 支援的語言列表
export const SUPPORTED_LANGUAGES = [
  { code: "zh-TW", name: "繁體中文", flag: "🇹🇼" },
  { code: "zh-CN", name: "简体中文", flag: "🇨🇳" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"];

// 預設語言
export const DEFAULT_LANGUAGE: SupportedLanguage = "zh-TW";

// 從 localStorage 獲取儲存的語言設定
function getStoredLanguage(): SupportedLanguage {
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("makanmakan_language");
      if (stored && SUPPORTED_LANGUAGES.some((lang) => lang.code === stored)) {
        return stored as SupportedLanguage;
      }
    }

    // 檢查瀏覽器語言設定
    if (typeof navigator !== "undefined") {
      const browserLang = navigator.language || navigator.languages?.[0];
      if (browserLang?.startsWith("zh-CN") || browserLang === "zh-Hans") {
        return "zh-CN";
      }
      if (
        browserLang?.startsWith("zh-TW") ||
        browserLang === "zh-Hant" ||
        browserLang?.startsWith("zh")
      ) {
        return "zh-TW";
      }
      if (browserLang?.startsWith("vi")) {
        return "vi";
      }
      if (browserLang?.startsWith("en")) {
        return "en";
      }
    }
  } catch (error) {
    console.warn("Unable to access localStorage or navigator:", error);
  }

  return DEFAULT_LANGUAGE;
}

// 儲存語言設定到 localStorage
export function setStoredLanguage(language: SupportedLanguage) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("makanmakan_language", language);
    }
  } catch (error) {
    console.warn("Unable to save language to localStorage:", error);
  }
}

// 創建 i18n 實例
export const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: getStoredLanguage(),
  fallbackLocale: DEFAULT_LANGUAGE,
  globalInjection: true, // 全局注入 $t 函數
  messages: {
    "zh-TW": zhTW,
    "zh-CN": zhCN,
    en: en,
    vi: vi,
  },
});

// Vue 插件安裝函數
export function setupI18n(app: App) {
  app.use(i18n);
}

// 切換語言的工具函數
export function switchLanguage(language: SupportedLanguage) {
  i18n.global.locale.value = language;
  setStoredLanguage(language);

  // 更新 HTML lang 屬性
  try {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
      // 更新頁面方向（如果需要支援 RTL 語言）
      document.documentElement.dir = "ltr"; // 目前支援的語言都是 LTR
    }
  } catch (error) {
    console.warn("Unable to update document attributes:", error);
  }
}
