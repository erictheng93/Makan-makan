# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-04-13

### Added

- Full multi-language support for three previously Chinese-only apps: kitchen-display, onboarding-app, and management-portal. All user-facing strings across 32 kitchen-display components, 5 onboarding-app views, and 9 management-portal views now render through the i18n system.
- Six languages available in every frontend app: Traditional Chinese (zh-TW, complete), English (en-US, complete), plus Simplified Chinese, Vietnamese, Malay, and Indonesian stubs that gracefully fall back to zh-TW until translations land.
- LanguageSwitcher UI in each app's header/sidebar so staff can switch languages without leaving the page. Selection persists in `localStorage` across reloads.
- Kitchen-display: three new regression tests covering the `displayTableName` computed property that prevents "Table Table 4" duplication in non-zh-TW locales.

### Changed

- Kitchen-display: Single Sign-On toast notifications (new order, order cancelled, priority updated, connection status) are now translated instead of hardcoded Chinese. Previously English-mode users saw mixed-language toasts during kitchen operation.
- Kitchen-display: Header clock and date now format according to the active locale rather than always using `zh-TW`.
- All three newly-integrated apps (`kitchen-display`, `onboarding-app`, `management-portal`) now `await initI18n()` before mounting so the first paint uses the user's saved locale. Previously, returning non-Chinese users would see a Chinese flash on load before the async plugin resolved.

### Fixed

- Kitchen-display: Order cards no longer show a duplicated "Table" prefix in English mode (e.g., "Table Table 4"). The `displayTableName` computed strips `^(Table|桌)[\s-]*` before prepending the localized label.
- Kitchen-display: Connection error and offline toasts were rendering in Chinese even when the UI was set to English. Both now use `t('kitchen.kitchenOffline')` / `t('kitchen.kitchenConnectionError')`.
