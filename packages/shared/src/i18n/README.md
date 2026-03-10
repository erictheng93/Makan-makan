# MakanMakan i18n System

A type-safe, multi-app internationalization system designed to avoid common pitfalls and ensure actual usage across the MakanMakan platform.

## 🚨 Anti-Pattern Prevention

This system is specifically designed to avoid the **RestaurentPOS trap** where:

- ✅ i18n infrastructure exists
- ✅ Translation files are complete
- ❌ **No actual usage in components (everything hardcoded)**

## ✅ Our Solution

### 1. **Enforced Usage with ESLint**

```javascript
// ❌ This will trigger ESLint error
<template>
  <h1>Admin Dashboard</h1>  // ERROR: Hardcoded string
</template>

// ✅ Correct usage
<template>
  <h1>{{ $t('dashboard.title') }}</h1>
</template>
```

### 2. **Type-Safe Translations**

```typescript
// Auto-completion and type checking
const { t } = useI18n<AdminDashboardMessages>();
t("dashboard.title"); // ✅ Valid
t("invalid.key"); // ❌ TypeScript error
```

### 3. **Shared Resource Architecture**

```
packages/shared/src/i18n/
├── src/
│   ├── types.ts         # Type definitions
│   ├── index.ts         # Core i18n utilities
│   └── locales/
│       ├── en-US/       # English translations
│       ├── zh-TW/       # Traditional Chinese
│       ├── zh-CN/       # Simplified Chinese
│       ├── ms-MY/       # Malay
│       └── id-ID/       # Indonesian
```

## 🌍 Supported Locales

| Locale  | Language         | Region        | Currency  |
| ------- | ---------------- | ------------- | --------- |
| `en-US` | English          | United States | USD ($)   |
| `zh-TW` | 繁體中文         | Taiwan        | TWD (NT$) |
| `zh-CN` | 简体中文         | China         | CNY (¥)   |
| `ms-MY` | Bahasa Malaysia  | Malaysia      | MYR (RM)  |
| `id-ID` | Bahasa Indonesia | Indonesia     | IDR (Rp)  |

## 🛠️ Usage in Apps

### Admin Dashboard

```typescript
// apps/admin-dashboard/src/main.ts
import i18n from './i18n'
app.use(i18n)

// In components
<template>
  <h1>{{ $t('dashboard.title') }}</h1>
  <button>{{ $t('common.save') }}</button>
</template>
```

### Customer App

```typescript
// apps/customer-app/src/i18n/index.ts
import { createAppI18n } from "@makanmakan/i18n";
export const i18n = createAppI18n<CustomerAppMessages>("customer");
```

### Kitchen Display

```typescript
// apps/kitchen-display/src/i18n/index.ts
import { createAppI18n } from "@makanmakan/i18n";
export const i18n = createAppI18n<KitchenDisplayMessages>("kitchen");
```

## 🎯 Key Features

### 1. **Lazy Loading**

```typescript
// Messages are loaded dynamically based on current app and locale
const messages = await MessageLoader.loadMessages("admin", "zh-TW");
```

### 2. **Intelligent Locale Detection**

```typescript
// Browser language → localStorage → fallback
const locale = LocaleManager.getStoredLocale();
// zh-TW, zh-HK → 'zh-TW'
// zh-CN, zh → 'zh-CN'
// en-* → 'en-US'
```

### 3. **Runtime Language Switching**

```vue
<template>
  <LanguageSwitcher @locale-changed="onLocaleChange" />
</template>

<script setup>
const { switchLocale } = useAdminI18n();

const onLocaleChange = async (locale) => {
  await switchLocale(locale, "admin");
  // Messages loaded automatically
};
</script>
```

### 4. **Development Tools**

```typescript
// Translation validator (development only)
createTranslationValidator();
// Logs missing translations with stack trace
```

## 📋 ESLint Configuration

```javascript
// eslint.config.js
rules: {
  'vue/no-bare-strings-in-template': [
    'error',
    {
      allowlist: [
        /^[0-9\s\-\+\*\/\(\)\[\]]+$/,  // Numbers/symbols
        ':', '|', '•', '→',              // UI symbols
        'TODO', 'FIXME', 'DEBUG'        // Dev strings
      ]
    }
  ]
}
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Root package.json workspace dependency
"@makanmakan/i18n": "workspace:*"
```

### 2. Setup App i18n

```typescript
// apps/[app]/src/i18n/index.ts
import { createAppI18n } from "@makanmakan/i18n";
export const i18n = createAppI18n<AppMessages>("app-name");

// apps/[app]/src/main.ts
import i18n from "./i18n";
app.use(i18n);
```

### 3. Use in Components

```vue
<template>
  <div>
    <h1>{{ $t("nav.dashboard") }}</h1>
    <button>{{ $t("common.save") }}</button>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>
```

### 4. Enable ESLint Enforcement

```javascript
// Add to your eslint config
extends: ['./packages/shared/src/i18n/src/eslint-rules.js']
```

## 🔧 Adding New Languages

### 1. Update Types

```typescript
// packages/shared/src/i18n/src/types.ts
export type SupportedLocale =
  | "en-US"
  | "zh-TW"
  | "zh-CN"
  | "ms-MY"
  | "id-ID"
  | "th-TH";
```

### 2. Add Locale Info

```typescript
// packages/shared/src/i18n/src/types.ts
export const SUPPORTED_LOCALES: LocaleInfo[] = [
  // ... existing locales
  {
    code: "th-TH",
    name: "Thai",
    nativeName: "ไทย",
    flag: "🇹🇭",
    direction: "ltr",
    dateFormat: "dd/MM/yyyy",
    currencyCode: "THB",
    currencySymbol: "฿",
  },
];
```

### 3. Create Translation Files

```
packages/shared/src/i18n/src/locales/th-TH/
├── common.json
└── admin.json
```

## ⚠️ Common Pitfalls to Avoid

### 1. **Hardcoded Strings** (RestaurentPOS trap)

```vue
<!-- ❌ DON'T DO THIS -->
<template>
  <h1>Admin Dashboard</h1>
  <p>智慧餐廳管理系統</p>
</template>

<!-- ✅ DO THIS -->
<template>
  <h1>{{ $t("dashboard.title") }}</h1>
  <p>{{ $t("dashboard.subtitle") }}</p>
</template>
```

### 2. **Bypassing ESLint**

```javascript
// ❌ DON'T DISABLE THE RULES
/* eslint-disable vue/no-bare-strings-in-template */
```

### 3. **Incomplete Translations**

```typescript
// ❌ Missing translations break fallback
// Always ensure all locales have the same keys
```

## 🎯 Success Metrics

- ✅ **0 ESLint errors** for hardcoded strings
- ✅ **Type-safe** translation keys
- ✅ **Dynamic loading** for performance
- ✅ **Persistent locale** selection
- ✅ **Fallback handling** for missing translations

This system ensures that unlike RestaurentPOS, **every string in MakanMakan will actually be internationalized** from day one.
