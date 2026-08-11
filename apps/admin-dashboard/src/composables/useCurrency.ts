import { ref, computed } from "vue";
import type { CurrencyCode } from "@makanmasak/shared-types";
import {
  formatCurrency as sharedFormatCurrency,
  getCurrencySymbol as sharedGetCurrencySymbol,
  DEFAULT_CURRENCY,
} from "@makanmasak/utils";

const STORAGE_KEY = "admin_restaurant_currency";

/**
 * Reactive currency ref backed by sessionStorage for per-tab isolation.
 * Shared across all components that call useCurrency() in the same tab.
 */
const currencyCode = ref<CurrencyCode>(
  (sessionStorage.getItem(STORAGE_KEY) as CurrencyCode) || DEFAULT_CURRENCY,
);

/**
 * Set the active restaurant's currency.
 * Called by SettingsView on load/save, or when switching restaurants.
 */
export const setRestaurantCurrency = (code: CurrencyCode) => {
  currencyCode.value = code;
  sessionStorage.setItem(STORAGE_KEY, code);
};

/**
 * Clear currency (e.g., on logout or restaurant deselect).
 */
export const clearRestaurantCurrency = () => {
  currencyCode.value = DEFAULT_CURRENCY;
  sessionStorage.removeItem(STORAGE_KEY);
};

/**
 * Composable for currency formatting in admin dashboard components.
 *
 * Usage:
 * ```vue
 * const { formatPrice, currencySymbol } = useCurrency()
 * // In template: {{ formatPrice(12.50) }}  → "RM 12.50" or "NT$13"
 * ```
 */
export function useCurrency() {
  const currencySymbol = computed(() =>
    sharedGetCurrencySymbol(currencyCode.value),
  );

  /**
   * Format an amount using the current restaurant's currency.
   * Accepts major currency units, not cents.
   * Replaces all local formatMoney() implementations.
   */
  const formatPrice = (amount: number): string => {
    return sharedFormatCurrency(amount, currencyCode.value);
  };

  return {
    formatPrice,
    currencySymbol,
    currencyCode: computed(() => currencyCode.value),
  };
}
