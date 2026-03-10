# Takeaway & Delivery UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add takeaway/delivery ordering UI across customer app, kitchen display, and admin dashboard, building on existing API infrastructure.

**Architecture:** Shop QR flow gets a new landing page for fulfillment type selection (takeaway/delivery). The fulfillment type flows through `deliveryInfo.type` in the orders JSON column — the DB `orderType` column (`shop/table/seat`) remains unchanged as source channel. Kitchen and admin UIs get badges and filters to distinguish order types.

**Tech Stack:** Vue 3 + TypeScript, Tailwind CSS, Pinia stores, Zod validation, Hono API routes

**Spec:** `docs/superpowers/specs/2026-03-10-takeaway-delivery-ui-design.md`

---

## Chunk 1: Type & Schema Foundation

### Task 1: Update shared Order type with deliveryInfo

**Files:**

- Modify: `packages/shared-types/src/order.ts:44-76`

- [ ] **Step 1: Add DeliveryInfo type and extend Order interface**

In `packages/shared-types/src/order.ts`, add after the existing imports/types (around line 42):

```typescript
export interface DeliveryInfo {
  type: "dine_in" | "takeaway" | "delivery";
  address?: string;
  phone?: string;
  instructions?: string;
  deliveryFee?: number;
  estimatedDeliveryTime?: number;
}
```

Then add to the `Order` interface (around line 44-76), add the field:

```typescript
deliveryInfo?: DeliveryInfo
```

- [ ] **Step 2: Run typecheck to verify no breakage**

Run: `cd packages/shared-types && pnpm typecheck`
Expected: PASS (additive change only)

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/order.ts
git commit -m "feat: add DeliveryInfo type to shared Order interface"
```

### Task 1b: Add deliveryInfo to CreateOrderData type

**Files:**

- Modify: `apps/api/src/features/orders/types/index.ts:51-66`

- [ ] **Step 1: Add deliveryInfo field to CreateOrderData**

In `apps/api/src/features/orders/types/index.ts`, find the `CreateOrderData` interface (around line 51-66) and add:

```typescript
deliveryInfo?: {
  type: 'dine_in' | 'takeaway' | 'delivery'
  address?: string
  phone?: string
  instructions?: string
  deliveryFee?: number
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: PASS (additive change only)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/orders/types/index.ts
git commit -m "feat: add deliveryInfo to CreateOrderData interface"
```

### Task 2: Extend restaurant settings type

**Files:**

- Modify: `packages/database/src/schema/restaurants.ts:62-74`

- [ ] **Step 1: Add delivery settings to RestaurantSettings type**

In `packages/database/src/schema/restaurants.ts`, find the settings `$type<>` generic (lines 62-74) and add these fields to the type:

```typescript
enableTakeaway?: boolean
enableDelivery?: boolean
deliveryFee?: number
estimatedPrepTimeMin?: number
estimatedPrepTimeMax?: number
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/database && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/database/src/schema/restaurants.ts
git commit -m "feat: add delivery settings to restaurant settings type"
```

### Task 3: Update guest-orders validation schema for deliveryInfo

**Files:**

- Modify: `apps/api/src/features/guest-orders/schemas/validation.ts:51-82`
- Test: `apps/api/src/features/guest-orders/__tests__/validation.test.ts`

- [ ] **Step 1: Write failing tests for deliveryInfo validation**

Add test cases to `apps/api/src/features/guest-orders/__tests__/validation.test.ts`:

```typescript
describe("deliveryInfo validation", () => {
  it("should accept valid takeaway deliveryInfo", () => {
    const data = {
      restaurantId: "test-restaurant-id",
      orderType: "shop",
      items: [{ menuItemId: 1, quantity: 1, price: 100 }],
      phoneLastDigits: "123",
      deliveryInfo: { type: "takeaway" },
    };
    const result = createGuestOrderSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("should accept valid delivery deliveryInfo with address and phone", () => {
    const data = {
      restaurantId: "test-restaurant-id",
      orderType: "shop",
      items: [{ menuItemId: 1, quantity: 1, price: 100 }],
      phoneLastDigits: "123",
      deliveryInfo: {
        type: "delivery",
        address: "台北市大安區忠孝東路四段100號",
        phone: "0912345678",
        instructions: "放門口",
        deliveryFee: 60,
      },
    };
    const result = createGuestOrderSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("should reject delivery without address", () => {
    const data = {
      restaurantId: "test-restaurant-id",
      orderType: "shop",
      items: [{ menuItemId: 1, quantity: 1, price: 100 }],
      phoneLastDigits: "123",
      deliveryInfo: {
        type: "delivery",
        phone: "0912345678",
      },
    };
    const result = createGuestOrderSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("should reject delivery without phone", () => {
    const data = {
      restaurantId: "test-restaurant-id",
      orderType: "shop",
      items: [{ menuItemId: 1, quantity: 1, price: 100 }],
      phoneLastDigits: "123",
      deliveryInfo: {
        type: "delivery",
        address: "台北市大安區",
      },
    };
    const result = createGuestOrderSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm vitest run src/features/guest-orders/__tests__/validation.test.ts`
Expected: FAIL (deliveryInfo not in schema yet)

- [ ] **Step 3: Add deliveryInfo to validation schema**

In `apps/api/src/features/guest-orders/schemas/validation.ts`, add a `deliveryInfoSchema` before `createGuestOrderSchema`:

```typescript
const deliveryInfoSchema = z
  .object({
    type: z.enum(["dine_in", "takeaway", "delivery"]),
    address: z.string().min(1).optional(),
    phone: z.string().min(8).max(15).optional(),
    instructions: z.string().max(500).optional(),
    deliveryFee: z.number().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.type === "delivery") {
        return !!data.address && !!data.phone;
      }
      return true;
    },
    { message: "Delivery orders require address and phone" },
  );
```

Then add to `createGuestOrderSchema`:

```typescript
deliveryInfo: deliveryInfoSchema.optional(),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pnpm vitest run src/features/guest-orders/__tests__/validation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/features/guest-orders/schemas/validation.ts apps/api/src/features/guest-orders/__tests__/validation.test.ts
git commit -m "feat: add deliveryInfo validation to guest-orders schema"
```

### Task 4: Update guest-orders route to use frontend deliveryInfo

**Files:**

- Modify: `apps/api/src/features/guest-orders/routes/index.ts:146`

- [ ] **Step 1: Update order creation to pass through deliveryInfo**

In `apps/api/src/features/guest-orders/routes/index.ts`, find the line that hardcodes the mapping (around line 146):

```typescript
// OLD: orderType: data.orderType === "shop" ? "takeaway" : "dine_in"
```

Replace with logic that reads `deliveryInfo.type` from the request, falling back to the old mapping:

```typescript
const fulfillmentType =
  data.deliveryInfo?.type ??
  (data.orderType === "shop" ? "takeaway" : "dine_in");

// Then in the order creation object, set:
deliveryInfo: JSON.stringify({
  type: fulfillmentType,
  address: data.deliveryInfo?.address,
  phone: data.deliveryInfo?.phone,
  instructions: data.deliveryInfo?.instructions,
  deliveryFee: data.deliveryInfo?.deliveryFee,
});
```

- [ ] **Step 2: Run existing guest-orders tests to verify no regression**

Run: `cd apps/api && pnpm vitest run src/features/guest-orders/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/guest-orders/routes/index.ts
git commit -m "feat: pass through frontend deliveryInfo in guest-orders route"
```

### Task 5: Extend restaurant settings API endpoint

**Files:**

- Modify: `apps/api/src/features/restaurants/routes/index.ts`

- [ ] **Step 1: Verify settings endpoint accepts arbitrary JSON fields**

Check the existing `PUT /restaurants/:id/settings` endpoint. Since `settings` is a JSON column, verify it already accepts and persists new fields without code changes. If it does a strict validation, add the new fields to the validation schema:

```typescript
enableTakeaway: z.boolean().optional(),
enableDelivery: z.boolean().optional(),
deliveryFee: z.number().min(0).optional(),
estimatedPrepTimeMin: z.number().int().min(1).optional(),
estimatedPrepTimeMax: z.number().int().min(1).optional(),
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit** (if changes were needed)

```bash
git add apps/api/src/features/restaurants/
git commit -m "feat: add delivery settings validation to restaurant settings endpoint"
```

---

## Chunk 2: Customer App — Store & Router

### Task 6: Extend shopCartStore with fulfillmentType and deliveryInfo

**Files:**

- Modify: `apps/customer-app/src/stores/shopCart.ts:52-63,81-92,235-288`

- [ ] **Step 1: Update ShopCartDataSchema Zod validator**

In `apps/customer-app/src/stores/shopCart.ts`, update the `ShopCartDataSchema` (lines 52-57) to include:

```typescript
const ShopCartDataSchema = z.object({
  items: z.array(z.any()),
  restaurantId: z.string(),
  phoneLastDigits: z.string(),
  timestamp: z.number(),
  fulfillmentType: z
    .enum(["takeaway", "delivery"])
    .optional()
    .default("takeaway"),
  deliveryInfo: z
    .object({
      address: z.string(),
      phone: z.string(),
      instructions: z.string(),
    })
    .nullable()
    .optional()
    .default(null),
  deliveryFee: z.number().optional().default(0),
});
```

- [ ] **Step 2: Add state fields to store**

In the store definition (around lines 60-63), add:

```typescript
fulfillmentType: 'takeaway' as 'takeaway' | 'delivery',
deliveryInfo: null as { address: string; phone: string; instructions: string } | null,
deliveryFee: 0,
```

- [ ] **Step 3: Add computed totalWithDelivery**

Add a getter:

```typescript
totalWithDelivery(): number {
  return this.subtotal + (this.fulfillmentType === 'delivery' ? this.deliveryFee : 0)
}
```

- [ ] **Step 4: Add actions for setting fulfillment type and delivery info**

```typescript
setFulfillmentType(type: 'takeaway' | 'delivery') {
  this.fulfillmentType = type
  if (type !== 'delivery') {
    this.deliveryInfo = null
  }
},
setDeliveryInfo(info: { address: string; phone: string; instructions: string }) {
  this.deliveryInfo = info
},
setDeliveryFee(fee: number) {
  this.deliveryFee = fee
},
```

- [ ] **Step 5: Update saveCart and restoreCart to include new fields**

In `saveCart()` (around line 235-250), add the new fields to the persisted object.
In `restoreCart()` (around line 252-288), ensure the Zod schema handles the new fields with defaults.

- [ ] **Step 6: Run typecheck**

Run: `cd apps/customer-app && pnpm typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/customer-app/src/stores/shopCart.ts
git commit -m "feat: add fulfillmentType and deliveryInfo to shopCartStore"
```

### Task 7: Add OrderTypeLandingView and update router

**Files:**

- Create: `apps/customer-app/src/views/OrderTypeLandingView.vue`
- Modify: `apps/customer-app/src/router/index.ts:116-138`

- [ ] **Step 1: Create OrderTypeLandingView.vue**

Create `apps/customer-app/src/views/OrderTypeLandingView.vue`:

```vue
<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-md mx-auto px-4 py-8">
      <!-- Loading -->
      <div
        v-if="isLoading"
        class="flex justify-center items-center min-h-[60vh]"
      >
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"
        ></div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-12">
        <p class="text-red-500 mb-4">{{ error }}</p>
        <button @click="fetchRestaurant" class="text-indigo-600 underline">
          重試
        </button>
      </div>

      <!-- Content -->
      <div v-else>
        <!-- Restaurant Header -->
        <div class="text-center mb-8">
          <div
            v-if="restaurant?.logo"
            class="w-16 h-16 rounded-2xl mx-auto mb-3 overflow-hidden"
          >
            <img
              :src="restaurant.logo"
              :alt="restaurant.name"
              class="w-full h-full object-cover"
            />
          </div>
          <div
            v-else
            class="w-16 h-16 rounded-2xl mx-auto mb-3 bg-gray-200 flex items-center justify-center"
          >
            <span class="text-2xl">🍽️</span>
          </div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ restaurant?.name }}
          </h1>
          <p v-if="restaurant?.description" class="text-sm text-gray-500 mt-1">
            {{ restaurant.description }}
          </p>
        </div>

        <!-- Fulfillment Type Selection -->
        <p class="text-sm font-semibold text-gray-500 mb-3">請選擇取餐方式</p>
        <div class="flex flex-col gap-3">
          <!-- Takeaway -->
          <button
            @click="selectedType = 'takeaway'"
            :class="[
              'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
              selectedType === 'takeaway'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white hover:border-gray-300',
            ]"
          >
            <span class="text-3xl">🛍️</span>
            <div class="flex-1">
              <div class="font-semibold text-gray-900">外帶 Takeaway</div>
              <div class="text-xs text-gray-500">到店自取</div>
            </div>
            <svg
              v-if="selectedType === 'takeaway'"
              class="w-5 h-5 text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
          </button>

          <!-- Delivery -->
          <button
            v-if="deliveryEnabled"
            @click="selectedType = 'delivery'"
            :class="[
              'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
              selectedType === 'delivery'
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 bg-white hover:border-gray-300',
            ]"
          >
            <span class="text-3xl">🛵</span>
            <div class="flex-1">
              <div class="font-semibold text-gray-900">外送 Delivery</div>
              <div class="text-xs text-gray-500">送到指定地址</div>
            </div>
            <svg
              v-if="selectedType === 'delivery'"
              class="w-5 h-5 text-amber-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>

        <!-- Continue Button -->
        <button
          @click="handleContinue"
          :disabled="!selectedType"
          class="w-full mt-6 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          繼續
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useShopCartStore } from "@/stores/shopCart";
import { menuApi } from "@/services/menuApi";

const props = defineProps<{ restaurantId: string }>();

const router = useRouter();
const route = useRoute();
const shopCartStore = useShopCartStore();

const selectedType = ref<"takeaway" | "delivery">("takeaway");
const restaurant = ref<any>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

const deliveryEnabled = computed(() => {
  return restaurant.value?.settings?.enableDelivery ?? false;
});

async function fetchRestaurant() {
  isLoading.value = true;
  error.value = null;
  try {
    const res = await menuApi.getRestaurant(props.restaurantId);
    restaurant.value = res;
  } catch (e) {
    error.value = "無法載入餐廳資訊";
  } finally {
    isLoading.value = false;
  }
}

function handleContinue() {
  shopCartStore.setFulfillmentType(selectedType.value);
  if (
    selectedType.value === "delivery" &&
    restaurant.value?.settings?.deliveryFee
  ) {
    shopCartStore.setDeliveryFee(restaurant.value.settings.deliveryFee);
  }
  router.push({
    name: "ShopPhoneVerification",
    params: { restaurantId: props.restaurantId },
    query: {
      ...route.query,
      fulfillmentType: selectedType.value,
    },
  });
}

onMounted(fetchRestaurant);
</script>
```

- [ ] **Step 2: Add route to router**

In `apps/customer-app/src/router/index.ts`, add before the ShopPhoneVerification route (line 116):

```typescript
{
  path: '/restaurant/:restaurantId/shop/order-type',
  name: 'OrderTypeLanding',
  component: () => import('@/views/OrderTypeLandingView.vue'),
  props: true,
  meta: { title: '選擇取餐方式' },
},
```

- [ ] **Step 3: Update Shop QR entry to redirect to order-type page**

In the router, find where shop QR codes resolve (the ShopPhoneVerification route at line 116-126). Update the QR code parser or redirect logic so that scanning a Shop QR navigates to `/restaurant/:restaurantId/shop/order-type` instead of directly to `/shop/verify`.

Check `apps/customer-app/src/utils/qr-parser.ts` for the QR parsing logic that determines the initial route.

- [ ] **Step 4: Run dev server to verify the page renders**

Run: `cd apps/customer-app && pnpm dev`
Navigate to: `http://localhost:5173/restaurant/test-id/shop/order-type`
Expected: Landing page renders with takeaway card (delivery hidden if not enabled)

- [ ] **Step 5: Commit**

```bash
git add apps/customer-app/src/views/OrderTypeLandingView.vue apps/customer-app/src/router/index.ts
git commit -m "feat: add OrderTypeLandingView for shop QR fulfillment selection"
```

---

## Chunk 3: Customer App — Checkout Flow

### Task 7b: Add fulfillment type badge to ShopMenuView

**Files:**

- Modify: `apps/customer-app/src/views/ShopMenuView.vue:301-324`

- [ ] **Step 1: Display fulfillment type badge in the sticky header**

In `ShopMenuView.vue`, add a small badge next to the restaurant name in the sticky header showing the current fulfillment type from shopCartStore:

```vue
<span
  v-if="shopCartStore.fulfillmentType"
  :class="[
    'ml-2 px-2 py-0.5 rounded-full text-xs font-semibold',
    shopCartStore.fulfillmentType === 'delivery'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-green-100 text-green-800',
  ]"
>
  {{ shopCartStore.fulfillmentType === 'delivery' ? '🛵 外送' : '🛍️ 外帶' }}
</span>
```

- [ ] **Step 2: Commit**

```bash
git add apps/customer-app/src/views/ShopMenuView.vue
git commit -m "feat: show fulfillment type badge in shop menu header"
```

### Task 8: Modify ShopCartModal for fulfillment type and delivery form

**Files:**

- Modify: `apps/customer-app/src/components/ShopCartModal.vue:329-388`

- [ ] **Step 1: Add fulfillment type toggle to the modal template**

In `ShopCartModal.vue`, add a fulfillment type toggle section before the cart items list. Insert after the customer info section:

```vue
<!-- Fulfillment Type Toggle -->
<div class="mb-4">
  <p class="text-sm font-semibold text-gray-700 mb-2">取餐方式</p>
  <div class="flex gap-2">
    <button
      @click="shopCartStore.setFulfillmentType('takeaway')"
      :class="[
        'flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors',
        shopCartStore.fulfillmentType === 'takeaway'
          ? 'bg-green-500 text-white'
          : 'bg-gray-100 text-gray-600'
      ]"
    >
      🛍️ 外帶
    </button>
    <button
      v-if="deliveryEnabled"
      @click="shopCartStore.setFulfillmentType('delivery')"
      :class="[
        'flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors',
        shopCartStore.fulfillmentType === 'delivery'
          ? 'bg-amber-500 text-white'
          : 'bg-gray-100 text-gray-600'
      ]"
    >
      🛵 外送
    </button>
  </div>
</div>
```

- [ ] **Step 2: Add delivery form (shown when delivery selected)**

Add below the toggle:

```vue
<!-- Delivery Form -->
<div v-if="shopCartStore.fulfillmentType === 'delivery'" class="mb-4 space-y-3">
  <div>
    <label class="block text-xs text-gray-500 mb-1">外送地址 *</label>
    <input
      v-model="deliveryAddress"
      type="text"
      placeholder="請輸入外送地址..."
      class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    />
  </div>
  <div>
    <label class="block text-xs text-gray-500 mb-1">聯絡電話 *</label>
    <input
      v-model="deliveryPhone"
      type="tel"
      placeholder="0912-345-678"
      class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    />
  </div>
  <div>
    <label class="block text-xs text-gray-500 mb-1">配送備註</label>
    <input
      v-model="deliveryInstructions"
      type="text"
      placeholder="大樓密碼、放門口..."
      class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    />
  </div>
</div>

<!-- Takeaway Info -->
<div v-if="shopCartStore.fulfillmentType === 'takeaway' && estimatedPrepTime" class="mb-4 p-3 bg-gray-50 rounded-lg">
  <p class="text-xs text-gray-500">預計取餐時間</p>
  <p class="font-semibold text-sm">約 {{ estimatedPrepTime }} 分鐘</p>
</div>
```

- [ ] **Step 3: Add reactive state for delivery fields**

In the `<script setup>`, add:

```typescript
const deliveryAddress = ref("");
const deliveryPhone = ref("");
const deliveryInstructions = ref("");

// ShopCartModal already has access to restaurant data via ShopMenuView parent.
// Pass restaurant settings as a prop, or read from the menuApi response cached by TanStack Query.
// The landing page already set fulfillmentType — if it's 'delivery', delivery was enabled.
const deliveryEnabled = computed(() => {
  return (
    shopCartStore.fulfillmentType === "delivery" ||
    (restaurant.value?.settings?.enableDelivery ?? false)
  );
});

const estimatedPrepTime = computed(() => {
  // Read from restaurant data if available
  const min = restaurant.value?.settings?.estimatedPrepTimeMin ?? 15;
  const max = restaurant.value?.settings?.estimatedPrepTimeMax ?? 20;
  return `${min}-${max}`;
});
```

- [ ] **Step 4: Update fee display in totals section**

Find the totals section in the template and add delivery fee line:

```vue
<!-- Fee breakdown -->
<div
  v-if="shopCartStore.fulfillmentType === 'delivery'"
  class="flex justify-between text-sm text-gray-500"
>
  <span>小計</span>
  <span>NT$ {{ shopCartStore.subtotal }}</span>
</div>
<div
  v-if="
    shopCartStore.fulfillmentType === 'delivery' &&
    shopCartStore.deliveryFee > 0
  "
  class="flex justify-between text-sm text-gray-500"
>
  <span>外送費</span>
  <span>NT$ {{ shopCartStore.deliveryFee }}</span>
</div>
<div class="flex justify-between font-bold">
  <span>合計</span>
  <span>NT$ {{ shopCartStore.totalWithDelivery }}</span>
</div>
```

- [ ] **Step 5: Update checkout submit logic**

In the checkout function (around line 329-388), update the `orderData` to include deliveryInfo:

```typescript
// Replace the hardcoded orderType: "shop" with:
const orderData = {
  restaurantId: shopCartStore.restaurantId,
  orderType: 'shop', // source channel — unchanged
  items: /* existing items mapping */,
  phoneLastDigits: shopCartStore.phoneLastDigits,
  totalAmount: shopCartStore.totalWithDelivery,
  deliveryInfo: {
    type: shopCartStore.fulfillmentType,
    ...(shopCartStore.fulfillmentType === 'delivery' ? {
      address: deliveryAddress.value,
      phone: deliveryPhone.value,
      instructions: deliveryInstructions.value,
      deliveryFee: shopCartStore.deliveryFee,
    } : {}),
  },
}
```

- [ ] **Step 6: Add validation before submit**

Add validation that blocks checkout if delivery is selected but address/phone are empty:

```typescript
if (shopCartStore.fulfillmentType === "delivery") {
  if (!deliveryAddress.value.trim()) {
    toast.error("請輸入外送地址");
    return;
  }
  if (
    !deliveryPhone.value.trim() ||
    deliveryPhone.value.replace(/\D/g, "").length < 8
  ) {
    toast.error("請輸入有效的聯絡電話");
    return;
  }
  shopCartStore.setDeliveryInfo({
    address: deliveryAddress.value.trim(),
    phone: deliveryPhone.value.trim(),
    instructions: deliveryInstructions.value.trim(),
  });
}
```

- [ ] **Step 7: Run typecheck and dev server test**

Run: `cd apps/customer-app && pnpm typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/customer-app/src/components/ShopCartModal.vue
git commit -m "feat: add fulfillment type toggle and delivery form to ShopCartModal"
```

---

## Chunk 4: Kitchen Display

### Task 9: Add order type badge to OrderCard

**Files:**

- Modify: `apps/kitchen-display/src/components/orders/OrderCard.vue:9-31`
- Modify: `apps/kitchen-display/src/types/index.ts:29-46`

- [ ] **Step 1: Update KitchenOrder type**

In `apps/kitchen-display/src/types/index.ts`, add to the `KitchenOrder` interface (around line 29-46):

```typescript
deliveryInfo?: {
  type?: 'dine_in' | 'takeaway' | 'delivery'
  address?: string
  phone?: string
  instructions?: string
  deliveryFee?: number
}
```

Make `tableId` optional (change from `tableId: number` to `tableId?: number`) and `tableName` optional too.

- [ ] **Step 2: Add getOrderTypeBadge helper**

In `OrderCard.vue`, add a helper function in `<script setup>`:

```typescript
function getOrderTypeBadge(order: KitchenOrder) {
  const type = order.deliveryInfo?.type ?? "dine_in";
  const badges = {
    dine_in: {
      label: "內用",
      emoji: "🪑",
      bgClass: "bg-blue-100",
      textClass: "text-blue-800",
    },
    takeaway: {
      label: "外帶",
      emoji: "🛍️",
      bgClass: "bg-green-100",
      textClass: "text-green-800",
    },
    delivery: {
      label: "外送",
      emoji: "🛵",
      bgClass: "bg-amber-100",
      textClass: "text-amber-800",
    },
  };
  return badges[type] || badges.dine_in;
}
```

- [ ] **Step 3: Add badge to template**

In the OrderCard template header section (around line 14, next to the order number), add:

```vue
<span
  :class="[
    getOrderTypeBadge(order).bgClass,
    getOrderTypeBadge(order).textClass,
  ]"
  class="px-2 py-0.5 rounded-full text-xs font-semibold"
>
  {{ getOrderTypeBadge(order).emoji }} {{ getOrderTypeBadge(order).label }}
</span>
```

- [ ] **Step 4: Run typecheck**

Run: `cd apps/kitchen-display && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/kitchen-display/src/components/orders/OrderCard.vue apps/kitchen-display/src/types/index.ts
git commit -m "feat: add order type badge to kitchen display OrderCard"
```

### Task 10: Add order type filter to OrderFilters

**Files:**

- Modify: `apps/kitchen-display/src/components/orders/OrderFilters.vue:259-302`
- Modify: `apps/kitchen-display/src/stores/orderManagement.ts:13-22,79-172`

- [ ] **Step 1: Add orderTypes to filter interface in store**

In `apps/kitchen-display/src/stores/orderManagement.ts`, add to the `OrderFilter` interface (around line 13-22):

```typescript
orderTypes: string[]  // 'dine_in' | 'takeaway' | 'delivery'
```

Initialize it as empty array `[]` in the store state.

- [ ] **Step 2: Add orderType filtering logic**

In the filtering logic (around lines 79-172), add a filter check:

```typescript
// After existing filters
if (filters.orderTypes.length > 0) {
  filtered = filtered.filter((order) => {
    const type = order.deliveryInfo?.type ?? "dine_in";
    return filters.orderTypes.includes(type);
  });
}
```

- [ ] **Step 3: Add order type filter UI to OrderFilters.vue**

In `OrderFilters.vue`, add a new filter section after the priority filter (around line 302):

```vue
<!-- Order Type Filter -->
<div class="mb-4">
  <h4 class="text-sm font-semibold text-gray-600 mb-2">訂單類型</h4>
  <div class="flex flex-wrap gap-2">
    <label
      v-for="type in orderTypeOptions"
      :key="type.value"
      :class="[
        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors',
        selectedOrderTypes.includes(type.value)
          ? type.activeClass
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      ]"
    >
      <input
        type="checkbox"
        :value="type.value"
        v-model="selectedOrderTypes"
        class="sr-only"
      />
      {{ type.emoji }} {{ type.label }}
      <span class="text-xs opacity-75">({{ getOrderTypeCount(type.value) }})</span>
    </label>
  </div>
</div>
```

Add the reactive data:

```typescript
const orderTypeOptions = [
  {
    value: "dine_in",
    label: "內用",
    emoji: "🪑",
    activeClass: "bg-blue-100 text-blue-800",
  },
  {
    value: "takeaway",
    label: "外帶",
    emoji: "🛍️",
    activeClass: "bg-green-100 text-green-800",
  },
  {
    value: "delivery",
    label: "外送",
    emoji: "🛵",
    activeClass: "bg-amber-100 text-amber-800",
  },
];

const selectedOrderTypes = ref<string[]>([]);

function getOrderTypeCount(type: string): number {
  return store.allOrders.filter(
    (o) => (o.deliveryInfo?.type ?? "dine_in") === type,
  ).length;
}

// Watch and sync to store
watch(selectedOrderTypes, (types) => {
  store.updateFilter({ orderTypes: types });
});
```

- [ ] **Step 4: Add quick filter pill for takeaway/delivery**

In the quick filters section of OrderFilters.vue, add:

```vue
<button
  @click="toggleTakeawayDeliveryFilter"
  :class="[
    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
    isTakeawayDeliveryActive
      ? 'bg-amber-100 text-amber-800'
      : 'bg-gray-100 text-gray-600',
  ]"
>
  🛍️🛵 外帶/外送
</button>
```

```typescript
const isTakeawayDeliveryActive = computed(
  () =>
    selectedOrderTypes.value.includes("takeaway") &&
    selectedOrderTypes.value.includes("delivery") &&
    !selectedOrderTypes.value.includes("dine_in"),
);

function toggleTakeawayDeliveryFilter() {
  if (isTakeawayDeliveryActive.value) {
    selectedOrderTypes.value = [];
  } else {
    selectedOrderTypes.value = ["takeaway", "delivery"];
  }
}
```

- [ ] **Step 5: Run typecheck**

Run: `cd apps/kitchen-display && pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/kitchen-display/src/components/orders/OrderFilters.vue apps/kitchen-display/src/stores/orderManagement.ts
git commit -m "feat: add order type filter to kitchen display"
```

---

## Chunk 5: Admin Dashboard

### Task 11: Extend order detail modal with delivery info

**Files:**

- Modify: `apps/admin-dashboard/src/views/OrdersView.vue`

- [ ] **Step 1: Add delivery info section to order detail modal**

In `OrdersView.vue`, find the order detail modal section. Add a delivery info block that shows conditionally:

```vue
<!-- Delivery Info Section -->
<div
  v-if="selectedOrder?.deliveryInfo && selectedOrder.deliveryInfo.type !== 'dine_in'"
  class="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl"
>
  <h4 class="font-semibold text-amber-800 mb-3 flex items-center gap-1">
    <span>📦</span> 外送資訊
  </h4>
  <div class="grid grid-cols-[80px_1fr] gap-y-2 text-sm">
    <span class="text-gray-500">類型</span>
    <span class="font-medium">
      {{ selectedOrder.deliveryInfo.type === 'delivery' ? '🛵 外送' : '🛍️ 外帶' }}
    </span>
    <template v-if="selectedOrder.deliveryInfo.address">
      <span class="text-gray-500">地址</span>
      <span>{{ selectedOrder.deliveryInfo.address }}</span>
    </template>
    <template v-if="selectedOrder.deliveryInfo.phone">
      <span class="text-gray-500">電話</span>
      <span>{{ selectedOrder.deliveryInfo.phone }}</span>
    </template>
    <template v-if="selectedOrder.deliveryInfo.instructions">
      <span class="text-gray-500">備註</span>
      <span>{{ selectedOrder.deliveryInfo.instructions }}</span>
    </template>
    <template v-if="selectedOrder.deliveryInfo.deliveryFee">
      <span class="text-gray-500">外送費</span>
      <span class="font-semibold">NT$ {{ selectedOrder.deliveryInfo.deliveryFee }}</span>
    </template>
  </div>
</div>
```

- [ ] **Step 2: Update totals display to include delivery fee**

In the order totals section, add:

```vue
<div
  v-if="selectedOrder?.deliveryInfo?.deliveryFee"
  class="flex justify-between text-sm text-gray-500"
>
  <span>外送費</span>
  <span>NT$ {{ selectedOrder.deliveryInfo.deliveryFee }}</span>
</div>
```

- [ ] **Step 3: Add order type badge to the modal header**

Next to the order number in the modal, add:

```vue
<span
  v-if="
    selectedOrder?.deliveryInfo?.type &&
    selectedOrder.deliveryInfo.type !== 'dine_in'
  "
  :class="[
    'px-2 py-1 rounded-full text-xs font-semibold',
    selectedOrder.deliveryInfo.type === 'delivery'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-green-100 text-green-800',
  ]"
>
  {{ selectedOrder.deliveryInfo.type === 'delivery' ? '🛵 外送' : '🛍️ 外帶' }}
</span>
```

- [ ] **Step 4: Run typecheck**

Run: `cd apps/admin-dashboard && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/views/OrdersView.vue
git commit -m "feat: add delivery info display to admin order detail modal"
```

### Task 12: Add takeaway/delivery settings to restaurant settings page

**Files:**

- Modify: `apps/admin-dashboard/src/views/SettingsView.vue`

- [ ] **Step 1: Add delivery settings section**

In `SettingsView.vue`, add a new section for takeaway/delivery settings. Find the appropriate location in the settings form (after existing restaurant settings):

```vue
<!-- Takeaway/Delivery Settings -->
<div class="bg-white rounded-xl shadow-sm p-6 mb-6">
  <h3 class="text-lg font-bold text-gray-900 mb-1">外帶/外送設定</h3>
  <p class="text-sm text-gray-500 mb-4">管理餐廳的外帶取餐和外送服務設定</p>

  <!-- Enable Takeaway -->
  <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
    <div>
      <div class="font-semibold text-sm">🛍️ 啟用外帶服務</div>
      <div class="text-xs text-gray-500">允許顧客透過 Shop QR 選擇外帶</div>
    </div>
    <label class="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" v-model="settings.enableTakeaway" class="sr-only peer" />
      <div class="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
    </label>
  </div>

  <!-- Enable Delivery -->
  <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-4">
    <div>
      <div class="font-semibold text-sm">🛵 啟用外送服務</div>
      <div class="text-xs text-gray-500">允許顧客選擇外送到指定地址</div>
    </div>
    <label class="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" v-model="settings.enableDelivery" class="sr-only peer" />
      <div class="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
    </label>
  </div>

  <!-- Delivery Fee -->
  <div class="border border-gray-200 rounded-lg p-3 mb-3">
    <label class="block font-semibold text-sm mb-2">外送費設定</label>
    <div class="flex items-center gap-2">
      <span class="text-gray-500 text-sm">NT$</span>
      <input
        type="number"
        v-model.number="settings.deliveryFee"
        min="0"
        step="10"
        class="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
    <p class="text-xs text-gray-400 mt-1">設為 0 即為免費外送</p>
  </div>

  <!-- Estimated Prep Time -->
  <div class="border border-gray-200 rounded-lg p-3">
    <label class="block font-semibold text-sm mb-2">預估外帶準備時間</label>
    <div class="flex items-center gap-2">
      <input
        type="number"
        v-model.number="settings.estimatedPrepTimeMin"
        min="1"
        max="120"
        class="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <span class="text-gray-500">~</span>
      <input
        type="number"
        v-model.number="settings.estimatedPrepTimeMax"
        min="1"
        max="120"
        class="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <span class="text-gray-500 text-sm">分鐘</span>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add settings reactive state**

In the `<script setup>`, add the delivery settings to the existing settings reactive object:

```typescript
// Add to existing settings state or create if needed:
const settings = reactive({
  // ...existing settings
  enableTakeaway: true,
  enableDelivery: false,
  deliveryFee: 0,
  estimatedPrepTimeMin: 15,
  estimatedPrepTimeMax: 20,
});
```

Initialize from fetched restaurant data and include in the save function.

- [ ] **Step 3: Integrate with save function**

Ensure the save/update function includes the new fields when calling `PUT /restaurants/:id/settings`.

- [ ] **Step 4: Run typecheck**

Run: `cd apps/admin-dashboard && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/views/SettingsView.vue
git commit -m "feat: add takeaway/delivery settings to restaurant settings page"
```

---

## Chunk 6: Integration & Verification

### Task 13: End-to-end verification

- [ ] **Step 1: Run full typecheck across all packages**

Run: `pnpm typecheck`
Expected: PASS across all 20 packages

- [ ] **Step 2: Run all existing tests**

Run: `pnpm test`
Expected: All existing tests pass (no regressions)

- [ ] **Step 3: Manual integration test — takeaway flow**

1. Start dev servers: `pnpm dev`
2. Navigate to shop QR URL → verify Landing Page shows
3. Select "外帶" → verify navigation to phone verification
4. Complete phone verification → verify menu page shows "外帶" indicator
5. Add items to cart → open cart modal → verify "外帶" selected with prep time shown
6. Submit order → verify order created with `deliveryInfo.type: 'takeaway'`

- [ ] **Step 4: Manual integration test — delivery flow**

1. Select "外送" on Landing Page
2. Complete phone verification → menu → add items
3. Open cart modal → verify delivery form (address, phone, instructions)
4. Fill in address and phone → verify fee displayed
5. Submit → verify order created with full deliveryInfo

- [ ] **Step 5: Verify kitchen display**

1. Open kitchen display
2. Verify new orders show type badges (外帶/外送)
3. Test order type filter — select only 外送, verify filtering works

- [ ] **Step 6: Verify admin dashboard**

1. Open admin dashboard → Orders view
2. Click on a delivery order → verify delivery info section shows
3. Go to Settings → verify takeaway/delivery settings section
4. Toggle delivery on/off, set fee, save → verify persistence

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete takeaway/delivery UI integration"
```
