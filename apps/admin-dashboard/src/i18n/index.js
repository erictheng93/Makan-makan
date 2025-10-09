/**
 * Admin Dashboard i18n Configuration
 * Uses shared MakanMakan i18n system
 */
// TODO: Fix i18n package import path
// import { createAppI18n, MessageLoader, LocaleManager, createI18nComposable, createTranslationValidator } from '@makanmakan/i18n'
// import type { AdminDashboardMessages } from '@makanmakan/i18n'
// Temporary fallback to basic vue-i18n
import { createI18n } from 'vue-i18n';
// Create basic i18n instance for admin dashboard
export const i18n = createI18n({
    legacy: false,
    locale: 'en-US',
    fallbackLocale: 'en-US',
    messages: {
        'en-US': {
            common: {
                yes: 'Yes',
                no: 'No'
            },
            backup: {
                actions: {
                    download: 'Download',
                    restore: 'Restore',
                    delete: 'Delete',
                    details: 'Details'
                },
                status: {
                    processing: 'Processing...'
                },
                details: {
                    id: 'ID',
                    configuration: 'Configuration',
                    manual: 'Manual',
                    recordsCount: 'Records Count',
                    storage: 'Storage',
                    encrypted: 'Encrypted',
                    checksum: 'Checksum',
                    tables: 'Tables',
                    performance: 'Performance'
                },
                metrics: {
                    duration: 'Duration',
                    compression: 'Compression',
                    uploadSpeed: 'Upload Speed'
                },
                types: {
                    full: 'Full',
                    incremental: 'Incremental',
                    differential: 'Differential'
                },
                create: {
                    title: 'Create Backup',
                    basicInfo: 'Basic Information',
                    name: 'Name',
                    namePlaceholder: 'Enter backup name',
                    description: 'Description',
                    descriptionPlaceholder: 'Enter backup description',
                    type: 'Type'
                }
            }
        }
    },
    globalInjection: true
});
// Temporary composable
export const useAdminI18n = () => ({
    switchLocale: async () => true,
    getCurrentLocaleInfo: () => ({ code: 'en-US', flag: '🇺🇸', nativeName: 'English' }),
    getAvailableLocales: () => [{ code: 'en-US', flag: '🇺🇸', nativeName: 'English', name: 'English' }]
});
// Export for main app usage
export default i18n;
