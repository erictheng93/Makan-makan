# Customer-App i18n Integration with Shared Package

**Date**: 2026-03-11
**Status**: Approved
**Approach**: Method B — Integrate with shared i18n package, static loading

## Problem

The customer-app has ~65% i18n compliance. Two issues:

1. **Hardcoded strings**: ~100-120 Chinese strings in Vue components not using `t()`
2. **Isolated i18n**: Customer-app has its own i18n system, disconnected from `packages/shared/src/i18n/`

## Decision: Static Loading

All locale files are imported statically at build time. Rationale:

- 6 languages × ~10KB = ~60KB uncompressed, ~10KB gzipped — trivial
- Customer-app is a restaurant ordering PWA — instant rendering is critical
- Eliminates async complexity (loading states, cache, error retry)
- `MessageLoader` API is preserved in shared package for future use if needed

## Language Note

CLAUDE.md lists 6 languages: `zh-TW, zh-CN, en-US, ja-JP, vi-VN, id-ID`. This spec uses `en-US, zh-TW, zh-CN, vi-VN, ms-MY, id-ID` — substituting `ms-MY` (Malay) for `ja-JP` (Japanese) to align with the shared package's existing `SupportedLocale` type and the target market (Southeast Asia). Japanese support can be added as a follow-up.

## Architecture

### Shared Package Changes (`packages/shared/src/i18n/`)

#### 1. Add `vi-VN` to SupportedLocale

```typescript
// src/types.ts
export type SupportedLocale =
  | "en-US"
  | "zh-TW"
  | "zh-CN"
  | "ms-MY"
  | "id-ID"
  | "vi-VN";
```

Add `vi-VN` entry to `SUPPORTED_LOCALES` array with:

- name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳"
- dateFormat: "dd/MM/yyyy", currencyCode: "VND", currencySymbol: "₫"

#### 2. Fix `LocaleManager` issues in `src/index.ts`

- **`isValidLocale()`**: Replace hardcoded array with reference to `SUPPORTED_LOCALES` to avoid drift
- **`getStoredLocale()`**: Add `case "vi": return "vi-VN"` for Vietnamese browser detection
- **`getLocaleInfo()` / `getAvailableLocales()`**: Replace `require("./types")` with proper ESM imports

#### 3. Add `resolveJsonModule: true` to `tsconfig.json`

Required for static JSON imports in `static-messages.ts`.

#### 4. Create customer locale files for all 6 languages

File structure per locale (e.g., `src/locales/zh-TW/`):

- `common.json` — shared keys across all apps
- `customer.json` — customer-app specific keys

Key split strategy:

- **common.json**: `common`, `validation`, `time`, `messages` (generic toast/notifications)
- **customer.json**: `navigation`, `home`, `qrScan`, `menu`, `menuItem`, `customization`, `cart`, `order`, `orderTracking`, `orderHistory`, `service`, `payment`, `profile`, `restaurant`, `about`, `privacy`, `terms`, `auth`, `toast`, `errors`, `dietary`, `group`

Keys to add to existing `common.json` (shared package has fewer common keys than customer-app):

- `common.warning`, `common.info`, `common.retry`, `common.home`, `common.menu`, `common.cart`, `common.order`, `common.subtotal`, `common.quantity`, `common.price`, `common.filter`, `common.sort`, `common.clear`, `common.apply`, `common.reset`, `common.off`, `common.loadingApp`
- `validation.phone`, `validation.numeric`, `validation.positiveNumber`
- `messages.networkError`, `messages.loadError`, `messages.permissionDenied`, `messages.sessionExpired`

#### 5. New keys to add (~90-100 keys across new sections)

**`auth` section** (Login, Register, ForgotPassword, ResetPassword, VerifyEmail):

- `auth.login`, `auth.register`, `auth.forgotPassword`, `auth.resetPassword`
- `auth.username`, `auth.password`, `auth.usernamePlaceholder`, `auth.passwordPlaceholder`
- `auth.loginFailed`, `auth.registerFailed`, `auth.noAccount`, `auth.hasAccount`
- `auth.forgotPasswordLink`, `auth.sendResetLink`, `auth.resetPasswordFailed`
- `auth.verifyEmail`, `auth.verifyEmailFailed`, `auth.resendVerification`, `auth.resendFailed`
- `auth.passwordMinLength`, `auth.usernameMinLength`
- `auth.passwordStrength.weak`, `auth.passwordStrength.medium`, `auth.passwordStrength.strong`

**`toast` section** (all toast notifications):

- `toast.orderSubmitSuccess`, `toast.orderSubmitFailed`
- `toast.itemRemoved`, `toast.cartCannotBeEmpty`
- `toast.scanSuccess`, `toast.cameraInitFailed`, `toast.flashToggleFailed`
- `toast.couponApplied`, `toast.couponFailed`, `toast.couponValidationError`
- `toast.couponCodeRequired`, `toast.couponCodeTooLong`, `toast.couponCodeInvalidChars`
- `toast.deliveryAddressRequired`, `toast.invalidPhone`
- `toast.orderCancelFailed`, `toast.appLoadFailed`, `toast.unexpectedError`
- `toast.cameraNotSupported`, `toast.passwordResetSent`
- `toast.orderSent`, `toast.orderSendFailed`

**`orderTracking` section** (timeline statuses with title + description):

- 6 status entries: received, confirmed, preparing, ready, served, cancelled
- Each with `title` and `description` sub-keys
- Cancel confirmation modal text

**`orderHistory` section**:

- Status text map (7 statuses), confirm dialogs, error messages

**`dietary` section**:

- `dietary.vegetarian`, `dietary.vegan`, `dietary.halal`, `dietary.glutenFree`
- `dietary.unavailable`, `dietary.soldOut`

**`errorBoundary` section**:

- Component-level error messages and recovery actions (~12 keys)

**`cart` additions**:

- `cart.minimumOrderShortfall` — "還需加點 {amount}"
- `cart.minimumOrderNote` — "最低消費：{amount}"
- `cart.couponSaving` — "優惠券已套用！節省 {amount}"
- `cart.confirmOrderMessage` — "您即將提交總額 {amount} 的訂單，確定要繼續嗎？"

**`group` section**:

- Replace Chinese fallback defaults in GroupCartPanel and SplitBillSelector

#### 6. Add static export helper + update `package.json` exports

```typescript
// src/static-messages.ts
import enUSCommon from "./locales/en-US/common.json";
import enUSCustomer from "./locales/en-US/customer.json";
// ... all locales

export function getCustomerMessages() {
  return {
    "en-US": { ...enUSCommon, ...enUSCustomer },
    "zh-TW": { ...zhTWCommon, ...zhTWCustomer },
    "zh-CN": { ...zhCNCommon, ...zhCNCustomer },
    "vi-VN": { ...viVNCommon, ...viVNCustomer },
    "ms-MY": { ...msMYCommon, ...msMYCustomer },
    "id-ID": { ...idIDCommon, ...idIDCustomer },
  };
}
```

Update `package.json` exports:

```json
"exports": {
  ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
  "./static-messages": { "import": "./dist/static-messages.js", "types": "./dist/static-messages.d.ts" },
  "./locales/*": "./src/locales/*"
}
```

#### 7. Update `CustomerAppMessages` type

The current `CustomerAppMessages = RestaurantMessageSchema` only covers `common`, `validation`, `messages`, `restaurant`, `orders`, `kitchen`. Update to reflect the actual customer-app translation structure with all sections (navigation, home, menu, cart, order, auth, toast, etc.).

### Customer-App Changes (`apps/customer-app/`)

#### 1. Rewrite `src/i18n/index.ts`

- Import `getCustomerMessages` from shared package
- Import `LocaleManager`, `SupportedLocale` from shared package
- Use `createI18n` with static messages from `getCustomerMessages()`
- Use `LocaleManager.getStoredLocale()` for initial locale detection
- `switchLanguage()` delegates to `LocaleManager.setLocale()`
- `SUPPORTED_LANGUAGES` derived from shared `SUPPORTED_LOCALES`

#### 2. Update `src/composables/useI18n.ts`

- Import types from shared package instead of local `@/i18n`
- Keep the same API surface (`t`, `safeT`, `tWithParams`, `tPlural`, `changeLanguage`, `hasTranslation`)
- `changeLanguage` calls `LocaleManager.setLocale()` + updates i18n locale

#### 3. Update `LanguageSwitcher.vue`

- Use `SUPPORTED_LOCALES` from shared package instead of local array
- Map locale codes (e.g., `en-US` instead of `en`)

#### 4. Delete `src/i18n/locales/` directory

All translations moved to shared package.

#### 5. Fix hardcoded strings in all Vue components

**Priority 1 — High traffic views**:

- `CartView.vue` — 15+ hardcoded strings (toast, validation, coupon, confirmation modal)
- `LoginView.vue` — 12+ (labels, placeholders, validation)
- `RegisterView.vue` — 12+ (placeholders, validation, strength labels)
- `App.vue` — 5 (loading, error messages)

**Priority 2 — Feature views & components**:

- `components/ShopCartModal.vue` — 4 (toast messages)
- `views/QRScanView.vue` — 6+ (toast messages)
- `views/OrderTrackingView.vue` — 20+ (status timeline, cancel modal, status map, toasts)
- `views/OrderHistoryView.vue` — 10+ (status text map, confirm dialogs, error messages)
- `views/MenuView.vue` / `views/ShopMenuView.vue` — dynamic toast messages
- `components/ErrorBoundary.vue` — ~12 hardcoded error messages
- `components/OrderItemCard.vue` — status map with 5 strings
- `components/MenuItemModal.vue` — dietary labels, availability status
- `components/MenuItemCard.vue` — dietary labels, availability
- `components/CartItemCard.vue` — toggle text
- `components/ManualInputModal.vue` — placeholders, validation

**Priority 3 — Auth/verification views**:

- `views/ForgotPasswordView.vue` — reset link error
- `views/ResetPasswordView.vue` — ~15 strings (password strength, validation, messages)
- `views/VerifyEmailView.vue` — verification messages
- `views/HomeView.vue` — camera not supported message
- `views/OrderTypeLandingView.vue` — error message
- `views/ShopPhoneVerificationView.vue` — 3 error messages
- `views/ErrorView.vue` — fallback error message

**Priority 4 — Group order components**:

- `components/group/GroupCartPanel.vue` — replace Chinese fallback defaults
- `components/group/SplitBillSelector.vue` — replace Chinese fallback defaults

#### 6. Fix locale-dependent formatting

- `CartView.vue` line ~955: `date.toLocaleDateString("zh-TW", ...)` → use current locale

Pattern for fixes:

```
// Before
toast.error("訂單提交失敗，請重試");

// After
toast.error(t('toast.orderSubmitFailed'));
```

Console messages (console.error, console.warn) are NOT translated — they stay in original language for debugging.

## Locale Code Migration

| Customer-app (old) | Shared package (new) |
| ------------------ | -------------------- |
| `zh-TW`            | `zh-TW` (unchanged)  |
| `zh-CN`            | `zh-CN` (unchanged)  |
| `en`               | `en-US`              |
| `vi`               | `vi-VN`              |
| —                  | `ms-MY` (new)        |
| —                  | `id-ID` (new)        |

localStorage key changes from `makanmakan_language` to `makanmakan_locale`.

## Translation Strategy for New Languages

- **ms-MY** and **id-ID**: Translate from en-US as reference
- **vi-VN**: Migrate existing vi.json content, remap to new key structure

## Files Modified

### Shared package (`packages/shared/src/i18n/`)

- `src/types.ts` — add vi-VN, update CustomerAppMessages type
- `src/index.ts` — fix isValidLocale, browser detection, require→ESM
- `src/static-messages.ts` — NEW: static export helper
- `tsconfig.json` — add resolveJsonModule
- `package.json` — add static-messages export
- `src/locales/en-US/common.json` — UPDATE with new keys
- `src/locales/en-US/customer.json` — NEW
- `src/locales/zh-TW/common.json` — UPDATE with new keys
- `src/locales/zh-TW/customer.json` — NEW
- `src/locales/zh-CN/common.json` — NEW
- `src/locales/zh-CN/customer.json` — NEW
- `src/locales/vi-VN/common.json` — NEW
- `src/locales/vi-VN/customer.json` — NEW
- `src/locales/ms-MY/common.json` — NEW
- `src/locales/ms-MY/customer.json` — NEW
- `src/locales/id-ID/common.json` — NEW
- `src/locales/id-ID/customer.json` — NEW

### Customer-app (`apps/customer-app/`)

- `src/i18n/index.ts` — REWRITE
- `src/composables/useI18n.ts` — UPDATE imports
- `src/components/LanguageSwitcher.vue` — UPDATE to use shared types
- `src/i18n/locales/*.json` — DELETE (4 files)
- ~25 Vue components/views — FIX hardcoded strings

## Out of Scope

- Admin dashboard i18n integration (separate task)
- Kitchen display i18n integration (separate task)
- Japanese (`ja-JP`) language support (follow-up)
- RTL language support
- Pluralization rules beyond basic count
- Translation CI/CD validation (follow-up task)

## Risks

1. **localStorage key change**: Existing users will lose their language preference (one-time reset, acceptable)
2. **Locale code change** (`en` → `en-US`): Any URL params or API calls using old codes need checking
3. **Bundle size**: Minimal increase (~10KB gzipped for 2 new languages)

## Success Criteria

- 0 hardcoded user-visible Chinese/English strings in customer-app Vue templates and scripts
- All 6 languages render correctly with language switcher
- TypeScript compiles with 0 errors
- Existing functionality preserved (no regressions)
