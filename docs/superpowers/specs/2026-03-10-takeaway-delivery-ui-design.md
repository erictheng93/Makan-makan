# Takeaway & Delivery UI Design Spec

**Date**: 2026-03-10
**Scope**: Takeaway + Basic Delivery (no driver assignment, no real-time tracking)
**Status**: Approved

## Decisions

| #   | Question        | Decision                                                        |
| --- | --------------- | --------------------------------------------------------------- |
| 1   | Scope           | Takeaway + Basic Delivery                                       |
| 2   | Customer entry  | Hybrid — Shop QR → Landing Page; Table/Seat QR → direct to menu |
| 3   | Address input   | Plain text field                                                |
| 4   | Delivery fee    | Restaurant-configurable fixed amount or free (0)                |
| 5   | Kitchen Display | Order type badge + filter                                       |
| 6   | Admin Dashboard | Order detail expansion + restaurant delivery settings           |

## Key Concept: Two Order Type Dimensions

The system has two independent order type dimensions:

1. **Source channel** (`orders.orderType` DB column): `'shop' | 'table' | 'seat'` — describes HOW the order was placed (which QR code). This column is NOT changed.
2. **Fulfillment type** (`orders.deliveryInfo.type` JSON field): `'dine_in' | 'takeaway' | 'delivery'` — describes HOW the customer gets their food. This is what the new UI manages.

All frontend code reads/writes `deliveryInfo.type` for fulfillment. The DB `orderType` column remains `'shop' | 'table' | 'seat'` and is set automatically based on QR source. The existing `guest-orders` validation schema keeps `orderType: z.enum(['shop', 'table', 'seat'])` for source channel; the new fulfillment type is passed via `deliveryInfo.type`.

## 1. Customer App

### 1.1 Flow

```
Shop QR scan
  → OrderTypeLandingView (NEW: choose takeaway / delivery)
  → ShopPhoneVerificationView (existing, unchanged)
  → ShopMenuView (existing, show fulfillment type badge at top)
  → ShopCartModal (MODIFIED: fulfillment type toggle, delivery form, fee display)

Table/Seat QR scan
  → MenuView (existing, unchanged — auto dine_in via deliveryInfo.type)
```

### 1.2 New: OrderTypeLandingView.vue

**Route**: `/restaurant/:restaurantId/shop/order-type`

**Behavior**:

- Fetch restaurant info (name, logo, business hours)
- Display 2 fulfillment type cards: takeaway, delivery (Shop QR implies no table — dine_in is not shown since customers who want dine-in should scan a Table QR instead)
- Hide delivery option if restaurant has `enableDelivery: false`
- On selection, navigate to `/shop/verify?fulfillmentType=<type>`
- Store fulfillmentType in shopCartStore

**State**:

- `selectedType: 'takeaway' | 'delivery'`
- `restaurant: Restaurant` (API fetch)
- `isLoading: boolean`

### 1.3 Modified: ShopCartModal.vue

**Takeaway checkout**:

- Order type toggle (takeaway selected)
- Display estimated prep time from restaurant settings
- Standard total display

**Delivery checkout**:

- Order type toggle (delivery selected)
- Delivery address field (text input, required)
- Contact phone field (required)
- Delivery instructions field (optional)
- Fee breakdown: subtotal + delivery fee = total

**Validation**:

- Delivery requires non-empty address and phone
- Phone format: basic validation (digits, dashes, 8-15 chars)

### 1.4 Modified: useShopCartStore

New fields:

```typescript
{
  fulfillmentType: 'takeaway' | 'delivery'  // from Landing Page (shop QR only)
  deliveryInfo: {
    address: string
    phone: string
    instructions: string
  } | null
  deliveryFee: number      // from restaurant settings, default 0

  // Computed
  totalWithDelivery: number  // subtotal + deliveryFee
}
```

Also update `ShopCartDataSchema` (Zod validator for localStorage) to include these new fields so data survives page refresh.

### 1.5 Router Changes

Add route before existing shop/verify:

```
/restaurant/:restaurantId/shop/order-type → OrderTypeLandingView
```

Modify shop QR entry point to redirect to `/shop/order-type` instead of `/shop/verify`.

## 2. Kitchen Display

### 2.1 OrderCard.vue — Order Type Badge

Add badge next to order number:

- Dine-in: 🪑 內用 (blue bg)
- Takeaway: 🛍️ 外帶 (green bg)
- Delivery: 🛵 外送 (amber bg)

Helper function `getOrderTypeBadge(order)` returns `{ label, emoji, bgClass, textClass }`.

Badge reads from `order.deliveryInfo?.type` or falls back to `'dine_in'` if no deliveryInfo.

### 2.2 OrderFilters.vue — Order Type Filter

Add order type checkbox group below existing priority filter:

- 🪑 內用 (count)
- 🛍️ 外帶 (count)
- 🛵 外送 (count)

Add quick filter pill: "外帶/外送" (filters out dine_in).

### 2.3 Store Changes

`useOrderManagementStore` filter state adds:

```typescript
orderTypes: string[]  // e.g. ['takeaway', 'delivery']
```

### 2.4 Type Changes

`KitchenOrder` type adds:

```typescript
orderType?: 'dine_in' | 'takeaway' | 'delivery'
deliveryInfo?: { type, address, phone, instructions, deliveryFee }
```

## 3. Admin Dashboard

### 3.1 OrdersView.vue — Order Detail Modal

When order has deliveryInfo, show a highlighted section:

- 📦 外送資訊 (amber background)
- Fields: address, phone, instructions, delivery fee
- Fee breakdown in totals: subtotal + delivery fee = total

Existing order type filter dropdown already works — no changes needed.

### 3.2 Restaurant Settings — Takeaway/Delivery Config

New section in restaurant settings page:

**Toggle switches**:

- 🛍️ 啟用外帶服務 (enableTakeaway, default: true)
- 🛵 啟用外送服務 (enableDelivery, default: false)

**Delivery fee input**:

- NT$ amount field (number input, default: 0)
- Helper text: "設為 0 即為免費外送"

**Estimated prep time**:

- Min/Max range inputs in minutes (default: 15-20)

## 4. Data & API

### 4.1 Restaurant Settings JSON Extension

`restaurants.settings` JSON adds:

```typescript
{
  enableTakeaway: boolean; // default true
  enableDelivery: boolean; // default false
  deliveryFee: number; // default 0
  estimatedPrepTimeMin: number; // default 15
  estimatedPrepTimeMax: number; // default 20
}
```

No DB migration needed — settings is already a JSON column.

### 4.2 API Changes

| Endpoint                        | Change                                                                                                         | Type   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------ |
| `POST /guest-orders`            | Accept `deliveryInfo` object with `type` field; keep `orderType` as `'shop'/'table'/'seat'` for source channel | Modify |
| `GET /restaurants/:id`          | Return settings with enableTakeaway, enableDelivery, deliveryFee, prepTime                                     | Extend |
| `PUT /restaurants/:id/settings` | Validate and save delivery-related settings fields                                                             | Extend |
| `GET /orders`                   | Already returns deliveryInfo — verify only                                                                     | Verify |
| `guest-orders validation`       | Add `deliveryInfo` schema: require `address` + `phone` when `deliveryInfo.type` is `'delivery'`                | Modify |

### 4.3 Order Submission Payload

```typescript
// POST /api/v1/guest-orders
{
  restaurantId: string
  orderType: 'shop'              // source channel — unchanged, set by QR type
  items: OrderItem[]
  customerInfo: { phoneLastDigits: string }
  deliveryInfo: {
    type: 'takeaway' | 'delivery'  // fulfillment type — NEW, from Landing Page
    address?: string               // required when type is 'delivery'
    phone?: string                 // required when type is 'delivery'
    instructions?: string
    deliveryFee?: number
  }
  totalAmount: number
}
```

Note: `orderType` remains `'shop'/'table'/'seat'` (source channel). The existing validation schema structure is preserved — `tableId`/`seatId` requirements still key off `orderType`. The new `deliveryInfo.type` is a separate concern (fulfillment method).

## 5. Out of Scope (YAGNI)

- Driver assignment system
- Real-time delivery tracking map
- Distance/zone-based delivery fee calculation
- New DB migrations (settings is JSON)
- New API routes (extend existing ones)
- i18n translations (hardcode zh-TW/en-US for now)
- Delivery status pipeline (pending → out for delivery → delivered)
- Saved address management
- Scheduled delivery/pickup time picker

## 6. Affected Files Summary

**New files**:

- `apps/customer-app/src/views/OrderTypeLandingView.vue`

**Modified files**:

- `apps/customer-app/src/components/ShopCartModal.vue`
- `apps/customer-app/src/stores/shopCart.ts` (state + ShopCartDataSchema Zod validator)
- `apps/customer-app/src/router/index.ts`
- `apps/kitchen-display/src/components/orders/OrderCard.vue`
- `apps/kitchen-display/src/components/orders/OrderFilters.vue`
- `apps/kitchen-display/src/stores/orderManagement.ts`
- `apps/kitchen-display/src/types/index.ts`
- `apps/admin-dashboard/src/views/OrdersView.vue`
- `apps/admin-dashboard/src/views/SettingsView.vue`
- `apps/api/src/features/guest-orders/routes/index.ts`
- `apps/api/src/features/guest-orders/schemas/validation.ts`
- `apps/api/src/features/restaurants/routes/index.ts` (settings endpoint)
- `packages/database/src/schema/restaurants.ts` (settings $type<> generic)
- `packages/shared-types/src/order.ts` (add deliveryInfo to Order interface)
- `apps/api/src/features/orders/types/index.ts` (add deliveryInfo to CreateOrderData)
