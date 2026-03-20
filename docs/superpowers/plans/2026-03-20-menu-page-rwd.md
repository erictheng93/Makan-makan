# Menu Page RWD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three-tier responsive layout (mobile/tablet/desktop) to the customer-app menu pages with a desktop cart side panel.

**Architecture:** Both `ShopMenuView.vue` and `MenuView.vue` share nearly identical templates. The responsive changes widen the container (`max-w-md` → responsive tokens), add a 2-column menu grid at `md:`, and introduce a sticky `DesktopCartPanel` at `lg:`. A `useIsDesktop` composable handles breakpoint detection. The panel receives cart data via props to work with both cart stores.

**Tech Stack:** Vue 3, Tailwind CSS, Pinia stores, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-20-menu-page-rwd-design.md`

---

## File Structure

| File                                                    | Action | Purpose                                                   |
| ------------------------------------------------------- | ------ | --------------------------------------------------------- |
| `apps/customer-app/src/composables/useBreakpoint.ts`    | Create | `useIsDesktop()` composable using `matchMedia`            |
| `apps/customer-app/src/components/DesktopCartPanel.vue` | Create | Sticky cart side panel for desktop, props-based           |
| `apps/customer-app/src/views/ShopMenuView.vue`          | Modify | Responsive container, flex layout, cart panel integration |
| `apps/customer-app/src/views/MenuView.vue`              | Modify | Same responsive changes as ShopMenuView                   |

---

### Task 1: Create `useIsDesktop` Composable

**Files:**

- Create: `apps/customer-app/src/composables/useBreakpoint.ts`

- [ ] **Step 1: Create the composable**

```typescript
// apps/customer-app/src/composables/useBreakpoint.ts
import { ref, onMounted, onUnmounted } from "vue";

export function useIsDesktop() {
  const isDesktop = ref(
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : false,
  );

  let query: MediaQueryList | null = null;

  const update = (e: MediaQueryListEvent) => {
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

- [ ] **Step 2: Verify typecheck passes**

Run: `cd apps/customer-app && npx vue-tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors related to `useBreakpoint.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/customer-app/src/composables/useBreakpoint.ts
git commit -m "feat(customer-app): add useIsDesktop breakpoint composable"
```

---

### Task 2: Create `DesktopCartPanel` Component

**Files:**

- Create: `apps/customer-app/src/components/DesktopCartPanel.vue`
- Reference: `apps/customer-app/src/stores/shopCart.ts` (for CartItem type shape)

The component receives cart data via props so it works with both `useShopCartStore` (shop mode) and `useCartStore` (table mode).

- [ ] **Step 1: Create the component**

```vue
<!-- apps/customer-app/src/components/DesktopCartPanel.vue -->
<template>
  <aside class="w-[300px] flex-shrink-0">
    <div class="sticky top-24">
      <div class="bg-white rounded-2xl shadow-card p-5">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-ios-text">
            {{ t("shopMenu.viewCart") }}
          </h3>
          <span
            class="w-6 h-6 bg-ios-blue text-white text-xs rounded-full flex items-center justify-center font-bold"
          >
            {{ itemCount }}
          </span>
        </div>

        <!-- Cart items -->
        <div class="divide-y divide-ios-separator">
          <div v-for="item in items" :key="item.id" class="py-3 first:pt-0">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-ios-text truncate">
                  {{ item.menuItem.name }}
                </p>
                <p
                  v-if="item.customizations"
                  class="text-xs text-ios-secondary mt-0.5 truncate"
                >
                  {{ formatCustomizations(item.customizations) }}
                </p>
              </div>
              <button
                class="text-ios-secondary hover:text-ios-red transition-colors p-1 -mr-1"
                @click="$emit('remove-item', item.id)"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div class="flex items-center justify-between mt-2">
              <!-- Quantity controls -->
              <div class="flex items-center gap-2">
                <button
                  class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-ios-text active:scale-95 transition-transform text-sm"
                  @click="$emit('update-quantity', item.id, item.quantity - 1)"
                >
                  −
                </button>
                <span class="text-sm font-medium text-ios-text w-5 text-center">
                  {{ item.quantity }}
                </span>
                <button
                  class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-ios-text active:scale-95 transition-transform text-sm"
                  @click="$emit('update-quantity', item.id, item.quantity + 1)"
                >
                  +
                </button>
              </div>
              <span class="text-sm font-semibold text-ios-text">
                ${{ formatPrice(item.totalPrice) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Subtotal + Checkout -->
        <div class="mt-4 pt-4 border-t border-ios-separator">
          <div class="flex items-center justify-between mb-4">
            <span class="text-sm font-medium text-ios-secondary">
              {{ t("shopCart.subtotal") }}
            </span>
            <span class="text-lg font-bold text-ios-blue">
              ${{ formatPrice(subtotal) }}
            </span>
          </div>
          <button
            class="w-full py-3 bg-ios-blue text-white font-semibold rounded-full active:scale-[0.98] transition-transform duration-150 shadow-card-sm"
            @click="$emit('checkout')"
          >
            {{ t("shopCart.checkout") }}
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useI18n } from "@/composables/useI18n";
import { formatPrice } from "@/utils/format";
import type {
  CartItem,
  SelectedCustomizations,
} from "@makanmakan/shared-types";

defineProps<{
  items: CartItem[];
  itemCount: number;
  subtotal: number;
}>();

defineEmits<{
  checkout: [];
  "remove-item": [id: string];
  "update-quantity": [id: string, quantity: number];
}>();

const { t } = useI18n();

const formatCustomizations = (customizations?: SelectedCustomizations) => {
  if (!customizations) return "";
  const parts: string[] = [];
  if (customizations.size) parts.push(customizations.size.name);
  if (customizations.options?.length) {
    parts.push(...customizations.options.map((o) => o.choiceName));
  }
  if (customizations.addOns?.length) {
    parts.push(...customizations.addOns.map((a) => a.name));
  }
  return parts.join(", ");
};
</script>
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd apps/customer-app && npx vue-tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors related to `DesktopCartPanel.vue`

- [ ] **Step 3: Commit**

```bash
git add apps/customer-app/src/components/DesktopCartPanel.vue
git commit -m "feat(customer-app): add DesktopCartPanel component for desktop menu RWD"
```

---

### Task 3: Make ShopMenuView Responsive

**Files:**

- Modify: `apps/customer-app/src/views/ShopMenuView.vue`

This is the largest task. Changes:

1. Nav inner container: `max-w-md` → `max-w-lg md:max-w-3xl lg:max-w-6xl` + responsive padding
2. Main container: same responsive width tokens
3. Category tabs: `md:flex-wrap md:overflow-x-visible`
4. Featured items: horizontal scroll (`flex overflow-x-auto`) instead of vertical `grid`
5. Menu item grid: `grid-cols-1 md:grid-cols-2`
6. Wrap menu content + DesktopCartPanel in `lg:flex`
7. Floating cart button: add `lg:hidden`
8. Fix scroll listener leak: add `onUnmounted` cleanup
9. Import and use `useIsDesktop` composable

- [ ] **Step 1: Add imports**

In `<script setup>`, add these imports after existing ones (line ~321):

```typescript
import { ref, computed, onMounted, onUnmounted, watch } from "vue"; // add onUnmounted
import DesktopCartPanel from "@/components/DesktopCartPanel.vue";
import { useIsDesktop } from "@/composables/useBreakpoint";
```

And add composable usage after the store declarations (after line ~350):

```typescript
const isDesktop = useIsDesktop();
```

- [ ] **Step 2: Fix scroll listener leak**

In the second `onMounted` block (line ~499-506), the scroll listener is added but never cleaned up. Add cleanup:

```typescript
onUnmounted(() => {
  window.removeEventListener("scroll", updateActiveCategoryOnScroll);
});
```

- [ ] **Step 3: Update nav container width**

Change line 5 from:

```html
<div class="max-w-md mx-auto"></div>
```

to:

```html
<div
  class="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 md:px-6 lg:px-8"
></div>
```

- [ ] **Step 4: Update category tabs for responsive wrapping**

Change line 84 from:

```html
<div class="flex space-x-2 overflow-x-auto scrollbar-hide"></div>
```

to:

```html
<div
  class="flex space-x-2 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-x-visible md:gap-2 md:space-x-0"
></div>
```

- [ ] **Step 5: Update main container**

Change line 104 from:

```html
<main class="max-w-md mx-auto pb-20"></main>
```

to:

```html
<main
  class="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto pb-20 px-4 md:px-6 lg:px-8"
></main>
```

- [ ] **Step 6: Wrap menu content in flex layout for desktop**

After the `<div v-else-if="menuStructure" class="px-5 space-y-6">` (line 147), wrap the entire menu content block and add the cart panel. The structure becomes:

Change:

```html
<div v-else-if="menuStructure" class="px-5 space-y-6">
  <!-- search, featured, categories... all existing content -->
</div>
```

to:

```html
<div v-else-if="menuStructure" class="lg:flex lg:gap-6 lg:items-start">
  <!-- Left: Menu content -->
  <div class="flex-1 min-w-0 px-5 space-y-6">
    <!-- search, featured, categories... all existing content (unchanged) -->
  </div>

  <!-- Right: Desktop cart panel -->
  <Transition name="slide-in-right">
    <DesktopCartPanel
      v-if="isDesktop && shopCartStore.itemCount > 0"
      :items="shopCartStore.items"
      :item-count="shopCartStore.itemCount"
      :subtotal="shopCartStore.subtotal"
      @checkout="showCart = true"
      @remove-item="shopCartStore.removeItem($event)"
      @update-quantity="(id, qty) => shopCartStore.updateQuantity(id, qty)"
    />
  </Transition>
</div>
```

- [ ] **Step 7: Convert featured items to horizontal scroll**

Change line 176 from:

```html
<div class="grid gap-4"></div>
```

to:

```html
<div
  class="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-5 px-5"
></div>
```

And add to each `MenuItemCard` in the featured section (line ~177-190), add width classes:

```html
<MenuItemCard
  ...existing
  props...
  class="animate-slide-up min-w-[280px] md:min-w-[260px] snap-start flex-shrink-0"
  ...
/>
```

- [ ] **Step 8: Make category menu grid responsive**

Change line 215 from:

```html
<div class="grid gap-4"></div>
```

to:

```html
<div class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4"></div>
```

- [ ] **Step 9: Update floating cart button**

Change line 271-272 from:

```html
<div
  v-if="shopCartStore.itemCount > 0"
  class="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto"
></div>
```

to:

```html
<div
  v-if="shopCartStore.itemCount > 0"
  class="fixed bottom-4 left-4 right-4 z-50 max-w-lg mx-auto lg:hidden"
></div>
```

- [ ] **Step 10: Add transition CSS**

In the `<style scoped>` section (line ~516), add:

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

- [ ] **Step 11: Verify typecheck**

Run: `cd apps/customer-app && npx vue-tsc --noEmit --pretty 2>&1 | tail -10`
Expected: No new errors

- [ ] **Step 12: Visual verification at 375px**

Open `http://localhost:3000/restaurant/019469a0-0001-7000-8000-000000000001/shop/menu?fulfillmentType=dine-in` and emulate 375px mobile viewport. Verify: single-column layout, featured items horizontal scroll, floating cart button visible.

- [ ] **Step 13: Visual verification at 768px**

Emulate 768px tablet viewport. Verify: 2-column menu grid, category tabs wrapping, floating cart button visible, no cart panel.

- [ ] **Step 14: Visual verification at 1440px**

Emulate 1440px desktop viewport. Verify: 2-column menu grid, cart panel appears when items are added, floating cart button hidden, panel slides in with animation.

- [ ] **Step 15: Commit**

```bash
git add apps/customer-app/src/views/ShopMenuView.vue
git commit -m "feat(customer-app): make ShopMenuView responsive with desktop cart panel"
```

---

### Task 4: Make MenuView Responsive

**Files:**

- Modify: `apps/customer-app/src/views/MenuView.vue`

Apply the same responsive changes as ShopMenuView. The differences are:

- Uses `useCartStore` instead of `useShopCartStore`
- Cart button navigates to cart page instead of opening modal
- No `ShopCartModal`

- [ ] **Step 1: Add imports**

```typescript
import { ref, computed, onMounted, onUnmounted, watch } from "vue"; // add onUnmounted
import DesktopCartPanel from "@/components/DesktopCartPanel.vue";
import { useIsDesktop } from "@/composables/useBreakpoint";
```

And after store declarations:

```typescript
const isDesktop = useIsDesktop();
```

- [ ] **Step 2: Fix scroll listener leak**

After the `onMounted` at line 473, add:

```typescript
onUnmounted(() => {
  window.removeEventListener("scroll", updateActiveCategoryOnScroll);
});
```

- [ ] **Step 3: Update nav container width**

Line 5: `max-w-md mx-auto` → `max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 md:px-6 lg:px-8`

- [ ] **Step 4: Update category tabs**

Line 69: `flex space-x-2 overflow-x-auto scrollbar-hide` → add `md:flex-wrap md:overflow-x-visible md:gap-2 md:space-x-0`

- [ ] **Step 5: Update main container**

Line 89: `max-w-md mx-auto pb-20` → `max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto pb-20 px-4 md:px-6 lg:px-8`

- [ ] **Step 6: Wrap menu content in flex layout**

Same pattern as ShopMenuView. Wrap `<div v-else-if="menuStructure" class="px-5 space-y-6">` content in flex layout, add DesktopCartPanel:

```html
<Transition name="slide-in-right">
  <DesktopCartPanel
    v-if="isDesktop && cartStore.itemCount > 0"
    :items="cartStore.items"
    :item-count="cartStore.itemCount"
    :subtotal="cartStore.subtotal"
    @checkout="router.push(`/restaurant/${restaurantId}/table/${tableId}/cart`)"
    @remove-item="cartStore.removeItem($event)"
    @update-quantity="(id, qty) => cartStore.updateQuantity(id, qty)"
  />
</Transition>
```

- [ ] **Step 7: Featured items horizontal scroll**

Line 161: `grid gap-4` → `flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-5 px-5`
Add `min-w-[280px] md:min-w-[260px] snap-start flex-shrink-0` to featured MenuItemCard classes.

- [ ] **Step 8: Category grid responsive**

Line 200: `grid gap-4` → `grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4`

- [ ] **Step 9: Update floating cart button**

Line 257-259: `max-w-md mx-auto` → `max-w-lg mx-auto lg:hidden`

- [ ] **Step 10: Add transition CSS**

Same slide-in-right transition CSS as ShopMenuView in `<style scoped>`.

- [ ] **Step 11: Verify typecheck**

Run: `cd apps/customer-app && npx vue-tsc --noEmit --pretty 2>&1 | tail -10`
Expected: No new errors

- [ ] **Step 12: Visual verification**

Test at 375px, 768px, 1440px using table-mode URL. Verify same responsive behavior as ShopMenuView.

- [ ] **Step 13: Commit**

```bash
git add apps/customer-app/src/views/MenuView.vue
git commit -m "feat(customer-app): make MenuView responsive with desktop cart panel"
```

---

### Task 5: Final Verification & Integration Commit

- [ ] **Step 1: Full typecheck**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm typecheck 2>&1 | tail -15`
Expected: All packages pass

- [ ] **Step 2: Run customer-app tests**

Run: `cd apps/customer-app && pnpm test -- --run 2>&1 | tail -15`
Expected: All existing tests pass (no test changes needed — changes are CSS/template only)

- [ ] **Step 3: Cross-breakpoint verification**

Take screenshots at 375px, 768px, 1024px, 1440px for the shop menu URL. Verify:

- 375px: single column, horizontal featured scroll, floating cart button
- 768px: 2-column grid, category tabs wrap, floating cart button
- 1024px: 2-column grid, cart panel slides in when items added, floating button hidden
- 1440px: same as 1024px with more breathing room

- [ ] **Step 4: Cart panel interaction test**

On desktop (1440px):

1. Verify cart panel is NOT visible when cart is empty
2. Add an item → verify panel slides in from right
3. Verify quantity +/- buttons work
4. Remove all items → verify panel slides out
5. Verify floating cart button reappears when panel is hidden (edge case: it won't because cart is empty)
