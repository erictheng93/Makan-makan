<template>
  <div class="order-summary">
    <!-- Header -->
    <div class="summary-header">
      <h3 class="summary-title">訂單摘要</h3>
      <div v-if="loading" class="header-loading">
        <div class="loading-spinner"></div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="summary-loading">
      <div class="skeleton-lines">
        <div class="skeleton-line w-full h-4"></div>
        <div class="skeleton-line w-3/4 h-4"></div>
        <div class="skeleton-line w-1/2 h-4"></div>
      </div>
    </div>

    <!-- Order Content -->
    <div v-else-if="order" class="summary-content">
      <!-- Restaurant Info -->
      <div class="restaurant-info">
        <div class="restaurant-icon">
          <svg
            class="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H7m2 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-6 0h4"
            ></path>
          </svg>
        </div>
        <div class="restaurant-details">
          <p class="restaurant-name">{{ order.restaurantName || "餐廳" }}</p>
          <p v-if="order.tableNumber" class="table-info">
            桌號: {{ order.tableNumber }}
          </p>
        </div>
      </div>

      <!-- Order ID -->
      <div class="order-id-section">
        <div class="order-id-label">訂單編號</div>
        <div class="order-id-value">{{ order.id }}</div>
      </div>

      <!-- Order Items -->
      <div v-if="order.items && order.items.length > 0" class="order-items">
        <h4 class="items-title">點餐內容</h4>

        <div class="items-list">
          <div
            v-for="item in order.items"
            :key="`${item.id}-${item.customizations?.join(',') || 'default'}`"
            class="order-item"
          >
            <div class="item-info">
              <div class="item-main">
                <span class="item-name">{{ item.name }}</span>
                <span class="item-quantity">× {{ item.quantity }}</span>
              </div>

              <!-- Customizations -->
              <div
                v-if="item.customizations && item.customizations.length > 0"
                class="item-customizations"
              >
                <span
                  v-for="customization in item.customizations"
                  :key="customization"
                  class="customization-tag"
                >
                  {{ customization }}
                </span>
              </div>

              <!-- Special Instructions -->
              <div v-if="item.notes" class="item-notes">
                <span class="notes-label">備註:</span>
                <span class="notes-text">{{ item.notes }}</span>
              </div>
            </div>

            <div class="item-price">
              {{ formatCurrency(item.price * item.quantity, order.currency) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Price Breakdown -->
      <div class="price-breakdown">
        <div class="breakdown-row subtotal-row">
          <span class="breakdown-label">小計</span>
          <span class="breakdown-value">{{
            formatCurrency(order.subtotal, order.currency)
          }}</span>
        </div>

        <div v-if="order.tax && order.tax > 0" class="breakdown-row tax-row">
          <span class="breakdown-label"
            >稅費 ({{ getTaxRate(order.country) }}%)</span
          >
          <span class="breakdown-value">{{
            formatCurrency(order.tax, order.currency)
          }}</span>
        </div>

        <div
          v-if="order.serviceFee && order.serviceFee > 0"
          class="breakdown-row service-row"
        >
          <span class="breakdown-label">服務費</span>
          <span class="breakdown-value">{{
            formatCurrency(order.serviceFee, order.currency)
          }}</span>
        </div>

        <div
          v-if="order.deliveryFee && order.deliveryFee > 0"
          class="breakdown-row delivery-row"
        >
          <span class="breakdown-label">外送費</span>
          <span class="breakdown-value">{{
            formatCurrency(order.deliveryFee, order.currency)
          }}</span>
        </div>

        <div
          v-if="order.discount && order.discount > 0"
          class="breakdown-row discount-row"
        >
          <span class="breakdown-label text-green-600">折扣</span>
          <span class="breakdown-value text-green-600"
            >-{{ formatCurrency(order.discount, order.currency) }}</span
          >
        </div>
      </div>

      <!-- Total -->
      <div class="total-section">
        <div class="total-row">
          <span class="total-label">總計</span>
          <span class="total-amount">{{
            formatCurrency(order.total, order.currency)
          }}</span>
        </div>
      </div>

      <!-- Payment Method Display -->
      <div v-if="selectedPaymentMethod" class="payment-method-display">
        <div class="payment-method-label">支付方式</div>
        <div class="payment-method-info">
          <div class="payment-method-icon">
            <component
              :is="getPaymentMethodIcon(selectedPaymentMethod)"
              class="w-5 h-5"
            />
          </div>
          <span class="payment-method-name">{{
            getPaymentMethodName(selectedPaymentMethod)
          }}</span>
        </div>
      </div>

      <!-- Security Notice -->
      <div class="security-notice">
        <div class="security-icon">
          <svg
            class="w-4 h-4 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            ></path>
          </svg>
        </div>
        <p class="security-text">您的支付信息受到 SSL 加密保護</p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="summary-empty">
      <div class="empty-icon">
        <svg
          class="w-12 h-12 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          ></path>
        </svg>
      </div>
      <p class="empty-text">無法載入訂單信息</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Removed unused computed import
import type {
  PaymentMethod,
  CountryCode,
  CurrencyCode,
} from "@makanmakan/shared-types";

// Types
interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  customizations?: string[];
  notes?: string;
}

interface Order {
  id: string;
  restaurantId: number;
  restaurantName?: string;
  tableNumber?: string;
  country: CountryCode;
  currency: CurrencyCode;
  items: OrderItem[];
  subtotal: number;
  tax?: number;
  serviceFee?: number;
  deliveryFee?: number;
  discount?: number;
  total: number;
}

// Props
interface Props {
  order?: Order | null;
  loading?: boolean;
  showBreakdown?: boolean;
  selectedPaymentMethod?: PaymentMethod;
}

const _props = withDefaults(defineProps<Props>(), {
  showBreakdown: true,
  loading: false,
});

// Computed
const formatCurrency = (amount: number, currency: CurrencyCode): string => {
  const formatters = {
    TWD: new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      minimumFractionDigits: 0,
    }),
    MYR: new Intl.NumberFormat("ms-MY", {
      style: "currency",
      currency: "MYR",
      minimumFractionDigits: 2,
    }),
    VND: new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }),
  };
  return formatters[currency].format(amount);
};

const getTaxRate = (country: CountryCode): number => {
  const taxRates = {
    TW: 5,
    MY: 0,
    VN: 10,
  };
  return taxRates[country] || 0;
};

const getPaymentMethodName = (method: PaymentMethod): string => {
  const names = {
    credit_card: "信用卡",
    debit_card: "金融卡",
    bank_transfer: "銀行轉帳",
    e_wallet: "電子錢包",
    cash_on_delivery: "貨到付款",
    installment: "分期付款",
    points_payment: "點數支付",
    gift_card: "禮品卡",
    store_credit: "商店信用",
    buy_now_pay_later: "先買後付",
    cryptocurrency: "加密貨幣",
    mobile_payment: "手機支付",
    prepaid_card: "預付卡",
    loyalty_points: "會員積分",
  };
  return names[method] || method;
};

const getPaymentMethodIcon = (_method: PaymentMethod) => {
  // Return SVG icon component based on payment method
  // For now, return a generic card icon
  return "CreditCardIcon";
};
</script>

<style scoped>
/* Main container */
.order-summary {
  @apply bg-white rounded-2xl shadow-sm border border-gray-100 
         h-fit sticky top-6;
}

/* Header */
.summary-header {
  @apply flex items-center justify-between p-6 border-b border-gray-100;
}

.summary-title {
  @apply text-lg font-semibold text-gray-900;
}

.header-loading {
  @apply flex items-center;
}

.loading-spinner {
  @apply w-4 h-4 border-2 border-blue-500 border-t-transparent 
         rounded-full animate-spin;
}

/* Loading state */
.summary-loading {
  @apply p-6;
}

.skeleton-lines {
  @apply space-y-3;
}

.skeleton-line {
  @apply bg-gray-200 rounded animate-pulse;
}

/* Content */
.summary-content {
  @apply p-6 space-y-6;
}

/* Restaurant info */
.restaurant-info {
  @apply flex items-center space-x-3 p-4 bg-gray-50 rounded-xl;
}

.restaurant-icon {
  @apply flex-shrink-0;
}

.restaurant-details {
  @apply min-w-0 flex-1;
}

.restaurant-name {
  @apply font-medium text-gray-900 truncate;
}

.table-info {
  @apply text-sm text-gray-500;
}

/* Order ID */
.order-id-section {
  @apply space-y-1;
}

.order-id-label {
  @apply text-sm font-medium text-gray-600;
}

.order-id-value {
  @apply font-mono text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg;
}

/* Order items */
.order-items {
  @apply space-y-4;
}

.items-title {
  @apply font-medium text-gray-900 text-sm;
}

.items-list {
  @apply space-y-3;
}

.order-item {
  @apply flex justify-between items-start space-x-3 p-3 
         bg-gray-50 rounded-xl;
}

.item-info {
  @apply flex-1 min-w-0 space-y-2;
}

.item-main {
  @apply flex items-center justify-between;
}

.item-name {
  @apply font-medium text-gray-900 text-sm;
}

.item-quantity {
  @apply text-sm text-gray-500 ml-2;
}

.item-customizations {
  @apply flex flex-wrap gap-1;
}

.customization-tag {
  @apply px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full;
}

.item-notes {
  @apply text-xs text-gray-600;
}

.notes-label {
  @apply font-medium;
}

.notes-text {
  @apply ml-1;
}

.item-price {
  @apply font-semibold text-gray-900 text-sm flex-shrink-0;
}

/* Price breakdown */
.price-breakdown {
  @apply space-y-3 pt-4 border-t border-gray-100;
}

.breakdown-row {
  @apply flex justify-between items-center text-sm;
}

.breakdown-label {
  @apply text-gray-600;
}

.breakdown-value {
  @apply font-medium text-gray-900;
}

.discount-row .breakdown-label,
.discount-row .breakdown-value {
  @apply text-green-600;
}

/* Total */
.total-section {
  @apply pt-4 border-t-2 border-gray-200;
}

.total-row {
  @apply flex justify-between items-center;
}

.total-label {
  @apply text-lg font-semibold text-gray-900;
}

.total-amount {
  @apply text-xl font-bold text-gray-900;
}

/* Payment method display */
.payment-method-display {
  @apply pt-4 border-t border-gray-100 space-y-2;
}

.payment-method-label {
  @apply text-sm font-medium text-gray-600;
}

.payment-method-info {
  @apply flex items-center space-x-2 p-3 bg-blue-50 rounded-xl;
}

.payment-method-icon {
  @apply flex-shrink-0 text-blue-600;
}

.payment-method-name {
  @apply text-sm font-medium text-blue-700;
}

/* Security notice */
.security-notice {
  @apply flex items-center space-x-2 p-3 bg-green-50 rounded-xl
         border border-green-100;
}

.security-icon {
  @apply flex-shrink-0;
}

.security-text {
  @apply text-sm text-green-700 font-medium;
}

/* Empty state */
.summary-empty {
  @apply p-8 text-center space-y-4;
}

.empty-icon {
  @apply flex justify-center;
}

.empty-text {
  @apply text-gray-500;
}

/* Responsive design */
@media (max-width: 1024px) {
  .order-summary {
    @apply sticky top-0 z-10 rounded-none border-x-0 border-t-0;
  }
}

@media (max-width: 768px) {
  .summary-header,
  .summary-content {
    @apply p-4;
  }

  .order-item {
    @apply flex-col space-x-0 space-y-2 items-start;
  }

  .item-main {
    @apply w-full;
  }

  .item-price {
    @apply self-end;
  }
}

/* Dark mode support (if needed) */
@media (prefers-color-scheme: dark) {
  .order-summary {
    @apply bg-gray-800 border-gray-700;
  }

  .summary-title,
  .restaurant-name,
  .order-id-value,
  .item-name,
  .breakdown-value,
  .total-label,
  .total-amount {
    @apply text-gray-100;
  }

  .restaurant-info,
  .order-id-value,
  .order-item,
  .security-notice {
    @apply bg-gray-700;
  }
}

/* Print styles */
@media print {
  .order-summary {
    @apply shadow-none border border-gray-300;
  }

  .security-notice {
    @apply hidden;
  }
}
</style>
