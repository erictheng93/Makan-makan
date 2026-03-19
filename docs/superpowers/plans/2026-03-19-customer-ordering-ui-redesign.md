# Customer-App Ordering UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all customer-app ordering UI (16 files) to comply with the Apple-Native Soft Minimalism design system — pure visual refresh + featured card layout restructure, zero functional changes.

**Architecture:** CSS class replacements across Tailwind config, Vue views, and Vue components. One layout restructure (MenuItemCard featured → vertical). No logic, store, API, or route changes.

**Tech Stack:** Vue 3, Tailwind CSS 3.1+, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-19-customer-ordering-ui-redesign.md`

---

## File Map

| #   | File                                                        | Responsibility                               | Task   |
| --- | ----------------------------------------------------------- | -------------------------------------------- | ------ |
| 1   | `apps/customer-app/tailwind.config.js`                      | iOS design tokens, shadows, animations       | Task 1 |
| 2   | `apps/customer-app/src/components/MenuItemCard.vue`         | Menu item display + featured vertical layout | Task 2 |
| 3   | `apps/customer-app/src/views/MenuView.vue`                  | Table-mode menu browsing page                | Task 3 |
| 4   | `apps/customer-app/src/views/ShopMenuView.vue`              | Shop-mode menu browsing page                 | Task 3 |
| 5   | `apps/customer-app/src/components/MenuItemModal.vue`        | Product detail bottom sheet                  | Task 4 |
| 6   | `apps/customer-app/src/components/CustomizationModal.vue`   | Customization sheet container                | Task 4 |
| 7   | `apps/customer-app/src/components/CustomizationOptions.vue` | Size/option/add-on selection UI              | Task 4 |
| 8   | `apps/customer-app/src/components/CartItemCard.vue`         | Cart item display                            | Task 5 |
| 9   | `apps/customer-app/src/views/CartView.vue`                  | Cart/checkout page                           | Task 5 |
| 10  | `apps/customer-app/src/views/OrderTrackingView.vue`         | Order status tracking                        | Task 6 |
| 11  | `apps/customer-app/src/components/OrderItemCard.vue`        | Order item in tracking page                  | Task 6 |
| 12  | `apps/customer-app/src/components/TimelineItem.vue`         | Timeline step in tracking page               | Task 6 |
| 13  | `apps/customer-app/src/components/ShopCartModal.vue`        | Shop cart bottom sheet                       | Task 7 |
| 14  | `apps/customer-app/src/components/ConfirmationModal.vue`    | Generic confirmation dialog                  | Task 7 |
| 15  | `apps/customer-app/src/components/CouponRecommendation.vue` | Smart coupon suggestion                      | Task 7 |
| 16  | `apps/customer-app/src/views/HomeView.vue`                  | App entry/landing page                       | Task 8 |

---

## Testing Strategy

This is a pure CSS/template visual refresh — no unit tests to write. Verification for each task:

1. **TypeScript check**: `pnpm --filter customer-app typecheck` — ensures no template bindings broken
2. **Build check**: `pnpm --filter customer-app build` — ensures Tailwind compiles all new classes
3. **Visual check**: Open in browser and verify against spec Section 14 design checklist

---

### Task 1: Tailwind Config — Add iOS Design Tokens

**Files:**

- Modify: `apps/customer-app/tailwind.config.js`

**Ref:** Spec Sections 3.1–3.4

This MUST be done first. All subsequent tasks depend on these tokens existing.

- [ ] **Step 1: Add iOS color tokens**

In `apps/customer-app/tailwind.config.js`, inside `theme.extend.colors`, add after the existing `secondary` block:

```js
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
```

- [ ] **Step 2: Add design system shadows**

In `theme.extend.boxShadow`, add after the existing `soft-lg` entry:

```js
'card-sm': '0 2px 8px rgba(0, 0, 0, 0.04)',
'card': '0 4px 16px rgba(0, 0, 0, 0.06)',
'card-lg': '0 8px 30px rgba(0, 0, 0, 0.08)',
'card-float': '0 12px 40px rgba(0, 0, 0, 0.1)',
```

- [ ] **Step 3: Add border radius tokens**

In `theme.extend.borderRadius`, add after the existing `5xl` entry:

```js
'ios': '20px',
'ios-lg': '24px',
```

- [ ] **Step 4: Add new animation keyframes**

In `theme.extend.keyframes`, keep all existing keyframes and add:

```js
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
```

Also update the existing `slideUp` keyframe to use 12px (currently uses 10px):

```js
slideUp: {
  '0%': { transform: 'translateY(12px)', opacity: '0' },
  '100%': { transform: 'translateY(0)', opacity: '1' },
},
```

- [ ] **Step 5: Add new animation utilities**

In `theme.extend.animation`, update the existing `slide-up` entry and add new entries:

```js
// Update existing entry (change 0.3s to 300ms for consistency with spec):
'slide-up': 'slideUp 300ms ease-out',

// Add new entries:
'slide-in-bottom': 'slideInBottom 350ms cubic-bezier(0.32, 0.72, 0, 1)',
'slide-out-bottom': 'slideOutBottom 200ms ease-in',
'scale-in': 'scaleIn 200ms ease-out',
```

- [ ] **Step 6: Verify build**

Run: `pnpm --filter customer-app build`
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/customer-app/tailwind.config.js
git commit -m "style(customer-app): add iOS design system tokens to Tailwind config

Add ios-* color tokens, card-* shadows, ios border radius, and new
animation keyframes for Apple-Native Soft Minimalism compliance."
```

---

### Task 2: MenuItemCard — Card Shell + Featured Vertical Layout

**Files:**

- Modify: `apps/customer-app/src/components/MenuItemCard.vue`

**Ref:** Spec Section 7

This is the most complex task — includes a layout restructure for featured cards.

- [ ] **Step 1: Update card shell classes**

Replace the outer `<div>` classes. Change:

```
bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-md
```

To:

```
bg-white rounded-2xl shadow-card overflow-hidden transition-transform duration-150 active:scale-[0.98]
```

Remove the `:class` binding `{ 'ring-2 ring-indigo-500': isFeatured }`. Instead use `:class="{ 'shadow-card-lg': isFeatured }"` (featured gets elevated shadow, not a ring).

- [ ] **Step 2: Update featured tag banner**

Change the featured banner gradient:

```
bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-medium px-3 py-1 text-center
```

To:

```
bg-ios-blue text-white text-xs font-medium px-3 py-1 text-center
```

- [ ] **Step 3: Add featured vertical layout**

This is the layout restructure. Wrap the card content in a conditional template:

When `isFeatured` is true, render a vertical layout:

- Featured tag banner (already exists)
- Large image block (`h-40` instead of `w-20 h-20`)
- Info section below the image with: name, description, dietary tags, price + button row

When `isFeatured` is false, keep the existing horizontal layout (image left, info right).

Use `v-if="isFeatured"` / `v-else` to switch between the two template blocks.

- [ ] **Step 4: Update item name**

Change:

```
text-base font-semibold text-gray-900 cursor-pointer hover:text-indigo-600 transition-colors
```

To:

```
text-base font-bold text-ios-text cursor-pointer
```

- [ ] **Step 5: Update description text**

Change `text-sm text-gray-600` to `text-sm text-ios-secondary leading-relaxed`

- [ ] **Step 6: Update dietary tag colors**

In the `dietaryTags` computed, replace tag classes:

- Vegetarian/Vegan: `bg-green-100 text-green-800` → `bg-[#E8F5E9] text-[#4E7C5F]`
- Halal: `bg-blue-100 text-blue-800` → `bg-[#E3F2FD] text-[#4A6E8C]`
- Gluten-free: `bg-yellow-100 text-yellow-800` → `bg-[#FFF3E0] text-[#8D6E4C]`

- [ ] **Step 7: Update price text**

Change `text-lg font-bold text-gray-900` to `text-lg font-bold text-ios-text`

- [ ] **Step 8: Update add-to-cart button (quick add)**

Change:

```
bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors
```

To:

```
bg-ios-blue text-white px-4 py-2 rounded-full text-sm font-medium active:scale-95 transition-transform duration-150 disabled:bg-gray-200 disabled:text-gray-400
```

- [ ] **Step 9: Update customize button (select spec)**

Change:

```
bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 disabled:bg-gray-100 disabled:border-gray-300 disabled:text-gray-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors
```

To:

```
bg-ios-blue/10 text-ios-blue px-4 py-2 rounded-full text-sm font-medium active:bg-ios-blue/20 transition-all duration-200 disabled:bg-gray-100 disabled:text-ios-tertiary
```

- [ ] **Step 10: Update sold-out badge and popularity text**

Sold-out: Change `text-sm text-gray-500 bg-gray-100` to `text-xs font-medium text-ios-secondary bg-gray-100`
Popularity: Change `text-xs text-gray-500` to `text-xs text-ios-secondary`

- [ ] **Step 11: Verify build**

Run: `pnpm --filter customer-app typecheck && pnpm --filter customer-app build`
Expected: No errors.

- [ ] **Step 12: Commit**

```bash
git add apps/customer-app/src/components/MenuItemCard.vue
git commit -m "style(customer-app): redesign MenuItemCard with iOS design system

- Featured cards use vertical layout (image on top)
- Remove borders, use shadow-card separation
- Pill-shaped buttons with ios-blue
- Pastel dietary tags
- Active press feedback"
```

---

### Task 3: Menu Views — MenuView + ShopMenuView

**Files:**

- Modify: `apps/customer-app/src/views/MenuView.vue`
- Modify: `apps/customer-app/src/views/ShopMenuView.vue`

**Ref:** Spec Sections 5, 6

Both files share nearly identical structure. Apply the same changes to both.

- [ ] **Step 1: Update navigation bar (both files)**

Change the `<nav>` classes from:

```
sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200
```

To:

```
sticky top-0 z-40 bg-white/80 backdrop-blur-xl shadow-card-sm
```

- [ ] **Step 2: Remove restaurant info area border (both files)**

Change `px-4 py-3 border-b border-gray-100` to `px-5 py-3`

- [ ] **Step 3: Update back button (both files)**

Change:

```
w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors
```

To:

```
w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-ios-text active:scale-95 transition-transform duration-150
```

- [ ] **Step 4: Update restaurant name and subtitle text (both files)**

Name: `font-semibold text-gray-900` → `font-semibold text-ios-text`
Subtitle: `text-sm text-gray-500` → `text-sm text-ios-secondary`

- [ ] **Step 5: Update cart button (both files)**

Same circular container as back button. Badge: `bg-red-500` → `bg-ios-red`

- [ ] **Step 6: Update category pills (both files)**

Active: `bg-indigo-600 text-white` → `bg-ios-blue text-white shadow-card-sm`
Inactive: `bg-gray-100 text-gray-700 hover:bg-gray-200` → `bg-gray-100 text-ios-secondary active:bg-gray-200`

- [ ] **Step 7: Update search box (both files)**

Change:

```
w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors
```

To:

```
w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-ios-text placeholder:text-ios-tertiary border-0 focus:ring-2 focus:ring-ios-blue/30 focus:bg-white transition-all duration-200
```

Search icon: `text-gray-400` → `text-ios-secondary`

- [ ] **Step 8: Update section headers (both files)**

Change:

```
text-xl font-bold text-gray-900 mb-4 sticky top-32 bg-gray-50 py-2 z-10
```

To:

```html
<div
  class="sticky bg-ios-bg/95 backdrop-blur-sm py-3 z-10 -mx-5 px-5"
  :class="categories.length > 0 ? 'top-32' : 'top-16'"
></div>
```

With inner `h2`: `text-xl font-semibold text-ios-text`
Description `span`/`p`: `text-sm text-ios-secondary mt-0.5`

- [ ] **Step 9: Update page content padding (both files)**

Change `px-4 space-y-8` to `px-5 space-y-6`

- [ ] **Step 10: Update page background (both files)**

Change `min-h-screen bg-gray-50` to `min-h-screen bg-ios-bg`

- [ ] **Step 11: Update floating cart button (both files)**

Change:

```
w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg transition-colors flex items-center justify-between
```

To:

```
w-full bg-ios-blue text-white font-semibold py-4 px-6 rounded-full shadow-card-lg active:scale-[0.98] transition-transform duration-150 flex items-center justify-between
```

- [ ] **Step 12: Update loading spinner (both files)**

Change: `animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600`
To: `animate-spin rounded-full h-12 w-12 border-2 border-ios-blue/20 border-t-ios-blue`

Loading text: `text-gray-600` → `text-ios-secondary`

- [ ] **Step 13: Update error state (both files)**

Error icon container: keep `bg-red-100` → `bg-ios-red/15`, icon: `text-red-600` → `text-ios-red`
Title: `text-lg font-medium text-gray-900` → `text-lg font-medium text-ios-text`
Message: `text-gray-600` → `text-ios-secondary`
Retry button: `bg-indigo-600 text-white rounded-lg hover:bg-indigo-700` → `bg-ios-blue text-white rounded-full active:scale-[0.98] transition-transform duration-150`

- [ ] **Step 14: Update no results state (both files)**

Same text token replacements as error state.

- [ ] **Step 15: Add stagger animation to menu item grids (both files)**

On the `MenuItemCard` inside `v-for`, add:

```html
class="animate-slide-up" :style="{ animationDelay: `${index * 50}ms`,
animationFillMode: 'both' }"
```

Update the `v-for` to expose `index`: `v-for="(item, index) in ..."`

- [ ] **Step 16: ShopMenuView only — Update fulfillment badge**

Change:

```
shopCartStore.fulfillmentType === 'delivery' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
```

To:

```
shopCartStore.fulfillmentType === 'delivery' ? 'bg-ios-orange/15 text-ios-orange' : 'bg-ios-green/15 text-ios-green'
```

And change `font-semibold` to `font-medium` on the badge.

- [ ] **Step 17: Verify build**

Run: `pnpm --filter customer-app typecheck && pnpm --filter customer-app build`

- [ ] **Step 18: Commit**

```bash
git add apps/customer-app/src/views/MenuView.vue apps/customer-app/src/views/ShopMenuView.vue
git commit -m "style(customer-app): redesign menu views with glassmorphism nav and iOS tokens

- Glassmorphism navigation bar (bg-white/80 backdrop-blur-xl)
- Circular back/cart buttons
- Borderless search box with gray background
- Sticky section headers with backdrop blur
- Stagger animation on menu item cards
- All indigo → ios-blue, all text → ios-text tokens"
```

---

### Task 4: Modals — MenuItemModal + CustomizationModal + CustomizationOptions

**Files:**

- Modify: `apps/customer-app/src/components/MenuItemModal.vue`
- Modify: `apps/customer-app/src/components/CustomizationModal.vue`
- Modify: `apps/customer-app/src/components/CustomizationOptions.vue`

**Ref:** Spec Sections 8, 9

- [ ] **Step 1: MenuItemModal — Update overlay**

Change `bg-black bg-opacity-50` to `bg-black/30`

- [ ] **Step 2: MenuItemModal — Update sheet container**

Change `rounded-t-3xl shadow-xl` to `rounded-t-ios-lg shadow-card-lg`

- [ ] **Step 3: MenuItemModal — Update drag handle**

Change `w-8 h-1` to `w-10 h-1`

- [ ] **Step 4: MenuItemModal — Update close button**

Change:

```
absolute top-4 right-4 w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors
```

To:

```
absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-ios-text shadow-card-sm active:scale-95 transition-transform duration-150
```

Also update the SVG icon inside the button: remove any `text-gray-600 hover:text-gray-900` classes (the parent's `text-ios-text` will cascade to the icon).

- [ ] **Step 5: MenuItemModal — Update featured tag**

Change `bg-gradient-to-r from-indigo-600 to-purple-600` to `bg-ios-blue shadow-card-sm`

- [ ] **Step 6: MenuItemModal — Update text colors**

Title: `text-xl font-bold text-gray-900` → `text-xl font-bold text-ios-text`
Description: `text-gray-600` → `text-sm text-ios-secondary`
Price: `text-2xl font-bold text-gray-900` → `text-2xl font-bold text-ios-text`
Quantity label: `text-base font-medium text-gray-900` → `text-base font-medium text-ios-text`
Notes label: `text-sm font-medium text-gray-700` → `text-sm font-medium text-ios-text`

- [ ] **Step 7: MenuItemModal — Update dietary tags**

Same pastel colors as MenuItemCard (Step 6 of Task 2).

- [ ] **Step 8: MenuItemModal — Update quantity selector buttons**

Change:

```
w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:border-gray-400 disabled:opacity-50
```

To:

```
w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-ios-text active:bg-gray-200 transition-all duration-200 disabled:opacity-40
```

Quantity number: `text-lg font-medium text-gray-900` → `text-lg font-medium text-ios-text`

- [ ] **Step 9: MenuItemModal — Update notes textarea**

Change:

```
w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none
```

To:

```
w-full px-4 py-3 bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-ios-blue/30 focus:bg-white text-ios-text placeholder:text-ios-tertiary resize-none transition-all duration-200
```

- [ ] **Step 10: MenuItemModal — Update bottom action bar**

Container: Change `sticky bottom-0 bg-white border-t border-gray-200 p-6` to `sticky bottom-0 bg-white/95 backdrop-blur-xl p-6 shadow-[0_-4px_16px_rgb(0,0,0,0.04)]`

Button: Change `bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-2xl transition-colors` to `bg-ios-blue text-white font-semibold py-4 px-6 rounded-full active:scale-[0.98] transition-transform duration-150 disabled:bg-gray-200 disabled:text-gray-400`

- [ ] **Step 11: CustomizationModal — Update sheet and header**

Overlay: `bg-black bg-opacity-50` → `bg-black/30`
Sheet: `rounded-t-3xl shadow-xl` → `rounded-t-ios-lg shadow-card-lg`
Header: remove `border-b border-gray-200` from the header div
Drag handle: `w-8 h-1` → `w-10 h-1`
Close button: `w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600` → `w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-ios-text active:scale-95 transition-transform duration-150`
Title: `text-lg font-semibold text-gray-900` → `text-lg font-semibold text-ios-text`

- [ ] **Step 12: CustomizationModal — Update bottom bar**

Container: `sticky bottom-0 bg-white border-t border-gray-200 p-6` → `sticky bottom-0 bg-white/95 backdrop-blur-xl p-6 shadow-[0_-4px_16px_rgb(0,0,0,0.04)]`
Total label: `text-lg font-medium text-gray-900` → `text-base font-medium text-ios-secondary`
Total price: `text-xl font-bold text-gray-900` → `text-xl font-bold text-ios-text`
Button: `bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-2xl` → `bg-ios-blue text-white font-semibold py-4 px-6 rounded-full active:scale-[0.98] transition-transform duration-150 disabled:bg-gray-200 disabled:text-gray-400`

- [ ] **Step 13: CustomizationOptions — Update all option card labels**

For ALL option/size/add-on labels, change:

```
flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer transition-colors
```

To:

```
flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all duration-200
```

Selected state: `border-indigo-500 bg-indigo-50` → `bg-ios-blue/10 shadow-card-sm`
Unselected state: `hover:border-gray-300` → `bg-gray-50 active:bg-gray-100`

- [ ] **Step 14: CustomizationOptions — Update radio indicators**

Change dimensions `w-4 h-4` → `w-5 h-5`
Selected: `border-indigo-500 bg-indigo-500` → `border-ios-blue bg-ios-blue`
Add `transition-all duration-200` to the indicator div.

- [ ] **Step 15: CustomizationOptions — Update checkbox indicators**

Change dimensions `w-4 h-4 rounded` → `w-5 h-5 rounded-lg`
Selected: `border-indigo-500 bg-indigo-500` → `border-ios-blue bg-ios-blue`
Add `transition-all duration-200`.

- [ ] **Step 16: CustomizationOptions — Update text colors**

Option names: `font-medium text-gray-900` → `font-medium text-ios-text`
Option text: `text-gray-900` → `text-ios-text`
Price adjustments: `text-sm font-medium text-gray-900` → `text-sm font-medium text-ios-secondary`
Section titles: `text-base font-medium text-gray-900` → `text-base font-semibold text-ios-text`
Required indicator: `text-red-500` → `text-ios-red`
Description text: `text-sm text-gray-600` → `text-sm text-ios-secondary`

- [ ] **Step 17: Verify build**

Run: `pnpm --filter customer-app typecheck && pnpm --filter customer-app build`

- [ ] **Step 18: Commit**

```bash
git add apps/customer-app/src/components/MenuItemModal.vue apps/customer-app/src/components/CustomizationModal.vue apps/customer-app/src/components/CustomizationOptions.vue
git commit -m "style(customer-app): redesign modals with iOS bottom sheet patterns

- Overlay lightened to bg-black/30
- Sheet uses rounded-t-ios-lg token
- Glassmorphism bottom bars with upward shadow
- Borderless option cards with bg-ios-blue/10 selection
- Enlarged radio/checkbox indicators (w-5 h-5)
- All indigo → ios-blue"
```

---

### Task 5: Cart — CartItemCard + CartView

**Files:**

- Modify: `apps/customer-app/src/components/CartItemCard.vue`
- Modify: `apps/customer-app/src/views/CartView.vue`

**Ref:** Spec Sections 10, 10.2

- [ ] **Step 1: CartItemCard — Update card shell**

Change `bg-white rounded-2xl p-4 shadow-sm border border-gray-100` to `bg-white rounded-2xl p-4 shadow-card`

- [ ] **Step 2: CartItemCard — Update remove button**

Change `w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors` to `w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-ios-secondary active:bg-ios-red/10 active:text-ios-red transition-all duration-200`

- [ ] **Step 3: CartItemCard — Update text colors**

Item name: `text-base font-semibold text-gray-900` → `text-base font-semibold text-ios-text`
Customization text: `text-sm text-gray-600` → `text-sm text-ios-secondary`
Price: `text-base font-semibold text-gray-900` → `text-base font-semibold text-ios-text`
Unit price: `text-sm text-gray-500` → `text-sm text-ios-secondary`
Quantity number: `text-base font-medium text-gray-900` → `text-base font-medium text-ios-text`

- [ ] **Step 4: CartItemCard — Update quantity buttons**

Change `w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:border-gray-400 disabled:opacity-50` to `w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-ios-text active:bg-gray-200 transition-all duration-200 disabled:opacity-40`

- [ ] **Step 5: CartItemCard — Update notes**

Toggle button: `text-sm text-indigo-600 hover:text-indigo-500` → `text-sm text-ios-blue active:opacity-70 transition-opacity duration-200`
Textarea: `border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500` → `bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-ios-blue/30 focus:bg-white text-ios-text placeholder:text-ios-tertiary transition-all duration-200`

- [ ] **Step 6: CartView — Update cart item list spacing**

In `CartView.vue`, the `<div>` that wraps the `v-for` of `CartItemCard` components: ensure it uses `space-y-4` (per Spec Section 10.2). This replaces the removed card borders as the visual separator between cart items.

- [ ] **Step 7: CartView — Update page background and nav**

Page bg: `min-h-screen bg-gray-50` → `min-h-screen bg-ios-bg`
Nav: `sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200` → `sticky top-0 z-40 bg-white/80 backdrop-blur-xl shadow-card-sm`
Back button: same circular container pattern as MenuView
Title: `text-lg font-semibold text-gray-900` → `text-lg font-semibold text-ios-text`
Subtitle: `text-sm text-gray-500` → `text-sm text-ios-secondary`
Nav padding: `px-4 py-4` → `px-5 py-4`

- [ ] **Step 8: CartView — Update empty cart state**

Icon container: keep `bg-gray-100` (already compliant)
Title: `text-xl font-semibold text-gray-900` → `text-xl font-semibold text-ios-text`
Message: `text-gray-600` → `text-ios-secondary`
Button: `bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700` → `bg-ios-blue text-white font-semibold rounded-full active:scale-[0.98] transition-transform duration-150`

- [ ] **Step 9: CartView — Update all section cards**

Every card with `bg-white rounded-2xl p-6 shadow-sm border border-gray-100` → `bg-white rounded-2xl p-6 shadow-card`

This applies to: order summary, coupon section, notes section, customer info section.

- [ ] **Step 10: CartView — Update order summary details**

Text: All `text-gray-600` → `text-ios-secondary`
Total: `text-lg font-semibold text-gray-900` → `text-lg font-bold text-ios-text`
Divider: `<hr class="border-gray-200" />` → `<div class="border-t border-ios-separator" />`

- [ ] **Step 11: CartView — Update minimum order alert**

Met state: `bg-green-50 border border-green-200` → `bg-ios-green/10`, `rounded-lg` → `rounded-2xl`
Not met: `bg-yellow-50 border border-yellow-200` → `bg-ios-orange/10`, `rounded-lg` → `rounded-2xl`
Icon colors: `text-green-600` → `text-ios-green`, `text-yellow-600` → `text-ios-orange`
Text colors: `text-green-800` / `text-yellow-800` → `text-ios-green` / `text-ios-orange`

- [ ] **Step 12: CartView — Update coupon section**

"View available" link: `text-sm text-indigo-600 hover:text-indigo-700` → `text-sm text-ios-blue`
Close link: `text-sm text-gray-500 hover:text-gray-700` → `text-sm text-ios-secondary`
Loading spinner: `border-b-2 border-indigo-600` → `border-2 border-ios-blue/20 border-t-ios-blue`
Coupon card: `border border-gray-200 rounded-lg p-4 hover:bg-gray-50` → `rounded-2xl p-4 bg-gray-50 active:bg-gray-100 transition-all duration-200`
Selected coupon card: `ring-2 ring-indigo-500 bg-indigo-50` → `bg-ios-blue/10 shadow-card-sm`
Selection radio (selected): `bg-indigo-600` → `bg-ios-blue`
Selection radio (unselected): `border-2 border-gray-300` → `border-2 border-gray-300` (keep)
Coupon type badges: `bg-blue-100 text-blue-800` → `bg-[#E3F2FD] text-[#4A6E8C]`, `bg-green-100 text-green-800` → `bg-[#E8F5E9] text-[#4E7C5F]`
Discount text: `text-indigo-600` → `text-ios-blue`
Apply button: `bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700` → `bg-ios-blue text-white py-2.5 px-4 rounded-full active:scale-[0.98] transition-transform duration-150`
Manual input: `border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500` → `bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-ios-blue/30 focus:bg-white transition-all duration-200`
Manual apply button: `bg-indigo-600 text-white text-sm font-medium rounded-lg` → `bg-ios-blue text-white text-sm font-medium rounded-full active:scale-95 transition-transform duration-150 disabled:bg-gray-200 disabled:text-gray-400`
Applied coupon: `bg-green-50 border border-green-200 rounded-lg` → `bg-ios-green/10 rounded-2xl`
Applied coupon text: `text-green-800` → `text-ios-green`, `text-green-600` → `text-ios-green`
Remove coupon link: `text-green-600 hover:text-green-800` → `text-ios-green`

- [ ] **Step 13: CartView — Update customer info inputs**

Labels: `text-sm font-medium text-gray-700` → `text-sm font-medium text-ios-text`
All inputs: `border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500` → `bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-ios-blue/30 focus:bg-white text-ios-text placeholder:text-ios-tertiary transition-all duration-200`

- [ ] **Step 14: CartView — Update notes textarea**

Same input pattern as customer info.

- [ ] **Step 15: CartView — Update checkout bottom bar**

Container: `fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4` → `fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl p-4 shadow-[0_-4px_16px_rgb(0,0,0,0.04)]`

Button enabled: `bg-indigo-600 hover:bg-indigo-700 text-white` → `bg-ios-blue text-white active:scale-[0.98] transition-transform duration-150`
Button disabled: `bg-gray-400 text-white cursor-not-allowed` → `bg-gray-200 text-gray-400 cursor-not-allowed`
Button shape: `rounded-2xl` → `rounded-full`

Terms links: `text-indigo-600 hover:text-indigo-500` → `text-ios-blue`
Minimum order warning: `text-sm text-yellow-600` → `text-sm text-ios-orange`

- [ ] **Step 16: Verify build**

Run: `pnpm --filter customer-app typecheck && pnpm --filter customer-app build`

- [ ] **Step 17: Commit**

```bash
git add apps/customer-app/src/components/CartItemCard.vue apps/customer-app/src/views/CartView.vue
git commit -m "style(customer-app): redesign cart page and cart item cards

- Remove all card borders, use shadow-card
- Glassmorphism checkout bar
- Borderless inputs with gray background
- Coupon cards use bg-ios-blue/10 selection
- Minimum order alerts use ios-green/ios-orange
- Pill-shaped buttons throughout"
```

---

### Task 6: Order Tracking — OrderTrackingView + OrderItemCard + TimelineItem

**Files:**

- Modify: `apps/customer-app/src/views/OrderTrackingView.vue`
- Modify: `apps/customer-app/src/components/OrderItemCard.vue`
- Modify: `apps/customer-app/src/components/TimelineItem.vue`

**Ref:** Spec Section 11

- [ ] **Step 1: OrderTrackingView — Update page bg and nav**

Page bg: `bg-gray-50` → `bg-ios-bg`
Nav: same glassmorphism pattern. Back button: circular container. Text tokens updated.

- [ ] **Step 2: OrderTrackingView — Update status color map**

In the `getStatusColor` method, replace:

```js
0: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
1: { bg: 'bg-blue-100', text: 'text-blue-600' },
2: { bg: 'bg-orange-100', text: 'text-orange-600' },
3: { bg: 'bg-green-100', text: 'text-green-600' },
4: { bg: 'bg-green-100', text: 'text-green-600' },
5: { bg: 'bg-green-100', text: 'text-green-600' },
6: { bg: 'bg-red-100', text: 'text-red-600' },
```

With:

```js
0: { bg: 'bg-ios-orange/15', text: 'text-ios-orange' },
1: { bg: 'bg-ios-blue/15', text: 'text-ios-blue' },
2: { bg: 'bg-ios-orange/15', text: 'text-ios-orange' },
3: { bg: 'bg-ios-green/15', text: 'text-ios-green' },
4: { bg: 'bg-ios-green/15', text: 'text-ios-green' },
5: { bg: 'bg-ios-green/15', text: 'text-ios-green' },
6: { bg: 'bg-ios-red/15', text: 'text-ios-red' },
```

- [ ] **Step 3: OrderTrackingView — Update all card containers**

All `bg-white rounded-2xl p-6 shadow-sm border border-gray-100` → `bg-white rounded-2xl p-6 shadow-card`

- [ ] **Step 4: OrderTrackingView — Update progress bar**

Bar: `bg-gray-200 rounded-full h-2` → `bg-gray-200 rounded-full h-1.5`
Fill: `bg-indigo-600 h-2 rounded-full` → `bg-ios-blue h-1.5 rounded-full`

- [ ] **Step 5: OrderTrackingView — Update estimated time capsule**

Container: `bg-indigo-50 rounded-full` → `bg-ios-blue/10 rounded-full`
Icon: `text-indigo-600` → `text-ios-blue`
Text: `text-sm font-medium text-indigo-900` → `text-sm font-medium text-ios-blue`

- [ ] **Step 6: OrderTrackingView — Update text tokens**

All `text-gray-900` → `text-ios-text`, `text-gray-600` → `text-ios-secondary`, `text-gray-500` → `text-ios-secondary`
Internal separators: `border-t border-gray-100` → `border-t border-ios-separator`
Notes bg: `bg-gray-50 rounded-lg p-3` → `bg-gray-100 rounded-xl p-3.5`

- [ ] **Step 7: OrderTrackingView — Update action buttons**

Cancel: `bg-white border-2 border-red-200 text-red-600 font-semibold py-3 px-4 rounded-xl hover:bg-red-50 hover:border-red-300` → `bg-ios-red/10 text-ios-red font-semibold py-3.5 px-4 rounded-full active:bg-ios-red/20 active:scale-[0.98] transition-transform duration-150`

Continue: `bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl` → `bg-ios-blue text-white font-semibold py-3.5 px-4 rounded-full active:scale-[0.98] transition-transform duration-150`

- [ ] **Step 8: OrderTrackingView — Update connection status**

Change: `bg-yellow-100 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg` to `bg-ios-orange/15 text-ios-orange px-4 py-2.5 rounded-2xl shadow-card-sm font-medium`

Pulse dot: `bg-yellow-500` → `bg-ios-orange`

- [ ] **Step 9: OrderTrackingView — Update loading/error states**

Same pattern as MenuView (Task 3 steps 12-13).

- [ ] **Step 10: OrderItemCard — Update classes**

Apply global token replacements: any `text-gray-900` → `text-ios-text`, `text-gray-600` → `text-ios-secondary`.
Image container: `rounded-lg` → `rounded-xl`.
Any status-related colors should use ios-\* tokens.

- [ ] **Step 11: TimelineItem — Update classes**

Read `TimelineItem.vue` first and apply Section 4 global replacement rules to all Tailwind classes found:

- Any `indigo-*` or `blue-*` status colors → corresponding `ios-blue` token
- Any `green-*` status colors → `ios-green` token
- Any `text-gray-900` → `text-ios-text`, `text-gray-600` → `text-ios-secondary`
- Any `border-*` on containers → remove or replace per no-border principle

- [ ] **Step 12: Verify build**

Run: `pnpm --filter customer-app typecheck && pnpm --filter customer-app build`

- [ ] **Step 13: Commit**

```bash
git add apps/customer-app/src/views/OrderTrackingView.vue apps/customer-app/src/components/OrderItemCard.vue apps/customer-app/src/components/TimelineItem.vue
git commit -m "style(customer-app): redesign order tracking with iOS status colors

- Status colors use ios-orange/ios-blue/ios-green/ios-red tokens
- Progress bar height reduced to h-1.5 per design system
- Cards borderless with shadow-card
- Pill-shaped action buttons
- Connection status uses ios-orange"
```

---

### Task 7: Utility Components — ShopCartModal + ConfirmationModal + CouponRecommendation

**Files:**

- Modify: `apps/customer-app/src/components/ShopCartModal.vue`
- Modify: `apps/customer-app/src/components/ConfirmationModal.vue`
- Modify: `apps/customer-app/src/components/CouponRecommendation.vue`

**Ref:** Spec Section 13 (ShopCartModal — apply Section 8 overlay/sheet rules + Section 4 global rules), Spec Section 10.4 (CouponRecommendation), Spec Section 4/13 (ConfirmationModal)

- [ ] **Step 1: ShopCartModal — Update overlay and sheet**

Overlay: `bg-black bg-opacity-50` → `bg-black/30`
Sheet: `rounded-t-3xl` → `rounded-t-ios-lg`, `shadow-xl` → `shadow-card-lg`
Header border: remove `border-b border-gray-200`
Drag handle: `w-8 h-1` → `w-10 h-1` (if present)

- [ ] **Step 2: ShopCartModal — Update all indigo colors**

All `focus:ring-indigo-500 focus:border-indigo-500` → `focus:ring-ios-blue/30 border-0`
All `bg-indigo-600` → `bg-ios-blue`
Gradient `from-blue-500 to-purple-600` → `bg-ios-blue`
All `text-indigo-*` → `text-ios-blue`

- [ ] **Step 3: ShopCartModal — Update all inputs**

All inputs with `border border-gray-300 rounded-lg` → `bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-ios-blue/30 focus:bg-white transition-all duration-200`

- [ ] **Step 4: ShopCartModal — Update buttons and toggles**

All `rounded-lg` buttons → `rounded-full`
Checkout button: `rounded-xl` → `rounded-full`, add `active:scale-[0.98] transition-transform duration-150`
Toggle buttons: `rounded-lg` → `rounded-full`

- [ ] **Step 5: ShopCartModal — Update text colors and borders**

All `text-gray-900` → `text-ios-text`, `text-gray-600` → `text-ios-secondary`
Any `border border-blue-200` → remove (use `bg-ios-blue/10` instead)
Bottom bar: add `bg-white/95 backdrop-blur-xl shadow-[0_-4px_16px_rgb(0,0,0,0.04)]`

- [ ] **Step 6: ConfirmationModal — Update overlay**

`bg-black bg-opacity-50` → `bg-black/30`

- [ ] **Step 7: ConfirmationModal — Update buttons**

Primary/confirm: `bg-indigo-600 hover:bg-indigo-700 rounded-xl` → `bg-ios-blue rounded-full active:scale-[0.98] transition-transform duration-150`
Cancel: apply ghost button pattern `bg-gray-100 text-ios-text rounded-full`
For destructive confirmations: `bg-ios-red rounded-full` for the confirm button

- [ ] **Step 8: ConfirmationModal — Update container**

Sheet/card: `shadow-xl` → `shadow-card-lg`
Any text color replacements per global rules.

- [ ] **Step 9: CouponRecommendation — Update all colors**

Container: `bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200` → `bg-ios-blue/10 rounded-2xl`
Title: `text-indigo-600` → `text-ios-blue`
Badge: `bg-indigo-100 text-indigo-800` → `bg-ios-blue/15 text-ios-blue`
Discount text: `text-indigo-600` → `text-ios-blue`
Dark text: `text-indigo-800` → `text-ios-blue`
Link: `text-indigo-600 hover:text-indigo-700` → `text-ios-blue`
Card borders: `border border-indigo-100` → remove
Hover shadow: `hover:shadow-sm` → `active:shadow-card-sm`

- [ ] **Step 10: Verify build**

Run: `pnpm --filter customer-app typecheck && pnpm --filter customer-app build`

- [ ] **Step 11: Commit**

```bash
git add apps/customer-app/src/components/ShopCartModal.vue apps/customer-app/src/components/ConfirmationModal.vue apps/customer-app/src/components/CouponRecommendation.vue
git commit -m "style(customer-app): redesign shop cart, confirmation, and coupon components

- ShopCartModal: iOS bottom sheet pattern, borderless inputs
- ConfirmationModal: lighter overlay, pill buttons
- CouponRecommendation: remove gradient/borders, use ios-blue/10"
```

---

### Task 8: HomeView — Landing Page

**Files:**

- Modify: `apps/customer-app/src/views/HomeView.vue`

**Ref:** Spec Sections 4 (global rules), 5 (navigation bar) — HomeView details in Section 13 affected files table

- [ ] **Step 1: Update page background**

Change `bg-gradient-to-br from-indigo-50 via-white to-cyan-50` (or similar gradient) to `bg-ios-bg`

- [ ] **Step 2: Update navigation**

Remove any `border-b border-gray-100` or `shadow-sm` from nav.
Apply glassmorphism: `bg-white/80 backdrop-blur-xl shadow-card-sm`

- [ ] **Step 3: Update logo/branding colors**

Logo container: `bg-indigo-600` → `bg-ios-blue`
Any `text-indigo-600` → `text-ios-blue`
Any `bg-indigo-100` → `bg-ios-blue/10`

- [ ] **Step 4: Update CTA buttons**

Main QR scan button: `bg-indigo-600 hover:bg-indigo-700 rounded-2xl` → `bg-ios-blue rounded-full active:scale-[0.98] transition-transform duration-150`
Manual input button: remove `border-2 border-gray-200`, use `bg-gray-100 text-ios-text rounded-full`
Any other buttons: `rounded-xl` / `rounded-lg` → `rounded-full`
PWA install button: same pattern

- [ ] **Step 5: Update text colors**

All `text-gray-900` → `text-ios-text`
All `text-gray-600` / `text-gray-500` → `text-ios-secondary`
All `text-indigo-100` → `text-white/80`

- [ ] **Step 6: Update recent restaurant cards**

Remove any `border border-gray-200`, use `shadow-card` or `shadow-card-sm`
Button shapes: `rounded-xl` → `rounded-full`

- [ ] **Step 7: Verify build**

Run: `pnpm --filter customer-app typecheck && pnpm --filter customer-app build`

- [ ] **Step 8: Commit**

```bash
git add apps/customer-app/src/views/HomeView.vue
git commit -m "style(customer-app): redesign home page with iOS design system

- Remove gradient background, use ios-bg
- Logo uses ios-blue
- Pill-shaped CTA buttons
- Borderless cards with shadow-card"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Full build check**

Run: `pnpm --filter customer-app typecheck && pnpm --filter customer-app build`
Expected: No TypeScript errors, no build errors.

- [ ] **Step 2: Visual verification checklist**

Start the dev server: `pnpm --filter customer-app dev`

Walk through each page and verify against the Section 14 Design Checklist:

- [ ] Page background is `#F2F2F7` (ios-bg)
- [ ] Cards are white + large radius (≥ 20px) + soft shadow
- [ ] No hard borders — shadow + background color separation
- [ ] Buttons and tags use pill shape (rounded-full)
- [ ] Shadows are soft enough (opacity ≤ 8%)
- [ ] Text avoids pure black (uses `#1C1C1E`)
- [ ] Strong title/body contrast
- [ ] Sufficient whitespace between elements
- [ ] Semantic colors correct (blue=primary, green=success, orange=warning, red=error)
- [ ] Icon style unified
- [ ] Appropriate motion cues
- [ ] Overall feel resembles iOS native app

- [ ] **Step 3: Cross-check no indigo remnants**

Run grep to verify no `indigo` classes remain in customer-app:

```bash
grep -r "indigo" apps/customer-app/src/ --include="*.vue" -l
```

Expected: No matches (or only false positives in comments/strings).

- [ ] **Step 4: Commit any fixes from visual verification**

If any issues found during visual check, fix and commit.
