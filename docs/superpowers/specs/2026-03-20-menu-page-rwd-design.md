# Menu Page RWD Design

## Overview

Implement responsive web design for the customer-app menu page (`ShopMenuView.vue` and `MenuView.vue`). Currently the menu uses a fixed `max-w-md` (448px) constraint with zero responsive breakpoints, wasting space on tablet and desktop screens.

The design follows the **Apple-Native Soft Minimalism** design system and adopts a **Menu + Cart Panel** dual-column layout for desktop, with a three-tier breakpoint strategy.

## Design Decisions

| Decision            | Choice                                        | Rationale                                                                             |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| Desktop layout      | Menu + Cart Panel (dual-column)               | Uber Eats/foodpanda-style — users see cart while browsing, reducing context-switching |
| Breakpoint strategy | Three-tier (mobile / tablet / desktop)        | Tablet users get 2-column grid improvement without cart panel complexity              |
| Cart panel behavior | Hidden when empty, slides in when items added | Avoids empty panel wasting space; 300ms ease-out animation for iOS feel               |
| Featured items      | Keep large cards, horizontal scroll           | Preserves visual hierarchy and brand prominence across all breakpoints                |

## Breakpoints

| Tier    | Width          | Container            | Grid                   | Cart                       |
| ------- | -------------- | -------------------- | ---------------------- | -------------------------- |
| Mobile  | < 768px        | `max-w-lg` (512px)   | 1 column               | Floating bottom button     |
| Tablet  | 768px – 1023px | `max-w-3xl` (768px)  | 2 columns              | Floating bottom button     |
| Desktop | >= 1024px      | `max-w-6xl` (1152px) | 2 columns + cart panel | Sticky right panel (300px) |

## Component Changes

### 1. ShopMenuView.vue / MenuView.vue (main layout)

**Current**: Single `max-w-md mx-auto` wrapper for all content.

**New structure**:

```
<div class="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
  <!-- Nav bar: full width within container -->

  <!-- Category tabs: unchanged (horizontal scroll on mobile, wrap on tablet+) -->

  <!-- Main content area -->
  <div class="lg:flex lg:gap-6 lg:items-start">
    <!-- Left: Menu content (flex: 1) -->
    <div class="flex-1 min-w-0">
      <!-- Featured section: horizontal scroll -->
      <!-- Category sections with responsive grid -->
    </div>

    <!-- Right: Desktop cart panel (lg: only, hidden when empty) -->
    <DesktopCartPanel v-if="isDesktop && cartHasItems" class="..." />
  </div>

  <!-- Mobile/Tablet: floating cart button (hidden on lg when panel visible) -->
</div>
```

**Key responsive classes**:

- Container: `max-w-lg md:max-w-3xl lg:max-w-6xl`
- Horizontal padding: `px-4 md:px-6 lg:px-8`
- Main flex layout: `lg:flex lg:gap-6 lg:items-start`
- Menu grid: `grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4`
- Category tabs: `flex gap-2 overflow-x-auto md:flex-wrap md:overflow-x-visible`
- Nav bar: responsive, remove `max-w-md` constraint

### 2. MenuItemCard.vue (no structural changes)

The card component already supports `isFeatured` prop for two layouts. No changes needed — the responsive grid in the parent handles column count. Cards will naturally fill grid cells.

### 3. New: DesktopCartPanel.vue

A new component that renders the cart as a sticky side panel for desktop. This is **not** a rewrite of the cart — it receives cart data via props so it works with both `useShopCartStore` (ShopMenuView) and `useCartStore` (MenuView).

**Props interface**:

```typescript
interface DesktopCartPanelProps {
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    options?: string;
  }>;
  totalAmount: number;
  itemCount: number;
  onCheckout: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
}
```

The parent view maps its store data to these props, keeping the component store-agnostic.

**Behavior**:

- Only rendered on `lg:` breakpoint (via `v-if` + composable or media query)
- `sticky top-20` positioning to stay visible while scrolling
- Shows: item list, quantities, subtotal, checkout button
- Slides in with `transition` (300ms ease-out) when first item is added
- Checkout button navigates to the existing cart/checkout flow

**Structure**:

```
<aside class="w-[300px] flex-shrink-0 sticky top-20">
  <div class="bg-white rounded-2xl shadow-card p-5">
    <h3>購物車</h3>
    <!-- Cart items from store -->
    <!-- Subtotal -->
    <!-- Checkout button -->
  </div>
</aside>
```

### 4. Floating Cart Button

**Current**: Fixed at bottom, constrained to `max-w-md`.

**New**:

- Mobile/Tablet: visible (`lg:hidden`), expand to `max-w-lg`
- Desktop: hidden (`hidden lg:hidden`) when cart panel is visible; shown if cart panel is hidden (empty cart edge case — but since cart is empty, button wouldn't show anyway)

### 5. Featured Items Section

**Current**: Vertical stack of large featured cards.

**New**: Horizontal scroll container across all breakpoints.

- `flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide`
- Each featured card: `min-w-[280px] md:min-w-[260px] snap-start flex-shrink-0`
- On desktop, with the wider container, ~3 cards visible at once

### 6. Nav Bar

**Current**: `sticky top-0` nav element with its own inner `max-w-md mx-auto` wrapper, sitting as a sibling to the `<main>` element (also `max-w-md mx-auto`).

**New**: The nav remains a top-level `sticky` element (important for scroll behavior), but its inner width constraint is updated to match the responsive container tokens: `max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 md:px-6 lg:px-8`. The `<main>` element uses the same tokens. This keeps nav and main visually aligned without restructuring the DOM hierarchy.

### 7. Scroll Listener Cleanup (Pre-existing Fix)

Both views add a scroll listener in `onMounted` for `updateActiveCategoryOnScroll` but never remove it. Fix during implementation by adding `removeEventListener` in `onUnmounted`.

## Viewport Detection

Use a simple composable to detect desktop breakpoint for conditional rendering:

```typescript
// composables/useBreakpoint.ts
import { ref, onMounted, onUnmounted } from "vue";

export function useIsDesktop() {
  const isDesktop = ref(
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : false,
  );

  let query: MediaQueryList | null = null;
  const update = (e: MediaQueryListEvent | MediaQueryList) => {
    isDesktop.value = e.matches;
  };

  onMounted(() => {
    query = window.matchMedia("(min-width: 1024px)");
    isDesktop.value = query.matches;
    query.addEventListener("change", update);
  });
  onUnmounted(() => {
    query?.removeEventListener("change", update);
  });

  return isDesktop;
}
```

This is used for `v-if` on the `DesktopCartPanel` to avoid rendering it on mobile (not just hiding with CSS).

## Animation

Cart panel entrance: `transition-all duration-300 ease-out` with `translate-x` from right.

Using Vue's `<Transition>` component:

```vue
<Transition name="slide-in-right">
  <DesktopCartPanel v-if="isDesktop && cartItemCount > 0" />
</Transition>
```

CSS:

```css
.slide-in-right-enter-active {
  transition: all 300ms ease-out;
}
.slide-in-right-leave-active {
  transition: all 200ms ease-in;
}
.slide-in-right-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.slide-in-right-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
```

## Files to Create/Modify

| File                              | Action | Description                                                       |
| --------------------------------- | ------ | ----------------------------------------------------------------- |
| `views/ShopMenuView.vue`          | Modify | Responsive container, flex layout, desktop cart panel integration |
| `views/MenuView.vue`              | Modify | Same responsive changes as ShopMenuView                           |
| `components/DesktopCartPanel.vue` | Create | New sticky cart side panel for desktop                            |
| `composables/useBreakpoint.ts`    | Create | Desktop breakpoint detection composable                           |

## Design System Compliance

All changes follow the Apple-Native Soft Minimalism design system:

- Background: `#F2F2F7` (`bg-ios-bg`)
- Cards: white + `rounded-2xl` + `shadow-card` (opacity <= 8%)
- Buttons/tags: pill-shaped (`rounded-full`)
- Text: `#1C1C1E` (`text-ios-text`), never pure black
- Colors: `#007AFF` primary, `#34C759` success, `#FF3B30` error
- Animations: 200-350ms, ease-out, iOS-native feel
- Separator: `#E5E5EA` (`border-ios-separator`)

## Scope Boundaries

**In scope**: Responsive layout for ShopMenuView and MenuView, new DesktopCartPanel, breakpoint composable.

**Out of scope**: MenuItemCard redesign, MenuItemModal/CustomizationModal responsive changes, CartView page redesign, search functionality changes. These can be addressed in follow-up work.

## Testing Strategy

- Visual verification at 375px, 768px, 1024px, 1440px viewpoints
- Cart panel show/hide behavior when adding/removing items
- Category tab wrapping on tablet+
- Featured items horizontal scroll
- Floating cart button visibility toggle between breakpoints
