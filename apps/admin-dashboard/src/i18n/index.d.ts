/**
 * Admin Dashboard i18n Configuration
 * Uses shared MakanMakan i18n system
 */
export declare const i18n: any;
export declare const useAdminI18n: () => {
    switchLocale: () => Promise<boolean>;
    getCurrentLocaleInfo: () => {
        code: string;
        flag: string;
        nativeName: string;
    };
    getAvailableLocales: () => {
        code: string;
        flag: string;
        nativeName: string;
        name: string;
    }[];
};
export default i18n;
