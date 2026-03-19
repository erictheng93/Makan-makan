# Customer-App Ordering UI Redesign

**Date**: 2026-03-19
**Scope**: Complete ordering flow — both Table mode and Shop mode
**Nature**: Visual refresh + layout restructuring (no functional changes)
**Design System**: Apple-Native Soft Minimalism (`docs/UIUX-design-system.md`)

---

## 1. Problem Statement

The customer-app ordering interface uses `indigo-600` as the primary color, hard borders (`border border-gray-100`) on cards, non-glassmorphism navigation bars, and inconsistent button shapes (`rounded-lg` mixed with `rounded-full`). These deviate from the Apple-Native Soft Minimalism design system defined in `docs/UIUX-design-system.md`.

### Gap Analysis

| Issue          | Current                            | Required                                                |
| -------------- | ---------------------------------- | ------------------------------------------------------- |
| Primary color  | `indigo-600`                       | `#007AFF` (ios-blue)                                    |
| Card borders   | `border border-gray-100`           | No borders — shadow + bg color separation               |
| Navigation bar | `bg-white shadow-sm border-b`      | Glassmorphism `bg-white/80 backdrop-blur-xl`            |
| Shadows        | `shadow-sm`                        | `shadow-[0_4px_16px_rgb(0,0,0,0.06)]`                   |
| Button shape   | Mixed `rounded-lg` / `rounded-2xl` | All `rounded-full` (pill)                               |
| Back button    | Bare icon                          | Circular container `w-10 h-10 rounded-full bg-gray-100` |
| Search input   | `border border-gray-300`           | Borderless, gray background                             |
| Focus ring     | `ring-indigo-500`                  | `ring-ios-blue`                                         |
| Featured tag   | `indigo → purple` gradient         | Solid `ios-blue`                                        |

---

## 2. Approach

**Option C: Full Design System Compliance + Layout Restructuring**

- Systematically fix all deviations: colors, borders, shadows, buttons, nav bars, glassmorphism, typography, animations
- Restructure featured menu item cards to vertical layout (large image on top)
- Add stagger animation for list items
- Add iOS-native bottom sheet transitions
- No functional logic or data flow changes

---

## 3. Tailwind Config Updates

### 3.1 New iOS Color Tokens

```js
colors: {
  'ios-bg': '#F2F2F7',
  'ios-card': '#FFFFFF',
  'ios-text': '#1C1C1E',
  'ios-secondary': '#8E8E93',
  'ios-tertiary': '#AEAEB2',
  'ios-separator': '#E5E5EA',
  'ios-blue': '#007AFF',
  'ios-green': '#34C759',
  'ios-orange': '#FF9500',
  'ios-red': '#FF3B30',
  'ios-teal': '#30B0C7',
}
```

### 3.2 Design System Shadows

```js
boxShadow: {
  'card-sm': '0 2px 8px rgba(0, 0, 0, 0.04)',
  'card': '0 4px 16px rgba(0, 0, 0, 0.06)',
  'card-lg': '0 8px 30px rgba(0, 0, 0, 0.08)',
  'card-float': '0 12px 40px rgba(0, 0, 0, 0.1)',
}
```

### 3.3 Border Radius

```js
borderRadius: {
  'ios': '20px',
  'ios-lg': '24px',
}
```

### 3.4 Animations

```js
keyframes: {
  slideUp: {
    '0%': { transform: 'translateY(12px)', opacity: '0' },
    '100%': { transform: 'translateY(0)', opacity: '1' },
  },
  slideInBottom: {
    '0%': { transform: 'translateY(100%)' },
    '100%': { transform: 'translateY(0)' },
  },
  slideOutBottom: {
    '0%': { transform: 'translateY(0)' },
    '100%': { transform: 'translateY(100%)' },
  },
  scaleIn: {
    '0%': { transform: 'scale(0.95)', opacity: '0' },
    '100%': { transform: 'scale(1)', opacity: '1' },
  },
},
animation: {
  'slide-up': 'slideUp 300ms ease-out',
  'slide-in-bottom': 'slideInBottom 350ms cubic-bezier(0.32, 0.72, 0, 1)',
  'slide-out-bottom': 'slideOutBottom 200ms ease-in',
  'scale-in': 'scaleIn 200ms ease-out',
}
```

---

## 4. Global Replacement Rules

| Current                           | Replacement                       | Reason               |
| --------------------------------- | --------------------------------- | -------------------- |
| `bg-gray-50` (page bg)            | `bg-ios-bg`                       | Exact `#F2F2F7`      |
| `bg-indigo-600`                   | `bg-ios-blue`                     | Primary color        |
| `hover:bg-indigo-700`             | `hover:bg-ios-blue/90`            | Hover darkening      |
| `bg-indigo-50`                    | `bg-ios-blue/10`                  | Selected light bg    |
| `border-indigo-500`               | `border-ios-blue`                 | Selected border      |
| `text-indigo-600`                 | `text-ios-blue`                   | Link/accent color    |
| `ring-indigo-500`                 | `ring-ios-blue`                   | Focus ring           |
| `focus:ring-indigo-500`           | `focus:ring-ios-blue/30`          | Soft focus glow      |
| `shadow-sm` (cards)               | `shadow-card-sm` or `shadow-card` | Design system shadow |
| `shadow-lg`                       | `shadow-card-lg`                  | Floating elements    |
| `border border-gray-100` (cards)  | Remove                            | No-border principle  |
| `border-b border-gray-200` (nav)  | Remove, use glassmorphism         | No-border principle  |
| `rounded-lg` (buttons)            | `rounded-full`                    | Pill buttons         |
| `text-gray-900`                   | `text-ios-text`                   | Text color token     |
| `text-gray-600` / `text-gray-500` | `text-ios-secondary`              | Secondary text       |
| `text-gray-400`                   | `text-ios-tertiary`               | Tertiary text        |
| `border-gray-200` (separators)    | `border-ios-separator`            | Separator token      |

### Button Patterns

- **Primary CTA**: `bg-ios-blue text-white rounded-full active:scale-[0.98]`
- **Secondary**: `bg-ios-blue/10 text-ios-blue rounded-full`
- **Danger**: `bg-ios-red/10 text-ios-red rounded-full`
- **Ghost**: `bg-gray-100 text-gray-700 rounded-full`

### Input Patterns

- **Search**: `bg-gray-100 rounded-xl border-0 focus:ring-ios-blue/30 focus:bg-white`
- **Text input**: `bg-gray-100 rounded-xl border-0 px-4 py-3 focus:ring-ios-blue/30 focus:bg-white`
- **Textarea**: Same as text input + `resize-none`

---

## 5. Navigation Bar

All navigation bars across MenuView, ShopMenuView, CartView, OrderTrackingView:

```html
<nav
  class="sticky top-0 z-40 bg-white/80 backdrop-blur-xl shadow-card-sm"
></nav>
```

- Remove all `border-b border-gray-200`
- Back button: `w-10 h-10 rounded-full bg-gray-100` circular container
- Cart button: Same circular container with `bg-ios-red` badge
- Page horizontal padding: `px-5` (20px per design system 2.1)
- Category pills: `bg-ios-blue text-white` (active), `bg-gray-100 text-gray-600` (inactive)

---

## 6. Menu Browsing Page (MenuView / ShopMenuView)

### 6.1 Search Box

```html
<input
  class="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-ios-text
              placeholder:text-ios-tertiary border-0
              focus:ring-2 focus:ring-ios-blue/30 focus:bg-white
              transition-all duration-200"
/>
```

### 6.2 Section Headers

```html
<div class="sticky top-32 bg-ios-bg/95 backdrop-blur-sm py-3 z-10 -mx-5 px-5">
  <h2 class="text-xl font-semibold text-ios-text">{{ category.name }}</h2>
  <p class="text-sm text-ios-secondary mt-0.5">{{ category.description }}</p>
</div>
```

### 6.3 Page Padding

`px-4 space-y-8` → `px-5 space-y-6`

### 6.4 Floating Cart Button

```html
<button
  class="w-full bg-ios-blue text-white font-semibold py-4 px-6 rounded-full
               shadow-card-lg active:scale-[0.98] transition-all duration-200
               flex items-center justify-between"
></button>
```

### 6.5 Stagger Animation

Cards appear with 50ms stagger delay using `animate-slide-up`.

### 6.6 Loading Spinner

```html
<div
  class="animate-spin rounded-full h-12 w-12 border-2 border-ios-blue/20 border-t-ios-blue"
/>
```

### 6.7 ShopMenuView Fulfillment Badge

```html
<span
  :class="[
  'ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium',
  type === 'delivery' ? 'bg-ios-orange/15 text-ios-orange' : 'bg-ios-green/15 text-ios-green'
]"
></span>
```

---

## 7. Menu Item Card (MenuItemCard)

### 7.1 Card Shell

```html
<!-- Normal -->
<div
  class="bg-white rounded-2xl shadow-card overflow-hidden
            active:scale-[0.98] transition-all duration-200"
>
  <!-- Featured: elevated shadow -->
  <div
    class="bg-white rounded-2xl shadow-card-lg overflow-hidden
            active:scale-[0.98] transition-all duration-200"
  ></div>
</div>
```

- Remove `border border-gray-100`
- Remove `ring-2 ring-indigo-500` for featured

### 7.2 Featured Card Layout Restructure

Featured items switch to **vertical layout** (image on top):

```
┌──────────────────────────────────┐
│         ★ 推薦菜品 ★             │  ← ios-blue bg
│  ┌──────────────────────────────┐│
│  │     Large image (h-40)       ││
│  └──────────────────────────────┘│
│  Item Name                       │
│  Description (2 lines)           │
│  [Vegetarian] [Halal]            │
│  $15.00          [Add to Cart]   │
└──────────────────────────────────┘
```

Normal items keep horizontal layout (image left, info right).

### 7.3 Featured Tag

```html
<div
  class="bg-ios-blue text-white text-xs font-medium px-3 py-1 text-center"
></div>
```

### 7.4 Item Name

`text-base font-bold text-ios-text` — remove `hover:text-indigo-600`

### 7.5 Dietary Tags — Pastel Colors

```js
vegetarian: "bg-[#E8F5E9] text-[#4E7C5F]"; // Mint pastel
halal: "bg-[#E3F2FD] text-[#4A6E8C]"; // Sky pastel
glutenFree: "bg-[#FFF3E0] text-[#8D6E4C]"; // Peach pastel
vegan: "bg-[#E8F5E9] text-[#4E7C5F]"; // Mint pastel
```

### 7.6 Add to Cart Button

```html
<!-- Quick add (no customizations) -->
<button
  class="bg-ios-blue text-white px-4 py-2 rounded-full text-sm font-medium
               active:scale-95 transition-all duration-200"
>
  <!-- Select spec (has customizations) -->
  <button
    class="bg-ios-blue/10 text-ios-blue px-4 py-2 rounded-full text-sm font-medium
               active:bg-ios-blue/20 transition-all duration-200"
  ></button>
</button>
```

---

## 8. Menu Item Modal (MenuItemModal)

### 8.1 Overlay

`bg-black bg-opacity-50` → `bg-black/30`

### 8.2 Sheet Container

`rounded-t-3xl shadow-xl` → `rounded-t-[24px] shadow-card-lg`

### 8.3 Drag Handle

`w-8 h-1` → `w-10 h-1`

### 8.4 Close Button

```html
<button
  class="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full
               shadow-card-sm active:scale-95 transition-all duration-200"
></button>
```

### 8.5 Quantity Selector

Buttons: `border border-gray-300` → `bg-gray-100` (borderless)

### 8.6 Notes Textarea

`border border-gray-300 rounded-lg` → `bg-gray-100 rounded-xl border-0`

### 8.7 Bottom Action Bar

```html
<div
  class="sticky bottom-0 bg-white/95 backdrop-blur-xl p-6
            shadow-[0_-4px_16px_rgb(0,0,0,0.04)]"
>
  <button
    class="w-full bg-ios-blue text-white font-semibold py-4 px-6 rounded-full
                 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
  ></button>
</div>
```

---

## 9. Customization Modal (CustomizationModal)

### 9.1 Option Cards (radio/checkbox/add-on)

```html
<!-- Unselected -->
<label
  class="p-3.5 rounded-2xl bg-gray-50 active:bg-gray-100 transition-all duration-200"
>
  <!-- Selected -->
  <label
    class="p-3.5 rounded-2xl bg-ios-blue/10 shadow-card-sm transition-all duration-200"
  ></label
></label>
```

### 9.2 Radio Indicator

`w-4 h-4 border-indigo-500 bg-indigo-500` → `w-5 h-5 border-ios-blue bg-ios-blue`

### 9.3 Checkbox Indicator

`w-4 h-4 rounded border-indigo-500 bg-indigo-500` → `w-5 h-5 rounded-lg border-ios-blue bg-ios-blue`

### 9.4 Price Adjustments

`text-gray-900` → `text-ios-secondary` (lower visual weight)

### 9.5 Section Titles

`font-medium` → `font-semibold`, `text-red-500` → `text-ios-red`

---

## 10. Cart Page (CartView)

### 10.1 All Cards

`shadow-sm border border-gray-100` → `shadow-card` (no border)

### 10.2 CartItemCard

- Remove button: bare icon → `w-8 h-8 rounded-full bg-gray-100`
- Quantity buttons: `border border-gray-300` → `bg-gray-100`
- Notes link: `text-indigo-600` → `text-ios-blue`
- Notes textarea: `border border-gray-300` → `bg-gray-100 border-0`

### 10.3 Minimum Order Alert

`bg-green-50 border border-green-200` → `bg-ios-green/10` (no border)
`bg-yellow-50 border border-yellow-200` → `bg-ios-orange/10` (no border)

### 10.4 Coupon Section

- List items: `border border-gray-200` → `bg-gray-50` / `bg-ios-blue/10` (selected)
- Selection indicator: `bg-indigo-600` → `bg-ios-blue`
- Type badges: use pastel colors
- Apply button: `rounded-lg` → `rounded-full`
- Input: `border border-gray-300` → `bg-gray-100 border-0`
- Applied coupon: `border border-green-200` → no border, `bg-ios-green/10`

### 10.5 Customer Info Inputs

All inputs: `border border-gray-300 rounded-lg` → `bg-gray-100 rounded-xl border-0`

### 10.6 Checkout Bar

```html
<div
  class="fixed bottom-0 ... bg-white/95 backdrop-blur-xl shadow-[0_-4px_16px_rgb(0,0,0,0.04)]"
>
  <button
    class="... rounded-full bg-ios-blue active:scale-[0.98]
                 disabled:bg-gray-200 disabled:text-gray-400"
  ></button>
</div>
```

---

## 11. Order Tracking Page (OrderTrackingView)

### 11.1 Status Colors

```js
PENDING:   { bg: 'bg-ios-orange/15', text: 'text-ios-orange' }
CONFIRMED: { bg: 'bg-ios-blue/15',   text: 'text-ios-blue' }
PREPARING: { bg: 'bg-ios-orange/15', text: 'text-ios-orange' }
READY:     { bg: 'bg-ios-green/15',  text: 'text-ios-green' }
DELIVERED: { bg: 'bg-ios-green/15',  text: 'text-ios-green' }
PAID:      { bg: 'bg-ios-green/15',  text: 'text-ios-green' }
CANCELLED: { bg: 'bg-ios-red/15',    text: 'text-ios-red' }
```

### 11.2 Progress Bar

`bg-indigo-600 h-2` → `bg-ios-blue h-1.5`

### 11.3 Estimated Time Capsule

`bg-indigo-50 text-indigo-600` → `bg-ios-blue/10 text-ios-blue`

### 11.4 Action Buttons

- Cancel: `border-2 border-red-200 text-red-600` → `bg-ios-red/10 text-ios-red rounded-full`
- Continue: `bg-indigo-600 rounded-xl` → `bg-ios-blue rounded-full`

### 11.5 Connection Status

`bg-yellow-100 border border-yellow-200` → `bg-ios-orange/15 rounded-2xl shadow-card-sm`

---

## 12. Animation & Transition Summary

| Element               | Effect                   | Duration       |
| --------------------- | ------------------------ | -------------- |
| Button press          | `active:scale-[0.98]`    | 150ms          |
| Circular button press | `active:scale-95`        | 150ms          |
| Card press            | `active:scale-[0.98]`    | 200ms          |
| Category pill toggle  | Color transition         | 200ms          |
| Search focus          | `bg-gray-100 → bg-white` | 200ms          |
| Progress bar fill     | Width transition         | 600ms ease-out |
| List item appear      | `slideUp` + 50ms stagger | 300ms          |
| Bottom sheet enter    | `translateY(100% → 0)`   | 350ms spring   |
| Bottom sheet leave    | `translateY(0 → 100%)`   | 200ms ease-in  |
| Overlay enter         | `opacity(0 → 1)`         | 350ms          |
| Overlay leave         | `opacity(1 → 0)`         | 200ms          |

---

## 13. Affected Files

| File                                                      | Change Type                                                                             |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/customer-app/tailwind.config.js`                    | Add ios-\* tokens, shadows, animations                                                  |
| `apps/customer-app/src/views/MenuView.vue`                | Nav, search, section headers, floating button, loading/error                            |
| `apps/customer-app/src/views/ShopMenuView.vue`            | Same as MenuView + fulfillment badge                                                    |
| `apps/customer-app/src/views/CartView.vue`                | All card borders removed, inputs unified, buttons pill-shaped, bottom bar glassmorphism |
| `apps/customer-app/src/views/OrderTrackingView.vue`       | Status colors, progress bar, cards, action buttons, connection alert                    |
| `apps/customer-app/src/components/MenuItemCard.vue`       | Card shell, featured vertical layout, buttons, dietary tag pastels                      |
| `apps/customer-app/src/components/CartItemCard.vue`       | Border removed, quantity controls, notes area, remove button                            |
| `apps/customer-app/src/components/MenuItemModal.vue`      | Overlay, sheet, close button, quantity selector, notes, bottom bar                      |
| `apps/customer-app/src/components/CustomizationModal.vue` | Option cards borderless, radio/checkbox indicators, bottom bar                          |
| `apps/customer-app/src/components/ShopCartModal.vue`      | Same rules as CustomizationModal                                                        |

---

## 14. Design Checklist Verification

- [x] Page background is `#F2F2F7` (ios-bg)
- [x] Cards are white + large radius (≥ 20px) + soft shadow
- [x] No hard borders — shadow + background color separation
- [x] Buttons and tags use pill shape (rounded-full)
- [x] Shadows are soft enough (opacity ≤ 8%)
- [x] Text avoids pure black (uses `#1C1C1E`)
- [x] Strong title/body contrast (size + weight + color)
- [x] Sufficient whitespace between elements
- [x] Semantic colors correct (blue=primary, green=success, orange=warning, red=error)
- [x] Pastel colors maintain low saturation high brightness
- [x] Icon style unified (SF Symbols / Lucide outline style)
- [x] Appropriate motion cues (non-jarring transitions)
- [x] Overall feel resembles iOS native app
